@echo off
title SIH-26037 3D Autonomous Vehicle Simulator
echo ================================================================
echo   SIH-26037: 3D REAL-TIME AUTONOMOUS DRIVING SIMULATOR & CV HUD
echo ================================================================
echo Starting local web server and opening 3D Simulator...
cd /d "%~dp0"
start "" python run_simulator.py
exit
