# SIH-26037: Comprehensive Technical Implementation Audit
## Vehicle Adaptive Motion Planning and Collision Avoidance System for Indian Unstructured Roads

**Author:** Autonomous Systems & Simulation Engineering Lead  
**Date:** November 2026  
**Project:** Smart India Hackathon (SIH 26037)  
**Target Environment:** MATLAB & Simulink R2026a, Python 3.13 (FastAPI/WebSocket), Three.js WebGL Digital Twin  

---

## 1. Existing Architecture Overview

The repository represents a multi-tiered autonomous driving research framework structured into three core computational layers:

1. **MATLAB / Simulink Core (`src/`, `planners/`, `scenarios/`):**
   * High-fidelity mathematical modeling of vehicle dynamics, multi-sensor perception fusion, motion prediction, Stateflow finite-state machine (FSM) decision-making, potential risk fields, and spatiotemporal trajectory optimization.
   * Native MathWorks toolboxes utilized: Automated Driving Toolbox, Sensor Fusion & Tracking Toolbox, Navigation Toolbox, Optimization Toolbox, Control System Toolbox, and Vehicle Dynamics Blockset.

2. **Python Orchestration & Verification Layer (`run_simulator.py`, `verify_simulator.py`, `setup_datasets.py`, `fetch_sample_data.py`):**
   * Coordinates local HTTP hosting, dataset catalog initialization, regression test execution via Chrome DevTools Protocol (CDP), and batch execution of MATLAB pipelines.

3. **Client-Side Visual Simulation & ADAS HUD (`simulator/`):**
   * Real-time 3D Three.js WebGL environment simulating two-way Indian road geometry, heterogeneous road agents (Tata 1613 trucks, Swaraj tractors, Bajaj auto-rickshaws, stray Zebu cattle, pushcarts, pedestrians), simulated 77 GHz radar cone, rooftop LiDAR scanner, 2D YOLOv8 ADAS camera canvas HUD, and telemetry gauges.

```
+---------------------------------------------------------------------------------------+
|                                SIMULATION ENVIRONMENT                                 |
|               Heterogeneous Indian Road Actors (Cattle, Autos, Tractors, Pushcarts)   |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         PERCEPTION & MULTI-SENSOR FUSION                              |
|           Camera (60 FPS HDR) | 77 GHz mmWave Radar | 64-Beam 3D LiDAR | Odometry     |
|           MATLAB: multi_sensor_fusion.m (GNN Data Association & Track Manager)        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       SHORT-TERM MOTION & INTENT PREDICTION                           |
|       Cattle Brownian/Pause Model | Auto CTRA Swerve | Pushcart Linear Drift          |
|       MATLAB: agent_trajectory_predictor.m | JS: Dynamic Risk Decal & Bounding Boxes  |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                     BEHAVIORAL DECISION ENGINE (STATEFLOW FSM)                        |
|       CRUISE <-> NUDGE <-> INCHING <-> INTERACTIVE_MERGE <-> EMERGENCY_STOP           |
|       Hysteresis Debounce (0.4s dwell) | Scenario F Oncoming Traffic Yield Constraint |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         ADAPTIVE SPATIOTEMPORAL PLANNER                               |
|       Quintic Polynomial Candidate Generation | Asymmetric Dynamic Potential Risk     |
|       Continuous 2D Bounding Box Collision Validation | Road Boundary Constraint      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                         VEHICLE CONTROL & MOTION EXECUTION                            |
|       Stanley Lateral Steering Controller | Longitudinal Gain-Scheduled Deceleration  |
|       Kinematic Bicycle Plant (L = 2.8m, Front-Axle Heading & Cross-Track Feedback)   |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                       REAL-TIME TELEMETRY & 3D BROWSER HUD                            |
|       Three.js 3D View | YOLOv8 ADAS Sub-window | Cockpit Dials | Benchmark Metrics   |
+---------------------------------------------------------------------------------------+
```

---

## 2. Actual Execution Flow

1. **Standalone MATLAB Pipeline (`src/run_full_pipeline.m` / `main_simulation_demo.m`):**
   * Loads scenario actor definitions (`benchmark_scenarios.m` or `create_indian_road_scenarios.m`).
   * Iterates at $dt = 0.1\text{s}$ ($10\text{ Hz}$).
   * In each step:
     - Extracts ground-truth actor positions and applies measurement noise to emulate sensor detections.
     - Runs `multi_sensor_fusion.m` to maintain active confirmed tracks.
     - Predicts forward trajectories over a $3.0\text{s}$ horizon via `agent_trajectory_predictor.m`.
     - Evaluates FSM state in `behavioral_stateflow_fsm.m`.
     - Optimizes spatiotemporal trajectory in `adaptive_trajectory_planner.m` using potential risk field costs.
     - Computes steering angle $\delta(t)$ using `stanley_lateral_controller.m` and acceleration using `longitudinal_speed_controller.m`.
     - Integrates vehicle states $[x, y, \psi, v]$ through `vehicle_dynamics_bicycle.m`.
     - Displays live MATLAB 2D figure with safety bubbles, HUD text annotations, and calculates post-simulation metrics in `evaluate_benchmark_metrics.m`.

2. **Browser 3D Simulator Execution Flow (`simulator/index.html` + `app.js`):**
   * Initializes Three.js WebGL scene, lighting, asphalt shader, and roadside props in `world3d.js`.
   * Spawns ego vehicle in Right-Side Lane ($X = -1.85\text{m}$, nominal travel lane) and oncoming Tata 1613 heavy truck in Left-Side Lane ($X = +1.85\text{m}$) in `obstacles.js`.
   * In each animation frame ($\sim 60\text{ FPS}$, $dt \approx 0.016\text{s}$):
     - Updates scenario triggers (`scenarios.js`) and dynamic obstacle movement (`obstacles.js`).
     - Executes mathematical autonomous driving brain step (`planner.js`): radar scan, oncoming threat evaluation, behavioral FSM state transitions, quintic candidate trajectory generation, spatiotemporal AABB collision checking, cost evaluation, and Stanley steering control.
     - Updates vehicle kinematics and physical boundary collision guard (`vehicle.js`).
     - Renders YOLOv8 ADAS computer vision canvas and telemetry charts (`computervision.js`, `app.js`).
     - Updates 3D camera and Three.js scene.

---

## 3. MATLAB Algorithm Inventory

| File Path | Functional Purpose | Status | Audit Findings |
| :--- | :--- | :--- | :--- |
| `src/run_full_pipeline.m` | Complete closed-loop execution script connecting all subsystems | **BROKEN** | Line 110 failed with `A dot '.' indexing expression produced a comma-separated list with 0 values where only a single value is allowed` because `history` struct was initialized with `'state', {}`, creating a 0x0 struct array. |
| `src/prediction/agent_trajectory_predictor.m` | Predicts future states $[x, y, vx, vy]$ across horizons for cattle, autos, pushcarts | **BROKEN** | Line 62 failed with `Subscripted assignment between dissimilar structures` because `predictedTrajectories` struct was not preallocated or structured consistently. |
| `scenarios/create_indian_road_scenarios.m` | Legacy scenario generator using Automated Driving Toolbox | **BROKEN** | Line 164 failed with `Expected SensorLocation to be an array with number of elements equal to 2` in `visionDetectionGenerator`. Also threw warnings creating custom actors with `vehicle(..., 'ClassID', 5)`. |
| `main_simulation_demo.m` | Legacy simulation demonstration script | **BROKEN** | Depended on `create_indian_road_scenarios.m` and suffered from the same 0x0 struct array issue in `history.mode`. |
| `src/scenarios/benchmark_scenarios.m` | Standard benchmark scenario generator for 5 core scenarios | **WARNING** | Used `vehicle(scenario, 'ClassID', 5, ...)` for tractor, which causes Automated Driving Toolbox warnings. |
| `src/perception/multi_sensor_fusion.m` | Multi-sensor tracking filter with GNN data association and track confirmation | **WORKING** | Verified working in unit tests. Confirms tracks after 2 hits, coasts and prunes stale tracks. |
| `src/decision/behavioral_stateflow_fsm.m` | 5-state behavioral FSM with debounce hysteresis | **WORKING** | Clean state machine, but needs adaptation to support full 12-state Indian road maneuvers. |
| `src/planning/adaptive_trajectory_planner.m` | Quintic polynomial sampling with potential risk field costs | **WORKING** | Latency initially spiked to 204ms on cold start due to JIT compilation; needs warmup in test scripts. |
| `src/planning/potential_risk_field.m` | Class-specific asymmetric elliptical potential field | **WORKING** | Clean mathematical formulation ($a_c, b_c, A_c$). |
| `src/control/stanley_lateral_controller.m` | Front-axle Stanley lateral controller | **WORKING** | Correct control law implementation. |
| `src/control/longitudinal_speed_controller.m` | Gain-scheduled longitudinal PID speed controller | **WORKING** | Clean PID controller. |
| `src/control/vehicle_dynamics_bicycle.m` | Dynamic/kinematic bicycle model plant | **WORKING** | Clean Euler integration of state $[x, y, \psi, v]$. |
| `src/metrics/evaluate_benchmark_metrics.m` | Computes benchmark scorecard (latency, clearance, TTC) | **WORKING** | Generates tabular report. |
| `tests/test_path_planner.m` | Unit test for trajectory planner | **BROKEN** | Threw assert error because it did not include JIT warmup, causing initial 204ms spike to exceed 50ms benchmark. |
| `tests/test_all_scenarios.m` | Batch test across 5 scenarios | **BROKEN** | Failed during scenario 1 due to predictor struct mismatch error in `agent_trajectory_predictor.m`. |
| `tests/test_perception_fusion.m` | Unit test for fusion tracking filter | **WORKING** | All 3 unit tests passed cleanly. |

---

## 4. Python Integration Inventory

| File Path | Purpose | Status | Audit Findings |
| :--- | :--- | :--- | :--- |
| `run_simulator.py` | Local HTTP server launcher | **LIMITED** | Only served static HTTP files. Did not provide WebSocket or REST API bridge to connect the backend simulation engine to the browser. |
| `verify_simulator.py` | Automated CDP test script for headless Chrome | **WORKING** | Verified 100% pass across Cattle, Bridge, Village Road, and Dense Market scenarios. |
| `setup_datasets.py` | Directory creator and catalog JSON generator | **WORKING** | Created directory structure and wrote `indian_road_agents_catalog.json`. |
| `fetch_sample_data.py` | Downloads sample obstacle images from Wikimedia | **UNEXECUTED** | Script contains valid URLs for public domain Indian road obstacle images, but had not been executed to download files into `datasets/raw_samples/`. |
| `Launch_Simulator.bat` | Windows batch launcher | **WORKING** | Launches `python run_simulator.py`. |

---

## 5. Browser Simulator Inventory

| File Path | Purpose | Status | Audit Findings |
| :--- | :--- | :--- | :--- |
| `simulator/index.html` | Presentation dashboard & WebGL canvas | **WORKING** | Clean responsive UI, dials, mini charts, scenario buttons, weather/camera controls, and Client Brief modal. |
| `simulator/js/app.js` | UI event listeners, animation loop, telemetry updates | **WORKING** | Orchestrates 3D rendering, scenario switching, HUD sync, and keyboard manual driving. |
| `simulator/js/planner.js` | Autonomous driving brain (FSM, potential fields, Stanley controller) | **WORKING** | Corrected Right-Side Lane convention, oncoming vehicle yielding, and spatiotemporal AABB collision validation. |
| `simulator/js/vehicle.js` | 3D Ego vehicle mesh, kinematics, and physical collision guard | **WORKING** | Implemented AABB motion collision guard, radar cone sweep, and right white line clamp ($x - hW \ge -3.65\text{m}$). |
| `simulator/js/obstacles.js` | 3D meshes for Indian actors (cow, auto, tractor, pushcart, truck) | **WORKING** | Bounding box dimensions ($hL, hW$) and dynamic risk decals properly modeled. |
| `simulator/js/world3d.js` | 3D road, markings, bridge mode, day/sunset/rain/night lighting | **WORKING** | Painted lane markings: "▲ TRAVEL LANE" on right, "▲ INCOMING" on left. |
| `simulator/js/computervision.js` | Live 2D ADAS camera canvas with YOLOv8 bounding boxes and TTC | **WORKING** | Overlays real-time tracked bounding boxes and distance/TTC tags. |

---

## 6. Dataset Availability and Quality

* **`datasets/annotations/`**: Currently **EMPTY**. Needs genuine or verified synthetic annotations (YOLO / VOC bounding box format) for heterogeneous Indian road actors.
* **`datasets/raw_samples/`**: Directories exist (`cattle`, `autorickshaw`, `pushcart`, `two_wheeler`, `pedestrians`), but contain 0 image files.
* **`datasets/synthetic_logs/`**: Currently **EMPTY**. Needs deterministic, reproducible simulation logs (CSV / MAT format) recording ground truth states, sensor measurements, and planner decisions.
* **`datasets/indian_road_agents_catalog.json`**: **VALID**. Specifies dimensions, speeds, and behavior models for 6 heterogeneous agent classes.

---

## 7. Current Bugs and Weaknesses

1. **MATLAB Struct Array Initialization Bug:**
   In `src/run_full_pipeline.m` and `main_simulation_demo.m`, initializing `history = struct(..., 'state', {}, ...)` creates a 0x0 struct array, causing runtime crashes when appending simulation data.
2. **MATLAB Predictor Struct Field Mismatch:**
   In `src/prediction/agent_trajectory_predictor.m`, `predictedTrajectories(end+1) = pred;` fails with `Subscripted assignment between dissimilar structures` across heterogeneous actor types.
3. **MATLAB Automated Driving Toolbox Sensor Location Dimension Bug:**
   In `scenarios/create_indian_road_scenarios.m`, `visionDetectionGenerator` fails because `SensorLocation` is given as 3 elements instead of 2.
4. **MATLAB `vehicle` vs `actor` ClassID Warning:**
   In `benchmark_scenarios.m` and `create_indian_road_scenarios.m`, calling `vehicle(scenario, 'ClassID', 5)` causes MATLAB warnings because `vehicle` only accepts ClassID 1 or 2.
5. **No Warmup in MATLAB Planner Latency Tests:**
   In `tests/test_path_planner.m`, measuring latency on the very first JIT compilation cycle causes latency to report $> 200\text{ms}$, failing the 50ms unit test assertion.
6. **Lack of Live Backend WebSocket / REST Integration:**
   `run_simulator.py` was merely a static file server; the browser simulator could not stream telemetry from the live Python/MATLAB execution pipeline.
7. **Empty Dataset Folders:**
   Sample images and synthetic benchmark trajectory logs were not persisted on disk.
8. **Scenario Coverage:**
   The browser simulator has 6 benchmark scenarios, but needs comprehensive coverage of all 15 Indian unstructured road edge cases specified in Part 12.

---

## 8. Missing Functionality

1. **Python-to-MATLAB Bridge Service:**
   A unified Python service providing WebSocket telemetry streaming and HTTP control endpoints (`/api/scenario`, `/api/state`, `/api/run_matlab_pipeline`).
2. **Offline Public Indian Road Samples:**
   Execution of `fetch_sample_data.py` to populate `datasets/raw_samples/` with public domain visual samples and standard bounding box annotations in `datasets/annotations/`.
3. **Reproducible Synthetic Benchmark Logs:**
   Standardized synthetic telemetry logs (`datasets/synthetic_logs/`) capturing scenario trajectories, perception outputs, and planner metrics in CSV and JSON formats.
4. **Expanded 15-Scenario Test Matrix:**
   Comprehensive MATLAB and Python test scripts verifying all 15 scenarios (including motorcycle filtering, pothole surface hazard, sensor degradation, and recovery after avoidance).

---

## 9. Existing Tests and Results

| Test Script | Execution Result | Root Cause / Notes |
| :--- | :--- | :--- |
| `tests/test_perception_fusion.m` | **PASS (3/3)** | Verified track initialization, 2-hit confirmation, and coasting/pruning. |
| `tests/test_path_planner.m` | **FAIL (JIT Latency)** | First-run JIT latency (204.65ms) exceeded 50ms benchmark; passed after JIT warmup. |
| `tests/test_all_scenarios.m` | **FAIL (Runtime Error)** | Crash in `agent_trajectory_predictor.m` line 62 due to struct field mismatch. |
| `src/run_full_pipeline.m` | **FAIL (Runtime Error)** | Crash in line 110 due to 0x0 struct array initialization of `history`. |
| `main_simulation_demo.m` | **FAIL (Runtime Error)** | Crash in `create_indian_road_scenarios.m` due to `SensorLocation` 3-element parameter. |
| `verify_simulator.py` (Browser CDP) | **PASS (6/6)** | Verified road geometry, straight cruise, cattle emergency stop/hold, narrow bridge stop, village road tractor avoidance, and dense market inching. |

---

## 10. Proposed Improvements & Engineering Roadmap

1. **Repair MATLAB Codebase:**
   * Fix `src/run_full_pipeline.m` and `main_simulation_demo.m` struct initializations.
   * Fix `src/prediction/agent_trajectory_predictor.m` preallocation and struct homogeneity.
   * Fix `scenarios/create_indian_road_scenarios.m` sensor locations and actor ClassIDs.
   * Add JIT warmup to `tests/test_path_planner.m`.
   * Ensure `tests/test_all_scenarios.m` runs cleanly across all scenarios with zero collisions.

2. **Build Python Backend Simulation & Integration Service:**
   * Upgrade `run_simulator.py` to run an integrated HTTP + WebSocket server.
   * Stream live vehicle states, confirmed tracks, candidate trajectories, and FSM decisions.
   * Provide endpoints to execute MATLAB batch simulations and fetch benchmark metrics.

3. **Curate Datasets & Generate Synthetic Logs:**
   * Download sample visual data via `fetch_sample_data.py`.
   * Create standardized YOLO/VOC annotations in `datasets/annotations/`.
   * Generate deterministic synthetic scenario logs in `datasets/synthetic_logs/`.
   * Generate `datasets/DATASET_MANIFEST.md`.

4. **Expand Scenarios & Validate 15 Test Cases:**
   * Implement and verify all 15 required scenarios in MATLAB and the 3D simulator.
   * Ensure full vehicle swept footprint collision checking and strict road boundary adherence.

5. **Generate Comprehensive Reports & Reviewer Interface:**
   * Generate `docs/BENCHMARK_RESULTS.md`, `docs/SYSTEM_SPECIFICATION.md`, `docs/ARCHITECTURE_DIAGRAMS.md`, and `docs/FINAL_IMPLEMENTATION_REPORT.md`.
   * Update `README.md` and `Launch_Simulator.bat`.

---

## 11. Files to be Modified or Created

* **Modified:**
  * `src/run_full_pipeline.m`
  * `src/prediction/agent_trajectory_predictor.m`
  * `src/scenarios/benchmark_scenarios.m`
  * `scenarios/create_indian_road_scenarios.m`
  * `main_simulation_demo.m`
  * `tests/test_path_planner.m`
  * `tests/test_all_scenarios.m`
  * `run_simulator.py`
  * `Launch_Simulator.bat`
  * `README.md`
  * `docs/BENCHMARK_RESULTS.md`
  * `docs/SYSTEM_SPECIFICATION.md`
  * `docs/ARCHITECTURE_DIAGRAMS.md`
* **Created:**
  * `docs/IMPLEMENTATION_AUDIT.md` (this file)
  * `datasets/DATASET_MANIFEST.md`
  * `datasets/annotations/*`
  * `datasets/synthetic_logs/*`
  * `docs/FINAL_IMPLEMENTATION_REPORT.md`

---

## 12. Dependencies Required

* **MATLAB Toolboxes:** Automated Driving Toolbox, Sensor Fusion & Tracking Toolbox, Navigation Toolbox, Optimization Toolbox, Control System Toolbox (All verified installed in MATLAB R2026a).
* **Python Packages:** `fastapi`, `uvicorn`, `websockets`, `requests`, `numpy`, `matplotlib` (All verified installed in Python 3.13).
* **Browser:** Chrome / Edge with WebGL support.

