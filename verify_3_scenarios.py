import asyncio
import json
import urllib.request
import subprocess
import time
import base64
import os

ARTIFACT_DIR = r"C:\Users\Haswith\.gemini\antigravity\brain\50f91f82-207f-44f7-ba1c-ce039b405d71"

async def run_tests():
    import websockets
    chrome_cmd = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        "--headless=new",
        "--remote-debugging-port=9227",
        "--window-size=1920,1080",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        f"http://127.0.0.1:8000/simulator/index.html?t={int(time.time())}"
    ]
    chrome_proc = subprocess.Popen(chrome_cmd)
    print("[*] Chrome headless launched on port 9227...")
    time.sleep(2.5)

    ws_url = None
    for attempt in range(12):
        try:
            targets = json.loads(urllib.request.urlopen("http://127.0.0.1:9227/json").read().decode())
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
                print(f"[JS ERROR] {res['exceptionDetails']}")
            return res.get("result", {}).get("value")

        async def capture_screen(filename):
            res = await call("Page.captureScreenshot", {"format": "png"})
            data = res.get("data")
            if data:
                path = os.path.join(ARTIFACT_DIR, filename)
                with open(path, "wb") as f:
                    f.write(base64.b64decode(data))
                print(f"[+] Screenshot saved: {path}")

        print("[*] Waiting for 3D engine initialization...")
        await asyncio.sleep(2.5)

        # =============================================================
        # 1. SCENARIO: sensor_degradation (Monsoon Rain & Sensor Degradation)
        # =============================================================
        print("\n" + "=" * 65)
        print("TEST 1: MONSOON RAIN & SENSOR DEGRADATION (Scenario 9)")
        print("=" * 65)
        await eval_js("window.switchScenario('sensor_degradation');")
        await asyncio.sleep(1.0)

        max_speed_rain = 0.0
        rain_verified = False
        cam_degraded = False

        for step in range(20):
            await asyncio.sleep(0.25)
            data = await eval_js("""
                (() => {
                    const ego = window.egoVehicle;
                    const brain = window.brain;
                    const world = window.world;
                    const chipCam = document.getElementById('chip-cam-status');
                    const chipRadar = document.getElementById('chip-radar-status');
                    return {
                        egoZ: ego.z,
                        speedKmH: ego.speed * 3.6,
                        state: brain.activeState,
                        reason: brain.lastReason || '',
                        weather: world.currentWeather || world.activeWeather || 'DAY',
                        chipCamText: chipCam ? chipCam.innerText : '',
                        chipRadarText: chipRadar ? chipRadar.innerText : ''
                    };
                })()
            """)
            if data:
                speed = data['speedKmH']
                max_speed_rain = max(max_speed_rain, speed)
                if data['weather'] == 'RAIN':
                    rain_verified = True
                if 'DEGRADED' in data['chipCamText']:
                    cam_degraded = True
                print(f"  Step {step:02d}: Ego Z={data['egoZ']:.1f}m, Speed={speed:.1f} km/h, State={data['state']}, Weather={data['weather']}, CamChip={data['chipCamText']}")

        await capture_screen("sensor_degradation_verified.png")
        print(f"\n[+] Test 1 Summary:")
        print(f"    Rain Weather Active: {rain_verified}")
        print(f"    Max Speed in Rain: {max_speed_rain:.1f} km/h (Governed <= 32 km/h)")
        print(f"    Camera Chip Degraded Status: {cam_degraded}")
        assert rain_verified, "Rain mode not active"
        assert max_speed_rain <= 33.0, f"Speed governor failed in rain: {max_speed_rain:.1f} km/h"
        assert cam_degraded, "Camera degraded badge not updated"
        print("[PASS] Test 1: Monsoon Rain & Sensor Degradation verified successfully!")

        # =============================================================
        # 2. SCENARIO: stalled_vehicle (Oncoming Priority Yield)
        # =============================================================
        print("\n" + "=" * 65)
        print("TEST 2: STALLED VEHICLE (Oncoming Priority Yield - Scenario 10)")
        print("=" * 65)
        await eval_js("window.switchScenario('stalled_vehicle');")
        await asyncio.sleep(1.0)

        did_enter_oncoming_early = False
        queue_stopped = False
        final_clearance_stalled = 0.0

        for step in range(32):
            await asyncio.sleep(0.25)
            data = await eval_js("""
                (() => {
                    const ego = window.egoVehicle;
                    const brain = window.brain;
                    const stalled = window.obstacleManager.obstacles.find(o => o.name && o.name.includes('Stalled'));
                    if (!stalled || !ego) return null;
                    const physicalClearance = (stalled.z - stalled.hL) - (ego.z + ego.hL);
                    return {
                        egoX: ego.x,
                        egoZ: ego.z,
                        speedKmH: ego.speed * 3.6,
                        state: brain.activeState,
                        reason: brain.lastReason || '',
                        clearance: physicalClearance,
                        oncomingThreat: brain.oncomingThreat
                    };
                })()
            """)
            if data:
                clearance = data['clearance']
                speed = data['speedKmH']
                # Check if car gambled into oncoming lane (x > -0.3) while trucks were coming
                if data['egoX'] > -0.3 and clearance > 1.0 and data['oncomingThreat']:
                    did_enter_oncoming_early = True
                if speed < 0.2 and 4.8 <= clearance <= 6.8:
                    queue_stopped = True
                    final_clearance_stalled = clearance
                print(f"  Step {step:02d}: Ego X={data['egoX']:.2f}m, Z={data['egoZ']:.1f}m, Speed={speed:.1f} km/h, Clearance={clearance:.2f}m, State={data['state']}")

        await capture_screen("stalled_vehicle_verified.png")
        print(f"\n[+] Test 2 Summary:")
        print(f"    Gambled Into Oncoming Lane Early: {did_enter_oncoming_early} (Expected: False)")
        print(f"    Safely Stopped in Queue: {queue_stopped} (Clearance: {final_clearance_stalled:.2f}m)")
        assert not did_enter_oncoming_early, "Car unsafely gambled into oncoming lane!"
        assert queue_stopped, "Car did not stop in queue before stalled vehicle!"
        print("[PASS] Test 2: Stalled vehicle in-lane queue hold verified successfully!")

        # =============================================================
        # 3. SCENARIO: reversion_recovery (Multi-Obstacle S-Curve Reversion)
        # =============================================================
        print("\n" + "=" * 65)
        print("TEST 3: MULTI-OBSTACLE S-CURVE REVERSION (Scenario 15)")
        print("=" * 65)
        await eval_js("window.switchScenario('reversion_recovery');")
        await asyncio.sleep(1.0)

        nudged_left = False
        reverted_right = False
        recovered_center = False

        for step in range(42):
            await asyncio.sleep(0.28)
            data = await eval_js("""
                (() => {
                    const ego = window.egoVehicle;
                    const brain = window.brain;
                    return {
                        egoX: ego.x,
                        egoZ: ego.z,
                        speedKmH: ego.speed * 3.6,
                        state: brain.activeState,
                        reason: brain.lastReason || ''
                    };
                })()
            """)
            if data:
                x = data['egoX']
                z = data['egoZ']
                # S-curve phase 1: Nudged left around pushcart at z=32m (pushcart is at x=-2.6m)
                if z >= 20.0 and z <= 42.0 and x > -1.35:
                    nudged_left = True
                # S-curve phase 2: Reverted right around auto-rickshaw at z=60m (auto is at x=-0.4m)
                if z >= 45.0 and z <= 68.0 and x < -1.95:
                    reverted_right = True
                # S-curve phase 3: Recovered towards nominal lane center (-1.85m) after z > 68m
                if z > 68.0 and abs(x - (-1.85)) < 0.35:
                    recovered_center = True
                print(f"  Step {step:02d}: Ego X={x:.2f}m, Z={z:.1f}m, Speed={data['speedKmH']:.1f} km/h, State={data['state']}, Reason={data['reason']}")

        await capture_screen("reversion_recovery_verified.png")
        print(f"\n[+] Test 3 Summary:")
        print(f"    Phase 1 Nudged Left around Pushcart: {nudged_left}")
        print(f"    Phase 2 Reverted Right around Auto-Rickshaw: {reverted_right}")
        print(f"    Phase 3 Recovered to Lane Center: {recovered_center}")
        assert nudged_left, "Failed to nudge left around pushcart"
        assert reverted_right, "Failed to revert right around auto-rickshaw"
        assert recovered_center, "Failed to recover to lane center"
        print("[PASS] Test 3: Multi-obstacle S-curve reversion and lane recovery verified successfully!")

    chrome_proc.kill()
    print("\n" + "=" * 65)
    print("ALL 3 SCENARIOS TESTED & VERIFIED WITH ZERO ERRORS!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_tests())
