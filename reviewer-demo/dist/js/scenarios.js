// 6 Indian Benchmark Scenarios & Dynamic Hazard Injector (MathWorks SIH-26037)
class ScenarioCatalog {
  // Every visual scenario also declares the maneuver that the safety policy
  // should demonstrate.  This is deliberately separate from the renderer so
  // the behaviour can be tested without relying on text in the HUD.
  static getSafetyPolicy(scenarioId) {
    const policies = {
      cattle_crossing:     { expectedState: 'EMERGENCY_STOP', intent: 'STOP_ON_OCCUPANCY', engageDistance: 42, label: 'Stop and hold for animal intrusion' },
      bridge_hazard:       { expectedState: 'BRIDGE_STOP', intent: 'BRIDGE_HOLD', engageDistance: 42, label: 'In-lane stop: bridge walls prohibit a swerve' },
      village_road:        { expectedState: 'NUDGE', intent: 'NUDGE_ON_BLOCK', engageDistance: 34, label: 'Bounded in-lane nudge around slow tractor' },
      intersection:        { expectedState: 'INTERACTIVE_MERGE', intent: 'YIELD_ON_CONFLICT', engageDistance: 38, label: 'Yield until the predicted conflict zone is clear' },
      highway_merge:       { expectedState: 'INTERACTIVE_MERGE', intent: 'YIELD_ON_CONFLICT', engageDistance: 40, label: 'Create a time gap for the merging vehicle' },
      dense_market:        { expectedState: 'INCHING', intent: 'INCH_CROWD', engageDistance: 34, label: 'Creep through a crowd only while the stopping buffer remains' },
      motorcycle_filtering:{ expectedState: 'NUDGE', intent: 'NUDGE_ON_BLOCK', engageDistance: 32, label: 'Preserve a lateral buffer for the filtering two-wheeler' },
      pothole_avoidance:   { expectedState: 'NUDGE', intent: 'NUDGE_ON_BLOCK', engageDistance: 38, label: 'Use a smooth, bounded sub-lane avoidance path' },
      sensor_degradation:  { expectedState: 'INTERACTIVE_MERGE', intent: 'YIELD_ON_CONFLICT', engageDistance: 38, label: 'Reduce speed and yield under degraded camera confidence' },
      stalled_vehicle:     { expectedState: 'EMERGENCY_STOP', intent: 'STOP_ON_OCCUPANCY', engageDistance: 42, label: 'Queue in lane: oncoming traffic blocks overtaking' },
      construction_detour: { expectedState: 'NUDGE', intent: 'NUDGE_ON_BLOCK', engageDistance: 34, label: 'Follow the channelized safe corridor' },
      night_pedestrian:    { expectedState: 'EMERGENCY_STOP', intent: 'STOP_ON_OCCUPANCY', engageDistance: 36, label: 'Stop for vulnerable road user in the predicted corridor' },
      // Engage before the 3.5 s local-planning horizon reaches the first cow;
      // otherwise the emergency fallback correctly but unnecessarily pre-empts
      // the intended cautious-crawl demonstration.
      animal_herd:         { expectedState: 'INCHING', intent: 'INCH_CROWD', engageDistance: 45, label: 'Expanded animal buffer with cautious crawl speed' },
      speed_breaker:       { expectedState: 'CRUISE', intent: 'SPEED_GOVERNED', engageDistance: 35, label: 'Stay in lane with a 15 km/h comfort speed cap' },
      reversion_recovery:  { expectedState: 'NUDGE', intent: 'NUDGE_ON_BLOCK', engageDistance: 32, label: 'Smooth S-curve avoidance and lane-centre recovery' }
    };
    return policies[scenarioId] || policies.cattle_crossing;
  }

  static loadScenario(scenarioId, obstacleManager, egoVehicle, world) {
    obstacleManager.clear();
    
    // Default: Standard road mode and clear day weather
    world.setBridgeMode(false);
    world.setWeather('DAY');
    
    switch (scenarioId) {
      case 'cattle_crossing':
        // Scenario 5: Sudden Stray Cattle Crossing Event
        egoVehicle.setPosition(-1.85, 0, 0, 11.5);
        
        // Cow waiting on right roadside shoulder (x = -4.2m, z = 46m)
        const cow = obstacleManager.createCattle(1, -4.2, 46, 0);
        
        // Ambient incoming truck in left lane (x = +1.85m)
        obstacleManager.spawnOncomingTraffic(120);
        
        return {
          id: 'cattle_crossing',
          title: 'Scenario 5: Sudden Stray Cattle Crossing',
          desc: 'Cruising at 42 km/h in right-side lane when stray cattle suddenly steps onto the asphalt and freezes. Demonstrates radar detection, sub-20ms emergency reaction and safe clearance hold.',
          isBridge: false,
          onUpdate: (egoZ, dt) => {
            if (egoZ > 12 && !cow.isTriggered) {
              cow.isTriggered = true;
            }
          }
        };
        
      case 'bridge_hazard':
        // Scenario 6: Narrow Single-Lane Bridge (Strict In-Lane Stop)
        world.setBridgeMode(true);
        egoVehicle.setPosition(-1.85, 0, 0, 9.5);
        
        // Broken-down auto-rickshaw stopped in the middle of narrow bridge deck in right lane
        const bridgeAuto = obstacleManager.createAutoRickshaw(1, -1.85, 45, 0, 0.0);
        let bridgeClearTimer = 0;
        
        return {
          id: 'bridge_hazard',
          title: 'Scenario 6: Narrow Bridge (Strict In-Lane Stop)',
          desc: 'Narrow bridge corridor with concrete parapets on both sides. No shoulder or pull-over space. Ego vehicle MUST execute a straight in-lane stop without swerving into barriers or oncoming lane!',
          isBridge: true,
          onUpdate: (egoZ, dt) => {
            if (egoZ > 28) {
              bridgeClearTimer += (dt || 0.016);
              if (bridgeClearTimer > 3.2 && bridgeAuto.x > -4.5) {
                // Hazard is cleared / towed off travel lane, allowing safe passage!
                bridgeAuto.x -= 1.4 * (dt || 0.016);
              }
            }
          }
        };
        
      case 'village_road':
        // Scenario 1: Unmarked Village Road (Slow Tractor Overtake)
        egoVehicle.setPosition(-1.85, 0, 0, 9.5);
        
        // Slow tractor hauling goods at 2.2 m/s ahead in right lane (x = -2.25m)
        obstacleManager.createTractor(1, -2.25, 38, 2.2);
        
        // Ambient oncoming truck far ahead in left lane
        obstacleManager.spawnOncomingTraffic(260, -7.0);
        
        return {
          id: 'village_road',
          title: 'Scenario 1: Unmarked Village Road (Tractor Nudge)',
          desc: 'Narrow road with unpaved dirt shoulders. Slow agricultural tractor hauling cargo. Smooth spatiotemporal quintic polynomial nudge without slipping off shoulder or into oncoming traffic.',
          isBridge: false,
          onUpdate: () => {}
        };
        
      case 'intersection':
        // Scenario 2: Unsignalized Urban 4-Way Intersection
        egoVehicle.setPosition(-1.85, 0, 0, 8.5);
        
        // Auto-rickshaw aggressively cutting across from left cross street
        const autoCross = obstacleManager.createAutoRickshaw(1, 16.0, 36, -Math.PI / 2, 4.5);
        const pedCrossing = obstacleManager.createPedestrian(2, -0.8, 52, 0.8);
        
        return {
          id: 'intersection',
          title: 'Scenario 2: Unsignalized Urban Intersection',
          desc: 'Chaotic 4-way unsignalized junction. Auto-rickshaw aggressively cuts across path. Demonstrates gap-acceptance yielding (INTERACTIVE_MERGE) and multi-agent tracking.',
          isBridge: false,
          onUpdate: (egoZ, dt) => {
            if (egoZ > 10 && autoCross.x > -12.0) {
              autoCross.x -= 4.2 * (dt || 0.016);
            }
          }
        };
        
      case 'highway_merge':
        // Scenario 3: Highway Merge with Slow Vehicles (NH-44)
        egoVehicle.setPosition(-1.85, 0, 0, 15.0); // Fast cruise ~54 km/h
        
        // Slow 3-wheeler on right ramp merging into right lane
        const mergingAuto = obstacleManager.createAutoRickshaw(1, -3.8, 48, -0.22, 6.5);
        obstacleManager.spawnOncomingTraffic(200);
        
        return {
          id: 'highway_merge',
          title: 'Scenario 3: Highway Merge with Slow 3-Wheeler',
          desc: 'High-speed cruise on NH-44. Slow 3-wheeler merges abruptly from ramp into travel lane. Demonstrates anticipatory deceleration and smooth lane re-centering.',
          isBridge: false,
          onUpdate: (egoZ, dt) => {
            if (egoZ > 14 && mergingAuto.x < -1.85) {
              mergingAuto.x += 0.08;
            }
          }
        };
        
      case 'dense_market':
        // Scenario 4: Dense Bazaar / Market Mixed Traffic (Inching Mode)
        egoVehicle.setPosition(-1.85, 0, 0, 7.5);
        
        // Vegetable pushcart vendor along right shoulder
        obstacleManager.createPushcart(1, -2.8, 28, 0.4);
        
        // Jaywalking pedestrians in crowd cluster
        obstacleManager.createPedestrian(2, -1.3, 32, 0.7);
        obstacleManager.createPedestrian(3, -0.6, 38, -0.6);
        obstacleManager.createPedestrian(4, -2.2, 44, 0.5);
        
        return {
          id: 'dense_market',
          title: 'Scenario 4: Dense Market Bazaar (Crowd Inching)',
          desc: 'Crowded bazaar with pushcart vendor and jaywalking pedestrians. Activates Inching Mode (Creep at 2 m/s) preventing the Freezing Robot Problem.',
          isBridge: false,
          onUpdate: () => {}
        };
        
      case 'motorcycle_filtering':
        // Scenario 7: Two-Wheeler / Motorcycle Filtering & Lane Splitting
        egoVehicle.setPosition(-1.85, 0, 0, 10.5);
        const bike = obstacleManager.createTwoWheeler(1, -0.9, 32, 0.05, 5.0);
        obstacleManager.spawnOncomingTraffic(180, -7.5);
        return {
          id: 'motorcycle_filtering',
          title: 'Scenario 7: Motorcycle Filtering & Gap Splitting',
          desc: 'Fast motorcycle filtering down the center divider line. Tests asymmetric lateral potential field and safe corridor preservation.',
          isBridge: false,
          onUpdate: (egoZ, dt) => {
            if (egoZ > 12 && bike.x < -0.4) bike.x += 0.3 * (dt || 0.016);
          }
        };

      case 'pothole_avoidance':
        // Scenario 8: Severe Road Crater / Pothole Avoidance
        egoVehicle.setPosition(-1.85, 0, 0, 10.0);
        obstacleManager.createPothole(1, -1.85, 42, 0.95);
        obstacleManager.spawnOncomingTraffic(240, -7.0);
        return {
          id: 'pothole_avoidance',
          title: 'Scenario 8: Severe Road Crater (Pothole Avoidance)',
          desc: 'Large unpaved crater in right travel lane wheel track. Generates smooth sub-lateral avoidance within legal lane bounds without crossing into oncoming lane.',
          isBridge: false,
          onUpdate: () => {}
        };

      case 'sensor_degradation':
        // Scenario 9: Monsoon Rain & Sensor Degradation Mode
        world.setWeather('RAIN');
        egoVehicle.setPosition(-1.85, 0, 0, 8.5);
        obstacleManager.createAutoRickshaw(1, -1.85, 42, 0, 2.5);
        obstacleManager.spawnOncomingTraffic(140, -6.5);
        return {
          id: 'sensor_degradation',
          title: 'Scenario 9: Monsoon Rain & Sensor Degradation',
          desc: 'Heavy monsoon downpour reduces camera confidence. Kalman filter dynamically reweights towards 77 GHz Doppler radar and LiDAR lock.',
          isBridge: false,
          onUpdate: () => {}
        };

      case 'stalled_vehicle':
        // Scenario 10: Stalled Disabled Vehicle with Heavy Oncoming Traffic
        egoVehicle.setPosition(-1.85, 0, 0, 11.0);
        obstacleManager.createStalledVehicle(1, -1.85, 46);
        obstacleManager.spawnOncomingTraffic(75, -8.0);
        obstacleManager.spawnOncomingTraffic(140, -8.0);
        return {
          id: 'stalled_vehicle',
          title: 'Scenario 10: Stalled Vehicle (Oncoming Priority Yield)',
          desc: 'Disabled vehicle blocking right lane while continuous oncoming heavy trucks occupy left lane. Autonomous system holds safe in-lane queue without gambling into oncoming traffic.',
          isBridge: false,
          onUpdate: () => {}
        };

      case 'construction_detour':
        // Scenario 11: Construction Zone Barricade Detour
        egoVehicle.setPosition(-1.85, 0, 0, 9.0);
        obstacleManager.createConstructionBarricade(1, -2.5, 34);
        obstacleManager.createConstructionBarricade(2, -2.1, 46);
        obstacleManager.spawnOncomingTraffic(260, -7.0);
        return {
          id: 'construction_detour',
          title: 'Scenario 11: Construction Zone Channelizer Detour',
          desc: 'Temporary roadwork barricades closing right shoulder and lane margin. Generates smooth quintic polynomial detour path around channelizers.',
          isBridge: false,
          onUpdate: () => {}
        };

      case 'night_pedestrian':
        // Scenario 12: Unlit Night Pedestrian Crossing
        world.setWeather('NIGHT');
        egoVehicle.setPosition(-1.85, 0, 0, 9.5);
        const nightPed = obstacleManager.createPedestrian(1, -3.8, 38, 0.9);
        return {
          id: 'night_pedestrian',
          title: 'Scenario 12: Unlit Night Pedestrian Crossing',
          desc: 'Zero ambient road lighting. Dual projector headlights cast beam forward while active LiDAR/radar detects dark unreflective pedestrian stepping into path.',
          isBridge: false,
          onUpdate: (egoZ, dt) => {
            if (egoZ > 8 && nightPed.x < -1.0) nightPed.x += 1.1 * (dt || 0.016);
          }
        };

      case 'animal_herd':
        // Scenario 13: Stray Cattle Herd Grazing on Shoulder
        egoVehicle.setPosition(-1.85, 0, 0, 10.0);
        obstacleManager.createCattle(1, -3.4, 40, 0);
        obstacleManager.createCattle(2, -3.8, 48, -0.4);
        obstacleManager.createCattle(3, -2.9, 56, 0.2);
        obstacleManager.spawnOncomingTraffic(190, -7.0);
        return {
          id: 'animal_herd',
          title: 'Scenario 13: Stray Livestock Cluster on Shoulder',
          desc: 'Multiple cattle clustered along the unpaved road shoulder. System automatically expands lateral safety buffer and enforces cautionary deceleration.',
          isBridge: false,
          onUpdate: () => {}
        };

      case 'speed_breaker':
        // Scenario 14: Unmarked Elevated Speed Breaker
        egoVehicle.setPosition(-1.85, 0, 0, 11.5);
        obstacleManager.createSpeedBreaker(1, -1.85, 45);
        return {
          id: 'speed_breaker',
          title: 'Scenario 14: Unmarked Speed Breaker / Bump',
          desc: 'Elevated asphalt bump across travel lane. Anticipatory visual detection commands smooth deceleration to 15 km/h, minimizing vertical RMS jerk.',
          isBridge: false,
          onUpdate: () => {}
        };

      case 'reversion_recovery':
        // Scenario 15: Multi-Obstacle S-Curve Reversion & Lane Recovery
        egoVehicle.setPosition(-1.85, 0, 0, 10.0);
        obstacleManager.createPushcart(1, -2.6, 32, 0.3);
        obstacleManager.createAutoRickshaw(2, -0.4, 60, 0, 0.0);
        obstacleManager.spawnOncomingTraffic(280, -7.5);
        return {
          id: 'reversion_recovery',
          title: 'Scenario 15: Multi-Obstacle S-Curve Reversion',
          desc: 'Successive avoidance of roadside pushcart followed by stopped auto-rickshaw, ending in smooth asymptotic recovery to lane center (-1.85m).',
          isBridge: false,
          onUpdate: () => {}
        };
        
      default:
        return this.loadScenario('cattle_crossing', obstacleManager, egoVehicle, world);
    }
  }
  
  static spawnCustomObstacle(type, distAhead, obstacleManager, egoVehicle) {
    const targetZ = egoVehicle.z + distAhead;
    const targetX = -1.85; // directly in the right-side travel lane
    
    switch (type) {
      case 'cattle':
        const cow = obstacleManager.createCattle(Date.now(), targetX - 1.5, targetZ, 0);
        cow.isTriggered = true;
        break;
      case 'autorickshaw':
        obstacleManager.createAutoRickshaw(Date.now(), targetX, targetZ, 0, 3.0);
        break;
      case 'tractor':
        obstacleManager.createTractor(Date.now(), targetX, targetZ, 3.0);
        break;
      case 'pushcart':
        obstacleManager.createPushcart(Date.now(), targetX - 0.8, targetZ, 0.5);
        break;
      case 'pedestrian':
        obstacleManager.createPedestrian(Date.now(), targetX + 0.8, targetZ, 0.8);
        break;
      case 'two_wheeler':
        obstacleManager.createTwoWheeler(Date.now(), targetX, targetZ, 0, 5.0);
        break;
      case 'pothole':
        obstacleManager.createPothole(Date.now(), targetX, targetZ, 0.9);
        break;
      case 'construction':
        obstacleManager.createConstructionBarricade(Date.now(), targetX, targetZ);
        break;
      case 'speed_breaker':
        obstacleManager.createSpeedBreaker(Date.now(), targetX, targetZ);
        break;
      case 'stalled_vehicle':
        obstacleManager.createStalledVehicle(Date.now(), targetX, targetZ);
        break;
    }
    console.log('[SPAWN] Injected obstacle ' + type + ' at z = ' + targetZ.toFixed(1) + 'm');
  }
}

window.ScenarioCatalog = ScenarioCatalog;
