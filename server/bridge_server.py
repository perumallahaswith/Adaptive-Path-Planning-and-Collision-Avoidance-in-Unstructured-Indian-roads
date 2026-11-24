"""
SIH-26037: FastAPI + WebSocket Simulation Orchestrator & Telemetry Bridge
Bridges Browser 3D Simulator with MATLAB/Simulink R2026a and Python Kinematics.
"""

import os
import sys
import json
import time
import asyncio
import subprocess
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIMULATOR_DIR = os.path.join(BASE_DIR, "simulator")
DATASETS_DIR = os.path.join(BASE_DIR, "datasets")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
LOGS_DIR = os.path.join(DATASETS_DIR, "synthetic_logs")

app = FastAPI(
    title="SIH-26037 Autonomous Driving Telemetry Server",
    description="Adaptive Path Planning and Collision Avoidance on Indian Unstructured Roads",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Active WebSocket clients
connected_clients: List[WebSocket] = []

# All 15 Indian Unstructured Road Scenarios Catalog (SIH-26037 Part 12)
ALL_SCENARIOS = {
    "cattle_crossing": {
        "id": "cattle_crossing",
        "name": "Sudden Stray Cattle Crossing Event",
        "category": "Critical Obstacle",
        "description": "Cruising at 42 km/h in right-side lane when stray cattle suddenly steps onto asphalt and freezes. Demonstrates sub-20ms radar detection, emergency stopping, and clearance hold.",
        "road_type": "Suburban 2-Way Carriageway (7.0m)",
        "ego_speed_kmh": 42,
        "agents": ["Stray Zebu Cow (Class 4)", "Oncoming Tata 1613 Heavy Truck (Class 1)"],
        "expected_fsm_state": "EMERGENCY_STOP"
    },
    "bridge_hazard": {
        "id": "bridge_hazard",
        "name": "Narrow Single-Lane Bridge Bottleneck",
        "category": "Bottleneck & Geometry",
        "description": "Narrow bridge corridor with concrete parapets on both sides. Broken-down auto-rickshaw blocks lane. Prohibits swerving; strictly holds straight in-lane stop until hazard cleared.",
        "road_type": "Narrow Bridge Deck (5.2m, Parapet Walls)",
        "ego_speed_kmh": 34,
        "agents": ["Stalled Auto-Rickshaw (Class 2)"],
        "expected_fsm_state": "BRIDGE_STOP"
    },
    "village_road": {
        "id": "village_road",
        "name": "Unmarked Rural Village Road with Slow Tractor",
        "category": "Unstructured Edge",
        "description": "Slow agricultural tractor blocks the legal lane. The planner waits for a predicted opposing-lane gap, passes with a swept-envelope check, then returns right.",
        "road_type": "Unmarked Rural Road (5.2m)",
        "ego_speed_kmh": 36,
        "agents": ["Swaraj Agricultural Tractor + Trailer (Class 5)", "Oncoming Two-Wheeler (Class 3)"],
        "expected_fsm_state": "OVERTAKE_LEFT"
    },
    "intersection": {
        "id": "intersection",
        "name": "Unsignalized Urban 4-Way Intersection",
        "category": "Multi-Agent Crossing",
        "description": "Chaotic 4-way unsignalized junction. Auto-rickshaw aggressively cuts across path without signal. Gap-acceptance yielding and multi-agent intent tracking.",
        "road_type": "Urban 4-Way Cross Road (8.0m / 7.0m)",
        "ego_speed_kmh": 30,
        "agents": ["Aggressive Auto-Rickshaw (Class 2)", "Crossing Two-Wheeler (Class 3)"],
        "expected_fsm_state": "INTERACTIVE_MERGE"
    },
    "highway_merge": {
        "id": "highway_merge",
        "name": "Highway On-Ramp Merge with Slow Vehicle",
        "category": "High-Speed Highway",
        "description": "NH-44 high-speed cruise at 65 km/h. Slow 3-wheeler merges abruptly from ramp into travel lane at 25 km/h. Anticipatory deceleration and smooth re-centering.",
        "road_type": "3-Lane Dual Carriageway (10.5m)",
        "ego_speed_kmh": 65,
        "agents": ["Merging Auto-Rickshaw (Class 2)", "Highway Traffic"],
        "expected_fsm_state": "INTERACTIVE_MERGE"
    },
    "dense_market": {
        "id": "dense_market",
        "name": "Dense Bazaar Corridor with Pushcarts & Crowds",
        "category": "Crowded Urban",
        "description": "Narrow market corridor with pushcart vendor and jaywalking pedestrians. Activates Inching Mode (creep at 2 m/s) preventing the Freezing Robot Problem.",
        "road_type": "Market Commercial Street (6.0m)",
        "ego_speed_kmh": 12,
        "agents": ["Pushcart Vendor (Class 5)", "Jaywalking Pedestrians (Class 6)", "Squeezing Two-Wheeler (Class 3)"],
        "expected_fsm_state": "INCHING"
    },
    "motorcycle_filtering": {
        "id": "motorcycle_filtering",
        "name": "Motorcycle Filtering & Lane Splitting",
        "category": "Gap Penetration",
        "description": "Fast two-wheeler weaves through tight lateral gaps between ego and oncoming traffic. Evaluates lateral safety envelope and asymmetric risk field.",
        "road_type": "Suburban Carriageway (7.4m)",
        "ego_speed_kmh": 40,
        "agents": ["Filtering Two-Wheeler (Class 3)", "Oncoming Traffic (Class 1)"],
        "expected_fsm_state": "NUDGE"
    },
    "pothole_avoidance": {
        "id": "pothole_avoidance",
        "name": "Severe Unpaved Crater / Pothole Avoidance",
        "category": "Road Surface Hazard",
        "description": "Large road crater blocks the wheel path. The vehicle waits for a certified opposing-lane window, clears it with footprint margin, then returns right.",
        "road_type": "Unmarked Rural Asphalt (6.0m)",
        "ego_speed_kmh": 35,
        "agents": ["Road Crater / Pothole (Class 7)"],
        "expected_fsm_state": "OVERTAKE_LEFT"
    },
    "sensor_degradation": {
        "id": "sensor_degradation",
        "name": "Monsoon Heavy Rain & Sensor Degradation",
        "category": "Sensor Failure Mode",
        "description": "Sudden heavy monsoon downpour reducing camera visibility to 35%. Validates Kalman filter weighting shift towards 77GHz Radar and LiDAR doppler lock.",
        "road_type": "Wet Asphalt Highway (7.4m)",
        "ego_speed_kmh": 32,
        "agents": ["Rain Particles", "Low-Visibility Pedestrian (Class 6)"],
        "expected_fsm_state": "NUDGE"
    },
    "stalled_vehicle": {
        "id": "stalled_vehicle",
        "name": "Stalled Vehicle with Heavy Oncoming Traffic",
        "category": "Scenario F (Oncoming Priority)",
        "description": "Disabled car blocks the lane while oncoming trucks retain priority. The system queues in GAP_WAIT, rechecks every tick, then passes and returns right once certified safe.",
        "road_type": "2-Lane Highway (7.4m)",
        "ego_speed_kmh": 40,
        "agents": ["Stalled Car (Class 1)", "Continuous Oncoming Trucks (Class 1)"],
        "expected_fsm_state": "OVERTAKE_LEFT"
    },
    "construction_detour": {
        "id": "construction_detour",
        "name": "Construction Barricade Channelizer Detour",
        "category": "Work Zone",
        "description": "Temporary roadwork barricades close the lane. The vehicle clears the complete channelized zone before a protected return to the right lane.",
        "road_type": "Suburban Road (7.0m)",
        "ego_speed_kmh": 30,
        "agents": ["Construction Barricades (Class 8)"],
        "expected_fsm_state": "OVERTAKE_LEFT"
    },
    "night_pedestrian": {
        "id": "night_pedestrian",
        "name": "Unlit Night Pedestrian Crossing",
        "category": "Low-Light ADAS",
        "description": "Zero ambient illumination night scene. Thermal/LiDAR detection of unreflective pedestrian stepping into path.",
        "road_type": "Unlit Rural Highway (7.4m)",
        "ego_speed_kmh": 35,
        "agents": ["Night Pedestrian (Class 6)"],
        "expected_fsm_state": "EMERGENCY_STOP"
    },
    "animal_herd": {
        "id": "animal_herd",
        "name": "Livestock Cluster with Certified Gap Pass",
        "category": "Animal Behavior",
        "description": "Livestock encroaches on the lane edge. The planner applies an expanded animal buffer, waits for oncoming traffic, then passes and returns right.",
        "road_type": "Rural Road with Shoulders (7.0m)",
        "ego_speed_kmh": 25,
        "agents": ["Cow Herd (3x Class 4)"],
        "expected_fsm_state": "OVERTAKE_LEFT"
    },
    "speed_breaker": {
        "id": "speed_breaker",
        "name": "Unmarked Speed Breaker / Road Bump",
        "category": "Vertical Hazard",
        "description": "Unmarked elevated asphalt speed bump. Vision-detected texture triggers target speed reduction to 15 km/h for ride comfort.",
        "road_type": "Urban Road (7.4m)",
        "ego_speed_kmh": 15,
        "agents": ["Speed Breaker (Class 9)"],
        "expected_fsm_state": "CRUISE (SPEED_GOVERNED)"
    },
    "reversion_recovery": {
        "id": "reversion_recovery",
        "name": "Multi-Obstacle S-Curve Reversion & Lane Recovery",
        "category": "Trajectory Smoothing",
        "description": "Sequential avoidance of vendor followed by parked auto, finishing with smooth asymptotic return to lane center (-1.85m).",
        "road_type": "Commercial Corridor (7.4m)",
        "ego_speed_kmh": 38,
        "agents": ["Pushcart (Class 5)", "Parked Auto (Class 2)"],
        "expected_fsm_state": "NUDGE"
    }
}

class MatlabRunRequest(BaseModel):
    action: str = "test_all" # "test_all" or "run_pipeline"
    scenario: Optional[str] = "cattle_crossing"

@app.get("/")
def root_redirect():
    return RedirectResponse(url="/simulator/index.html")

@app.get("/api/status")
def get_system_status():
    matlab_exe = r"C:\Program Files\MATLAB\R2026a\bin\matlab.exe"
    matlab_found = os.path.exists(matlab_exe)
    
    return {
        "status": "online",
        "service": "SIH-26037 Simulation & Telemetry Orchestrator",
        "backend": "FastAPI + Uvicorn + WebSockets",
        "matlab_installed": matlab_found,
        "matlab_path": matlab_exe if matlab_found else "Not detected",
        "total_scenarios_supported": len(ALL_SCENARIOS),
        "active_clients": len(connected_clients),
        "timestamp": time.time()
    }

@app.get("/api/scenarios")
def list_scenarios():
    return {
        "total": len(ALL_SCENARIOS),
        "scenarios": list(ALL_SCENARIOS.values())
    }

@app.get("/api/scenario/{name}")
def get_scenario(name: str):
    if name not in ALL_SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{name}' not found.")
    return ALL_SCENARIOS[name]

@app.get("/api/metrics")
def get_benchmark_metrics():
    metrics = []
    if os.path.exists(LOGS_DIR):
        for fname in os.listdir(LOGS_DIR):
            if fname.endswith("_planner_eval.json"):
                fpath = os.path.join(LOGS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        metrics.append(json.load(f))
                except Exception:
                    pass
    return {"count": len(metrics), "metrics": metrics}

@app.post("/api/run_matlab")
async def run_matlab_command(req: MatlabRunRequest):
    matlab_exe = r"C:\Program Files\MATLAB\R2026a\bin\matlab.exe"
    if not os.path.exists(matlab_exe):
        matlab_exe = "matlab"
        
    if req.action == "test_all":
        cmd_expr = "addpath(genpath('src')); addpath(genpath('scenarios')); addpath(genpath('tests')); test_all_scenarios();"
    else:
        scen = req.scenario or "cattle_crossing"
        cmd_expr = f"addpath(genpath('src')); addpath(genpath('scenarios')); history = run_full_pipeline('{scen}');"
        
    full_cmd = [matlab_exe, "-batch", cmd_expr]
    
    t0 = time.time()
    try:
        proc = await asyncio.to_thread(
            subprocess.run, full_cmd, cwd=BASE_DIR, capture_output=True, text=True, timeout=120
        )
        elapsed = round(time.time() - t0, 2)
        return {
            "success": proc.returncode == 0,
            "exit_code": proc.returncode,
            "elapsed_seconds": elapsed,
            "stdout": proc.stdout,
            "stderr": proc.stderr
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="MATLAB execution timed out after 120s.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute MATLAB: {str(e)}")

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        # Send initial handshake message
        await websocket.send_json({
            "type": "handshake",
            "message": "Connected to SIH-26037 Live Telemetry Engine",
            "server_time": time.time(),
            "fsm_frequency_hz": 60
        })
        
        while True:
            # Receive client telemetry
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Echo telemetry state or broadcast
                if msg.get("type") == "client_telemetry":
                    # Broadcast telemetry to other monitors if any
                    pass
            except Exception:
                pass
                
    except WebSocketDisconnect:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
    except Exception:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

# Mount static directories
app.mount("/simulator", StaticFiles(directory=SIMULATOR_DIR, html=True), name="simulator")
app.mount("/datasets", StaticFiles(directory=DATASETS_DIR), name="datasets")
if os.path.exists(DOCS_DIR):
    app.mount("/docs", StaticFiles(directory=DOCS_DIR), name="docs")

