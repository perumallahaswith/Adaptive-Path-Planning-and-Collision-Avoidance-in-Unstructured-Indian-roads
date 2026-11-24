import asyncio
import json
import urllib.request
import subprocess
import time
import base64
import os

ARTIFACT_DIR = r"C:\Users\Haswith\.gemini\antigravity\brain\50f91f82-207f-44f7-ba1c-ce039b405d71"

async def run_test():
    import websockets
    # Launch Chrome headless with remote debugging
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9225",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"http://127.0.0.1:8000/simulator/index.html?t={int(time.time())}"
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    print("[*] Chrome headless launched on port 9225...")
    time.sleep(2.0)

    ws_url = None
    for attempt in range(12):
        try:
            targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9225/json").read().decode())
            for t in targets:
                if t.get("type") == "page" and "simulator" in t.get("url", ""):
                    ws_url = t.get("webSocketDebuggerUrl")
                    break
            if ws_url:
                break
        except Exception:
            time.sleep(0.5)

    if not ws_url:
        print("[!] Could not connect to Chrome DevTools Protocol")
        chrome_proc.kill()
        return

    print(f"[*] Connected to CDP WebSocket: {ws_url}")

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
            if "exceptionDetails" in res:
                print(f"[JS ERROR in eval] {res['exceptionDetails']}")
            return res.get("result", {}).get("value")

        await call("Console.enable")
        await call("Runtime.enable")

        print("[*] Waiting for 3D engine initialization...")
        await asyncio.sleep(3.0)

        # Check what is initialized on window
        diag = await eval_js("""
            (() => {
                try {
                    const b = new AutonomousDrivingBrain();
                    return { success: true, brainActive: b.activeState };
                } catch (e) {
                    return { success: false, error: e.message, stack: e.stack };
                }
            })()
        """)
        print(f"[*] Diagnostics on page: {diag}")

    chrome_proc.kill()

if __name__ == "__main__":
    asyncio.run(run_test())
