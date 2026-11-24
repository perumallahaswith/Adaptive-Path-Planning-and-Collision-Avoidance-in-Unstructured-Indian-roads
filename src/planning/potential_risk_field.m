classdef potential_risk_field
    % POTENTIAL_RISK_FIELD
    % Computes asymmetrical dynamic potential risk fields tailored to
    % heterogeneous Indian road agents (Cattle, Auto, Pushcart, Pedestrian).
    
    methods (Static)
        function cost = evaluateRisk(point, agent)
            % point: [x, y] candidate trajectory point
            % agent: struct with [futureStates, classId, uncertaintyRadius]
            
            agPos = agent.futureStates(1, 1:2);
            dx = point(1) - agPos(1);
            dy = point(2) - agPos(2);
            
            % Elliptical semi-axes [a_long, b_lat] based on agent type
            switch agent.classId
                case 4 % STRAY CATTLE
                    % Cattle can suddenly dart sideways -> high lateral ellipse
                    a_long = 3.5;
                    b_lat  = 2.8;
                    amplitude = 2500.0;
                    
                case 2 % AUTO-RICKSHAW
                    % Frequent sudden swerving
                    a_long = 4.0;
                    b_lat  = 1.8;
                    amplitude = 1800.0;
                    
                case 3 % TWO-WHEELER
                    % Fast gap squeezing
                    a_long = 3.8;
                    b_lat  = 1.6;
                    amplitude = 1500.0;
                    
                case 5 % PUSHCART
                    % Wide stationary/slow obstruction
                    a_long = 2.5;
                    b_lat  = 1.8;
                    amplitude = 1200.0;
                    
                case 6 % PEDESTRIAN
                    % Vulnerable road user
                    a_long = 2.2;
                    b_lat  = 2.2;
                    amplitude = 2200.0;
                    
                otherwise
                    a_long = 3.0;
                    b_lat  = 1.5;
                    amplitude = 1000.0;
            end
            
            % Elliptical normalized distance
            d_norm = (dx / a_long)^2 + (dy / b_lat)^2;
            
            if d_norm < 1.0
                % Inside core collision bubble
                cost = amplitude * (1.0 - d_norm)^2;
            elseif d_norm < 2.5
                % Gradual decay in danger zone
                cost = amplitude * 0.2 * exp(-2 * (d_norm - 1.0));
            else
                cost = 0.0;
            end
        end
    end
end
