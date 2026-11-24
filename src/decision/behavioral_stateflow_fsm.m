classdef behavioral_stateflow_fsm < handle
    % BEHAVIORAL_STATEFLOW_FSM
    % Hierarchical behavioral decision executive for unstructured Indian traffic.
    % Mirrors MathWorks Stateflow chart semantics with debounce hysteresis.
    %
    % States:
    %   1. CRUISE             - Nominal free-space travel
    %   2. NUDGE              - Lateral avoidance around slow obstacle/pushcart
    %   3. INCHING            - Dynamic creeping in dense pedestrian/market crowds
    %   4. INTERACTIVE_MERGE  - Gap-acceptance yielding at unsignalized intersections
    %   5. EMERGENCY_STOP     - Full deceleration upon imminent collision hazard
    
    properties
        CurrentState      = 'CRUISE';
        PreviousState     = 'CRUISE';
        TimeInState       = 0.0;     % seconds
        MinStateDwellTime = 0.4;     % hysteresis debounce
        
        % Safety Thresholds
        EmergencyTTC_Threshold = 1.3; % seconds
        YieldTTC_Threshold     = 2.8; % seconds
        InchingSpeedThreshold  = 3.5; % m/s (~12 km/h)
        DenseClusterRadius     = 7.0; % meters
    end
    
    methods
        function obj = behavioral_stateflow_fsm(varargin)
            if nargin > 0
                for i = 1:2:nargin
                    obj.(varargin{i}) = varargin{i+1};
                end
            end
        end
        
        function [state, targetSpeed, reason] = step(obj, egoState, predictedAgents, dt)
            % STEP Evaluates transitions and updates active driving state
            % Inputs:
            %   egoState: [x, y, theta, v]
            %   predictedAgents: struct array from predictor
            %   dt: cycle duration
            % Outputs:
            %   state: string name of active state
            %   targetSpeed: recommended speed limit (m/s)
            %   reason: diagnostic explanation for telemetry
            
            obj.TimeInState = obj.TimeInState + dt;
            egoPos = egoState(1:2);
            egoVel = egoState(4);
            
            % Compute Scene Metrics
            [minTTC, minDist, isFrontBlocked, clusterDensity, criticalClass] = ...
                obj.computeSceneMetrics(egoPos, egoVel, predictedAgents);
            
            nextState = obj.CurrentState;
            reason = 'Nominal driving';
            
            % --- Transition Evaluation ---
            % Rule 1: Emergency Brake has highest preemptive priority (no dwell delay)
            if minTTC < obj.EmergencyTTC_Threshold || minDist < 2.0
                nextState = 'EMERGENCY_STOP';
                reason = sprintf('Critical hazard! Obstacle (Class %d) TTC=%.1fs < %.1fs', ...
                    criticalClass, minTTC, obj.EmergencyTTC_Threshold);
                
            % Rule 2: From Emergency Stop -> Only transition back if safe for > dwell time
            elseif strcmp(obj.CurrentState, 'EMERGENCY_STOP')
                if minTTC > 3.0 && minDist > 4.5 && obj.TimeInState > obj.MinStateDwellTime
                    nextState = 'INCHING';
                    reason = 'Hazard clearing, cautiously inching forward';
                else
                    nextState = 'EMERGENCY_STOP';
                    reason = 'Holding emergency brake until road clears';
                end
                
            % Rule 3: Dense crowded market -> Inching / Creep mode
            elseif clusterDensity >= 3 && minDist < obj.DenseClusterRadius
                if obj.TimeInState > obj.MinStateDwellTime || strcmp(obj.CurrentState, 'CRUISE')
                    nextState = 'INCHING';
                    reason = sprintf('Dense crowd detected (%d agents within %.1fm)', ...
                        clusterDensity, obj.DenseClusterRadius);
                end
                
            % Rule 4: Approaching intersection / aggressive crossing agent -> Interactive Merge / Yield
            elseif (minTTC < obj.YieldTTC_Threshold || isFrontBlocked) && ~strcmp(obj.CurrentState, 'INCHING')
                if obj.TimeInState > obj.MinStateDwellTime || strcmp(obj.CurrentState, 'CRUISE')
                    nextState = 'INTERACTIVE_MERGE';
                    reason = sprintf('Yielding to crossing/turning traffic (TTC=%.1fs)', minTTC);
                end
                
            % Rule 5: Static or slow obstacle ahead with clear lateral space -> Nudge
            elseif isFrontBlocked && minDist < 15.0 && ~strcmp(obj.CurrentState, 'INCHING')
                nextState = 'NUDGE';
                reason = 'Slow/parked obstacle ahead, initiating lateral nudge';
                
            % Rule 6: Open road -> Cruise
            else
                if obj.TimeInState > obj.MinStateDwellTime
                    nextState = 'CRUISE';
                    reason = 'Clear traversable corridor ahead';
                end
            end
            
            % Update State Tracking
            if ~strcmp(nextState, obj.CurrentState)
                obj.PreviousState = obj.CurrentState;
                obj.CurrentState  = nextState;
                obj.TimeInState   = 0.0;
            end
            
            state = obj.CurrentState;
            targetSpeed = obj.getStateTargetSpeed(state);
        end
        
        function [minTTC, minDist, isFrontBlocked, clusterDensity, criticalClass] = ...
                computeSceneMetrics(obj, egoPos, egoVel, agents)
            
            minTTC = Inf;
            minDist = Inf;
            isFrontBlocked = false;
            clusterDensity = 0;
            criticalClass = 0;
            
            for i = 1:numel(agents)
                ag = agents(i);
                % Initial position from predicted futureStates(1,:)
                if isfield(ag, 'futureStates') && ~isempty(ag.futureStates)
                    agPos = ag.futureStates(1, 1:2);
                    agVel = norm(ag.futureStates(1, 3:4));
                else
                    continue;
                end
                
                dist = norm(agPos - egoPos);
                if dist < obj.DenseClusterRadius
                    clusterDensity = clusterDensity + 1;
                end
                
                if dist < minDist
                    minDist = dist;
                    criticalClass = ag.classId;
                end
                
                % Check if in direct longitudinal corridor
                dx = agPos(1) - egoPos(1);
                dy = agPos(2) - egoPos(2);
                if dx > 0 && dx < 25.0 && abs(dy) < 1.6
                    isFrontBlocked = true;
                    relSpeed = max(0.1, egoVel - agVel);
                    ttc = dx / relSpeed;
                    if ttc < minTTC
                        minTTC = ttc;
                        criticalClass = ag.classId;
                    end
                end
            end
        end
        
        function vTarget = getStateTargetSpeed(obj, state)
            switch state
                case 'EMERGENCY_STOP'
                    vTarget = 0.0;
                case 'INCHING'
                    vTarget = 1.8;   % ~6.5 km/h
                case 'INTERACTIVE_MERGE'
                    vTarget = 4.0;   % ~14.4 km/h
                case 'NUDGE'
                    vTarget = 7.0;   % ~25.2 km/h
                case 'CRUISE'
                    vTarget = 14.0;  % ~50.4 km/h
                otherwise
                    vTarget = 10.0;
            end
        end
    end
end
