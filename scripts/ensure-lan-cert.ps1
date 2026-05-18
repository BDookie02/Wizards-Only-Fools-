param(
  [string]$OutputDir = "$PSScriptRoot\..\certs"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$certPath = Join-Path $OutputDir "lan-cert.pfx"
$passPath = Join-Path $OutputDir "lan-cert.pass"

if ((Test-Path $certPath) -and (Test-Path $passPath)) {
  Write-Host "LAN HTTPS certificate already exists at $certPath"
  exit 0
}

$lanIps = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne "127.0.0.1" -and
    $_.IPAddress -notlike "169.254*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Select-Object -ExpandProperty IPAddress -Unique

$sanParts = @("DNS=localhost", "IPAddress=127.0.0.1")
foreach ($ip in $lanIps) {
  $sanParts += "IPAddress=$ip"
}

$passphrase = [Guid]::NewGuid().ToString("N")
$securePassphrase = ConvertTo-SecureString -String $passphrase -AsPlainText -Force
$subjectAltNames = $sanParts -join "&"

$cert = New-SelfSignedCertificate `
  -Subject "CN=Wizards Only Fools LAN" `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -KeyExportPolicy Exportable `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -NotAfter (Get-Date).AddYears(2) `
  -TextExtension @("2.5.29.17={text}$subjectAltNames")

try {
  Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $securePassphrase | Out-Null
  Set-Content -Path $passPath -Value $passphrase -NoNewline
  Write-Host "Generated LAN HTTPS certificate:"
  Write-Host "  $certPath"
  if ($lanIps.Count -gt 0) {
    Write-Host "Certificate includes LAN IPs: $($lanIps -join ', ')"
  }
} finally {
  Remove-Item -Path "Cert:\CurrentUser\My\$($cert.Thumbprint)" -ErrorAction SilentlyContinue
}
