<#
  Stops node.exe processes that belong to this project only.

  Used by STOP_TRYLO.bat as a safety net for any leftover Node process
  (e.g. an orphaned `tsx watch` instance) that isn't bound to a port anymore
  and so wouldn't be caught by a plain port-based taskkill. Matching is done
  on the process command line containing the project root path, so Node
  processes belonging to other projects on the machine are left untouched.
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$escaped = [regex]::Escape($ProjectRoot)
$procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match $escaped) }

if (-not $procs) {
    Write-Host "No remaining TRYLO node.exe processes found."
    exit 0
}

foreach ($p in $procs) {
    try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        Write-Host "Stopped leftover node.exe process (PID $($p.ProcessId))"
    } catch {
        Write-Host "Could not stop PID $($p.ProcessId): $($_.Exception.Message)"
    }
}
