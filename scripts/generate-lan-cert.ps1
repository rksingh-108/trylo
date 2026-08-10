$ErrorActionPreference = "Stop"

# Detects this machine's LAN-facing IPv4 address - the adapter with a real
# default gateway, which excludes virtual/internal-only adapters (e.g. the
# WSL/Hyper-V vEthernet adapter, which has an IP but no gateway) - and
# generates a fresh self-signed TLS certificate covering that IP (plus
# localhost/127.0.0.1) via openssl, for the private LAN test only.
# Regenerated on every run so it always matches the current IP: DHCP (or a
# phone hotspot) can hand out a different address on a different day.
$config = Get-NetIPConfiguration | Where-Object {
    $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up"
} | Select-Object -First 1

if (-not $config) {
    Write-Error "Could not detect a LAN-facing network adapter (one with a default gateway). Connect to Wi-Fi/Ethernet and try again."
    exit 1
}

$lanIp = $config.IPv4Address.IPAddress
Write-Output "LAN_IP=$lanIp"

$certDir = Join-Path $PSScriptRoot "..\certs"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null
$certDir = (Resolve-Path $certDir).Path

$keyPath = Join-Path $certDir "lan-key.pem"
$certPath = Join-Path $certDir "lan-cert.pem"
$opensslConfigPath = Join-Path $certDir "lan-openssl.cnf"

# Modern mobile browsers (Chrome/Android, Safari/iOS) reject certs that only
# have a CN and no subjectAltName, so the IP must be listed as an IP SAN
# entry, not just the common name.
$opensslConfig = @"
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = trylo-lan-test

[v3_req]
subjectAltName = @alt_names

[alt_names]
IP.1 = $lanIp
IP.2 = 127.0.0.1
DNS.1 = localhost
"@

Set-Content -Path $opensslConfigPath -Value $opensslConfig -Encoding ascii

& openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes `
    -keyout $keyPath -out $certPath `
    -config $opensslConfigPath -extensions v3_req

if ($LASTEXITCODE -ne 0) {
    Write-Error "openssl failed to generate the LAN test certificate (exit code $LASTEXITCODE)."
    exit 1
}

Write-Output "CERT_PATH=$certPath"
Write-Output "KEY_PATH=$keyPath"
