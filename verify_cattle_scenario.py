import asyncio
import json
import urllib.request
import subprocess
import time
import base64
import os
import websockets

ARTIFACT_DIR = r"C:\Users\Haswith\.gemini\antigravity\brain\50f91f82-207f-44f7-ba1c-ce039b405d71"

async def main():
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9224",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    print("[*] Chrome headless launched on port 9224...")
    await asyncio.sleep(2.0)

    ws_url = None
    for attempt in range(10):
        try:
            targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9224/json").read().decode())
            for t in targets:
                if t.get("type") == "page" and "simulator" in t.get("url", ""):
                    ws_url = t.get("webSocketDebuggerUrl")
                    break
            if ws_url:
                break
        except Exception:
            await asyncio.sleep(0.5)

    if not ws_url:
        print("[!] Could not connect to Chrome CDP")
        chrome_proc.kill()
        return

    print(f"[*] Connected to CDP: {ws_url}")

    async with websockets.connect(ws_url, max_size=50*1024*1024) as ws:
        msg_id = 0
        async def call(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method, "params": params or {}}
            await ws.send(json.dumps(payload))
            while True:
                resp = json.loads(await ws.recv())
                if resp.get("id") == payload["id"]:
                    return resp.get("result", {})

        async def eval_js(expr):
            res = await call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
            return res.get("result", {}).get("value")

        await call("Page.enable")
        await asyncio.sleep(1.5)

        print("[*] Switching to Scenario 1: cattle_crossing...")
        await eval_js("switchScenario('cattle_crossing')")
        await asyncio.sleep(0.5)

        # Also inject a speed breaker ahead to simulate user's exact combined condition
        await eval_js("ScenarioCatalog.spawnCustomObstacle('speed_breaker', 55, obstacleManager, egoVehicle)")
        await asyncio.sleep(0.5)

        speeds = []
        states = []
        reasons = []

        # Monitor ego vehicle through the cattle crossing & speed breaker
        for step in range(50):
            await asyncio.sleep(0.25)
            telem = await eval_js("""(() => {
                const cow = obstacleManager.obstacles.find(o => o.classId === 4);
                return {
                    z: egoVehicle.z,
                    speedKmh: egoVehicle.speed * 3.6,
                    activeState: brain.activeState,
                    reason: document.getElementById('decision-reason') ? document.getElementById('decision-reason').innerText : '',
                    cowX: cow ? cow.x : null,
                    cowZ: cow ? cow.z : null,
                    cowDZ: cow ? (cow.z - egoVehicle.z) : null
                };
            })()""")

            if telem:
                speeds.append(telem["speedKmh"])
                states.append(telem["activeState"])
                reasons.append(telem["reason"])
                print(f"Step {step:02d} | z={telem['z']:.1f}m | speed={telem['speedKmh']:.1f} km/h | state={telem['activeState']} | cow_x={telem['cowX']:.2f}m, dz={telem['cowDZ']:.1f}m | reason: {telem['reason']}")

                # Capture screenshot when holding emergency stop for cattle
                if telem['activeState'] == 'EMERGENCY_STOP' and not os.path.exists(os.path.join(ARTIFACT_DIR, "cattle_emergency_correct.png")):
                    sc = await call("Page.captureScreenshot", {"format": "png"})
                    if "data" in sc:
                        with open(os.path.join(ARTIFACT_DIR, "cattle_emergency_correct.png"), "wb") as f:
                            f.write(base64.b64decode(sc["data"]))
                        print("[*] Captured cattle_emergency_correct.png")

        print("\n================== SCENARIO 1 METRICS ==================")
        print(f"Observed FSM States: {set(states)}")
        print(f"Min Speed during Cattle Stop: {min(speeds):.1f} km/h")
        print(f"Final Speed: {speeds[-1]:.1f} km/h")
        print("=========================================================")

        # Assertions
        assert "EMERGENCY_STOP" in states, "FAIL: Should have entered EMERGENCY_STOP when cow was in lane!"
        assert min(speeds) < 1.0, f"FAIL: Car should have stopped for cow! Min speed: {min(speeds)}"
        # And after cow crosses, car should accelerate and continue
        assert speeds[-1] > 10.0, f"FAIL: Car did not resume after cow cleared! Final speed: {speeds[-1]}"
        print("[SUCCESS] Cattle crossing emergency stop and post-clearance recovery verified!")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(main())

