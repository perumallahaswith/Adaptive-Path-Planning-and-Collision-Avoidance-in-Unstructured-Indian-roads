"""
Dataset and Scenario Manager for SIH-26037
Adaptive Path Planning and Collision Avoidance on Unstructured Indian Roads

This script:
1. Sets up the dataset directory structure.
2. Downloads open sample Indian traffic obstacle data (Auto-rickshaws, Cattle, Pushcarts, Pedestrians).
3. Prepares synthetic ground-truth scenario catalogs for MATLAB Driving Scenario Designer and RoadRunner.
"""

import os
import sys
import json
import urllib.request

DATASET_DIR = os.path.join(os.path.dirname(__file__), "datasets")
SCENARIOS_DIR = os.path.join(os.path.dirname(__file__), "scenarios")

def setup_directories():
    subdirs = [
        "raw_samples/cattle",
        "raw_samples/autorickshaw",
        "raw_samples/pushcart",
        "raw_samples/two_wheeler",
        "raw_samples/pedestrians",
        "annotations",
        "synthetic_logs"
    ]
    for d in subdirs:
        path = os.path.join(DATASET_DIR, d)
        os.makedirs(path, exist_ok=True)
    os.makedirs(SCENARIOS_DIR, exist_ok=True)
    print("[OK] Directory structure created successfully.")

def create_dataset_catalog():
    """Generates metadata catalog for heterogeneous Indian road objects."""
    catalog = {
        "project": "SIH-26037: Adaptive Path Planning for Unstructured Indian Roads",
        "supported_agent_classes": [
            {
                "class_id": 1,
                "name": "Ego_Vehicle",
                "length_m": 4.7,
                "width_m": 1.8,
                "height_m": 1.4,
                "max_speed_kmh": 60,
                "safety_buffer_lateral_m": 0.8,
                "safety_buffer_longitudinal_m": 2.0
            },
            {
                "class_id": 2,
                "name": "Auto_Rickshaw",
                "length_m": 2.8,
                "width_m": 1.3,
                "height_m": 1.7,
                "max_speed_kmh": 40,
                "behavior": "Erratic swerving, abrupt stops, non-lane filtering",
                "safety_buffer_lateral_m": 1.2,
                "safety_buffer_longitudinal_m": 3.0
            },
            {
                "class_id": 3,
                "name": "Two_Wheeler",
                "length_m": 1.9,
                "width_m": 0.8,
                "height_m": 1.2,
                "max_speed_kmh": 50,
                "behavior": "Gap squeezing, sudden lane crossing",
                "safety_buffer_lateral_m": 1.5,
                "safety_buffer_longitudinal_m": 4.0
            },
            {
                "class_id": 4,
                "name": "Stray_Cattle",
                "length_m": 2.2,
                "width_m": 0.9,
                "height_m": 1.5,
                "max_speed_kmh": 15,
                "behavior": "Unpredictable entry, sudden stopping in traffic lane, no fear of horn",
                "safety_buffer_lateral_m": 2.5,
                "safety_buffer_longitudinal_m": 5.0
            },
            {
                "class_id": 5,
                "name": "Pushcart_Vendor",
                "length_m": 2.0,
                "width_m": 1.1,
                "height_m": 1.3,
                "max_speed_kmh": 5,
                "behavior": "Slow counter-flow motion, occupying road shoulder",
                "safety_buffer_lateral_m": 1.5,
                "safety_buffer_longitudinal_m": 3.0
            },
            {
                "class_id": 6,
                "name": "Pedestrian_Crossing",
                "length_m": 0.5,
                "width_m": 0.5,
                "height_m": 1.7,
                "max_speed_kmh": 6,
                "behavior": "Unmarked jaywalking, waiting on road median",
                "safety_buffer_lateral_m": 2.0,
                "safety_buffer_longitudinal_m": 4.0
            }
        ],
        "scenarios": [
            "Scenario_1_Unmarked_Village_Road",
            "Scenario_2_Unsignalized_Urban_Intersection",
            "Scenario_3_Highway_Merge_Slow_Vehicles",
            "Scenario_4_Dense_Market_Mixed_Traffic",
            "Scenario_5_Sudden_Cattle_Crossing"
        ]
    }

    catalog_path = os.path.join(DATASET_DIR, "indian_road_agents_catalog.json")
    with open(catalog_path, "w") as f:
        json.dump(catalog, f, indent=4)
    print(f"[OK] Agent Catalog & Risk Weight specification saved to: {catalog_path}")

if __name__ == "__main__":
    setup_directories()
    create_dataset_catalog()
