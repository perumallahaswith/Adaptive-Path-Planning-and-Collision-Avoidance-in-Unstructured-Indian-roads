function history = run_full_pipeline(scenarioName)
% RUN_FULL_PIPELINE
% Executes the complete, closed-loop Autonomous Driving pipeline:
%   Perception -> Sensor Fusion -> Motion Prediction -> Stateflow Decision
%   -> Adaptive Path Planning -> Stanley Lateral & Longitudinal Control
%   -> Dynamic Vehicle Model -> Live Telemetry Dashboard & Metrics Report.
%
% Usage:
%   run_full_pipeline('cattle_crossing');
%   run_full_pipeline('village_road');
%   run_full_pipeline('intersection');
%   run_full_pipeline('dense_market');
%   run_full_pipeline('highway_merge');

    if nargin < 1
        scenarioName = 'cattle_crossing';
    end

    fprintf('=================================================================\n');
    fprintf('  SIH-26037: FULL CLOSED-LOOP AUTONOMOUS DRIVING SIMULATION\n');
    fprintf('  Loading Scenario: %s\n', upper(scenarioName));
    fprintf('=================================================================\n');

    % 1. Load Scenario
    [scenario, ego, meta] = benchmark_scenarios.create(scenarioName);
    dt = scenario.SampleTime;
    
    % 2. Initialize Subsystems
    fusion     = multi_sensor_fusion();
    predictor  = agent_trajectory_predictor(3.0, 0.2);
    fsm        = behavioral_stateflow_fsm();
    planner    = adaptive_trajectory_planner();
    latControl = stanley_lateral_controller();
    lonControl = longitudinal_speed_controller();
    plant      = vehicle_dynamics_bicycle([ego.Position(1); ego.Position(2); deg2rad(ego.Yaw); norm(ego.Velocity)]);
    dashboard  = telemetry_dashboard(meta.Name, scenario);
    
    % 3. History Logging Struct
    history = struct();
    history.time         = [];
    history.egoX         = [];
    history.egoY         = [];
    history.egoSpeed     = [];
    history.state        = {};
    history.latency      = [];
    history.minClearance = [];

    % 4. Simulation Execution Loop
    restart(scenario);
    simTime = 0.0;
    
    while advance(scenario)
        simTime = scenario.SimulationTime;
        
        % Read Ego State from Plant
        egoState = plant.State; % [x; y; theta; v]
        
        % Read Raw Detections from Scenario Actors
        actors = scenario.Actors;
        rawDetections = [];
        for i = 1:numel(actors)
            act = actors(i);
            if act.ActorID ~= ego.ActorID
                det.x = act.Position(1);
                det.y = act.Position(2);
                det.vx = act.Velocity(1);
                det.vy = act.Velocity(2);
                det.classId = act.ClassID;
                det.confidence = 0.95;
                rawDetections = [rawDetections; det]; %#ok<AGROW>
            end
        end
        
        % Subsystem 1: Multi-Sensor Fusion & Tracking
        confirmedTracks = fusion.update(rawDetections, simTime);
        
        % Subsystem 2: Short-Term Motion & Intent Prediction
        predictedAgents = predictor.predict(confirmedTracks);
        
        % Subsystem 3: Behavioral Decision Making (Stateflow FSM)
        [activeState, targetSpeed, reason] = fsm.step(egoState, predictedAgents, dt);
        
        % Subsystem 4: Adaptive Spatiotemporal Path & Speed Planner
        [plannedTrajectory, latencyMs] = planner.planTrajectory(egoState, targetSpeed, predictedAgents, activeState);
        
        % Subsystem 5: Motion Control
        [steerCmd, crossTrackErr, headingErr] = latControl.computeSteering(egoState, plannedTrajectory);
        targetAcc = (plannedTrajectory(1, 4) - egoState(4)) / max(0.1, dt);
        [accCmd, throttle, brake] = lonControl.computeControl(egoState(4), targetSpeed, targetAcc, dt);
        
        % Subsystem 6: Vehicle Dynamics Plant Update
        plant.step(steerCmd, accCmd, dt);
        
        % Sync scenario ego position with simulated plant
        ego.Position = [egoState(1), egoState(2), 0];
        ego.Yaw = rad2deg(egoState(3));
        ego.Velocity = [egoState(4)*cos(egoState(3)), egoState(4)*sin(egoState(3)), 0];
        
        % Calculate Minimum Clearance to Any Actor
        minClearance = Inf;
        for k = 1:numel(confirmedTracks)
            d = norm([egoState(1) - confirmedTracks(k).x, egoState(2) - confirmedTracks(k).y]);
            if d < minClearance
                minClearance = d;
            end
        end
        
        % Logging
        history.time(end+1)         = simTime;
        history.egoX(end+1)         = egoState(1);
        history.egoY(end+1)         = egoState(2);
        history.egoSpeed(end+1)     = egoState(4);
        history.state{end+1}        = activeState;
        history.latency(end+1)      = latencyMs;
        history.minClearance(end+1) = minClearance;
        
        % Update Live Telemetry HUD
        dashboard.update(simTime, egoState, plannedTrajectory, confirmedTracks, activeState, latencyMs, scenario);
        pause(0.02);
    end
    
    % 5. Benchmark Performance Report
    evaluate_benchmark_metrics.computeReport(history, meta.Name);
end
