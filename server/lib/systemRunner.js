const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function runPowerShell(args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
      { windowsHide: true, timeout: options.timeoutMs || 30000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const message = (stderr || stdout || err.message || '').trim();
          reject(new Error(message || `PowerShell exited with code ${err.code}`));
          return;
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    );
  });
}

async function isAdminSession() {
  try {
    const { stdout } = await runPowerShell([
      '-Command',
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
    ]);
    return /^true$/i.test(stdout.trim());
  } catch {
    return false;
  }
}

async function runScriptWithOptionalElevation(scriptPath, scriptArgs = []) {
  const admin = await isAdminSession();
  if (admin) {
    return runPowerShell(['-File', scriptPath, ...scriptArgs], { timeoutMs: 45000 });
  }

  const argListLiteral = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...scriptArgs,
  ]
    .map((a) => `'${String(a).replace(/'/g, "''")}'`)
    .join(', ');

  const cmd = `$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @(${argListLiteral}) -Verb RunAs -Wait -PassThru; exit $p.ExitCode`;
  return runPowerShell(['-Command', cmd], { timeoutMs: 90000 });
}

async function getSunshineServiceStatus() {
  try {
    const { stdout } = await runPowerShell([
      '-Command',
      "$s = Get-Service -Name 'SunshineService' -ErrorAction SilentlyContinue; if($s){ @{ exists=$true; status=[string]$s.Status } | ConvertTo-Json -Compress } else { @{ exists=$false; status='NotInstalled' } | ConvertTo-Json -Compress }",
    ]);
    return JSON.parse(stdout);
  } catch {
    return { exists: false, status: 'Unknown' };
  }
}

async function runDetectMonitors(rootDir, multiMonitorToolPath) {
  const scriptPath = path.join(rootDir, 'scripts', 'Detect-Monitors.ps1');
  const args = ['-File', scriptPath];
  if (multiMonitorToolPath) {
    args.push('-MultiMonitorToolPath', multiMonitorToolPath);
  }
  const { stdout } = await runPowerShell(args);
  return JSON.parse(stdout);
}

async function applySystemSync(rootDir, options) {
  const stagingDir = path.join(rootDir, 'local', 'tmp');
  fs.mkdirSync(stagingDir, { recursive: true });
  const stamp = Date.now();
  const resultPath = path.join(stagingDir, `sync-result-${stamp}.json`);
  const syncScript = path.join(rootDir, 'scripts', 'Apply-SystemSync.ps1');
  const args = ['-ResultPath', resultPath, '-BackupDir', path.join(rootDir, 'local', 'backups')];

  const cleanupPaths = [resultPath];

  if (options.vddXmlText && options.vddTargetPath) {
    const vddTemp = path.join(stagingDir, `vdd-${stamp}.xml`);
    fs.writeFileSync(vddTemp, options.vddXmlText, 'utf8');
    cleanupPaths.push(vddTemp);
    args.push('-VddTempPath', vddTemp, '-VddTargetPath', options.vddTargetPath);
  }
  if (options.vddPnpPattern) {
    args.push('-VddPattern', options.vddPnpPattern);
  }
  if (options.reloadVdd) {
    args.push('-ReloadVdd');
  }
  if (options.sunshineJsonText && options.sunshineTargetPath) {
    const sunTemp = path.join(stagingDir, `apps-${stamp}.json`);
    fs.writeFileSync(sunTemp, options.sunshineJsonText, 'utf8');
    cleanupPaths.push(sunTemp);
    args.push('-SunshineTempPath', sunTemp, '-SunshineTargetPath', options.sunshineTargetPath);
  }
  if (options.restartSunshine) {
    args.push('-RestartSunshine');
  }

  try {
    await runScriptWithOptionalElevation(syncScript, args);
    if (fs.existsSync(resultPath)) {
      const report = JSON.parse(fs.readFileSync(resultPath, 'utf8').replace(/^\uFEFF/, ''));
      if (!report.ok) {
        throw new Error(report.error || 'System sync failed');
      }
      return report;
    }
    return { ok: true };
  } finally {
    for (const p of cleanupPaths) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // ignore cleanup failure
      }
    }
  }
}

module.exports = {
  runPowerShell,
  isAdminSession,
  runScriptWithOptionalElevation,
  getSunshineServiceStatus,
  runDetectMonitors,
  applySystemSync,
};
