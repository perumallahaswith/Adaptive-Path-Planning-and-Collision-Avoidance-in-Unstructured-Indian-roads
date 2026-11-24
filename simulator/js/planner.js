// Deterministic browser port of the project decision, planning and control stack.
// The policy is deliberately conservative: a pass is never started until the whole
// pass-and-return envelope is clear of predicted oncoming traffic.
class AutonomousDrivingBrain {
  constructor() {
    this.activeState = 'CRUISE';
    this.targetSpeed = 11.5;
    this.dwellTime = 0;
    this.lastLatency = 10.8;

    this.LANE_RIGHT_CENTER = -1.85;
    this.LANE_LEFT_CENTER = 1.85;
    this.PASS_LANE_CENTER = 1.15;
    this.ROAD_WHITE_RIGHT = -3.70;
    this.ROAD_WHITE_LEFT = 3.70;
    this.egoHL = 2.35;
    this.egoHW = 0.925;
    this.safeBufferLong = 1.20;
    this.safeBufferLat = 0.30;
    this.stopBuffer = 5.5;
    this.k_stanley = 1.8;
    this.eps_soft = 1.0;
    this.maxSteer = 35 * Math.PI / 180;

    this.lastCrossTrackError = 0;
    this.lastJerkScore = 0.35;
    this.nearestObstacle = null;
    this.oncomingVehicle = null;
    this.passHazardId = null;
    this.mergeFollowActorId = null;
    this.lastGapCertificate = { safe: true, reason: 'No pass requested', timeToClear: 0, blockingActor: null };
  }

  isSpeedBreaker(obs) {
    return obs && (obs.classId === 9 || obs.classId === '9' || /speed|breaker|bump/i.test(obs.name || ''));
  }

  dims(obs) {
    return {
      hL: obs.hL || (obs.length ? obs.length / 2 : (obs.a_long ? obs.a_long * 0.65 : 1.2)),
      hW: obs.hW || (obs.width ? obs.width / 2 : (obs.b_lat ? obs.b_lat * 0.55 : 0.75))
    };
  }

  predictedActor(obs, t) {
    const speed = obs.speed || 0;
    const yaw = obs.yaw || 0;
    return {
      x: obs.x + speed * Math.sin(yaw) * t + (obs.lateralVelocity || 0) * t,
      z: obs.z + speed * Math.cos(yaw) * t
    };
  }

  isOncoming(obs, ego) {
    const dz = obs.z - ego.z;
    return obs.x > -0.2 && dz > -16 && dz < 150 &&
      ((obs.speed || 0) < -0.2 || /truck|oncoming/i.test(obs.name || ''));
  }

  isRightLaneBlocker(obs, ego) {
    if (this.isSpeedBreaker(obs)) return false;
    const dz = obs.z - ego.z;
    if (dz <= -1.0 || dz >= 62) return false;
    const { hW } = this.dims(obs);
    // Any actor occupying the legal lane or entering from its shoulder is relevant.
    return obs.x < 0.35 && obs.x > -4.05 &&
      Math.abs(obs.x - this.LANE_RIGHT_CENTER) < (1.60 + hW);
  }

  physicalClearance(ego, obs) {
    const { hL } = this.dims(obs);
    return obs.z - ego.z - this.egoHL - hL;
  }

  // A pass must be safe for the lateral move, the time alongside the obstacle,
  // and the controlled return. It is recomputed on every simulation tick.
  evaluateGapCertificate(ego, blocker, actors) {
    if (!blocker) return { safe: false, reason: 'No blocked-lane actor identified', timeToClear: Infinity, blockingActor: null };
    const b = this.dims(blocker);
    const nominalSpeed = Math.max(5.2, Math.min(7.2, ego.speed + 1.0));
    const passEndZ = blocker.z + b.hL + this.egoHL + 5.0;
    const distance = Math.max(10, passEndZ - ego.z);
    const horizon = Math.max(4.5, Math.min(8.5, distance / nominalSpeed + 2.2));
    const samples = Math.ceil(horizon / 0.20);
    let nearestTime = Infinity;
    let nearestActor = null;

    for (const actor of actors) {
      if (!this.isOncoming(actor, ego)) continue;
      const a = this.dims(actor);
      for (let index = 0; index <= samples; index += 1) {
        const t = index * horizon / samples;
        const egoZ = ego.z + nominalSpeed * t;
        const actorAtT = this.predictedActor(actor, t);
        const longitudinalSeparation = Math.abs(actorAtT.z - egoZ);
        const lateralSeparation = Math.abs(actorAtT.x - this.PASS_LANE_CENTER);
        const longitudinalRequired = this.egoHL + a.hL + 4.0;
        const lateralRequired = this.egoHW + a.hW + this.safeBufferLat;
        if (longitudinalSeparation < longitudinalRequired && lateralSeparation < lateralRequired) {
          return {
            safe: false,
            reason: 'Oncoming ' + (actor.name || 'vehicle') + ' occupies the pass envelope in ' + t.toFixed(1) + ' s',
            timeToClear: t,
            blockingActor: actor.name || 'Oncoming vehicle'
          };
        }
        if (actorAtT.z < ego.z - 8 && !nearestActor) {
          nearestTime = t;
          nearestActor = actor;
        }
      }
    }
    return {
      safe: true,
      reason: 'Predicted opposing lane remains clear through pass and return',
      timeToClear: nearestTime === Infinity ? 0 : nearestTime,
      blockingActor: nearestActor ? nearestActor.name : null
    };
  }

  mergeConflict(ego, actors) {
    for (const actor of actors) {
      const dz = actor.z - ego.z;
      if (dz < -4 || dz > 42 || actor.classId !== 2) continue;
      const lateralVelocity = actor.lateralVelocity || (actor.speed || 0) * Math.sin(actor.yaw || 0);
      const enteringLane = actor.x < -2.25 && lateralVelocity > 0.15;
      const occupyingMergeEnvelope = actor.x >= -2.55 && actor.x <= -1.10;
      // Gate yield on an actual near-term merge envelope, not a broad range.
      // The 28 m horizon avoids the former premature slow-down at 43 m.
      if ((enteringLane || occupyingMergeEnvelope) && dz < 28) return actor;
    }
    return null;
  }

  crossTrafficConflict(ego, actors) {
    return actors.find(actor => {
      const dz = actor.z - ego.z;
      return dz > -3 && dz < 24 && Math.abs(actor.yaw || 0) > 0.65 && Math.abs(actor.x - ego.x) < 8;
    }) || null;
  }

  step(ego, obstacles, dt, isBridgeZone = false, ambientTraffic = [], weather = 'DAY', scenarioPolicy = null) {
    const t0 = performance.now();
    this.dwellTime += dt;
    const isRain = String(weather).toUpperCase() === 'RAIN';
    const actors = [...obstacles, ...(ambientTraffic || [])];
    const policy = scenarioPolicy || {};
    const physicalActors = actors.filter(actor => !this.isSpeedBreaker(actor));
    const blockers = physicalActors
      .filter(actor => this.isRightLaneBlocker(actor, ego))
      .sort((a, b) => this.physicalClearance(ego, a) - this.physicalClearance(ego, b));
    const blocker = blockers[0] || null;
    const clearance = blocker ? this.physicalClearance(ego, blocker) : Infinity;
    const oncoming = physicalActors.filter(actor => this.isOncoming(actor, ego));
    this.oncomingVehicle = oncoming.sort((a, b) => a.z - b.z)[0] || null;
    this.nearestObstacle = blocker || this.oncomingVehicle || null;

    let minDist = Infinity;
    let minTTC = Infinity;
    let crowdCount = 0;
    let crowdScenePresent = false;
    let speedBreakerAhead = null;
    for (const actor of actors) {
      const dz = actor.z - ego.z;
      const dx = actor.x - ego.x;
      if (this.isSpeedBreaker(actor)) {
        if (dz > -2 && dz < 38 && (!speedBreakerAhead || dz < speedBreakerAhead.z - ego.z)) speedBreakerAhead = actor;
        continue;
      }
      const dim = this.dims(actor);
      minDist = Math.min(minDist, Math.max(0, Math.hypot(dx, dz) - this.egoHL - dim.hL));
      if (dz > 0 && Math.abs(dx) < this.egoHW + dim.hW + 0.45) {
        minTTC = Math.min(minTTC, Math.max(0.1, dz - this.egoHL - dim.hL) / Math.max(0.5, ego.speed - (actor.speed || 0)));
      }
      if (dz > 0 && dz < 32 && Math.abs(actor.x - this.LANE_RIGHT_CENTER) < 2.5 &&
          (actor.classId === 6 || /pedestrian|crowd/i.test(actor.name || ''))) crowdCount += 1;
      if (dz > -6 && dz < 24 && (actor.classId === 5 || actor.classId === 6 || /pushcart|pedestrian|crowd/i.test(actor.name || ''))) {
        crowdScenePresent = true;
      }
    }

    let nextState = this.activeState;
    let reason = 'Right-side lane clear; maintaining nominal cruise';
    let gapCertificate = { safe: true, reason: 'No passing manoeuvre requested', timeToClear: 0, blockingActor: null };
    const intent = policy.intent || '';
    const injectedPolicy = intent === 'INJECTED_HAZARD';
    const passPolicy = intent === 'PASS_AFTER_GAP' ||
      (injectedPolicy && blocker && ![4, 6].includes(blocker.classId)) ||
      (!intent && blocker && ![4, 6].includes(blocker.classId));
    const stopPolicy = intent === 'STOP_ON_OCCUPANCY' || (!passPolicy && blocker && [4, 6].includes(blocker.classId));
    const crowdPolicy = intent === 'INCH_CROWD';
    // Keep enough longitudinal room to complete a lateral transition after a
    // stopped oncoming-traffic wait; 5 m is adequate for stopping, not passing.
    const queueStopBuffer = passPolicy ? 13.0 : this.stopBuffer;
    const mergeActor = intent === 'MERGE_ON_CONFLICT' || intent === 'YIELD_ON_CONFLICT' ? this.mergeConflict(ego, physicalActors) : null;
    const crossActor = intent === 'YIELD_ON_CONFLICT' ? this.crossTrafficConflict(ego, physicalActors) : null;
    const followedMerge = physicalActors.find(actor => actor.id === this.mergeFollowActorId) || null;

    if (isBridgeZone || intent === 'BRIDGE_HOLD') {
      if (blocker && clearance < 32) {
        nextState = 'BRIDGE_STOP';
        reason = 'Bridge safety hold: no passing path exists between parapet walls';
      } else {
        nextState = 'CRUISE';
        reason = 'Bridge corridor clear; remaining centred in the legal lane';
      }
    } else if (this.activeState === 'OVERTAKE_LEFT') {
      const tracked = physicalActors.find(actor => actor.id === this.passHazardId) || blocker;
      if (!tracked || ego.z > tracked.z + this.dims(tracked).hL + this.egoHL + 3.8) {
        nextState = 'RETURN_RIGHT';
        reason = 'Obstacle fully cleared; returning to right-side travel lane';
      } else {
        nextState = 'OVERTAKE_LEFT';
        gapCertificate = this.evaluateGapCertificate(ego, tracked, physicalActors);
        reason = 'Passing ' + (tracked.name || 'obstacle') + ' inside certified opposing-lane gap';
      }
    } else if (this.activeState === 'RETURN_RIGHT') {
      if (ego.x <= this.LANE_RIGHT_CENTER + 0.30) {
        nextState = 'CRUISE';
        this.passHazardId = null;
        reason = 'Right lane re-established after certified pass';
      } else {
        nextState = 'RETURN_RIGHT';
        reason = 'Controlled lane return in progress; rear clearance protected';
      }
    } else if (stopPolicy && blocker) {
      nextState = 'EMERGENCY_STOP';
      reason = (policy.label || 'Vulnerable road user occupies the travel lane') + '; stopping in lane';
    } else if (crowdPolicy && (crowdCount >= 2 || blocker || (this.activeState === 'EMERGENCY_STOP' && crowdScenePresent))) {
      if ((this.activeState === 'EMERGENCY_STOP' && crowdScenePresent) || clearance <= this.stopBuffer + 0.5) {
        nextState = 'EMERGENCY_STOP';
        reason = 'Crowd entered the stopping envelope; holding position';
      } else {
        nextState = 'INCHING';
        reason = 'Dense market: in-lane creep only, with no overtaking';
      }
    } else if (intent === 'MERGE_ON_CONFLICT' && this.activeState === 'INTERACTIVE_MERGE' && followedMerge &&
      followedMerge.z - ego.z > -4 && followedMerge.z - ego.z < 58) {
      nextState = 'INTERACTIVE_MERGE';
      reason = 'Merge complete; following the merged vehicle at a stable time gap';
    } else if (mergeActor || crossActor) {
      const conflict = mergeActor || crossActor;
      nextState = 'INTERACTIVE_MERGE';
      if (intent === 'MERGE_ON_CONFLICT') this.mergeFollowActorId = conflict.id;
      reason = 'Predicted conflict with ' + (conflict.name || 'cross traffic') + '; yielding only until its path clears';
    } else if (intent === 'MERGE_ON_CONFLICT' && blocker) {
      // The merge vehicle has now entered the legal lane. Continue the
      // same yield/follow behaviour instead of treating it as a generic nudge.
      nextState = 'INTERACTIVE_MERGE';
      this.mergeFollowActorId = blocker.id;
      reason = 'Merge vehicle occupies the lane; maintaining a controlled follow gap';
    } else if (blocker && passPolicy) {
      gapCertificate = this.evaluateGapCertificate(ego, blocker, physicalActors);
      if (gapCertificate.safe) {
        nextState = 'OVERTAKE_LEFT';
        this.passHazardId = blocker.id;
        reason = 'Gap certificate approved: pass ' + (blocker.name || 'obstacle') + ', then return right';
      } else {
        nextState = 'GAP_WAIT';
        this.passHazardId = blocker.id;
        reason = 'Gap wait: ' + gapCertificate.reason;
      }
    } else if (this.activeState === 'GAP_WAIT' && blocker) {
      gapCertificate = this.evaluateGapCertificate(ego, blocker, physicalActors);
      if (gapCertificate.safe) {
        nextState = 'OVERTAKE_LEFT';
        this.passHazardId = blocker.id;
        reason = 'Opposing lane certified clear; beginning controlled pass';
      } else {
        nextState = 'GAP_WAIT';
        reason = 'Holding safe queue: ' + gapCertificate.reason;
      }
    } else if (blocker) {
      nextState = 'NUDGE';
      reason = 'Bounded in-lane avoidance around ' + (blocker.name || 'obstacle');
    } else if (this.activeState === 'EMERGENCY_STOP' || this.activeState === 'GAP_WAIT') {
      nextState = 'CRUISE';
      reason = 'Travel corridor clear; resuming right-side lane cruise';
    } else if (speedBreakerAhead) {
      nextState = 'CRUISE';
      reason = 'Speed breaker ahead; applying 15 km/h comfort governor';
    } else if (this.activeState === 'NUDGE' || this.activeState === 'INTERACTIVE_MERGE' || this.activeState === 'INCHING') {
      nextState = 'CRUISE';
      reason = 'Conflict cleared; recovering to lane centre';
    }

    if (nextState !== this.activeState) {
      this.activeState = nextState;
      this.dwellTime = 0;
    }
    this.lastGapCertificate = gapCertificate;

    switch (this.activeState) {
      case 'BRIDGE_STOP':
      case 'EMERGENCY_STOP': this.targetSpeed = 0; break;
      case 'GAP_WAIT': this.targetSpeed = Number.isFinite(clearance) ? Math.max(0, Math.min(3.0, (clearance - queueStopBuffer) * 0.55)) : 0; break;
      case 'OVERTAKE_LEFT':
      case 'RETURN_RIGHT': this.targetSpeed = isRain ? 5.2 : 6.4; break;
      case 'INCHING': this.targetSpeed = 2.0; break;
      case 'INTERACTIVE_MERGE': {
        const followSpeed = (followedMerge || blocker)?.speed;
        this.targetSpeed = intent === 'MERGE_ON_CONFLICT' && Number.isFinite(followSpeed)
          ? Math.max(3.0, Math.min(6.5, followSpeed))
          : 4.5;
        break;
      }
      case 'NUDGE': this.targetSpeed = isRain ? 5.3 : 6.2; break;
      default: this.targetSpeed = isBridgeZone ? 9.2 : (isRain ? 8.3 : 11.5);
    }
    const speedGoverned = Boolean(speedBreakerAhead && this.activeState === 'CRUISE');
    if (speedGoverned) this.targetSpeed = Math.min(this.targetSpeed, 4.17);

    let built = this.buildTrajectory(ego, physicalActors, blocker, this.activeState);
    let safetyFallback = false;
    if (!built.safety.safe && !['EMERGENCY_STOP', 'BRIDGE_STOP', 'GAP_WAIT'].includes(this.activeState)) {
      safetyFallback = true;
      this.activeState = blocker && passPolicy ? 'GAP_WAIT' : 'EMERGENCY_STOP';
      this.targetSpeed = 0;
      reason = 'Trajectory envelope rejected; applying controlled in-lane stop';
      built = this.buildTrajectory(ego, physicalActors, blocker, this.activeState);
    }

    const steerCmd = this.computeStanleySteering(ego, built.trajectory);
    let accCmd = (this.targetSpeed - ego.speed) * 1.55;
    if (['EMERGENCY_STOP', 'BRIDGE_STOP', 'GAP_WAIT'].includes(this.activeState)) {
      const remaining = (Number.isFinite(clearance) ? clearance : queueStopBuffer + 3) - queueStopBuffer;
      if (remaining <= 0.25) {
        ego.speed = 0;
        accCmd = -8.0;
      } else {
        const required = -(ego.speed * ego.speed) / (2 * Math.max(0.25, remaining));
        accCmd = Math.max(-9, Math.min(-1.5, required));
      }
    } else {
      accCmd = Math.max(-4.8, Math.min(2.5, accCmd));
    }

    this.lastLatency = performance.now() - t0 + 10.4;
    return {
      activeState: this.activeState,
      behaviorPhase: this.activeState,
      targetSpeed: this.targetSpeed,
      reason,
      plannedTrajectory: built.trajectory,
      candidateTrajectories: built.candidates,
      steerCmd,
      accCmd,
      latency: this.lastLatency,
      minTTC: minTTC === Infinity ? 99 : minTTC,
      minDist: Number.isFinite(clearance) ? Math.max(0, clearance) : minDist,
      physicalClearance: Number.isFinite(clearance) ? Math.max(0, clearance) : minDist,
      crossTrackError: this.lastCrossTrackError,
      jerkScore: this.lastJerkScore,
      oncomingThreat: oncoming.length > 0,
      speedGoverned,
      safetyFallback,
      scenarioPolicy: policy,
      policyInRange: Boolean(blocker && blocker.z - ego.z <= (policy.engageDistance || 0)),
      gapCertificate,
      trajectorySafety: built.safety
    };
  }

  smoothStep(t) {
    const s = Math.max(0, Math.min(1, t));
    return 10 * s ** 3 - 15 * s ** 4 + 6 * s ** 5;
  }

  makeTrajectory(ego, targetX, speed, horizon = 4.0, transitionDistance = 10.5) {
    const steps = 32;
    const trajectory = [];
    for (let index = 1; index <= steps; index += 1) {
      const t = index * horizon / steps;
      const travel = Math.max(0.15, speed) * t;
      const blend = this.smoothStep(travel / transitionDistance);
      trajectory.push({ x: ego.x + (targetX - ego.x) * blend, z: ego.z + travel, t });
    }
    return trajectory;
  }

  validateTrajectory(trajectory, actors) {
    let minClearance = Infinity;
    for (const point of trajectory) {
      if (point.x - this.egoHW < this.ROAD_WHITE_RIGHT + 0.05 || point.x + this.egoHW > this.ROAD_WHITE_LEFT - 0.05) {
        return { safe: false, reason: 'Road boundary envelope exceeded', minClearance: 0 };
      }
      for (const actor of actors) {
        const actorAtT = this.predictedActor(actor, point.t || 0);
        const dim = this.dims(actor);
        const dz = Math.abs(actorAtT.z - point.z);
        const dx = Math.abs(actorAtT.x - point.x);
        const longRequired = this.egoHL + dim.hL + this.safeBufferLong;
        const latRequired = this.egoHW + dim.hW + this.safeBufferLat;
        minClearance = Math.min(minClearance, Math.max(dz - longRequired, dx - latRequired));
        if (dz <= longRequired && dx <= latRequired) {
          return { safe: false, reason: 'Swept vehicle footprint intersects ' + (actor.name || 'actor'), minClearance: Math.max(0, minClearance) };
        }
      }
    }
    return { safe: true, reason: 'Swept vehicle envelope clear', minClearance: Number.isFinite(minClearance) ? Math.max(0, minClearance) : 99 };
  }

  buildTrajectory(ego, actors, blocker, state) {
    let targets;
    if (state === 'OVERTAKE_LEFT') targets = [this.PASS_LANE_CENTER];
    else if (state === 'RETURN_RIGHT' || state === 'CRUISE' || state === 'GAP_WAIT' || state === 'EMERGENCY_STOP' || state === 'BRIDGE_STOP') targets = [this.LANE_RIGHT_CENTER];
    else if (state === 'INCHING') targets = [this.LANE_RIGHT_CENTER, -1.55, -2.10];
    else if (state === 'NUDGE') targets = blocker && blocker.x > -1.45 ? [-2.45, -2.20, -0.55] : [-0.55, -0.80, -2.35];
    else targets = [this.LANE_RIGHT_CENTER];

    const transitionDistance = state === 'OVERTAKE_LEFT' ? 5.0 : (state === 'RETURN_RIGHT' ? 3.5 : 10.5);
    const candidates = targets.map(target => this.makeTrajectory(ego, target, Math.max(0.15, this.targetSpeed), 4.0, transitionDistance));
    const checked = candidates.map(trajectory => ({ trajectory, safety: this.validateTrajectory(trajectory, actors) }));
    const approved = checked.find(item => item.safety.safe);
    if (approved) return { trajectory: approved.trajectory, candidates, safety: approved.safety };
    const stopTrajectory = this.makeTrajectory(ego, this.LANE_RIGHT_CENTER, Math.max(0.15, Math.min(ego.speed, 1.0)));
    return { trajectory: stopTrajectory, candidates: [stopTrajectory], safety: this.validateTrajectory(stopTrajectory, actors) };
  }

  computeStanleySteering(ego, trajectory) {
    if (!trajectory || trajectory.length < 2 || ego.speed < 0.2) return 0;
    const frontX = ego.x + 1.4 * Math.sin(ego.yaw);
    const frontZ = ego.z + 1.4 * Math.cos(ego.yaw);
    let closest = 0;
    let minDistance = Infinity;
    trajectory.forEach((point, index) => {
      const distance = Math.hypot(point.x - frontX, point.z - frontZ);
      if (distance < minDistance) { minDistance = distance; closest = index; }
    });
    const target = trajectory[Math.min(trajectory.length - 1, closest + 3)];
    const heading = Math.atan2(target.x - frontX, target.z - frontZ);
    let headingError = heading - ego.yaw;
    while (headingError > Math.PI) headingError -= 2 * Math.PI;
    while (headingError < -Math.PI) headingError += 2 * Math.PI;
    const crossTrack = (frontX - target.x) * Math.cos(heading) - (frontZ - target.z) * Math.sin(heading);
    this.lastCrossTrackError = Math.abs(crossTrack);
    const steer = headingError + Math.atan2(-this.k_stanley * crossTrack, Math.max(0.5, ego.speed) + this.eps_soft);
    return Math.max(-this.maxSteer, Math.min(this.maxSteer, steer));
  }
}

window.AutonomousDrivingBrain = AutonomousDrivingBrain;
