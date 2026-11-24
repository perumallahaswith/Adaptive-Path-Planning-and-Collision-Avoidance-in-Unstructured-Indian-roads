// 3D Model, Kinematics, Sensor Rig, & Actuators for Ego Autonomous Vehicle
class EgoVehicle3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    
    // Vehicle Physical Specifications (matching MATLAB Kinematic Model)
    this.length = 4.7;      // meters
    this.width = 1.85;      // meters
    this.height = 1.45;     // meters
    this.wheelbase = 2.8;   // meters (L)
    this.trackWidth = 1.6;  // meters
    this.hL = this.length / 2; // 2.35m
    this.hW = this.width / 2;  // 0.925m
    
    // Dynamic Kinematic State (RIGHT-SIDE TRAVEL LANE: x = -1.85m)
    this.x = -1.85;         // Right-side travel lane center
    this.y = 0;
    this.z = 0;             // Longitudinal road progress
    this.yaw = 0;           // Heading angle (radians)
    this.speed = 11.5;      // m/s (~42 km/h)
    this.targetSpeed = 11.5;
    this.steerAngle = 0;    // Front wheel steer delta (radians)
    // Steering is an actuator, not an instantaneous change in tyre angle.
    // Rate limiting the rendered vehicle prevents one-frame planner updates
    // from producing an S-shaped / zig-zag motion in an otherwise straight lane.
    this.maxSteerAngle = 35 * Math.PI / 180;
    this.maxSteerRate = 1.05;       // rad/s
    this.steerResponseTime = 0.16;  // s
    this.steerDeadband = 0.004;     // rad; ignores sub-pixel steering noise
    this.acceleration = 0;  // m/s^2
    this.isBraking = false;
    // The planner's swept-envelope result is consumed by the actuator guard.
    // This prevents the renderer/vehicle integration from continuing a path
    // that the planner has already rejected.
    this.safetyPlan = null;
    
    this.buildVehicleModel();
    this.scene.add(this.group);
  }
  
  setPosition(x = -1.85, y = 0, z = 0, speed = 11.5, yaw = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.speed = speed;
    this.yaw = yaw;
    this.steerAngle = 0;
    this.acceleration = 0;
    this.isBraking = false;
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
  }

  setSafetyPlan(plan) {
    this.safetyPlan = plan || null;
  }
  
  buildVehicleModel() {
    // 1. Lower Aerodynamic Body Chassis
    const chassisGeo = new THREE.BoxGeometry(this.width, 0.65, this.length);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      metalness: 0.85,
      roughness: 0.22,
      envMapIntensity: 1.2
    });
    this.chassis = new THREE.Mesh(chassisGeo, chassisMat);
    this.chassis.position.y = 0.58;
    this.chassis.castShadow = true;
    this.group.add(this.chassis);
    
    // Front Bumper Lip
    const bumperGeo = new THREE.BoxGeometry(this.width * 0.98, 0.25, 0.4);
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.7 });
    const bumper = new THREE.Mesh(bumperGeo, bumperMat);
    bumper.position.set(0, 0.35, this.length / 2);
    this.group.add(bumper);
    
    // 2. Cabin Glass Canopy (Greenhouse)
    const cabinGeo = new THREE.BoxGeometry(this.width * 0.82, 0.58, this.length * 0.52);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0a101a,
      metalness: 0.95,
      roughness: 0.08,
      transparent: true,
      opacity: 0.88
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.12, -0.2);
    cabin.castShadow = true;
    this.group.add(cabin);
    
    // 3. Autonomous Sensor Rig: Rooftop 64-Beam LiDAR Pod
    const podGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.22, 24);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x141a24, metalness: 0.9, roughness: 0.2 });
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set(0, 1.5, -0.2);
    this.group.add(pod);
    
    // Spinning LiDAR Puck Ring
    const puckGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 24);
    const puckMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.lidarScanner = new THREE.Mesh(puckGeo, puckMat);
    this.lidarScanner.position.set(0, 1.56, -0.2);
    this.group.add(this.lidarScanner);
    
    // Forward-Facing Camera Housing (Top Center of Windshield)
    const camHousing = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.1, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    camHousing.position.set(0, 1.35, this.length * 0.52 / 2 - 0.2);
    this.group.add(camHousing);
    
    // 4. Forward 77GHz mmWave Radar Sensor Visual Beam (Mounted on front bumper)
    const radarRange = 45.0;
    const radarFov = 42 * Math.PI / 180;
    const radarGeo = new THREE.RingGeometry(0.8, radarRange, 28, 1, Math.PI / 2 - radarFov / 2, radarFov);
    radarGeo.rotateX(-Math.PI / 2);
    const radarMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    this.radarBeam = new THREE.Mesh(radarGeo, radarMat);
    this.radarBeam.position.set(0, 0.05, this.length / 2);
    this.group.add(this.radarBeam);
    
    // Radar Pulse Outer Wave Ring
    const arcGeo = new THREE.RingGeometry(radarRange - 0.4, radarRange, 28, 1, Math.PI / 2 - radarFov / 2, radarFov);
    arcGeo.rotateX(-Math.PI / 2);
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    this.radarWave = new THREE.Mesh(arcGeo, arcMat);
    this.radarWave.position.set(0, 0.06, this.length / 2);
    this.group.add(this.radarWave);
    
    // 5. Wheels with Realistic Rims & Tires
    this.wheels = [];
    const wheelRadius = 0.38;
    const wheelWidth = 0.24;
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xdde4ec, metalness: 0.9, roughness: 0.15 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    
    const wheelX = this.trackWidth / 2;
    const frontZ = this.wheelbase / 2;
    const rearZ  = -this.wheelbase / 2;
    
    const wheelConfigs = [
      { x: -wheelX, z: frontZ, isFront: true },
      { x:  wheelX, z: frontZ, isFront: true },
      { x: -wheelX, z: rearZ,  isFront: false },
      { x:  wheelX, z: rearZ,  isFront: false }
    ];
    
    wheelConfigs.forEach(cfg => {
      const wheelAssembly = new THREE.Group();
      wheelAssembly.position.set(cfg.x, wheelRadius, cfg.z);
      
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      wheelAssembly.add(tireMesh);
      
      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.01, 16);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      wheelAssembly.add(rimMesh);
      
      this.group.add(wheelAssembly);
      this.wheels.push({
        group: wheelAssembly,
        pivot: wheelAssembly,
        tireMesh,
        isFront: cfg.isFront
      });
    });
    
    // 6. Dual Xenon Road-Casting Projector Headlights
    this.leftSpot = new THREE.SpotLight(0xfffaed, 2.0, 45, Math.PI / 6, 0.4);
    this.leftSpot.position.set(-0.65, 0.7, this.length / 2);
    this.leftSpot.target.position.set(-0.65, 0, this.length / 2 + 25);
    this.group.add(this.leftSpot);
    this.group.add(this.leftSpot.target);
    
    this.rightSpot = new THREE.SpotLight(0xfffaed, 2.0, 45, Math.PI / 6, 0.4);
    this.rightSpot.position.set(0.65, 0.7, this.length / 2);
    this.rightSpot.target.position.set(0.65, 0, this.length / 2 + 25);
    this.group.add(this.rightSpot);
    this.group.add(this.rightSpot.target);
    
    // 7. Rear LED Taillight Bar & Active Brake Lights
    const tailGeo = new THREE.BoxGeometry(this.width * 0.9, 0.08, 0.05);
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x880000 });
    this.taillight = new THREE.Mesh(tailGeo, this.tailMat);
    this.taillight.position.set(0, 0.68, -this.length / 2 - 0.01);
    this.group.add(this.taillight);
  }
  
  update(dt, steerCmd, accCmd, obstacles = []) {
    // The planner remains the sole source of the steering target.  This layer
    // only models a stable physical steering actuator, with a time-based
    // response so its behaviour is independent of browser frame rate.
    const requestedSteer = THREE.MathUtils.clamp(
      Number.isFinite(steerCmd) ? steerCmd : 0,
      -this.maxSteerAngle,
      this.maxSteerAngle
    );
    const steerTarget = Math.abs(requestedSteer) < this.steerDeadband ? 0 : requestedSteer;
    const response = 1 - Math.exp(-dt / this.steerResponseTime);
    const filteredSteer = this.steerAngle + (steerTarget - this.steerAngle) * response;
    const maxSteerStep = this.maxSteerRate * dt;
    this.steerAngle = THREE.MathUtils.clamp(
      filteredSteer,
      this.steerAngle - maxSteerStep,
      this.steerAngle + maxSteerStep
    );
    this.acceleration = accCmd;
    if (this.safetyPlan?.trajectorySafety && !this.safetyPlan.trajectorySafety.safe) {
      this.acceleration = Math.min(this.acceleration, -8.0);
    }
    
    // Longitudinal Speed Integration
    const previousSpeed = this.speed;
    this.speed = Math.max(0, this.speed + this.acceleration * dt);
    if (this.speed < 0.04) this.speed = 0;
    const averageSpeed = 0.5 * (previousSpeed + this.speed);
    
    // Brake Light Activation
    this.isBraking = this.acceleration < -0.8;
    if (this.isBraking) {
      this.tailMat.color.setHex(0xff0022); // Brilliant brake red
    } else {
      this.tailMat.color.setHex(0x550000); // Idle taillight
    }
    
    // Kinematic bicycle integration at the midpoint avoids the lateral
    // overshoot caused by applying a full yaw update before translating.
    const yawRate = (averageSpeed / this.wheelbase) * Math.tan(this.steerAngle);
    const midpointYaw = this.yaw + 0.5 * yawRate * dt;
    this.yaw += yawRate * dt;
    
    // Compute candidate next position
    const nextX = this.x + averageSpeed * Math.sin(midpointYaw) * dt;
    const nextZ = this.z + averageSpeed * Math.cos(midpointYaw) * dt;
    
    // Strict Motion Collision Guard: Zero-tolerance penetration check
    let collisionBlocked = false;
    if (obstacles && obstacles.length > 0) {
      for (const obs of obstacles) {
        // Speed breakers are road-surface features designed to be driven over slowly, not physical collision walls
        if (obs.classId === 9 || obs.classId === '9' || (obs.name && /speed|breaker|bump/i.test(obs.name))) continue;

        const obsHL = obs.hL || (obs.a_long ? obs.a_long * 0.65 : 1.2);
        const obsHW = obs.hW || (obs.b_lat ? obs.b_lat * 0.55 : 0.75);
        const obsSpeed = obs.speed || 0;
        const obsYaw = obs.yaw || 0;
        const obsNextZ = obs.z + obsSpeed * Math.cos(obsYaw) * dt;
        const obsNextX = obs.x + obsSpeed * Math.sin(obsYaw) * dt + (obs.lateralVelocity || 0) * dt;
        const absDZ = Math.abs(obsNextZ - nextZ);
        const absDX = Math.abs(obsNextX - nextX);
        
        // Exact 2D bounding box contact distance
        const contactDistZ = this.hL + obsHL;
        const contactDistX = this.hW + obsHW;
        
        // Zero-tolerance physical collision barrier:
        // If directly behind obstacle in travel path, enforce strict 4.8m physical safety buffer
        const isDirectlyBehind = Math.abs(obsNextX - nextX) < (contactDistX * 0.75) && (obsNextZ >= nextZ);
        const physicalGapZ = absDZ - contactDistZ;
        
        if (isDirectlyBehind && physicalGapZ <= 4.8) {
          // Hard physical stop directly at 4.8m safe buffer
          this.speed = 0.0;
          this.acceleration = -9.0;
          this.isBraking = true;
          collisionBlocked = true;
          break;
        } else if (absDZ <= contactDistZ + 0.35 && absDX <= contactDistX + 0.15) {
          // General all-angle physical collision barrier
          this.speed = 0.0;
          this.acceleration = -9.0;
          this.isBraking = true;
          collisionBlocked = true;
          break;
        }
      }
    }
    
    if (!collisionBlocked) {
      this.x = nextX;
      this.z = nextZ;
    }
    
    // Strict Lane Boundary Constraint: Right white solid edge at -3.70m
    const rightEdge = this.x - this.hW;
    if (rightEdge < -3.65) {
      this.x = -3.65 + this.hW; // Clamp to stay strictly inside road boundary
      if (this.yaw < 0) this.yaw = 0;
    }
    const leftEdge = this.x + this.hW;
    if (leftEdge > 3.65) {
      this.x = 3.65 - this.hW;
      if (this.yaw > 0) this.yaw = 0;
    }
    
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
    
    // Wheel Rotation & Steering Angle
    const wheelRotSpeed = (this.speed / 0.38) * dt;
    this.wheels.forEach(w => {
      w.tireMesh.rotation.x += wheelRotSpeed;
      if (w.isFront) {
        w.pivot.rotation.y = this.steerAngle;
      }
    });
    
    // Rooftop LiDAR Spinning
    if (this.lidarScanner) {
      this.lidarScanner.rotation.y += dt * 15.0; // 10 Hz rotation
    }
    
    // Animate Radar Beam Sweep Wave
    if (this.radarWave) {
      const pulse = (Math.sin(performance.now() * 0.005) + 1) * 0.5;
      this.radarWave.material.opacity = 0.2 + pulse * 0.45;
    }
  }
}
