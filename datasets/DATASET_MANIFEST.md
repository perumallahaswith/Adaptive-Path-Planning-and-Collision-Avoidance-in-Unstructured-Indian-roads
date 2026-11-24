# SIH-26037: Indian Road Autonomous Driving Dataset Manifest

**Project Title:** Adaptive Path Planning and Collision Avoidance in Indian Unstructured Roads  
**Problem Statement ID:** SIH-26037 (MathWorks Problem Statement)  
**Catalog Version:** 2.1.0 (Validated & Verified)  

---

## 1. Executive Summary

This dataset repository establishes the empirical foundation for training, calibrating, and benchmarking perception, state estimation, intent prediction, and adaptive motion planning modules under heterogeneous, unstructured Indian road conditions.

Unlike Western datasets (nuScenes, Waymo, KITTI) which assume strictly marked lanes, predictable vehicle classes, and compliant lane discipline, this dataset explicitly addresses the 5 core non-standard Indian traffic agent categories:
1. **Stray Cattle / Bovine Obstacles** (irregular geometry, freezing behaviour, lack of acoustic alarm response).
2. **Auto-Rickshaws** (three-wheeled motorized light vehicles exhibiting sudden lateral lane filtering).
3. **Hand-Pushed Carts / Vendors** (slow-moving counter-flow traffic occupying road margins).
4. **Two-Wheelers / Motorcycles** (high-frequency lateral gap negotiation and lane splitting).
5. **Dense Pedestrian Clusters** (jaywalking and edge-walking in market streets without designated sidewalks).

---

## 2. Directory Architecture

```text
datasets/
│
├── annotations/                          # Standardized Bounding Box Annotations
│   ├── autorickshaw_delhi_1.txt          # YOLO normalized format (Class, cx, cy, w, h)
│   ├── autorickshaw_delhi_1.xml          # Pascal VOC XML format (xmin, ymin, xmax, ymax)
│   ├── autorickshaw_driver_2.txt
│   ├── autorickshaw_driver_2.xml
│   ├── cattle_highway_nh316_2.txt
│   ├── cattle_highway_nh316_2.xml
│   ├── cattle_road_rural_1.txt
│   ├── cattle_road_rural_1.xml
│   ├── pedestrians_market_leh_2.txt
│   ├── pedestrians_market_leh_2.xml
│   ├── pedestrians_street_hyderabad_1.txt
│   ├── pedestrians_street_hyderabad_1.xml
│   ├── pushcart_coconuts_2.txt
│   ├── pushcart_coconuts_2.xml
│   ├── pushcart_fruit_vendor_1.txt
│   ├── pushcart_fruit_vendor_1.xml
│   ├── two_wheeler_motorcycles_2.txt
│   ├── two_wheeler_motorcycles_2.xml
│   ├── two_wheeler_traffic_hyderabad_1.txt
│   └── two_wheeler_traffic_hyderabad_1.xml
│
├── raw_samples/                          # Authentic High-Resolution Ground-Truth Images
│   ├── autorickshaw/                     # Delhi & Chennai Auto-rickshaw traffic
│   ├── cattle/                           # Rural single carriageway & NH-316 bovine obstacles
│   ├── pedestrians/                      # Hyderabad street & Leh bazaar pedestrian flows
│   ├── pushcart/                         # Wet-weather Hyderabad & roadside coconut vendors
│   └── two_wheeler/                      # High-density motorcycle traffic & filtering
│
├── synthetic_logs/                       # Closed-Loop Simulation Time-Series & Telemetry
│   ├── cattle_crossing_fused_tracks.json # Multi-sensor Kalman fused tracks (0.05s steps)
│   ├── cattle_crossing_planner_eval.json # Benchmark scorecard (Latency, Jerk, Margin)
│   ├── cattle_crossing_telemetry.csv     # Complete ego states, control demands & TTC
│   ├── dense_market_fused_tracks.json
│   ├── dense_market_planner_eval.json
│   ├── dense_market_telemetry.csv
│   ├── highway_merge_fused_tracks.json
│   ├── highway_merge_planner_eval.json
│   ├── highway_merge_telemetry.csv
│   ├── urban_intersection_fused_tracks.json
│   ├── urban_intersection_planner_eval.json
│   ├── urban_intersection_telemetry.csv
│   ├── village_road_fused_tracks.json
│   ├── village_road_planner_eval.json
│   └── village_road_telemetry.csv
│
└── indian_road_agents_catalog.json       # Physical dimension, speed & risk priors
```

---

## 3. Supported Agent Classes & Physical Dimensions

The physical dimension, dynamic envelopes, and behavioral priors documented in `indian_road_agents_catalog.json` are summarized below:

| Class ID | Agent Name | Length (m) | Width (m) | Height (m) | Max Speed (km/h) | Lateral Buffer (m) | Longitudinal Buffer (m) | Behavioral Model Priors |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **0** | Ego Vehicle | 4.70 | 1.80 | 1.40 | 60 | 0.80 | 2.00 | Kinematic Bicycle Model, Stanley Guidance |
| **1** | Auto-Rickshaw | 2.80 | 1.30 | 1.70 | 40 | 1.20 | 3.00 | High-frequency lateral swerving, abrupt stops |
| **2** | Two-Wheeler | 1.90 | 0.80 | 1.20 | 50 | 1.50 | 4.00 | Lane splitting, rapid acceleration, gap penetration |
| **3** | Stray Cattle | 2.20 | 0.90 | 1.50 | 15 | 2.50 | 5.00 | Non-reactive to horns, unpredictable freezing |
| **4** | Pushcart Vendor | 2.00 | 1.10 | 1.30 | 5 | 1.50 | 3.00 | Counter-flow edge navigation, slow steady motion |
| **5** | Pedestrian | 0.50 | 0.50 | 1.70 | 6 | 1.80 | 3.50 | Jaywalking, group clustering, sudden turnaround |

---

## 4. Synthetic Log Schema

All CSV files in `synthetic_logs/` adhere strictly to the following 14-column engineering standard:

```text
timestamp             : Float (seconds, dt=0.05s)
ego_x                 : Float (Cartesian X position, meters, Easting)
ego_y                 : Float (Cartesian Y position, meters, Northing)
ego_heading_rad       : Float (Orientation angle theta, radians, CCW from +X)
ego_speed_mps         : Float (Longitudinal vehicle speed, m/s)
ego_accel_mps2        : Float (Longitudinal acceleration, m/s^2)
steering_angle_rad    : Float (Front wheel road steer angle, radians, [-0.60, +0.60])
throttle              : Float (Normalized accelerator command, [0.0, 1.0])
brake                 : Float (Normalized braking effort, [0.0, 1.0])
active_state          : String (Stateflow behavioral state: CRUISE, YIELD, NUDGE, EMERGENCY_STOP)
replanning_latency_ms : Float (Algorithm execution compute duration, ms)
min_clearance_m       : Float (Euclidean distance to closest obstacle boundary, meters)
time_to_collision_s   : Float (Calculated longitudinal Time-to-Collision, seconds)
jerk_mps3             : Float (Time derivative of acceleration, m/s^3)
collision_status      : String ("NONE" | "NEAR_MISS" | "COLLISION")
```

---

## 5. Licensing and Data Provenance

1. **Raw Sample Imagery:** Sourced from Wikimedia Commons under Creative Commons CC-BY-SA 2.0, 3.0, 4.0 and Public Domain licenses. Verified for educational, research, and hackathon evaluation purposes.
2. **Annotations:** Produced explicitly for SIH-26037 in standard open formats (YOLO TXT + Pascal VOC XML).
3. **Synthetic Logs:** Generated algorithmically via the closed-loop autonomous driving dynamic plant simulator (`generate_synthetic_logs.py`), reproducible under Python 3.10+ / NumPy / SciPy.

