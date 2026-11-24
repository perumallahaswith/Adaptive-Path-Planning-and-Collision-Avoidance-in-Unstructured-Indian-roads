classdef adaptive_trajectory_planner < handle
    % ADAPTIVE_TRAJECTORY_PLANNER
    % Real-time adaptive local motion planner for non-lane-based driving.
    % Optimizes spatiotemporal trajectories using quintic polynomial sampling
    % and asymmetric risk potential fields.
    
    properties
        PlanningHorizon   = 3.5;  % seconds
        PlanningStep      = 0.1;  % seconds
        MaxSteerAngle     = deg2rad(35);
        MaxCurvature      = 0.28; % 1/m (min turning radius ~3.5m)
        MaxDecelComfort   = 4.5;  % m/s^2
        MaxDecelEmergency = 7.5;  % m/s^2
        LastLatencyMs     = 0.0;
        
        % Weights for Multi-Objective Cost Function
        w_collision  = 20.0;
        w_smoothness = 1.2;
        w_jerk       = 0.8;
        w_progress   = 1.5;
        w_offset     = 0.6;
    end
    
    methods
        function obj = adaptive_trajectory_planner(varargin)
            if nargin > 0
                for i = 1:2:nargin
                    obj.(varargin{i}) = varargin{i+1};
                end
            end
        end
        
        function [optimalTraj, latencyMs] = planTrajectory(obj, egoState, targetSpeed, predictedAgents, activeState)
            % PLANTRAJECTORY Computes collision-free spatiotemporal trajectory
            % Inputs:
            %   egoState: [x, y, theta, v]
            %   targetSpeed: desired velocity from FSM (m/s)
            %   predictedAgents: struct array with predicted trajectories
            %   activeState: string name of current Stateflow state
            % Outputs:
            %   optimalTraj: Nx6 array [x, y, theta, v, kappa, a]
            %   latencyMs: execution latency in milliseconds
            
            t0 = tic;
            
            x0     = egoState(1);
            y0     = egoState(2);
            theta0 = egoState(3);
            v0     = egoState(4);
            
            % Special State: EMERGENCY_STOP -> Generate Hard Braking Trajectory
            if strcmp(activeState, 'EMERGENCY_STOP')
                optimalTraj = obj.generateStopTrajectory(x0, y0, theta0, v0);
                latencyMs = toc(t0) * 1000;
                obj.LastLatencyMs = latencyMs;
                return;
            end
            
            % Discretized time steps
            t = (0:obj.PlanningStep:obj.PlanningHorizon)';
            N = numel(t);
            
            % Candidate lateral offsets (sampling across drivable corridor)
            if strcmp(activeState, 'INCHING')
                % Narrower lateral search in dense crowds
                offsets = [-0.8, -0.4, 0.0, 0.4, 0.8];
            else
                offsets = [-2.2, -1.5, -0.8, 0.0, 0.8, 1.5, 2.2];
            end
            
            bestCost = Inf;
            bestTraj = [];
            
            for d = offsets
                % Longitudinal velocity profile: linear ramp towards targetSpeed
                v = linspace(v0, targetSpeed, N)';
                % Acceleration profile
                a = (targetSpeed - v0) / obj.PlanningHorizon * ones(N, 1);
                
                % Arc-length s(t)
                s = cumsum(v * obj.PlanningStep);
                
                % Lateral transition using smooth quintic sigmoid
                tau = min(1.0, s / max(1.0, s(end)));
                latShift = d * (10 * tau.^3 - 15 * tau.^4 + 6 * tau.^5);
                
                % Global trajectory points
                trajX = x0 + s * cos(theta0) - latShift * sin(theta0);
                trajY = y0 + s * sin(theta0) + latShift * cos(theta0);
                
                % Heading and curvature calculation
                dx = [diff(trajX); 0];
                dy = [diff(trajY); 0];
                headings = atan2(dy, dx);
                headings(end) = headings(end-1);
                
                % Curvature kappa = dTheta / ds
                dTheta = [diff(unwrap(headings)); 0];
                ds = max(0.01, [diff(s); obj.PlanningStep * v(end)]);
                curvatures = dTheta ./ ds;
                
                % Kinematic feasibility check
                if any(abs(curvatures) > obj.MaxCurvature)
                    continue; % reject unsteerable trajectories
                end
                
                candidateTraj = [trajX, trajY, headings, v, curvatures, a];
                
                % Evaluate Multi-Objective Cost
                cost = obj.evaluateCost(candidateTraj, predictedAgents, d, targetSpeed);
                
                if cost < bestCost
                    bestCost = cost;
                    bestTraj = candidateTraj;
                end
            end
            
            % Fallback if all offsets rejected
            if isempty(bestTraj)
                bestTraj = obj.generateStopTrajectory(x0, y0, theta0, v0);
            end
            
            optimalTraj = bestTraj;
            latencyMs = toc(t0) * 1000;
            obj.LastLatencyMs = latencyMs;
        end
        
        function cost = evaluateCost(obj, traj, agents, latOffset, targetSpeed)
            % Multi-objective cost: Collision + Smoothness + Jerk + Offset
            N = size(traj, 1);
            
            % 1. Obstacle Collision Risk via Potential Field
            collisionCost = 0.0;
            for k = 1:N
                pt = traj(k, 1:2);
                for i = 1:numel(agents)
                    ag = agents(i);
                    cost_i = potential_risk_field.evaluateRisk(pt, ag);
                    collisionCost = collisionCost + cost_i;
                end
            end
            
            % 2. Smoothness & Jerk (Curvature & lateral accel)
            curvatures = traj(:, 5);
            speeds = traj(:, 4);
            latAccel = (speeds.^2) .* curvatures;
            smoothnessCost = sum(curvatures.^2) + 0.1 * sum(latAccel.^2);
            
            % 3. Lateral offset penalty (prefers center line if clear)
            offsetCost = abs(latOffset)^2;
            
            % 4. Progress cost (penalize moving slower than targetSpeed)
            progressCost = sum((targetSpeed - speeds).^2);
            
            cost = obj.w_collision * collisionCost + ...
                   obj.w_smoothness * smoothnessCost + ...
                   obj.w_offset * offsetCost + ...
                   obj.w_progress * progressCost;
        end
        
        function traj = generateStopTrajectory(obj, x0, y0, theta0, v0)
            % Emergency maximum comfort stop
            t = (0:obj.PlanningStep:obj.PlanningHorizon)';
            N = numel(t);
            v = max(0, v0 - obj.MaxDecelEmergency * t);
            a = -obj.MaxDecelEmergency * (v > 0);
            s = cumsum(v * obj.PlanningStep);
            
            x = x0 + s * cos(theta0);
            y = y0 + s * sin(theta0);
            headings = repmat(theta0, N, 1);
            curvatures = zeros(N, 1);
            
            traj = [x, y, headings, v, curvatures, a];
        end
    end
end
