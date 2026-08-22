<#
.SYNOPSIS
    Safe ON/OFF control for the TRYLO Azure TEST environment (trylo-test-rg).

.DESCRIPTION
    This script does NOT create, delete, or recreate any Azure resource, and
    never touches application code, secrets, networking, SKUs, or regions.
    It only starts/stops the one resource in the test environment that
    actually incurs meaningful compute cost while running: the PostgreSQL
    Flexible Server (trylo-db).

    Azure Container Apps (trylo-api) is left alone on purpose: it already
    runs with minReplicas=0/maxReplicas=1, so it scales to zero automatically
    when idle and back up on the next request. There is nothing useful for
    this script to "turn off" there, and this script never modifies that
    scale configuration.

    The 3 Static Web Apps (trylo-customer/trylo-driver/trylo-admin) are Free
    tier and cost nothing regardless of traffic, so this script never touches
    them beyond reading their status.

.USAGE
    .\scripts\azure-test-env.ps1 status    Read-only. Shows current state of everything.
    .\scripts\azure-test-env.ps1 on        Starts PostgreSQL if stopped, waits until Ready.
    .\scripts\azure-test-env.ps1 off       Stops PostgreSQL, waits until Stopped.
    .\scripts\azure-test-env.ps1 restart   Restarts PostgreSQL, waits until Ready.

.NOTES
    Idempotent: running `on` when already on, or `off` when already off, is
    a no-op that just reports the current state. Never runs `az group delete`
    or any resource-deletion/creation command.
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('status', 'on', 'off', 'restart', 'help')]
    [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Fixed identifiers for the existing TRYLO test environment.
# This script never creates these resources - it only ever reads or
# starts/stops the ones that already exist under these exact names.
# ---------------------------------------------------------------------------
$ResourceGroup            = 'trylo-test-rg'
$PostgresName              = 'trylo-db'
$ContainerAppName          = 'trylo-api'
$ContainerAppEnvName       = 'trylo-env'
$StaticWebApps             = @('trylo-customer', 'trylo-driver', 'trylo-admin')
$ExpectedSubscriptionId    = '51829fe8-4062-41be-bce8-0ac87525755b'
$ExpectedSubscriptionName  = 'Azure for Students'

# How long to wait for PostgreSQL to reach the target state before giving up.
$StartTimeoutSeconds   = 600   # 10 minutes
$StopTimeoutSeconds    = 300   # 5 minutes
$PollIntervalSeconds   = 15

# Best-effort API health check after `on` (never fails the whole command).
$ApiHealthUrl          = 'https://trylo-api.kindpond-9e954784.eastasia.azurecontainerapps.io/health'
$ApiHealthTimeoutSeconds = 45   # Container App may need to cold-start from 0 replicas.

function Write-Section($text) {
    Write-Host ''
    Write-Host $text -ForegroundColor Cyan
}

function Write-Ok($text)   { Write-Host $text -ForegroundColor Green }
function Write-Warn($text) { Write-Host $text -ForegroundColor Yellow }
function Write-Err($text)  { Write-Host $text -ForegroundColor Red }

# ---------------------------------------------------------------------------
# Azure CLI helpers - all read-only unless explicitly noted.
# ---------------------------------------------------------------------------

function Get-AzLoginContext {
    $raw = az account show -o json 2>$null
    if (-not $raw) {
        throw "Not logged in to Azure CLI (or no active subscription). Run 'az login' first."
    }
    return $raw | ConvertFrom-Json
}

function Assert-CorrectSubscription {
    $ctx = Get-AzLoginContext
    if ($ctx.id -ne $ExpectedSubscriptionId) {
        Write-Err "Active Azure CLI subscription does not match the expected test subscription."
        Write-Err "  Active:   $($ctx.name)  ($($ctx.id))"
        Write-Err "  Expected: $ExpectedSubscriptionName  ($ExpectedSubscriptionId)"
        Write-Host "Run: az account set --subscription $ExpectedSubscriptionId" -ForegroundColor Yellow
        throw "Wrong Azure subscription active - refusing to proceed for safety."
    }
    return $ctx
}

function Get-PostgresInfo {
    $raw = az postgres flexible-server show -g $ResourceGroup -n $PostgresName -o json 2>$null
    if (-not $raw) {
        throw "Could not read PostgreSQL Flexible Server '$PostgresName' in resource group '$ResourceGroup'. It may not exist, or the CLI may not be logged in to the right subscription."
    }
    return $raw | ConvertFrom-Json
}

function Get-ContainerAppInfo {
    $raw = az containerapp show -g $ResourceGroup -n $ContainerAppName -o json 2>$null
    if (-not $raw) {
        throw "Could not read Container App '$ContainerAppName' in resource group '$ResourceGroup'."
    }
    return $raw | ConvertFrom-Json
}

function Get-ActiveReplicaCount {
    $raw = az containerapp replica list -g $ResourceGroup -n $ContainerAppName -o json 2>$null
    if (-not $raw -or $raw.Trim() -eq '[]' -or $raw.Trim() -eq '') {
        return 0
    }
    $arr = $raw | ConvertFrom-Json
    return @($arr).Count
}

function Get-StaticWebAppInfo($name) {
    $raw = az staticwebapp show -g $ResourceGroup -n $name -o json 2>$null
    if (-not $raw) { return $null }
    return $raw | ConvertFrom-Json
}

# Maps the raw Postgres `state` value to a short human label used in the report.
function Format-PostgresState($state) {
    switch ($state) {
        'Ready'   { return 'Running' }
        'Stopped' { return 'Stopped' }
        default   { return $state }   # Starting, Stopping, Updating, Disabled, etc.
    }
}

# ---------------------------------------------------------------------------
# Status report (used by `status`, and again at the end of `on` / `off`).
# 100% read-only - must never be called from a code path that mutates state
# without that mutation already having happened first.
# ---------------------------------------------------------------------------

function Show-EnvironmentStatus {
    Write-Host ''
    Write-Host 'TRYLO AZURE TEST ENVIRONMENT' -ForegroundColor Cyan
    Write-Host '----------------------------' -ForegroundColor Cyan
    Write-Host "Resource Group: $ResourceGroup"
    Write-Host ''

    $pg = Get-PostgresInfo
    $pgLabel = Format-PostgresState $pg.state
    $pgColor = switch ($pg.state) {
        'Ready'   { 'Green' }
        'Stopped' { 'Yellow' }
        default   { 'DarkYellow' }
    }
    Write-Host "PostgreSQL:              " -NoNewline
    Write-Host "$pgLabel  (region: $($pg.location), sku: $($pg.sku.name))" -ForegroundColor $pgColor

    $ca = Get-ContainerAppInfo
    $activeReplicas = Get-ActiveReplicaCount
    $minReplicas = $ca.properties.template.scale.minReplicas
    $maxReplicas = $ca.properties.template.scale.maxReplicas
    Write-Host "Container App:           " -NoNewline
    Write-Host "$activeReplicas/$maxReplicas active replicas  (runningStatus: $($ca.properties.runningStatus))" -ForegroundColor Green
    Write-Host "Container App min/max:   $minReplicas/$maxReplicas  (scale-to-zero - this is expected/normal, not an error)"

    Write-Host "Static Web Apps:         " -NoNewline
    $swaResults = foreach ($name in $StaticWebApps) {
        $swa = Get-StaticWebAppInfo $name
        if ($swa) { "$name (OK)" } else { "$name (NOT FOUND)" }
    }
    $anySwaMissing = $swaResults -match 'NOT FOUND'
    if ($anySwaMissing) {
        Write-Host ($swaResults -join ', ') -ForegroundColor Red
    } else {
        Write-Host "Available (Free tier x3)" -ForegroundColor Green
    }

    # Overall status is driven by PostgreSQL, since that's the resource that
    # actually costs money while running. Container Apps scaling to zero is
    # normal/expected and doesn't affect this.
    $overall = switch ($pg.state) {
        'Ready'   { 'ON' }
        'Stopped' { 'OFF' }
        default   { "PARTIAL (PostgreSQL is '$($pg.state)')" }
    }
    $overallColor = switch ($pg.state) {
        'Ready'   { 'Green' }
        'Stopped' { 'Yellow' }
        default   { 'DarkYellow' }
    }
    Write-Host ''
    Write-Host "Overall: " -NoNewline
    Write-Host $overall -ForegroundColor $overallColor
    Write-Host ''

    return [pscustomobject]@{
        PostgresState  = $pg.state
        ActiveReplicas = $activeReplicas
        MinReplicas    = $minReplicas
        MaxReplicas    = $maxReplicas
        Overall        = $overall
    }
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

function Invoke-Status {
    Show-EnvironmentStatus | Out-Null
}

function Invoke-On {
    Write-Section 'Starting TRYLO test environment...'

    Write-Host 'Checking Azure CLI login and subscription...'
    $ctx = Assert-CorrectSubscription
    Write-Ok "  Logged in. Subscription: $($ctx.name) ($($ctx.id))"

    $pg = Get-PostgresInfo
    Write-Host "PostgreSQL current state: $($pg.state)"

    if ($pg.state -eq 'Ready') {
        Write-Ok 'PostgreSQL is already running - nothing to do.'
    }
    elseif ($pg.state -eq 'Stopped') {
        Write-Host "Starting PostgreSQL server '$PostgresName'..."
        az postgres flexible-server start -g $ResourceGroup -n $PostgresName -o none
        if ($LASTEXITCODE -ne 0) {
            throw "az postgres flexible-server start failed with exit code $LASTEXITCODE."
        }

        Write-Host "Waiting for PostgreSQL to become Ready (timeout: ${StartTimeoutSeconds}s)..."
        $elapsed = 0
        do {
            Start-Sleep -Seconds $PollIntervalSeconds
            $elapsed += $PollIntervalSeconds
            $pg = Get-PostgresInfo
            Write-Host "  [$elapsed s] state: $($pg.state)"
        } while ($pg.state -ne 'Ready' -and $elapsed -lt $StartTimeoutSeconds)

        if ($pg.state -ne 'Ready') {
            throw "PostgreSQL did not reach 'Ready' within ${StartTimeoutSeconds}s (last state: $($pg.state)). Check the Azure Portal."
        }
        Write-Ok 'PostgreSQL is now Ready.'
    }
    else {
        Write-Warn "PostgreSQL is in transitional state '$($pg.state)' - waiting for it to settle (timeout: ${StartTimeoutSeconds}s)..."
        $elapsed = 0
        do {
            Start-Sleep -Seconds $PollIntervalSeconds
            $elapsed += $PollIntervalSeconds
            $pg = Get-PostgresInfo
            Write-Host "  [$elapsed s] state: $($pg.state)"
        } while ($pg.state -ne 'Ready' -and $pg.state -ne 'Stopped' -and $elapsed -lt $StartTimeoutSeconds)

        if ($pg.state -eq 'Stopped') {
            Write-Host "Server settled into 'Stopped'. Starting it..."
            az postgres flexible-server start -g $ResourceGroup -n $PostgresName -o none
            if ($LASTEXITCODE -ne 0) { throw "az postgres flexible-server start failed with exit code $LASTEXITCODE." }
            do {
                Start-Sleep -Seconds $PollIntervalSeconds
                $elapsed += $PollIntervalSeconds
                $pg = Get-PostgresInfo
                Write-Host "  [$elapsed s] state: $($pg.state)"
            } while ($pg.state -ne 'Ready' -and $elapsed -lt $StartTimeoutSeconds)
        }

        if ($pg.state -ne 'Ready') {
            throw "PostgreSQL did not reach 'Ready' (last state: $($pg.state)). Check the Azure Portal before testing."
        }
        Write-Ok 'PostgreSQL is now Ready.'
    }

    Write-Host ''
    Write-Host 'Container App (trylo-api): left untouched on purpose.'
    Write-Host '  minReplicas=0 / maxReplicas=1 is preserved - it will scale up' -ForegroundColor DarkGray
    Write-Host '  from zero automatically on the first real request.' -ForegroundColor DarkGray

    Write-Host ''
    Write-Host 'Static Web Apps: left untouched (Free tier, always available).' -ForegroundColor DarkGray

    Write-Section 'Checking API health endpoint (best-effort, may cold-start the container)...'
    try {
        $resp = Invoke-WebRequest -Uri $ApiHealthUrl -TimeoutSec $ApiHealthTimeoutSeconds -UseBasicParsing
        if ($resp.StatusCode -eq 200) {
            Write-Ok "  API responded: $($resp.Content)"
        } else {
            Write-Warn "  API responded with HTTP $($resp.StatusCode) - check manually if needed."
        }
    } catch {
        Write-Warn "  Could not reach API health endpoint within ${ApiHealthTimeoutSeconds}s ($($_.Exception.Message))."
        Write-Warn "  This can just mean the container is still cold-starting - it is not necessarily a problem."
    }

    Write-Section 'TRYLO test environment is ready for testing.'
    Show-EnvironmentStatus | Out-Null
}

function Invoke-Off {
    Write-Section 'Stopping TRYLO test environment...'

    Write-Host 'Checking Azure CLI login and subscription...'
    $ctx = Assert-CorrectSubscription
    Write-Ok "  Logged in. Subscription: $($ctx.name) ($($ctx.id))"

    $pg = Get-PostgresInfo
    Write-Host "PostgreSQL current state: $($pg.state)"

    if ($pg.state -eq 'Stopped') {
        Write-Ok 'PostgreSQL is already stopped - nothing to do.'
    }
    else {
        Write-Host "Stopping PostgreSQL server '$PostgresName'..."
        az postgres flexible-server stop -g $ResourceGroup -n $PostgresName -o none
        if ($LASTEXITCODE -ne 0) {
            throw "az postgres flexible-server stop failed with exit code $LASTEXITCODE."
        }

        Write-Host "Waiting for PostgreSQL to reach Stopped (timeout: ${StopTimeoutSeconds}s)..."
        $elapsed = 0
        do {
            Start-Sleep -Seconds $PollIntervalSeconds
            $elapsed += $PollIntervalSeconds
            $pg = Get-PostgresInfo
            Write-Host "  [$elapsed s] state: $($pg.state)"
        } while ($pg.state -ne 'Stopped' -and $elapsed -lt $StopTimeoutSeconds)

        if ($pg.state -ne 'Stopped') {
            throw "PostgreSQL did not reach 'Stopped' within ${StopTimeoutSeconds}s (last state: $($pg.state)). Check the Azure Portal."
        }
        Write-Ok 'PostgreSQL is now Stopped.'
    }

    Write-Host ''
    Write-Host 'Container App (trylo-api): left untouched (config not modified).' -ForegroundColor DarkGray
    Write-Host '  minReplicas=0 / maxReplicas=1 unchanged - it will simply have' -ForegroundColor DarkGray
    Write-Host '  no active replicas once idle, as usual.' -ForegroundColor DarkGray
    Write-Host 'Static Web Apps: left untouched (Free tier).' -ForegroundColor DarkGray

    Write-Warn ''
    Write-Warn 'Note: the API will not work for real requests until PostgreSQL is'
    Write-Warn 'started again with `.\scripts\azure-test-env.ps1 on` - this is expected.'

    Write-Section 'Final state:'
    Show-EnvironmentStatus | Out-Null
}

function Invoke-Restart {
    Write-Section 'Restarting PostgreSQL...'

    $ctx = Assert-CorrectSubscription
    Write-Ok "Logged in. Subscription: $($ctx.name) ($($ctx.id))"

    $pg = Get-PostgresInfo
    Write-Host "PostgreSQL current state: $($pg.state)"
    if ($pg.state -ne 'Ready') {
        Write-Warn "PostgreSQL is not currently 'Ready' (it's '$($pg.state)'). Restart still works, but consider using 'on' instead if it's simply stopped."
    }

    az postgres flexible-server restart -g $ResourceGroup -n $PostgresName -o none
    if ($LASTEXITCODE -ne 0) {
        throw "az postgres flexible-server restart failed with exit code $LASTEXITCODE."
    }

    Write-Host "Waiting for PostgreSQL to become Ready again (timeout: ${StartTimeoutSeconds}s)..."
    $elapsed = 0
    do {
        Start-Sleep -Seconds $PollIntervalSeconds
        $elapsed += $PollIntervalSeconds
        $pg = Get-PostgresInfo
        Write-Host "  [$elapsed s] state: $($pg.state)"
    } while ($pg.state -ne 'Ready' -and $elapsed -lt $StartTimeoutSeconds)

    if ($pg.state -ne 'Ready') {
        throw "PostgreSQL did not return to 'Ready' within ${StartTimeoutSeconds}s (last state: $($pg.state))."
    }

    Write-Ok 'PostgreSQL restarted and is Ready.'
    Show-EnvironmentStatus | Out-Null
}

function Show-Help {
    Write-Host @'
TRYLO Azure test environment control (trylo-test-rg)

Usage:
  .\scripts\azure-test-env.ps1 status    Read-only status of the test environment.
  .\scripts\azure-test-env.ps1 on        Start PostgreSQL (if stopped) before testing.
  .\scripts\azure-test-env.ps1 off       Stop PostgreSQL after testing.
  .\scripts\azure-test-env.ps1 restart   Restart PostgreSQL.

This script only ever starts/stops the existing PostgreSQL Flexible Server.
It never creates, deletes, or recreates any Azure resource, and never
touches Container App scale settings, Static Web Apps, secrets, or code.
'@
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

switch ($Action) {
    'status'  { Invoke-Status }
    'on'      { Invoke-On }
    'off'     { Invoke-Off }
    'restart' { Invoke-Restart }
    'help'    { Show-Help }
    default   { Show-Help }
}
