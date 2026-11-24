# Adaptive Path Planning and Collision Avoidance in Unstructured Indian Roads

> An SIH 2026 simulation prototype for explaining how an autonomous vehicle can perceive, plan, and react in mixed and imperfect Indian road environments.

This repository combines two complementary implementations:

- A **MATLAB closed-loop simulation pipeline** for perception, prediction, behavioral decisions, trajectory planning, and vehicle control.
- A **browser-based Three.js digital twin** that lets reviewers explore representative road scenarios interactively.

It models situations such as cattle crossings, dense markets, unmarked village roads, two-wheelers filtering through traffic, stalled vehicles, road hazards, and poor weather. It is a research and demonstration project: it is **not** a road-tested, safety-certified, or production autonomous-driving system.

## Highlights

- Fifteen configurable unstructured-road scenarios.
- Multi-sensor fusion, track prediction, and a behavioral finite-state machine.
- Quintic candidate-trajectory generation with curvature, risk, smoothness, progress, and offset costs.
- Emergency-stop and safe-stop fallbacks when no feasible path exists.
- Stanley lateral control, longitudinal speed control, and a bicycle-model vehicle plant.
- A self-contained WebGL dashboard with scenario controls, telemetry, camera views, weather modes, and a simulated ADAS feed.

## Architecture

```text
Scenario actors
    -> perception and sensor fusion
    -> agent tracking and prediction
    -> behavioral state machine
    -> candidate trajectory planner
    -> steering and speed controllers
    -> bicycle-model vehicle plant
    -> telemetry, metrics, and browser visualization
```

The MATLAB entry point is [`src/run_full_pipeline.m`](src/run_full_pipeline.m). The interactive frontend lives in [`simulator/`](simulator/), while [`server/bridge_server.py`](server/bridge_server.py) optionally serves it with FastAPI, WebSockets, scenario data, benchmark metrics, and a local MATLAB trigger.

## Quick start

### Interactive browser simulator

The simulator can run locally with Python 3.10 or later. From the repository root:

```powershell
python run_simulator.py
```

The launcher selects a free local port and opens the simulator. It uses the FastAPI server when the optional dependencies are installed; otherwise it falls back to a static local server.

To enable the API and WebSocket bridge explicitly:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn server.bridge_server:app --host 127.0.0.1 --port 8000
```

Then open <http://127.0.0.1:8000/simulator/>.

### MATLAB pipeline

The MATLAB workflows require MATLAB and the toolboxes used by the scenario scripts, including Automated Driving Toolbox.

```matlab
addpath(genpath('src'));
addpath(genpath('scenarios'));
addpath(genpath('tests'));
test_all_scenarios();
```

To run one scenario:

```matlab
history = run_full_pipeline('cattle_crossing');
```

The browser demo is useful without MATLAB. The **Run MATLAB Suite** control, however, is intended only for a trusted local machine with MATLAB installed.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`src/`](src/) | MATLAB perception, prediction, planning, decision, control, scenario, and metrics modules |
| [`scenarios/`](scenarios/) | MATLAB scenario construction and visualization scripts |
| [`planners/`](planners/) | Standalone adaptive path-planner implementation |
| [`tests/`](tests/) | MATLAB regression tests |
| [`simulator/`](simulator/) | Self-contained Three.js/WebGL interactive simulator |
| [`server/`](server/) | Optional FastAPI and WebSocket bridge |
| [`datasets/`](datasets/) | Sample imagery, annotations, agent catalog, and synthetic logs |
| [`docs/`](docs/) | Architecture, benchmark, implementation, and viva documentation |

## Validation and documentation

- MATLAB test coverage: [`tests/test_all_scenarios.m`](tests/test_all_scenarios.m), [`tests/test_path_planner.m`](tests/test_path_planner.m), and [`tests/test_perception_fusion.m`](tests/test_perception_fusion.m).
- Browser validation utilities: [`verify_all_15_scenarios.py`](verify_all_15_scenarios.py) and [`verify_decision_matrix.py`](verify_decision_matrix.py).
- Design and reported simulation results: [`docs/ARCHITECTURE_DIAGRAMS.md`](docs/ARCHITECTURE_DIAGRAMS.md), [`docs/BENCHMARK_RESULTS.md`](docs/BENCHMARK_RESULTS.md), and [`docs/FINAL_IMPLEMENTATION_REPORT.md`](docs/FINAL_IMPLEMENTATION_REPORT.md).

Reported performance values are results from the repository's documented simulation and verification workflows. They are not real-world vehicle safety claims.

## Deployment

### Static demo: ready to deploy

The contents of [`simulator/`](simulator/) are static HTML, CSS, and JavaScript and can be deployed now to GitHub Pages, Netlify, or Vercel.

- **GitHub Pages:** deploy the `main` branch from the repository root and use the `/simulator/` path in the published site.
- **Netlify or Vercel:** set the publish/output directory to `simulator` and use no build command.

In a static deployment, the 3D simulator and its local scenario logic work. The optional WebSocket connection and the **Run MATLAB Suite** button fail gracefully because a static host cannot run Python or MATLAB.

### Full backend: local/demo only until hardened

Do not expose the current FastAPI bridge publicly as-is. It includes a local MATLAB execution endpoint and permissive development CORS settings. A public deployment requires a protected or removed MATLAB endpoint, restricted CORS origins, authentication, secrets management, and a host environment that is licensed and configured for MATLAB. A Python-capable platform such as Render, Railway, Fly.io, or an institutional server would be appropriate only after those changes.

## Data and licensing

Dataset provenance and annotation notes are documented in [`datasets/DATASET_MANIFEST.md`](datasets/DATASET_MANIFEST.md). Review the cited source and licence terms before redistributing individual assets. No repository-wide licence has been selected yet.
