param(
    [Parameter(Mandatory = $true)]
    [string]$ProfileId
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$state = Get-ManagerState
$rootDir = $state.RootDir
$machine = $state.Machine
$profile = $state.ProfilesDoc.profiles | Where-Object { $_.id -eq $ProfileId } | Select-Object -First 1

if (-not $profile) {
    throw "Profile not found: $ProfileId"
}

if ($profile.mode -eq "passthrough") {
    exit 0
}

$mmt = Resolve-MultiMonitorTool -RootDir $rootDir -Machine $machine
$cfgPath = Join-Path $rootDir ("local\profiles\{0}.cfg" -f $ProfileId)
if (-not (Test-Path -LiteralPath $cfgPath)) {
    throw "Profile snapshot file missing: $cfgPath"
}

if ($profile.rtssFps -and [int]$profile.rtssFps -gt 0) {
    Set-RtssFramerateLimit -Machine $machine -LimitFps ([int]$profile.rtssFps)
}

if ($profile.mode -eq "vdd") {
    $vddPattern = if ($machine.tools.vddPnpPattern) { [string]$machine.tools.vddPnpPattern } else { "*Virtual Display*" }
    $null = Set-VddDeviceState -Pattern $vddPattern -Enable $true
    Start-Sleep -Seconds 1

    foreach ($mon in $machine.monitors.physical) {
        $wildcard = Get-MonitorIdWildcard -MonitorId ([string]$mon.monitorId)
        if ($wildcard) {
            & $mmt /disable $wildcard | Out-Null
        }
    }
}

& $mmt /LoadConfig $cfgPath | Out-Null
exit 0
