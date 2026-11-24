(() => {
  'use strict';

  const scenarios = [
    {id:'cattle', number:'01', name:'Cattle crossing', short:'Sudden animal incursion', behavior:'EMERGENCY STOP', tag:'SAFE HOLD', tagClass:'', object:'CATTLE', ttc:1.2, clearance:2.4, speed:0, latency:16.3, radar:38.4, confidence:96, tracks:2, baseRange:32, obstacle:'cattle', offset:-.15, weather:'clear', reason:'Projected time-to-collision breaches the conservative stop threshold.', trace:['Radar–LiDAR track is associated with the camera object.', 'Predicted animal envelope intersects the current corridor.', 'TTC guard pre-empts lateral maneuver selection.', 'Jerk-limited braking trajectory is held until the corridor clears.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'bridge', number:'02', name:'Narrow bridge', short:'No-swerve blocked corridor', behavior:'EMERGENCY STOP', tag:'IN-LANE HOLD', tagClass:'warn', object:'STALLED AUTO', ttc:2.1, clearance:1.8, speed:0, latency:14.7, radar:31.6, confidence:98, tracks:1, baseRange:32, obstacle:'auto', offset:0, weather:'clear', reason:'No collision-free lateral corridor exists inside the bridge boundaries.', trace:['Bridge edges reduce the drivable corridor to one lane.', 'Static obstacle is confirmed by persistent fused track.', 'Road-boundary guard rejects every lateral candidate.', 'Fallback stop trajectory retains the lane centre.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'tractor', number:'03', name:'Village tractor', short:'Slow lead vehicle', behavior:'NUDGE', tag:'CORRIDOR CLEAR', tagClass:'', object:'TRACTOR', ttc:3.4, clearance:2.9, speed:25, latency:15.1, radar:42.2, confidence:94, tracks:2, baseRange:32, obstacle:'tractor', offset:-.18, weather:'clear', reason:'A low-speed lead vehicle is tracked while a bounded lateral corridor remains available.', trace:['Fused track estimates a slow, predictable lead object.', 'Oncoming-lane occupancy is checked before path sampling.', 'Quintic candidates stay inside the legal road corridor.', 'Lowest-risk smooth trajectory becomes the target path.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'intersection', number:'04', name:'Urban intersection', short:'Crossing auto-rickshaw', behavior:'YIELD', tag:'GAP PROTECTED', tagClass:'warn', object:'AUTO-RICKSHAW', ttc:2.2, clearance:3.1, speed:14, latency:17.5, radar:29.2, confidence:95, tracks:3, baseRange:32, obstacle:'auto', offset:.21, weather:'clear', reason:'The crossing agent occupies the predicted conflict zone, so gap acceptance is withheld.', trace:['A crossing track is projected across the ego path.', 'Conflict-zone occupancy raises the yield cost.', 'Acceleration is limited to preserve an escape margin.', 'The vehicle waits for a verified clear gap.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'market', number:'05', name:'Dense market', short:'Pedestrian & pushcart cluster', behavior:'INCHING', tag:'CAUTION MODE', tagClass:'warn', object:'PEDESTRIAN CLUSTER', ttc:2.9, clearance:2.1, speed:6, latency:18.1, radar:18.7, confidence:91, tracks:5, baseRange:32, obstacle:'pedestrian', offset:-.1, weather:'clear', reason:'Multiple vulnerable road users reduce the confidence of any nominal-speed manoeuvre.', trace:['Multiple tracks are clustered within the local horizon.', 'Risk field expands around vulnerable road users.', 'State machine selects low-speed inching behaviour.', 'Planner restricts the search corridor and comfort limits.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'rain', number:'06', name:'Monsoon degradation', short:'Reduced camera confidence', behavior:'CAUTIOUS YIELD', tag:'SENSOR CAUTION', tagClass:'warn', object:'SLOW AUTO', ttc:2.6, clearance:3.0, speed:14, latency:19.4, radar:35.9, confidence:62, tracks:2, baseRange:32, obstacle:'auto', offset:0, weather:'rain', reason:'Camera confidence is degraded; the policy increases radar/LiDAR weighting and reduces speed.', trace:['Rain mode reduces the simulated camera confidence score.', 'Radar and LiDAR tracks receive higher fusion weight.', 'Speed policy is capped while uncertainty is elevated.', 'The planner maintains a longer stopping margin.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'motorcycle', number:'07', name:'Motorcycle filtering', short:'Fast lateral intrusion', behavior:'YIELD', tag:'LATERAL GUARD', tagClass:'warn', object:'TWO-WHEELER', ttc:1.8, clearance:2.6, speed:12, latency:17.2, radar:24.8, confidence:93, tracks:2, baseRange:32, obstacle:'bike', offset:.25, weather:'clear', reason:'A fast lateral object expands the near-field risk envelope around the lane divider.', trace:['A two-wheeler track shows high lateral velocity.', 'Class-aware risk envelope expands at the divider.', 'Unsafe candidate paths are rejected before selection.', 'Yield command preserves lateral clearance.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'pothole', number:'08', name:'Pothole avoidance', short:'Sub-lane road hazard', behavior:'NUDGE', tag:'PATH ADAPTED', tagClass:'', object:'ROAD HAZARD', ttc:4.0, clearance:1.7, speed:22, latency:13.9, radar:42.0, confidence:90, tracks:1, baseRange:32, obstacle:'pothole', offset:-.24, weather:'clear', reason:'A static road-surface hazard is avoided with a bounded, smooth in-lane offset.', trace:['Camera surface cue is registered as a static hazard track.', 'Road-boundary margin limits lateral displacement.', 'Smooth in-lane quintic path clears the wheel track.', 'Controller returns the vehicle to lane centre after passing.'], guards:{road:true,ttc:false,space:true,comfort:true}},
    {id:'stalled', number:'09', name:'Stalled vehicle', short:'Oncoming traffic priority', behavior:'EMERGENCY STOP', tag:'ONCOMING GUARD', tagClass:'warn', object:'DISABLED CAR', ttc:1.9, clearance:2.6, speed:0, latency:16.8, radar:34.6, confidence:98, tracks:3, baseRange:32, obstacle:'car', offset:0, weather:'clear', reason:'The opposing lane is occupied, so overtaking is rejected and a safe queue is formed.', trace:['Stopped lead vehicle is confirmed in the travel lane.', 'Oncoming tracks invalidate a lane-crossing candidate.', 'Collision cost makes all overtaking paths infeasible.', 'The fallback action is a controlled in-lane stop.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'construction', number:'10', name:'Construction detour', short:'Channelized roadwork', behavior:'NUDGE', tag:'CORRIDOR CLEAR', tagClass:'', object:'BARRICADE', ttc:3.3, clearance:2.2, speed:20, latency:15.5, radar:36.2, confidence:97, tracks:2, baseRange:32, obstacle:'barrier', offset:.26, weather:'clear', reason:'Channelizers reshape the drivable corridor while leaving a bounded passing path.', trace:['Roadwork objects create a static constrained corridor.', 'Path samples that cross barriers are discarded.', 'Selected trajectory balances clearance and steering effort.', 'Speed reduction is retained through the workzone.'], guards:{road:true,ttc:false,space:true,comfort:true}},
    {id:'night', number:'11', name:'Night pedestrian', short:'Low-light crossing event', behavior:'EMERGENCY STOP', tag:'VULNERABLE USER', tagClass:'warn', object:'PEDESTRIAN', ttc:1.1, clearance:2.3, speed:0, latency:18.9, radar:25.4, confidence:78, tracks:1, baseRange:32, obstacle:'pedestrian', offset:.12, weather:'night', reason:'A vulnerable road user enters the predicted path under reduced visual confidence.', trace:['Low-light mode lowers the camera contribution.', 'Active range sensing sustains the object track.', 'Pedestrian risk weighting raises the emergency cost.', 'A stop command is prioritised over evasive steering.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'herd', number:'12', name:'Animal herd', short:'Shoulder-side livestock', behavior:'CAUTION CRUISE', tag:'BUFFER EXPANDED', tagClass:'warn', object:'CATTLE HERD', ttc:4.4, clearance:3.5, speed:18, latency:17.1, radar:39.7, confidence:95, tracks:4, baseRange:32, obstacle:'cattle', offset:.24, weather:'clear', reason:'Nearby livestock expands the lateral buffer and reduces nominal speed.', trace:['Several animal tracks are classified near the shoulder.', 'Class-specific risk field expands toward the travel lane.', 'The behaviour layer applies a cautionary speed cap.', 'The trajectory shifts away while preserving road boundaries.'], guards:{road:true,ttc:false,space:true,comfort:true}},
    {id:'speedbreaker', number:'13', name:'Speed breaker', short:'Vertical road irregularity', behavior:'CAUTION CRUISE', tag:'COMFORT GUARD', tagClass:'warn', object:'SPEED BREAKER', ttc:4.3, clearance:0, speed:15, latency:12.8, radar:44.0, confidence:92, tracks:1, baseRange:32, obstacle:'speedbreaker', offset:0, weather:'clear', reason:'The road feature triggers a vertical comfort speed cap rather than a steering maneuver.', trace:['Surface profile event is added to the local route map.', 'A speed-only constraint is applied to the horizon.', 'Jerk-limited controller reduces longitudinal command.', 'Lane centre path remains the lowest-cost option.'], guards:{road:true,ttc:false,space:false,comfort:true}},
    {id:'merge', number:'14', name:'Highway merge', short:'Slow vehicle enters lane', behavior:'YIELD', tag:'GAP PROTECTED', tagClass:'warn', object:'MERGING AUTO', ttc:2.5, clearance:3.2, speed:18, latency:16.7, radar:47.5, confidence:96, tracks:2, baseRange:32, obstacle:'auto', offset:-.14, weather:'clear', reason:'The projected merge overlaps the ego corridor, requiring anticipatory deceleration.', trace:['Merging track is predicted into the ego corridor.', 'Forward risk grows before a physical conflict occurs.', 'Target speed is lowered to open a time gap.', 'Trajectory maintains lane containment throughout the merge.'], guards:{road:true,ttc:true,space:true,comfort:true}},
    {id:'recovery', number:'15', name:'S-curve recovery', short:'Multi-obstacle lane reversion', behavior:'NUDGE', tag:'RECOVERY TRACK', tagClass:'', object:'MULTI-AGENT', ttc:3.1, clearance:2.7, speed:22, latency:18.3, radar:41.8, confidence:94, tracks:3, baseRange:32, obstacle:'auto', offset:-.3, weather:'clear', reason:'Sequential obstacles require a smooth offset followed by a controlled return to lane centre.', trace:['Two independent hazard envelopes are projected ahead.', 'A single smooth S-curve is lower cost than sharp re-entry.', 'Curvature and lateral acceleration constraints remain active.', 'The controller asymptotically returns to the nominal centreline.'], guards:{road:true,ttc:true,space:true,comfort:true}}
  ];

  const featured = ['cattle', 'bridge', 'tractor', 'market', 'rain', 'night'];
  let current = scenarios[0];
  let running = true;
  let simElapsed = 0;
  let lastFrame = performance.now();
  let hazardRange = 32;

  const $ = (id) => document.getElementById(id);
  const canvas = $('road-canvas');
  const ctx = canvas.getContext('2d');
  const range = $('hazard-distance');
  const readouts = {
    title: $('scenario-title'), state: $('decision-state'), reason: $('decision-reason'), tag: $('safety-tag'),
    ttc: $('ttc-readout'), clearance: $('clearance-readout'), speed: $('speed-readout'), latency: $('latency-readout'),
    radar: $('radar-range'), confidence: $('camera-confidence'), object: $('camera-object'), tracks: $('track-count'),
    time: $('sim-time'), distance: $('distance-output'), trace: $('trace-list'), run: $('run-label'), pause: $('pause-icon')
  };

  function valueWithUnit(value, unit) { return `${value} <small>${unit}</small>`; }
  function dynamicTtc() { return Math.max(.4, current.ttc * (hazardRange / current.baseRange)); }

  function populateControls() {
    const select = $('scenario-select');
    scenarios.forEach((scenario) => {
      const option = document.createElement('option');
      option.value = scenario.id;
      option.textContent = `${scenario.number} · ${scenario.name}`;
      select.appendChild(option);
    });
    select.addEventListener('change', (event) => setScenario(event.target.value));

    const tabs = $('scenario-tabs');
    featured.forEach((id) => {
      const scenario = scenarios.find((item) => item.id === id);
      const button = document.createElement('button');
      button.className = 'scenario-tab'; button.type = 'button'; button.dataset.id = id;
      button.innerHTML = `<span>SCENARIO ${scenario.number}</span><strong>${scenario.name}</strong><em>${scenario.short}</em>`;
      button.addEventListener('click', () => setScenario(id));
      tabs.appendChild(button);
    });
  }

  function setScenario(id) {
    const found = scenarios.find((scenario) => scenario.id === id);
    if (!found) return;
    current = found;
    hazardRange = current.baseRange;
    range.value = String(hazardRange);
    simElapsed = 0;
    $('scenario-select').value = id;
    document.querySelectorAll('.scenario-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.id === id));
    syncPanel();
  }

  function syncPanel() {
    const ttc = dynamicTtc();
    readouts.title.textContent = current.name;
    readouts.state.textContent = current.behavior;
    readouts.reason.textContent = current.reason;
    readouts.tag.textContent = current.tag;
    readouts.tag.classList.toggle('warn', Boolean(current.tagClass));
    readouts.ttc.innerHTML = valueWithUnit(ttc.toFixed(1), 's');
    readouts.clearance.innerHTML = current.clearance ? valueWithUnit(current.clearance.toFixed(1), 'm') : valueWithUnit('—', 'n/a');
    readouts.speed.innerHTML = valueWithUnit(current.speed, 'km/h');
    readouts.latency.innerHTML = valueWithUnit(current.latency.toFixed(1), 'ms');
    readouts.radar.textContent = `${(current.radar * hazardRange / current.baseRange).toFixed(1)} m`;
    readouts.confidence.textContent = `${current.confidence}%`;
    readouts.object.textContent = `${current.object} · ${(current.confidence / 100).toFixed(2)}`;
    readouts.tracks.textContent = String(current.tracks).padStart(2, '0');
    readouts.distance.textContent = `${hazardRange} m`;
    readouts.trace.innerHTML = current.trace.map((step) => `<li>${step}</li>`).join('');
    ['road', 'ttc', 'space', 'comfort'].forEach((guard) => $('guard-' + guard).classList.toggle('off', !current.guards[guard]));
    $('radar-blip').style.top = `${Math.max(14, Math.min(66, 74 - hazardRange * .95))}%`;
    document.documentElement.style.setProperty('--scenario-hue', current.weather === 'rain' ? '202' : current.weather === 'night' ? '236' : '153');
  }

  function toggleRun() {
    running = !running;
    readouts.run.textContent = running ? 'RUNNING' : 'PAUSED';
    readouts.pause.textContent = running ? 'Ⅱ' : '▶';
    $('toggle-run').setAttribute('aria-label', running ? 'Pause animation' : 'Run animation');
    document.querySelector('.running-status i').style.animationPlayState = running ? 'running' : 'paused';
  }

  function drawRoundedRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawPath(points, stroke, width, dash = []) {
    ctx.save(); ctx.beginPath(); ctx.setLineDash(dash); points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }

  function drawRoad(w, h) {
    const roadLeft = w * .205, roadRight = w * .795;
    ctx.fillStyle = '#0a1422'; ctx.fillRect(0, 0, w, h);
    const shoulder = ctx.createLinearGradient(0, 0, w, h); shoulder.addColorStop(0, '#1a2635'); shoulder.addColorStop(.5, '#111b2b'); shoulder.addColorStop(1, '#0b1423');
    ctx.fillStyle = shoulder; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#182535'; ctx.fillRect(roadLeft, 0, roadRight - roadLeft, h);
    ctx.fillStyle = 'rgba(166,194,222,.08)'; ctx.fillRect(roadLeft + 2, 0, 3, h); ctx.fillRect(roadRight - 5, 0, 3, h);
    const horizon = h * .14; const egoY = h * .79;
    ctx.strokeStyle = 'rgba(226,189,87,.62)'; ctx.lineWidth = 2;
    for (let y = horizon + ((simElapsed * 95) % 52); y < h; y += 54) {
      const p = (y - horizon) / (h - horizon); const center = w * .5;
      ctx.beginPath(); ctx.moveTo(center - 2, y); ctx.lineTo(center + 2, y + 21 * p); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(102,190,249,.17)'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const y = horizon + i * h * .18; ctx.beginPath(); ctx.moveTo(roadLeft, y); ctx.lineTo(roadRight, y); ctx.stroke(); }
    if (current.weather === 'rain') drawRain(w, h);
    if (current.weather === 'night') { ctx.fillStyle = 'rgba(2,7,20,.39)'; ctx.fillRect(0,0,w,h); const glow=ctx.createRadialGradient(w*.5,egoY,15,w*.5,egoY,h*.45);glow.addColorStop(0,'rgba(88,139,205,.13)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h); }
  }

  function drawRain(w, h) {
    ctx.save(); ctx.strokeStyle = 'rgba(140,202,255,.18)'; ctx.lineWidth = 1;
    for (let x = -30; x < w + 30; x += 25) { const o = (simElapsed * 180) % 50; ctx.beginPath();ctx.moveTo(x, (x * .31 + o) % h);ctx.lineTo(x - 8, ((x * .31 + o) % h) + 19);ctx.stroke(); }
    ctx.restore();
  }

  function drawRisk(x, y, radius) {
    const gradient = ctx.createRadialGradient(x, y, 3, x, y, radius); gradient.addColorStop(0, 'rgba(255,112,112,.23)'); gradient.addColorStop(.56, 'rgba(255,112,112,.09)'); gradient.addColorStop(1, 'rgba(255,112,112,0)');
    ctx.fillStyle = gradient; ctx.beginPath();ctx.ellipse(x,y,radius*.72,radius,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle = 'rgba(255,131,131,.48)';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();ctx.ellipse(x,y,radius*.54,radius*.73,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  }

  function drawObstacle(x, y, scale) {
    const type = current.obstacle;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    let body='#ea895d', bright='#ffc297';
    if (type === 'cattle') { body='#d49b62'; bright='#f2d69a'; drawRoundedRect(-17,-8,34,17,5,body);ctx.fillStyle=body;ctx.beginPath();ctx.arc(19,-5,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=bright;[[-12,9],[-2,9],[11,9],[20,8]].forEach(([px,py])=>ctx.fillRect(px,py,3,8)); }
    else if (type === 'pedestrian') {body='#eab466';ctx.fillStyle=body;ctx.beginPath();ctx.arc(0,-13,5,0,Math.PI*2);ctx.fill();ctx.strokeStyle=body;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.moveTo(-7,-1);ctx.lineTo(7,0);ctx.moveTo(-1,7);ctx.lineTo(-5,15);ctx.moveTo(1,7);ctx.lineTo(6,15);ctx.stroke();}
    else if (type === 'pothole') {ctx.fillStyle='#050a10';ctx.beginPath();ctx.ellipse(0,0,22,10,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9f6c46';ctx.lineWidth=3;ctx.stroke();}
    else if (type === 'speedbreaker') {ctx.fillStyle='#d2ae4c';drawRoundedRect(-35,-7,70,14,6,ctx.fillStyle);ctx.fillStyle='rgba(22,20,17,.65)';for(let i=-25;i<30;i+=15)ctx.fillRect(i,-7,7,14);}
    else if (type === 'barrier') {body='#ea865d';drawRoundedRect(-25,-9,50,18,3,body);ctx.fillStyle='#fff0d0';for(let i=-18;i<20;i+=13){ctx.save();ctx.translate(i,0);ctx.rotate(-.6);ctx.fillRect(-4,-10,8,20);ctx.restore();}}
    else {if(type==='bike'){body='#61b9e7';drawRoundedRect(-12,-6,24,12,3,body);ctx.strokeStyle='#b8e9ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-10,8,6,0,Math.PI*2);ctx.arc(10,8,6,0,Math.PI*2);ctx.stroke();}else{body=type==='tractor'?'#65ad76':type==='car'?'#dd676a':'#dc925e';drawRoundedRect(-24,-12,48,24,5,body);ctx.fillStyle='rgba(231,249,255,.48)';drawRoundedRect(-14,-9,27,8,2,ctx.fillStyle);ctx.fillStyle='#101720';[-15,15].forEach(px=>{ctx.beginPath();ctx.arc(px,13,6,0,Math.PI*2);ctx.fill();});}}
    ctx.restore();
  }

  function drawEgo(x, y) {
    ctx.save();ctx.translate(x,y);ctx.shadowColor='rgba(77,240,168,.5)';ctx.shadowBlur=18;drawRoundedRect(-17,-29,34,58,8,'#59dcb2','#baffdf');ctx.shadowBlur=0;ctx.fillStyle='rgba(222,255,246,.68)';drawRoundedRect(-11,-19,22,15,4,ctx.fillStyle);ctx.fillStyle='#09231e';[-12,12].forEach(px=>{ctx.fillRect(px,-17,4,9);ctx.fillRect(px,10,4,9)});ctx.restore();
  }

  function drawCanvas() {
    const displayWidth = canvas.clientWidth || 800; const displayHeight = canvas.clientHeight || 480; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(displayWidth*dpr) || canvas.height !== Math.round(displayHeight*dpr)) { canvas.width=Math.round(displayWidth*dpr);canvas.height=Math.round(displayHeight*dpr); }
    const w = displayWidth, h = displayHeight; ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);drawRoad(w,h);
    const egoX=w*.5, egoY=h*.79; const distanceRatio=hazardRange/64; const oscillation = current.behavior === 'YIELD' ? Math.sin(simElapsed*1.5)*.025 : 0;
    const obsY=h*(.20+distanceRatio*.42), obsX=w*(.5+current.offset+oscillation); const riskR=Math.max(36,86-hazardRange*.45);
    drawRisk(obsX,obsY,riskR);
    const stopMode=/STOP|HOLD/.test(current.behavior);
    const inchMode=/INCH/.test(current.behavior);
    const nudgeMode=/NUDGE|RECOVERY/.test(current.behavior);
    const endY=stopMode ? Math.min(egoY-48,obsY+riskR*.7) : inchMode ? egoY-110 : h*.18;
    const shift=nudgeMode ? -w*.12 : current.behavior==='YIELD' ? w*.035 : 0;
    const path = [[egoX,egoY],[egoX+shift*.1,egoY-55],[egoX+shift*.8,(egoY+endY)*.56],[egoX+shift,endY]];
    drawPath([[egoX-w*.09,egoY],[egoX-w*.08,egoY-60],[egoX-w*.04,egoY-140],[egoX-w*.02,h*.14]],'rgba(108,185,255,.20)',2,[5,7]);
    ctx.save();ctx.globalAlpha=.25;drawPath(path,'#4df0a8',11);ctx.restore();drawPath(path,'#71ffd0',3);
    drawObstacle(obsX,obsY,Math.max(.67,1.06-hazardRange*.004));
    if(current.id==='recovery'){drawRisk(w*.57,h*.30,43);drawObstacle(w*.57,h*.30,.72);}
    drawEgo(egoX,egoY);
    ctx.fillStyle='rgba(226,241,253,.72)';ctx.font='500 9px DM Mono, monospace';ctx.fillText('EGO',egoX-10,egoY+45);ctx.fillStyle='rgba(255,203,203,.88)';ctx.fillText(current.object,obsX-19,obsY-riskR-10);
  }

  function animate(now) {
    const delta = Math.min(.05,(now-lastFrame)/1000); lastFrame=now;
    if(running) simElapsed=(simElapsed+delta)%60;
    const mins=String(Math.floor(simElapsed/60)).padStart(2,'0'); const secs=(simElapsed%60).toFixed(1).padStart(4,'0');readouts.time.textContent=`${mins}:${secs}`;
    drawCanvas();requestAnimationFrame(animate);
  }

  function configureInteractions() {
    $('toggle-run').addEventListener('click',toggleRun);
    $('reset-sim').addEventListener('click',()=>{simElapsed=0;hazardRange=current.baseRange;range.value=String(hazardRange);syncPanel();});
    range.addEventListener('input',()=>{hazardRange=Number(range.value);syncPanel();});
    $('copy-trace').addEventListener('click', async (event)=>{const content=[`Scenario: ${current.name}`,`Decision: ${current.behavior}`,`TTC: ${dynamicTtc().toFixed(1)} s`,...current.trace.map((item,index)=>`${index+1}. ${item}`)].join('\n');try{await navigator.clipboard.writeText(content);event.target.textContent='Copied';setTimeout(()=>event.target.textContent='Copy',1200);}catch{event.target.textContent='Select text';}});
  }

  populateControls();configureInteractions();setScenario('cattle');syncPanel();requestAnimationFrame(animate);
})();
