const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { generatePcCfg, generateProfileCfg } = require('../server/lib/cfgGenerator');
const { importMonitorsFromPcCfg } = require('../server/lib/machineConfig');

const SAMPLE_MACHINE = {
  monitors: {
    physical: [
      {
        id: 'primary',
        name: '\\\\.\\DISPLAY1',
        monitorId: 'MONITOR\\EXAMPLE1\\{4d36e96e-e325-11ce-bfc1-08002be10318}\\0001',
        serialNumber: '',
        isPrimary: true,
        bitsPerPixel: 32,
        width: 2560,
        height: 1440,
        displayFlags: 0,
        displayFrequency: 180,
        displayOrientation: 0,
        positionX: 0,
        positionY: 0,
      },
      {
        id: 'secondary',
        name: '\\\\.\\DISPLAY2',
        monitorId: 'MONITOR\\EXAMPLE2\\{4d36e96e-e325-11ce-bfc1-08002be10318}\\0002',
        serialNumber: 'SER123456',
        isPrimary: false,
        bitsPerPixel: 32,
        width: 1920,
        height: 1080,
        displayFlags: 0,
        displayFrequency: 120,
        displayOrientation: 0,
        positionX: -1920,
        positionY: 69,
      },
    ],
    virtual: {
      name: '\\\\.\\DISPLAY21',
      monitorId: 'MONITOR\\MTT1337\\{4d36e96e-e325-11ce-bfc1-08002be10318}\\0002',
      serialNumber: '',
      displayFlags: 0,
      displayOrientation: 0,
      positionX: 0,
      positionY: 0,
    },
  },
};

test('PC.cfg keeps physical monitors active, zeros VDD, uses CRLF and ASCII', () => {
  const cfg = generatePcCfg(SAMPLE_MACHINE);
  assert.ok(cfg.includes('\r\n'));
  assert.ok(!cfg.includes('\uFEFF'));
  assert.match(cfg, /\[Monitor0\][\s\S]*Width=2560\r\nHeight=1440\r\nDisplayFlags=0\r\nDisplayFrequency=180\r\nDisplayOrientation=0/);
  assert.match(cfg, /\[Monitor1\][\s\S]*SerialNumber=SER123456\r\nBitsPerPixel=32\r\nWidth=1920\r\nHeight=1080[\s\S]*PositionX=-1920\r\nPositionY=69/);
  assert.match(cfg, /\[Monitor2\][\s\S]*MTT1337[\s\S]*BitsPerPixel=0\r\nWidth=0\r\nHeight=0/);
});

test('Portrait VDD profile outputs Width < Height with DisplayOrientation=0 and zeroes physical displays', () => {
  const cfg = generateProfileCfg(SAMPLE_MACHINE, {
    id: 'desktop-fold8u-port-eff',
    mode: 'vdd',
    width: 1968,
    height: 2184,
    refreshRate: 60,
  });
  assert.match(cfg, /\[Monitor0\][\s\S]*BitsPerPixel=0\r\nWidth=0\r\nHeight=0\r\nDisplayFlags=0/);
  assert.match(cfg, /\[Monitor1\][\s\S]*BitsPerPixel=0\r\nWidth=0\r\nHeight=0\r\nDisplayFlags=0/);
  assert.match(cfg, /\[Monitor2\][\s\S]*MTT1337[\s\S]*BitsPerPixel=32\r\nWidth=1968\r\nHeight=2184\r\nDisplayFlags=0\r\nDisplayFrequency=60\r\nDisplayOrientation=0\r\nPositionX=0\r\nPositionY=0/);
});

test('Physical-primary profile enables primary only and zeroes secondary and VDD', () => {
  const cfg = generateProfileCfg(SAMPLE_MACHINE, {
    id: 'steam-2k-physical',
    mode: 'physical-primary',
    width: 2560,
    height: 1440,
    refreshRate: 180,
  });
  assert.match(cfg, /\[Monitor0\][\s\S]*BitsPerPixel=32\r\nWidth=2560\r\nHeight=1440/);
  assert.match(cfg, /\[Monitor1\][\s\S]*BitsPerPixel=0\r\nWidth=0\r\nHeight=0/);
  assert.match(cfg, /\[Monitor2\][\s\S]*BitsPerPixel=0\r\nWidth=0\r\nHeight=0/);
});

test('importMonitorsFromPcCfg round-trips generated PC.cfg cleanly', () => {
  const tmpFile = path.join(__dirname, 'tmp-pc.cfg');
  try {
    fs.writeFileSync(tmpFile, generatePcCfg(SAMPLE_MACHINE), 'ascii');
    const imported = importMonitorsFromPcCfg(tmpFile);
    assert.equal(imported.physical.length, 2);
    assert.equal(imported.physical[0].monitorId, SAMPLE_MACHINE.monitors.physical[0].monitorId);
    assert.equal(imported.physical[1].serialNumber, 'SER123456');
    assert.equal(imported.virtual.monitorId, SAMPLE_MACHINE.monitors.virtual.monitorId);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});
