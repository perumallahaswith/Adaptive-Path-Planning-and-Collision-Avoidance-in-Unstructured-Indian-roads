import asyncio
import json
import urllib.request
import subprocess
import time
import websockets

async def test_sb_only():
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9228",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    await asyncio.sleep(2.0)

    targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9228/json").read().decode())
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

        # Clear obstacles and spawn ONLY a speed breaker
        await eval_js("""(() => {
            obstacleManager.clear();
            obstacleManager.createSpeedBreaker(1, -1.85, 35);
            egoVehicle.setPosition(-1.85, 0, 0, 11.5);
            brain.activeState = 'CRUISE';
        })()""")

        for step in range(30):
            await asyncio.sleep(0.2)
            d = await eval_js("""(() => ({
                z: egoVehicle.z,
                speed: (egoVehicle.speed * 3.6).toFixed(1),
                target: (brain.targetSpeed * 3.6).toFixed(1),
                state: brain.activeState,
                reason: document.getElementById('decision-reason') ? document.getElementById('decision-reason').innerText : ''
            }))()""")
            print(f"Step {step:02d} | z={d['z']:.1f}m | speed={d['speed']} km/h | target={d['target']} | state={d['state']} | reason={d['reason']}")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(test_sb_only())

