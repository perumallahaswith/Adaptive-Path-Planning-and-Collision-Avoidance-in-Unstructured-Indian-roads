import asyncio
import json
import urllib.request
import subprocess
import time
import base64
import os
import websockets

ARTIFACT_DIR = r"C:\Users\Haswith\.gemini\antigravity\brain\50f91f82-207f-44f7-ba1c-ce039b405d71"

async def capture_verification_artifacts():
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9230",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    await asyncio.sleep(2.0)

    targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9230/json").read().decode())
    ws_url = targets[0]["webSocketDebuggerUrl"]

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
        await asyncio.sleep(1.0)

        # 1. Test Scenario 14: Speed Breaker
        print("[1] Testing Scenario 14...")
        await eval_js("switchScenario('speed_breaker')")
        
        crossed = False
        for step in range(35):
            await asyncio.sleep(0.2)
            d = await eval_js("""(() => ({
                z: egoVehicle.z,
                speed: (egoVehicle.speed * 3.6).toFixed(1),
                target: (brain.targetSpeed * 3.6).toFixed(1),
                state: brain.activeState,
                reason: document.getElementById('decision-reason') ? document.getElementById('decision-reason').innerText : ''
            }))()""")
            
            # When crossing directly over the bump (z ~ 44m), capture screenshot
            if 43 <= d['z'] <= 47 and not crossed:
                crossed = True
                sc = await call("Page.captureScreenshot", {"format": "png"})
                if "data" in sc:
                    with open(os.path.join(ARTIFACT_DIR, "speed_breaker_12kmh_traversal.png"), "wb") as f:
                        f.write(base64.b64decode(sc["data"]))
                print(f"Captured traversal at z={d['z']:.1f}m, speed={d['speed']} km/h, reason: {d['reason']}")

        print(f"Scenario 14 test finished. Crossed? {crossed}")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(capture_verification_artifacts())

