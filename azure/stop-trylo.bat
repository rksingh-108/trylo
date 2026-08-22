@echo off
title TRYLO Azure - Stop
echo ========================================
echo  TRYLO AZURE TEST ENVIRONMENT
echo  STOP = turn the Azure testing environment OFF
echo  STOPPING...
echo ========================================
echo.
echo This stops PostgreSQL (trylo-db) and waits until it is Stopped.
echo Container Apps / Static Web Apps are left untouched - see
echo scripts\azure-test-env.ps1 for the actual logic.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\azure-test-env.ps1" off

echo.
if errorlevel 1 (
    echo ========================================
    echo  TRYLO AZURE ENVIRONMENT STOP FAILED
    echo  See the output above for details.
    echo ========================================
) else (
    echo ========================================
    echo  TRYLO AZURE ENVIRONMENT STOP COMPLETE
    echo ========================================
)
echo.
pause
