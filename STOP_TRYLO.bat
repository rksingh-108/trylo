@echo off
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo ============================================
echo   TRYLO - Stopping all services
echo   Project root: %PROJECT_ROOT%
echo ============================================
echo.

cd /d "%PROJECT_ROOT%"

echo [1/5] Stopping Customer app (port 3000)...
call :kill_port 3000

echo [2/6] Stopping Driver app (port 3001)...
call :kill_port 3001

echo [3/6] Stopping Admin app (port 3002)...
call :kill_port 3002

echo [4/6] Stopping API server (port 4000)...
call :kill_port 4000
echo.

echo [5/6] Stopping PostgreSQL container...
where docker >nul 2>&1
if errorlevel 1 (
    set "DOCKER_BIN_DIR="
    if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "DOCKER_BIN_DIR=%ProgramFiles%\Docker\Docker\resources\bin"
    if not defined DOCKER_BIN_DIR if exist "%LocalAppData%\Programs\DockerDesktop\resources\bin\docker.exe" set "DOCKER_BIN_DIR=%LocalAppData%\Programs\DockerDesktop\resources\bin"
    if defined DOCKER_BIN_DIR set "PATH=!DOCKER_BIN_DIR!;%PATH%"
)
where docker >nul 2>&1
if errorlevel 1 (
    echo       "docker" not found on PATH - skipping.
) else (
    docker info >nul 2>&1
    if errorlevel 1 (
        echo       Docker Engine is not running - nothing to stop.
    ) else (
        docker ps --filter "name=trylo-postgres" --format "{{.Names}}" 2>nul | findstr /i "trylo-postgres" >nul
        if not errorlevel 1 (
            docker stop trylo-postgres >nul 2>&1
            if errorlevel 1 (
                echo       WARNING: Failed to stop the trylo-postgres container.
            ) else (
                echo       PostgreSQL container stopped. Data volume was NOT removed.
            )
        ) else (
            echo       PostgreSQL container is not running - nothing to stop.
        )
    )
)
echo.

echo [6/6] Checking for any remaining TRYLO Node.js processes...
where powershell >nul 2>&1
if errorlevel 1 (
    echo       PowerShell not found - skipping leftover-process sweep.
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\kill-project-node.ps1" -ProjectRoot "%PROJECT_ROOT%"
)
echo.

echo ============================================
echo   TRYLO has been stopped safely.
echo   - Customer / Driver / API dev servers: stopped
echo   - PostgreSQL container: stopped (data preserved)
echo   - No files, data, or Docker volumes were deleted
echo   Restart everything anytime with START_TRYLO.bat
echo ============================================
pause
exit /b 0

:: ---------------------------------------------------------------
:: Helpers
:: ---------------------------------------------------------------

:kill_port
setlocal enabledelayedexpansion
set "PORT=%~1"
set "FOUND=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    set "FOUND=1"
    echo       Stopping process on port %PORT%, PID %%p ...
    taskkill /PID %%p /F >nul 2>&1
)
if "!FOUND!"=="0" echo       No process found on port %PORT%.
endlocal
exit /b 0
