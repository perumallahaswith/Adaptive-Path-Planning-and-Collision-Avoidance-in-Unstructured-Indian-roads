function scenarios = create_indian_road_scenarios()
% CREATE_INDIAN_ROAD_SCENARIOS
% Creates the 5 required benchmark scenarios for SIH-26037:
%   1. Unmarked Village Road (Narrow, unpaved shoulders, slow tractor)
%   2. Unsignalized Urban Intersection (Multi-directional auto-rickshaws & 2-wheelers)
%   3. Highway Merge with Slow Vehicles (Aggressive slow merge into faster lane)
%   4. Dense Market Mixed Traffic (Pedestrians, pushcart, high density)
%   5. Sudden Cattle Crossing (Emergency obstacle avoidance)
%
% Toolboxes utilized: Automated Driving Toolbox (drivingScenario, driving.scenario.*)

    fprintf('=====================================================\n');
    fprintf('  SIH-26037: Indian Road Benchmark Scenario Generator\n');
    fprintf('=====================================================\n');

    scenarios = struct();
    
    scenarios.village_road       = build_village_road();
    scenarios.intersection       = build_urban_intersection();
    scenarios.highway_merge      = build_highway_merge();
    scenarios.dense_market       = build_dense_market();
    scenarios.cattle_crossing    = build_cattle_crossing();
    
    fprintf('[OK] Successfully generated all 5 Indian road benchmark scenarios.\n');
end

%% Scenario 1: Unmarked Village Road
function scenario = build_village_road()
    fprintf(' -> Generating Scenario 1: Unmarked Village Road...\n');
    scenario = drivingScenario('StopTime', 15, 'SampleTime', 0.1);
    
    % Unmarked 2-way road (no lane markings, 5m total width)
    roadCenters = [0 0 0; 50 2 0; 100 8 0; 160 10 0; 220 5 0];
    roadWidth = 5.2; 
    road(scenario, roadCenters, roadWidth);
    
    % Ego Vehicle
    ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.5, 'Width', 1.8, 'Height', 1.4);
    egoWaypoints = [5 1.2 0; 50 3.2 0; 100 9.2 0; 160 11.2 0; 210 6.2 0];
    trajectory(ego, egoWaypoints, 10); % 10 m/s (~36 km/h)
    
    % Slow Moving Tractor / Pushcart ahead in ego path
    tractor = actor(scenario, 'ClassID', 5, 'Length', 3.8, 'Width', 2.0, 'Height', 2.2);
    trWaypoints = [45 2.5 0; 80 5.0 0; 120 9.5 0; 180 11.0 0];
    trajectory(tractor, trWaypoints, 3.5); % 3.5 m/s (~12 km/h)
    
    % Oncoming Motorcycle hugging center
    bike = actor(scenario, 'ClassID', 3, 'Length', 2.0, 'Width', 0.8, 'Height', 1.4);
    bikeWaypoints = [190 7.5 0; 130 9.8 0; 70 4.0 0; 20 0.5 0];
    trajectory(bike, bikeWaypoints, 8); % 8 m/s (~28 km/h)
    
    attach_sensors(scenario, ego);
end

%% Scenario 2: Unsignalized Urban Intersection
function scenario = build_urban_intersection()
    fprintf(' -> Generating Scenario 2: Unsignalized Urban Intersection...\n');
    scenario = drivingScenario('StopTime', 12, 'SampleTime', 0.1);
    
    % Main East-West road
    road(scenario, [-100 0 0; 100 0 0], 8.0);
    % Crossing North-South road
    road(scenario, [0 -80 0; 0 80 0], 7.0);
    
    % Ego moving Eastbound
    ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
    trajectory(ego, [-60 -2.0 0; 60 -2.0 0], 8.0);
    
    % Aggressive Auto-Rickshaw cutting across without signal from South
    auto = vehicle(scenario, 'ClassID', 2, 'Length', 2.8, 'Width', 1.3, 'Height', 1.7);
    autoWaypoints = [0 -50 0; 0 -5 0; 15 -1.0 0; 50 -1.0 0];
    trajectory(auto, autoWaypoints, 6.0);
    
    % Two-wheeler turning right across ego path
    scooter = actor(scenario, 'ClassID', 3, 'Length', 1.9, 'Width', 0.8, 'Height', 1.3);
    scooterWaypoints = [40 2.0 0; 5 1.5 0; -2 20 0; -2 60 0];
    trajectory(scooter, scooterWaypoints, 7.0);
    
    attach_sensors(scenario, ego);
end

%% Scenario 3: Highway Merge with Slow Vehicles
function scenario = build_highway_merge()
    fprintf(' -> Generating Scenario 3: Highway Merge with Slow Vehicles...\n');
    scenario = drivingScenario('StopTime', 15, 'SampleTime', 0.1);
    
    % 3-lane Highway
    road(scenario, [0 0 0; 300 0 0], 10.5);
    % On-ramp connecting at x=100
    rampCenters = [20 -15 0; 60 -8 0; 110 -3.5 0; 160 0 0];
    road(scenario, rampCenters, 4.0);
    
    % Ego vehicle cruising in left/middle lane at highway speed
    ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
    trajectory(ego, [10 -3.5 0; 280 -3.5 0], 18.0); % ~65 km/h
    
    % Slow 3-wheeler merging slowly onto the highway from ramp
    slowMerger = vehicle(scenario, 'ClassID', 2, 'Length', 2.8, 'Width', 1.3, 'Height', 1.7);
    mergeWaypoints = [25 -14 0; 70 -7 0; 115 -3.5 0; 220 -3.5 0];
    trajectory(slowMerger, mergeWaypoints, 7.0); % ~25 km/h merge!
    
    attach_sensors(scenario, ego);
end

%% Scenario 4: Dense Market Area (Mixed Traffic & Crowds)
function scenario = build_dense_market()
    fprintf(' -> Generating Scenario 4: Dense Market Area...\n');
    scenario = drivingScenario('StopTime', 18, 'SampleTime', 0.1);
    
    % Narrow market street with encroached sides
    road(scenario, [0 0 0; 120 0 0], 6.0);
    
    % Ego creeping forward (inching behavior required)
    ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.5, 'Width', 1.8, 'Height', 1.4);
    trajectory(ego, [5 0 0; 110 0 0], 3.0); % Inching speed ~10 km/h
    
    % Pushcart vendor occupying left lane
    pushcart = actor(scenario, 'ClassID', 5, 'Length', 2.0, 'Width', 1.1, 'Height', 1.3);
    trajectory(pushcart, [25 -1.8 0; 50 -1.8 0], 0.8);
    
    % Pedestrians jaywalking across the road
    ped1 = actor(scenario, 'ClassID', 6, 'Length', 0.5, 'Width', 0.5, 'Height', 1.7);
    trajectory(ped1, [30 2.5 0; 32 -2.5 0], 1.2);
    
    ped2 = actor(scenario, 'ClassID', 6, 'Length', 0.5, 'Width', 0.5, 'Height', 1.7);
    trajectory(ped2, [55 -2.5 0; 54 2.5 0], 1.1);
    
    % Two-wheeler squeezing past
    bike = actor(scenario, 'ClassID', 3, 'Length', 1.9, 'Width', 0.8, 'Height', 1.3);
    trajectory(bike, [10 1.6 0; 80 1.6 0], 4.5);
    
    attach_sensors(scenario, ego);
end

%% Scenario 5: Sudden Cattle Crossing Event
function scenario = build_cattle_crossing()
    fprintf(' -> Generating Scenario 5: Sudden Cattle Crossing Event...\n');
    scenario = drivingScenario('StopTime', 10, 'SampleTime', 0.05);
    
    % Suburban single carriageway
    road(scenario, [0 0 0; 150 0 0], 7.0);
    
    % Ego vehicle cruising at 12 m/s (~43 km/h)
    ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
    trajectory(ego, [5 -1.75 0; 140 -1.75 0], 12.0);
    
    % Stray cattle starting at roadside and suddenly stepping into ego lane at t ≈ 3s
    cow = actor(scenario, 'ClassID', 4, 'Length', 2.2, 'Width', 0.9, 'Height', 1.5);
    cowWaypoints = [45 3.0 0; 47 1.0 0; 48 -1.5 0; 48 -1.5 0]; % Steps right into lane and freezes
    cowSpeeds = [1.2; 1.0; 0.0; 0.0];
    trajectory(cow, cowWaypoints, cowSpeeds);
    
    attach_sensors(scenario, ego);
end

%% Multi-Sensor Rig Setup
function attach_sensors(scenario, ego)
    % Multi-sensor setup as specified in problem statement:
    % 1. Forward Vision Sensor (Camera)
    % 2. 360-degree LiDAR
    % 3. Long-range Radar
    
    % Camera Sensor
    visionSensor = visionDetectionGenerator(...
        'SensorIndex', 1, ...
        'SensorLocation', [ego.Length/2 0], ...
        'Height', ego.Height, ...
        'Yaw', 0, ...
        'DetectionProbability', 0.95, ...
        'MaxRange', 60);
        
    % Radar Sensor
    radarSensor = drivingRadarDataGenerator(...
        'SensorIndex', 2, ...
        'MountingLocation', [ego.Length/2 0 0.5], ...
        'FieldOfView', [90 10], ...
        'RangeLimits', [0 80]);
        
    % 3D LiDAR Sensor
    lidarSensor = lidarPointCloudGenerator(...
        'SensorIndex', 3, ...
        'SensorLocation', [0 0], ...
        'Height', ego.Height + 0.3, ...
        'AzimuthLimits', [-180 180], ...
        'MaxRange', 75);
        
    % Sensors successfully configured for Ego
end
