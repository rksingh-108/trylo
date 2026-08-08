@echo off
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo ============================================
echo   TRYLO - Starting all services
echo   Project root: %PROJECT_ROOT%
echo ============================================
echo.

cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
    echo ERROR: Could not switch to project root "%PROJECT_ROOT%".
    pause
    exit /b 1
)

:: Docker Desktop's install location can change across updates (it has been
:: seen at both the legacy per-machine path and a newer per-user path), and
:: the system PATH does not always get updated when that happens. Rather than
:: trusting PATH alone, fall back to checking known install locations and add
:: whichever one is found to THIS script's own process PATH.
where docker >nul 2>&1
if errorlevel 1 (
    set "DOCKER_BIN_DIR="
    if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" set "DOCKER_BIN_DIR=%ProgramFiles%\Docker\Docker\resources\bin"
    if not defined DOCKER_BIN_DIR if exist "%LocalAppData%\Programs\DockerDesktop\resources\bin\docker.exe" set "DOCKER_BIN_DIR=%LocalAppData%\Programs\DockerDesktop\resources\bin"

    if defined DOCKER_BIN_DIR (
        echo       "docker" not on PATH - found it at "!DOCKER_BIN_DIR!", using that directly.
        set "PATH=!DOCKER_BIN_DIR!;%PATH%"
    ) else (
        echo ERROR: "docker" was not found on PATH, and no Docker Desktop install
        echo was found at the usual locations. Install Docker Desktop and try again.
        pause
        exit /b 1
    )
)
where pnpm >nul 2>&1
if errorlevel 1 (
    echo ERROR: "pnpm" was not found on PATH. Install pnpm and try again.
    pause
    exit /b 1
)
where powershell >nul 2>&1
if errorlevel 1 (
    echo ERROR: "powershell" was not found on PATH. It is required for reliable
    echo Docker-readiness checks and duplicate-process detection.
    pause
    exit /b 1
)

:: ---------------------------------------------------------------
:: 1. Docker Desktop / Docker Engine
:: ---------------------------------------------------------------
echo [1/7] Checking Docker Engine...

:: NOTE: a bare "docker info" can hang for a long time (60s+) when the
:: daemon is completely unreachable, instead of failing fast. :docker_check_fast
:: below bounds that check to 8 seconds via PowerShell's job timeout, so
:: this script's waits stay predictable regardless of Docker Desktop's
:: internal architecture (which Windows services it does or doesn't use has
:: been observed to change across Docker Desktop versions/updates).
call :docker_check_fast
if "!DOCKER_UP!"=="1" (
    echo       Docker Engine is already running.
    goto docker_ready
)

echo       Docker Engine is not ready. Starting Docker Desktop...
:: Docker Desktop's own install location has also been observed to change
:: across updates (legacy per-machine path vs. a newer per-user path), so
:: check both rather than assuming one.
set "DOCKER_DESKTOP_EXE="
if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not defined DOCKER_DESKTOP_EXE if exist "%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe" set "DOCKER_DESKTOP_EXE=%LocalAppData%\Programs\DockerDesktop\Docker Desktop.exe"
if not defined DOCKER_DESKTOP_EXE (
    echo ERROR: Docker Desktop.exe was not found at any known install location.
    echo Please start Docker Desktop manually, then re-run this script.
    pause
    exit /b 1
)

tasklist /fi "imagename eq Docker Desktop.exe" 2>nul | findstr /i "Docker Desktop.exe" >nul
if errorlevel 1 (
    start "" "%DOCKER_DESKTOP_EXE%"
) else (
    echo       Docker Desktop process is already running, waiting for its engine...
)

echo       Waiting up to 60 seconds for the Docker Engine to come up...
set "DOCKER_READY=0"
for /l %%i in (1,1,12) do (
    call :docker_check_fast
    if "!DOCKER_UP!"=="1" (
        set "DOCKER_READY=1"
        goto docker_wait_done
    )
    ping -n 6 127.0.0.1 >nul
)
:docker_wait_done

if "!DOCKER_READY!"=="0" (
    echo.
    echo ERROR: Docker Engine is still not available after waiting.
    echo This usually means Docker Desktop needs to be started with
    echo Administrator privileges - this script cannot elevate itself.
    echo.
    echo Please start Docker Desktop as Administrator and run start-trylo.bat again.
    pause
    exit /b 1
)

:docker_ready
echo       Docker Engine is ready.
echo.

:: ---------------------------------------------------------------
:: 2. PostgreSQL container (trylo-postgres, from docker-compose.yml)
:: ---------------------------------------------------------------
echo [2/7] Starting PostgreSQL container...
docker ps --filter "name=trylo-postgres" --filter "status=running" --format "{{.Names}}" 2>nul | findstr /i "trylo-postgres" >nul
if not errorlevel 1 (
    echo       PostgreSQL container is already running.
) else (
    REM "docker compose up -d" starts the container if it exists but is stopped,
    REM or creates it fresh from docker-compose.yml if it doesn't exist at all -
    REM either way this is the correct, idempotent way to bring it up.
    call pnpm db:up
    if errorlevel 1 (
        echo ERROR: "pnpm db:up" failed to start the PostgreSQL container.
        echo Check "docker compose ps" and "docker compose logs postgres" for details.
        pause
        exit /b 1
    )

    echo       Waiting for PostgreSQL to accept connections...
    set "PG_READY=0"
    for /l %%i in (1,1,30) do (
        docker exec trylo-postgres pg_isready -U trylo >nul 2>&1
        if not errorlevel 1 (
            set "PG_READY=1"
            goto pg_ready
        )
        ping -n 3 127.0.0.1 >nul
    )
    :pg_ready
    if "!PG_READY!"=="0" (
        echo       WARNING: PostgreSQL did not confirm readiness in time; continuing anyway.
    ) else (
        echo       PostgreSQL is ready.
    )
)
echo.

:: ---------------------------------------------------------------
:: 3. API server (port 4000) - pnpm dev:api (apps/api: tsx watch src/index.ts)
:: ---------------------------------------------------------------
echo [3/7] Starting API server...
call :check_port 4000
if "!PORT_STATUS!"=="TRYLO" (
    echo       API server already running on port 4000 - skipping.
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 4000 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second API server on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    start "TRYLO API - port 4000" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm dev:api"
    echo       API server launching in a new window...
)
echo.

:: ---------------------------------------------------------------
:: 4. Customer app (port 3000) - pnpm dev:customer (next dev --port 3000)
:: ---------------------------------------------------------------
echo [4/7] Starting Customer app...
call :check_port 3000
if "!PORT_STATUS!"=="TRYLO" (
    echo       Customer app already running on port 3000 - skipping.
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 3000 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second Customer app on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    start "TRYLO Customer - port 3000" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm dev:customer"
    echo       Customer app launching in a new window...
)
echo.

:: ---------------------------------------------------------------
:: 5. Driver app (port 3001) - pnpm dev:driver (next dev --port 3001)
:: ---------------------------------------------------------------
echo [5/7] Starting Driver app...
call :check_port 3001
if "!PORT_STATUS!"=="TRYLO" (
    echo       Driver app already running on port 3001 - skipping.
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 3001 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second Driver app on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    start "TRYLO Driver - port 3001" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm dev:driver"
    echo       Driver app launching in a new window...
)
echo.

:: ---------------------------------------------------------------
:: 6. Admin app (port 3002) - pnpm dev:admin (next dev --port 3002)
:: ---------------------------------------------------------------
echo [6/7] Starting Admin app...
call :check_port 3002
if "!PORT_STATUS!"=="TRYLO" (
    echo       Admin app already running on port 3002 - skipping.
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 3002 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second Admin app on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    start "TRYLO Admin - port 3002" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm dev:admin"
    echo       Admin app launching in a new window...
)
echo.

:: ---------------------------------------------------------------
:: 7. Wait for health, then open browsers
:: ---------------------------------------------------------------
echo [7/7] Waiting for services to become healthy...
call :wait_for_http "http://localhost:4000/health" "API server"
call :wait_for_http "http://localhost:3000" "Customer app"
call :wait_for_http "http://localhost:3001" "Driver app"
call :wait_for_http "http://localhost:3002" "Admin app"
echo.

echo Opening browser windows...
start "" "http://localhost:3000"
ping -n 2 127.0.0.1 >nul
start "" "http://localhost:3001"
ping -n 2 127.0.0.1 >nul
start "" "http://localhost:3002"
echo.

echo ============================================
echo   TRYLO is up and running!
echo ============================================
echo   Customer app:   http://localhost:3000
echo   Driver app:     http://localhost:3001
echo   Admin app:      http://localhost:3002
echo   API server:     http://localhost:4000
echo   API health:     http://localhost:4000/health
echo   PostgreSQL:     localhost:55448  (container: trylo-postgres)
echo ============================================
echo.
echo Each service is running in its own terminal window.
echo Close those windows, or run stop-trylo.bat, to stop everything.
echo.
pause
exit /b 0

:: ---------------------------------------------------------------
:: Helpers
:: ---------------------------------------------------------------

:docker_check_fast
:: Sets DOCKER_UP=1 if "docker info" succeeds within ~8 seconds, else 0.
:: Bounded via a PowerShell background job + Wait-Job -Timeout, which is a
:: reliable way to bound an external command's runtime from a Windows batch
:: script - a bare "docker info" does not reliably fail fast on its own when
:: the daemon is unreachable (it can hang 60s+).
set "DOCKER_UP=0"
set "DOCKER_PS_RESULT="
for /f "usebackq delims=" %%r in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\docker-check-fast.ps1" 2^>nul`) do set "DOCKER_PS_RESULT=%%r"
if /i "!DOCKER_PS_RESULT!"=="UP" set "DOCKER_UP=1"
goto :eof

:check_port
:: Sets PORT_STATUS to FREE / TRYLO / OTHER for the given port, and PORT_PID
:: to the owning process id (blank if free). "TRYLO" means the owning
:: process's command line references this project's own root folder (the
:: same technique scripts\kill-project-node.ps1 already uses for cleanup) -
:: this is what lets the script tell "our own dev server is already up,
:: skip it" apart from "some unrelated process happens to be squatting this
:: port, don't touch it and don't pretend we're running".
setlocal
set "PORT=%~1"
set "RESULT="
for /f "usebackq delims=" %%r in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\check-port.ps1" -Port %PORT% -ProjectRoot "%PROJECT_ROOT%" 2^>nul`) do set "RESULT=%%r"
if not defined RESULT set "RESULT=FREE|"
for /f "tokens=1,2 delims=|" %%a in ("!RESULT!") do (
    endlocal & set "PORT_STATUS=%%a" & set "PORT_PID=%%b"
)
exit /b 0

:wait_for_http
setlocal enabledelayedexpansion
set "URL=%~1"
set "NAME=%~2"
set "HTTP_CODE="
for /l %%i in (1,1,30) do (
    for /f %%c in ('curl -s -o nul -w "%%{http_code}" "%URL%" 2^>nul') do set "HTTP_CODE=%%c"
    if defined HTTP_CODE if not "!HTTP_CODE!"=="000" (
        echo       %NAME% is responding ^(HTTP !HTTP_CODE!^) at %URL%
        endlocal
        exit /b 0
    )
    ping -n 3 127.0.0.1 >nul
)
echo       WARNING: %NAME% did not respond at %URL% in time. Check its terminal window for errors.
endlocal
exit /b 1
