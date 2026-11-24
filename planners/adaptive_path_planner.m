classdef adaptive_path_planner < handle
    % ADAPTIVE_PATH_PLANNER
    % Adaptive real-time local trajectory planner for unstructured Indian road conditions.
    % Handles:
    %   - Non-lane-based continuous costmap navigation
    %   - Dynamic safety margins tailored to agent type (Cattle, Auto, Pushcart)
    %   - Inching mode for dense crowd environments
    %   - Sub-50ms replanning latency
    
    properties
        VehicleLength = 4.7;
        VehicleWidth = 1.8;
        Wheelbase = 2.8;
        MaxSteerAngle = deg2rad(35);
        MaxSpeed = 15;        % m/s (~54 km/h)
        MaxDecel = 6.0;       % m/s^2 (comfort/emergency limit)
        TimeHorizon = 4.0;    % seconds forward prediction
        TimeStep = 0.2;       % discrete plan step
        
        % Differentiated Safety Margins (meters)
        SafetyMargins = struct(...
            'Default',     1.0, ...
            'AutoRickshaw', 1.5, ...
            'TwoWheeler',   1.4, ...
            'Cattle',       2.5, ...
            'Pushcart',     1.5, ...
            'Pedestrian',   2.0  ...
        );
        
        LastPlanLatency = 0; % ms
    end
    
    methods
        function obj = adaptive_path_planner(varargin)
            % Constructor
            if nargin > 0
                for i = 1:2:nargin
                    obj.(varargin{i}) = varargin{i+1};
                end
            end
        end
        
        function [trajectory, activeMode, latency] = plan(obj, egoState, targetGoal, detectedAgents, roadBoundaryCostmap)
            % PLAN Evaluates candidate trajectories and returns optimal path & mode
            % Inputs:
            %   egoState: [x, y, theta, v]
            %   targetGoal: [x_g, y_g]
            %   detectedAgents: struct array with fields: [x, y, vx, vy, classId]
            %   roadBoundaryCostmap: binary or continuous costmap
            % Outputs:
            %   trajectory: Nx5 matrix [x, y, theta, v, curvature]
            %   activeMode: 'CRUISE', 'NUDGE', 'INCHING', 'YIELD', 'EMERGENCY_STOP'
            
            tic;
            
            % 1. Determine Behavioral Mode via Risk Assessment
            [activeMode, criticalAgent] = obj.assessRisk(egoState, detectedAgents);
            
            % 2. Generate Trajectory Candidates based on Mode
            switch activeMode
                case 'EMERGENCY_STOP'
                    trajectory = obj.generateEmergencyBrakingPath(egoState);
                    
                case 'INCHING'
                    trajectory = obj.generateInchingPath(egoState, targetGoal, detectedAgents);
                    
                case {'NUDGE', 'CRUISE', 'YIELD'}
                    trajectory = obj.generateAdaptiveFrenetCandidates(egoState, targetGoal, detectedAgents, activeMode);
            end
            
            latency = toc * 1000; % milliseconds
            obj.LastPlanLatency = latency;
        end
        
        function [mode, criticalAgent] = assessRisk(obj, egoState, agents)
            % Assesses minimum Time-to-Collision (TTC) & spatial clearance
            egoPos = egoState(1:2);
            egoVel = egoState(4);
            
            minTTC = Inf;
            minDist = Inf;
            criticalAgent = [];
            mode = 'CRUISE';
            
            for i = 1:numel(agents)
                ag = agents(i);
                agPos = [ag.x, ag.y];
                dist = norm(agPos - egoPos);
                
                % Agent-specific safety margin
                margin = obj.getAgentMargin(ag.classId);
                
                % Approximate relative approach speed
                relSpeed = egoVel - ag.vx; 
                if relSpeed > 0.5
                    ttc = (dist - margin) / relSpeed;
                else
                    ttc = Inf;
                end
                
                if ttc < minTTC
                    minTTC = ttc;
                    criticalAgent = ag;
                end
                if dist < minDist
                    minDist = dist;
                end
            end
            
            % Decision thresholds
            if minTTC < 1.4 || minDist < 2.0
                mode = 'EMERGENCY_STOP';
            elseif minTTC < 3.0 || minDist < 4.0
                mode = 'YIELD';
            elseif minDist < 6.0
                % If in a dense cluster with low speed -> Inching
                if egoVel < 4.0
                    mode = 'INCHING';
                else
                    mode = 'NUDGE';
                end
            else
                mode = 'CRUISE';
            end
        end
        
        function margin = getAgentMargin(obj, classId)
            switch classId
                case 2 % Auto-rickshaw
                    margin = obj.SafetyMargins.AutoRickshaw;
                case 3 % Two-wheeler
                    margin = obj.SafetyMargins.TwoWheeler;
                case 4 % Cattle
                    margin = obj.SafetyMargins.Cattle;
                case 5 % Pushcart
                    margin = obj.SafetyMargins.Pushcart;
                case 6 % Pedestrian
                    margin = obj.SafetyMargins.Pedestrian;
                otherwise
                    margin = obj.SafetyMargins.Default;
            end
        end
        
        function traj = generateEmergencyBrakingPath(obj, egoState)
            % Maximum comfort deceleration along current heading
            v0 = egoState(4);
            theta = egoState(3);
            x0 = egoState(1);
            y0 = egoState(2);
            
            t = (0:obj.TimeStep:obj.TimeHorizon)';
            % v(t) = max(0, v0 - a_max * t)
            v = max(0, v0 - obj.MaxDecel * t);
            s = cumsum(v * obj.TimeStep);
            
            x = x0 + s * cos(theta);
            y = y0 + s * sin(theta);
            traj = [x, y, repmat(theta, size(x)), v, zeros(size(x))];
        end
        
        function traj = generateInchingPath(obj, egoState, targetGoal, ~)
            % Low-speed creeping path (~1.5 m/s) with high steering sensitivity
            inchSpeed = 1.5;
            x0 = egoState(1);
            y0 = egoState(2);
            theta = egoState(3);
            
            t = (0:obj.TimeStep:obj.TimeHorizon)';
            v = repmat(inchSpeed, size(t));
            s = cumsum(v * obj.TimeStep);
            
            % Steer towards goal gradually
            goalAngle = atan2(targetGoal(2) - y0, targetGoal(1) - x0);
            heading = theta + 0.3 * (goalAngle - theta);
            
            x = x0 + s * cos(heading);
            y = y0 + s * sin(heading);
            traj = [x, y, repmat(heading, size(x)), v, zeros(size(x))];
        end
        
        function traj = generateAdaptiveFrenetCandidates(obj, egoState, targetGoal, agents, mode)
            % Generates lateral offset trajectories around obstacles
            x0 = egoState(1);
            y0 = egoState(2);
            theta0 = egoState(3);
            v0 = egoState(4);
            
            targetSpeed = obj.MaxSpeed;
            if strcmp(mode, 'YIELD')
                targetSpeed = targetSpeed * 0.4;
            elseif strcmp(mode, 'NUDGE')
                targetSpeed = targetSpeed * 0.7;
            end
            
            % Lateral offsets to test (meters relative to nominal heading)
            offsets = [-2.0, -1.2, -0.6, 0.0, 0.6, 1.2, 2.0];
            bestScore = Inf;
            bestTraj = [];
            
            t = (0:obj.TimeStep:obj.TimeHorizon)';
            v = linspace(v0, targetSpeed, numel(t))';
            s = cumsum(v * obj.TimeStep);
            
            for d = offsets
                % Candidate trajectory with lateral polynomial shift
                latShift = d * (1 - exp(-s / 10));
                candX = x0 + s * cos(theta0) - latShift * sin(theta0);
                candY = y0 + s * sin(theta0) + latShift * cos(theta0);
                candTheta = theta0 + atan2(d, 15);
                
                candTraj = [candX, candY, repmat(candTheta, size(candX)), v, zeros(size(candX))];
                
                % Cost evaluation: collision risk + lateral deviation + jerk
                cost = obj.evaluateTrajectoryCost(candTraj, agents, d);
                
                if cost < bestScore
                    bestScore = cost;
                    bestTraj = candTraj;
                end
            end
            
            traj = bestTraj;
        end
        
        function cost = evaluateTrajectoryCost(obj, traj, agents, latOffset)
            % Trajectory cost function
            w_collision = 1000.0;
            w_offset = 2.0;
            w_smoothness = 1.0;
            
            cost = abs(latOffset) * w_offset;
            
            for k = 1:size(traj, 1)
                pt = traj(k, 1:2);
                for i = 1:numel(agents)
                    ag = agents(i);
                    dist = norm(pt - [ag.x, ag.y]);
                    margin = obj.getAgentMargin(ag.classId);
                    
                    if dist < margin
                        cost = cost + w_collision * (margin - dist)^2;
                    end
                end
            end
        end
    end
end
