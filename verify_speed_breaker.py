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
        "--remote-debugging-port=9223",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    print("[*] Chrome headless launched on port 9223...")
    await asyncio.sleep(2.0)

    ws_url = None
    for attempt in range(10):
        try:
            targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9223/json").read().decode())
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

        print("[*] Switching to Scenario 14: speed_breaker...")
        await eval_js("switchScenario('speed_breaker')")
        await asyncio.sleep(0.5)

        speeds = []
        states = []
        reasons = []

        # Monitor ego vehicle as it approaches, crosses, and clears the speed breaker
        for step in range(35):
            await asyncio.sleep(0.2)
            telem = await eval_js("""(() => {
                return {
                    z: egoVehicle.z,
                    speedKmh: egoVehicle.speed * 3.6,
                    activeState: brain.activeState,
                    reason: document.getElementById('decision-reason') ? document.getElementById('decision-reason').innerText : '',
                    steer: egoVehicle.steerAngle,
                    x: egoVehicle.x
                };
            })()""")

            if telem:
                speeds.append(telem["speedKmh"])
                states.append(telem["activeState"])
                reasons.append(telem["reason"])
                print(f"Step {step:02d} | z={telem['z']:.1f}m | x={telem['x']:.2f}m | speed={telem['speedKmh']:.1f} km/h | state={telem['activeState']} | reason: {telem['reason']}")

                # When crossing over bump (z ~ 43-48m), take a screenshot
                if 42 <= telem['z'] <= 48 and not os.path.exists(os.path.join(ARTIFACT_DIR, "speed_breaker_crossing.png")):
                    sc = await call("Page.captureScreenshot", {"format": "png"})
                    if "data" in sc:
                        with open(os.path.join(ARTIFACT_DIR, "speed_breaker_crossing.png"), "wb") as f:
                            f.write(base64.b64decode(sc["data"]))
                        print("[*] Captured speed_breaker_crossing.png")

        min_speed = min(speeds)
        max_speed = max(speeds)
        emergency_count = sum(1 for s in states if "EMERGENCY" in s)

        print("\n================== VERIFICATION METRICS ==================")
        print(f"Initial Speed: {speeds[0]:.1f} km/h")
        print(f"Minimum Speed over Bump: {min_speed:.1f} km/h (target ~12 km/h)")
        print(f"Final Resumed Speed: {speeds[-1]:.1f} km/h")
        print(f"Observed FSM States: {set(states)}")
        print(f"Emergency Stops Triggered: {emergency_count}")
        print("==========================================================")

        assert emergency_count == 0, f"FAIL: Emergency stop triggered {emergency_count} times on speed breaker!"
        assert min_speed >= 8.0, f"FAIL: Car slowed down too much / stopped: {min_speed:.1f} km/h"
        assert min_speed <= 18.0, f"FAIL: Car did not slow down enough for speed breaker: {min_speed:.1f} km/h"
        assert speeds[-1] > 20.0, f"FAIL: Car failed to resume cruising speed: {speeds[-1]:.1f} km/h"
        print("[SUCCESS] Speed breaker smooth crossing verified! Vehicle slows to ~12 km/h without stopping and resumes.")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(main())
