param(
    [string]$MultiMonitorToolPath = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$rootDir = Get-ManagerRoot
$mmt = $MultiMonitorToolPath
if ([string]::IsNullOrWhiteSpace($mmt) -or -not (Test-Path -LiteralPath $mmt)) {
    $candidates = @(
        (Join-Path $rootDir "tools\MultiMonitorTool.exe"),
        (Join-Path (Split-Path -Parent $rootDir) "MultiMonitorTool.exe"),
        (Join-Path (Split-Path -Parent $rootDir) "multimonitortool-x64\MultiMonitorTool.exe")
    )
    $machinePath = Join-Path $rootDir "local\machine.json"
    if (Test-Path -LiteralPath $machinePath) {
        $m = Read-JsonFile -Path $machinePath
        if ($m.tools.multiMonitorToolPath) {
            $candidates = @((Resolve-ManagerPath -BaseDir $rootDir -PathValue $m.tools.multiMonitorToolPath)) + $candidates
        }
    }
    $mmt = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
}

$activeMonitors = @()
if ($mmt -and (Test-Path -LiteralPath $mmt)) {
    $tmpCsv = Join-Path $env:TEMP ("mmt_detect_{0}.csv" -f ([guid]::NewGuid().ToString("N")))
    try {
        & $mmt /scomma $tmpCsv | Out-Null
        for ($i = 0; $i -lt 20 -and -not (Test-Path -LiteralPath $tmpCsv); $i++) {
            Start-Sleep -Milliseconds 100
        }
        if (Test-Path -LiteralPath $tmpCsv) {
            $rows = Import-Csv -LiteralPath $tmpCsv -ErrorAction SilentlyContinue
            foreach ($r in $rows) {
                $resParts = ([string]$r.Resolution) -split '\s*[xX]\s*'
                $posParts = ([string]$r.'Left-Top') -split '\s*,\s*'
                $w = if ($resParts.Length -eq 2) { [int]($resParts[0].Trim()) } else { 0 }
                $h = if ($resParts.Length -eq 2) { [int]($resParts[1].Trim()) } else { 0 }
                $px = if ($posParts.Length -eq 2) { [int]($posParts[0].Trim()) } else { 0 }
                $py = if ($posParts.Length -eq 2) { [int]($posParts[1].Trim()) } else { 0 }
                $fullMonitorId = [string]$r.'Monitor ID'
                $shortId = [string]$r.'Short Monitor ID'
                $effectiveMonitorId = if (-not [string]::IsNullOrWhiteSpace($fullMonitorId)) { $fullMonitorId } else { $shortId }
                $monName = [string]$r.'Monitor Name'
                $isVirtual = ($effectiveMonitorId -match 'MTT|VDD') -or ($shortId -match 'MTT|VDD') -or ($monName -match 'VDD|Virtual')
                $activeMonitors += [ordered]@{
                    name               = [string]$r.Name
                    monitorId          = $effectiveMonitorId
                    shortMonitorId     = $shortId
                    serialNumber       = [string]$r.'Monitor Serial Number'
                    monitorName        = $monName
                    adapter            = [string]$r.Adapter
                    active             = ([string]$r.Active -eq 'Yes')
                    disconnected       = ([string]$r.Disconnected -eq 'Yes')
                    isPrimary          = ([string]$r.Primary -eq 'Yes')
                    bitsPerPixel       = if ($r.Colors) { [int]$r.Colors } else { 32 }
                    width              = $w
                    height             = $h
                    displayFrequency   = if ($r.Frequency) { [int]$r.Frequency } else { 60 }
                    displayFlags       = 0
                    displayOrientation = 0
                    positionX          = $px
                    positionY          = $py
                    isVirtual          = [bool]$isVirtual
                }
            }
        }
    }
    finally {
        Remove-Item -LiteralPath $tmpCsv -Force -ErrorAction SilentlyContinue
    }
}

$pnpAll = @(Get-PnpDevice -Class Monitor, Display -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{
        status       = [string]$_.Status
        class        = [string]$_.Class
        friendlyName = [string]$_.FriendlyName
        instanceId   = [string]$_.InstanceId
    }
})

$vddDevices = @($pnpAll | Where-Object { $_.friendlyName -match 'Virtual Display|VDD|MTT' -or $_.instanceId -match 'MTT1337' })
$vddEnabled = @($vddDevices | Where-Object { $_.class -eq 'Display' -and $_.status -eq 'OK' }).Count -gt 0

$out = [ordered]@{
    ok               = $true
    multiMonitorTool = $mmt
    monitors         = $activeMonitors
    pnpDevices       = $pnpAll
    vddPresent       = ($vddDevices.Count -gt 0)
    vddEnabled       = $vddEnabled
}

$out | ConvertTo-Json -Depth 6
