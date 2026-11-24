// 3D Environment, Procedural Road Textures, Bridge Architecture, Realistic Lighting, & Camera Rig
class World3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    
    // Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a101f);
    this.scene.fog = new THREE.FogExp2(0x0a101f, 0.005);
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1200
    );
    this.activeCameraMode = 'CHASE'; // 'CHASE', 'COCKPIT', 'BIRDSEYE', 'ORBIT'
    
    // Orbit Controls State (Offline & Smooth)
    this.orbit = {
      isDragging: false,
      prevX: 0,
      prevY: 0,
      theta: 0, // Azimuth
      phi: Math.PI / 4, // Elevation
      radius: 18.0,
      target: new THREE.Vector3(0, 1.0, 0)
    };
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);
    
    // Road & Geometry Specs (Indian 2-lane Highway: 7.4m width, Left lane [-3.7, 0], Right [+3.7])
    this.roadWidth = 7.4;
    this.roadLength = 700;
    this.isBridgeMode = false;
    this.activeWeather = 'DAY';
    this.currentWeather = 'DAY';
    
    // Setup Subsystems
    this.setupLighting();
    this.buildTerrainAndHighway();
    this.buildRoadsideInfrastructure();
    this.buildBridgeStructures();
    this.setupTrajectoryVisualizers();
    this.setupRainSystem();
    this.setupMouseEvents();
    
    // Window Resize
    window.addEventListener('resize', () => this.onWindowResize());
  }
  
  setupLighting() {
    // Ambient Light
    this.ambientLight = new THREE.AmbientLight(0xddeeff, 0.65);
    this.scene.add(this.ambientLight);
    
    // Directional Sunlight with Shadows
    this.sunLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    this.sunLight.position.set(45, 80, 40);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 280;
    this.sunLight.shadow.camera.left = -60;
    this.sunLight.shadow.camera.right = 60;
    this.sunLight.shadow.camera.top = 60;
    this.sunLight.shadow.camera.bottom = -60;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    
    // Hemisphere Sky/Ground Light
    this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d3020, 0.5);
    this.scene.add(this.hemiLight);
  }
  
  setWeather(mode) {
    this.activeWeather = mode;
    this.currentWeather = mode;
    switch (mode) {
      case 'DAY':
        this.scene.background = new THREE.Color(0x8ec5fc);
        this.scene.fog = new THREE.FogExp2(0xcfe4ff, 0.0035);
        this.ambientLight.color.setHex(0xe8f0ff);
        this.ambientLight.intensity = 0.7;
        this.sunLight.color.setHex(0xfffaed);
        this.sunLight.intensity = 1.4;
        this.sunLight.position.set(45, 80, 40);
        this.roadMat.roughness = 0.88;
        this.roadMat.metalness = 0.12;
        if (this.rainParticles) this.rainParticles.visible = false;
        break;
        
      case 'SUNSET':
        this.scene.background = new THREE.Color(0x3a1c28);
        this.scene.fog = new THREE.FogExp2(0x4a2228, 0.0045);
        this.ambientLight.color.setHex(0xffaa88);
        this.ambientLight.intensity = 0.5;
        this.sunLight.color.setHex(0xff7733);
        this.sunLight.intensity = 1.9;
        this.sunLight.position.set(70, 25, 20);
        this.roadMat.roughness = 0.85;
        this.roadMat.metalness = 0.15;
        if (this.rainParticles) this.rainParticles.visible = false;
        break;
        
      case 'RAIN':
        this.scene.background = new THREE.Color(0x131a26);
        this.scene.fog = new THREE.FogExp2(0x131a26, 0.007);
        this.ambientLight.color.setHex(0x6688aa);
        this.ambientLight.intensity = 0.45;
        this.sunLight.color.setHex(0x99bbdd);
        this.sunLight.intensity = 0.6;
        this.roadMat.roughness = 0.35; // Wet reflective road
        this.roadMat.metalness = 0.45;
        if (this.rainParticles) this.rainParticles.visible = true;
        break;
        
      case 'NIGHT':
        this.scene.background = new THREE.Color(0x05070f);
        this.scene.fog = new THREE.FogExp2(0x05070f, 0.008);
        this.ambientLight.color.setHex(0x1a2233);
        this.ambientLight.intensity = 0.25;
        this.sunLight.color.setHex(0x446688);
        this.sunLight.intensity = 0.3;
        this.roadMat.roughness = 0.85;
        this.roadMat.metalness = 0.15;
        if (this.rainParticles) this.rainParticles.visible = false;
        break;
    }
  }
  
  buildTerrainAndHighway() {
    // 1. Surrounding Earth / Terrain
    const terrainGeo = new THREE.PlaneGeometry(500, this.roadLength, 32, 64);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x1b281d,
      roughness: 0.95,
      metalness: 0.05
    });
    this.terrain = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrain.position.set(0, -0.06, this.roadLength / 2 - 50);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    
    // 2. High-Fidelity Asphalt Highway (Procedural Texture)
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 1024;
    const ctx = roadCanvas.getContext('2d');
    
    // Base Asphalt Noise
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, 512, 1024);
    
    // Subtle asphalt speckling
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 1024;
      const c = Math.floor(25 + Math.random() * 25);
      ctx.fillStyle = `rgb(${c},${c},${c})`;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    
    // Center Dashed White/Yellow Line (Separator between Left Travel Lane and Right Oncoming Lane)
    ctx.fillStyle = '#ffcc00';
    const dashLen = 64;
    const gapLen = 48;
    for (let y = 0; y < 1024; y += dashLen + gapLen) {
      ctx.fillRect(252, y, 8, dashLen);
    }
    
    // Solid Edge Lines (Right Shoulder: x=16, Left Shoulder: x=488)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(16, 0, 8, 1024);
    ctx.fillRect(488, 0, 8, 1024);
    
    // Painted "TRAVEL LANE" road marking on Right-Side Travel Lane (x = 134 in texture => -1.85m in 3D)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(134, 300);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('▲ TRAVEL LANE', 0, 0);
    ctx.restore();
    
    ctx.save();
    ctx.translate(134, 800);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('▲ TRAVEL LANE', 0, 0);
    ctx.restore();

    // Incoming Lane Road Markings (x = 378 in texture => +1.85m in 3D)
    ctx.save();
    ctx.translate(378, 500);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('▲ INCOMING', 0, 0);
    ctx.restore();
    
    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;
    roadTexture.repeat.set(1, this.roadLength / 25);
    
    this.roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.88,
      metalness: 0.12
    });
    
    const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
    roadGeo.rotateX(-Math.PI / 2);
    this.roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    this.roadMesh.position.set(0, 0, this.roadLength / 2 - 50);
    this.roadMesh.receiveShadow = true;
    this.scene.add(this.roadMesh);
    
    // 3. Indian Alternating Yellow & Black Curbstones
    this.buildCurbstones();
    
    // 4. Dirt/Gravel Shoulders (2.4m wide)
    const shoulderGeo = new THREE.PlaneGeometry(2.4, this.roadLength);
    shoulderGeo.rotateX(-Math.PI / 2);
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.98,
      metalness: 0.02
    });
    
    // Left Shoulder (adjacent to Left Travel Lane: x > 0)
    this.leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    this.leftShoulder.position.set(this.roadWidth / 2 + 1.2, -0.015, this.roadLength / 2 - 50);
    this.leftShoulder.receiveShadow = true;
    this.scene.add(this.leftShoulder);
    
    // Right Shoulder (adjacent to Right Oncoming Lane: x < 0)
    this.rightShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    this.rightShoulder.position.set(-this.roadWidth / 2 - 1.2, -0.015, this.roadLength / 2 - 50);
    this.rightShoulder.receiveShadow = true;
    this.scene.add(this.rightShoulder);
  }
  
  buildCurbstones() {
    const curbGeo = new THREE.BoxGeometry(0.25, 0.16, 1.8);
    const matYellow = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.9 });
    const matBlack  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    
    this.curbGroup = new THREE.Group();
    for (let z = -50; z < this.roadLength - 50; z += 1.8) {
      const isYellow = Math.floor((z + 50) / 1.8) % 2 === 0;
      const mat = isYellow ? matYellow : matBlack;
      
      // Left curb (along Left Travel Lane edge)
      const leftCurb = new THREE.Mesh(curbGeo, mat);
      leftCurb.position.set(this.roadWidth / 2 + 0.12, 0.08, z);
      this.curbGroup.add(leftCurb);
      
      // Right curb (along Right Oncoming Lane edge)
      const rightCurb = new THREE.Mesh(curbGeo, mat);
      rightCurb.position.set(-this.roadWidth / 2 - 0.12, 0.08, z);
      this.curbGroup.add(rightCurb);
    }
    this.scene.add(this.curbGroup);
  }
  
  buildRoadsideInfrastructure() {
    this.infraGroup = new THREE.Group();
    
    // 1. Roadside Utility Poles with Sagging Cables
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.9 });
    const crossGeo = new THREE.BoxGeometry(1.6, 0.1, 0.1);
    
    for (let z = 0; z < this.roadLength; z += 65) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(this.roadWidth / 2 + 4.5, 3.75, z);
      pole.castShadow = true;
      
      const crossarm = new THREE.Mesh(crossGeo, poleMat);
      crossarm.position.set(0, 3.2, 0);
      pole.add(crossarm);
      
      this.infraGroup.add(pole);
    }
    
    // 2. Roadside Trees & Vegetation
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 3.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.95 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x225522, roughness: 0.9 });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x1b441b, roughness: 0.9 });
    
    for (let z = 10; z < this.roadLength - 50; z += 30) {
      // Left side trees
      const xL = -this.roadWidth / 2 - 7.0 - Math.random() * 6;
      const treeL = new THREE.Group();
      treeL.position.set(xL, 0, z);
      
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      treeL.add(trunk);
      
      const foliageGeo = new THREE.DodecahedronGeometry(2.4 + Math.random() * 0.8);
      const foliage = new THREE.Mesh(foliageGeo, Math.random() > 0.5 ? foliageMat1 : foliageMat2);
      foliage.position.y = 4.2;
      foliage.castShadow = true;
      treeL.add(foliage);
      this.infraGroup.add(treeL);
      
      // Right side trees
      const xR = this.roadWidth / 2 + 7.0 + Math.random() * 6;
      const treeR = treeL.clone();
      treeR.position.set(xR, 0, z + 15);
      this.infraGroup.add(treeR);
    }
    
    // 3. Indian Highway Overhead Gantry Sign (at z = 140m)
    this.buildGantrySign(140);
    
    // 4. Milestone Marker (at z = 30m)
    this.buildMilestone(-this.roadWidth / 2 - 1.8, 30);
    
    this.scene.add(this.infraGroup);
  }
  
  buildGantrySign(zPos) {
    const gantry = new THREE.Group();
    gantry.position.set(0, 0, zPos);
    
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x48505e, metalness: 0.8, roughness: 0.3 });
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.22, 6.5, 12);
    
    const leftPillar = new THREE.Mesh(pillarGeo, steelMat);
    leftPillar.position.set(-this.roadWidth / 2 - 1.8, 3.25, 0);
    leftPillar.castShadow = true;
    gantry.add(leftPillar);
    
    const rightPillar = new THREE.Mesh(pillarGeo, steelMat);
    rightPillar.position.set(this.roadWidth / 2 + 1.8, 3.25, 0);
    rightPillar.castShadow = true;
    gantry.add(rightPillar);
    
    // Cross Beam
    const beamGeo = new THREE.BoxGeometry(this.roadWidth + 4.0, 0.35, 0.35);
    const crossBeam = new THREE.Mesh(beamGeo, steelMat);
    crossBeam.position.set(0, 6.2, 0);
    gantry.add(crossBeam);
    
    // Green Retroreflective Sign Board
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 160;
    const sCtx = signCanvas.getContext('2d');
    
    sCtx.fillStyle = '#0b6623'; // Indian Highway Green
    sCtx.fillRect(0, 0, 512, 160);
    sCtx.strokeStyle = '#ffffff';
    sCtx.lineWidth = 6;
    sCtx.strokeRect(8, 8, 496, 144);
    
    sCtx.fillStyle = '#ffffff';
    sCtx.font = 'bold 22px Arial';
    sCtx.textAlign = 'center';
    sCtx.fillText('NH-44 NATIONAL HIGHWAY', 256, 42);
    sCtx.font = 'bold 26px Arial';
    sCtx.fillText('HYDERABAD 180 KM  |  BENGALURU 420 KM', 256, 88);
    sCtx.fillStyle = '#ffcc00';
    sCtx.font = 'bold 16px Arial';
    sCtx.fillText('RIGHT: TRAVEL LANE  |  LEFT: INCOMING  |  SPEED: 60 KM/H', 256, 130);
    
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.6, 0.15), signMat);
    signBoard.position.set(0, 6.2, -0.2);
    gantry.add(signBoard);
    
    this.infraGroup.add(gantry);
  }
  
  buildMilestone(xPos, zPos) {
    const msGroup = new THREE.Group();
    msGroup.position.set(xPos, 0, zPos);
    
    // Lower body (white)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.7, 16), bodyMat);
    body.position.y = 0.35;
    msGroup.add(body);
    
    // Upper dome (National Highway Yellow)
    const domeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.85 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.7;
    msGroup.add(dome);
    
    this.infraGroup.add(msGroup);
  }
  
  buildBridgeStructures() {
    this.bridgeGroup = new THREE.Group();
    this.bridgeGroup.visible = false;
    
    const bridgeLength = 220;
    const bridgeZCenter = 80;
    
    // Concrete Parapet Barriers (Walls with yellow/black hazard diagonal stripes)
    const barrierGeo = new THREE.BoxGeometry(0.35, 1.25, bridgeLength);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8a909a, roughness: 0.85 });
    
    // Left barrier
    this.leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    this.leftBarrier.position.set(-this.roadWidth / 2 - 0.2, 0.625, bridgeZCenter);
    this.leftBarrier.castShadow = true;
    this.bridgeGroup.add(this.leftBarrier);
    
    // Right barrier
    this.rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
    this.rightBarrier.position.set(this.roadWidth / 2 + 0.2, 0.625, bridgeZCenter);
    this.rightBarrier.castShadow = true;
    this.bridgeGroup.add(this.rightBarrier);
    
    // Steel Arch Truss Framework Overhead
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.8, roughness: 0.3 });
    for (let z = bridgeZCenter - bridgeLength / 2; z <= bridgeZCenter + bridgeLength / 2; z += 30) {
      const arch = new THREE.Group();
      arch.position.set(0, 0, z);
      
      const beamL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8.0), trussMat);
      beamL.position.set(-this.roadWidth / 2 - 0.2, 4.0, 0);
      arch.add(beamL);
      
      const beamR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8.0), trussMat);
      beamR.position.set(this.roadWidth / 2 + 0.2, 4.0, 0);
      arch.add(beamR);
      
      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(this.roadWidth + 1.2, 0.35, 0.35), trussMat);
      topBeam.position.set(0, 8.0, 0);
      arch.add(topBeam);
      
      this.bridgeGroup.add(arch);
    }
    
    // Deep River Water Surface Beneath Bridge
    const waterGeo = new THREE.PlaneGeometry(160, bridgeLength);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x113355,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.set(0, -6.5, bridgeZCenter);
    this.bridgeGroup.add(this.waterMesh);
    
    this.scene.add(this.bridgeGroup);
  }
  
  setBridgeMode(enabled) {
    this.isBridgeMode = enabled;
    this.bridgeGroup.visible = enabled;
    this.curbGroup.visible = !enabled;
    this.infraGroup.visible = !enabled;
    
    if (enabled) {
      this.leftShoulder.position.y = -7.0;
      this.rightShoulder.position.y = -7.0;
      this.terrain.position.y = -7.0;
    } else {
      this.leftShoulder.position.y = -0.015;
      this.rightShoulder.position.y = -0.015;
      this.terrain.position.y = -0.06;
    }
  }
  
  setupTrajectoryVisualizers() {
    // 1. Optimal Trajectory Ribbon (Glowing Neon Cyan)
    this.ribbonPoints = 30;
    this.ribbonGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.ribbonPoints * 2 * 3);
    this.ribbonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const indices = [];
    for (let i = 0; i < this.ribbonPoints - 1; i++) {
      const p1 = i * 2;
      const p2 = p1 + 1;
      const p3 = p1 + 2;
      const p4 = p1 + 3;
      indices.push(p1, p2, p3, p2, p4, p3);
    }
    this.ribbonGeo.setIndex(indices);
    
    this.ribbonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    this.ribbonMesh = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    this.ribbonMesh.position.y = 0.08;
    this.scene.add(this.ribbonMesh);
    
    // 2. Candidate Trajectory Search Fan (Translucent lines showing path search space)
    this.candidateFanLines = [];
    const fanMat = new THREE.LineBasicMaterial({
      color: 0x00a8ff,
      transparent: true,
      opacity: 0.25
    });
    for (let c = 0; c < 7; c++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(this.ribbonPoints * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, fanMat);
      line.position.y = 0.06;
      this.scene.add(line);
      this.candidateFanLines.push(line);
    }
  }
  
  updateTrajectory(trajectory, candidateTrajectories = []) {
    if (!trajectory || trajectory.length < 2) return;
    
    const width = 0.55;
    const posAttr = this.ribbonGeo.attributes.position;
    const N = Math.min(this.ribbonPoints, trajectory.length);
    
    for (let i = 0; i < N; i++) {
      const pt = trajectory[i];
      let nx = 1, nz = 0;
      if (i < N - 1) {
        const next = trajectory[i + 1];
        const dx = next.x - pt.x;
        const dz = next.z - pt.z;
        const len = Math.hypot(dx, dz) || 1;
        nx = -dz / len;
        nz =  dx / len;
      }
      
      const v1 = i * 2;
      const v2 = v1 + 1;
      posAttr.setXYZ(v1, pt.x - nx * width, 0, pt.z - nz * width);
      posAttr.setXYZ(v2, pt.x + nx * width, 0, pt.z + nz * width);
    }
    posAttr.needsUpdate = true;
    
    // Update candidate fan search lines
    candidateTrajectories.forEach((traj, idx) => {
      if (idx < this.candidateFanLines.length && traj.length >= 2) {
        const line = this.candidateFanLines[idx];
        const cPos = line.geometry.attributes.position;
        const count = Math.min(this.ribbonPoints, traj.length);
        for (let i = 0; i < count; i++) {
          cPos.setXYZ(i, traj[i].x, 0, traj[i].z);
        }
        cPos.needsUpdate = true;
      }
    });
  }
  
  setupRainSystem() {
    const rainCount = 1800;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    
    for (let i = 0; i < rainCount * 3; i += 3) {
      rainPos[i] = (Math.random() - 0.5) * 80;
      rainPos[i + 1] = Math.random() * 40;
      rainPos[i + 2] = (Math.random() - 0.5) * 80;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    
    const rainMat = new THREE.PointsMaterial({
      color: 0x99bbdd,
      size: 0.18,
      transparent: true,
      opacity: 0.65
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);
  }
  
  updateRain(egoZ) {
    if (!this.rainParticles || !this.rainParticles.visible) return;
    const pos = this.rainParticles.geometry.attributes.position;
    for (let i = 1; i < pos.count * 3; i += 3) {
      pos.array[i] -= 1.6;
      if (pos.array[i] < 0) {
        pos.array[i] = 40;
      }
    }
    this.rainParticles.position.z = egoZ;
    pos.needsUpdate = true;
  }
  
  setupMouseEvents() {
    const dom = this.renderer.domElement;
    
    dom.addEventListener('mousedown', (e) => {
      this.orbit.isDragging = true;
      this.orbit.prevX = e.clientX;
      this.orbit.prevY = e.clientY;
    });
    
    window.addEventListener('mouseup', () => {
      this.orbit.isDragging = false;
    });
    
    dom.addEventListener('mousemove', (e) => {
      if (!this.orbit.isDragging) return;
      const dx = e.clientX - this.orbit.prevX;
      const dy = e.clientY - this.orbit.prevY;
      this.orbit.prevX = e.clientX;
      this.orbit.prevY = e.clientY;
      
      this.orbit.theta -= dx * 0.008;
      this.orbit.phi = Math.max(0.1, Math.min(Math.PI / 2.1, this.orbit.phi + dy * 0.008));
    });
    
    dom.addEventListener('wheel', (e) => {
      this.orbit.radius = Math.max(5.0, Math.min(60.0, this.orbit.radius + e.deltaY * 0.02));
      e.preventDefault();
    }, { passive: false });
  }
  
  updateCamera(egoVehicle) {
    const vx = egoVehicle.x;
    const vz = egoVehicle.z;
    const vy = egoVehicle.y;
    const yaw = egoVehicle.yaw;
    
    switch (this.activeCameraMode) {
      case 'CHASE':
        // Smooth third-person chase cam with interactive look-around
        const chaseDist = this.orbit.radius ? Math.min(20, Math.max(7, this.orbit.radius * 0.55)) : 9.5;
        const chaseHeight = 3.8 + (this.orbit.phi - Math.PI / 4) * 3.0;
        const targetCamX = vx - chaseDist * Math.sin(yaw + this.orbit.theta * 0.4);
        const targetCamZ = vz - chaseDist * Math.cos(yaw + this.orbit.theta * 0.4);
        const targetCamY = vy + Math.max(1.5, chaseHeight);
        
        this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.14);
        this.camera.lookAt(vx, vy + 1.2, vz + 14.0 * Math.cos(yaw));
        break;
        
      case 'COCKPIT':
        // Driver's eye view from front-right/left seat looking through windshield
        const eyeX = vx - 0.35 * Math.cos(yaw);
        const eyeZ = vz + 0.35 * Math.sin(yaw);
        const eyeY = vy + 1.25;
        this.camera.position.set(eyeX, eyeY, eyeZ);
        this.camera.lookAt(vx + 40 * Math.sin(yaw), eyeY - 0.05, vz + 40 * Math.cos(yaw));
        break;
        
      case 'BIRDSEYE':
        // Overhead orthographic/perspective radar view
        this.camera.position.set(vx, vy + 48, vz + 12);
        this.camera.lookAt(vx, vy, vz + 12);
        break;
        
      case 'ORBIT':
        // Interactive 360° free orbit camera
        this.orbit.target.set(vx, vy + 1.0, vz);
        const ox = this.orbit.target.x + this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
        const oy = this.orbit.target.y + this.orbit.radius * Math.cos(this.orbit.phi);
        const oz = this.orbit.target.z + this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);
        this.camera.position.set(ox, oy, oz);
        this.camera.lookAt(this.orbit.target);
        break;
    }
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
