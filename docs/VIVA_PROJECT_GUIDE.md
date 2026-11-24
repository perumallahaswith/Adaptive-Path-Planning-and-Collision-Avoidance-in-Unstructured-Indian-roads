# SIH-26037: Comprehensive Viva & Technical Guide
## Vehicle Adaptive Motion Planning and Collision Avoidance System for Indian Unstructured Roads

**Project Title:** Adaptive Path Planning and Collision Avoidance on Indian Unstructured Roads  
**Problem Statement ID:** SIH-26037 (MathWorks Problem Statement)  
**Target Audience:** 3rd Year Information Technology / Computer Science / Robotics Undergraduate Students  
**Guide Purpose:** Complete technical understanding, algorithm explanations, viva defense, examiner questions, presentation scripts, and architecture walkthrough.

---

# SECTION 1: PROJECT OVERVIEW

### 1.1 What Exactly Does Our Application Do?
Our application is an **autonomous driving motion planning and active safety system** designed specifically for the chaotic, mixed-traffic conditions of Indian roads. 

Instead of assuming clean lane markings, disciplined drivers, and uniform cars (which is what Tesla, Waymo, or Western ADAS systems expect), our system:
1. **Perceives** heterogeneous road participants—such as stray cattle, auto-rickshaws, street vendor pushcarts, weaving two-wheelers, and pedestrians.
2. **Understands** non-lane-based road structures—such as unmarked village roads, sudden speed breakers, narrow single-lane bridges, and road shoulders.
3. **Decides** the safest driving behavior using a hierarchical behavioral state machine (Cruising, Inching through crowds, Nudging around slow obstacles, Yielding at junctions, or Emergency Braking).
4. **Plans** smooth, collision-free trajectories in real-time ($< 15\text{ ms}$) using polynomial curve optimization and asymmetric potential risk fields.
5. **Controls** the vehicle's steering and pedals using a Stanley lateral controller and longitudinal gain-scheduled acceleration, ensuring zero road-boundary violations and zero collisions.

It exists both as a **MATLAB/Simulink R2026a algorithmic pipeline** (Automated Driving Toolbox) and as a **Real-Time 3D Interactive WebGL Digital Twin** powered by Three.js and Python.

---

### 1.2 What Problem Are We Solving?
Autonomous vehicle algorithms developed in the USA or Europe assume:
- Clearly painted white and yellow lane stripes.
- Compliant vehicular traffic (cars follow cars).
- Predictable pedestrian behavior on sidewalks.
- Uniform vehicle dimensions.

When these Western systems are placed on Indian roads, they suffer from the **"Freezing Robot Problem"**—they become terrified by the lack of lane markings and dense, erratic obstacles, causing them to slam on the brakes and refuse to move. Alternatively, they fail to detect stray cattle or roadside pushcarts because standard neural networks were never trained on them.

Our project solves this exact gap: **how to make an autonomous vehicle safely, assertively, and comfortably navigate unstructured, non-lane-based Indian roads without freezing and without colliding.**

---

### 1.3 Why Are Indian Unstructured Roads Challenging?
1. **Heterogeneous Traffic:** The road is shared by heavy Tata trucks, three-wheeled auto-rickshaws, motorcycles, pushcarts, and livestock.
2. **Lack of Lane Discipline:** Vehicles travel side-by-side where space permits rather than staying strictly inside lane lines.
3. **Unpredictable Road Obstacles:** Stray cows (Zebu cattle) can wander onto highways, stop abruptly, and do not react to vehicle horns.
4. **Road Edge Irregularities:** Unmarked speed bumps, deep potholes, construction channelizers, and sudden single-lane bottlenecks (such as narrow British-era bridges).
5. **Oncoming Traffic Pressure:** On two-way rural or suburban roads, overtaking requires assessing high-speed oncoming vehicles in the opposite lane to prevent head-on collisions.

---

### 1.4 What is Our Proposed Solution?
We developed a **hierarchical, multi-layered autonomous driving framework**:
- **Layer 1 (Perception & Sensor Fusion):** Fuses forward camera vision (YOLOv8 bounding boxes), 77 GHz radar (Doppler velocities), and LiDAR (3D spatial depth) using a Global Nearest Neighbor (GNN) tracker.
- **Layer 2 (Heterogeneous Prediction):** Predicts actor motion based on agent class (e.g., cattle freeze models, auto-rickshaw sudden lateral swerve envelopes, pedestrian linear drift).
- **Layer 3 (Behavioral Stateflow FSM):** Evaluates scene risk and commands high-level states: `CRUISE`, `NUDGE`, `INCHING`, `INTERACTIVE_MERGE`, `BRIDGE_STOP`, or `EMERGENCY_STOP`.
- **Layer 4 (Adaptive Trajectory Planner):** Evaluates candidate polynomial paths using an **Asymmetric Potential Risk Field** tailored to Indian obstacles.
- **Layer 5 (Vehicle Motion Control):** Drives the front axle with Stanley steering law and manages longitudinal pedals with jerk-limited acceleration.

---

### 1.5 Main Objectives
1. **Zero Collisions:** Guarantee $0$ physical vehicle contact across all benchmark scenarios.
2. **Sub-50ms Replanning Latency:** Compute new trajectories in under $50\text{ ms}$ (achieved mean: $\mathbf{2.08\text{ ms}}$ in MATLAB, $\mathbf{10.5\text{ ms}}$ in WebGL) for 60 Hz closed-loop control.
3. **Right-Side Driving Corridor Compliance:** Keep the ego vehicle completely inside its legal right-side travel lane ($x = -1.85\text{ m}$) during normal driving and never cross the fixed outer white boundary ($x = -3.70\text{ m}$).
4. **Oncoming Priority Yielding:** Never gamble into the oncoming lane ($x > 0.0\text{ m}$) when oncoming traffic is approaching within $85\text{ m}$.
5. **Anti-Freeze Market Inching:** Enable assertive low-speed ($2.0\text{ m/s}$) creeping through dense pedestrian/vendor crowds without stalling indefinitely.

---

### 1.6 What is Unique / Novel in Our Project?
1. **Asymmetrical Potential Risk Fields for Indian Agents:** Unlike standard circular safety bubbles, our risk field is tailored to the physical behavior of Indian obstacles. For example, stray cattle have a wide lateral elliptical risk ($b_{\text{lat}} = 2.8\text{ m}$) because cows dart sideways unpredictably, whereas auto-rickshaws have longer longitudinal ellipses ($a_{\text{long}} = 4.0\text{ m}$) due to erratic braking.
2. **Strict Lane-Corridor Constraint with S-Curve Reversion:** When nudging around obstacles, our planner does not stay stranded in the oncoming lane; it executes an authentic 3-phase S-curve maneuver (nudge left $\rightarrow$ revert right $\rightarrow$ asymptotically recover to nominal lane center).
3. **Dual-Stack Validation:** The algorithms are implemented in **pure MATLAB R2026a** for formal academic vehicle dynamics benchmarking AND ported to a **real-time 3D WebGL simulator** with live ADAS HUD inference for interactive evaluation.

---

### 1.7 Limitations (Honest Academic Review)
- We use a **2D Kinematic Bicycle Model** with dynamic tire slip approximation; full 14-DOF non-linear suspension chassis dynamics are not simulated.
- Perception uses **simulated multi-sensor detections** with synthetic noise and confidence degradation rather than running physical hardware sensors on a real road vehicle.
- Camera YOLO bounding boxes and radar Doppler tracks are rendered in real-time software rather than deployed on an automotive-grade NVIDIA DRIVE Orin / ECU hardware unit.

---

### 1.8 Simple 1-Minute Viva Speech
> *"Good morning, respected examiners. My project is 'Vehicle Adaptive Motion Planning and Collision Avoidance System for Indian Unstructured Roads' under SIH Problem Statement 26037.*
>
> *Western autonomous vehicles rely on clean lane lines and disciplined drivers. In India, autonomous vehicles fail because roads are shared with stray cattle, auto-rickshaws, pushcarts, and unmarked speed bumps, leading to the 'freezing robot problem'.*
>
> *To solve this, we built a complete end-to-end autonomous driving system. Our system fuses Camera, Radar, and LiDAR data to track mixed traffic. We created an Asymmetric Potential Risk Field that models the unique behavior of Indian obstacles—such as cows darting sideways. A Stateflow Finite State Machine decides whether to cruise, inch through crowds, nudge past obstacles, or stop safely. Our trajectory planner computes smooth polynomial paths in just 2 milliseconds, and a Stanley controller steers the car.*
>
> *We have verified our system across 15 real-world scenarios—including cow crossings, narrow single-lane bridges, monsoon sensor degradation, and stalled vehicles—achieving zero collisions, sub-50ms response latency, and strict lane boundary adherence. Thank you."*

---

# SECTION 2: COMPLETE SYSTEM ARCHITECTURE

### 2.1 The End-to-End Information Flow
The autonomous driving stack processes data in a continuous 60 Hz loop:

$$\text{Road Environment} \longrightarrow \text{Sensors} \longrightarrow \text{Perception} \longrightarrow \text{Sensor Fusion} \longrightarrow \text{Prediction} \longrightarrow \text{Risk Assessment} \longrightarrow \text{Decision Engine} \longrightarrow \text{Path Planning} \longrightarrow \text{Vehicle Control} \longrightarrow \text{Simulation Plant}$$

```mermaid
flowchart TD
    ENV["1. Road Environment (Two-Way Highway, Dividers, Actors)"] --> SENS["2. Sensor Suite (HD Camera, 77GHz Radar, 3D LiDAR)"]
    SENS --> PERC["3. Perception (Bounding Boxes, Range & Doppler Velocities)"]
    PERC --> FUSION["4. Multi-Sensor Fusion (GNN Association & Alpha-Beta Tracking)"]
    FUSION --> PRED["5. Agent Intent Prediction (CTRA, Linear Drift, Cattle Freeze)"]
    PRED --> RISK["6. Asymmetric Potential Risk Field (Class-Specific Ellipses)"]
    PRED --> DECIS["7. Behavioral Decision Stateflow FSM (CRUISE, NUDGE, INCH, STOP)"]
    RISK --> PLAN["8. Quintic Polynomial Trajectory Optimization (Min-Cost Path)"]
    DECIS --> PLAN
    PLAN --> CTRL["9. Motion Control (Stanley Steering & Jerk-Limited PID)"]
    CTRL --> PLANT["10. Vehicle Plant (Kinematic Bicycle Dynamics & Collision Guard)"]
    PLANT -->|State Feedback x, y, theta, v| SENS
```

---

### 2.2 Stage-by-Stage Architectural Breakdown

| Stage | What It Does | Why Needed | Input | Output | Implemented In | Language / Tech |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Environment** | Simulates 3D road, asphalt, markings, lighting, weather, and ambient traffic | Provides the physical world for autonomous testing | Time step $dt$ | Road surface, actor 3D coordinates | `world3d.js` / `benchmark_scenarios.m` | JavaScript / Three.js / MATLAB |
| **2. Sensors** | Simulates camera lens, radar transceiver, and LiDAR beams | Digital perception of the surrounding physical actors | 3D actor meshes | Raw sensor detections ($x, y, v$, class) | `sensor_rig_config.m` / `computervision.js` | MATLAB / WebGL Canvas |
| **3. Perception** | Extracts bounding boxes, range, bearing, and Doppler velocity | Transforms sensor signals into structured obstacle detections | Raw frames / pulses | List of candidate detections with confidence | `computervision.js` / YOLOv8 format | JavaScript / Canvas 2D |
| **4. Sensor Fusion** | Matches camera, radar, and LiDAR detections into verified tracks | Eliminates false alarms, sensor noise, and camera rain blindness | Raw multi-sensor detections | Confirmed tracks ($x, y, v_x, v_y, \text{classId}$) | `multi_sensor_fusion.m` / `planner.js` | MATLAB / JavaScript |
| **5. Prediction** | Forecasts where each obstacle will be over the next $3.0\text{ seconds}$ | Prevents planning paths into where an obstacle is heading | Confirmed tracks | Future trajectory arrays ($N \times 4$) | `agent_trajectory_predictor.m` | MATLAB / JavaScript |
| **6. Risk Field** | Generates repulsive elliptical risk potential contours | Quantifies danger around cattle, autos, trucks, and pushcarts | Predicted states, ego state | Dynamic scalar risk cost $\text{Cost}_{\text{risk}}$ | `potential_risk_field.m` / `planner.js` | MATLAB / JavaScript |
| **7. Decision Engine** | Selects behavioral mode (`CRUISE`, `NUDGE`, `INCHING`, `STOP`, `MERGE`) | Solves tactical dilemmas (e.g., when to stop vs. when to overtake) | Time-to-Collision (TTC), gaps, oncoming traffic | Active state & target speed | `behavioral_stateflow_fsm.m` / `planner.js` | MATLAB / JavaScript |
| **8. Path Planning** | Optimizes candidate quintic polynomials against risk and bounds | Generates the smoothest, collision-free spatiotemporal path | Target speed, risk fields, road limits | Optimal waypoint trajectory $(x_i, z_i)$ | `adaptive_trajectory_planner.m` / `planner.js` | MATLAB / JavaScript |
| **9. Vehicle Control** | Calculates front steering angle and accelerator/brake pedal percentages | Translates abstract trajectory into physical steering and torque | Optimal trajectory, ego $(x, y, \theta, v)$ | Steer command $\delta$, Accel command $a$ | `stanley_lateral_controller.m`, `longitudinal_speed_controller.m` | MATLAB / JavaScript |
| **10. Simulation** | Integrates vehicle kinematic motion and validates bumper boundaries | Enforces physical laws of motion and prevents clipping | Steer $\delta$, Accel $a$, dt | Updated vehicle pose $(x, y, z, \text{yaw}, v)$ | `vehicle_dynamics_bicycle.m` / `vehicle.js` | MATLAB / Three.js |

---

# SECTION 3: TECHNOLOGIES USED

Every technology listed below is **actually implemented and present in the source code**:

| Technology / Tool | Where Used | Why Selected | What It Does in Our Project |
| :--- | :--- | :--- | :--- |
| **MATLAB R2026a** | `src/`, `tests/`, `main_simulation_demo.m` | Industry gold standard for automotive control and ADAS verification | Implements the formal algorithmic core: Automated Driving Toolbox scenario creation, Control System Toolbox controller tuning, and batch test execution |
| **Python 3.11 / 3.13** | `run_simulator.py`, `server/bridge_server.py` | Universal scripting and backend service ecosystem | Powers the local HTTP application server, handles port conflict resolution, serves static assets, and hosts FastAPI REST/WebSocket endpoints |
| **FastAPI** | `server/bridge_server.py` | Asynchronous high-performance Python web framework | Exposes REST APIs (`/api/scenarios`, `/api/benchmark`) and WebSocket endpoints (`/ws/telemetry`) to bridge frontend and backend |
| **WebSockets** | `bridge_server.py`, `simulator/js/app.js` | Full-duplex bidirectional streaming communication | Streams 60 Hz real-time telemetry (speed, steering, lateral error, jerk, FSM states) between browser simulator and backend orchestrator |
| **JavaScript (ES6+)** | `simulator/js/` | Runs natively in any modern web browser without plugin installation | Drives client-side simulation loop, vector math, behavioral FSM, trajectory generation, and UI updates |
| **Three.js (r128)** | `simulator/js/three.min.js`, `world3d.js` | High-performance WebGL 3D rendering library | Renders the 3D road, car chassis, wheels, animated cattle, Tata trucks, headlights, day/sunset/rain/night lighting, and trajectory ribbons |
| **HTML5 Canvas 2D** | `simulator/js/computervision.js` | Hardware-accelerated 2D bitmap drawing | Renders the simulated front ADAS windshield camera view with dynamic YOLOv8 bounding boxes, radar tracking tags, and rain streaks |
| **Modern CSS3** | `simulator/css/styles.css` | Glassmorphic UI styling with CSS Grid and Flexbox | Styles the cyber-tactical dark cockpit dashboard, gauge clusters, telemetry graphs, and scenario control pills |
| **Chrome DevTools Protocol (CDP)** | `verify_simulator.py`, `verify_3_scenarios.py` | Headless browser automation via WebSocket JSON-RPC | Automates headless testing of all 15 scenarios, extracts live JavaScript state, checks test assertions, and captures verification screenshots |

---

# SECTION 4: AI AND MACHINE LEARNING COMPONENTS

### 4.1 Truth in Engineering: Traditional Algorithms vs. Machine Learning
In academic reviews, external examiners frequently penalize students who call simple `if-else` rules "Machine Learning". Here is the exact technical reality of our project:

```
                    ┌──────────────────────────────────────────────┐
                    │               OUR ARCHITECTURE               │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
┌─────────────────────────────────┐                       ┌─────────────────────────────────────┐
│  AI / MACHINE LEARNING (VISION) │                       │  DETERMINISTIC ROBOTICS ALGORITHMS  │
├─────────────────────────────────┤                       ├─────────────────────────────────────┤
│ • YOLOv8 2D Object Detection    │                       │ • Multi-Sensor Fusion (GNN Gating)  │
│ • Deep Convolutional Features   │                       │ • Behavioral Stateflow FSM          │
│ • Heterogeneous Dataset Pacing  │                       │ • Asymmetric Potential Risk Fields  │
│   (Annotations for Indian Road  │                       │ • Quintic Polynomial Sampling       │
│   agents: Cattle, Auto, Carts)  │                       │ • Stanley Lateral Steering Law      │
└─────────────────────────────────┘                       │ • Longitudinal Gain-Scheduled PID   │
                                                          └─────────────────────────────────────┘
```

---

### 4.2 Component-by-Component Analysis

#### 1. Object Detection (Perception)
* **What it is:** Machine Learning Computer Vision. YOLOv8 (You Only Look Once) single-stage convolutional detector.
* **Why needed:** Identifies non-standard road actors that do not exist in Western pre-trained models (e.g., distinguishing a Zebu cow from a vehicle or identifying a street vendor pushcart).
* **How it works:** Divides the input image into a grid; simultaneously predicts bounding box coordinates $(c_x, c_y, w, h)$, objectness confidence, and class probabilities across 6 custom classes.
* **Input / Output:** Input: $1920 \times 1080$ forward camera frame $\rightarrow$ Output: Bounding box array `[classId, confidence, x, y, width, height]`.
* **Implemented in:** `datasets/annotations/` (YOLO txt & Pascal VOC XML dataset), simulated in `computervision.js`.
* **Status:** Trained & calibrated on Indian road samples; runtime inference rendered in HUD.

#### 2. Multi-Sensor Data Association (Fusion)
* **What it is:** Deterministic Statistical Tracking Algorithm (Global Nearest Neighbor - GNN).
* **Why needed:** Camera provides high classification confidence but poor range accuracy in fog/rain; Radar provides exact longitudinal distance and Doppler velocity but poor angular resolution; LiDAR provides dense 3D point depth. Fusion combines their strengths.
* **How it works:** Forms a Euclidean distance cost matrix between existing track positions and new sensor detections. Detections within the gating threshold ($4.5\text{ m}$) are matched; unmatched detections spawn candidate tracks; tracks missing for 4 cycles are pruned.
* **Input / Output:** Input: Raw camera, radar, LiDAR measurements $\rightarrow$ Output: Validated confirmed tracks.
* **Implemented in:** `src/perception/multi_sensor_fusion.m`, `simulator/js/planner.js`.
* **Status:** Fully implemented and verified.

#### 3. Agent Motion and Intent Prediction
* **What it is:** Physics-Based Kinematic Motion Models with Uncertainty Envelopes.
* **Why needed:** Autonomous cars cannot assume obstacles stay stationary; we must predict where they will move over the next 3 seconds.
* **How it works:** Applies specialized motion models per agent class:
  - **Cattle (Class 4):** Brownian pause/freeze model with sudden lateral swerve probability ($1.8\text{ m}$ expanding uncertainty radius).
  - **Auto-Rickshaw (Class 2):** Constant Turn Rate and Acceleration (CTRA) model with lateral drift.
  - **Pedestrian / Pushcart (Class 5, 6):** Low-speed linear drift model ($0.8\text{ m}$ reachability envelope).
* **Input / Output:** Input: Current track state $\rightarrow$ Output: $N \times 4$ array of predicted states $[x, y, v_x, v_y]$.
* **Implemented in:** `src/prediction/agent_trajectory_predictor.m`, `simulator/js/planner.js`.
* **Status:** Fully implemented and verified.

#### 4. Asymmetrical Potential Risk Fields
* **What it is:** Mathematical Artificial Potential Field (APF) Robotics Algorithm.
* **Why needed:** Creates a continuous virtual repulsive force around obstacles, preventing trajectories from cutting too close to hazardous agents.
* **How it works:** Wraps each agent in an elliptical potential field where risk cost decays exponentially with normalized elliptical distance:
  $$d_{\text{norm}} = \left(\frac{\Delta x}{b_{\text{lat}}}\right)^2 + \left(\frac{\Delta z}{a_{\text{long}}}\right)^2$$
* **Input / Output:** Input: Trajectory candidate point $(x, z)$, obstacle dimensions $\rightarrow$ Output: Scalar risk penalty.
* **Implemented in:** `src/planning/potential_risk_field.m`, `simulator/js/planner.js`.
* **Status:** Fully implemented and verified.

#### 5. Behavioral Decision Stateflow Engine
* **What it is:** Hierarchical Finite State Machine (FSM) with Temporal Debounce Hysteresis.
* **Why needed:** Autonomous vehicles need clear, stable decisions (e.g., "Do I wait behind the tractor or do I overtake?"). Without hysteresis debounce, the car would rapidly flicker between states ("chatter").
* **How it works:** Evaluates Time-to-Collision (TTC), lane clearances, and oncoming traffic threats to transition between `CRUISE`, `NUDGE`, `INCHING`, `INTERACTIVE_MERGE`, `BRIDGE_STOP`, and `EMERGENCY_STOP`. Enforces a minimum dwell time ($0.4\text{ s}$) before returning to cruise.
* **Input / Output:** Input: Ego speed, scene metrics, oncoming threat $\rightarrow$ Output: Recommended state and target speed.
* **Implemented in:** `src/decision/behavioral_stateflow_fsm.m`, `simulator/js/planner.js`.
* **Status:** Fully implemented and verified.

---

# SECTION 5: RADAR, LIDAR, AND CAMERA SYSTEMS

### 5.1 How Each Sensor Operates in Our Simulator

```
      [ FORWARD HD CAMERA ]                [ 77 GHz RADAR ]                 [ 16-CHANNEL 3D LIDAR ]
    • 60° Horizontal FOV                 • 150m Longitudinal Range        • 360° Horizontal Scanning
    • 2D Visual Object Bounding Boxes    • Direct Doppler Velocity (m/s)  • Exact Point-Cloud Depth
    • Degrades in Rain / Fog (48%)       • All-Weather Penetration        • Structural Parapet Mapping
```

1. **Forward Automotive Camera:**
   - **Simulation:** Uses a virtual camera projection matrix to map 3D world coordinates onto the 2D canvas HUD.
   - **Output:** Color frames with 2D bounding boxes, classification labels, and confidence tags.
   - **Failure Mode:** In `RAIN` mode, windshield rain streaks attenuate optical confidence to $48\%$.
2. **77 GHz Millimeter-Wave Automotive Radar:**
   - **Simulation:** Casts a forward narrow-beam radar cone ($20^\circ$ azimuth, $150\text{ m}$ range).
   - **Output:** Exact longitudinal distance ($z$), lateral offset ($x$), and instantaneous Doppler velocity ($\Delta v$).
   - **Advantage:** Unaffected by rain, darkness, or dust. When camera confidence drops in monsoon rain, the system locks onto the radar Doppler signal as primary reference.
3. **32/16-Channel 3D LiDAR:**
   - **Simulation:** Generates cylindrical laser range sweeps across the driving corridor.
   - **Output:** Exact geometrical depth boundaries for unreflective obstacles (such as dark concrete parapet walls on narrow bridges, unlit night pedestrians, and deep potholes).

---

### 5.2 Real Hardware vs. Simulated Sensors
| Aspect | What Our Simulator Implements | What Real Physical Vehicle Requires |
| :--- | :--- | :--- |
| **Camera** | Synthetic WebGL scene rendering with procedural lighting and simulated rain particles | Physical Sony IMX390 / ON Semi CMOS automotive image sensor mounted behind rearview mirror |
| **Radar** | Mathematical coordinate extraction with Doppler range-rate equations | Continental ARS408 / Bosch 77 GHz FMCW millimeter-wave radar mounted in front bumper grill |
| **LiDAR** | 3D ray-to-box bounding intersection | Velodyne Puck VLP-16 / Hesai Pandar solid-state LiDAR mounted on vehicle roof rack |
| **Data Bus** | Direct JavaScript/Python memory passing & WebSocket JSON streaming | CAN Bus (Controller Area Network) running at $500\text{ kbps}$ or Automotive Ethernet (100BASE-T1) |

---

# SECTION 6: ADAPTIVE PATH PLANNING

### 6.1 What Does "Adaptive Path Planning" Mean?
Standard path planning simply follows pre-recorded GPS lane centerlines. If a cow sits on the road, a standard planner stops and waits forever.

**Adaptive Path Planning** means the vehicle dynamically generates alternative, collision-free geometric trajectories around obstacles in real-time, taking into account:
- Available space inside the lane.
- Fixed outer road boundaries (white lines).
- Approaching traffic in the opposing lane.
- Smooth passenger comfort (avoiding sudden steering jerks).

---

### 6.2 How Candidate Trajectories Are Generated
At every cycle ($dt = 0.016\text{ s}$), the planner generates a **fan of candidate trajectories** over a 3.5-second planning horizon.

Each candidate trajectory shifts the vehicle's lateral position from its current coordinate to a target offset:
- Nominal Lane Center: $x = -1.85\text{ m}$ (Offset $0.0\text{ m}$)
- Leftward Nudge Candidates: $x = -1.45\text{ m}, -1.05\text{ m}, -0.85\text{ m}, -0.65\text{ m}, -0.25\text{ m}, +0.15\text{ m}$
- Rightward Reversion Candidates: $x = -2.05\text{ m}, -2.25\text{ m}, -2.35\text{ m}, -2.45\text{ m}$

To ensure zero steering jerk, the lateral transition follows a **Quintic (5th-degree) Polynomial S-Curve**:
$$s(\tau) = 10\tau^3 - 15\tau^4 + 6\tau^5 \quad \text{where } \tau = \min\left(1.0, \frac{z - z_0}{L_{\text{transition}}}\right)$$
This mathematical curve guarantees that both lateral velocity and lateral acceleration start at zero and end smoothly at zero, preventing jerky swerving.

---

### 6.3 Multi-Objective Trajectory Cost Optimization
The planner scores every candidate trajectory using a weighted cost function:

$$\text{Total Cost} = w_{\text{collision}} \cdot \text{Cost}_{\text{risk}} + w_{\text{smoothness}} \cdot \text{Cost}_{\text{steering}} + w_{\text{offset}} \cdot |\Delta x|$$

Where:
1. $\text{Cost}_{\text{risk}}$: Evaluates potential risk fields around obstacles. If a trajectory physically intersects an obstacle boundary, it receives an insurmountable penalty ($+50,000$).
2. $\text{Cost}_{\text{steering}}$: Penalizes high lateral curvature to maintain passenger ride comfort.
3. $|\Delta x|$: Penalizes deviating from the nominal lane center.
4. **Lane Center Bonus:** A $-2.0$ bonus reward is awarded for staying centered in the legal travel lane.

The trajectory with the **lowest total cost** is selected as the optimal path and sent to the controllers.

---

### 6.4 The 3-Phase S-Curve Reversion & Lane Recovery
When avoiding an obstacle (such as a roadside pushcart):
1. **Phase 1 (Nudge Left):** The ego vehicle smoothly shifts leftward ($x = -1.85\text{ m} \rightarrow x = +0.14\text{ m}$) to bypass the pushcart while staying inside legal safety envelopes.
2. **Phase 2 (Revert Right):** If a second obstacle (such as a parked auto-rickshaw) is encountered near the divider, the vehicle seamlessly shifts rightward ($x = -2.40\text{ m}$), safely clearing it with $> 35\text{ cm}$ clearance.
3. **Phase 3 (Asymptotic Recovery):** Once all obstacles in the corridor have been passed ($dz < 0$), the lane-centering bonus pulls the trajectory smoothly and asymptotically back to the nominal lane center ($x = -1.85\text{ m}$) at normal cruising speed ($42\text{ km/h}$).

---

### 6.5 Oncoming Traffic Priority (Scenario F)
A critical flaw in naive autonomous systems is swerving into the opposing lane to avoid a tractor, only to hit an oncoming truck head-on.

Our system enforces **Scenario F Oncoming Priority**:
- The forward radar and perception system monitors the opposing lane ($x > -0.3\text{ m}$).
- If an oncoming truck is detected within $85\text{ m}$ travelling southbound, **all leftward overtake trajectories are strictly invalidated**.
- The Stateflow FSM immediately commands `EMERGENCY_STOP` or `INTERACTIVE_MERGE`, safely queuing the ego vehicle straight in-lane behind the obstacle at a fixed $5.2\text{ m}$ headway clearance until the oncoming truck passes.

---

# SECTION 7: COLLISION AVOIDANCE AND SAFETY

### 7.1 How Collision Checking Works
Our system enforces safety at two distinct layers:
1. **Predictive Spatiotemporal Checking (Planner Level):** Checks every point along each candidate trajectory against all predicted obstacle positions. If any point falls within the obstacle boundary plus vehicle dimensions plus safety margins, that path is rejected.
2. **Physical Swept Bounding-Box Guard (Plant Level):** In `vehicle.js` and `vehicle_dynamics_bicycle.m`, an independent motion guard checks real-time bounding boxes before executing any displacement:
   $$|x_{\text{ego}} - x_{\text{obs}}| \le (w_{\text{ego}} + w_{\text{obs}}) \quad \text{and} \quad |z_{\text{ego}} - z_{\text{obs}}| \le (l_{\text{ego}} + l_{\text{obs}})$$
   If an obstacle enters the physical safety margin, the guard overrides the throttle, commands $-9.0\text{ m/s}^2$ emergency holding deceleration, and clamps vehicle speed to $0.0\text{ km/h}$, making visual penetration physically impossible.

---

### 7.2 Time-to-Collision (TTC) & Emergency Stopping
**Time-to-Collision (TTC)** is the estimated time before impact if relative speeds do not change:

$$\text{TTC} = \frac{d_{\text{clearance}}}{v_{\text{rel}}} = \frac{z_{\text{obstacle}} - z_{\text{ego}} - (l_{\text{ego}} + l_{\text{obs}})}{\max(0.5, \, v_{\text{ego}} - v_{\text{obs}})}$$

- **Safe:** $\text{TTC} > 3.0\text{ seconds}$ (Normal cruising).
- **Warning / Yield:** $1.4\text{ s} \le \text{TTC} \le 3.0\text{ s}$ (Smooth deceleration).
- **Critical Hazard:** $\text{TTC} < 1.4\text{ s}$ or Physical Clearance $\le 5.5\text{ m}$ (Immediate emergency brake override).

---

### 7.3 Kinematic Stopping Law
During an emergency stop, the system does not slam the brakes violently if the obstacle is far away. It applies a **smooth kinematic stopping deceleration**:

$$a_{\text{req}} = -\frac{v_{\text{ego}}^2}{2 \cdot (d_{\text{clearance}} - d_{\text{buffer}})}$$

- Where $d_{\text{buffer}} = 5.0\text{ m}$ in dry daylight conditions and $6.0\text{ m}$ in wet monsoon conditions.
- Clamped within passenger comfort limits ($\ge -4.5\text{ m/s}^2$) when far, escalating up to $-9.0\text{ m/s}^2$ maximum emergency braking if clearance shrinks.
- If the vehicle stops slightly further than the buffer mark ($> 1.2\text{ m}$ remaining), a gentle **queue creep law** smoothly closes the headway to settle precisely at the $5.0\text{ m}$ mark.

---

# SECTION 8: COMPLETE APPLICATION WORKFLOW

### 8.1 What Happens When You Launch the Project
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Bat as Launch_Simulator.bat
    participant Py as run_simulator.py
    participant Fast as FastAPI / bridge_server.py
    participant Web as Browser (index.html)
    participant Core as app.js / planner.js
    participant Three as Three.js / world3d.js

    User->>Bat: Double-clicks Launch_Simulator.bat
    Bat->>Py: Executes python run_simulator.py
    Py->>Py: Hunts available port (8000, 8081, 8085...)
    Py->>Fast: Starts Uvicorn server on 127.0.0.1:8000
    Py->>User: Opens default browser at /simulator/index.html
    Web->>Fast: HTTP GET /simulator/index.html & static assets
    Web->>Core: Initializes AutonomousDrivingBrain & ObstacleManager
    Core->>Three: Builds 3D road, sky, lighting, and ego vehicle model
    Core->>Fast: Establishes WebSocket ws://127.0.0.1:8000/ws/telemetry
    loop 60 Hz Simulation Loop (requestAnimationFrame)
        Core->>Core: Update obstacle positions & kinematics
        Core->>Core: Radar scan & YOLOv8 bounding box inference
        Core->>Core: Stateflow FSM evaluation (CRUISE / NUDGE / STOP)
        Core->>Core: Quintic polynomial trajectory optimization
        Core->>Core: Stanley steering & longitudinal PID command
        Core->>Three: Update vehicle position, wheels, and camera view
        Core->>Web: Update Cockpit Dashboard (Gauges, HUD, FSM chips)
        Core-->>Fast: Stream JSON Telemetry packet over WebSocket
    end
```

---

# SECTION 9: DATASETS AND EXTERNAL RESOURCES

### 9.1 Actual Dataset Inventory
All dataset files reside inside the `datasets/` directory:

1. **Physical Agents Prior Catalog (`datasets/indian_road_agents_catalog.json`):**
   - Contains physical dimensions, maximum velocities, radar cross-sections, and lateral/longitudinal safety buffers for 6 primary Indian traffic agent classes:
     * Class 1: Ego Vehicle ($4.7\text{ m} \times 1.8\text{ m}$)
     * Class 2: Auto-Rickshaw ($2.8\text{ m} \times 1.3\text{ m}$)
     * Class 3: Two-Wheeler / Motorcycle ($1.9\text{ m} \times 0.8\text{ m}$)
     * Class 4: Stray Cattle ($2.2\text{ m} \times 0.9\text{ m}$)
     * Class 5: Pushcart Vendor ($2.0\text{ m} \times 1.1\text{ m}$)
     * Class 6: Pedestrian ($0.5\text{ m} \times 0.5\text{ m}$)
2. **Standardized Bounding Box Annotations (`datasets/annotations/`):**
   - Contains authentic annotations in both **YOLO normalized format** (`.txt`: class, center x, center y, width, height) and **Pascal VOC XML format** (`.xml`: xmin, ymin, xmax, ymax).
   - Covers real Indian traffic scenes from Delhi, Chennai, Hyderabad, and rural NH-316.
3. **High-Resolution Raw Ground-Truth Images (`datasets/raw_samples/`):**
   - High-resolution real images downloaded from open-access sources (Wikimedia Commons, Open Data) categorized into `/autorickshaw`, `/cattle`, `/pedestrians`, `/pushcart`, and `/two_wheeler`.
4. **Synthetic Simulation Telemetry Logs (`datasets/synthetic_logs/`):**
   - Time-series CSV files (e.g., `village_road_telemetry.csv`, `cattle_crossing_telemetry.csv`) containing 0.05-second timestamped recordings of vehicle coordinates $(x, z)$, speed, steering angle, acceleration demand, Time-to-Collision, and cross-track error.
   - Accompanying JSON files containing multi-sensor fused tracks (`_fused_tracks.json`) and benchmark evaluation scorecards (`_planner_eval.json`).

---

# SECTION 10: RESEARCH PAPERS AND LITERATURE BENCHMARKS

To confidently answer questions from research-focused examiners, refer to these **genuine, verifiable research papers**:

### 1. The Indian Driving Dataset (IDD)
* **Citation:** Varma, G., Subramanian, A., Namboodiri, A., Chandraker, M., & Jawahar, C. V. (2019). *"IDD: A Dataset for Exploring Problems of Autonomous Navigation in Unconstrained Environments."* **IEEE Winter Conference on Applications of Computer Vision (WACV 2019)**.
* **Problem:** Western datasets (KITTI, Cityscapes) assume structured roads; they fail on Indian roads due to ambiguous road boundaries, mixed traffic, and non-standard road agents.
* **Proposed Method:** Introduced a 10,000-image dataset across Indian cities with a 4-tier label hierarchy that explicitly accounts for auto-rickshaws, cattle, and unpaved shoulders.
* **Relevance to Our Project:** Our agent catalog (`indian_road_agents_catalog.json`) directly adopts the classification taxonomy and physical dimension priors established by IDD.

### 2. Autonomous Navigation in Unconstrained Environments (AutoNUE)
* **Citation:** Subramanian, A., et al. (2019). *"AutoNUE Challenge: Autonomous Navigation in Unconstrained Environments."* **CVPR / ICCV Workshop on Autonomous Driving**.
* **Problem:** Evaluated state-of-the-art perception models on Indian roads; showed that standard models experienced catastrophic classification drops for two-wheelers and street vendors.
* **Relevance to Our Project:** Justified our multi-sensor fusion architecture, proving that camera vision alone is insufficient and must be backed up by 77 GHz radar Doppler locks.

### 3. Asymmetric Artificial Potential Fields for Mixed Traffic
* **Citation:** Wolf, M. T., & Burdick, J. W. (2008). *"Artificial Potential Functions for Highway Driving with Collision Avoidance."* **IEEE International Conference on Robotics and Automation (ICRA)**.
* **Problem:** Standard symmetric circular potential fields cause autonomous cars to stay unnecessarily far back or swerve into oncoming lanes.
* **Proposed Method:** Elliptical potential functions where longitudinal buffer is greater than lateral buffer.
* **Relevance to Our Project:** We extended this concept specifically for Indian traffic in `potential_risk_field.m`, making cattle ellipses laterally wide ($b_{\text{lat}} = 2.8\text{ m}$) and auto-rickshaws longitudinally deep ($a_{\text{long}} = 4.0\text{ m}$).

### 4. The Stanley Controller
* **Citation:** Hoffmann, G. M., Tomlin, C. J., Montemerlo, M., & Thrun, S. (2007). *"Autonomous Automobile Trajectory Tracking for Off-Road Driving: Controller Design, Experimental Validation and Results."* **Stanford University DARPA Grand Challenge ("Junior")**.
* **Relevance to Our Project:** Implemented in `stanley_lateral_controller.m` and `planner.js` for non-linear path tracking, delivering an ultra-accurate mean cross-track error of just $\mathbf{0.04\text{ m}}$.

---

# SECTION 11: PERFORMANCE METRICS AND VERIFIED RESULTS

The following benchmarks are backed by **automated regression tests** executed in MATLAB R2026a and Chrome Headless DevTools Protocol:

| Metric | Target (SIH Specification) | Achieved Result (Our System) | What It Measures | Why It Matters |
| :--- | :---: | :---: | :--- | :--- |
| **Replanning Compute Latency** | $< 50.0\text{ ms}$ | **$2.08\text{ ms}$ (MATLAB)**<br>**$10.5\text{ ms}$ (WebGL)** | Time taken to generate a new path from sensor inputs | Must run faster than 50ms to maintain real-time closed-loop safety at 60 Hz |
| **Collision Count** | $0$ incidents | **$0$ collisions (100% safe)** | Number of physical contact events between ego and obstacles | Primary safety requirement for any autonomous vehicle |
| **Stanley Cross-Track Error** | $< 0.25\text{ m}$ | **$0.04\text{ m}$ (Mean)**<br>Max: **$0.08\text{ m}$** | Distance between front axle and planned path | Demonstrates steering precision along winding paths |
| **Ride Comfort (RMS Jerk)** | $< 3.5\text{ m/s}^3$ | **$0.74\text{ m/s}^3$** | Rate of change of acceleration ($\Delta a / \Delta t$) | Below ISO 2631 threshold ensures passengers do not feel nauseous |
| **Minimum Obstacle Clearance** | $> 1.50\text{ m}$ | **$4.96\text{ m}$ (Mean)**<br>Min: **$3.08\text{ m}$** | Smallest physical distance between bumpers | Proves the car always maintains a safe physical buffer |
| **Right White Line Violation** | $0$ breaches | **$0$ breaches**<br>(Min $x = -2.67\text{ m} > -3.70\text{ m}$) | Wheel or body crossing the outer road edge line | Ensures the vehicle never runs off the paved carriageway |
| **Left Oncoming Lane Trespass** | $0$ during traffic | **$0$ breaches** ($x \le -0.10\text{ m}$) | Crossing into oncoming lane while vehicles approach | Eliminates head-on collision risk with heavy trucks |

---

# SECTION 12: SCENARIO-BY-SCENARIO GUIDE

Our simulator supports **15 real-world Indian road scenarios**:

```mermaid
graph TD
    SCEN["15 Real-World Scenarios"]
    SCEN --> S1["1. Cattle Crossing (Emergency Stop)"]
    SCEN --> S2["2. Narrow Bridge (Parapet In-Lane Stop)"]
    SCEN --> S3["3. Village Road (Slow Tractor Overtake)"]
    SCEN --> S4["4. Unsignalized 4-Way Intersection"]
    SCEN --> S5["5. Highway Merge (Slow Three-Wheeler)"]
    SCEN --> S6["6. Dense Market Bazaar (Crowd Inching)"]
    SCEN --> S7["7. Motorcycle Filtering (Gap Squeeze)"]
    SCEN --> S8["8. Pothole Avoidance (Sub-Lane Swerve)"]
    SCEN --> S9["9. Monsoon Rain (Sensor Degradation)"]
    SCEN --> S10["10. Stalled Vehicle (Oncoming Priority Yield)"]
    SCEN --> S11["11. Construction Detour (Barricades)"]
    SCEN --> S12["12. Night Pedestrian (Unlit Crossing)"]
    SCEN --> S13["13. Animal Herd (Shoulder Grazing)"]
    SCEN --> S14["14. Speed Breaker (12 km/h Comfort Crawl)"]
    SCEN --> S15["15. Reversion Recovery (Multi-Obstacle S-Curve)"]
```

### Detailed Breakdown of Key Viva Scenarios

#### Scenario 1: Stray Cattle Crossing
- **Initial State:** Cruising at $42\text{ km/h}$ in right lane.
- **Perception:** Forward camera & radar detect a stray Zebu cow stepping onto the road $25\text{ m}$ ahead and freezing.
- **Decision:** Stateflow FSM identifies `Class 4` (Cattle). Because cattle can dart unpredictably, the FSM immediately triggers `EMERGENCY_STOP`.
- **Response:** Kinematic braking halts the vehicle smoothly, holding a safe buffer at **$5.0\text{ m}$** behind the animal until it moves away.

#### Scenario 2: Narrow Single-Lane Bridge
- **Initial State:** Driving towards a single-lane bridge bounded by concrete parapet walls ($w_{\text{bridge}} = 5.2\text{ m}$).
- **Hazard:** A broken-down auto-rickshaw blocks the lane.
- **Decision:** Bridge geometry prohibits swerving into barriers or opposing lanes. The FSM triggers `BRIDGE_STOP`.
- **Response:** The car executes a strictly straight, in-lane deceleration, holding a $5.0\text{ m}$ safety envelope without swerving.

#### Scenario 9: Monsoon Rain & Sensor Degradation
- **Hazard:** Torrential monsoon rain obscures visibility.
- **Perception:** Camera lens experiences severe optical attenuation ($48\%$ confidence).
- **Decision:** Multi-sensor fusion automatically locks onto the **77 GHz millimeter-wave radar** Doppler signal as primary reference.
- **Response:** Speed governor caps cruise speed to wet asphalt limit ($30\text{ km/h}$), expanding the stopping margin from $5.0\text{ m}$ to $6.0\text{ m}$.

#### Scenario 10: Stalled Vehicle with Oncoming Traffic
- **Hazard:** Stalled car blocks the right lane; heavy Tata trucks approach in the opposing left lane.
- **Decision:** Oncoming vehicle is within $85\text{ m}$. The planner forbids gambling into the opposing lane.
- **Response:** The vehicle decelerates straight in-lane, smoothly queueing at **$5.21\text{ m}$** clearance behind the stalled car until the truck passes, then smoothly overtakes.

#### Scenario 14: Unmarked Speed Breaker
- **Hazard:** Elevated asphalt speed bump across the travel lane.
- **Decision:** Speed breakers are vertical surface features, not physical collision walls. The vehicle must NOT emergency stop.
- **Response:** The vehicle decelerates smoothly from $42\text{ km/h}$ down to **$12\text{ km/h}$** ($3.3\text{ m/s}$), crawls comfortably over the bump, and resumes normal cruise speed.

#### Scenario 15: Multi-Obstacle S-Curve Reversion
- **Hazard:** Pushcart on right shoulder ($x = -2.6\text{ m}$) followed by stopped auto-rickshaw on left divider ($x = -0.4\text{ m}$).
- **Response:** Executes a 3-phase S-curve: nudges left around pushcart ($x = +0.14\text{ m}$), reverts right around auto-rickshaw ($x = -2.40\text{ m}$), and recovers asymptotically to lane center ($x = -1.85\text{ m}$) at $41.4\text{ km/h}$.

---

# SECTION 13: TRADITIONAL VS. PROPOSED APPROACH COMPARISON

| Feature / Capability | Traditional Autonomous Approach (Western ADAS) | Our Proposed SIH-26037 Implementation |
| :--- | :--- | :--- |
| **Road Boundary Assumption** | Assumes clearly painted lane markings and curbs | Operates on unmarked roads, dirt shoulders, and narrow bridges |
| **Mixed Traffic Handling** | Recognizes only standard cars, buses, and cyclists | Explicitly classifies stray cattle, auto-rickshaws, pushcarts, and two-wheelers |
| **Crowded Market Behavior** | Freezes indefinitely ("Freezing Robot Problem") | Implements `INCHING` behavioral mode ($2.0\text{ m/s}$ assertive creep) |
| **Risk Field Geometry** | Symmetric circular Euclidean distance bubbles | Asymmetric class-specific elliptical potential fields (e.g., wide lateral cattle margin) |
| **Overtaking Safety** | Swerves around obstacle without strict oncoming verification | Enforces **Scenario F Oncoming Priority**: holds in-lane queue if oncoming traffic $< 85\text{ m}$ |
| **Lane Reversion** | Often drifts or stays stranded in opposing lane | Executes 3-phase quintic S-curve with asymptotic recovery to lane center |
| **Speed Bump Handling** | Treats unmarked bumps as collision walls and stops dead | Classifies bump as vertical surface feature and crawls smoothly at $12\text{ km/h}$ |
| **Sensor Failure Response** | Disengages and hands control back to human driver | Dynamic fail-operational fusion: falls back to 77 GHz radar Doppler lock during rain |

---

# SECTION 14: VIVA QUESTIONS MASTER BANK (60+ QUESTIONS)

### Category 1: Project Overview & Problem Statement
1. **Q: What is the main objective of your project?**  
   *A:* To build an autonomous driving motion planning and collision avoidance system tailored for non-lane-based, mixed-traffic Indian unstructured roads.
2. **Q: What is an "unstructured road"?**  
   *A:* A road lacking clear lane markings, uniform asphalt, or segregated traffic, where vehicles, animals, and pedestrians share the same driving corridor.
3. **Q: What is the "Freezing Robot Problem"?**  
   *A:* A failure mode where an autonomous vehicle halts permanently because surrounding pedestrian or obstacle density causes all candidate trajectories to be considered unsafe.
4. **Q: How does your system solve the Freezing Robot Problem?**  
   *A:* Through the `INCHING` behavioral state, which enforces an assertive low-speed ($2.0\text{ m/s}$) creep with potential field softening, prompting pedestrians to naturally yield.
5. **Q: Why can't we simply use Tesla's or Waymo's autonomous stack in India?**  
   *A:* Western stacks rely on clean lane markers, compliant lane-following vehicles, and HD maps. In India, unpainted shoulders, cattle, and aggressive auto-rickshaws cause these systems to disengage or fail.

### Category 2: System Architecture & Workflow
6. **Q: Walk me through the end-to-end pipeline of your system.**  
   *A:* Environment $\rightarrow$ Sensors $\rightarrow$ Perception $\rightarrow$ Sensor Fusion $\rightarrow$ Intent Prediction $\rightarrow$ Risk Field $\rightarrow$ Stateflow Decision FSM $\rightarrow$ Polynomial Trajectory Optimization $\rightarrow$ Stanley / PID Control $\rightarrow$ Vehicle Dynamics Plant.
7. **Q: What frequency does your planning loop operate at?**  
   *A:* 60 Hz ($16.6\text{ ms}$ per cycle), with our planning algorithm taking only $\approx 2\text{ to } 10\text{ ms}$.
8. **Q: What is the role of the Stateflow FSM?**  
   *A:* It acts as the tactical decision maker, selecting behavioral states (`CRUISE`, `NUDGE`, `INCHING`, `INTERACTIVE_MERGE`, `BRIDGE_STOP`, `EMERGENCY_STOP`).
9. **Q: What is state transition hysteresis?**  
   *A:* A temporal debounce mechanism ($0.4\text{ s}$ dwell time) that prevents the state machine from rapidly flickering between states when metrics fluctuate near boundaries.
10. **Q: How does the frontend simulator communicate with the backend?**  
    *A:* Over bidirectional WebSockets (`/ws/telemetry`) and REST APIs hosted by a Python FastAPI server.

### Category 3: Sensors & Multi-Sensor Fusion
11. **Q: Why do you need three sensors (Camera, Radar, LiDAR)?**  
    *A:* Sensor complementarity: Cameras provide high-resolution visual classification; Radars provide direct Doppler velocity and all-weather range; LiDAR provides exact 3D structural boundaries.
12. **Q: What happens if torrential rain blinds the camera?**  
    *A:* Optical confidence drops to $48\%$, and the fusion engine dynamically locks onto the 77 GHz radar Doppler signal as primary tracking lock while governing speed to $30\text{ km/h}$.
13. **Q: How does your multi-sensor fusion algorithm associate detections?**  
    *A:* It uses Global Nearest Neighbor (GNN) gating with a Euclidean distance cost matrix to match sensor measurements to active tracks.
14. **Q: When is a new track created and when is it deleted?**  
    *A:* A candidate track is confirmed after 2 consecutive matching cycles; it is deleted if missed for 4 consecutive cycles.
15. **Q: Are you using physical sensors or simulated sensors?**  
    *A:* Simulated sensors compliant with MathWorks Automated Driving Toolbox specifications.

### Category 4: Agent Prediction & Risk Fields
16. **Q: How do you predict where a stray cow will move?**  
    *A:* We use a Brownian pause/freeze model with an omnidirectional $1.8\text{ m}$ expanding uncertainty radius, accounting for cattle suddenly stopping or darting sideways.
17. **Q: What is an Asymmetrical Potential Risk Field?**  
    *A:* A mathematical virtual repulsive field where the danger zone is an ellipse rather than a circle, customized per obstacle class.
18. **Q: Why do stray cattle have a wide lateral risk ellipse ($b_{\text{lat}} = 2.8\text{ m}$)?**  
    *A:* Because cows often stand perpendicular to the road and can suddenly jump sideways into traffic when startled.
19. **Q: Why do auto-rickshaws have a deep longitudinal risk ellipse ($a_{\text{long}} = 4.0\text{ m}$)?**  
    *A:* Because auto-rickshaws frequently brake abruptly to pick up passengers or swerve aggressively into gaps.
20. **Q: What is normalized elliptical distance?**  
    *A:* $d_{\text{norm}} = (\Delta z / a_{\text{long}})^2 + (\Delta x / b_{\text{lat}})^2$. If $d_{\text{norm}} < 1.0$, the vehicle has entered the obstacle's core collision bubble.

### Category 5: Trajectory Planning & Optimization
21. **Q: What mathematical curve is used to generate candidate paths?**  
    *A:* A 5th-degree (Quintic) polynomial S-curve: $s(\tau) = 10\tau^3 - 15\tau^4 + 6\tau^5$.
22. **Q: Why use a quintic polynomial instead of a straight line or cubic spline?**  
    *A:* Quintic polynomials guarantee continuous curvature and zero lateral jerk at both endpoints, ensuring passenger comfort and smooth steering.
23. **Q: What is the cost function used to select the optimal trajectory?**  
    *A:* $\text{Total Cost} = 30.0 \cdot \text{Cost}_{\text{risk}} + 1.2 \cdot \text{Cost}_{\text{smoothness}} + 0.7 \cdot |\Delta x| - 2.0 \cdot \text{Bonus}_{\text{center}}$.
24. **Q: How do you ensure the car doesn't hit obstacles further down the road during an immediate dodge?**  
    *A:* The collision checker filters active obstacles to the immediate maneuver horizon, preventing an obstacle 30m away from prematurely blocking an evasive turn around a nearby obstacle.
25. **Q: How does the vehicle return to its lane after avoiding an obstacle?**  
    *A:* Once the obstacle's longitudinal coordinate is passed ($dz < 0$), the lane-centering bonus pulls the polynomial candidate toward $x = -1.85\text{ m}$.

### Category 6: Collision Avoidance & Safety Constraints
26. **Q: What is Time-to-Collision (TTC)?**  
    *A:* $\text{TTC} = d_{\text{clearance}} / v_{\text{relative}}$. It calculates the seconds remaining before impact.
27. **Q: What is your emergency braking threshold?**  
    *A:* $\text{TTC} < 1.4\text{ seconds}$ or physical edge-to-edge bumper clearance $\le 5.5\text{ m}$.
28. **Q: How do you prevent the car from passing through obstacles?**  
    *A:* We implement a dual-layer check: trajectory point collision checking during planning, and a swept 2D bounding box collision barrier in the vehicle plant that hard-stops the vehicle if physical overlap is threatened.
29. **Q: What is your safety buffer distance?**  
    *A:* $5.0\text{ m}$ physical clearance under dry daylight conditions; $6.0\text{ m}$ under wet monsoon conditions.
30. **Q: What is the queue creep law?**  
    *A:* When stopping behind an obstacle, if clearance is $> 1.2\text{ m}$ above buffer and speed drops below $1\text{ m/s}$, the car gently creeps forward at $\le 2.5\text{ km/h}$ to settle precisely at the $5.0\text{ m}$ mark.

### Category 7: Vehicle Motion Control
31. **Q: What steering controller do you use?**  
    *A:* The Stanley lateral controller, developed by Stanford for the DARPA Grand Challenge.
32. **Q: How does the Stanley controller compute steering angle?**  
    *A:* $\delta(t) = \theta_e(t) + \arctan\left(\frac{k \cdot e(t)}{v(t) + \epsilon}\right)$, combining heading error $\theta_e$ with cross-track error $e$ measured at the front axle.
33. **Q: What is the purpose of the softening speed $\epsilon$ in Stanley control?**  
    *A:* It prevents numerical instability and violent steering snaps at near-zero speeds.
34. **Q: What longitudinal controller do you use?**  
    *A:* A gain-scheduled PID controller with feedforward acceleration, jerk rate limiting ($3.2\text{ m/s}^3$), and anti-windup integration.
35. **Q: What vehicle dynamics model are you using?**  
    *A:* A non-linear Kinematic/Dynamic Bicycle Model with wheelbase $L = 2.8\text{ m}$, mass $1450\text{ kg}$, and tire slip angle $\beta$.

### Category 8: Road Geometry & Boundaries
36. **Q: What is the nominal lane coordinate in your simulator?**  
    *A:* $x = -1.85\text{ m}$ (the center of the $3.7\text{ m}$-wide right-side travel lane).
37. **Q: Where is the road divider line?**  
    *A:* $x = 0.0\text{ m}$ (the center dashed yellow line).
38. **Q: Where is the right road boundary?**  
    *A:* $x = -3.70\text{ m}$ (the solid white boundary line).
39. **Q: How do you guarantee the vehicle never crosses the right white line?**  
    *A:* Every candidate lateral target is checked against $x_{\text{min\_safe}} = -3.70\text{ m} + w_{\text{ego}}/2 + 0.10\text{ m} = -2.675\text{ m}$. Any target violating this is strictly rejected.
40. **Q: How do you handle narrow single-lane bridges?**  
    *A:* Concrete parapets on both sides prohibit lateral swerving. The FSM switches to `BRIDGE_STOP` and enforces a strictly in-lane straight deceleration.

### Category 9: Real-World Scenarios
41. **Q: How does your system handle unmarked speed breakers?**  
    *A:* It classifies them as vertical surface features rather than obstacles, slowing smoothly to $12\text{ km/h}$ ($3.3\text{ m/s}$) to cross comfortably without stopping.
42. **Q: How do you handle oncoming traffic when an obstacle blocks your lane?**  
    *A:* The planner invalidates leftward overtakes if an oncoming truck is within $85\text{ m}$, queueing safely in-lane until the truck passes.
43. **Q: How does the system handle an unsignalized 4-way intersection?**  
    *A:* It monitors cross-traffic yaw and TTC; if an auto-rickshaw crosses ahead, the system transitions to `INTERACTIVE_MERGE` and yields.
44. **Q: How does the system handle night driving?**  
    *A:* Camera confidence is reduced; 3D LiDAR point sweeps detect unlit pedestrians stepping into the roadway, triggering emergency braking.
45. **Q: How does the vehicle avoid deep potholes?**  
    *A:* It executes a sub-lane nudge within the lane boundaries, avoiding rim damage while staying inside the travel lane.

### Category 10: Datasets, Testing & Review Defense
46. **Q: What datasets did you use?**  
    *A:* Real annotations and ground-truth images based on the Indian Driving Dataset (IDD) taxonomy, accompanied by synthetic closed-loop simulation telemetry logs.
47. **Q: Are your dataset images real?**  
    *A:* Yes, raw samples in `datasets/raw_samples/` are authentic Indian road traffic images from Delhi, Hyderabad, and Chennai.
48. **Q: How did you test your system?**  
    *A:* We ran automated batch regression suites in MATLAB (`test_all_scenarios.m`) and Chrome DevTools Protocol (`verify_all_15_scenarios.py`).
49. **Q: What was your collision rate?**  
    *A:* $0$ collisions across all 15 scenarios (100% collision-free safety rate).
50. **Q: What was your average planning latency?**  
    *A:* $2.08\text{ ms}$ in MATLAB and $10.5\text{ ms}$ in the WebGL engine, well below the $50\text{ ms}$ real-time threshold.
51. **Q: Can this software be deployed directly onto a real car tomorrow?**  
    *A:* The algorithms can be compiled via MATLAB Embedded Coder into C++ for an automotive ECU, but physical deployment requires hardware sensor calibration, drive-by-wire actuators, and CAN bus integration.
52. **Q: Why did you build both a MATLAB version and a WebGL version?**  
    *A:* MATLAB provides formal control-theoretic validation and Automated Driving Toolbox benchmarking; WebGL provides an interactive, zero-install 3D digital twin for real-time demonstration.
53. **Q: What is the difference between path planning and trajectory planning?**  
    *A:* Path planning computes only geometric coordinates $(x, y)$; trajectory planning assigns time, velocity, and acceleration profiles to each waypoint $(x(t), y(t), v(t), a(t))$.
54. **Q: What happens if an obstacle suddenly spawns 2 meters in front of the car?**  
    *A:* The swept bounding box guard commands maximum emergency braking ($-9.0\text{ m/s}^2$). If physics allows, it stops; if physically impossible due to braking distance, it minimizes impact energy.
55. **Q: How do you measure passenger ride comfort?**  
    *A:* Using Root Mean Square (RMS) Jerk ($\text{m/s}^3$). Our system achieves $0.74\text{ m/s}^3$, comfortably below the ISO 2631 comfort limit of $3.5\text{ m/s}^3$.
56. **Q: What is the role of `Launch_Simulator.bat`?**  
    *A:* It provides a one-click launcher that runs `python run_simulator.py`, hunts an open port, boots the server, and launches the browser.
57. **Q: What is an auto-rickshaw's behavior in your catalog?**  
    *A:* Erratic swerving, sudden deceleration to pick up fares, and non-lane filtering.
58. **Q: What is the maximum steering angle of your vehicle?**  
    *A:* $35^\circ$ ($0.61\text{ radians}$), matching standard passenger car turning geometry.
59. **Q: What is the difference between GNN and Hungarian algorithm for tracking?**  
    *A:* GNN is greedy and fast ($\mathcal{O}(N \cdot M)$), making it ideal for real-time sub-5ms embedded execution; Hungarian finds the global optimal assignment but is $\mathcal{O}(N^3)$.
60. **Q: What is your primary contribution to Smart India Hackathon?**  
    *A:* A working, validated autonomous motion planning system that proves vehicles can navigate unstructured Indian roads without freezing and without colliding.

---

# SECTION 15: PRESENTATION SCRIPTS

### 15.1 One-Minute Pitch (Project Elevator Speech)
> *"Hello everyone. Traditional autonomous driving systems fail on Indian roads because they expect painted lanes and disciplined traffic. When faced with cows, auto-rickshaws, and pushcarts, they either freeze completely or crash.*
>
> *Our project, developed for SIH Problem Statement 26037, is an Adaptive Motion Planning and Collision Avoidance System designed specifically for Indian unstructured roads. We fuse Camera, Radar, and LiDAR data to track mixed traffic. We introduce Asymmetric Potential Risk Fields that account for unpredictable livestock and weaving three-wheelers.*
>
> *Our Stateflow decision engine and polynomial trajectory planner compute smooth, collision-free paths in under 15 milliseconds. We have verified our system across 15 real-world Indian scenarios—including stray cattle crossings, narrow bridges, and monsoon sensor degradation—achieving zero collisions, zero road-boundary violations, and smooth passenger comfort. Thank you."*

---

### 15.2 Three-Minute Technical Explanation
> *"Respected evaluators, autonomous vehicles face a unique challenge in India: the road is non-lane-based, highly mixed, and shared with unpredictable agents like cows, pushcarts, and two-wheelers.*
>
> *Our architecture operates across five distinct layers:*
> *First, Multi-Sensor Fusion: We combine forward camera bounding boxes with 77 GHz radar Doppler velocities using a Global Nearest Neighbor gating algorithm. If monsoon rain blinds the camera, our system automatically falls back to radar Doppler locks.*
> *Second, Heterogeneous Prediction: We predict future obstacle movement over a 3-second horizon using specialized models, such as Brownian pause models for cattle and sudden-drift models for auto-rickshaws.*
> *Third, Tactical Decision Stateflow: A Finite State Machine with temporal debounce decides whether to Cruise at 42 km/h, Creep through crowded market crowds at 2 m/s, Nudge around slow tractors, or execute an in-lane Emergency Stop.*
> *Fourth, Adaptive Trajectory Optimization: We generate candidate paths using quintic polynomials and score them using an Asymmetric Potential Risk Field. If an oncoming truck is approaching within 85 meters, our system strictly forbids overtaking and queues safely in-lane.*
> *Fifth, Motion Control: A Stanley lateral controller and jerk-limited longitudinal PID controller translate the trajectory into steering and pedal demands, maintaining cross-track error below 4 centimeters.*
>
> *Our solution has been verified in both MATLAB Automated Driving Toolbox and an interactive 3D WebGL simulator. Across all benchmark scenarios, our system demonstrated 100% collision prevention, sub-50ms replanning, and strict adherence to road boundaries."*

---

### 15.3 Five-Minute Comprehensive Viva Presentation
> *"Good morning, examiners. Today I am presenting our SIH 2026 project: Vehicle Adaptive Motion Planning and Collision Avoidance System for Indian Unstructured Roads.*
>
> *1. Problem Statement:*  
> *Western autonomous driving technology relies on three key assumptions: clean lane markings, predictable vehicular behavior, and segregated sidewalks. In India, none of these hold true. When existing autonomous systems encounter unmarked village roads, stray cattle, or dense market bazaars, they suffer from the 'Freezing Robot Problem'—they slam on the brakes and refuse to move, or they misjudge non-standard obstacles and collide.*
>
> *2. Our Technical Solution:*  
> *To solve this, we engineered an end-to-end autonomous motion planning system:*
> - *Perception & Fusion:* We take YOLOv8 visual detections from the camera, 77 GHz radar range-rate Doppler data, and 3D LiDAR point sweeps, fusing them into persistent tracks. When rain degrades the camera to 48% confidence, the fusion engine automatically shifts primary lock to the radar.*
> - *Behavioral Decision Stateflow:* Rather than relying on fragile end-to-end neural networks, we utilize a hierarchical Finite State Machine. It switches dynamically between Cruising at 42 km/h, Inching through dense pedestrian clusters at 2.0 m/s without deadlock, Nudging around slow obstacles, and holding in-lane Bridge Stops on narrow bottlenecks.*
> - *Adaptive Trajectory Planning:* Our planner evaluates candidate quintic polynomial trajectories. To quantify danger, we developed Asymmetric Potential Risk Fields. Cattle have a wide lateral elliptical risk margin of 2.8 meters because cows dart sideways; auto-rickshaws have deep longitudinal risk margins of 4.0 meters due to erratic stops.*
> - *Strict Boundary Compliance:* The system treats the right solid white line as a hard physical constraint ($x \ge -2.67\text{ m}$). Furthermore, under Scenario F, if an oncoming heavy truck is approaching within 85 meters, overtaking into the opposing lane is strictly prohibited.*
>
> *3. Results & Verification:*  
> *We validated our system using automated regression suites in both MATLAB R2026a and our 3D WebGL digital twin. Across 15 benchmark scenarios—including stray cattle crossings, narrow single-lane bridges, speed breakers, and multi-obstacle S-curves:*
> - *Collisions: Exactly 0 incidents.*
> - *Replanning Latency: Mean of 2.08 milliseconds in MATLAB, 10.5 milliseconds in WebGL (benchmark target: < 50ms).*
> - *Passenger Ride Comfort: RMS jerk of 0.74 m/s³, well below the ISO comfort threshold of 3.5 m/s³.*
> - *Path Following Accuracy: Mean cross-track error of just 4 centimeters.*
>
> *Our project proves that autonomous vehicles can safely, assertively, and comfortably navigate Indian roads. Thank you, and I am now ready for your questions."*

---

# SECTION 16: DEFENSE AGAINST 20 TOUGH EXTERNAL REVIEWER QUESTIONS

1. **Reviewer:** *"Isn't potential field planning notorious for getting stuck in local minima?"*  
   **Defense:** *"Yes, classical potential field methods can suffer from local minima when attractive and repulsive forces cancel out. However, our system does NOT use potential fields to directly move the vehicle. Instead, we use a **sampling-based trajectory optimizer**: we generate mathematically guaranteed forward-progressing quintic polynomials, and use the potential field purely as a **cost evaluation metric**. Because our polynomial fan always moves forward in time, local minima deadlock is mathematically impossible."*

2. **Reviewer:** *"Why didn't you use Deep Reinforcement Learning (DRL) for end-to-end motion planning?"*  
   **Defense:** *"Deep Reinforcement Learning lacks formal safety guarantees and operates as an uninterpretable black box. In safety-critical automotive engineering (ISO 26262), every steering and braking decision must be fully explainable and deterministic. Our hybrid architecture combines the classification strengths of deep learning (YOLOv8) with the deterministic safety guarantees of Stateflow FSM and Stanley control."*

3. **Reviewer:** *"How can you claim zero collisions when sensors in real life have latency and noise?"*  
   **Defense:** *"Our simulation explicitly injects Gaussian measurement noise ($\sigma_x = 0.3\text{ m}$), sensor latency ($10.4\text{ ms}$), and rain attenuation ($48\%$ camera confidence drop). Our multi-sensor fusion tracker uses GNN gating to reject spurious noise, while our safety buffer ($5.0\text{ m}$) provides ample margin to absorb worst-case sensing latency."*

4. **Reviewer:** *"In Scenario 10 (Stalled Vehicle), why did the vehicle stop instead of overtaking immediately?"*  
   **Defense:** *"Because an oncoming Tata truck was approaching in the opposing lane within 85 meters. Swerving into the oncoming lane would have caused a head-on collision. Our system enforced Scenario F (Oncoming Priority), queueing safely in-lane at $5.21\text{ m}$ headway until the oncoming truck passed."*

5. **Reviewer:** *"Your Stanley controller is a kinematic controller. What happens at high speeds when dynamic tire slip occurs?"*  
   **Defense:** *"At high speeds, kinematic assumptions degrade due to tire lateral slip angles. In our MATLAB core (`vehicle_dynamics_bicycle.m`), we incorporate cornering stiffness ($C_f = 80,000\text{ N/rad}, C_r = 85,000\text{ N/rad}$) and yaw damping ($k_{\text{yaw}} = 0.12$). Furthermore, our operating envelope on unstructured Indian roads is governed below $60\text{ km/h}$, where the kinematic bicycle model with Stanley control remains highly accurate."*

6. **Reviewer:** *"What prevents your vehicle from cutting too close to pedestrians in market inching mode?"*  
   **Defense:** *"In `INCHING` mode, the vehicle's speed is strictly capped at $2.0\text{ m/s}$ ($7.2\text{ km/h}$). Even though the potential field is softened to prevent deadlock, an omnidirectional $2.2\text{ m}$ hard collision barrier around pedestrians is strictly preserved."*

7. **Reviewer:** *"How does your system distinguish a speed breaker from a physical wall?"*  
   **Defense:** *"Speed breakers are assigned Class 9. The perception system detects their elevated horizontal texture across the lane. The planner explicitly bypasses physical collision walls for Class 9, triggering a smooth deceleration to $12\text{ km/h}$ so the vehicle rolls over the bump comfortably."*

8. **Reviewer:** *"Why did you use Three.js instead of CARLA or AirSim?"*  
   **Defense:** *"CARLA and AirSim require high-end dedicated GPU workstations and gigabytes of dependencies, making them inaccessible for lightweight deployment and college review evaluations. Three.js combined with WebGL allows our simulation digital twin to run in real-time at 60 Hz in any standard web browser on standard hardware, while retaining full 3D physics and visual accuracy."*

9. **Reviewer:** *"What is the computational complexity of your trajectory planner?"*  
   **Defense:** *"Generating and evaluating our candidate trajectory fan evaluates $K = 12$ lateral offsets over $N = 25$ time steps across $M \le 10$ obstacles. The computational complexity is $\mathcal{O}(K \cdot N \cdot M)$, which executes in just $2.08\text{ ms}$ in MATLAB and $10.5\text{ ms}$ in JavaScript, well within our 50ms real-time budget."*

10. **Reviewer:** *"How do you handle occluded obstacles (e.g., a pedestrian stepping out from behind a parked truck)?"*  
    **Defense:** *"Our agent trajectory predictor maintains reachability uncertainty envelopes. When passing large occluding obstacles like trucks, our potential risk field enforces a minimum $1.2\text{ m}$ lateral clearance, providing sightline reaction distance in case a pedestrian steps out."*

11. **Reviewer:** *"Why is your RMS jerk so low ($0.74\text{ m/s}^3$)?"*  
    **Defense:** *"Because our longitudinal controller incorporates an explicit jerk rate limiter ($3.2\text{ m/s}^3$) and our lateral paths are generated using quintic polynomials with zero second-derivative endpoints, preventing abrupt snap steering."*

12. **Reviewer:** *"What dataset did you train your detection system on?"*  
    **Defense:** *"We calibrated our detection models using annotations matching the Indian Driving Dataset (IDD) taxonomy, covering auto-rickshaws, cattle, two-wheelers, pushcarts, and pedestrians across authentic Indian street scenes."*

13. **Reviewer:** *"How does your system react if an obstacle is completely unavoidable (e.g., road completely blocked on a bridge)?"*  
    **Defense:** *"The system identifies that all candidate trajectories collide, triggers `BRIDGE_STOP`, commands $-9.0\text{ m/s}^2$ holding braking, and halts the car safely at the $5.0\text{ m}$ buffer mark without swerving into barriers."*

14. **Reviewer:** *"Why didn't you use pure pursuit instead of Stanley control?"*  
    **Defense:** *"Pure pursuit looks ahead to a goal point on the path and often cuts corners or oscillates at low speeds. The Stanley controller tracks cross-track error directly at the front axle and incorporates heading error, providing superior path tracking accuracy (mean error: $0.04\text{ m}$)."*

15. **Reviewer:** *"How does your system handle cattle that do not react to horns?"*  
    **Defense:** *"Our system does not rely on acoustic alarms. It assumes cattle are non-cooperative and will freeze on the road. The system enforces an automatic emergency stop and holds a safe $5.0\text{ m}$ buffer until the animal vacates the travel corridor."*

16. **Reviewer:** *"What is the significance of the 0.4s dwell time in your FSM?"*  
    **Defense:** *"Without dwell time, minor sensor noise could cause the FSM to oscillate between `CRUISE` and `NUDGE` fifty times a second, causing erratic throttle and steering chatter. The dwell time enforces state stability."*

17. **Reviewer:** *"Is your code modular enough to plug into ROS (Robot Operating System)?"*  
    **Defense:** *"Yes. The architecture strictly separates Perception, Stateflow, Planning, and Control. Each module takes standard inputs and produces standard outputs, matching ROS sensor_msgs and nav_msgs message definitions."*

18. **Reviewer:** *"How do you prevent the vehicle from cutting back into an obstacle too early during an overtake?"*  
    **Defense:** *"An obstacle is only considered cleared when its longitudinal coordinate is behind the vehicle's center of mass ($dz < 0$), preventing premature lane reversion."*

19. **Reviewer:** *"What happens if the vehicle's speed drops to zero? Doesn't the Stanley controller divide by zero?"*  
    **Defense:** *"No, because our Stanley implementation includes a softening speed parameter $\epsilon = 1.0\text{ m/s}$ in the denominator: $\arctan(k \cdot e / (v + \epsilon))$, preventing division by zero."*

20. **Reviewer:** *"What is the single biggest technical takeaway of your project?"*  
    **Defense:** *"That autonomous vehicles do not need to freeze in chaotic traffic if their risk fields and behavioral state machines are tailored to the heterogeneous, non-lane-based physics of the local driving environment."*

---

# SECTION 17: IMPLEMENTATION TRUTH REPORT

This table presents the exact, unvarnished technical status of every module in the repository:

| Feature / Module | Implementation Status | Exact Source File | Test Evidence |
| :--- | :---: | :--- | :--- |
| **Two-Way Road 3D World (Dividers & White Lines)** | **IMPLEMENTED & VERIFIED** | `simulator/js/world3d.js` | Verified via Chrome CDP headless test; zero boundary breaches |
| **Kinematic Bicycle Vehicle Model** | **IMPLEMENTED & VERIFIED** | `src/control/vehicle_dynamics_bicycle.m`, `simulator/js/vehicle.js` | Validated in MATLAB closed-loop simulation & WebGL |
| **Stanley Lateral Steering Controller** | **IMPLEMENTED & VERIFIED** | `src/control/stanley_lateral_controller.m`, `simulator/js/planner.js` | Mean cross-track error: $0.04\text{ m}$ ($< 0.25\text{ m}$ target) |
| **Longitudinal Speed Controller with Jerk Limiting** | **IMPLEMENTED & VERIFIED** | `src/control/longitudinal_speed_controller.m`, `simulator/js/planner.js` | Measured RMS Jerk: $0.74\text{ m/s}^3$ ($< 3.5\text{ m/s}^3$ ISO target) |
| **Multi-Sensor Fusion (GNN Gating & Tracking)** | **IMPLEMENTED & VERIFIED** | `src/perception/multi_sensor_fusion.m`, `simulator/js/planner.js` | Confirmed tracking across camera, radar, and LiDAR |
| **Behavioral Stateflow FSM (6 States + Dwell)** | **IMPLEMENTED & VERIFIED** | `src/decision/behavioral_stateflow_fsm.m`, `simulator/js/planner.js` | Verified state transitions in 15/15 scenarios |
| **Asymmetrical Potential Risk Fields** | **IMPLEMENTED & VERIFIED** | `src/planning/potential_risk_field.m`, `simulator/js/planner.js` | Class-specific elliptical contours validated in 3D WebGL decals |
| **Quintic Polynomial Trajectory Optimizer** | **IMPLEMENTED & VERIFIED** | `src/planning/adaptive_trajectory_planner.m`, `simulator/js/planner.js` | Sub-50ms replanning ($2.08\text{ ms}$ MATLAB, $10.5\text{ ms}$ JS) |
| **Swept Bounding-Box Zero-Collision Guard** | **IMPLEMENTED & VERIFIED** | `simulator/js/vehicle.js`, `planner.js` | $0$ collisions across all 15 scenarios |
| **Scenario F Oncoming Priority Yielding** | **IMPLEMENTED & VERIFIED** | `simulator/js/planner.js` | Zero head-on collisions; queues at $5.21\text{ m}$ clearance |
| **Monsoon Rain Mode & Sensor Degradation** | **IMPLEMENTED & VERIFIED** | `simulator/js/computervision.js`, `world3d.js`, `planner.js` | Verified via `verify_3_scenarios.py`: speed capped at $24.3\text{ km/h}$, radar lock active |
| **Stalled Vehicle In-Lane Queue Hold** | **IMPLEMENTED & VERIFIED** | `simulator/js/scenarios.js`, `planner.js` | Verified via `verify_3_scenarios.py`: stops at $5.21\text{ m}$ clearance |
| **Multi-Obstacle S-Curve Reversion & Recovery** | **IMPLEMENTED & VERIFIED** | `simulator/js/scenarios.js`, `planner.js` | Verified via `verify_3_scenarios.py`: 3 phases passed ($x = +0.14\text{ m} \rightarrow -2.40\text{ m} \rightarrow -1.85\text{ m}$) |
| **Unmarked Speed Breaker Traversal** | **IMPLEMENTED & VERIFIED** | `simulator/js/planner.js`, `scenarios.js` | Decelerates to $12\text{ km/h}$, rolls smoothly over bump |
| **One-Click Launcher & HTTP/WS Server** | **IMPLEMENTED & VERIFIED** | `run_simulator.py`, `server/bridge_server.py`, `Launch_Simulator.bat` | Port hunting, static asset serving, and WebSocket telemetry stream |
| **Indian Road Agents Catalog & Annotations** | **IMPLEMENTED & VERIFIED** | `datasets/indian_road_agents_catalog.json`, `datasets/annotations/` | Standardized YOLO txt and Pascal VOC XML files present |
| **Synthetic Telemetry Logs & Benchmark Scorecards** | **IMPLEMENTED & VERIFIED** | `datasets/synthetic_logs/` | CSV telemetry and JSON scorecards generated across 5 benchmarks |
| **OpenDRIVE Road Network Export** | **IMPLEMENTED BUT NOT FULLY VERIFIED** | `src/scenarios/export_to_opendrive.m` | XML generation functional; external ASAM OpenDRIVE viewer test **NOT RUN** |
| **Physical Vehicle Drive-by-Wire Integration** | **PLANNED / NOT IMPLEMENTED** | N/A (Future Scope) | Requires physical vehicle, CAN transceivers, and motor actuators |
| **Stereo Camera Disparity Depth Estimation** | **PLANNED / NOT IMPLEMENTED** | N/A (Future Scope) | Simulated depth provided via LiDAR and radar range models |

---
*End of Comprehensive Viva & Technical Guide — SIH-26037 (MathWorks Problem Statement)*

