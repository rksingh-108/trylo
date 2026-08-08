param(
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$ProjectRoot
)
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $conn) {
    Write-Output "FREE|"
    exit 0
}
$proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
if ($proc -and $proc.CommandLine -and $proc.CommandLine.Contains($ProjectRoot)) {
    Write-Output "TRYLO|$($conn.OwningProcess)"
} else {
    Write-Output "OTHER|$($conn.OwningProcess)"
}
