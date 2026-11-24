classdef agent_trajectory_predictor < handle
    % AGENT_TRAJECTORY_PREDICTOR
    % Short-term motion and intent prediction for heterogeneous Indian road agents.
    % Handles non-lane-based movement, sudden swerving, and erratic stops.
    
    properties
        PredictionHorizon = 3.0; % seconds forward
        PredictionStep    = 0.3; % seconds time interval
    end
    
    methods
        function obj = agent_trajectory_predictor(horizon, step)
            if nargin >= 1, obj.PredictionHorizon = horizon; end
            if nargin >= 2, obj.PredictionStep = step; end
        end
        
        function predictedTrajectories = predict(obj, confirmedTracks)
            % PREDICT Generates predictive trajectory arrays for each confirmed track
            % Output: struct array with fields [trackId, classId, futureStates, uncertaintyRadius]
            
            numTracks = numel(confirmedTracks);
            tSteps = 0:obj.PredictionStep:obj.PredictionHorizon;
            N = numel(tSteps);
            
            if numTracks == 0
                predictedTrajectories = struct('trackId', {}, 'classId', {}, 'futureStates', {}, 'uncertaintyRadius', {});
                return;
            end
            
            predictedTrajectories = repmat(struct(...
                'trackId', 0, ...
                'classId', 0, ...
                'futureStates', zeros(N, 4), ...
                'uncertaintyRadius', 0 ...
            ), numTracks, 1);
            
            for i = 1:numTracks
                track = confirmedTracks(i);
                pred = struct();
                pred.trackId = track.id;
                pred.classId = track.classId;
                
                states = zeros(N, 4); % [x, y, vx, vy]
                
                switch track.classId
                    case 4 % STRAY CATTLE
                        % Cattle model: High uncertainty, rapid deceleration or sudden swerve
                        states = obj.predictCattle(track, tSteps);
                        uncertainty = 1.8; % meters expanding reachability
                        
                    case 2 % AUTO-RICKSHAW
                        % Auto-rickshaw model: CTRA with high lateral drift
                        states = obj.predictAutoRickshaw(track, tSteps);
                        uncertainty = 1.4;
                        
                    case 3 % TWO-WHEELER
                        % Two-wheeler model: Agile, high turning capability
                        states = obj.predictTwoWheeler(track, tSteps);
                        uncertainty = 1.3;
                        
                    case {5, 6} % PUSHCART & PEDESTRIANS
                        % Slow linear drift model
                        states = obj.predictSlowAgent(track, tSteps);
                        uncertainty = 0.8;
                        
                    otherwise % Standard vehicles
                        states = obj.predictConstantVelocity(track, tSteps);
                        uncertainty = 1.0;
                end
                
                pred.futureStates = states;
                pred.uncertaintyRadius = uncertainty;
                predictedTrajectories(i) = pred;
            end
        end
        
        function states = predictCattle(obj, track, tSteps)
            % Cattle tend to pause abruptly or wander slowly
            N = numel(tSteps);
            states = zeros(N, 4);
            decelFactor = 0.7; % rapid deceleration tendency
            for k = 1:N
                dt = tSteps(k);
                decay = exp(-decelFactor * dt);
                states(k, 1) = track.x + track.vx * (1 - decay) / decelFactor;
                states(k, 2) = track.y + track.vy * (1 - decay) / decelFactor;
                states(k, 3) = track.vx * decay;
                states(k, 4) = track.vy * decay;
            end
        end
        
        function states = predictAutoRickshaw(obj, track, tSteps)
            % Auto-rickshaws frequently exhibit non-zero angular yaw rate
            N = numel(tSteps);
            states = zeros(N, 4);
            speed = norm([track.vx, track.vy]);
            heading = atan2(track.vy, track.vx);
            omega = 0.05; % slight natural lateral drift
            
            for k = 1:N
                dt = tSteps(k);
                currHeading = heading + omega * dt;
                states(k, 1) = track.x + speed * cos(currHeading) * dt;
                states(k, 2) = track.y + speed * sin(currHeading) * dt;
                states(k, 3) = speed * cos(currHeading);
                states(k, 4) = speed * sin(currHeading);
            end
        end
        
        function states = predictTwoWheeler(obj, track, tSteps)
            % Constant velocity with small sinusoidal gap-filtering bias
            N = numel(tSteps);
            states = zeros(N, 4);
            for k = 1:N
                dt = tSteps(k);
                states(k, 1) = track.x + track.vx * dt;
                states(k, 2) = track.y + track.vy * dt + 0.15 * sin(2 * dt);
                states(k, 3) = track.vx;
                states(k, 4) = track.vy;
            end
        end
        
        function states = predictSlowAgent(obj, track, tSteps)
            N = numel(tSteps);
            states = zeros(N, 4);
            for k = 1:N
                dt = tSteps(k);
                states(k, 1) = track.x + track.vx * dt;
                states(k, 2) = track.y + track.vy * dt;
                states(k, 3) = track.vx;
                states(k, 4) = track.vy;
            end
        end
        
        function states = predictConstantVelocity(obj, track, tSteps)
            N = numel(tSteps);
            states = zeros(N, 4);
            for k = 1:N
                dt = tSteps(k);
                states(k, 1) = track.x + track.vx * dt;
                states(k, 2) = track.y + track.vy * dt;
                states(k, 3) = track.vx;
                states(k, 4) = track.vy;
            end
        end
    end
end
