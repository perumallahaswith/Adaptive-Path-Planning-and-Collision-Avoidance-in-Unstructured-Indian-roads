# Adaptive Path Planning and Collision Avoidance in Unstructured Indian Roads

**SIH 2026 · Problem Statement 26037 · MathWorks**

This project is a simulation prototype for navigating mixed, unstructured road scenarios such as cattle crossings, crowded markets, two-wheelers filtering through traffic, and vehicles stopped on narrow roads. It combines a MATLAB closed-loop planning and control pipeline with a browser-based Three.js demo served by a small Python web server.

## 30-second interview summary

> I built a modular autonomous-driving simulation for road situations where lane markings and predictable traffic cannot be assumed. The MATLAB pipeline processes simulated actor detections, tracks and predicts other agents, selects a behavior with a finite-state machine, samples candidate trajectories, and follows the selected path with steering and speed controllers. A separate browser demo makes representative scenarios easier to explore. The work is a simulation prototype, not a road-tested or safety-certified vehicle system.

## How it works

```text
Scenario actors
      ↓
Detection fusion and tracking
      ↓
Short-term agent prediction
      ↓
Behavior state machine
      ↓
Candidate trajectory planner
      ↓
Lateral and longitudinal control
      ↓
Bicycle-model vehicle plant → telemetry and benchmark metrics
```

The MATLAB entry point is `src/run_full_pipeline.m`. The pipeline uses scenario definitions, multi-sensor fusion, agent prediction, behavioral decisions, an adaptive trajectory planner, steering and speed controllers, and a vehicle dynamics model. The planner samples lateral offsets with smooth quintic transitions, rejects candidates above its curvature limit, and scores remaining trajectories using obstacle risk, smoothness, progress, and offset costs. Emergency-stop behavior and a stop-trajectory fallback are also implemented.

The browser demo is a separate interactive simulator under `simulator/`. `run_simulator.py` serves the UI and project assets; when FastAPI and Uvicorn are available, it also exposes scenario/metrics endpoints and an endpoint for invoking MATLAB. The browser visualization should not be treated as a physical vehicle test.

## Run it

### Browser demo

Requires Python 3. From the project root:

```powershell
python run_simulator.py
```

The launcher opens the browser. The demo is served locally; the Python server uses FastAPI/Uvicorn when installed and has a standard-library HTTP fallback for serving static files.

To enable the FastAPI endpoints:

```powershell
python -m pip install fastapi uvicorn
```

### MATLAB scenario regression

Requires MATLAB and the toolbox dependencies used by the scenario scripts (including Automated Driving Toolbox).

```matlab
addpath(genpath('src'));
addpath(genpath('scenarios'));
addpath(genpath('tests'));
test_all_scenarios();
```

To run one closed-loop scenario:

```matlab
history = run_full_pipeline('cattle_crossing');
```

Available MATLAB benchmark scenarios are defined by `src/scenarios/benchmark_scenarios.m`. Additional Python browser-verification scripts are in the project root; consult each script for its local browser/debugging prerequisites.

## Interview prep

### Design choices to explain

- **Why a finite-state machine?** It makes high-level behaviors such as cruising, nudging, inching, yielding, and emergency stopping explicit and inspectable. It is a practical baseline for a prototype where behavior needs to be explainable.
- **How does the planner choose a path?** It generates candidate lateral transitions, checks curvature feasibility, then compares candidates using risk and motion-quality costs. This gives a concrete, debuggable alternative to choosing actions from a learned policy.
- **How is the vehicle controlled?** A lateral controller tracks the planned path, a longitudinal controller follows the target speed, and a bicycle-model plant feeds the next simulated state back into the loop.
- **How should results be discussed?** Describe them as results reported by the project's simulation and verification scripts. The benchmark report is in [`docs/BENCHMARK_RESULTS.md`](docs/BENCHMARK_RESULTS.md); numbers there are not real-world safety claims or independently reproduced measurements.

### Likely follow-up questions

1. **What is the hardest road condition represented?** Explain the interaction between mixed traffic, uncertain agent motion, limited road space, and the need to wait rather than make an unsafe pass. Use a specific scenario from the simulator.
2. **How do you avoid deadlock in a crowd?** Describe the dedicated cautious inching behavior and how it differs from stopping indefinitely. Be clear that its behavior is evaluated in simulation.
3. **What happens when no candidate trajectory is feasible?** The planner falls back to a stop trajectory; emergency-stop behavior also produces a braking trajectory.
4. **How would you validate this on a real vehicle?** Start with scenario coverage and repeatable simulation tests, then validate sensors and dynamics against recorded data, use closed-course tests with safety supervision, and only then consider deployment-specific safety analysis. The current project does not establish road readiness.
5. **What would you improve next?** Add explicit road-boundary and vehicle-footprint constraints throughout planning, improve uncertainty-aware prediction, broaden scenario and regression coverage, and document reproducible test environments and dataset provenance.

For deeper preparation, see [`docs/VIVA_PROJECT_GUIDE.md`](docs/VIVA_PROJECT_GUIDE.md) and [`SIH_2026_COMPLETE_REVIEW_GUIDE.md`](SIH_2026_COMPLETE_REVIEW_GUIDE.md). The system design and implementation notes are in the [`docs/`](docs/) folder.

## Repository map

| Path | Contents |
| --- | --- |
| `src/` | MATLAB perception, prediction, decision, planning, control, scenario, and metrics modules |
| `scenarios/` | Scenario construction and visualization scripts |
| `planners/` | Standalone adaptive path-planner implementation |
| `tests/` | MATLAB scenario, planner, and perception-fusion tests |
| `simulator/` | Three.js browser demo |
| `server/` | FastAPI endpoints and local static-file server |
| `datasets/` | Sample images, annotations, agent catalog, and synthetic simulation logs |
| `docs/` | Architecture, specifications, benchmark reports, and implementation notes |
| `reviewer-demo/` | Prebuilt reviewer-facing demo assets |

## Scope, data, and licensing

This repository contains simulation code and data examples. It does not include a trained perception model, validated production sensor stack, or evidence of testing on public roads. Reported metrics are specific to the documented simulation setup; see the benchmark report for its stated environment and methodology.

Dataset image provenance and annotation details are described in [`datasets/DATASET_MANIFEST.md`](datasets/DATASET_MANIFEST.md). Check the listed source and license terms before redistributing individual images. There is currently no repository-wide `LICENSE` file, so do not assume that all project code and assets share one license.
