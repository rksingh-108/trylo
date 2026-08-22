@echo off
title TRYLO Azure - Start
echo ========================================
echo  TRYLO AZURE TEST ENVIRONMENT
echo  START = turn the Azure testing environment ON
echo  STARTING...
echo ========================================
echo.
echo This starts PostgreSQL (trylo-db) if it is stopped and waits until
echo it is Ready. Container Apps / Static Web Apps are left untouched -
echo see scripts\azure-test-env.ps1 for the actual logic.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\azure-test-env.ps1" on

echo.
if errorlevel 1 (
    echo ========================================
    echo  TRYLO AZURE ENVIRONMENT START FAILED
    echo  See the output above for details.
    echo ========================================
) else (
    echo ========================================
    echo  TRYLO AZURE ENVIRONMENT START COMPLETE
    echo ========================================
)
echo.
pause
