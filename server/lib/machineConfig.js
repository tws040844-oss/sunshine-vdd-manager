const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function parseMonitorCfg(cfgText) {
  const sections = [];
  let current = null;
  const lines = cfgText.replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('=')) {
      continue;
    }
    const secMatch = line.match(/^\[(Monitor\d+)\]$/i);
    if (secMatch) {
      current = { section: secMatch[1] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    current[key] = value;
  }
  return sections;
}

function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function isVirtualMonitorId(monitorId) {
  return /MTT\d+|VDD/i.test(monitorId || '');
}

function importMonitorsFromPcCfg(cfgPath, existingMachine = null) {
  const text = fs.readFileSync(cfgPath, 'utf8');
  const sections = parseMonitorCfg(text);
  const physical = [];
  let virtual = existingMachine?.monitors?.virtual || null;

  for (const s of sections) {
    const monitorId = s.MonitorID || '';
    if (!monitorId) continue;

    if (isVirtualMonitorId(monitorId)) {
      virtual = {
        label: 'Virtual Display Driver (MTT VDD)',
        name: s.Name || '\\\\.\\DISPLAY6',
        monitorId,
        serialNumber: s.SerialNumber || '',
        displayFlags: toInt(s.DisplayFlags, 0),
        displayOrientation: toInt(s.DisplayOrientation, 0),
        positionX: toInt(s.PositionX, 0),
        positionY: toInt(s.PositionY, 0),
      };
    } else {
      const idx = physical.length;
      const posX = toInt(s.PositionX, 0);
      const posY = toInt(s.PositionY, 0);
      const isPrimary = posX === 0 && posY === 0 && idx === 0;
      physical.push({
        id: isPrimary ? 'primary-monitor' : `physical-${idx + 1}`,
        label: isPrimary ? '主實體螢幕 (Primary)' : `副實體螢幕 ${idx + 1}`,
        name: s.Name || `\\\\.\\DISPLAY${idx + 1}`,
        monitorId,
        serialNumber: s.SerialNumber || '',
        isPrimary,
        bitsPerPixel: toInt(s.BitsPerPixel, 32) || 32,
        width: toInt(s.Width, 1920),
        height: toInt(s.Height, 1080),
        displayFlags: toInt(s.DisplayFlags, 0),
        displayFrequency: toInt(s.DisplayFrequency, 60) || 60,
        displayOrientation: toInt(s.DisplayOrientation, 0),
        positionX: posX,
        positionY: posY,
      });
    }
  }

  if (physical.length > 0 && !physical.some((m) => m.isPrimary)) {
    physical[0].isPrimary = true;
  }

  return { physical, virtual };
}

function getPaths(rootDir) {
  const localDir = path.join(rootDir, 'local');
  return {
    rootDir,
    localDir,
    machinePath: path.join(localDir, 'machine.json'),
    profilesPath: path.join(localDir, 'profiles.json'),
    cfgDir: path.join(localDir, 'profiles'),
    wrappersDir: path.join(localDir, 'wrappers'),
    backupsDir: path.join(localDir, 'backups'),
    exampleMachinePath: path.join(rootDir, 'config', 'machine.example.json'),
    presetProfilesPath: path.join(rootDir, 'presets', 'devices.json'),
  };
}

function loadOrInitState(rootDir) {
  const p = getPaths(rootDir);
  ensureDir(p.localDir);
  ensureDir(p.cfgDir);
  ensureDir(p.wrappersDir);
  ensureDir(p.backupsDir);

  let machine;
  if (fs.existsSync(p.machinePath)) {
    machine = readJson(p.machinePath);
  } else {
    machine = readJson(p.exampleMachinePath);
    writeJson(p.machinePath, machine);
  }

  let profilesDoc;
  if (fs.existsSync(p.profilesPath)) {
    profilesDoc = readJson(p.profilesPath);
  } else {
    profilesDoc = readJson(p.presetProfilesPath);
    writeJson(p.profilesPath, profilesDoc);
  }

  return { paths: p, machine, profilesDoc };
}

function resolveToolPath(rootDir, configuredPath) {
  if (!configuredPath) return '';
  if (path.isAbsolute(configuredPath)) return configuredPath;
  return path.resolve(rootDir, configuredPath);
}

module.exports = {
  ensureDir,
  readJson,
  writeJson,
  parseMonitorCfg,
  importMonitorsFromPcCfg,
  getPaths,
  loadOrInitState,
  resolveToolPath,
};
