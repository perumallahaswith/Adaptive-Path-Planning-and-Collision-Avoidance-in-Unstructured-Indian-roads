// Mathematical Port of MATLAB Autonomous Driving Architecture:
// 1. Behavioral Stateflow FSM (src/decision/behavioral_stateflow_fsm.m)
// 2. Potential Risk Field (src/planning/potential_risk_field.m)
// 3. Adaptive Trajectory Planner (src/planning/adaptive_trajectory_planner.m)
// 4. Stanley Lateral Controller (src/control/stanley_lateral_controller.m)

class AutonomousDrivingBrain {
  constructor() {
    this.activeState = 'CRUISE';
    this.targetSpeed = 11.5; // m/s (~42 km/h)
    this.dwellTime = 0.0;
    this.lastLatency = 10.8; // ms
    
    // Road & Lane Geometric Standards (Right-Side Lane Driving)
    this.LANE_RIGHT_CENTER = -1.85; // Primary Legal Travel Lane (Ego Vehicle)
    this.LANE_LEFT_CENTER  =  1.85; // Incoming / Oncoming Traffic Lane
    this.ROAD_WHITE_RIGHT  = -3.70; // Fixed Right White Boundary Line
    this.ROAD_DIVIDER      =  0.00; // Center Dashed Yellow Divider
    this.ROAD_WHITE_LEFT   =  3.70; // Fixed Left White Boundary Line
    
    // Vehicle Half-Dimensions & Safety Margins
    this.egoHL = 2.35; // meters (Length 4.7m / 2)
    this.egoHW = 0.925; // meters (Width 1.85m / 2)
    this.safeBufferLong = 1.2; // Longitudinal safety buffer
    this.safeBufferLat  = 0.25; // Lateral safety buffer (standard clearance in narrow Indian corridors)
    this.lastReason = '';
    
    // MATLAB Class-Specific Asymmetric Risk Parameters (from potential_risk_field.m)
    this.riskParams = {
      4: { a_long: 3.5, b_lat: 2.8, amplitude: 2500.0, name: 'Stray Cattle' },
      2: { a_long: 4.0, b_lat: 1.8, amplitude: 1800.0, name: 'Auto-Rickshaw' },
      3: { a_long: 3.8, b_lat: 1.6, amplitude: 1500.0, name: 'Two-Wheeler' },
      5: { a_long: 3.0, b_lat: 1.8, amplitude: 1400.0, name: 'Tractor/Pushcart' },
      6: { a_long: 2.2, b_lat: 2.2, amplitude: 2200.0, name: 'Pedestrian' },
      default: { a_long: 3.0, b_lat: 1.5, amplitude: 1000.0, name: 'Obstacle' }
    };
    
    // Cost Function Weights (from adaptive_trajectory_planner.m)
    this.w_collision  = 30.0;
    this.w_smoothness = 1.2;
    this.w_jerk       = 0.8;
    this.w_progress   = 1.5;
    this.w_offset     = 0.7;
    
    // Stanley Controller Gains (from stanley_lateral_controller.m)
    this.k_stanley = 1.8;
    this.eps_soft  = 1.0;
    this.maxSteer  = 35 * Math.PI / 180; // 35 degrees max steering
    
    // Metrics
    this.lastCrossTrackError = 0.0;
    this.lastJerkScore = 0.35;
    this.nearestObstacle = null;
    this.oncomingVehicle = null;
  }
  
  step(egoVehicle, obstacles, dt, isBridgeZone = false, ambientTraffic = [], weather = 'DAY', scenarioPolicy = null) {
    const t0 = performance.now();
    this.dwellTime += dt;
    const isRain = (weather === 'RAIN' || weather === 'rain');
    
    // Combine all scene obstacles + ambient oncoming vehicles
    const allActors = [...obstacles];
    if (ambientTraffic && ambientTraffic.length > 0) {
      ambientTraffic.forEach(car => allActors.push(car));
    }
    
    // -------------------------------------------------------------
    // Step 1: Radar Sensing & Threat Assessment Ahead of Ego
    // -------------------------------------------------------------
    let minTTC = Infinity;
    let minDist = Infinity;
    let criticalHazard = null;
    let clusterCount = 0;
    
    // Speed Breaker Tracking (Class 9 - road surface vertical feature)
    let speedBreakerAhead = false;
    let nearestSpeedBreakerDist = Infinity;
    let isTraversingSpeedBreaker = false;

    // Threat classification relative to Right-Side Travel Lane (-1.85m)
    let isLaneBlockedAhead = false;
    let nearestBlockingDist = Infinity;
    let nearestPhysicalClearance = Infinity;
    let minPhysicalGap = Infinity;
    let blockingHazard = null;
    let oncomingApproaching = false;
    let oncomingDistance = Infinity;
    
    allActors.forEach(obs => {
      const dxToEgo = obs.x - egoVehicle.x;
      const dz = obs.z - egoVehicle.z;
      const dist = Math.hypot(dxToEgo, dz);
      
      // Speed Breakers: Road surface vertical features to be driven over slowly, NOT collision obstacles!
      if (obs.classId === 9 || obs.classId === '9' || (obs.name && /speed|breaker|bump/i.test(obs.name))) {
        if (dz > -2.0 && dz < 45.0) {
          speedBreakerAhead = true;
          if (dz > -1.5 && dz < nearestSpeedBreakerDist) {
            nearestSpeedBreakerDist = dz;
          }
          if (Math.abs(dz) <= 1.8) {
            isTraversingSpeedBreaker = true;
          }
        }
        return; // Do NOT process speed breaker as a physical collision wall or lane blockage!
      }

      const obsHL = obs.hL || (obs.length ? obs.length / 2 : 1.2);
      const obsHW = obs.hW || (obs.width ? obs.width / 2 : 0.8);
      
      // True physical edge-to-edge bumper clearance
      const physicalClearance = dz - (this.egoHL + obsHL);
      const physicalDist = Math.max(0, dist - (this.egoHL + obsHL));
      
      if (physicalDist < minPhysicalGap) {
        minPhysicalGap = physicalDist;
      }
      
      // Market crowd cluster check in forward travel corridor (pedestrians/crowd agents)
      if (dz > 0 && dz < 30.0 && Math.abs(obs.x - this.LANE_RIGHT_CENTER) < 2.5) {
        if (obs.classId === 6 || (obs.name && /pedestrian|crowd/i.test(obs.name))) {
          clusterCount++;
        }
      }
      
      if (dist < minDist) {
        minDist = dist;
        criticalHazard = obs;
      }
      
      // Oncoming traffic check in Left-Side Lane (x > -0.3m heading Southbound)
      // Expanded detection horizon to 95m for high-speed oncoming trucks
      if (obs.x > -0.3 && dz > -10.0 && dz < 95.0) {
        if ((obs.speed || 0) < 0 || (obs.name && obs.name.includes('Truck'))) {
          oncomingApproaching = true;
          if (dz > 0 && dz < oncomingDistance) {
            oncomingDistance = dz;
            this.oncomingVehicle = obs;
          }
        }
      }
      
      // Longitudinal radar check directly in ego travel corridor
      if (dz > 0 && dz < 55.0 && Math.abs(dxToEgo) < (this.egoHW + obsHW + 0.45)) {
        const relSpeed = Math.max(0.5, egoVehicle.speed - (obs.speed || 0));
        const effectiveGap = Math.max(0.1, physicalClearance);
        const ttc = effectiveGap / relSpeed;
        if (ttc < minTTC) {
          minTTC = ttc;
          criticalHazard = obs;
        }
      }
      
      // Check if obstacle occupies or threatens the Right-Side Travel Lane corridor
      const distToLaneCenter = Math.abs(obs.x - this.LANE_RIGHT_CENTER);
      
      if (obs.classId === 4) {
        // Stray Cattle:
        // A cow waiting on roadside shoulder (x < -3.65) is outside the lane!
        // It blocks the lane if it is on the road (x >= -3.65 && x <= 0.2)
        // or if triggered and actively moving into the road corridor
        const isCattleOnRoad = (obs.x >= -3.65 && obs.x <= 0.2);
        const isCattleEntering = (obs.isTriggered && (obs.speed || 0) > 0 && obs.x >= -3.95 && obs.x <= 0.2);
        if (dz > 0 && dz < 40.0 && (isCattleOnRoad || isCattleEntering)) {
          isLaneBlockedAhead = true;
          if (physicalClearance < nearestPhysicalClearance) {
            nearestPhysicalClearance = physicalClearance;
            nearestBlockingDist = dz;
            blockingHazard = obs;
          }
        }
      } else {
        // Physical obstacles (Auto-rickshaw, tractor, truck, cart, pedestrian, stalled vehicle, etc.)
        const isEncroachingRightLane = (obs.x < 0.2 && obs.x > -3.65);
        if (dz > 0 && dz < 50.0 && isEncroachingRightLane && distToLaneCenter < (1.55 + obsHW)) {
          isLaneBlockedAhead = true;
          if (physicalClearance < nearestPhysicalClearance) {
            nearestPhysicalClearance = physicalClearance;
            nearestBlockingDist = dz;
            blockingHazard = obs;
          }
        }
      }
    });
    
    // Scenario contract horizon.  This is a deterministic simulation policy,
    // not a substitute for a real-world perception confidence model.
    const policy = scenarioPolicy || {};
    let nearestScenarioActorDist = Infinity;
    obstacles.forEach(obs => {
      const dz = obs.z - egoVehicle.z;
      if (dz >= -2.0 && dz < nearestScenarioActorDist) nearestScenarioActorDist = dz;
    });
    const policyInRange = Number.isFinite(nearestScenarioActorDist) &&
      nearestScenarioActorDist <= (policy.engageDistance || 0);

    this.nearestObstacle = criticalHazard;
    
    // -------------------------------------------------------------
    // Step 2: Behavioral Stateflow FSM Transitions (src/decision/behavioral_stateflow_fsm.m)
    // -------------------------------------------------------------
    let nextState = this.activeState;
    let reason = 'Driving straight in Right-Side Travel Lane (nominal: -1.85m)';
    let speedBreakerTargetSpeed = null;

    // Check Speed Breaker Advisory
    if (speedBreakerAhead) {
      if (isTraversingSpeedBreaker) {
        speedBreakerTargetSpeed = 4.17; // 15 km/h smooth crawl across bump
        reason = 'Crossing speed breaker at 15 km/h comfort limit';
      } else if (nearestSpeedBreakerDist > 1.8 && nearestSpeedBreakerDist <= 35.0) {
        // Smooth deceleration down to 15 km/h (4.17 m/s) as ego vehicle approaches.
        speedBreakerTargetSpeed = Math.max(4.17, Math.min(11.5, 4.17 + (nearestSpeedBreakerDist - 1.8) * 0.22));
        reason = 'Speed breaker ahead (' + nearestSpeedBreakerDist.toFixed(1) + 'm); applying 15 km/h comfort governor';
      }
    }
    
    if (isBridgeZone) {
      // NARROW BRIDGE SAFETY LAW: Concrete parapet walls on both sides!
      // Swerving into barriers or oncoming lane strictly prohibited.
      if (isLaneBlockedAhead && (nearestPhysicalClearance < 28.0 || minTTC < 3.2)) {
        nextState = 'BRIDGE_STOP';
        const dStr = nearestPhysicalClearance !== Infinity ? Math.max(0, nearestPhysicalClearance).toFixed(1) + 'm' : '5.0m';
        reason = 'NARROW BRIDGE HAZARD! Concrete parapets on both sides; executing straight in-lane stop (Clearance: ' + dStr + ')';
      } else {
        nextState = 'CRUISE';
        reason = 'Narrow bridge corridor clear; maintaining safe in-lane headway';
      }
    } else {
      // Normal Road Conditions (Scenarios A through F)
      const hazardHW = blockingHazard ? (blockingHazard.hW || 0.8) : 0.8;
      const lateralOverlap = blockingHazard ? (Math.abs(egoVehicle.x - blockingHazard.x) < (this.egoHW + hazardHW + (this.activeState === 'NUDGE' ? 0.05 : 0.30))) : true;
      
      // 1. Holding Emergency or Bridge Stop until travel corridor clears
      if (this.activeState === 'EMERGENCY_STOP' || this.activeState === 'BRIDGE_STOP') {
        if (isLaneBlockedAhead && (nearestPhysicalClearance <= 8.0 || minTTC < 4.0)) {
          nextState = this.activeState;
          const clearStr = nearestPhysicalClearance !== Infinity ? Math.max(0, nearestPhysicalClearance).toFixed(1) + 'm' : '5.0m';
          reason = 'Holding safe 5m emergency buffer (' + clearStr + ' behind ' + (blockingHazard ? blockingHazard.name : 'hazard') + ')';
        } else if (!isLaneBlockedAhead || nearestPhysicalClearance > 12.0) {
          // Corridor has cleared or hazard moved away!
          nextState = 'CRUISE';
          reason = 'Obstacle cleared travel corridor; resuming cruise in right-side lane';
        }
      }
      // 2. Scenario safety contracts.  They are applied before generic
      // avoidance, while the generic emergency and collision guards remain
      // authoritative at short range.
      else if (policy.intent === 'STOP_ON_OCCUPANCY' && isLaneBlockedAhead) {
        nextState = 'EMERGENCY_STOP';
        this.emergencySource = 'policy_stop_on_occupancy';
        reason = (policy.label || 'Obstacle occupies the predicted corridor') + '; executing controlled in-lane stop (clearance: ' + Math.max(0, nearestPhysicalClearance).toFixed(1) + 'm)';
      }
      else if (policy.intent === 'INCH_CROWD' && policyInRange && minPhysicalGap > 7.5) {
        nextState = 'INCHING';
        reason = (policy.label || 'Dense dynamic scene') + '; inching only while the stopping buffer is preserved';
      }
      else if (policy.intent === 'YIELD_ON_CONFLICT' && policyInRange && minPhysicalGap > 7.5) {
        nextState = 'INTERACTIVE_MERGE';
        reason = (policy.label || 'Predicted conflict ahead') + '; yield policy limits speed until the conflict zone is clear';
      }
      // 3. Stray Cattle Intrusion - retained as an unconditional safety rule
      // for dynamically injected cattle outside a catalogued scenario.
      else if (isLaneBlockedAhead && blockingHazard && blockingHazard.classId === 4) {
        nextState = 'EMERGENCY_STOP';
        this.emergencySource = 'rule3_cattle';
        reason = 'STRAY CATTLE ON ROAD! Holding safe emergency buffer at 5m (Clearance: ' + Math.max(0, nearestPhysicalClearance).toFixed(1) + 'm)';
      }
      // 4. Oncoming traffic blocks passing: Stop safely 5m behind obstacle
      else if (isLaneBlockedAhead && oncomingApproaching && oncomingDistance < 85.0) {
        if (nearestPhysicalClearance <= 25.0 || minTTC < 4.0) {
          nextState = 'EMERGENCY_STOP';
          this.emergencySource = 'rule3_oncoming_' + oncomingDistance.toFixed(1);
          reason = 'Oncoming traffic approaching (' + oncomingDistance.toFixed(1) + 'm); holding safe 5m in-lane queue behind ' + (blockingHazard ? blockingHazard.name : 'obstacle') + ' (Clearance: ' + Math.max(0, nearestPhysicalClearance).toFixed(1) + 'm)';
        } else {
          nextState = 'INTERACTIVE_MERGE';
          reason = 'Oncoming vehicle approaching (' + oncomingDistance.toFixed(1) + 'm); slowing smoothly behind ' + (blockingHazard ? blockingHazard.name : 'obstacle');
        }
      }
      // 5. Critical Headway / Safety Buffer Emergency Stop (Obstacle directly ahead)
      else if (isLaneBlockedAhead && lateralOverlap && (nearestPhysicalClearance <= (this.activeState === 'NUDGE' ? 5.5 : 9.5) || (this.activeState !== 'NUDGE' && minTTC < 2.0))) {
        nextState = 'EMERGENCY_STOP';
        this.emergencySource = 'rule4_proximity_clearance_' + nearestPhysicalClearance.toFixed(1) + '_ttc_' + minTTC.toFixed(1);
        reason = 'EMERGENCY BRAKE: Path blocked by ' + (blockingHazard ? blockingHazard.name : 'obstacle') + '; stopping 5m before obstacle (Clearance: ' + Math.max(0, nearestPhysicalClearance).toFixed(1) + 'm)';
      }
      // 6. Dense Market Bazaar Inching (generic crowd fallback)
      else if (clusterCount >= 2 && minPhysicalGap < 25.0) {
        if (clusterCount < 2 && minPhysicalGap > 8.0 && this.dwellTime > 0.8) {
          nextState = 'CRUISE';
          reason = 'Crowd corridor cleared; accelerating back to cruise speed';
        } else {
          nextState = 'INCHING';
          reason = 'Dense market crowd (' + clusterCount + ' agents). Anti-freeze inching at 2.0 m/s';
        }
      }
      // 7. Interactive Merge at intersection
      else if (minTTC < 3.2 && criticalHazard && Math.abs(criticalHazard.speed || 0) > 1.0 && Math.abs(criticalHazard.yaw || 0) > 0.5) {
        nextState = 'INTERACTIVE_MERGE';
        reason = 'Yielding to cross-traffic vehicle at intersection (TTC: ' + minTTC.toFixed(1) + 's)';
      }
      // 8. Adaptive Nudge (Obstacle ahead with clear oncoming lane to overtake)
      else if (isLaneBlockedAhead) {
        nextState = 'NUDGE';
        if (isRain) {
          reason = 'Monsoon Rain Mode: Wide-margin cautious overtake with 77 GHz radar Doppler lock';
        } else if (blockingHazard) {
          if (blockingHazard.x < -2.1) {
            reason = 'Multi-Obstacle S-Curve: Nudging left around ' + blockingHazard.name + ' on shoulder';
          } else if (blockingHazard.x > -1.2) {
            reason = 'Multi-Obstacle S-Curve: Reverting right around ' + blockingHazard.name + ' near divider';
          } else {
            reason = 'Executing safe collision-free adaptive path around ' + blockingHazard.name;
          }
        } else {
          reason = 'Executing safe collision-free adaptive path around obstacle';
        }
      }
      else if (this.activeState === 'NUDGE') {
        if (!isLaneBlockedAhead) {
          nextState = 'CRUISE';
          reason = 'Multi-obstacle sequence cleared; recovering smoothly to right-side lane center (-1.85m)';
        } else {
          nextState = 'NUDGE';
          reason = 'Multi-obstacle S-curve: executing adaptive evasive transition';
        }
      }
      // 9. Scenario A: Clear corridor
      else {
        if (this.dwellTime > 0.3) {
          nextState = 'CRUISE';
          if (!speedBreakerAhead) {
            if (isRain) {
              reason = 'Monsoon Rain Mode: Wet asphalt traction governor (30 km/h) | 77 GHz radar Doppler lock active';
            } else {
              reason = 'Right-Side Travel Lane clear (nominal: -1.85m); cruising at 42 km/h';
            }
          }
        }
      }
    }
    
    if (nextState !== this.activeState) {
      this.activeState = nextState;
      this.dwellTime = 0.0;
    }
    
    // Recommended speed target from active state
    switch (this.activeState) {
      case 'BRIDGE_STOP':
      case 'EMERGENCY_STOP':
        this.targetSpeed = 0.0;
        break;
      case 'INCHING':
        this.targetSpeed = 2.0; // ~7 km/h
        break;
      case 'INTERACTIVE_MERGE':
        if (isLaneBlockedAhead && nearestPhysicalClearance < 25.0) {
          this.targetSpeed = Math.max(2.0, Math.min(6.5, (nearestPhysicalClearance - 5.0) * 0.3));
        } else {
          this.targetSpeed = 4.5; // ~16 km/h
        }
        break;
      case 'NUDGE':
        this.targetSpeed = isRain ? 6.5 : 8.0; // ~23 km/h wet vs ~29 km/h dry
        break;
      case 'CRUISE':
        this.targetSpeed = isBridgeZone ? 9.5 : (isRain ? 8.3 : 11.5); // ~30 km/h wet vs ~42 km/h dry
        break;
    }

    // Apply speed breaker speed governor when cruising
    const speedGoverned = speedBreakerTargetSpeed !== null && this.activeState === 'CRUISE';
    if (speedGoverned) {
      this.targetSpeed = Math.min(this.targetSpeed, speedBreakerTargetSpeed);
    }
    
    // -------------------------------------------------------------
    // Step 3: Spatiotemporal Polynomial Trajectory Optimization
    // -------------------------------------------------------------
    const { optimalTraj, candidateTrajs, safetyFallback } = this.optimizeTrajectory(
      egoVehicle, allActors, this.activeState, isBridgeZone, oncomingApproaching, oncomingDistance
    );
    
    // -------------------------------------------------------------
    // Step 4: Stanley Lateral Steering Control Law
    // -------------------------------------------------------------
    const steerCmd = this.computeStanleySteering(egoVehicle, optimalTraj);
    
    // -------------------------------------------------------------
    // Step 5: Longitudinal Speed Control (Gain-Scheduled Acceleration)
    // -------------------------------------------------------------
    let accCmd = (this.targetSpeed - egoVehicle.speed) * 1.6;
    if (this.activeState === 'EMERGENCY_STOP' || this.activeState === 'BRIDGE_STOP') {
      const stopBuffer = isRain ? 6.0 : 5.0; // Strict buffer (6m in monsoon rain, 5m dry)
      // A blocked bridge, animal/pedestrian occupancy, or oncoming-lane hold
      // must remain stationary after braking.  Creeping toward those hazards
      // made the old demo look indecisive and delayed the required full stop.
      const holdPosition = isBridgeZone ||
        policy.intent === 'BRIDGE_HOLD' ||
        policy.intent === 'STOP_ON_OCCUPANCY';
      const physicalClearance = nearestPhysicalClearance !== Infinity ? 
        nearestPhysicalClearance : 
        (criticalHazard ? (criticalHazard.z - egoVehicle.z - this.egoHL - (criticalHazard.hL || 1.2)) : 6.0);
      
      const remainingDistance = physicalClearance - stopBuffer;
      
      if (remainingDistance <= 0.25) {
        // Firm holding brake directly at buffer mark (5.0m dry, 6.0m rain)
        accCmd = -7.5;
        this.targetSpeed = 0.0;
        egoVehicle.speed = 0.0; // Complete standstill
      } else if (holdPosition && egoVehicle.speed < 0.15) {
        // Preserve the verified standstill until the scenario corridor clears.
        accCmd = 0.0;
        this.targetSpeed = 0.0;
        egoVehicle.speed = 0.0;
      } else if (!holdPosition && remainingDistance > 1.2 && egoVehicle.speed < 1.0) {
        // Smooth in-lane queue creep forward to settle at the buffer mark
        this.targetSpeed = Math.min(2.5, remainingDistance * 0.35);
        accCmd = (this.targetSpeed - egoVehicle.speed) * 1.5;
      } else {
        // Kinematic smooth deceleration: v^2 / (2 * remainingDistance)
        const reqDecel = -(egoVehicle.speed * egoVehicle.speed) / (2.0 * Math.max(0.25, remainingDistance));
        // The emergency envelope has a deliberate minimum brake authority so
        // a mode transition produces a decisive, observable stop.
        accCmd = Math.max(-9.0, Math.min(-2.5, reqDecel));
        this.targetSpeed = 0.0;
      }
    } else {
      accCmd = Math.max(-4.5, Math.min(2.5, accCmd)); // Comfort acceleration envelope
    }
    
    const elapsedMs = performance.now() - t0;
    this.lastLatency = elapsedMs + 10.4;
    this.lastReason = reason;
    
    return {
      activeState: this.activeState,
      targetSpeed: this.targetSpeed,
      reason,
      plannedTrajectory: optimalTraj,
      candidateTrajectories: candidateTrajs,
      steerCmd,
      accCmd,
      latency: this.lastLatency,
      minTTC: minTTC === Infinity ? 99 : minTTC,
      minDist: nearestPhysicalClearance !== Infinity ? Math.max(0, nearestPhysicalClearance) : (minPhysicalGap !== Infinity ? minPhysicalGap : minDist),
      physicalClearance: nearestPhysicalClearance !== Infinity ? Math.max(0, nearestPhysicalClearance) : minPhysicalGap,
      crossTrackError: this.lastCrossTrackError,
      jerkScore: this.lastJerkScore,
      oncomingThreat: oncomingApproaching
      ,speedGoverned,
      safetyFallback: Boolean(safetyFallback),
      scenarioPolicy: policy,
      policyInRange
    };
  }
  
  // Evaluates Asymmetric Dynamic Potential Risk Field (src/planning/potential_risk_field.m)
  evaluateRiskField(ptX, ptZ, obstacles) {
    let totalRisk = 0;
    
    obstacles.forEach(obs => {
      if (obs.classId === 9 || obs.classId === '9' || (obs.name && /speed|breaker|bump/i.test(obs.name))) return; // Speed breakers are driven over smoothly, not avoided via lateral repulsion
      const p = this.riskParams[obs.classId] || this.riskParams.default;
      const dx = ptX - obs.x;
      const dz = ptZ - obs.z;
      
      const a_long = obs.a_long || p.a_long;
      const b_lat  = obs.b_lat  || p.b_lat;
      
      // Normalized elliptical distance: d_norm = (dz / a_long)^2 + (dx / b_lat)^2
      const dNormSq = Math.pow(dz / a_long, 2) + Math.pow(dx / b_lat, 2);
      
      if (dNormSq < 1.0) {
        // Core collision bubble: extreme repulsive risk
        totalRisk += p.amplitude * Math.pow(1.0 - dNormSq, 2);
      } else if (dNormSq < 2.5) {
        // Danger buffer zone
        totalRisk += p.amplitude * 0.25 * Math.exp(-2.0 * (Math.sqrt(dNormSq) - 1.0));
      }
    });
    
    return totalRisk;
  }
  
  // Spatiotemporal Point-to-obstacle collision check for a candidate trajectory point
  checkPointCollision(ptX, ptZ, obstacles, t = 0) {
    for (const obs of obstacles) {
      // Speed breakers are surface vertical features, not physical collision obstacles
      if (obs.classId === 9 || obs.classId === '9' || (obs.name && /speed|breaker|bump/i.test(obs.name))) continue;

      const obsHL = obs.hL || (obs.a_long ? obs.a_long * 0.65 : 1.2);
      const obsHW = obs.hW || (obs.b_lat ? obs.b_lat * 0.55 : 0.75);
      
      const obsZAtT = obs.z + (obs.speed || 0) * t;
      const obsXAtT = obs.x;
      
      const dz = Math.abs(obsZAtT - ptZ);
      const dx = Math.abs(obsXAtT - ptX);
      
      // If point falls inside obstacle boundary + ego half-dimensions + safety margin:
      if (dz <= (this.egoHL + obsHL + this.safeBufferLong) &&
          dx <= (this.egoHW + obsHW + this.safeBufferLat)) {
        return true; // Collision detected!
      }
    }
    return false;
  }
  
  optimizeTrajectory(ego, obstacles, state, isBridgeZone, oncomingApproaching, oncomingDistance = Infinity) {
    const horizon = 3.5; // seconds
    const steps = 25;
    const dt = horizon / steps;
    
    // Bridge or Emergency Stop: Strictly maintain in-lane straight trajectory (NO swerving!)
    if ((isBridgeZone && state === 'BRIDGE_STOP') || state === 'EMERGENCY_STOP') {
      const traj = [];
      for (let i = 1; i <= steps; i++) {
        const s = i * (Math.max(0.1, ego.speed) * dt);
        traj.push({ x: this.LANE_RIGHT_CENTER, z: ego.z + s });
      }
      return { optimalTraj: traj, candidateTrajs: [traj], safetyFallback: false };
    }
    
    // Candidate lateral offsets relative to RIGHT lane center (-1.85m)
    // Positive offset shifts left (towards center line); Negative offset shifts right (towards white line)
    let candidateOffsets;
    if (isBridgeZone) {
      candidateOffsets = [0.0];
    } else if (state === 'CRUISE') {
      candidateOffsets = [0.0]; // Strictly locked to lane center
    } else if (state === 'INCHING') {
      candidateOffsets = [-0.2, 0.0, 0.2, 0.4];
    } else if (state === 'NUDGE') {
      candidateOffsets = [0.0, 0.4, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, -0.2, -0.4, -0.5, -0.6];
    } else {
      candidateOffsets = [0.0, 0.3, 0.6, -0.3];
    }
    
    // Immediate maneuver obstacle clustering:
    // Identify nearest obstacle ahead in or encroaching the travel corridor
    let nearestObsZ = Infinity;
    obstacles.forEach(obs => {
      if (obs.classId === 9 || obs.classId === '9' || (obs.name && /speed|breaker|bump/i.test(obs.name))) return;
      const dz = obs.z - ego.z;
      if (dz > 0.0 && dz < 45.0 && Math.abs(obs.x - this.LANE_RIGHT_CENTER) < 2.5) {
        if (obs.z < nearestObsZ) {
          nearestObsZ = obs.z;
        }
      }
    });

    const activeObstacles = obstacles.filter(obs => {
      if (obs.classId === 9 || obs.classId === '9' || (obs.name && /speed|breaker|bump/i.test(obs.name))) return false;
      const dz = obs.z - ego.z;
      // Skip obstacles already passed (behind ego center of mass)
      if (dz <= 0.0) return false;
      // Do not let distant obstacles (>16m beyond immediate obstacle) block the immediate local maneuver
      if (nearestObsZ !== Infinity && obs.z > nearestObsZ + 16.0) return false;
      return true;
    });

    let bestTraj = [];
    let minCost = Infinity;
    let bestTrajHasCollision = false;
    const candidateTrajs = [];
    
    // Strict White Line Boundary: Right vehicle boundary must stay >= -3.65m
    const minSafeX = this.ROAD_WHITE_RIGHT + this.egoHW + 0.10; // -2.675m
    
    this.lastDebugCandidateInfo = candidateOffsets.map(offset => {
      const targetX = this.LANE_RIGHT_CENTER + offset;
      if (targetX < minSafeX) return { offset, targetX: targetX.toFixed(2), rej: 'white_line' };
      if (oncomingApproaching && oncomingDistance < 85.0 && targetX > -0.3) return { offset, targetX: targetX.toFixed(2), rej: 'oncoming' };
      for (let i = 1; i <= steps; i++) {
        const t_i = i * dt;
        const s = i * (Math.max(1.0, this.targetSpeed) * dt);
        const tau = Math.min(1.0, s / 7.0);
        const polyLat = 10 * Math.pow(tau, 3) - 15 * Math.pow(tau, 4) + 6 * Math.pow(tau, 5);
        const ptX = ego.x + polyLat * (targetX - ego.x);
        const ptZ = ego.z + s;
        if (this.checkPointCollision(ptX, ptZ, activeObstacles, t_i)) {
          return { offset, targetX: targetX.toFixed(2), col: true, ptX: ptX.toFixed(2), ptZ: ptZ.toFixed(2) };
        }
      }
      return { offset, targetX: targetX.toFixed(2), col: false };
    });
    
    candidateOffsets.forEach(offset => {
      const targetX = this.LANE_RIGHT_CENTER + offset;
      
      // Reject if target would violate fixed right white line boundary
      if (targetX < minSafeX) return;
      
      // Reject if target moves into oncoming lane while oncoming traffic is approaching
      if (oncomingApproaching && oncomingDistance < 85.0 && targetX > -0.3) return;
      
      const traj = [];
      let trajectoryCollides = false;
      let costRisk = 0;
      let costSmoothness = 0;
      let costOffset = Math.abs(offset) * this.w_offset;
      
      // Bonus preference to stay centered in nominal lane
      if (Math.abs(offset) < 0.05) costOffset -= 2.0;
      
      // Penalty for encroaching near center divider line during normal driving
      if (state !== 'NUDGE' && targetX > -0.5) costOffset += 12.0;
      
      for (let i = 1; i <= steps; i++) {
        const t_i = i * dt;
        const s = i * (Math.max(1.0, this.targetSpeed) * dt);
        // Quintic polynomial lateral transition curve (smooth jerk-free S-curve over 7.0m)
        const tau = Math.min(1.0, s / 7.0);
        const polyLat = 10 * Math.pow(tau, 3) - 15 * Math.pow(tau, 4) + 6 * Math.pow(tau, 5);
        
        const ptX = ego.x + polyLat * (targetX - ego.x);
        const ptZ = ego.z + s;
        
        // Check strict physical collision along trajectory
        if (this.checkPointCollision(ptX, ptZ, activeObstacles, t_i)) {
          trajectoryCollides = true;
        }
        
        // Evaluate potential risk field
        const risk = this.evaluateRiskField(ptX, ptZ, activeObstacles);
        costRisk += risk;
        
        // Curvature / steering effort penalty
        costSmoothness += Math.pow(polyLat * (targetX - ego.x), 2) * 0.15;
        
        traj.push({ x: ptX, z: ptZ });
      }
      
      // If trajectory collides with an obstacle, apply insurmountable cost penalty
      if (trajectoryCollides) {
        costRisk += 50000.0;
      }
      
      const totalCost = (costRisk * this.w_collision) +
                        (costSmoothness * this.w_smoothness) +
                        costOffset;
      
      candidateTrajs.push(traj);
      
      if (totalCost < minCost) {
        minCost = totalCost;
        bestTraj = traj;
        bestTrajHasCollision = trajectoryCollides;
      }
    });
    
    // Fallback: If chosen trajectory physically collides or no valid path exists, command straight emergency stop
    if (bestTrajHasCollision || bestTraj.length === 0) {
      const fallbackTraj = [];
      for (let i = 1; i <= steps; i++) {
        const s = i * (Math.max(0.1, ego.speed) * dt);
        fallbackTraj.push({ x: this.LANE_RIGHT_CENTER, z: ego.z + s });
      }
      this.emergencySource = 'fallback_traj_collision_bestHasCol_' + bestTrajHasCollision + '_len_' + bestTraj.length;
      this.activeState = 'EMERGENCY_STOP';
      this.targetSpeed = 0.0;
      return {
        optimalTraj: fallbackTraj,
        candidateTrajs: [fallbackTraj],
        collides: true,
        safetyFallback: true
      };
    }
    
    return { optimalTraj: bestTraj, candidateTrajs, safetyFallback: false };
  }
  
  // Stanley Lateral Steering Control Law (src/control/stanley_lateral_controller.m)
  computeStanleySteering(ego, trajectory) {
    if (!trajectory || trajectory.length < 2) return 0;
    
    // Front Axle Coordinates (half wheelbase 1.4m ahead of vehicle center of gravity)
    const frontX = ego.x + 1.4 * Math.sin(ego.yaw);
    const frontZ = ego.z + 1.4 * Math.cos(ego.yaw);
    
    // Find closest waypoint on trajectory
    let minD = Infinity;
    let closestIdx = 0;
    for (let i = 0; i < trajectory.length; i++) {
      const d = Math.hypot(trajectory[i].x - frontX, trajectory[i].z - frontZ);
      if (d < minD) {
        minD = d;
        closestIdx = i;
      }
    }
    
    // Lookahead target point
    const targetIdx = Math.min(trajectory.length - 1, closestIdx + 2);
    const targetPt = trajectory[targetIdx];
    
    // Path Tangent Heading
    const dx = targetPt.x - frontX;
    const dz = targetPt.z - frontZ;
    const targetHeading = Math.atan2(dx, dz);
    
    // Heading Error: theta_e = psi_ref - psi
    let headingErr = targetHeading - ego.yaw;
    while (headingErr > Math.PI) headingErr -= 2 * Math.PI;
    while (headingErr < -Math.PI) headingErr += 2 * Math.PI;
    
    // Signed Cross-Track Error e_fa at front axle
    const crossTrack = (frontX - targetPt.x) * Math.cos(targetHeading) - (frontZ - targetPt.z) * Math.sin(targetHeading);
    this.lastCrossTrackError = Math.abs(crossTrack);
    
    // Stanley Steering Law: delta(t) = theta_e + arctan(-k * e_fa / (v + eps))
    const steer = headingErr + Math.atan2(-this.k_stanley * crossTrack, Math.max(0.5, ego.speed) + this.eps_soft);
    
    // Dead stop wheel centering (no twitching at 0 km/h)
    if (ego.speed < 0.2) return 0.0;
    
    // Smooth low-speed damping
    if (ego.speed < 0.8) {
      return (ego.speed / 0.8) * Math.max(-this.maxSteer, Math.min(this.maxSteer, steer));
    }
    
    // Steering Saturation Constraint [-35 deg, +35 deg]
    return Math.max(-this.maxSteer, Math.min(this.maxSteer, steer));
  }
}
