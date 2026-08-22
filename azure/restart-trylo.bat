@echo off
title TRYLO Azure - Restart
echo ========================================
echo  TRYLO AZURE TEST ENVIRONMENT
echo  RESTART = restart PostgreSQL
echo  RESTARTING...
echo ========================================
echo.
echo This restarts PostgreSQL (trylo-db) and waits until it is Ready
echo again. Container Apps / Static Web Apps are left untouched - see
echo scripts\azure-test-env.ps1 for the actual logic.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\azure-test-env.ps1" restart

echo.
if errorlevel 1 (
    echo ========================================
    echo  TRYLO AZURE ENVIRONMENT RESTART FAILED
    echo  See the output above for details.
    echo ========================================
) else (
    echo ========================================
    echo  TRYLO AZURE ENVIRONMENT RESTART COMPLETE
    echo ========================================
)
echo.
pause
