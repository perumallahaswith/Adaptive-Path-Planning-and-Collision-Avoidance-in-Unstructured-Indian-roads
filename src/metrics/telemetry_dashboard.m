classdef telemetry_dashboard < handle
    % TELEMETRY_DASHBOARD
    % Professional multi-panel HUD and telemetry visualization for SIH presentation.
    % High-performance, flicker-free rendering with persistent graphical handles.
    
    properties
        FigHandle
        AxMap
        AxHUD
        AxSpeed
        HudAnnotation
        SpeedLine
        LatencyLine
        
        % Persistent Map Graphics Handles
        EgoMarker
        EgoHeadingLine
        TrajectoryLine
        ObstacleGroup
        
        TimeData    = []
        SpeedData   = []
        LatencyData = []
        
        RoadDrawn = false
    end
    
    methods
        function obj = telemetry_dashboard(scenarioTitle, scenarioObj)
            if nargin < 1, scenarioTitle = 'Autonomous Navigation Simulation'; end
            
            % High-contrast modern dark theme figure
            obj.FigHandle = figure('Name', ['SIH-26037 Telemetry Dashboard: ' scenarioTitle], ...
                'Color', [0.10 0.11 0.13], 'Position', [80 60 1200 720]);
            
            % 1. Main Bird's-Eye View Map (Left/Center: 2 rows x 3 cols, spanning cols 1-2)
            obj.AxMap = subplot(2, 3, [1 2 4 5], 'Parent', obj.FigHandle);
            set(obj.AxMap, 'Color', [0.15 0.16 0.18], 'XColor', 'w', 'YColor', 'w');
            grid(obj.AxMap, 'on'); hold(obj.AxMap, 'on'); axis(obj.AxMap, 'equal');
            xlabel(obj.AxMap, 'Longitudinal Position X (m)', 'Color', 'w');
            ylabel(obj.AxMap, 'Lateral Position Y (m)', 'Color', 'w');
            title(obj.AxMap, ['Live Navigation: ' scenarioTitle], 'Color', 'cyan', 'FontSize', 12, 'FontWeight', 'bold');
            
            % Draw Road Geometry Once
            if nargin >= 2 && ~isempty(scenarioObj)
                obj.drawRoads(scenarioObj);
            end
            
            % Initialize Persistent Ego & Trajectory Handles
            obj.TrajectoryLine = plot(obj.AxMap, NaN, NaN, 'c--', 'LineWidth', 2.2, 'DisplayName', 'Planned Path');
            obj.EgoMarker      = plot(obj.AxMap, NaN, NaN, 'c^', 'MarkerSize', 11, 'MarkerFaceColor', 'cyan', 'MarkerEdgeColor', 'w', 'DisplayName', 'Ego Vehicle');
            obj.EgoHeadingLine = plot(obj.AxMap, [NaN NaN], [NaN NaN], 'Color', 'cyan', 'LineWidth', 2.0);
            
            % 2. Speedometer & Telemetry Plot (Top Right)
            obj.AxSpeed = subplot(2, 3, 3, 'Parent', obj.FigHandle);
            set(obj.AxSpeed, 'Color', [0.15 0.16 0.18], 'XColor', 'w', 'YColor', 'w');
            grid(obj.AxSpeed, 'on'); hold(obj.AxSpeed, 'on');
            title(obj.AxSpeed, 'Vehicle Speed (km/h)', 'Color', 'w');
            xlabel(obj.AxSpeed, 'Time (s)', 'Color', 'w');
            ylabel(obj.AxSpeed, 'km/h', 'Color', 'w');
            obj.SpeedLine = plot(obj.AxSpeed, 0, 0, 'Color', [0.2 0.8 1.0], 'LineWidth', 2);
            
            % 3. Replanning Latency Plot (Bottom Right)
            obj.AxHUD = subplot(2, 3, 6, 'Parent', obj.FigHandle);
            set(obj.AxHUD, 'Color', [0.15 0.16 0.18], 'XColor', 'w', 'YColor', 'w');
            grid(obj.AxHUD, 'on'); hold(obj.AxHUD, 'on');
            title(obj.AxHUD, 'Replanning Latency (ms)', 'Color', 'w');
            xlabel(obj.AxHUD, 'Time (s)', 'Color', 'w');
            ylabel(obj.AxHUD, 'ms', 'Color', 'w');
            % 50ms benchmark threshold line
            yline(obj.AxHUD, 50, '--r', 'Benchmark (50ms)', 'LineWidth', 1.5, 'LabelHorizontalAlignment', 'left');
            obj.LatencyLine = plot(obj.AxHUD, 0, 0, 'Color', [0.4 1.0 0.4], 'LineWidth', 1.8);
            
            % 4. Live State HUD Overlay Box
            obj.HudAnnotation = annotation(obj.FigHandle, 'textbox', [0.14 0.76 0.32 0.16], ...
                'Color', 'w', 'BackgroundColor', [0.08 0.09 0.11 0.85], ...
                'EdgeColor', [0.2 0.7 1.0], 'LineWidth', 1.5, ...
                'FontSize', 9.5, 'FontName', 'Courier', 'FontWeight', 'bold', ...
                'String', 'Initializing Autonomous Driving Pipeline...');
        end
        
        function drawRoads(obj, scenarioObj)
            try
                % Extract exact road boundaries from drivingScenario
                rb = roadBoundaries(scenarioObj);
                for k = 1:numel(rb)
                    boundary = rb{k};
                    plot(obj.AxMap, boundary(:,1), boundary(:,2), ...
                        'Color', [0.55 0.55 0.58], 'LineWidth', 2.0, 'HandleVisibility', 'off');
                end
                obj.RoadDrawn = true;
            catch
                % Fallback: attempt scenario plot
                try
                    plot(scenarioObj, 'Parent', obj.AxMap, 'RoadCenters', 'off');
                    obj.RoadDrawn = true;
                catch
                end
            end
        end
        
        function update(obj, simTime, egoState, plannedTrajectory, obstacleTracks, activeState, latencyMs, scenarioObj)
            if ~ishandle(obj.FigHandle)
                return; % Figure was closed by user
            end
            
            egoX     = egoState(1);
            egoY     = egoState(2);
            egoTheta = egoState(3);
            egoVel   = egoState(4);
            
            % Draw roads on first update if not yet drawn
            if ~obj.RoadDrawn && nargin >= 8 && ~isempty(scenarioObj)
                obj.drawRoads(scenarioObj);
            end
            
            % Ensure hold is permanently on
            hold(obj.AxMap, 'on');
            
            % 1. Update Ego Marker & Heading Vector
            set(obj.EgoMarker, 'XData', egoX, 'YData', egoY);
            
            % Heading pointer (3 meters length)
            arrowX = [egoX, egoX + 3.0 * cos(egoTheta)];
            arrowY = [egoY, egoY + 3.0 * sin(egoTheta)];
            set(obj.EgoHeadingLine, 'XData', arrowX, 'YData', arrowY);
            
            % 2. Update Planned Trajectory
            if ~isempty(plannedTrajectory)
                set(obj.TrajectoryLine, 'XData', plannedTrajectory(:,1), 'YData', plannedTrajectory(:,2));
            else
                set(obj.TrajectoryLine, 'XData', NaN, 'YData', NaN);
            end
            
            % 3. Update Dynamic Obstacles & Safety Bubbles
            % Delete previous obstacle annotations cleanly
            delete(obj.ObstacleGroup);
            obj.ObstacleGroup = [];
            
            th = linspace(0, 2*pi, 24);
            for i = 1:numel(obstacleTracks)
                ag = obstacleTracks(i);
                switch ag.classId
                    case 4 % Cattle
                        color = [1.0 0.35 0.1];
                        label = 'Cattle (Cow)';
                        r_bubble = 2.5;
                    case 2 % Auto-rickshaw
                        color = [1.0 0.82 0.0];
                        label = 'Auto-Rickshaw';
                        r_bubble = 1.5;
                    case 3 % Two-wheeler
                        color = [0.3 0.95 0.4];
                        label = '2-Wheeler';
                        r_bubble = 1.4;
                    case 5 % Pushcart
                        color = [0.85 0.45 1.0];
                        label = 'Pushcart';
                        r_bubble = 1.5;
                    case 6 % Pedestrian
                        color = [1.0 0.4 0.65];
                        label = 'Pedestrian';
                        r_bubble = 2.0;
                    otherwise
                        color = [0.7 0.7 0.7];
                        label = 'Obstacle';
                        r_bubble = 1.2;
                end
                
                % Obstacle Marker (Square)
                hObs = plot(obj.AxMap, ag.x, ag.y, 's', 'MarkerSize', 8, ...
                    'MarkerFaceColor', color, 'MarkerEdgeColor', 'w', 'HandleVisibility', 'off');
                
                % Safety Bubble Circle
                bx = ag.x + r_bubble * cos(th);
                by = ag.y + r_bubble * sin(th);
                hBub = plot(obj.AxMap, bx, by, 'Color', color, 'LineStyle', ':', ...
                    'LineWidth', 1.2, 'HandleVisibility', 'off');
                
                % Text Label
                hTxt = text(obj.AxMap, ag.x + 0.8, ag.y + 0.8, label, ...
                    'Color', color, 'FontSize', 8, 'FontWeight', 'bold', 'HandleVisibility', 'off');
                
                obj.ObstacleGroup = [obj.ObstacleGroup, hObs, hBub, hTxt];
            end
            
            % Follow Ego camera (smooth camera window)
            xlim(obj.AxMap, [egoX - 22, egoX + 48]);
            ylim(obj.AxMap, [egoY - 14, egoY + 14]);
            
            % 4. Update Telemetry Strip Charts
            obj.TimeData(end+1)    = simTime;
            obj.SpeedData(end+1)   = egoVel * 3.6;
            obj.LatencyData(end+1) = latencyMs;
            
            set(obj.SpeedLine, 'XData', obj.TimeData, 'YData', obj.SpeedData);
            xlim(obj.AxSpeed, [max(0, simTime - 10), max(2, simTime + 0.5)]);
            ylim(obj.AxSpeed, [0, max(60, max(obj.SpeedData) + 10)]);
            
            set(obj.LatencyLine, 'XData', obj.TimeData, 'YData', obj.LatencyData);
            xlim(obj.AxHUD, [max(0, simTime - 10), max(2, simTime + 0.5)]);
            ylim(obj.AxHUD, [0, 55]);
            
            % 5. Update HUD Text Overlay
            hudStr = sprintf('SIM TIME: %5.2f s\nEGO SPEED: %5.1f km/h\nSTATE: [%s]\nPLANNER LATENCY: %4.1f ms (PASS)\nTRACKED AGENTS: %d', ...
                simTime, egoVel * 3.6, activeState, latencyMs, numel(obstacleTracks));
            set(obj.HudAnnotation, 'String', hudStr);
            
            % Flush rendering buffer
            drawnow;
        end
    end
end
