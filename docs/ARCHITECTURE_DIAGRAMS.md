# Architecture Diagrams: SIH-26037
## Adaptive Path Planning and Collision Avoidance on Unstructured Indian Roads

---

### 1. End-to-End System Pipeline

```mermaid
flowchart TD
    subgraph SENSORS["1. Multi-Sensor Simulation (Automated Driving Toolbox)"]
        CAM["Forward HD Camera (60° FOV, 60m)"]
        LIDAR["16-Channel 360° LiDAR"]
        RADAR["77 GHz Long-Range Radar (Doppler)"]
    end

    subgraph PERCEPTION["2. Perception & Fusion Layer"]
        DET["Raw Detection Parsing"]
        GNN["GNN Nearest-Neighbor Data Association"]
        TRACKER["Track Management (Init, Coast, Prune)"]
        COSTMAP["2.5D Non-Lane Traversability Grid"]
    end

    subgraph PREDICTION["3. Motion & Intent Prediction"]
        CATTLE["Cattle Brownian / Freeze Model"]
        AUTO["Auto-Rickshaw / 2-Wheeler CTRA"]
        SLOW["Pedestrian / Pushcart Linear Reachability"]
    end

    subgraph DECISION["4. Behavioral Decision Logic (Stateflow)"]
        FSM{"Hierarchical FSM Evaluation"}
        CRUISE["CRUISE (14 m/s)"]
        NUDGE["NUDGE (7 m/s)"]
        INCH["INCHING (1.8 m/s)"]
        YIELD["INTERACTIVE MERGE (4 m/s)"]
        STOP["EMERGENCY STOP (0 m/s)"]
    end

    subgraph PLANNING["5. Adaptive Path & Speed Planner"]
        SAMPLE["Spatiotemporal Polynomial Sampling"]
        RISK["Asymmetric Dynamic Potential Fields"]
        OPT["Multi-Objective Cost Optimization"]
    end

    subgraph CONTROL["6. Motion Control & Dynamics"]
        STANLEY["Stanley Lateral Steering Controller"]
        PID["Gain-Scheduled Longitudinal PID"]
        PLANT["Nonlinear Dynamic Bicycle Model"]
    end

    CAM & LIDAR & RADAR --> DET
    DET --> GNN --> TRACKER --> COSTMAP
    TRACKER --> CATTLE & AUTO & SLOW
    CATTLE & AUTO & SLOW --> FSM
    FSM --> CRUISE & NUDGE & INCH & YIELD & STOP
    CRUISE & NUDGE & INCH & YIELD & STOP --> SAMPLE
    COSTMAP --> RISK --> OPT
    SAMPLE --> OPT
    OPT --> STANLEY & PID
    STANLEY & PID --> PLANT
    PLANT -->|Closed-Loop Feedback| SENSORS
```

---

### 2. Behavioral Stateflow FSM Transitions

```mermaid
stateDiagram-v2
    [*] --> CRUISE

    CRUISE --> NUDGE : Slow obstacle ahead on shoulder
    CRUISE --> INCHING : Dense pedestrian crowd (cluster >= 3)
    CRUISE --> INTERACTIVE_MERGE : Approaching unsignalized junction / crossing agent
    CRUISE --> EMERGENCY_STOP : Sudden hazard detected (TTC < 1.3s or dist < 2m)

    NUDGE --> CRUISE : Obstacle passed & corridor clear
    NUDGE --> EMERGENCY_STOP : Lateral intrusion during overtake

    INTERACTIVE_MERGE --> CRUISE : Crossing vehicle clears path
    INTERACTIVE_MERGE --> EMERGENCY_STOP : Agent cuts trajectory abruptly

    INCHING --> CRUISE : Crowd density drops (distance > 7m)
    INCHING --> EMERGENCY_STOP : Immediate footstep in front

    EMERGENCY_STOP --> INCHING : Obstacle moves away (TTC > 3.0s & dwell > 0.4s)
```

---

### 3. Asymmetric Potential Risk Field Contours

```mermaid
graph LR
    subgraph CATTLE["Stray Cattle Risk Profile"]
        direction TB
        C1["High Lateral Buffer: 2.8m"]
        C2["Longitudinal Buffer: 3.5m"]
        C3["Sudden Dart/Freeze Anticipation"]
    end

    subgraph AUTORICKSHAW["Auto-Rickshaw Profile"]
        direction TB
        A1["Moderate Lateral Buffer: 1.8m"]
        A2["Longitudinal Buffer: 4.0m"]
        A3["Swerve & Filtering Envelope"]
    end

    subgraph PUSHCART["Pushcart / Vendor Profile"]
        direction TB
        P1["Shoulder Footprint Buffer: 1.8m"]
        P2["Slow Flow Buffer: 2.5m"]
    end
```
