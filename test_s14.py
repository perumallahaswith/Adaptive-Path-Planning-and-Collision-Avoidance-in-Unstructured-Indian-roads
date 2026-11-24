import asyncio
import json
import urllib.request
import subprocess
import time
import websockets

async def test_s14_full():
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9226",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "http://127.0.0.1:8000/simulator/index.html?v=" + str(int(time.time()))
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    await asyncio.sleep(2.0)

    ws_url = None
    for attempt in range(10):
        try:
            targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9226/json").read().decode())
            for t in targets:
                if t.get("type") == "page" and "simulator" in t.get("url", ""):
                    ws_url = t.get("webSocketDebuggerUrl")
                    break
            if ws_url:
                break
        except Exception:
            await asyncio.sleep(0.5)

    if not ws_url:
        print("No CDP")
        chrome_proc.kill()
        return

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

        print("\n--- SWITCHING TO SCENARIO 14 ---")
        await eval_js("switchScenario('speed_breaker')")
        
        stopped = False
        for step in range(40):
            await asyncio.sleep(0.2)
            s = await eval_js("""(() => ({
                z: egoVehicle.z,
                speed: (egoVehicle.speed * 3.6).toFixed(1),
                targetSpeed: (brain.targetSpeed * 3.6).toFixed(1),
                acc: egoVehicle.acceleration.toFixed(2),
                state: brain.activeState,
                reason: document.getElementById('decision-reason') ? document.getElementById('decision-reason').innerText : ''
            }))()""")
            print(f"Step {step:02d}: z={s['z']:.1f}m, speed={s['speed']} km/h, target={s['targetSpeed']}, state={s['state']}, reason={s['reason']}")
            if float(s['speed']) < 1.0 and s['z'] > 10.0:
                stopped = True

        print(f"\nDid vehicle come to a stop? {stopped}")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(test_s14_full())

