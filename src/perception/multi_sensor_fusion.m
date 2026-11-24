classdef multi_sensor_fusion < handle
    % MULTI_SENSOR_FUSION
    % Fuses heterogeneous detections from Camera, Radar, and LiDAR.
    % Maintains confirmed tracks for all surrounding Indian road agents
    % (Cattle, Auto-rickshaws, Pushcarts, Two-wheelers, Pedestrians, Cars).
    
    properties
        TrackConfirmationThreshold = 2;  % cycles to confirm
        TrackDeletionThreshold     = 4;  % missed cycles to delete
        MaxTracks                  = 50; % max concurrent tracks
        Tracks                     = struct([]); % internal state
        NextTrackID                = 1;
        GateDistanceThreshold      = 4.5; % meters association gate
    end
    
    methods
        function obj = multi_sensor_fusion(varargin)
            if nargin > 0
                for i = 1:2:nargin
                    obj.(varargin{i}) = varargin{i+1};
                end
            end
        end
        
        function confirmedTracks = update(obj, rawDetections, simTime)
            % UPDATE Integrates raw detections and returns filtered, confirmed tracks
            % Inputs:
            %   rawDetections: struct array with fields [x, y, vx, vy, classId, confidence]
            %   simTime: current timestamp (seconds)
            % Output:
            %   confirmedTracks: struct array of validated surrounding actors
            
            % Step 1: Predict existing tracks forward
            obj.predictTracks(simTime);
            
            % Step 2: Associate detections to existing tracks (GNN Gating)
            [unassignedTracks, unassignedDetections, matchedPairs] = obj.associate(rawDetections);
            
            % Step 3: Update matched tracks with measurement
            for k = 1:size(matchedPairs, 1)
                tIdx = matchedPairs(k, 1);
                dIdx = matchedPairs(k, 2);
                obj.updateTrackWithDetection(tIdx, rawDetections(dIdx), simTime);
            end
            
            % Step 4: Penalize unassigned tracks (missed detections)
            for k = 1:numel(unassignedTracks)
                tIdx = unassignedTracks(k);
                obj.Tracks(tIdx).MissedCount = obj.Tracks(tIdx).MissedCount + 1;
            end
            
            % Step 5: Initialize new candidate tracks from unassigned detections
            for k = 1:numel(unassignedDetections)
                dIdx = unassignedDetections(k);
                obj.initTrack(rawDetections(dIdx), simTime);
            end
            
            % Step 6: Prune stale tracks
            obj.pruneTracks();
            
            % Step 7: Filter out unconfirmed tracks
            confirmedTracks = obj.getConfirmedTracks();
        end
        
        function predictTracks(obj, ~)
            for i = 1:numel(obj.Tracks)
                dt = 0.1; % default time step
                obj.Tracks(i).x = obj.Tracks(i).x + obj.Tracks(i).vx * dt;
                obj.Tracks(i).y = obj.Tracks(i).y + obj.Tracks(i).vy * dt;
            end
        end
        
        function [unassignedTracks, unassignedDets, matched] = associate(obj, detections)
            numT = numel(obj.Tracks);
            numD = numel(detections);
            
            if numT == 0
                unassignedTracks = [];
                unassignedDets = 1:numD;
                matched = [];
                return;
            end
            if numD == 0
                unassignedTracks = 1:numT;
                unassignedDets = [];
                matched = [];
                return;
            end
            
            % Distance matrix
            costMatrix = zeros(numT, numD);
            for t = 1:numT
                for d = 1:numD
                    costMatrix(t, d) = norm([obj.Tracks(t).x - detections(d).x, ...
                                            obj.Tracks(t).y - detections(d).y]);
                end
            end
            
            matched = [];
            unassignedTracks = 1:numT;
            unassignedDets = 1:numD;
            
            % Greedy nearest neighbor matching within threshold
            while true
                [minVal, linearIdx] = min(costMatrix(:));
                if isempty(minVal) || minVal > obj.GateDistanceThreshold || isinf(minVal)
                    break;
                end
                [t, d] = ind2sub(size(costMatrix), linearIdx);
                matched = [matched; t, d]; %#ok<AGROW>
                
                costMatrix(t, :) = Inf;
                costMatrix(:, d) = Inf;
                
                unassignedTracks(unassignedTracks == t) = [];
                unassignedDets(unassignedDets == d) = [];
            end
        end
        
        function updateTrackWithDetection(obj, tIdx, det, simTime)
            alpha = 0.7; % Simple constant-gain complementary filter
            obj.Tracks(tIdx).x = alpha * det.x + (1 - alpha) * obj.Tracks(tIdx).x;
            obj.Tracks(tIdx).y = alpha * det.y + (1 - alpha) * obj.Tracks(tIdx).y;
            obj.Tracks(tIdx).vx = alpha * det.vx + (1 - alpha) * obj.Tracks(tIdx).vx;
            obj.Tracks(tIdx).vy = alpha * det.vy + (1 - alpha) * obj.Tracks(tIdx).vy;
            obj.Tracks(tIdx).classId = det.classId; % update classification
            obj.Tracks(tIdx).HitCount = obj.Tracks(tIdx).HitCount + 1;
            obj.Tracks(tIdx).MissedCount = 0;
            obj.Tracks(tIdx).LastUpdateTime = simTime;
        end
        
        function initTrack(obj, det, simTime)
            if numel(obj.Tracks) >= obj.MaxTracks
                return;
            end
            newTrack.id = obj.NextTrackID;
            obj.NextTrackID = obj.NextTrackID + 1;
            newTrack.x = det.x;
            newTrack.y = det.y;
            newTrack.vx = det.vx;
            newTrack.vy = det.vy;
            newTrack.classId = det.classId;
            newTrack.HitCount = 1;
            newTrack.MissedCount = 0;
            newTrack.LastUpdateTime = simTime;
            
            if isempty(obj.Tracks)
                obj.Tracks = newTrack;
            else
                obj.Tracks(end+1) = newTrack;
            end
        end
        
        function pruneTracks(obj)
            if isempty(obj.Tracks)
                return;
            end
            keepMask = [obj.Tracks.MissedCount] < obj.TrackDeletionThreshold;
            obj.Tracks = obj.Tracks(keepMask);
        end
        
        function confirmed = getConfirmedTracks(obj)
            if isempty(obj.Tracks)
                confirmed = struct([]);
                return;
            end
            confirmedMask = [obj.Tracks.HitCount] >= obj.TrackConfirmationThreshold;
            confirmed = obj.Tracks(confirmedMask);
        end
    end
end
