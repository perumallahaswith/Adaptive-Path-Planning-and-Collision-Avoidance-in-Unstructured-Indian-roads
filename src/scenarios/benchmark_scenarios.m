classdef benchmark_scenarios
    % BENCHMARK_SCENARIOS
    % Factory class generating the 5 mandatory Indian road benchmark scenarios:
    %   1. 'village_road'    - Unmarked narrow road, unpaved shoulders, slow tractor
    %   2. 'intersection'    - Busy unsignalized 4-way urban junction with auto-rickshaws
    %   3. 'highway_merge'   - High-speed highway with slow merging 3-wheeler
    %   4. 'dense_market'    - High-density pedestrian crowd, pushcart, inching required
    %   5. 'cattle_crossing' - Sudden stray cow stepping into travel lane
    
    methods (Static)
        function list = getAvailableScenarios()
            list = {'village_road', 'intersection', 'highway_merge', 'dense_market', 'cattle_crossing'};
        end
        
        function [scenario, ego, meta] = create(scenarioName)
            switch lower(scenarioName)
                case 'village_road'
                    [scenario, ego, meta] = benchmark_scenarios.buildVillageRoad();
                case 'intersection'
                    [scenario, ego, meta] = benchmark_scenarios.buildIntersection();
                case 'highway_merge'
                    [scenario, ego, meta] = benchmark_scenarios.buildHighwayMerge();
                case 'dense_market'
                    [scenario, ego, meta] = benchmark_scenarios.buildDenseMarket();
                case 'cattle_crossing'
                    [scenario, ego, meta] = benchmark_scenarios.buildCattleCrossing();
                otherwise
                    error('Unknown scenario: %s. Choose from: village_road, intersection, highway_merge, dense_market, cattle_crossing', scenarioName);
            end
        end
        
        %% Scenario 1: Unmarked Village Road
        function [scenario, ego, meta] = buildVillageRoad()
            scenario = drivingScenario('StopTime', 18, 'SampleTime', 0.1);
            
            % Curving narrow village road (no lane markings, 5.2m wide)
            roadCenters = [0 0 0; 40 1 0; 90 7 0; 150 10 0; 210 5 0];
            road(scenario, roadCenters, 5.2);
            
            % Ego Vehicle (1st Actor)
            ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
            egoWaypoints = [5 1.0 0; 40 2.0 0; 90 8.0 0; 150 11.0 0; 200 6.0 0];
            trajectory(ego, egoWaypoints, 10.0);
            
            % Obstacle 1: Slow tractor hauling goods ahead in ego lane
            tractor = actor(scenario, 'ClassID', 5, 'Length', 4.0, 'Width', 2.1, 'Height', 2.3);
            trWaypoints = [35 1.5 0; 75 4.5 0; 120 9.0 0; 170 10.5 0];
            trajectory(tractor, trWaypoints, 3.2); % ~11.5 km/h
            
            % Obstacle 2: Oncoming two-wheeler riding near center
            bike = actor(scenario, 'ClassID', 3, 'Length', 2.0, 'Width', 0.8, 'Height', 1.4);
            bikeWaypoints = [190 7.5 0; 130 9.8 0; 70 3.8 0; 15 0.5 0];
            trajectory(bike, bikeWaypoints, 8.5); % ~30 km/h
            
            meta.Name = 'Unmarked Village Road';
            meta.RoadWidth = 5.2;
            meta.Ego = ego;
        end
        
        %% Scenario 2: Unsignalized Urban Intersection
        function [scenario, ego, meta] = buildIntersection()
            scenario = drivingScenario('StopTime', 14, 'SampleTime', 0.1);
            
            % 4-Way Junction
            road(scenario, [-80 0 0; 80 0 0], 8.5);
            road(scenario, [0 -70 0; 0 70 0], 8.0);
            
            % Ego Vehicle Eastbound
            ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
            trajectory(ego, [-55 -2.0 0; 55 -2.0 0], 8.5);
            
            % Aggressive Auto-Rickshaw cutting across from South
            auto = vehicle(scenario, 'ClassID', 2, 'Length', 2.8, 'Width', 1.3, 'Height', 1.7);
            autoWaypoints = [0 -45 0; 0 -4 0; 15 -1.2 0; 50 -1.2 0];
            trajectory(auto, autoWaypoints, 6.2);
            
            % Turning Two-Wheeler
            scooter = actor(scenario, 'ClassID', 3, 'Length', 1.9, 'Width', 0.8, 'Height', 1.3);
            scooterWaypoints = [35 2.0 0; 5 1.5 0; -2 20 0; -2 50 0];
            trajectory(scooter, scooterWaypoints, 7.0);
            
            meta.Name = 'Unsignalized Urban Intersection';
            meta.RoadWidth = 8.5;
            meta.Ego = ego;
        end
        
        %% Scenario 3: Highway Merge with Slow Vehicles
        function [scenario, ego, meta] = buildHighwayMerge()
            scenario = drivingScenario('StopTime', 16, 'SampleTime', 0.1);
            
            % 3-Lane Highway
            road(scenario, [0 0 0; 280 0 0], 10.5);
            % On-Ramp merging at x = 110m
            rampCenters = [15 -16 0; 55 -8 0; 105 -3.5 0; 155 0 0];
            road(scenario, rampCenters, 4.2);
            
            % Ego vehicle cruising fast in left/middle lane
            ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
            trajectory(ego, [10 -3.5 0; 260 -3.5 0], 17.5); % 63 km/h
            
            % Slow 3-wheeler merging abruptly into travel lane
            slowMerger = vehicle(scenario, 'ClassID', 2, 'Length', 2.8, 'Width', 1.3, 'Height', 1.7);
            mergeWaypoints = [20 -15 0; 65 -7 0; 110 -3.5 0; 210 -3.5 0];
            trajectory(slowMerger, mergeWaypoints, 7.0); % ~25 km/h
            
            meta.Name = 'Highway Merge with Slow Vehicles';
            meta.RoadWidth = 10.5;
            meta.Ego = ego;
        end
        
        %% Scenario 4: Dense Market Area
        function [scenario, ego, meta] = buildDenseMarket()
            scenario = drivingScenario('StopTime', 20, 'SampleTime', 0.1);
            
            % Encroached market street (6.0m total width)
            road(scenario, [0 0 0; 110 0 0], 6.0);
            
            % Ego Vehicle creeping through crowd
            ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.5, 'Width', 1.8, 'Height', 1.4);
            trajectory(ego, [5 0 0; 100 0 0], 2.8);
            
            % Stationary Pushcart vendor on left
            pushcart = actor(scenario, 'ClassID', 5, 'Length', 2.0, 'Width', 1.1, 'Height', 1.3);
            trajectory(pushcart, [22 -1.8 0; 45 -1.8 0], 0.7);
            
            % Jaywalking Pedestrian 1
            ped1 = actor(scenario, 'ClassID', 6, 'Length', 0.5, 'Width', 0.5, 'Height', 1.7);
            trajectory(ped1, [28 2.4 0; 30 -2.4 0], 1.1);
            
            % Jaywalking Pedestrian 2
            ped2 = actor(scenario, 'ClassID', 6, 'Length', 0.5, 'Width', 0.5, 'Height', 1.7);
            trajectory(ped2, [52 -2.4 0; 51 2.4 0], 1.0);
            
            % Two-Wheeler filtering on right
            bike = actor(scenario, 'ClassID', 3, 'Length', 1.9, 'Width', 0.8, 'Height', 1.3);
            trajectory(bike, [8 1.6 0; 75 1.6 0], 4.2);
            
            meta.Name = 'Dense Market Mixed Traffic';
            meta.RoadWidth = 6.0;
            meta.Ego = ego;
        end
        
        %% Scenario 5: Sudden Cattle Crossing
        function [scenario, ego, meta] = buildCattleCrossing()
            scenario = drivingScenario('StopTime', 10, 'SampleTime', 0.05);
            
            % Suburban road
            road(scenario, [0 0 0; 140 0 0], 7.0);
            
            % Ego Vehicle cruising at 12 m/s (~43 km/h)
            ego = vehicle(scenario, 'ClassID', 1, 'Length', 4.7, 'Width', 1.8, 'Height', 1.4);
            trajectory(ego, [5 -1.75 0; 130 -1.75 0], 12.0);
            
            % Stray Cattle stepping onto road and freezing in lane
            cow = actor(scenario, 'ClassID', 4, 'Length', 2.2, 'Width', 0.9, 'Height', 1.5);
            cowWaypoints = [45 3.0 0; 47 0.8 0; 48 -1.5 0; 48 -1.5 0];
            cowSpeeds    = [1.3; 1.0; 0.0; 0.0];
            trajectory(cow, cowWaypoints, cowSpeeds);
            
            meta.Name = 'Sudden Cattle Crossing Event';
            meta.RoadWidth = 7.0;
            meta.Ego = ego;
        end
    end
end
