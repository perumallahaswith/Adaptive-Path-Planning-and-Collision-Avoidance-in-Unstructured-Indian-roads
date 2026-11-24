import asyncio
import json
import urllib.request
import subprocess
import time
import websockets

async def check_step0():
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9229",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    await asyncio.sleep(2.0)

    targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9229/json").read().decode())
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

        await eval_js("switchScenario('cattle_crossing')")
        await asyncio.sleep(0.5)

        # Let's inspect brain before spawn
        res = await eval_js("""(() => {
            return {
                state: brain.activeState,
                targetSpeed: brain.targetSpeed,
                obstacles: obstacleManager.obstacles.map(o => ({ name: o.name, x: o.x, z: o.z }))
            };
        })()""")
        print("Before spawn:", res)

        # Spawn speed breaker
        await eval_js("""(() => {
            const sel = document.getElementById('obstacle-select');
            sel.value = 'speed_breaker';
            sel.dispatchEvent(new Event('change'));
        })()""")

        res2 = await eval_js("""(() => {
            return {
                state: brain.activeState,
                targetSpeed: brain.targetSpeed,
                obstacles: obstacleManager.obstacles.map(o => ({ name: o.name, x: o.x, z: o.z }))
            };
        })()""")
        print("After spawn:", res2)

        # Step brain once manually and check planResult
        plan = await eval_js("""(() => {
            const dt = 0.016;
            const res = brain.step(egoVehicle, obstacleManager.obstacles, dt, false, obstacleManager.ambientCars);
            return {
                activeState: res.activeState,
                targetSpeed: res.targetSpeed,
                reason: res.reason,
                brainTargetSpeed: brain.targetSpeed
            };
        })()""")
        print("Plan step result:", plan)

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(check_step0())

