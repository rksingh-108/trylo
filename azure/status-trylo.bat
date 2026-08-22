@echo off
title TRYLO Azure - Status
echo ========================================
echo  TRYLO AZURE TEST ENVIRONMENT
echo  STATUS = check the current state (read-only)
echo  CHECKING STATUS...
echo ========================================
echo.
echo This is read-only and never changes anything - see
echo scripts\azure-test-env.ps1 for the actual logic.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\azure-test-env.ps1" status

echo.
if errorlevel 1 (
    echo ========================================
    echo  TRYLO AZURE STATUS CHECK FAILED
    echo  See the output above for details.
    echo ========================================
) else (
    echo ========================================
    echo  STATUS CHECK COMPLETE
    echo ========================================
)
echo.
pause
