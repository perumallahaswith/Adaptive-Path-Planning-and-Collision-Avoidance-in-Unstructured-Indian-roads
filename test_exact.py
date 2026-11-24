import asyncio
import json
import urllib.request
import subprocess
import time
import websockets

async def test_exact_user_scene():
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9227",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    await asyncio.sleep(2.0)

    targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9227/json").read().decode())
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

        # 1. Switch to cattle_crossing
        await eval_js("switchScenario('cattle_crossing')")
        await asyncio.sleep(0.5)

        # 2. Spawn speed breaker via dropdown
        await eval_js("""(() => {
            const sel = document.getElementById('obstacle-select');
            sel.value = 'speed_breaker';
            sel.dispatchEvent(new Event('change'));
        })()""")

        print("Logged state after spawn:")
        for step in range(30):
            await asyncio.sleep(0.2)
            d = await eval_js("""(() => {
                const cow = obstacleManager.obstacles.find(o => o.classId === 4);
                const sb = obstacleManager.obstacles.find(o => o.classId === 9);
                return {
                    egoZ: egoVehicle.z,
                    egoX: egoVehicle.x,
                    egoSpeed: (egoVehicle.speed * 3.6).toFixed(1),
                    targetSpeed: (brain.targetSpeed * 3.6).toFixed(1),
                    activeState: brain.activeState,
                    reason: document.getElementById('decision-reason') ? document.getElementById('decision-reason').innerText : '',
                    accCmd: egoVehicle.acceleration.toFixed(2),
                    cow: cow ? { x: cow.x.toFixed(2), z: cow.z.toFixed(2), isTriggered: cow.isTriggered, speed: cow.speed } : null,
                    sb: sb ? { x: sb.x.toFixed(2), z: sb.z.toFixed(2), dz: (sb.z - egoVehicle.z).toFixed(1) } : null,
                    nearestObstacle: brain.nearestObstacle ? brain.nearestObstacle.name : null
                };
            })()""")
            print(f"Step {step:02d} | egoZ={d['egoZ']:.1f}m | speed={d['egoSpeed']} km/h (target {d['targetSpeed']}) | state={d['activeState']} | reason: {d['reason']}")
            if d['cow']:
                print(f"       Cow: x={d['cow']['x']}m, z={d['cow']['z']}m, triggered={d['cow']['isTriggered']}, speed={d['cow']['speed']}")
            if d['sb']:
                print(f"       Speed Breaker: dz={d['sb']['dz']}m")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(test_exact_user_scene())

