classdef longitudinal_speed_controller < handle
    % LONGITUDINAL_SPEED_CONTROLLER
    % Gain-scheduled PID controller with feedforward acceleration
    % and anti-windup for longitudinal speed tracking.
    
    properties
        Kp = 0.85;
        Ki = 0.15;
        Kd = 0.05;
        
        IntegralError = 0.0;
        PrevError     = 0.0;
        MaxIntegral   = 5.0;
        
        MaxThrottleAcc = 2.5;  % m/s^2 comfort acceleration limit
        MaxBrakeAcc    = 7.0;  % m/s^2 braking limit
        MaxJerk        = 3.2;  % m/s^3 comfort jerk limit
        PrevAccCmd     = 0.0;
    end
    
    methods
        function obj = longitudinal_speed_controller(varargin)
            if nargin > 0
                for i = 1:2:nargin
                    obj.(varargin{i}) = varargin{i+1};
                end
            end
        end
        
        function [accCmd, throttle, brake] = computeControl(obj, currentSpeed, targetSpeed, feedforwardAcc, dt)
            % COMPUTECONTROL Computes acceleration demand and pedal commands
            
            speedError = targetSpeed - currentSpeed;
            
            % Anti-windup integration
            obj.IntegralError = obj.IntegralError + speedError * dt;
            obj.IntegralError = max(-obj.MaxIntegral, min(obj.MaxIntegral, obj.IntegralError));
            
            % Derivative
            dError = (speedError - obj.PrevError) / max(0.001, dt);
            obj.PrevError = speedError;
            
            % Combined PID + Feedforward
            feedbackAcc = obj.Kp * speedError + obj.Ki * obj.IntegralError + obj.Kd * dError;
            totalAcc = feedforwardAcc + feedbackAcc;
            
            % Clamp acceleration command
            accCmd = max(-obj.MaxBrakeAcc, min(obj.MaxThrottleAcc, totalAcc));
            
            % Jerk Rate Limiting for Passenger Comfort (Relaxed during emergency braking)
            if accCmd < -3.5
                maxStepJerk = 15.0 * dt; % Allow sharp emergency deceleration
            else
                maxStepJerk = obj.MaxJerk * dt;
            end
            dAcc = accCmd - obj.PrevAccCmd;
            accCmd = obj.PrevAccCmd + max(-maxStepJerk, min(maxStepJerk, dAcc));
            obj.PrevAccCmd = accCmd;
            
            % Map to normalized Throttle [0, 1] and Brake [0, 1]
            if accCmd >= 0
                throttle = min(1.0, accCmd / obj.MaxThrottleAcc);
                brake = 0.0;
            else
                throttle = 0.0;
                brake = min(1.0, abs(accCmd) / obj.MaxBrakeAcc);
            end
        end
        
        function reset(obj)
            obj.IntegralError = 0.0;
            obj.PrevError = 0.0;
            obj.PrevAccCmd = 0.0;
        end
    end
end
