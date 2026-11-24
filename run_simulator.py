"""
One-Click Launcher & Telemetry Server for SIH-26037
Runs the FastAPI + WebSocket Simulation Orchestrator (or falls back to ThreadingHTTPServer)
Serves the 3D Simulator, Datasets, and Documentation, and opens your default browser.
"""

import os
import sys
import time
import socket
import threading
import webbrowser

# Ensure compatibility with pythonw.exe (where stdout/stderr are None)
if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w')

HOST = "127.0.0.1"
PREFERRED_PORTS = [8000, 8081, 8085, 3000, 8080]
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def is_port_available(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False

def find_available_port(host, preferred_ports):
    for p in preferred_ports:
        if is_port_available(host, p):
            return p
    for p in range(8083, 8150):
        if is_port_available(host, p):
            return p
    return 8000

def run_uvicorn(port):
    import uvicorn
    from server.bridge_server import app
    config = uvicorn.Config(
        app,
        host=HOST,
        port=port,
        log_level="warning",
        access_log=False
    )
    server = uvicorn.Server(config)
    server.run()

def run_fallback_http(port):
    import http.server
    class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=DIRECTORY, **kwargs)
        def end_headers(self):
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()
        def log_message(self, format, *args):
            pass
            
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer((HOST, port), NoCacheHandler)
    httpd.serve_forever()

if __name__ == "__main__":
    print("=" * 70, flush=True)
    print("  SIH-26037: 3D AUTONOMOUS DRIVING SIMULATOR & TELEMETRY BRIDGE  ", flush=True)
    print("  Adaptive Path Planning & Collision Avoidance on Indian Roads", flush=True)
    print("=" * 70, flush=True)
    
    port = find_available_port(HOST, PREFERRED_PORTS)
    server_mode = "FastAPI + WebSockets"
    
    try:
        server_thread = threading.Thread(target=run_uvicorn, args=(port,), daemon=True)
        server_thread.start()
        time.sleep(0.5)
        if not server_thread.is_alive():
            raise RuntimeError("Uvicorn thread failed to start, falling back to HTTP server")
    except Exception as e:
        print(f"[*] Note: Running standard HTTP mode ({e})", flush=True)
        server_mode = "Standard HTTP"
        server_thread = threading.Thread(target=run_fallback_http, args=(port,), daemon=True)
        server_thread.start()
        
    print(f"[*] Server running in [{server_mode}] mode at http://{HOST}:{port}", flush=True)
    print(f"[*] API Documentation: http://{HOST}:{port}/docs", flush=True)
    print(f"[*] Datasets Directory: http://{HOST}:{port}/datasets/DATASET_MANIFEST.md", flush=True)
    
    url = f"http://{HOST}:{port}/simulator/index.html?v={int(time.time())}"
    print(f"[>] Opening 3D Simulator in Browser: {url}", flush=True)
    webbrowser.open(url)
    
    file_path = os.path.join(DIRECTORY, "simulator", "index.html").replace("\\", "/")
    print(f"[+] Direct file access: file:///{file_path}", flush=True)
    print("\n[+] Press Ctrl+C in this terminal to stop the server.", flush=True)
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Server stopped safely.", flush=True)
