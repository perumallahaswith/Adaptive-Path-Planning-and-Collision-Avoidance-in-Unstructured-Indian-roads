"""Safety-contract regression for the browser digital twin.

This test intentionally verifies more than scenario loading: every catalogued
scenario must activate its declared maneuver, maintain the right road boundary,
and record zero physical contact events in the deterministic simulator.
"""

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request


CONTRACTS = {
    "cattle_crossing": {"expected": "EMERGENCY_STOP"},
    "bridge_hazard": {"expected": "BRIDGE_STOP"},
    "village_road": {"expected": "OVERTAKE_LEFT", "sequence": ["OVERTAKE_LEFT", "RETURN_RIGHT", "CRUISE"]},
    "intersection": {"expected": "INTERACTIVE_MERGE"},
    "highway_merge": {"expected": "INTERACTIVE_MERGE"},
    "dense_market": {"expected": "INCHING"},
    "motorcycle_filtering": {"expected": "NUDGE"},
    "pothole_avoidance": {"expected": "OVERTAKE_LEFT", "sequence": ["OVERTAKE_LEFT", "RETURN_RIGHT", "CRUISE"]},
    "sensor_degradation": {"expected": "NUDGE"},
    "stalled_vehicle": {"expected": "OVERTAKE_LEFT", "sequence": ["GAP_WAIT", "OVERTAKE_LEFT", "RETURN_RIGHT", "CRUISE"]},
    "construction_detour": {"expected": "OVERTAKE_LEFT", "sequence": ["OVERTAKE_LEFT", "RETURN_RIGHT", "CRUISE"]},
    "night_pedestrian": {"expected": "EMERGENCY_STOP"},
    "animal_herd": {"expected": "OVERTAKE_LEFT", "sequence": ["OVERTAKE_LEFT", "RETURN_RIGHT", "CRUISE"]},
    "speed_breaker": {"expected": "SPEED_GOVERNED"},
    "reversion_recovery": {"expected": "NUDGE"},
}

INJECTED_HAZARDS = (
    "cattle", "autorickshaw", "tractor", "pushcart", "pedestrian",
    "two_wheeler", "pothole", "construction", "speed_breaker", "stalled_vehicle",
)


async def main():
    import websockets

    profile_dir = tempfile.mkdtemp(prefix="sih_decision_matrix_")
    debug_port = 9224
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=" + str(debug_port),
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=" + profile_dir,
        "http://127.0.0.1:8000/simulator/index.html?decision-matrix=" + str(int(time.time())),
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)

    try:
        ws_url = None
        for _ in range(20):
            try:
                targets = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{debug_port}/json").read().decode())
                page = next((target for target in targets if target.get("type") == "page" and "simulator" in target.get("url", "")), None)
                if page:
                    ws_url = page["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.25)

        if not ws_url:
            raise RuntimeError("Could not attach to the fresh Chrome validation page.")

        async with websockets.connect(ws_url, max_size=50 * 1024 * 1024) as ws:
            request_id = 0

            async def evaluate(expression):
                nonlocal request_id
                request_id += 1
                await ws.send(json.dumps({
                    "id": request_id,
                    "method": "Runtime.evaluate",
                    "params": {"expression": expression, "returnByValue": True, "awaitPromise": True},
                }))
                while True:
                    response = json.loads(await ws.recv())
                    if response.get("id") == request_id:
                        if "exceptionDetails" in response.get("result", {}):
                            raise RuntimeError(response["result"]["exceptionDetails"].get("text", "JavaScript evaluation failed"))
                        return response.get("result", {}).get("result", {}).get("value")

            ready = False
            for _ in range(24):
                await asyncio.sleep(0.25)
                ready = await evaluate("typeof window.runScenarioSafetyProbe === 'function'")
                if ready:
                    break
            if not ready:
                diagnostics = await evaluate("({href:location.href,title:document.title,readyState:document.readyState, appScript:[...document.scripts].map(s=>s.src).filter(s=>s.includes('app.js')).join(','), world:typeof window.world, ego:typeof window.egoVehicle, brain:typeof window.brain, probe:typeof window.runScenarioSafetyProbe, body:document.body.innerText.slice(0,160)})")
                raise RuntimeError(f"Simulator did not expose the safety probe: {diagnostics}")

            print("\nDECISION & CONTACT SAFETY MATRIX\n" + "=" * 78)
            passed = 0
            for scenario_id, contract in CONTRACTS.items():
                expected = contract["expected"]
                result = await evaluate(f"window.runScenarioSafetyProbe('{scenario_id}', 440, 0.05)")
                observed = result.get("speedGovernedSeen") if expected == "SPEED_GOVERNED" else expected in result.get("statesSeen", [])
                contact_free = result.get("contactEvents") == 0
                in_bounds = result.get("boundaryMaintained") is True
                timeline = result.get("phaseTimeline", [])
                sequence = contract.get("sequence", [])
                sequence_ok = all(state in timeline for state in sequence) and timeline[-1:] == ["CRUISE"] if sequence else True
                if not observed:
                    print(f"[DEBUG] {scenario_id}: {result}")
                if not sequence_ok:
                    print(f"[DEBUG] {scenario_id}: lifecycle result {result}")
                assert observed, f"{scenario_id}: expected {expected}, observed {result.get('statesSeen')}"
                assert contact_free, f"{scenario_id}: physical contact event recorded"
                assert in_bounds, f"{scenario_id}: right road boundary violation"
                assert sequence_ok, f"{scenario_id}: required lifecycle {sequence}, observed {timeline}"
                print(
                    f"[PASS] {scenario_id:<23} | expected={expected:<18} "
                    f"| phases={' > '.join(timeline) or 'none':<52} "
                    f"| end={result['state']:<18} | contacts=0"
                )
                passed += 1

            print("=" * 78)
            print(f"PASS: {passed}/{len(CONTRACTS)} simulation contracts; no contact events; boundary maintained.")

            print("\nINJECTED HAZARD SAFETY CHECK\n" + "=" * 78)
            for hazard_type in INJECTED_HAZARDS:
                result = await evaluate(f"window.runInjectedHazardProbe('{hazard_type}', 320, 0.05)")
                assert result.get("contactEvents") == 0, f"injected {hazard_type}: physical contact event recorded"
                assert result.get("boundaryMaintained") is True, f"injected {hazard_type}: road boundary violation"
                print(f"[PASS] injected {hazard_type:<16} | phases={' > '.join(result.get('phaseTimeline', [])) or 'none'}")
            print("PASS: all Trigger Hazard / Spawn Obstacle types maintained zero contacts and road boundaries.")
    finally:
        chrome_proc.kill()
        chrome_proc.wait(timeout=10)
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
