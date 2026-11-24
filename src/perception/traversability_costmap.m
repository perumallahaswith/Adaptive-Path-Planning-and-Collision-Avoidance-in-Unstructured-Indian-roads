classdef traversability_costmap < handle
    % TRAVERSABILITY_COSTMAP
    % Builds a 2D traversability grid for non-lane-based Indian roads.
    % Distinguishes between navigable asphalt, unpaved dirt shoulders,
    % potholes, and dynamic obstacles without requiring lane markings.
    
    properties
        Resolution = 0.25;      % meters per cell
        MapLength  = 50;        % meters forward
        MapWidth   = 20;        % meters lateral (-10 to +10)
        Grid                    % internal cost array [0 = free, 100 = occupied]
        OriginX
        OriginY
    end
    
    methods
        function obj = traversability_costmap(res, len, wid)
            if nargin >= 1, obj.Resolution = res; end
            if nargin >= 2, obj.MapLength = len; end
            if nargin >= 3, obj.MapWidth = wid; end
            
            numRows = round(obj.MapWidth / obj.Resolution);
            numCols = round(obj.MapLength / obj.Resolution);
            obj.Grid = zeros(numRows, numCols);
        end
        
        function update(obj, egoState, roadWidth, obstacleTracks)
            % UPDATE Recomputes the local costmap relative to current ego vehicle
            % egoState: [x, y, theta, v]
            numRows = size(obj.Grid, 1);
            numCols = size(obj.Grid, 2);
            obj.Grid = zeros(numRows, numCols);
            
            % 1. Mark Road Boundaries (Off-road / unpaved shoulder cost)
            halfWidth = roadWidth / 2;
            yCoords = linspace(-obj.MapWidth/2, obj.MapWidth/2, numRows);
            for r = 1:numRows
                distFromCenter = abs(yCoords(r));
                if distFromCenter > halfWidth
                    % Off-road high cost
                    obj.Grid(r, :) = 80;
                elseif distFromCenter > (halfWidth - 0.5)
                    % Soft shoulder penalty
                    obj.Grid(r, :) = 40;
                end
            end
            
            % 2. Inflate Obstacle Tracks onto Costmap
            egoX = egoState(1);
            egoY = egoState(2);
            egoTheta = egoState(3);
            
            R = [cos(-egoTheta), -sin(-egoTheta); sin(-egoTheta), cos(-egoTheta)];
            
            for i = 1:numel(obstacleTracks)
                ag = obstacleTracks(i);
                % Transform to ego vehicle local frame
                relPosGlobal = [ag.x - egoX; ag.y - egoY];
                relPosLocal  = R * relPosGlobal;
                
                lx = relPosLocal(1);
                ly = relPosLocal(2);
                
                % Check if inside local grid window
                if lx > 0 && lx < obj.MapLength && ly > -obj.MapWidth/2 && ly < obj.MapWidth/2
                    c = round(lx / obj.Resolution) + 1;
                    r = round((ly + obj.MapWidth/2) / obj.Resolution) + 1;
                    
                    % Safety inflation radius based on class
                    inflationCells = 3; % default ~0.75m
                    if ag.classId == 4 % Cattle: larger inflation
                        inflationCells = 6;
                    elseif ag.classId == 2 % Auto: moderate inflation
                        inflationCells = 4;
                    end
                    
                    rMin = max(1, r - inflationCells);
                    rMax = min(numRows, r + inflationCells);
                    cMin = max(1, c - inflationCells);
                    cMax = min(numCols, c + inflationCells);
                    
                    obj.Grid(rMin:rMax, cMin:cMax) = 100; % Lethal obstacle cost
                end
            end
        end
    end
end
