param(
    [string]$Pattern = "*Virtual Display*",
    [switch]$KeepEnabled
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$devices = Get-PnpDevice -FriendlyName $Pattern -ErrorAction SilentlyContinue
if (-not $devices) {
    throw "No PnP devices found matching: $Pattern"
}

$null = Set-VddDeviceState -Pattern $Pattern -Enable $false
Start-Sleep -Seconds 1
$null = Set-VddDeviceState -Pattern $Pattern -Enable $true
Start-Sleep -Seconds 2

if (-not $KeepEnabled) {
    $null = Set-VddDeviceState -Pattern $Pattern -Enable $false
}

Write-Output "VDD reloaded (KeepEnabled=$KeepEnabled)."
