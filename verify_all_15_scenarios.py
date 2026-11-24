"""
Verification Suite for all 15 Indian Unstructured Road Scenarios (SIH-26037 Part 12)
Runs headless Chrome via CDP to load and simulate all 15 scenarios:
  1. cattle_crossing
  2. bridge_hazard
  3. village_road
  4. intersection
  5. highway_merge
  6. dense_market
  7. motorcycle_filtering
  8. pothole_avoidance
  9. sensor_degradation
  10. stalled_vehicle
  11. construction_detour
  12. night_pedestrian
  13. animal_herd
  14. speed_breaker
  15. reversion_recovery
"""

import asyncio
import json
import urllib.request
import subprocess
import time
import os
import tempfile

SCENARIO_IDS = [
    "cattle_crossing",
    "bridge_hazard",
    "village_road",
    "intersection",
    "highway_merge",
    "dense_market",
    "motorcycle_filtering",
    "pothole_avoidance",
    "sensor_degradation",
    "stalled_vehicle",
    "construction_detour",
    "night_pedestrian",
    "animal_herd",
    "speed_breaker",
    "reversion_recovery"
]

async def main():
    import websockets
    # A unique profile prevents CDP from attaching to a stale browser tab from a
    # previous validation run.  The former fixed profile could leave Chrome
    # running on port 9223, which made the assertions inspect an old page.
    profile_dir = tempfile.mkdtemp(prefix="sih_15_scenario_verify_")
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9223",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=" + profile_dir,
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    time.sleep(2.0)

    ws_url = None
    for attempt in range(15):
        try:
            targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read().decode())
            for t in targets:
                if t.get("type") == "page" and "simulator" in t.get("url", ""):
                    ws_url = t.get("webSocketDebuggerUrl")
                    break
            if ws_url:
                break
        except Exception:
            time.sleep(0.5)

    if not ws_url:
        print("[!] Could not connect to Chrome DevTools Protocol on port 9223", flush=True)
        chrome_proc.kill()
        return

    print(f"[*] Connected to Chrome CDP on port 9223", flush=True)

    async with websockets.connect(ws_url, max_size=50*1024*1024) as ws:
        msg_id = 0
        async def call(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method, "params": params or {}}
            await ws.send(json.dumps(payload))
            while True:
                resp = json.loads(await ws.recv())
                if resp.get("id") == msg_id:
                    return resp.get("result", {})

        async def eval_js(expr):
            res = await call("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
            if "exceptionDetails" in res:
                print(f"[!] JS Exception: {res['exceptionDetails']}", flush=True)
            return res.get("result", {}).get("value")

        await call("Runtime.enable")
        await call("Page.enable")
        await asyncio.sleep(1.0)

        print("\n" + "=" * 65, flush=True)
        print("  SIH-26037: BATCH REGRESSION TEST ACROSS ALL 15 SCENARIOS", flush=True)
        print("=" * 65, flush=True)

        passed_count = 0
        for idx, s_id in enumerate(SCENARIO_IDS, 1):
            await eval_js(f"switchScenario('{s_id}')")
            await asyncio.sleep(0.35)
                
            state = await eval_js("""
                ({
                    scenario: activeScenarioData ? activeScenarioData.id : 'none',
                    title: activeScenarioData ? activeScenarioData.title : 'none',
                    egoX: egoVehicle.x,
                    egoZ: egoVehicle.z,
                    egoSpeed: egoVehicle.speed,
                    fsmState: brain.activeState,
                    obstaclesCount: obstacleManager.obstacles.length,
                    hasAmbient: obstacleManager.ambientCars.length > 0
                })
            """)
            
            # Assertions
            assert state["scenario"] == s_id, f"Scenario ID mismatch: expected {s_id}, got {state['scenario']}"
            # Certified overtakes are allowed to use the opposing lane; both
            # road-edge constraints remain inviolable.
            assert state["egoX"] >= -3.66, f"Ego violated right road boundary: x = {state['egoX']}"
            assert state["egoX"] <= 3.66, f"Ego violated left road boundary: x = {state['egoX']}"
            
            print(f"[{idx:02d}/15] {state['title']:<48} | EgoX: {state['egoX']:5.2f}m | FSM: {state['fsmState']:<14} | [PASS]", flush=True)
            passed_count += 1

        print("=" * 65, flush=True)
        print(f"  ALL 15 INDIAN UNSTRUCTURED ROAD SCENARIOS PASSED: {passed_count}/15", flush=True)
        print("=" * 65 + "\n", flush=True)

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(main())
