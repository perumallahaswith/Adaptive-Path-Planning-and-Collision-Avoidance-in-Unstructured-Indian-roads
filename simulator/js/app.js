// Master Application Orchestrator & Live Telemetry Telematics (MathWorks SIH-26037)
let world, egoVehicle, obstacleManager, brain, cvHUD;
let activeScenarioData = null;
let isPaused = false;
let simSpeedMultiplier = 1.0;
let lastTime = performance.now();
let lastPlanResult = null;

// Runtime safety evidence for the currently selected digital-twin scenario.
// It records physical contact checks rather than presenting a permanent
// "100% safe" badge that cannot be justified outside this simulation.
let runSafety = null;

function resetRunSafety() {
  runSafety = {
    contactEvents: 0,
    contactLatched: false,
    minClearance: Infinity,
    boundaryMaintained: true,
    fallbackCount: 0,
    speedGovernedSeen: false,
    statesSeen: new Set(),
    phaseTimeline: []
  };
}

function hasPhysicalContact(ego, actor) {
  if (!actor || actor.classId === 9 || actor.classId === '9' || (actor.name && /speed|breaker|bump/i.test(actor.name))) return false;
  const actorHL = actor.hL || (actor.a_long ? actor.a_long * 0.65 : 1.2);
  const actorHW = actor.hW || (actor.b_lat ? actor.b_lat * 0.55 : 0.75);
  return Math.abs(actor.z - ego.z) <= (ego.hL + actorHL) &&
    Math.abs(actor.x - ego.x) <= (ego.hW + actorHW);
}

function updateRunSafety(planResult) {
  if (!runSafety || !egoVehicle || !obstacleManager) return runSafety;
  const actors = [...obstacleManager.obstacles, ...obstacleManager.ambientCars];
  const inContact = actors.some(actor => hasPhysicalContact(egoVehicle, actor));
  if (inContact && !runSafety.contactLatched) runSafety.contactEvents += 1;
  runSafety.contactLatched = inContact;
  runSafety.boundaryMaintained = runSafety.boundaryMaintained &&
    (egoVehicle.x - egoVehicle.hW >= -3.6501) &&
    (egoVehicle.x + egoVehicle.hW <= 3.6501);
  if (planResult && Number.isFinite(planResult.minDist)) runSafety.minClearance = Math.min(runSafety.minClearance, planResult.minDist);
  if (planResult && planResult.safetyFallback) runSafety.fallbackCount += 1;
  if (planResult && planResult.speedGoverned) runSafety.speedGovernedSeen = true;
  if (planResult && planResult.activeState) {
    runSafety.statesSeen.add(planResult.activeState);
    const lastPhase = runSafety.phaseTimeline[runSafety.phaseTimeline.length - 1];
    if (lastPhase !== planResult.activeState) runSafety.phaseTimeline.push(planResult.activeState);
  }
  return runSafety;
}

function scenarioSnapshot() {
  const policy = activeScenarioData?.policy || {};
  return {
    scenario: activeScenarioData?.id || 'none',
    expectedState: policy.expectedState || 'CRUISE',
    state: lastPlanResult?.activeState || brain?.activeState || 'none',
    targetSpeed: lastPlanResult?.targetSpeed ?? brain?.targetSpeed ?? 0,
    speedGoverned: Boolean(lastPlanResult?.speedGoverned),
    speedGovernedSeen: Boolean(runSafety?.speedGovernedSeen),
    policyInRange: Boolean(lastPlanResult?.policyInRange),
    statesSeen: runSafety ? [...runSafety.statesSeen] : [],
    phaseTimeline: runSafety?.phaseTimeline || [],
    gapCertificate: lastPlanResult?.gapCertificate || null,
    trajectorySafety: lastPlanResult?.trajectorySafety || null,
    contactEvents: runSafety?.contactEvents ?? 0,
    boundaryMaintained: runSafety?.boundaryMaintained ?? false,
    fallbackCount: runSafety?.fallbackCount ?? 0,
    minClearance: Number.isFinite(runSafety?.minClearance) ? runSafety.minClearance : null,
    ego: egoVehicle ? { x: egoVehicle.x, z: egoVehicle.z, speed: egoVehicle.speed } : null
  };
}

function runScenarioSafetyProbe(scenarioId, steps = 260, dt = 0.05) {
  const priorPaused = isPaused;
  const priorManual = isManualMode;
  isPaused = true;
  setManualMode(false);
  switchScenario(scenarioId);

  for (let index = 0; index < steps; index += 1) {
    if (activeScenarioData?.onUpdate) activeScenarioData.onUpdate(egoVehicle.z, dt);
    obstacleManager.updateAll(dt, egoVehicle);
    const plan = brain.step(
      egoVehicle,
      obstacleManager.obstacles,
      dt,
      Boolean(activeScenarioData?.isBridge),
      obstacleManager.ambientCars,
      world.currentWeather || 'DAY',
      activeScenarioData?.policy
    );
    egoVehicle.setSafetyPlan(plan);
    egoVehicle.update(dt, plan.steerCmd, plan.accCmd, [...obstacleManager.obstacles, ...obstacleManager.ambientCars]);
    lastPlanResult = plan;
    updateRunSafety(plan);
  }

  isPaused = priorPaused;
  setManualMode(priorManual);
  return scenarioSnapshot();
}

// Uses the exact same factory called by the Trigger Hazard button and the
// Spawn Obstacle selector. It gives the local regression suite a deterministic
// way to verify that manually injected objects receive the shared safety logic.
function runInjectedHazardProbe(type, steps = 320, dt = 0.05) {
  const priorPaused = isPaused;
  const priorManual = isManualMode;
  isPaused = true;
  setManualMode(false);
  obstacleManager.clear();
  world.setBridgeMode(false);
  world.setWeather('DAY');
  egoVehicle.setPosition(-1.85, 0, 0, 10.0);
  activeScenarioData = {
    id: 'injected_' + type,
    title: 'Injected hazard: ' + type,
    isBridge: false,
    policy: { expectedState: 'CRUISE', intent: 'INJECTED_HAZARD', engageDistance: 45, label: 'Injected hazard uses shared safety logic' },
    onUpdate: () => {}
  };
  brain.activeState = 'CRUISE';
  brain.targetSpeed = egoVehicle.speed;
  brain.dwellTime = 0;
  brain.passHazardId = null;
  brain.mergeFollowActorId = null;
  lastPlanResult = null;
  resetRunSafety();
  ScenarioCatalog.spawnCustomObstacle(type, 35.0, obstacleManager, egoVehicle);

  for (let index = 0; index < steps; index += 1) {
    obstacleManager.updateAll(dt, egoVehicle);
    const plan = brain.step(egoVehicle, obstacleManager.obstacles, dt, false, obstacleManager.ambientCars, 'DAY', activeScenarioData.policy);
    egoVehicle.setSafetyPlan(plan);
    egoVehicle.update(dt, plan.steerCmd, plan.accCmd, [...obstacleManager.obstacles, ...obstacleManager.ambientCars]);
    lastPlanResult = plan;
    updateRunSafety(plan);
  }

  isPaused = priorPaused;
  setManualMode(priorManual);
  return scenarioSnapshot();
}

// Telemetry History for Live Charts (last 40 points)
const historyLength = 40;
const speedHistory = new Array(historyLength).fill(11.5);
const steerHistory = new Array(historyLength).fill(0);
const riskHistory = new Array(historyLength).fill(0);

// DOM Elements
const speedDisplay = document.getElementById('speed-val');
const steeringDial = document.getElementById('wheel-dial');
const steeringAngleText = document.getElementById('wheel-angle');
const throttleFill = document.getElementById('throttle-fill');
const brakeFill = document.getElementById('brake-fill');
const decisionReasonText = document.getElementById('decision-reason');
const latencyDisplay = document.getElementById('latency-val');
const clearanceDisplay = document.getElementById('clearance-val');
const ttcDisplay = document.getElementById('ttc-val');
const crossTrackDisplay = document.getElementById('crosstrack-val');
const detectedAgentsList = document.getElementById('detected-agents-list');
const cvObjectCount = document.getElementById('cv-obj-count');
const cvNearestDist = document.getElementById('cv-nearest-dist');
const cvMinTTC = document.getElementById('cv-min-ttc');

// Chart Canvases
const speedChartCanvas = document.getElementById('speed-chart-canvas');
const steerChartCanvas = document.getElementById('steer-chart-canvas');

function init() {
  console.log('[AUTONOMOUS SIMULATOR] Initializing 3D Cybernetic Engine & MATLAB Core Stack...');

  // 1. Initialize 3D World (Procedural Roads, Bridge Architecture, Lighting, Rain)
  world = new World3D('canvas3d-container');
  window.world = world;

  // 2. Initialize Ego Autonomous Electric Vehicle
  egoVehicle = new EgoVehicle3D(world.scene);
  window.egoVehicle = egoVehicle;

  // 3. Initialize Heterogeneous Indian Road Obstacle Manager
  obstacleManager = new ObstacleManager3D(world.scene);
  window.obstacleManager = obstacleManager;

  // 4. Initialize Decision Stateflow FSM, Risk Field, & Stanley Planner
  brain = new AutonomousDrivingBrain();
  window.brain = brain;
  window.switchScenario = switchScenario;
  window.getSimulationSnapshot = scenarioSnapshot;
  window.runScenarioSafetyProbe = runScenarioSafetyProbe;
  window.runInjectedHazardProbe = runInjectedHazardProbe;

  // 5. Initialize Onboard ADAS Camera with YOLOv8 Detection Feed
  cvHUD = new ComputerVisionHUD('cv-canvas');

  // 6. Load Initial Default Scenario (Cattle Crossing)
  switchScenario('cattle_crossing');

  // 7. Attach Interactive UI Controls
  setupEventListeners();

  // 8. Initialize WebSocket Telemetry Bridge (with graceful standalone fallback)
  initWebSocket();
  
  // 9. Start Real-time RAF Loop
  requestAnimationFrame(animate);
}

function setupEventListeners() {
  // Scenario Tabs
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      switchScenario(target.dataset.scenario);
    });
  });

  // Environment / Weather Pills
  document.querySelectorAll('.weather-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      world.setWeather(target.dataset.weather);
    });
  });

  // Camera View Pills
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      world.activeCameraMode = target.dataset.cam;
    });
  });

  // Simulation Play / Pause
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      isPaused = !isPaused;
      pauseBtn.innerHTML = isPaused ? '▶ Resume' : '⏸ Pause';
    });
  }

  // Simulation Speed Multipliers (0.5x, 1x, 2x)
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      simSpeedMultiplier = parseFloat(target.dataset.speed);
    });
  });

  // Reset Simulation Button
  const resetBtn = document.getElementById('btn-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      setManualMode(false);
      const activeTab = document.querySelector('.scenario-btn.active');
      if (activeTab) switchScenario(activeTab.dataset.scenario);
    });
  }

  // Autonomous FSD vs Manual Drive Toggle Button
  const modeBtn = document.getElementById('btn-mode-toggle');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      setManualMode(!isManualMode);
    });
  }

  // Trigger Hazard Button (Sudden cow entry or obstacle intrusion)
  const triggerBtn = document.getElementById('btn-trigger-hazard');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      const cattle = obstacleManager.obstacles.find(o => o.classId === 4);
      if (cattle) {
        cattle.isTriggered = true;
        console.log('[HAZARD] Stray cattle intrusion triggered!');
      } else {
        // Spawn cattle right ahead in lane
        ScenarioCatalog.spawnCustomObstacle('cattle', 25.0, obstacleManager, egoVehicle);
      }
    });
  }

  // Custom Obstacle Selector Dropdown
  const obsSelect = document.getElementById('obstacle-select');
  if (obsSelect) {
    obsSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type !== 'none') {
        ScenarioCatalog.spawnCustomObstacle(type, 35.0, obstacleManager, egoVehicle);
        obsSelect.value = 'none';
      }
    });
  }

  // Client Presentation Overview Modal
  const clientBtn = document.getElementById('btn-client-modal');
  const modalOverlay = document.getElementById('client-modal');
  const modalClose = document.getElementById('modal-close');

  if (clientBtn && modalOverlay) {
    clientBtn.addEventListener('click', () => {
      modalOverlay.classList.add('open');
    });
  }
  if (modalClose && modalOverlay) {
    modalClose.addEventListener('click', () => {
      modalOverlay.classList.remove('open');
    });
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.classList.remove('open');
    });
  }

  // Toggle HUD Overlay Button & Keyboard 'H' Shortcut
  const hudToggleBtn = document.getElementById('btn-toggle-hud');
  function toggleHud() {
    document.body.classList.toggle('hud-hidden');
    const isHidden = document.body.classList.contains('hud-hidden');
    if (hudToggleBtn) {
      hudToggleBtn.innerHTML = isHidden ? '👁️ Show HUD' : '👁️ Toggle HUD';
      hudToggleBtn.classList.toggle('active', isHidden);
    }
  }
  if (hudToggleBtn) {
    hudToggleBtn.addEventListener('click', toggleHud);
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        toggleHud();
      }
    }
  });

  // 15-Scenario Catalog Dropdown
  const scenarioSelectAll = document.getElementById('scenario-select-all');
  if (scenarioSelectAll) {
    scenarioSelectAll.addEventListener('change', (e) => {
      switchScenario(e.target.value);
    });
  }

  // Run MATLAB Suite Modal & Execution
  const runMatlabBtn = document.getElementById('btn-run-matlab');
  const matlabModal = document.getElementById('matlab-modal');
  const matlabModalClose = document.getElementById('matlab-modal-close');
  const matlabOutputContainer = document.getElementById('matlab-output-container');

  function showFallbackMatlabReport() {
    if (!matlabOutputContainer) return;
    matlabOutputContainer.innerText = 
`=================================================================
   SIH-26037: STATIC DIGITAL-TWIN DEPLOYMENT
=================================================================

The hosted simulator is running browser-side perception, decision,
planning, collision-envelope and road-boundary checks.

MATLAB batch execution is available only from the local FastAPI launch:
  python run_simulator.py

For the browser decision regression, run locally:
  python verify_decision_matrix.py

That test exercises all 15 deterministic scenarios and verifies:
  - each declared maneuver becomes active
  - no physical contact event is recorded by the simulator
  - the right road boundary remains maintained

This is simulation evidence only; it is not a real-vehicle safety
certification or a guarantee of collision avoidance outside these models.
=================================================================`;
  }

  if (runMatlabBtn && matlabModal) {
    runMatlabBtn.addEventListener('click', async () => {
      matlabModal.classList.add('open');
      if (matlabOutputContainer) {
        matlabOutputContainer.innerText = "Executing MATLAB R2026a Automated Driving Toolbox batch validation...\nPlease wait (invoking test_all_scenarios)...\n";
      }
      try {
        const resp = await fetch('/api/run_matlab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'test_all' })
        });
        if (resp.ok) {
          const data = await resp.json();
          if (matlabOutputContainer) {
            matlabOutputContainer.innerText = data.stdout || ("MATLAB completed with code " + data.exit_code);
          }
        } else {
          showFallbackMatlabReport();
        }
      } catch (err) {
        showFallbackMatlabReport();
      }
    });
  }

  if (matlabModalClose && matlabModal) {
    matlabModalClose.addEventListener('click', () => matlabModal.classList.remove('open'));
    matlabModal.addEventListener('click', (e) => {
      if (e.target === matlabModal) matlabModal.classList.remove('open');
    });
  }

}

function switchScenario(scenarioId) {
  setManualMode(false);
  activeScenarioData = ScenarioCatalog.loadScenario(scenarioId, obstacleManager, egoVehicle, world);
  activeScenarioData.policy = ScenarioCatalog.getSafetyPolicy(scenarioId);
  brain.activeState = 'CRUISE';
  brain.targetSpeed = activeScenarioData.isBridge ? 9.0 : egoVehicle.speed;
  brain.dwellTime = 0.0;
  brain.passHazardId = null;
  brain.mergeFollowActorId = null;
  brain.lastGapCertificate = { safe: true, reason: 'Scenario reset', timeToClear: 0, blockingActor: null };
  lastPlanResult = null;
  resetRunSafety();

  // Sync 15-scenario dropdown
  const allSelect = document.getElementById('scenario-select-all');
  if (allSelect && allSelect.value !== scenarioId) {
    allSelect.value = scenarioId;
  }
  
  // Sync quick-select tab buttons
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scenario === scenarioId);
  });
  
  // Sync weather presets
  document.querySelectorAll('.weather-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.weather === (world.currentWeather || 'DAY'));
  });
  
  console.log(`[SCENARIO LOADED] ${activeScenarioData.title}`);
}

let wsSocket = null;
function initWebSocket() {
  const statusDot = document.getElementById('backend-status-dot');
  const statusText = document.getElementById('backend-status-text');

  if (window.location.protocol === 'file:') {
    if (statusText) statusText.innerText = 'STANDALONE (LOCAL FILE MODE)';
    return;
  }

  try {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/telemetry`;
    wsSocket = new WebSocket(wsUrl);

    wsSocket.onopen = () => {
      if (statusText) statusText.innerText = 'BACKEND LINKED (FASTAPI + MATLAB)';
      if (statusDot) statusDot.className = 'rule-dot cyan';
      console.log('[WEBSOCKET] Telemetry bridge connected to server.');
    };

    wsSocket.onclose = () => {
      if (statusText) statusText.innerText = 'STANDALONE (CLIENT ACTIVE)';
      if (statusDot) statusDot.className = 'rule-dot green';
    };

    wsSocket.onerror = () => {
      if (statusText) statusText.innerText = 'STANDALONE (CLIENT ACTIVE)';
      if (statusDot) statusDot.className = 'rule-dot green';
    };
  } catch (e) {
    if (statusText) statusText.innerText = 'STANDALONE (CLIENT ACTIVE)';
  }
}

function updateStateflowDiagram(activeState) {
  document.querySelectorAll('.sf-node').forEach(node => {
    node.classList.remove('active', 'emergency', 'inching', 'gapwait');
    if (node.dataset.state === activeState) {
      node.classList.add('active');
      if (activeState === 'EMERGENCY_STOP' || activeState === 'BRIDGE_STOP') {
        node.classList.add('emergency');
      } else if (activeState === 'INCHING') {
        node.classList.add('inching');
      } else if (activeState === 'GAP_WAIT') {
        node.classList.add('gapwait');
      }
    }
  });
}

function updateDecisionContract(planResult) {
  const policy = activeScenarioData?.policy;
  const contract = document.querySelector('.decision-contract');
  const status = document.getElementById('contract-status');
  const action = document.getElementById('contract-action');
  const expected = document.getElementById('contract-expected');
  const contacts = document.getElementById('contract-contacts');
  const contactPill = document.getElementById('contact-events-pill');
  if (!policy || !contract || !status || !action || !expected || !contacts) return;

  const contactEvents = runSafety?.contactEvents || 0;
  const stateMatches = planResult?.activeState === policy.expectedState;
  const speedMatches = policy.intent === 'SPEED_GOVERNED' && Boolean(planResult?.speedGoverned);
  const scenarioDecisionEngaged = stateMatches || speedMatches;
  const unsafe = contactEvents > 0 || runSafety?.boundaryMaintained === false;

  contract.classList.toggle('alert', unsafe);
  status.textContent = unsafe ? 'REVIEW REQUIRED' : (scenarioDecisionEngaged ? 'POLICY ACTIVE' : 'ARMED');
  const certificate = planResult?.gapCertificate;
  action.textContent = certificate && policy.intent === 'PASS_AFTER_GAP'
    ? policy.label + ' · ' + (certificate.safe ? 'GAP CERTIFIED' : 'GAP BLOCKED')
    : policy.label;
  expected.textContent = policy.intent === 'SPEED_GOVERNED' ? '15 km/h CAP' : policy.expectedState.replace('_', ' ');
  contacts.textContent = String(contactEvents);
  if (contactPill) contactPill.textContent = String(contactEvents);
}

function drawMiniChart(canvas, data, minVal, maxVal, lineColor) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;

  ctx.clearRect(0, 0, w, h);

  // Background grid line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Data Line
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();

  const stepX = w / (data.length - 1);
  for (let i = 0; i < data.length; i++) {
    const norm = (data[i] - minVal) / (maxVal - minVal);
    const y = h - (norm * (h - 6) + 3);
    const x = i * stepX;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// Keyboard Manual Driving Controls
const keys = { w: false, a: false, s: false, d: false, space: false };
let isManualMode = false;

function setManualMode(manual) {
  isManualMode = manual;
  const modeBtn = document.getElementById('btn-mode-toggle');
  if (modeBtn) {
    if (isManualMode) {
      modeBtn.innerHTML = '🎮 Manual Mode (Click to Resume FSD)';
      modeBtn.style.background = 'rgba(255, 170, 0, 0.35)';
      modeBtn.style.borderColor = '#ffaa00';
      modeBtn.style.color = '#ffaa00';
    } else {
      modeBtn.innerHTML = '🤖 Autonomous FSD';
      modeBtn.style.background = '';
      modeBtn.style.borderColor = 'rgba(0, 240, 255, 0.6)';
      modeBtn.style.color = 'var(--cyan)';
      // Clear key states
      keys.w = false; keys.a = false; keys.s = false; keys.d = false; keys.space = false;
    }
  }
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') { keys.w = true; setManualMode(true); }
  if (k === 's' || e.key === 'ArrowDown') { keys.s = true; setManualMode(true); }
  if (k === 'a' || e.key === 'ArrowLeft') { keys.a = true; setManualMode(true); }
  if (k === 'd' || e.key === 'ArrowRight') { keys.d = true; setManualMode(true); }
  if (e.key === ' ' || e.code === 'Space') { keys.space = true; setManualMode(true); }
  if (k === 'm' || e.key === 'Escape') {
    setManualMode(!isManualMode);
    console.log(`[MODE] Switched to ${isManualMode ? 'MANUAL DRIVE' : 'AUTONOMOUS FSD'}`);
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
  if (k === 's' || e.key === 'ArrowDown') keys.s = false;
  if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
  if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
  if (e.key === ' ' || e.code === 'Space') keys.space = false;
});

function animate(timestamp) {
  requestAnimationFrame(animate);

  const rawDt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  const dt = Math.min(0.08, rawDt) * (isPaused ? 0 : simSpeedMultiplier);

  if (dt > 0) {
    // 1. Scenario Lifecycle Update
    if (activeScenarioData && activeScenarioData.onUpdate) {
      activeScenarioData.onUpdate(egoVehicle.z, dt);
    }

    // 2. Obstacles Update
    obstacleManager.updateAll(dt, egoVehicle);

    // 3. MATLAB Autonomous Driving Brain Step (FSM + Risk Field + Trajectory Optimization + Stanley Steering)
    const allActors = [...obstacleManager.obstacles, ...obstacleManager.ambientCars];
    const currentWeather = world.currentWeather || 'DAY';
    const planResult = brain.step(
      egoVehicle,
      obstacleManager.obstacles,
      dt,
      activeScenarioData ? activeScenarioData.isBridge : false,
      obstacleManager.ambientCars,
      currentWeather,
      activeScenarioData ? activeScenarioData.policy : null
    );

    // 4. Update Ego Vehicle Kinematics (Autonomous FSD vs Keyboard Manual Drive)
    let steerCmd = planResult.steerCmd;
    let accCmd = planResult.accCmd;

    if (isManualMode) {
      steerCmd = 0;
      if (keys.a) steerCmd += 0.45;
      if (keys.d) steerCmd -= 0.45;

      accCmd = 0;
      if (keys.w) accCmd = 3.0;
      if (keys.s) accCmd = -4.5;
      if (keys.space) accCmd = -8.0;

      planResult.activeState = 'MANUAL_DRIVE';
      planResult.reason = 'Manual Keyboard Drive Override (WASD/Arrows Active | Press M for Autonomous FSD)';
    }

    egoVehicle.setSafetyPlan(planResult);
    egoVehicle.update(dt, steerCmd, accCmd, allActors);
    lastPlanResult = planResult;
    updateRunSafety(planResult);

    // Automatic Seamless Scenario Loop when reaching end of corridor
    if (egoVehicle.z > 320) {
      const activeTab = document.querySelector('.scenario-btn.active');
      if (activeTab) switchScenario(activeTab.dataset.scenario);
    }

    // 5. Update 3D Trajectory Ribbon & Candidate Search Fan
    world.updateTrajectory(planResult.plannedTrajectory, planResult.candidateTrajectories);

    // 6. Update Rain Particle System if in Rain Mode
    world.updateRain(egoVehicle.z);

    // 7. Update Computer Vision ADAS Canvas & Get Detected Targets
    const detectedTargets = cvHUD.render(egoVehicle, allActors, planResult.activeState, currentWeather);

    // 8. Update Telemetry History
    speedHistory.push(egoVehicle.speed * 3.6); // km/h
    speedHistory.shift();
    steerHistory.push(THREE.MathUtils.radToDeg(egoVehicle.steerAngle));
    steerHistory.shift();

    // 9. Update UI Dashboard Elements
    const speedKmh = Math.round(egoVehicle.speed * 3.6);
    if (speedDisplay) speedDisplay.innerText = speedKmh;

    // Steering Wheel Angle Dial
    const degSteer = Math.round(THREE.MathUtils.radToDeg(egoVehicle.steerAngle));
    if (steeringDial) steeringDial.style.transform = `rotate(${degSteer * 2.2}deg)`;
    if (steeringAngleText) steeringAngleText.innerText = `${degSteer > 0 ? '+' : ''}${degSteer}°`;

    // Pedal Gauges
    if (throttleFill) {
      const throttlePct = planResult.accCmd > 0 ? Math.min(100, (planResult.accCmd / 2.5) * 100) : 0;
      throttleFill.style.width = `${throttlePct}%`;
    }
    if (brakeFill) {
      const brakePct = planResult.accCmd < 0 ? Math.min(100, (Math.abs(planResult.accCmd) / 8.0) * 100) : 0;
      brakeFill.style.width = `${brakePct}%`;
    }

    // Decision Stateflow Diagram & Explanation
    updateStateflowDiagram(planResult.activeState);
    if (decisionReasonText) decisionReasonText.innerText = planResult.reason;
    updateDecisionContract(planResult);

    // Hardware Benchmarks
    if (latencyDisplay) latencyDisplay.innerText = `${planResult.latency.toFixed(1)} ms`;
    if (clearanceDisplay) clearanceDisplay.innerText = `${planResult.minDist < 50 ? planResult.minDist.toFixed(1) + ' m' : '> 25 m'}`;
    if (ttcDisplay) {
      ttcDisplay.innerText = planResult.minTTC < 10 ? `${planResult.minTTC.toFixed(1)} s` : 'SAFE';
      const ttcBox = ttcDisplay.parentElement;
      if (planResult.minTTC < 1.4) {
        ttcBox.className = 'metric-box danger';
      } else if (planResult.minTTC < 3.0) {
        ttcBox.className = 'metric-box warning';
      } else {
        ttcBox.className = 'metric-box pass';
      }
    }
    if (crossTrackDisplay) {
      crossTrackDisplay.innerText = `${planResult.crossTrackError.toFixed(2)} m`;
    }

    // Dynamic Multi-Sensor Fusion Chips
    const chipCamStatus = document.getElementById('chip-cam-status');
    const chipRadarStatus = document.getElementById('chip-radar-status');
    const chipLidarStatus = document.getElementById('chip-lidar-status');
    if (chipCamStatus && chipRadarStatus && chipLidarStatus) {
      if (currentWeather === 'RAIN') {
        chipCamStatus.innerText = 'DEGRADED (48%)';
        chipCamStatus.style.color = '#ffb703';
        chipRadarStatus.innerText = 'PRIMARY LOCK';
        chipRadarStatus.style.color = '#00f0ff';
        chipLidarStatus.innerText = 'ACTIVE FUSION';
      } else {
        chipCamStatus.innerText = '60 FPS HDR';
        chipCamStatus.style.color = '';
        chipRadarStatus.innerText = 'DOPPLER LOCK';
        chipRadarStatus.style.color = '';
        chipLidarStatus.innerText = '64-BEAM';
      }
    }

    // CV Info Bar
    if (cvObjectCount) cvObjectCount.innerText = detectedTargets.length;
    if (cvNearestDist) cvNearestDist.innerText = planResult.minDist < 50 ? `${planResult.minDist.toFixed(1)}m` : '--';
    if (cvMinTTC) cvMinTTC.innerText = planResult.minTTC < 10 ? `${planResult.minTTC.toFixed(1)}s` : 'SAFE';

    // Detected Obstacles List
    if (detectedAgentsList) {
      detectedAgentsList.innerHTML = detectedTargets.map(t => `
        <div class="detection-tag ${t.name.toLowerCase().replace(/[^a-z]/g, '')}">
          <span><strong>${t.name}</strong></span>
          <span>${t.dist.toFixed(1)}m | TTC: ${t.ttc < 10 ? t.ttc.toFixed(1) + 's' : 'SAFE'}</span>
        </div>
      `).join('');
    }

    // Draw Mini Charts
    drawMiniChart(speedChartCanvas, speedHistory, 0, 60, '#00f0ff');
    drawMiniChart(steerChartCanvas, steerHistory, -35, 35, '#00ff88');
  }

  // 10. Update Camera & Render 3D Scene
  world.updateCamera(egoVehicle);
  world.render();
}

window.addEventListener('DOMContentLoaded', init);
