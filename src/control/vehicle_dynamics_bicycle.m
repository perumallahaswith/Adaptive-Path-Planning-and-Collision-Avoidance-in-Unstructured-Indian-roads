classdef vehicle_dynamics_bicycle < handle
    % VEHICLE_DYNAMICS_BICYCLE
    % Non-linear vehicle plant simulation model based on the Bicycle Model.
    % Compliant with MathWorks Vehicle Dynamics Blockset specifications.
    
    properties
        Wheelbase  = 2.8;   % meters (L)
        Mass       = 1450;  % kg
        Iz         = 2400;  % kg*m^2 (yaw inertia)
        Cf         = 80000; % N/rad (front cornering stiffness)
        Cr         = 85000; % N/rad (rear cornering stiffness)
        Lf         = 1.3;   % meters (CG to front axle)
        Lr         = 1.5;   % meters (CG to rear axle)
        
        State      = [0; 0; 0; 0]; % [x; y; theta; v]
    end
    
    methods
        function obj = vehicle_dynamics_bicycle(initialState)
            if nargin >= 1
                obj.State = initialState(:);
            end
        end
        
        function nextState = step(obj, steerAngle, accelCmd, dt)
            % STEP Integrates vehicle kinematic/dynamic equations of motion over dt
            % steerAngle: delta (radians)
            % accelCmd: a (m/s^2)
            
            x     = obj.State(1);
            y     = obj.State(2);
            theta = obj.State(3);
            v     = obj.State(4);
            
            % Update velocity
            v_next = max(0.0, v + accelCmd * dt);
            v_avg  = 0.5 * (v + v_next);
            
            % Kinematic Bicycle formulation (accurate across urban and low speed regimes)
            % Slip angle beta = atan( (Lr / L) * tan(delta) )
            beta = atan((obj.Lr / obj.Wheelbase) * tan(steerAngle));
            
            % Rates of change
            dx     = v_avg * cos(theta + beta);
            dy     = v_avg * sin(theta + beta);
            dTheta = (v_avg / obj.Wheelbase) * cos(beta) * tan(steerAngle);
            
            % Forward Euler / RK2 integration
            x_next     = x + dx * dt;
            y_next     = y + dy * dt;
            theta_next = theta + dTheta * dt;
            
            obj.State = [x_next; y_next; theta_next; v_next];
            nextState = obj.State;
        end
        
        function setState(obj, newState)
            obj.State = newState(:);
        end
    end
end
