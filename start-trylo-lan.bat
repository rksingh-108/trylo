@echo off
setlocal enabledelayedexpansion

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

echo ============================================
echo   TRYLO - Starting PRIVATE LAN TEST environment
echo   (Customer :3000, Driver :3001, API :4000 - all HTTPS)
echo   Project root: %PROJECT_ROOT%
echo ============================================
echo.
echo This starts a self-signed-HTTPS environment for a private, two-phone
echo LAN test only. It is NOT a production deployment and is NOT reachable
echo from outside your current Wi-Fi/hotspot network.
echo.

cd /d "%PROJECT_ROOT%"
if errorlevel 1 (
    echo ERROR: Could not switch to project root "%PROJECT_ROOT%".
    pause
    exit /b 1
)

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
    echo ERROR: "powershell" was not found on PATH. It is required for LAN IP
    echo detection, certificate generation, and Docker-readiness checks.
    pause
    exit /b 1
)
where openssl >nul 2>&1
if errorlevel 1 (
    echo ERROR: "openssl" was not found on PATH. It ships with Git for Windows
    echo ^(C:\Program Files\Git\mingw64\bin^) - install Git for Windows, or any
    echo OpenSSL build, and try again.
    pause
    exit /b 1
)

:: ---------------------------------------------------------------
:: 1. Docker Desktop / Docker Engine
:: ---------------------------------------------------------------
echo [1/6] Checking Docker Engine...
call :docker_check_fast
if "!DOCKER_UP!"=="1" (
    echo       Docker Engine is already running.
    goto docker_ready
)

echo       Docker Engine is not ready. Starting Docker Desktop...
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
    echo Please start Docker Desktop as Administrator and run this script again.
    pause
    exit /b 1
)

:docker_ready
echo       Docker Engine is ready.
echo.

:: ---------------------------------------------------------------
:: 2. PostgreSQL container (trylo-postgres, from docker-compose.yml)
:: ---------------------------------------------------------------
echo [2/6] Starting PostgreSQL container...
docker ps --filter "name=trylo-postgres" --filter "status=running" --format "{{.Names}}" 2>nul | findstr /i "trylo-postgres" >nul
if not errorlevel 1 (
    echo       PostgreSQL container is already running.
) else (
    call pnpm db:up
    if errorlevel 1 (
        echo ERROR: "pnpm db:up" failed to start the PostgreSQL container.
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
:: 3. Detect LAN IP + generate a fresh self-signed cert covering it
:: ---------------------------------------------------------------
echo [3/6] Detecting LAN IP and generating a local HTTPS certificate...
set "LAN_IP="
set "CERT_PATH="
set "KEY_PATH="
for /f "usebackq tokens=1,* delims==" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\generate-lan-cert.ps1" 2^>nul`) do (
    if "%%a"=="LAN_IP" set "LAN_IP=%%b"
    if "%%a"=="CERT_PATH" set "CERT_PATH=%%b"
    if "%%a"=="KEY_PATH" set "KEY_PATH=%%b"
)
if not defined LAN_IP (
    echo ERROR: Could not detect a LAN-facing IP address ^(no adapter with a
    echo default gateway^). Connect this PC to Wi-Fi/Ethernet and try again.
    pause
    exit /b 1
)
if not defined CERT_PATH (
    echo ERROR: Certificate generation failed. See output above for the openssl error.
    pause
    exit /b 1
)
echo       LAN IP:  %LAN_IP%
echo       Cert:    %CERT_PATH%
echo.

:: Set these in THIS script's own environment rather than re-embedding them
:: (via %VAR% text substitution) inside a nested `cmd /k "..."` nested-quote
:: string below - CORS_ORIGINS in particular contains commas/colons/slashes,
:: and chaining several `set "..."` commands inside one already-quoted `start
:: "Title" cmd /k "..."` argument is exactly the kind of nested-quoting
:: cmd.exe silently mishandles (this bit us once already earlier in this
:: project's own `::`-inside-parens bug - see the CAUTION comment in
:: schema.prisma). Every `start`-launched child cmd.exe below automatically
:: INHERITS this process's environment, so setting these here is sufficient -
:: the nested `cmd /k "..."` strings only need the one simple %PROJECT_ROOT%
:: substitution they already had.
set "HTTPS_CERT_PATH=%CERT_PATH%"
set "HTTPS_KEY_PATH=%KEY_PATH%"
set "CORS_ORIGINS=https://%LAN_IP%:3000,https://%LAN_IP%:3001,https://localhost:3000,https://localhost:3001,http://localhost:3000,http://localhost:3001"
set "NEXT_PUBLIC_API_URL=https://%LAN_IP%:4000"

:: ---------------------------------------------------------------
:: 4. API server (HTTPS, port 4000)
:: ---------------------------------------------------------------
echo [4/6] Starting API server ^(HTTPS^)...
call :check_port 4000
if "!PORT_STATUS!"=="TRYLO" (
    echo       API server already running on port 4000 - skipping.
    echo       ^(If it was started WITHOUT HTTPS, run stop-trylo.bat first, then
    echo       re-run this script so it restarts in HTTPS mode.^)
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 4000 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second API server on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    :: "pnpm dev:api" runs through "turbo run dev --filter=api", and Turborepo
    :: 2.x defaults to strict env mode: it silently strips shell-set env vars
    :: not declared in turbo.json before the task runs, so HTTPS_CERT_PATH/
    :: HTTPS_KEY_PATH/CORS_ORIGINS never reached the API process and it fell
    :: back to plain HTTP. Calling "pnpm --filter api dev" directly bypasses
    :: turbo for this one launch and gets full env passthrough.
    start "TRYLO API (HTTPS) - port 4000" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm --filter api dev"
    echo       API server launching in a new window...
)
echo.

:: ---------------------------------------------------------------
:: 5. Customer app (HTTPS, port 3000)
:: ---------------------------------------------------------------
echo [5/6] Starting Customer app ^(HTTPS^)...
call :check_port 3000
if "!PORT_STATUS!"=="TRYLO" (
    echo       Customer app already running on port 3000 - skipping.
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 3000 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second Customer app on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    start "TRYLO Customer (HTTPS) - port 3000" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm --filter customer dev:https"
    echo       Customer app launching in a new window...
)
echo.

:: ---------------------------------------------------------------
:: 6. Driver app (HTTPS, port 3001)
:: ---------------------------------------------------------------
echo [6/6] Starting Driver app ^(HTTPS^)...
call :check_port 3001
if "!PORT_STATUS!"=="TRYLO" (
    echo       Driver app already running on port 3001 - skipping.
) else if "!PORT_STATUS!"=="OTHER" (
    echo       WARNING: Port 3001 is in use by a process that does not look like
    echo       TRYLO ^(PID !PORT_PID!^). Not starting a second Driver app on this
    echo       port - stop whatever is using it, or run stop-trylo.bat first.
) else (
    start "TRYLO Driver (HTTPS) - port 3001" cmd /k "cd /d "%PROJECT_ROOT%" && pnpm --filter driver dev:https"
    echo       Driver app launching in a new window...
)
echo.

echo Waiting for services to become healthy...
call :wait_for_https "https://localhost:4000/health" "API server"
call :wait_for_https "https://localhost:3000" "Customer app"
call :wait_for_https "https://localhost:3001" "Driver app"
echo.

echo ============================================
echo   TRYLO private LAN test environment is up
echo ============================================
echo   On THIS PC (self-signed cert already trusted by curl -k above):
echo     Customer:  https://localhost:3000
echo     Driver:    https://localhost:3001
echo     API:       https://localhost:4000/health
echo.
echo   On the CUSTOMER phone (same Wi-Fi/hotspot as this PC):
echo     https://%LAN_IP%:3000
echo.
echo   On the DRIVER phone (same Wi-Fi/hotspot as this PC):
echo     https://%LAN_IP%:3001
echo.
echo   Both phones will show a "connection not private" / certificate warning
echo   on first visit - this is expected for a self-signed cert. Tap
echo   Advanced -^> Proceed ^(wording varies by browser^) to continue. This is
echo   required once per app per phone per test session.
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
set "DOCKER_UP=0"
set "DOCKER_PS_RESULT="
for /f "usebackq delims=" %%r in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\docker-check-fast.ps1" 2^>nul`) do set "DOCKER_PS_RESULT=%%r"
if /i "!DOCKER_PS_RESULT!"=="UP" set "DOCKER_UP=1"
goto :eof

:check_port
setlocal
set "PORT=%~1"
set "RESULT="
for /f "usebackq delims=" %%r in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_ROOT%\scripts\check-port.ps1" -Port %PORT% -ProjectRoot "%PROJECT_ROOT%" 2^>nul`) do set "RESULT=%%r"
if not defined RESULT set "RESULT=FREE|"
for /f "tokens=1,2 delims=|" %%a in ("!RESULT!") do (
    endlocal & set "PORT_STATUS=%%a" & set "PORT_PID=%%b"
)
exit /b 0

:wait_for_https
:: Same polling idea as start-trylo.bat's :wait_for_http, but with curl -k
:: since these are self-signed certs curl has no reason to trust.
setlocal enabledelayedexpansion
set "URL=%~1"
set "NAME=%~2"
set "HTTP_CODE="
for /l %%i in (1,1,30) do (
    for /f %%c in ('curl -sk -o nul -w "%%{http_code}" "%URL%" 2^>nul') do set "HTTP_CODE=%%c"
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
