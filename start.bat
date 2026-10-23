@echo off
title Apoteku - Starting Local Stack
echo ========================================================
echo   Apoteku - Pendamping Kepatuhan Obat & Apoteker
echo ========================================================
echo.

echo [1/3] Starting PostgreSQL (port 5435)...
docker compose up -d postgres

echo.
echo [2/3] Starting Backend API Server (port 4000)...
start "Apoteku Backend" cmd /k "cd /d %~dp0server && npm run dev"

echo.
echo [3/3] Starting Web Application (port 5175)...
start "Apoteku Web" cmd /k "cd /d %~dp0web && npm run dev"

echo.
echo ========================================================
echo   All services launched!
echo   Open in browser: http://localhost:5175
echo.
echo   Demo Accounts:
echo     - Pasien:     pasien@rara.local   / pasien123
echo     - Apoteker:   apoteker@rara.local / apoteker123
echo     - Admin:      admin@rara.local    / admin123
echo ========================================================
pause
