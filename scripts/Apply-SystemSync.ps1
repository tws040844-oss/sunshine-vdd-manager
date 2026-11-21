param(
    [string]$VddTempPath,
    [string]$VddTargetPath,
    [string]$SunshineTempPath,
    [string]$SunshineTargetPath,
    [string]$BackupDir,
    [string]$VddPattern = "*Virtual Display*",
    [switch]$ReloadVdd,
    [switch]$RestartSunshine,
    [string]$ResultPath
)

$ErrorActionPreference = "Stop"
$report = [ordered]@{
    ok               = $true
    timestamp        = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssK")
    vddUpdated       = $false
    vddReloaded      = $false
    sunshineUpdated  = $false
    sunshineRestarted = $false
    backups          = @()
    error            = ""
}

try {
    $stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
    if ($BackupDir -and -not (Test-Path -LiteralPath $BackupDir)) {
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }

    if ($VddTempPath -and $VddTargetPath) {
        if (-not (Test-Path -LiteralPath $VddTempPath)) {
            throw "VDD staging file not found: $VddTempPath"
        }
        if (Test-Path -LiteralPath $VddTargetPath) {
            $vddBak = if ($BackupDir) { Join-Path $BackupDir ("vdd_settings.xml.{0}.bak" -f $stamp) } else { "$VddTargetPath.$stamp.bak" }
            Copy-Item -LiteralPath $VddTargetPath -Destination $vddBak -Force
            $report.backups += $vddBak
        }
        $xmlContent = [System.IO.File]::ReadAllText($VddTempPath, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($VddTargetPath, $xmlContent, [System.Text.UTF8Encoding]::new($false))
        $report.vddUpdated = $true
    }

    if ($ReloadVdd) {
        & (Join-Path $PSScriptRoot "Reload-VDD.ps1") -Pattern $VddPattern | Out-Null
        $report.vddReloaded = $true
    }

    if ($SunshineTempPath -and $SunshineTargetPath) {
        if (-not (Test-Path -LiteralPath $SunshineTempPath)) {
            throw "Sunshine staging file not found: $SunshineTempPath"
        }
        if (Test-Path -LiteralPath $SunshineTargetPath) {
            $sunBak = if ($BackupDir) { Join-Path $BackupDir ("apps.json.{0}.bak" -f $stamp) } else { "$SunshineTargetPath.$stamp.bak" }
            Copy-Item -LiteralPath $SunshineTargetPath -Destination $sunBak -Force
            $report.backups += $sunBak
        }
        $jsonContent = [System.IO.File]::ReadAllText($SunshineTempPath, [System.Text.Encoding]::UTF8)
        [System.IO.File]::WriteAllText($SunshineTargetPath, $jsonContent, [System.Text.UTF8Encoding]::new($false))
        $report.sunshineUpdated = $true
    }

    if ($RestartSunshine) {
        $svc = Get-Service -Name "SunshineService" -ErrorAction SilentlyContinue
        if ($svc) {
            Restart-Service -Name "SunshineService" -Force -ErrorAction Stop
            $svc.WaitForStatus("Running", [TimeSpan]::FromSeconds(15))
            $report.sunshineRestarted = $true
        }
    }
}
catch {
    $report.ok = $false
    $report.error = $_.Exception.Message
}

$jsonOut = $report | ConvertTo-Json -Depth 4
if ($ResultPath) {
    [System.IO.File]::WriteAllText($ResultPath, $jsonOut, [System.Text.UTF8Encoding]::new($false))
}
Write-Output $jsonOut
if (-not $report.ok) {
    exit 1
}
