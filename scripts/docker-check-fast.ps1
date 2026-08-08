$job = Start-Job -ScriptBlock { & docker info *> $null; $LASTEXITCODE }
if (Wait-Job $job -Timeout 8) {
    $rc = Receive-Job $job
    Remove-Job $job -Force
    if ($rc -eq 0) { Write-Output "UP" } else { Write-Output "DOWN" }
} else {
    Remove-Job $job -Force
    Write-Output "DOWN"
}
