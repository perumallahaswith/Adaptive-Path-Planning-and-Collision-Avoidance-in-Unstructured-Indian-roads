// Onboard Computer Vision ADAS Camera Feed with Live YOLOv8 Inference Simulation
class ComputerVisionHUD {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    // Internal Canvas Resolution
    this.width = 480;
    this.height = 250;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Class Color Map
    this.colorMap = {
      4: '#ff3366', // Stray Cattle (Crimson)
      2: '#ffb703', // Auto-Rickshaw (Electric Amber)
      5: '#f77f00', // Tractor / Pushcart (Orange)
      6: '#00f0ff', // Pedestrian (Cyan)
      9: '#ffcc00', // Speed Breaker (Yellow Warning)
      default: '#00ff88'
    };
  }
  
  render(egoVehicle, obstacles, activeState, weather = 'DAY') {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    
    // Clear Background (Simulated Dark Windshield Camera Capture)
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, w, h);
    
    // Simulated Rain Particle Streaks on Windshield in Rain Mode
    if (weather === 'RAIN') {
      ctx.fillStyle = 'rgba(180, 220, 255, 0.18)';
      for (let i = 0; i < 35; i++) {
        const rx = ((i * 37 + (performance.now() * 0.04)) % w);
        const ry = ((i * 23 + (performance.now() * 0.45)) % h);
        ctx.fillRect(rx, ry, 1.5, 14);
      }
    }
    
    // 1. Draw Road Perspective Lines (Vanishing Point Horizon)
    const horizonY = h * 0.42;
    const vpX = w * 0.5 - (egoVehicle.steerAngle * 45); // Shifting vanishing point with steering
    
    // Asphalt Ground Gradient
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, '#151b28');
    groundGrad.addColorStop(1, '#0b101c');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);
    
    // Lane Marking Projections
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    
    // Left oncoming edge line
    ctx.beginPath();
    ctx.moveTo(vpX, horizonY);
    ctx.lineTo(15, h);
    ctx.stroke();
    
    // Center divider line (Yellow dash to the driver's left)
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.45)';
    ctx.beginPath();
    ctx.moveTo(vpX, horizonY);
    ctx.lineTo(w * 0.35, h);
    ctx.stroke();
    
    // Right solid white shoulder line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(vpX, horizonY);
    ctx.lineTo(w - 15, h);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 2. Artificial Horizon & Center Reticle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, horizonY);
    ctx.lineTo(w * 0.65, horizonY);
    ctx.stroke();
    
    // Targeting Crosshairs
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, horizonY);
    ctx.lineTo(w / 2 + 8, horizonY);
    ctx.moveTo(w / 2, horizonY - 8);
    ctx.lineTo(w / 2, horizonY + 8);
    ctx.stroke();
    
    // 3. Project 3D Obstacles to 2D Bounding Boxes
    const detectedTargets = [];
    
    obstacles.forEach(obs => {
      const relX = obs.x - egoVehicle.x;
      const relZ = obs.z - egoVehicle.z;
      
      // Must be ahead of ego vehicle and within camera field of view (max 70m)
      if (relZ > 2.0 && relZ < 70.0) {
        // Perspective Camera Projection
        const fovScale = 220 / relZ;
        const screenX = vpX - ((obs.x - egoVehicle.x) * fovScale);
        const screenY = horizonY + (1.2 * fovScale);
        
        const boxW = Math.max(22, (obs.b_lat || 1.8) * fovScale * 1.1);
        const boxH = Math.max(26, (obs.a_long || 3.0) * fovScale * 0.9);
        
        const bx = screenX - boxW / 2;
        const by = screenY - boxH;
        
        // Check if within viewport
        if (bx + boxW > 0 && bx < w && by + boxH > 0 && by < h) {
          const color = this.colorMap[obs.classId] || this.colorMap.default;
          const obsHL = obs.hL || (obs.length ? obs.length / 2 : 1.2);
          const physicalGap = Math.max(0, relZ - (2.35 + obsHL));
          const dist = (relZ > 0 && Math.abs(relX) < 3.2) ? physicalGap : Math.hypot(relX, relZ);
          const relSpeed = Math.max(0.2, egoVehicle.speed - (obs.speed || 0));
          const ttc = dist / relSpeed;
          
          detectedTargets.push({
            name: obs.name,
            classId: obs.classId,
            dist,
            ttc,
            color
          });
          
          // Draw YOLO Bounding Box Corners
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, boxW, boxH);
          
          // Translucent fill
          ctx.fillStyle = `${color}18`;
          ctx.fillRect(bx, by, boxW, boxH);
          
          // Class Badge Header
          ctx.fillStyle = color;
          ctx.fillRect(bx, by - 16, boxW, 16);
          
          // Label Text
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`${obs.name.toUpperCase()} ${(95.5 + (obs.id % 4)).toFixed(1)}%`, bx + 4, by - 4);
          
          // Telemetry Footnote: Distance & TTC
          ctx.fillStyle = color;
          ctx.font = '8.5px monospace';
          ctx.fillText(`${dist.toFixed(1)}m | TTC:${ttc < 10 ? ttc.toFixed(1) + 's' : 'SAFE'}`, bx, by + boxH + 11);
        }
      }
    });
    
    // 4. On-Screen ADAS Status Text Overlays
    if (weather === 'RAIN') {
      ctx.fillStyle = '#ffb703';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(`CAM_01: DEGRADED (RAIN ATTENUATION) | 48% CONF`, 10, 16);
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('[77 GHz RADAR & 3D LIDAR FUSION PRIMARY LOCK]', 10, 30);
    } else {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.font = 'bold 9.5px monospace';
      ctx.fillText(`CAM_01: 60 FPS | 1080p ADAS HDR`, 10, 16);
      ctx.fillText('TRAVEL LANE: [RIGHT LANE (+Z)]', 10, 30);
    }
    
    // Active Stateflow Mode Banner
    ctx.textAlign = 'right';
    if (activeState === 'EMERGENCY_STOP' || activeState === 'BRIDGE_STOP') {
      ctx.fillStyle = '#ff3366';
      ctx.fillText(`[AEB BRAKE ACTIVE]`, w - 10, 16);
    } else if (activeState === 'INCHING') {
      ctx.fillStyle = '#f72585';
      ctx.fillText(`[INCHING CREEP 2.0 m/s]`, w - 10, 16);
    } else {
      ctx.fillStyle = '#00ff88';
      ctx.fillText(`[FSD AUTOPILOT ACTIVE]`, w - 10, 16);
    }
    ctx.textAlign = 'left';
    
    return detectedTargets;
  }
}
