@echo off
title DoseLynx - Starting Local Stack
echo ========================================================
echo   DoseLynx - Pendamping Kepatuhan Obat ^& Apoteker
echo ========================================================
echo.

echo [1/4] Starting PostgreSQL (port 5435)...
docker compose up -d postgres

echo.
echo [2/4] Applying database migrations and demo data...
pushd "%~dp0server"
call npx prisma migrate deploy
if errorlevel 1 goto :db_error
call npm run db:seed
if errorlevel 1 goto :db_error
popd

echo.
echo [3/4] Starting Backend API Server (port 4000)...
start "DoseLynx Backend" cmd /k "cd /d %~dp0server && npm run dev"

echo.
echo [4/4] Starting Web Application (port 5175)...
start "DoseLynx Web" cmd /k "cd /d %~dp0web && npm run dev"

echo.
echo ========================================================
echo   All services launched!
echo   Open in browser: http://localhost:5175
echo.
echo   Demo Accounts:
echo     - Pasien:     pasien@doselynx.com   / pasien123
echo     - Apoteker:   apoteker@doselynx.com / apoteker123
echo     - Admin:      admin@doselynx.com    / admin123
echo ========================================================
pause
exit /b 0

:db_error
echo.
echo Database setup failed. Make sure Docker Desktop is running.
pause
exit /b 1
