@echo off
title VLC Neo Cinema Player Server
cd /d "%~dp0"
echo ===================================================
echo Starting VLC Neo Cinema Player Local Server...
echo ===================================================
start http://localhost:3000
node server.js
pause
