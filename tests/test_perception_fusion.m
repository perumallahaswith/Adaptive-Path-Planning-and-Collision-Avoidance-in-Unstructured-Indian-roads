function test_perception_fusion()
% TEST_PERCEPTION_FUSION
% Unit test for multi_sensor_fusion
% Verifies:
%   1. Track initialization
%   2. Track confirmation threshold
%   3. Track coasting and pruning on missed detections

    fprintf('--- RUNNING UNIT TEST: Multi-Sensor Fusion ---\n');
    fusion = multi_sensor_fusion();
    
    % Cycle 1: Single detection (Unconfirmed)
    det1.x = 25.0; det1.y = 1.0; det1.vx = 2.0; det1.vy = 0.0; det1.classId = 2; det1.confidence = 0.95;
    tracks1 = fusion.update(det1, 0.1);
    assert(isempty(tracks1), 'Unconfirmed track returned on first cycle!');
    fprintf('[PASS] Test 1: First detection unconfirmed as expected.\n');
    
    % Cycle 2: Second consistent detection (Should Confirm)
    det2.x = 25.2; det2.y = 1.0; det2.vx = 2.0; det2.vy = 0.0; det2.classId = 2; det2.confidence = 0.96;
    tracks2 = fusion.update(det2, 0.2);
    assert(numel(tracks2) == 1, 'Track was not confirmed on second hit!');
    assert(tracks2(1).classId == 2, 'Track classification mismatch!');
    fprintf('[PASS] Test 2: Track confirmed on 2nd cycle (ID: %d, Class: %d)\n', tracks2(1).id, tracks2(1).classId);
    
    % Cycle 3 to 6: Sensor dropouts (Missed detections)
    for t = 3:7
        tracksMiss = fusion.update([], 0.1 * t);
    end
    assert(isempty(tracksMiss), 'Stale track was not pruned after multiple missed cycles!');
    fprintf('[PASS] Test 3: Stale track successfully pruned.\n');
    
    fprintf('=== ALL SENSOR FUSION UNIT TESTS PASSED ===\n\n');
end
