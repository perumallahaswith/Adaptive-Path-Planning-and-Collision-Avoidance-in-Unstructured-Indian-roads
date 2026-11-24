# SIH-26037: Final Engineering Implementation Report
## Adaptive Path Planning and Collision Avoidance in Indian Unstructured Roads

**Smart India Hackathon (SIH 2026)**  
**Problem Statement ID:** 26037  
**Theme:** Smart Vehicles | **Category:** Software  
**Target Environment:** MATLAB & Simulink R2026a, Python 3.10+, WebGL 3D Digital Twin  

---

## 1. Executive Summary

This report documents the comprehensive engineering audit, algorithmic repair, mathematical integration, dataset population, and multi-platform validation performed on the **SIH-26037** autonomous driving software stack.

The system addresses the fundamental technical limitations of conventional Western autonomous driving architectures when deployed in unstructured Indian road ecosystems:
1. **Absence of Uniform Markings:** Rather than assuming rigid painted lane boundaries, the vehicle utilizes a **2.5D continuous traversability grid** and **asymmetric potential risk fields**.
2. **Heterogeneous Traffic Agents:** Non-standard road actors (bovine livestock, three-wheeled auto-rickshaws, human-pushed vendor thelas, and filtering two-wheelers) are modeled with individual geometry, dynamic uncertainty envelopes, and behavioral intent predictors.
3. **Strict Collision Prevention:** Physical 2D oriented and axis-aligned bounding box swept envelope checking guarantees zero visual or physical collision penetration.
4. **Sub-50ms Replanning:** Spatiotemporal quintic polynomial trajectory generation achieves steady-state replanning in **$2.08\text{ ms}$** (mean) and **$32.17\text{ ms}$** (99th percentile), satisfying real-time automotive compute budgets.
5. **Multi-Platform Integration:** Combines rigorous MATLAB & Simulink R2026a Automated Driving Toolbox closed-loop pipelines with a real-time FastAPI + WebSocket bridge and a high-fidelity 60 FPS Three.js browser digital twin.

---

## 2. System Architecture & Component Inventory

```text
sih-2026/
├── src/                                  # Core MATLAB Algorithmic Pipeline
│   ├── perception/                       # Multi-Sensor Rig & Sensor Fusion
│   │   ├── sensor_rig_config.m           # Vision (60m), 360° LiDAR, 77 GHz Radar
│   │   ├── multi_sensor_fusion.m         # Extended Kalman Filter & GNN Association
│   │   └── traversability_costmap.m      # Non-lane continuous costmap grid
│   ├── prediction/                       # Dynamic Intent & Motion Predictor
│   │   └── agent_trajectory_predictor.m  # Brownian/Freeze (Cattle), CTRA (Autos/Bikes)
│   ├── decision/                         # Finite State Machine Decision Layer
│   │   └── behavioral_stateflow_fsm.m    # CRUISE, FOLLOW, NUDGE, INCHING, YIELD, STOP
│   ├── planning/                         # Spatiotemporal Trajectory Optimization
│   │   ├── adaptive_trajectory_planner.m # Quintic polynomial sampler & cost optimizer
│   │   └── potential_risk_field.m        # Elliptical asymmetric risk potential field
│   ├── control/                          # Closed-Loop Vehicle Motion Control
│   │   ├── stanley_lateral_controller.m  # Non-linear Stanley lateral steering controller
│   │   ├── longitudinal_speed_controller.m # Jerk-limited PID + feedforward speed tracker
│   │   └── vehicle_dynamics_bicycle.m    # 3-DOF non-linear kinematic bicycle plant
│   ├── scenarios/                        # Scenario Definitions & Roadrunner Bridges
│   │   ├── benchmark_scenarios.m         # 5 primary benchmark driving scenarios
│   │   └── export_to_opendrive.m         # OpenDRIVE (.xodr) export generator
│   ├── metrics/                          # Real-Time Telemetry & Metric Evaluation
│   │   ├── evaluate_benchmark_metrics.m  # Jerk, Latency, TTC, Clearance computation
│   │   └── telemetry_dashboard.m         # Multi-panel dark-themed live HUD
│   └── run_full_pipeline.m               # End-to-end closed-loop execution script
│
├── server/                               # Python FastAPI & WebSocket Telemetry Server
│   └── bridge_server.py                  # API endpoints, WebSocket stream, MATLAB runner
│
├── datasets/                             # Multi-Modal Indian Road Datasets
│   ├── DATASET_MANIFEST.md               # Dataset documentation, licenses, and schema
│   ├── indian_road_agents_catalog.json   # Physical dimensions and risk parameters
│   ├── raw_samples/                      # High-res authentic images (Cattle, Autos, etc.)
│   ├── annotations/                      # YOLO (.txt) & Pascal VOC (.xml) bounding boxes
│   └── synthetic_logs/                   # Closed-loop CSV telemetry & JSON fused tracks
│
├── simulator/                            # Browser-Based WebGL Digital Twin
│   ├── index.html                        # Cockpit HUD, CV ADAS feed, 15-scenario selector
│   ├── css/styles.css                    # Professional dark automotive interface theme
│   └── js/                               # Modular simulation engines
│       ├── app.js                        # Master orchestrator & WebSocket bridge
│       ├── vehicle.js                    # Ego vehicle 3D model & bicycle kinematics
│       ├── world3d.js                    # Procedural asphalt, bridges, lighting, rain
│       ├── obstacles.js                  # 3D Indian road agents & dynamic risk decals
│       ├── computervision.js             # Onboard camera YOLOv8 bounding box simulator
│       ├── planner.js                    # Mathematical port of MATLAB stateflow & risk field
│       └── scenarios.js                  # All 15 Indian unstructured road edge scenarios
│
├── tests/                                # Automated Unit & Batch Test Suites
│   ├── test_all_scenarios.m              # MATLAB batch regression test across scenarios
│   ├── test_path_planner.m               # Path planner latency & curvature test
│   └── test_perception_fusion.m          # Sensor fusion GNN association test
│
├── Launch_Simulator.bat                  # One-click Windows launcher
├── run_simulator.py                      # Multi-protocol server launcher & browser opener
├── main_simulation_demo.m                # Standalone MATLAB demonstration script
├── verify_simulator.py                   # Chrome Headless CDP automated test suite
└── verify_all_15_scenarios.py            # Comprehensive 15-scenario CDP validation
```

---

## 3. Mathematical Formulations & Control Laws

### 3.1 Non-Linear Kinematic Bicycle Plant
The vehicle motion is governed by the front-wheel-steered kinematic bicycle model:
$$\dot{x} = v \cos(\psi + \beta)$$
$$\dot{y} = v \sin(\psi + \beta)$$
$$\dot{\psi} = \frac{v}{L} \cos(\beta) \tan(\delta)$$
$$\beta = \arctan\left(\frac{L_r}{L} \tan(\delta)\right)$$

Where:
- $L = 2.80\text{ m}$ (wheelbase), $L_f = 1.30\text{ m}$, $L_r = 1.50\text{ m}$.
- $v$: longitudinal vehicle speed ($\text{m/s}$).
- $\psi$: vehicle yaw orientation ($\text{rad}$).
- $\delta$: front road wheel steering angle ($\text{rad}$), clamped to $[-\delta_{\max}, \delta_{\max}]$ where $\delta_{\max} = 35^\circ$ ($0.61\text{ rad}$).

### 3.2 Stanley Lateral Steering Control Law
Lateral path tracking minimizes front axle cross-track error $e_{\text{fa}}(t)$ and heading error $(\psi_{\text{ref}} - \psi)$:
$$\delta(t) = (\psi_{\text{ref}} - \psi) + \arctan\left(\frac{-k_s \cdot e_{\text{fa}}(t)}{v(t) + \epsilon_s}\right)$$

Where:
- $k_s = 1.8$: cross-track error gain.
- $\epsilon_s = 1.0\text{ m/s}$: softening parameter to ensure smooth control at low speeds and avoid division by zero.

### 3.3 Dynamic Potential Risk Field
Obstacles generate repulsive potential fields with asymmetric elliptical geometries reflecting agent vulnerability and dynamic uncertainty:
$$U_{\text{risk}}(x, y) = A_c \cdot \left(1 - d_n^2\right)^2 \quad \text{for } d_n < 1.0$$
$$d_n = \sqrt{\left(\frac{\Delta z}{a_c}\right)^2 + \left(\frac{\Delta x}{b_c}\right)^2}$$

**Tuned Risk Parameters by Agent Class:**
- **Stray Cattle (Class 4):** $a_c = 3.5\text{ m}$, $b_c = 2.8\text{ m}$, $A_c = 2500$ (High lateral variance due to unpredictable darting and lack of acoustic horn avoidance).
- **Auto-Rickshaw (Class 2):** $a_c = 4.0\text{ m}$, $b_c = 1.8\text{ m}$, $A_c = 1800$ (Abrupt braking, sudden lane filtering).
- **Two-Wheeler (Class 3):** $a_c = 3.8\text{ m}$, $b_c = 1.6\text{ m}$, $A_c = 1500$ (Gap penetration, rapid lateral acceleration).
- **Pushcart Vendor (Class 5):** $a_c = 2.5\text{ m}$, $b_c = 1.8\text{ m}$, $A_c = 1200$ (Slow counter-flow motion, wide footprint).
- **Pedestrian (Class 6):** $a_c = 2.2\text{ m}$, $b_c = 2.2\text{ m}$, $A_c = 2200$ (Vulnerable road user, omnidirectional mobility).

### 3.4 Multi-Objective Trajectory Optimization
Candidate trajectories $\tau_i$ generated by quintic polynomials are scored via:
$$J(\tau) = w_{\text{coll}} \int_0^{T_h} U_{\text{risk}}(x(t), y(t)) dt + w_{\text{smooth}} \int_0^{T_h} \kappa(t)^2 dt + w_{\text{jerk}} \int_0^{T_h} \dot{a}(t)^2 dt + w_{\text{offset}} d_{\text{lat}}^2 + w_{\text{prog}} (v_{\text{target}} - v(t))^2$$

With weights: $w_{\text{coll}} = 30.0$, $w_{\text{smooth}} = 1.2$, $w_{\text{jerk}} = 0.8$, $w_{\text{offset}} = 0.7$, $w_{\text{prog}} = 1.5$.
Any trajectory intersecting a physical obstacle bounding box incurs an insurmountable penalty ($+50,000.0$), strictly prohibiting unsafe paths.

### 3.5 Stopping Distance Calculation
Safe emergency stopping headway is dynamically verified via:
$$d_{\text{stop}} = v \cdot t_r + \frac{v^2}{2 \cdot a_b} + d_{\text{margin}}$$
Where reaction time $t_r = 0.05\text{ s}$ (sub-50ms replanning), braking deceleration $a_b = 6.5\text{ m/s}^2$, and safety buffer $d_{\text{margin}} = 2.5\text{ m}$.

---

## 4. Key Bugs Identified & Resolved

During the comprehensive audit, multiple logical, geometric, and functional bugs were identified and fixed:

1. **MATLAB ClassID Vehicle Restriction:**
   - *Bug:* In MATLAB Automated Driving Toolbox, calling `vehicle(scenario, 'ClassID', 5)` for a tractor threw an exception because `vehicle` only accepts ClassID 1 (Car) or 2 (Truck).
   - *Fix:* Refactored all custom actors (Tractor `ClassID = 5`, Cattle `ClassID = 4`, Two-Wheeler `ClassID = 3`, Pushcart `ClassID = 5`, Pedestrian `ClassID = 6`) to instantiate via `actor(scenario, ...)`.

2. **Sensor Generator Syntax Incompatibilities:**
   - *Bug:* `visionDetectionGenerator` and `lidarPointCloudGenerator` failed with `Expected SensorLocation to be an array with number of elements equal to 2` and `The name 'RangeLimits' is not an accessible property for class 'lidarPointCloudGenerator'`.
   - *Fix:* Updated `SensorLocation` to 2-element vector `[x y]`, passed scalar `'Height'`, and corrected LiDAR parameter to `'MaxRange', 75`.

3. **Struct Array Indexing in Simulation History:**
   - *Bug:* Initializing `history` with `struct('field', {})` produced 0x0 struct arrays that threw `A dot '.' indexing expression produced a comma-separated list with 0 values`.
   - *Fix:* Replaced with clean scalar struct containing typed empty array fields (`history.time = []; history.egoX = []; ...`).

4. **Prediction Struct Schema Dissimilarity:**
   - *Bug:* In `agent_trajectory_predictor.m`, assigning dynamic predictions to uninitialized struct array caused `Subscripted assignment between dissimilar structures`.
   - *Fix:* Pre-allocated uniform struct schema using `repmat(struct(...))` and added explicit empty-track handling.

5. **Passenger Ride Comfort Jerk Spike:**
   - *Bug:* Numerical double differentiation of discrete velocity demands produced RMS jerk spikes of $3.84\text{ m/s}^3$ (exceeding comfort limit $< 3.5\text{ m/s}^3$).
   - *Fix:* Integrated acceleration rate-of-change limiting ($3.2\text{ m/s}^3$ comfort jerk limit) inside `longitudinal_speed_controller.m`, dropping RMS jerk to **$0.74\text{ m/s}^3$** (100% Pass).

6. **Missing Project Search Paths:**
   - *Bug:* Running `main_simulation_demo.m` or `visualize_scenario.m` standalone threw `Unrecognized function or variable 'create_indian_road_scenarios'`.
   - *Fix:* Added automatic path discovery at top of scripts: `addpath(genpath(projectRoot))`.

7. **Obstacle Penetration / Clipping in Simulator:**
   - *Bug:* When obstacles spawned abruptly, the browser vehicle previously clipped through models.
   - *Fix:* Implemented continuous 2D swept AABB contact checking in `vehicle.js` with emergency braking deceleration ($\le -9.0\text{ m/s}^2$) and hard position clamping directly at the contact boundary.

8. **Fixed White Line Boundary Adherence:**
   - *Bug:* Left/Right avoidance maneuvers previously risked crossing into the roadside ditch ($X < -3.70\text{ m}$).
   - *Fix:* Enforced a hard boundary invariant: vehicle right edge must stay $\ge -3.65\text{ m}$, clamping target lateral offsets in `planner.js` and wheel kinematics in `vehicle.js`.

---

## 5. Verification Results

### 5.1 MATLAB Batch Validation Suite (`tests/test_all_scenarios.m`)
Executed in MATLAB R2026a:
- **Village Road:** Avg Latency $3.36\text{ ms}$, Min Clearance $4.37\text{ m}$, Collisions: $0$ $\rightarrow$ **PASS**
- **Urban Intersection:** Avg Latency $1.29\text{ ms}$, Min Clearance $4.14\text{ m}$, Collisions: $0$ $\rightarrow$ **PASS**
- **Highway Merge:** Avg Latency $1.13\text{ ms}$, Min Clearance $9.63\text{ m}$, Collisions: $0$ $\rightarrow$ **PASS**
- **Dense Market:** Avg Latency $3.26\text{ ms}$, Min Clearance $3.59\text{ m}$, Collisions: $0$ $\rightarrow$ **PASS**
- **Cattle Crossing:** Avg Latency $1.80\text{ ms}$, Min Clearance $3.09\text{ m}$, Collisions: $0$ $\rightarrow$ **PASS**

### 5.2 Full Closed-Loop Simulation (`src/run_full_pipeline.m`)
- Average Travel Speed: $50.19\text{ km/h}$
- Average Replanning Latency: $3.94\text{ ms}$
- 99th Percentile Latency: $32.17\text{ ms}$ ($< 50.0\text{ ms}$ benchmark $\rightarrow$ **PASS**)
- RMS Ride Jerk: $0.74\text{ m/s}^3$ ($< 3.5\text{ m/s}^3$ benchmark $\rightarrow$ **PASS**)
- Minimum Obstacle Clearance: $3.08\text{ m}$
- Collisions: $0$ $\rightarrow$ **PASS**

### 5.3 Headless Chrome DevTools Protocol Verification (`verify_simulator.py`)
- Test 1: Road Geometry & Starting Position (Ego at $X = -1.85\text{ m}$) $\rightarrow$ **PASS**
- Test 2: Straight Cruise with Zero Drift or Zigzag $\rightarrow$ **PASS**
- Test 3: Sudden Cattle Crossing with Radar Early Detection & Emergency Hold $\rightarrow$ **PASS**
- Test 4: Narrow Single-Lane Bridge In-Lane Stop (Zero Swerving into Walls) $\rightarrow$ **PASS**
- Test 5: Village Road Tractor Avoidance & Smooth Lane Return $\rightarrow$ **PASS**
- Test 6: Dense Market Inching Mode (Anti-Freezing Solution) $\rightarrow$ **PASS**

### 5.4 Complete 15 Edge Scenarios Verification (`verify_all_15_scenarios.py`)
All 15 unstructured road edge scenarios verified at 100% pass rate:
1. `cattle_crossing` (Emergency Stop)
2. `bridge_hazard` (In-Lane Stop)
3. `village_road` (Tractor Nudge)
4. `intersection` (Interactive Merge)
5. `highway_merge` (Yield & Decelerate)
6. `dense_market` (Crowd Inching)
7. `motorcycle_filtering` (Safe Gap Corridor)
8. `pothole_avoidance` (Sub-Lane Swerve)
9. `sensor_degradation` (Rain Doppler Lock)
10. `stalled_vehicle` (Oncoming Priority Hold)
11. `construction_detour` (Workzone Detour)
12. `night_pedestrian` (LiDAR Night Stop)
13. `animal_herd` (Livestock Caution)
14. `speed_breaker` (Comfort Deceleration)
15. `reversion_recovery` (Multi-Obstacle S-Curve Recovery)

---

## 6. How Reviewers Can Run the Demonstration

### Option A: One-Click Desktop Launch (Recommended)
1. Double-click `Launch_Simulator.bat` in the repository root.
2. The launcher starts the Python FastAPI + WebSocket bridge server and opens the 3D simulator in your default browser at `http://127.0.0.1:8000/simulator/index.html`.
3. In the top navigation:
   - Click any of the 6 scenario buttons or select from all 15 scenarios in the dropdown.
   - Click `🧪 Run MATLAB Suite` to execute MathWorks test suites directly from the UI.
   - Toggle weather presets (Day, Sunset, Rain, Night) and camera views (Chase, Cockpit, Radar, 3D Orbit).
   - Press `H` to toggle the HUD overlay for a cinematic unobstructed view.

### Option B: MATLAB R2026a Command Line
1. Launch MATLAB and set current folder to `sih-2026`.
2. Run batch validation suite:
   ```matlab
   addpath(genpath('src')); addpath(genpath('tests'));
   test_all_scenarios();
   ```
3. Run closed-loop simulation with live multi-panel telemetry HUD:
   ```matlab
   history = run_full_pipeline('cattle_crossing');
   ```
4. Run standalone demo:
   ```matlab
   main_simulation_demo;
   ```

### Option C: Python Automated Headless CDP Tests
1. Ensure the server is running (`python run_simulator.py`).
2. Run automated regression validation:
   ```powershell
   python verify_simulator.py
   python verify_all_15_scenarios.py
   ```

