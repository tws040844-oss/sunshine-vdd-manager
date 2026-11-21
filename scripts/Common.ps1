Set-StrictMode -Version Latest

function Get-ManagerRoot {
    return Split-Path -Parent $PSScriptRoot
}

function Resolve-ManagerPath {
    param(
        [string]$BaseDir,
        [string]$PathValue
    )
    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return ""
    }
    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return $PathValue
    }
    return [System.IO.Path]::GetFullPath((Join-Path $BaseDir $PathValue))
}

function Get-MonitorIdWildcard {
    param([string]$MonitorId)
    if ([string]::IsNullOrWhiteSpace($MonitorId)) {
        return ""
    }
    $parts = $MonitorId -split '\\'
    if ($parts.Length -ge 2) {
        return "$($parts[0])\$($parts[1])\*"
    }
    return $MonitorId
}

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Configuration file not found: $Path"
    }
    return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

function Get-ManagerState {
    param([string]$RootDir = (Get-ManagerRoot))
    $machinePath = Join-Path $RootDir "local\machine.json"
    $profilesPath = Join-Path $RootDir "local\profiles.json"
    $machine = Read-JsonFile -Path $machinePath
    $profilesDoc = Read-JsonFile -Path $profilesPath
    return [pscustomobject]@{
        RootDir     = $RootDir
        Machine     = $machine
        ProfilesDoc = $profilesDoc
    }
}

function Resolve-MultiMonitorTool {
    param(
        [string]$RootDir,
        $Machine
    )
    $candidates = @()
    if ($Machine -and $Machine.tools -and $Machine.tools.multiMonitorToolPath) {
        $candidates += (Resolve-ManagerPath -BaseDir $RootDir -PathValue $Machine.tools.multiMonitorToolPath)
    }
    $candidates += (Join-Path $RootDir "tools\MultiMonitorTool.exe")
    $candidates += (Join-Path (Split-Path -Parent $RootDir) "MultiMonitorTool.exe")
    $candidates += (Join-Path (Split-Path -Parent $RootDir) "multimonitortool-x64\MultiMonitorTool.exe")

    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c)) {
            return $c
        }
    }
    throw "MultiMonitorTool.exe not found. Please place it in tools\ or configure multiMonitorToolPath."
}

function Set-RtssFramerateLimit {
    param(
        $Machine,
        [int]$LimitFps
    )
    if (-not $Machine -or -not $Machine.rtss -or -not $Machine.rtss.enabled) {
        return
    }
    $profilePath = [string]$Machine.rtss.profilePath
    $shortcutPath = [string]$Machine.rtss.shortcutPath
    if ([string]::IsNullOrWhiteSpace($profilePath) -or -not (Test-Path -LiteralPath $profilePath)) {
        return
    }

    Get-Process -Name "RTSS" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    $content = Get-Content -LiteralPath $profilePath -Raw -Encoding Ascii
    if ($content -match '(?m)^Limit=\d+') {
        $content = [regex]::Replace($content, '(?m)^Limit=\d+', "Limit=$LimitFps")
    }
    elseif ($content -match '\[Framerate\]') {
        $content = $content -replace '\[Framerate\]', "[Framerate]`r`nLimit=$LimitFps"
    }
    else {
        $content = "$content`r`n[Framerate]`r`nLimit=$LimitFps`r`n"
    }
    [System.IO.File]::WriteAllText($profilePath, $content, [System.Text.Encoding]::ASCII)

    if (-not [string]::IsNullOrWhiteSpace($shortcutPath) -and (Test-Path -LiteralPath $shortcutPath)) {
        Start-Process -FilePath $shortcutPath
        Start-Sleep -Seconds 1
    }
}

function Set-VddDeviceState {
    param(
        [string]$Pattern,
        [bool]$Enable
    )
    if ([string]::IsNullOrWhiteSpace($Pattern)) {
        $Pattern = "*Virtual Display*"
    }
    $devices = Get-PnpDevice -FriendlyName $Pattern -ErrorAction SilentlyContinue
    if (-not $devices) {
        return $false
    }
    foreach ($dev in $devices) {
        if ($Enable) {
            Enable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction Stop
        }
        else {
            Disable-PnpDevice -InstanceId $dev.InstanceId -Confirm:$false -ErrorAction Stop
        }
    }
    return $true
}
