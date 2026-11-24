function test_all_scenarios()
% TEST_ALL_SCENARIOS
% Batch regression validation suite running all 5 Indian road scenarios.
% Generates an evaluation scorecard for SIH presentation.

    fprintf('=================================================================\n');
    fprintf('   SIH-26037: BATCH VALIDATION ACROSS ALL 5 BENCHMARK SCENARIOS\n');
    fprintf('=================================================================\n\n');
    
    scenarios = benchmark_scenarios.getAvailableScenarios();
    results = table('Size', [numel(scenarios), 6], ...
        'VariableTypes', {'string', 'double', 'double', 'double', 'double', 'string'}, ...
        'VariableNames', {'Scenario', 'AvgLatencyMs', 'MaxLatencyMs', 'MinClearanceM', 'Collisions', 'Status'});
    
    for sIdx = 1:numel(scenarios)
        sName = scenarios{sIdx};
        fprintf('-> Testing Scenario %d/%d: %s...\n', sIdx, numel(scenarios), sName);
        
        [scenario, ego, meta] = benchmark_scenarios.create(sName);
        dt = scenario.SampleTime;
        
        fusion     = multi_sensor_fusion();
        predictor  = agent_trajectory_predictor(3.0, 0.2);
        fsm        = behavioral_stateflow_fsm();
        planner    = adaptive_trajectory_planner();
        latControl = stanley_lateral_controller();
        lonControl = longitudinal_speed_controller();
        plant      = vehicle_dynamics_bicycle([ego.Position(1); ego.Position(2); deg2rad(ego.Yaw); norm(ego.Velocity)]);
        
        latencies = [];
        minClearances = [];
        collisions = 0;
        
        restart(scenario);
        while advance(scenario)
            simTime = scenario.SimulationTime;
            egoState = plant.State;
            
            % Raw Detections
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
            
            % Perception & Fusion
            confirmedTracks = fusion.update(rawDetections, simTime);
            
            % Prediction
            predictedAgents = predictor.predict(confirmedTracks);
            
            % Stateflow FSM
            [activeState, targetSpeed] = fsm.step(egoState, predictedAgents, dt);
            
            % Adaptive Planner
            [plannedTraj, latencyMs] = planner.planTrajectory(egoState, targetSpeed, predictedAgents, activeState);
            latencies(end+1) = latencyMs; %#ok<AGROW>
            
            % Control
            [steerCmd, ~, ~] = latControl.computeSteering(egoState, plannedTraj);
            targetAcc = (plannedTraj(1, 4) - egoState(4)) / max(0.1, dt);
            [accCmd, ~, ~] = lonControl.computeControl(egoState(4), targetSpeed, targetAcc, dt);
            
            % Plant
            plant.step(steerCmd, accCmd, dt);
            
            % Clearance Check
            for k = 1:numel(confirmedTracks)
                d = norm([egoState(1) - confirmedTracks(k).x, egoState(2) - confirmedTracks(k).y]);
                minClearances(end+1) = d; %#ok<AGROW>
                if d < 0.2
                    collisions = collisions + 1;
                end
            end
        end
        
        avgLat = mean(latencies);
        maxLat = max(latencies);
        minClr = min(minClearances);
        if isempty(minClr), minClr = 99.0; end
        
        passed = (collisions == 0) && (avgLat < 50.0);
        status = 'PASS';
        if ~passed, status = 'FAIL'; end
        
        results.Scenario(sIdx)     = string(sName);
        results.AvgLatencyMs(sIdx) = avgLat;
        results.MaxLatencyMs(sIdx) = maxLat;
        results.MinClearanceM(sIdx)= minClr;
        results.Collisions(sIdx)   = collisions;
        results.Status(sIdx)       = string(status);
        
        fprintf('   Result: %s | Avg Latency: %.2f ms | Min Clearance: %.2f m | Collisions: %d\n', ...
            status, avgLat, minClr, collisions);
    end
    
    fprintf('\n=================================================================\n');
    fprintf('               FINAL BATCH VALIDATION SCORECARD\n');
    fprintf('=================================================================\n');
    disp(results);
    fprintf('=================================================================\n');
end
