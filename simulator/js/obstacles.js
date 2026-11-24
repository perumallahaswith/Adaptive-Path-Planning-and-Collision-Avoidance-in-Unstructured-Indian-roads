// 3D Heterogeneous Indian Road Obstacles, Oncoming Traffic, & Dynamic Risk Potential Decals
class ObstacleManager3D {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.ambientCars = [];
  }
  
  clear() {
    this.obstacles.forEach(obs => {
      this.scene.remove(obs.group);
      if (obs.riskDecal) this.scene.remove(obs.riskDecal);
    });
    this.ambientCars.forEach(car => {
      this.scene.remove(car.group);
    });
    this.obstacles = [];
    this.ambientCars = [];
  }
  
  // Creates dynamic elliptical risk potential decal matching MATLAB potential_risk_field.m
  createRiskDecal(a_long, b_lat) {
    const segments = 36;
    const curve = new THREE.EllipseCurve(
      0, 0,
      b_lat, a_long, // x is lateral (b_lat), y is longitudinal (a_long)
      0, 2 * Math.PI,
      false,
      0
    );
    const points = curve.getPoints(segments);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    geo.rotateX(-Math.PI / 2); // Lay flat on road surface
    
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    
    const line = new THREE.LineLoop(geo, mat);
    line.position.y = 0.04;
    this.scene.add(line);
    return line;
  }
  
  // 1. STRAY CATTLE (Indian Zebu Cow with Dorsal Hump & Horns)
  createCattle(id, x, z, yaw = 0) {
    const group = new THREE.Group();
    
    // Body Torso
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc89b68, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 1.8), bodyMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    group.add(torso);
    
    // Indian Zebu Dorsal Hump
    const humpGeo = new THREE.SphereGeometry(0.35, 12, 12);
    humpGeo.scale(0.8, 1.2, 1.0);
    const hump = new THREE.Mesh(humpGeo, bodyMat);
    hump.position.set(0, 1.62, 0.45);
    hump.castShadow = true;
    group.add(hump);
    
    // Mottled Hide Spots
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x422f20, roughness: 0.95 });
    const spot = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.45, 0.6), spotMat);
    spot.position.set(0, 1.1, -0.15);
    group.add(spot);
    
    // Neck & Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.65), bodyMat);
    head.position.set(0, 1.35, 1.05);
    head.castShadow = true;
    group.add(head);
    
    // Curved Horns
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 8), hornMat);
    leftHorn.rotation.x = -Math.PI / 4;
    leftHorn.rotation.z = Math.PI / 6;
    leftHorn.position.set(-0.22, 1.68, 0.95);
    const rightHorn = leftHorn.clone();
    rightHorn.rotation.z = -Math.PI / 6;
    rightHorn.position.x = 0.22;
    group.add(leftHorn);
    group.add(rightHorn);
    
    // 4 Articulated Legs
    const legGeo = new THREE.BoxGeometry(0.16, 0.75, 0.16);
    const legPositions = [
      [-0.3, 0.375, -0.6],
      [ 0.3, 0.375, -0.6],
      [-0.3, 0.375,  0.6],
      [ 0.3, 0.375,  0.6]
    ];
    const legs = [];
    legPositions.forEach(p => {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(p[0], p[1], p[2]);
      leg.castShadow = true;
      group.add(leg);
      legs.push(leg);
    });
    
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    this.scene.add(group);
    
    // MATLAB Risk Field: a_long = 3.5m, b_lat = 2.8m (High lateral risk for cattle)
    const riskDecal = this.createRiskDecal(3.5, 2.8);
    
    const obs = {
      id,
      classId: 4,
      name: 'Stray Cattle',
      group,
      riskDecal,
      legs,
      x, z, yaw,
      speed: 0,
      a_long: 3.5,
      b_lat: 2.8, length: 2.2, width: 1.2, hL: 1.1, hW: 0.6,
      isTriggered: false,
      walkPhase: 0,
      freezeTimer: 0,
      update: (dt) => {
        if (obs.isTriggered) {
          if (obs.x < -1.85) {
            // Phase 1: Cattle steps onto road from right shoulder (x starts at -4.2m)
            obs.x += 1.4 * dt;
            obs.speed = 1.4;
            obs.yaw = Math.PI / 2;
            obs.walkPhase += dt * 8.0;
            obs.legs[0].rotation.x = Math.sin(obs.walkPhase) * 0.4;
            obs.legs[1].rotation.x = -Math.sin(obs.walkPhase) * 0.4;
            obs.legs[2].rotation.x = -Math.sin(obs.walkPhase) * 0.4;
            obs.legs[3].rotation.x = Math.sin(obs.walkPhase) * 0.4;
          } else if (obs.freezeTimer < 2.8) {
            // Phase 2: Freezes directly in Right-Side Travel Lane (x ~ -1.85m) for 2.8s
            obs.freezeTimer += dt;
            obs.speed = 0;
            obs.yaw = 0.15;
            obs.legs.forEach(l => l.rotation.x = 0);
          } else if (obs.x < 4.2) {
            // Phase 3: Resumes crossing across road towards left shoulder, clearing right lane!
            obs.x += 1.4 * dt;
            obs.speed = 1.4;
            obs.yaw = Math.PI / 2;
            obs.walkPhase += dt * 7.5;
            obs.legs[0].rotation.x = Math.sin(obs.walkPhase) * 0.4;
            obs.legs[1].rotation.x = -Math.sin(obs.walkPhase) * 0.4;
            obs.legs[2].rotation.x = -Math.sin(obs.walkPhase) * 0.4;
            obs.legs[3].rotation.x = Math.sin(obs.walkPhase) * 0.4;
          } else {
            // Grazing safely on left shoulder (x >= 4.2m)
            obs.speed = 0;
            obs.yaw = -Math.PI / 4;
            obs.legs.forEach(l => l.rotation.x = 0);
          }
        }
        obs.group.position.set(obs.x, 0, obs.z);
        obs.group.rotation.y = obs.yaw;
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 2. BAJAJ AUTO-RICKSHAW (Iconic Yellow Roof & Green Lower Body)
  createAutoRickshaw(id, x, z, yaw = 0, speed = 0) {
    const group = new THREE.Group();
    
    // Lower Chassis (Signature Indian Green)
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x0a5c36, roughness: 0.5, metalness: 0.2 });
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 2.7), lowerMat);
    lowerBody.position.y = 0.5;
    lowerBody.castShadow = true;
    group.add(lowerBody);
    
    // Iconic Yellow Roof Canopy
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf5b700, roughness: 0.4 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.65, 1.9), roofMat);
    roof.position.set(0, 1.25, -0.25);
    roof.castShadow = true;
    group.add(roof);
    
    // Open Passenger Cabin Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 });
    const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7);
    const p1 = new THREE.Mesh(pillarGeo, pillarMat);
    p1.position.set(-0.58, 1.05, 0.6);
    const p2 = p1.clone();
    p2.position.x = 0.58;
    group.add(p1);
    group.add(p2);
    
    // 3 Wheels (1 Front Center, 2 Rear)
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.16, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    
    // Front Wheel
    const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    frontWheel.position.set(0, 0.25, 1.05);
    frontWheel.castShadow = true;
    group.add(frontWheel);
    
    // Rear Wheels
    const rearWheelL = new THREE.Mesh(wheelGeo, wheelMat);
    rearWheelL.position.set(-0.62, 0.25, -0.75);
    rearWheelL.castShadow = true;
    const rearWheelR = rearWheelL.clone();
    rearWheelR.position.x = 0.62;
    group.add(rearWheelL);
    group.add(rearWheelR);
    
    // Front Round Headlight
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    light.rotation.x = Math.PI / 2;
    light.position.set(0, 0.75, 1.36);
    group.add(light);
    
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    this.scene.add(group);
    
    // MATLAB Risk Field: a_long = 4.0m, b_lat = 1.8m
    const riskDecal = this.createRiskDecal(4.0, 1.8);
    
    const obs = {
      id,
      classId: 2,
      name: 'Auto-Rickshaw',
      group,
      riskDecal,
      x, z, yaw, speed,
      a_long: 4.0,
      b_lat: 1.8, length: 2.7, width: 1.3, hL: 1.35, hW: 0.65,
      update: (dt) => {
        obs.z += obs.speed * Math.cos(obs.yaw) * dt;
        obs.x += obs.speed * Math.sin(obs.yaw) * dt;
        obs.group.position.set(obs.x, 0, obs.z);
        obs.group.rotation.y = obs.yaw;
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 3. SWARAJ / MAHINDRA SLOW AGRICULTURAL TRACTOR WITH TRAILER
  createTractor(id, x, z, speed = 3.5) {
    const group = new THREE.Group();
    
    // Tractor Hood & Body (Swaraj Red)
    const redMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.5 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 2.2), redMat);
    hood.position.set(0, 1.0, 0.4);
    hood.castShadow = true;
    group.add(hood);
    
    // Giant Cleated Rear Wheels (1.4m diameter)
    const rearWheelGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.35, 18);
    rearWheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.95 });
    
    const rearWL = new THREE.Mesh(rearWheelGeo, tireMat);
    rearWL.position.set(-0.85, 0.7, -0.4);
    rearWL.castShadow = true;
    const rearWR = rearWL.clone();
    rearWR.position.x = 0.85;
    group.add(rearWL);
    group.add(rearWR);
    
    // Smaller Front Guide Wheels
    const frontWheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.22, 16);
    frontWheelGeo.rotateZ(Math.PI / 2);
    const frontWL = new THREE.Mesh(frontWheelGeo, tireMat);
    frontWL.position.set(-0.7, 0.4, 1.2);
    frontWL.castShadow = true;
    const frontWR = frontWL.clone();
    frontWR.position.x = 0.7;
    group.add(frontWL);
    group.add(frontWR);
    
    // Vertical Exhaust Pipe (Smoke Stack)
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9 });
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), exhaustMat);
    exhaust.position.set(0.45, 1.8, 0.9);
    group.add(exhaust);
    
    // Hitched Cargo Trailer / Trolley (Loaded with jute sacks)
    const trailerMat = new THREE.MeshStandardMaterial({ color: 0x2b4c7e, roughness: 0.8 });
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 3.2), trailerMat);
    trailer.position.set(0, 1.0, -3.2);
    trailer.castShadow = true;
    group.add(trailer);
    
    // Trailer Wheels
    const trailerWL = new THREE.Mesh(rearWheelGeo, tireMat);
    trailerWL.scale.set(0.8, 1, 0.8);
    trailerWL.position.set(-1.05, 0.56, -3.4);
    const trailerWR = trailerWL.clone();
    trailerWR.position.x = 1.05;
    group.add(trailerWL);
    group.add(trailerWR);
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    // MATLAB Risk Field: a_long = 5.0m, b_lat = 2.2m (Wide slow obstacle)
    const riskDecal = this.createRiskDecal(5.0, 2.2);
    
    const obs = {
      id,
      classId: 5,
      name: 'Slow Tractor',
      group,
      riskDecal,
      x, z, yaw: 0, speed,
      a_long: 5.0,
      b_lat: 2.2,
      length: 7.2,
      width: 2.4,
      hL: 3.6,
      hW: 1.2,
      update: (dt) => {
        obs.z += obs.speed * dt;
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 4. WOODEN 4-WHEEL PUSHCART (Indian Thela / Vendor)
  createPushcart(id, x, z, speed = 0.5) {
    const group = new THREE.Group();
    
    // Wooden Deck
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c5335, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 2.1), woodMat);
    deck.position.y = 0.65;
    deck.castShadow = true;
    group.add(deck);
    
    // 4 Iron Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    const wheelPositions = [
      [-0.64, 0.3, -0.75],
      [ 0.64, 0.3, -0.75],
      [-0.64, 0.3,  0.75],
      [ 0.64, 0.3,  0.75]
    ];
    wheelPositions.forEach(p => {
      const w = new THREE.Mesh(wheelGeo, ironMat);
      w.position.set(p[0], p[1], p[2]);
      group.add(w);
    });
    
    // Produce Crates on Deck
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x558833, roughness: 0.8 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 1.4), crateMat);
    crate.position.set(0, 0.9, 0);
    group.add(crate);
    
    // Human Pushcart Vendor
    const vendorMat = new THREE.MeshStandardMaterial({ color: 0x4a6572 });
    const vendor = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.3), vendorMat);
    vendor.position.set(0, 1.1, -1.3);
    group.add(vendor);
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    // MATLAB Risk Field: a_long = 2.5m, b_lat = 1.8m
    const riskDecal = this.createRiskDecal(2.5, 1.8);
    
    const obs = {
      id,
      classId: 5,
      name: 'Pushcart Vendor',
      group,
      riskDecal,
      x, z, yaw: 0, speed,
      a_long: 2.5,
      b_lat: 1.8, length: 2.7, width: 1.3, hL: 1.35, hW: 0.65,
      update: (dt) => {
        obs.z += obs.speed * dt;
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 5. PEDESTRIAN (Jaywalking Crosser)
  createPedestrian(id, x, z, vx = 0.8) {
    const group = new THREE.Group();
    
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8d5524 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0x336699 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), skinMat);
    head.position.y = 1.6;
    head.castShadow = true;
    group.add(head);
    
    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.6, 0.22), shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    group.add(torso);
    
    // Legs
    const legGeo = new THREE.BoxGeometry(0.14, 0.75, 0.14);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.1, 0.375, 0);
    leftLeg.castShadow = true;
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.1;
    group.add(leftLeg);
    group.add(rightLeg);
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    // MATLAB Risk Field: a_long = 2.2m, b_lat = 2.2m (Omnidirectional vulnerability)
    const riskDecal = this.createRiskDecal(2.2, 2.2);
    
    const obs = {
      id,
      classId: 6,
      name: 'Pedestrian',
      length: 0.8, width: 0.8, hL: 0.4, hW: 0.4,
      group,
      riskDecal,
      x, z, yaw: Math.PI / 2, vx,
      legs: [leftLeg, rightLeg],
      walkPhase: 0,
      a_long: 2.2,
      b_lat: 2.2,
      update: (dt) => {
        obs.x += obs.vx * dt;
        obs.walkPhase += dt * 6.0;
        obs.legs[0].rotation.x = Math.sin(obs.walkPhase) * 0.45;
        obs.legs[1].rotation.x = -Math.sin(obs.walkPhase) * 0.45;
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 6. TWO-WHEELER / MOTORCYCLE (Lane Filtering & Gap Squeezing)
  createTwoWheeler(id, x, z, yaw = 0, speed = 6.5) {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd90429, roughness: 0.3, metalness: 0.8 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    
    // Bike Frame Body
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 1.4), frameMat);
    frame.position.y = 0.55;
    frame.castShadow = true;
    group.add(frame);
    
    // Front & Rear Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wFront = new THREE.Mesh(wheelGeo, tireMat);
    wFront.position.set(0, 0.28, 0.65);
    const wRear = new THREE.Mesh(wheelGeo, tireMat);
    wRear.position.set(0, 0.28, -0.65);
    group.add(wFront);
    group.add(wRear);
    
    // Handlebars
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65), frameMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.85, 0.45);
    group.add(bar);
    
    // Rider with Helmet
    const riderMat = new THREE.MeshStandardMaterial({ color: 0x2b2d42 });
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.75, 0.4), riderMat);
    rider.position.set(0, 0.95, -0.1);
    group.add(rider);
    
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffd166 }));
    helmet.position.set(0, 1.42, 0.05);
    group.add(helmet);
    
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    this.scene.add(group);
    
    const riskDecal = this.createRiskDecal(3.8, 1.6);
    
    const obs = {
      id,
      classId: 3,
      name: 'Two-Wheeler (Motorcycle)',
      group,
      riskDecal,
      x, z, yaw, speed,
      a_long: 3.8, b_lat: 1.6, length: 1.9, width: 0.8, hL: 0.95, hW: 0.4,
      update: (dt) => {
        obs.z += obs.speed * Math.cos(obs.yaw) * dt;
        obs.x += obs.speed * Math.sin(obs.yaw) * dt;
        obs.group.position.set(obs.x, 0, obs.z);
        obs.group.rotation.y = obs.yaw;
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 7. SEVERE ROAD CRATER / POTHOLE
  createPothole(id, x, z, radius = 0.85) {
    const group = new THREE.Group();
    // Dark Cavity Decal directly on asphalt
    const holeGeo = new THREE.CircleGeometry(radius, 24);
    holeGeo.rotateX(-Math.PI / 2);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const holeMesh = new THREE.Mesh(holeGeo, holeMat);
    holeMesh.position.y = 0.02;
    group.add(holeMesh);
    
    // Fractured Rim Texture Ring
    const rimGeo = new THREE.RingGeometry(radius * 0.9, radius * 1.25, 24);
    rimGeo.rotateX(-Math.PI / 2);
    const rimMat = new THREE.MeshBasicMaterial({ color: 0x2a2215 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.025;
    group.add(rimMesh);
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    const riskDecal = this.createRiskDecal(2.2, 1.8);
    
    const obs = {
      id,
      classId: 7,
      name: 'Severe Road Crater (Pothole)',
      group,
      riskDecal,
      x, z, yaw: 0, speed: 0,
      a_long: 2.2, b_lat: 1.8, length: radius * 2, width: radius * 2, hL: radius, hW: radius,
      update: () => {
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 8. CONSTRUCTION ZONE BARRICADES
  createConstructionBarricade(id, x, z) {
    const group = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.4 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 });
    
    // Main Orange Barricade Board
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 0.1), barMat);
    board.position.y = 0.75;
    group.add(board);
    
    // Reflective Diagonal Stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.46, 0.11), stripeMat);
    stripe.position.set(-0.35, 0.75, 0);
    stripe.rotation.z = Math.PI / 4;
    group.add(stripe);
    const stripe2 = stripe.clone();
    stripe2.position.x = 0.35;
    group.add(stripe2);
    
    // A-Frame Legs
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), legMat);
    leg1.position.set(-0.75, 0.45, 0);
    const leg2 = leg1.clone();
    leg2.position.x = 0.75;
    group.add(leg1);
    group.add(leg2);
    
    // Amber Warning Strobe
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    strobe.position.set(0, 1.05, 0);
    group.add(strobe);
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    const riskDecal = this.createRiskDecal(2.8, 2.0);
    
    const obs = {
      id,
      classId: 8,
      name: 'Construction Barricade',
      group,
      riskDecal,
      x, z, yaw: 0, speed: 0,
      a_long: 2.8, b_lat: 2.0, length: 1.0, width: 2.0, hL: 0.5, hW: 1.0,
      update: () => {
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 9. UNMARKED SPEED BREAKER / ROAD BUMP
  createSpeedBreaker(id, x, z) {
    const group = new THREE.Group();
    // Curved Asphalt Elevation across right travel lane (width 3.4m, span 1.2m)
    const bumpGeo = new THREE.CylinderGeometry(0.6, 0.6, 3.4, 16, 1, false, 0, Math.PI);
    bumpGeo.rotateZ(Math.PI / 2);
    bumpGeo.rotateY(Math.PI / 2);
    const bumpMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const bump = new THREE.Mesh(bumpGeo, bumpMat);
    bump.scale.set(1.0, 0.18, 1.0);
    bump.position.y = 0.05;
    group.add(bump);
    
    // Yellow Warning Chevron Stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    for (let i = -1.2; i <= 1.2; i += 0.6) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.8), stripeMat);
      s.position.set(i, 0.1, 0);
      group.add(s);
    }
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    const riskDecal = this.createRiskDecal(2.5, 2.2);
    riskDecal.visible = false; // Speed breakers are road vertical features, no repulsive danger bubble ring
    
    const obs = {
      id,
      classId: 9,
      name: 'Speed Breaker',
      group,
      riskDecal,
      x, z, yaw: 0, speed: 0,
      a_long: 2.5, b_lat: 2.2, length: 1.2, width: 3.4, hL: 0.6, hW: 1.7,
      update: () => {
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // 10. STALLED / DISABLED VEHICLE
  createStalledVehicle(id, x, z) {
    const group = new THREE.Group();
    // Broken Down Maruti Sedan with hazard indicators
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 4.4), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);
    
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 2.2), new THREE.MeshStandardMaterial({ color: 0x111622 }));
    cabin.position.set(0, 1.1, -0.3);
    group.add(cabin);
    
    // Open Hood / Bonnet (Simulating Engine Failure)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.1), bodyMat);
    hood.position.set(0, 1.15, 1.3);
    hood.rotation.x = -Math.PI / 5;
    group.add(hood);
    
    // Blinking Hazard Warning Lights
    const hazardMat = new THREE.MeshBasicMaterial({ color: 0xff8800 });
    const hazL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), hazardMat);
    hazL.position.set(-0.85, 0.6, -2.2);
    const hazR = hazL.clone();
    hazR.position.x = 0.85;
    group.add(hazL);
    group.add(hazR);
    
    group.position.set(x, 0, z);
    this.scene.add(group);
    
    const riskDecal = this.createRiskDecal(4.8, 2.2);
    
    const obs = {
      id,
      classId: 1,
      name: 'Stalled Disabled Vehicle',
      group,
      riskDecal,
      x, z, yaw: 0, speed: 0,
      hazLights: [hazL, hazR],
      a_long: 4.8, b_lat: 2.2, length: 4.4, width: 1.8, hL: 2.2, hW: 0.9,
      update: () => {
        const blink = Math.sin(performance.now() * 0.01) > 0;
        obs.hazLights.forEach(l => l.visible = blink);
        obs.group.position.set(obs.x, 0, obs.z);
        obs.riskDecal.position.set(obs.x, 0.04, obs.z);
      }
    };
    this.obstacles.push(obs);
    return obs;
  }
  
  // Ambient Incoming Indian Traffic (Driving Southbound in Left-Side Lane: x = +1.85m)
  spawnOncomingTraffic(zCenter, speed = -8.0) {
    const truck = new THREE.Group();
    // Authentic Indian Tata 1613 Truck in Right Lane
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1177bb, roughness: 0.6 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.4, 2.2), cabinMat);
    cabin.position.y = 1.6;
    cabin.castShadow = true;
    truck.add(cabin);
    
    const cargoMat = new THREE.MeshStandardMaterial({ color: 0xcc8833, roughness: 0.8 });
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.2, 5.5), cargoMat);
    cargo.position.set(0, 1.7, -3.8);
    cargo.castShadow = true;
    truck.add(cargo);
    
    truck.position.set(1.85, 0, zCenter);
    truck.rotation.y = Math.PI; // Heading opposite
    this.scene.add(truck);
    
    const truckActor = {
      id: 99,
      name: 'Tata 1613 Heavy Truck',
      classId: 1,
      x: 1.85,
      z: zCenter,
      speed: speed,
      length: 8.0,
      width: 2.4,
      hL: 4.0,
      hW: 1.2,
      a_long: 8.0,
      b_lat: 2.4,
      group: truck,
      update: function(dt) {
        truck.position.z += this.speed * dt;
        this.z = truck.position.z;
      }
    };
    this.ambientCars.push(truckActor);
  }
  
  updateAll(dt, egoVehicle) {
    this.obstacles.forEach(obs => {
      obs.update(dt);
      
      // Update Risk Decal Visual Threat Intensity based on ego vehicle distance
      const dx = egoVehicle.x - obs.x;
      const dz = egoVehicle.z - obs.z;
      const dNorm = Math.sqrt(Math.pow(dz / obs.a_long, 2) + Math.pow(dx / obs.b_lat, 2));
      
      if (dNorm < 1.0) {
        // Core Collision Bubble: Intense Pulsing Red
        obs.riskDecal.material.color.setHex(0xff0033);
        obs.riskDecal.material.opacity = 0.95;
      } else if (dNorm < 2.5) {
        // Danger Buffer: Electric Amber
        obs.riskDecal.material.color.setHex(0xffaa00);
        obs.riskDecal.material.opacity = 0.75;
      } else {
        // Safe Distance: Neon Emerald
        obs.riskDecal.material.color.setHex(0x00ff88);
        obs.riskDecal.material.opacity = 0.45;
      }
    });
    
    this.ambientCars.forEach(car => car.update(dt));
  }
}
