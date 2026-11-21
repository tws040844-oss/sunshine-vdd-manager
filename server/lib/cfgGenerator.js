const fs = require('fs');
const path = require('path');

function sanitizeAscii(value) {
  return String(value ?? '').replace(/[^\x20-\x7E]/g, '');
}

function formatMonitorSection(index, mon) {
  const lines = [
    `[Monitor${index}]`,
    `Name=${sanitizeAscii(mon.name)}`,
    `MonitorID=${sanitizeAscii(mon.monitorId)}`,
    `SerialNumber=${sanitizeAscii(mon.serialNumber || '')}`,
    `BitsPerPixel=${Number(mon.bitsPerPixel ?? 0)}`,
    `Width=${Number(mon.width ?? 0)}`,
    `Height=${Number(mon.height ?? 0)}`,
    `DisplayFlags=${Number(mon.displayFlags ?? 0)}`,
    `DisplayFrequency=${Number(mon.displayFrequency ?? 0)}`,
    `DisplayOrientation=${Number(mon.displayOrientation ?? 0)}`,
    `PositionX=${Number(mon.positionX ?? 0)}`,
    `PositionY=${Number(mon.positionY ?? 0)}`,
  ];
  return lines.join('\r\n');
}

function zeroedMonitor(mon) {
  return {
    name: mon.name || '\\\\.\\DISPLAY1',
    monitorId: mon.monitorId || '',
    serialNumber: mon.serialNumber || '',
    bitsPerPixel: 0,
    width: 0,
    height: 0,
    displayFlags: 0,
    displayFrequency: 0,
    displayOrientation: 0,
    positionX: 0,
    positionY: 0,
  };
}

function buildCfgText(monitors) {
  return monitors.map((m, i) => formatMonitorSection(i, m)).join('\r\n\r\n') + '\r\n';
}

function generatePcCfg(machine) {
  const physical = (machine.monitors?.physical || []).map((m) => ({
    name: m.name,
    monitorId: m.monitorId,
    serialNumber: m.serialNumber || '',
    bitsPerPixel: m.bitsPerPixel || 32,
    width: m.width,
    height: m.height,
    displayFlags: m.displayFlags ?? 0,
    displayFrequency: m.displayFrequency || 60,
    displayOrientation: m.displayOrientation ?? 0,
    positionX: m.positionX ?? 0,
    positionY: m.positionY ?? 0,
  }));

  const sections = [...physical];
  if (machine.monitors?.virtual?.monitorId) {
    sections.push(zeroedMonitor(machine.monitors.virtual));
  }
  return buildCfgText(sections);
}

function generateProfileCfg(machine, profile) {
  if (!profile || profile.mode === 'passthrough') {
    return null;
  }

  const physical = machine.monitors?.physical || [];
  const virtual = machine.monitors?.virtual;
  const sections = [];

  if (profile.mode === 'vdd') {
    for (const m of physical) {
      sections.push(zeroedMonitor(m));
    }
    if (!virtual || !virtual.monitorId) {
      throw new Error('Virtual display MonitorID is not configured in machine.json');
    }
    sections.push({
      name: virtual.name || '\\\\.\\DISPLAY21',
      monitorId: virtual.monitorId,
      serialNumber: virtual.serialNumber || '',
      bitsPerPixel: 32,
      width: Number(profile.width),
      height: Number(profile.height),
      displayFlags: virtual.displayFlags ?? 0,
      displayFrequency: Number(profile.refreshRate || 60),
      displayOrientation: 0,
      positionX: virtual.positionX ?? 0,
      positionY: virtual.positionY ?? 0,
    });
  } else if (profile.mode === 'physical-primary') {
    const primaryIdx = Math.max(0, physical.findIndex((m) => m.isPrimary));
    physical.forEach((m, idx) => {
      if (idx === primaryIdx) {
        sections.push({
          name: m.name,
          monitorId: m.monitorId,
          serialNumber: m.serialNumber || '',
          bitsPerPixel: m.bitsPerPixel || 32,
          width: Number(profile.width || m.width),
          height: Number(profile.height || m.height),
          displayFlags: m.displayFlags ?? 0,
          displayFrequency: Number(profile.refreshRate || m.displayFrequency || 60),
          displayOrientation: m.displayOrientation ?? 0,
          positionX: 0,
          positionY: 0,
        });
      } else {
        sections.push(zeroedMonitor(m));
      }
    });
    if (virtual?.monitorId) {
      sections.push(zeroedMonitor(virtual));
    }
  } else {
    throw new Error(`Unsupported profile mode for .cfg generation: ${profile.mode}`);
  }

  return buildCfgText(sections);
}

function writeAsciiFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(content, 'ascii'));
}

function writeAllCfgs(rootDir, machine, profiles) {
  const cfgDir = path.join(rootDir, 'local', 'profiles');
  const written = [];

  const pcCfgPath = path.join(cfgDir, 'PC.cfg');
  writeAsciiFile(pcCfgPath, generatePcCfg(machine));
  written.push(pcCfgPath);

  for (const profile of profiles) {
    const content = generateProfileCfg(machine, profile);
    if (content !== null) {
      const target = path.join(cfgDir, `${profile.id}.cfg`);
      writeAsciiFile(target, content);
      written.push(target);
    }
  }

  return written;
}

module.exports = {
  formatMonitorSection,
  generatePcCfg,
  generateProfileCfg,
  writeAsciiFile,
  writeAllCfgs,
};
