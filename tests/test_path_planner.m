function test_path_planner()
% TEST_PATH_PLANNER
% Unit test for adaptive_trajectory_planner
% Verifies:
%   1. Sub-50ms replanning latency
%   2. Curvature constraint satisfaction
%   3. Collision avoidance with sudden obstacle

    fprintf('--- RUNNING UNIT TEST: Adaptive Path Planner ---\n');
    planner = adaptive_trajectory_planner();
    
    % JIT Compilation Warmup Pass
    egoStateWarmup = [0, 0, 0, 10.0];
    planner.planTrajectory(egoStateWarmup, 12.0, [], 'CRUISE');
    
    % Test Case 1: Open road nominal cruise
    egoState = [0, 0, 0, 10.0]; % [x, y, theta, v]
    targetSpeed = 12.0;
    agents = [];
    activeState = 'CRUISE';
    
    [traj, latency] = planner.planTrajectory(egoState, targetSpeed, agents, activeState);
    
    assert(~isempty(traj), 'Planner failed to produce trajectory on open road.');
    assert(latency < 50.0, sprintf('Latency %.2f ms exceeded 50ms benchmark!', latency));
    assert(all(abs(traj(:, 5)) <= planner.MaxCurvature + 1e-3), 'Curvature limit violated!');
    fprintf('[PASS] Test 1: Open road planning (Latency: %.2f ms)\n', latency);
    
    % Test Case 2: Sudden Cattle in lane at x=20, y=0
    cow.futureStates = repmat([20, 0, 0, 0], 10, 1);
    cow.classId = 4;
    cow.uncertaintyRadius = 2.0;
    agents = cow;
    
    [trajAvoid, latencyAvoid] = planner.planTrajectory(egoState, targetSpeed, agents, 'NUDGE');
    assert(~isempty(trajAvoid), 'Planner failed to avoid cattle obstacle.');
    
    % Verify lateral deviation away from y=0
    maxLatOffset = max(abs(trajAvoid(:, 2)));
    assert(maxLatOffset > 0.5, 'Planner did not steer around obstacle!');
    fprintf('[PASS] Test 2: Dynamic obstacle avoidance (Max lateral offset: %.2f m, Latency: %.2f ms)\n', ...
        maxLatOffset, latencyAvoid);
    
    % Test Case 3: Emergency Stop
    [trajStop, latencyStop] = planner.planTrajectory(egoState, 0.0, agents, 'EMERGENCY_STOP');
    assert(trajStop(end, 4) <= 0.1, 'Emergency stop trajectory did not reach 0 speed!');
    fprintf('[PASS] Test 3: Emergency stop trajectory generated successfully.\n');
    
    fprintf('=== ALL PATH PLANNER UNIT TESTS PASSED ===\n\n');
end
