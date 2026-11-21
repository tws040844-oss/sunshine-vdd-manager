const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { inspectVddXml, patchVddXml, parseVddResolutions } = require('../server/lib/vddSync');

const SAMPLE_XML = `<?xml version='1.0' encoding='utf-8'?>\r\n<vdd_settings>\r\n    <resolutions>\r\n        <resolution>\r\n            <width>2184</width>\r\n            <height>1968</height>\r\n            <refresh_rate>30</refresh_rate>\r\n        </resolution>\r\n    </resolutions>\r\n    <options>\r\n        <HardwareCursor>true</HardwareCursor>\r\n    </options>\r\n</vdd_settings>\r\n`;

test('inspectVddXml detects missing Fold 8 Ultra portrait resolutions without duplicating existing ones', () => {
  const presets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'presets', 'devices.json'), 'utf8'));
  const check = inspectVddXml(SAMPLE_XML, presets.profiles, presets.vddExtraResolutions);
  const missingKeys = new Set(check.missing.map((r) => `${r.width}x${r.height}`));
  assert.ok(!missingKeys.has('2184x1968'));
  assert.ok(missingKeys.has('1968x2184'));
  assert.ok(missingKeys.has('2256x2504'));
  assert.ok(missingKeys.has('1080x2520'));
});

test('patchVddXml inserts missing resolutions losslessly and preserves options block', () => {
  const presets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'presets', 'devices.json'), 'utf8'));
  const check = inspectVddXml(SAMPLE_XML, presets.profiles, presets.vddExtraResolutions);
  const patched = patchVddXml(SAMPLE_XML, check.missing);
  const parsed = parseVddResolutions(patched);
  assert.equal(parsed.length, 1 + check.missing.length);
  assert.ok(patched.includes('<HardwareCursor>true</HardwareCursor>'));
  const recheck = inspectVddXml(patched, presets.profiles, presets.vddExtraResolutions);
  assert.equal(recheck.missing.length, 0);
});
