$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$state = Get-ManagerState
$rootDir = $state.RootDir
$machine = $state.Machine
$mmt = Resolve-MultiMonitorTool -RootDir $rootDir -Machine $machine

Get-Process -Name "MultiMonitorTool" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
if ($machine.rtss -and $machine.rtss.enabled) {
    Get-Process -Name "RTSS" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

foreach ($mon in $machine.monitors.physical) {
    $wildcard = Get-MonitorIdWildcard -MonitorId ([string]$mon.monitorId)
    if ($wildcard) {
        & $mmt /enable $wildcard | Out-Null
    }
}
Start-Sleep -Seconds 1

$primary = $machine.monitors.physical | Where-Object { $_.isPrimary } | Select-Object -First 1
if (-not $primary) {
    $primary = $machine.monitors.physical | Select-Object -First 1
}
if ($primary) {
    $primaryWildcard = Get-MonitorIdWildcard -MonitorId ([string]$primary.monitorId)
    if ($primaryWildcard) {
        & $mmt /SetPrimary $primaryWildcard | Out-Null
        Start-Sleep -Seconds 1
    }
}

$pcCfgPath = Join-Path $rootDir "local\profiles\PC.cfg"
if (Test-Path -LiteralPath $pcCfgPath) {
    & $mmt /LoadConfig $pcCfgPath | Out-Null
    Start-Sleep -Seconds 1
}

$vddPattern = if ($machine.tools.vddPnpPattern) { [string]$machine.tools.vddPnpPattern } else { "*Virtual Display*" }
$null = Set-VddDeviceState -Pattern $vddPattern -Enable $false
Start-Sleep -Seconds 1

if ($machine.rtss -and $machine.rtss.enabled) {
    $restoreFps = if ($machine.rtss.restoreFps) { [int]$machine.rtss.restoreFps } else { 120 }
    Set-RtssFramerateLimit -Machine $machine -LimitFps $restoreFps
}

exit 0
