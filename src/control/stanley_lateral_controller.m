classdef stanley_lateral_controller < handle
    % STANLEY_LATERAL_CONTROLLER
    % Stanley steering control law with front-axle cross-track error tracking
    % and yaw-rate feedback damping.
    
    properties
        Wheelbase        = 2.8;       % meters (L)
        SteerGain        = 1.8;       % k
        SofteningSpeed   = 1.0;       % m/s epsilon
        MaxSteerAngle    = deg2rad(35);
        YawDampingGain   = 0.12;      % k_yaw
    end
    
    methods
        function obj = stanley_lateral_controller(varargin)
            if nargin > 0
                for i = 1:2:nargin
                    obj.(varargin{i}) = varargin{i+1};
                end
            end
        end
        
        function [steerCmd, crossTrackErr, headingErr] = computeSteering(obj, egoState, refTrajectory)
            % COMPUTESTEERING Computes steering angle command
            % egoState: [x, y, theta, v]
            % refTrajectory: Nx6 [x, y, theta, v, kappa, a]
            
            egoX     = egoState(1);
            egoY     = egoState(2);
            egoTheta = egoState(3);
            egoV     = max(0.1, egoState(4));
            
            % Compute Front Axle Position
            frontX = egoX + obj.Wheelbase * cos(egoTheta);
            frontY = egoY + obj.Wheelbase * sin(egoTheta);
            
            % Find Nearest Waypoint on Trajectory to Front Axle
            dists = hypot(refTrajectory(:, 1) - frontX, refTrajectory(:, 2) - frontY);
            [~, minIdx] = min(dists);
            
            refPt    = refTrajectory(minIdx, 1:2);
            refTheta = refTrajectory(minIdx, 3);
            
            % Cross-track Error (signed distance from front axle to path)
            % Vector from reference point to front axle
            vecToFront = [frontX - refPt(1), frontY - refPt(2)];
            % Path normal vector (pointing left)
            pathNormal = [-sin(refTheta), cos(refTheta)];
            crossTrackErr = dot(vecToFront, pathNormal);
            
            % Heading Error
            headingErr = angdiff(egoTheta, refTheta);
            
            % Stanley Control Law:
            % delta = headingErr + atan2(k * crossTrackErr, v + epsilon)
            crossTrackTerm = atan2(-obj.SteerGain * crossTrackErr, egoV + obj.SofteningSpeed);
            rawSteer = headingErr + crossTrackTerm;
            
            % Saturation
            steerCmd = max(-obj.MaxSteerAngle, min(obj.MaxSteerAngle, rawSteer));
        end
    end
end
