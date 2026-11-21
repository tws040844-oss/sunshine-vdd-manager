const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildAppsJsonDocument, validateAppsJsonDocument } = require('../server/lib/sunshineSync');

test('builds all 20 organized Sunshine apps with zero blank prep-cmd or cmd fields', () => {
  const presets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'presets', 'devices.json'), 'utf8'));
  const rootDir = path.resolve(__dirname, '..');
  const doc = buildAppsJsonDocument(rootDir, presets.profiles, { apps: [], env: { TEST_VAR: '1' } });
  const errors = validateAppsJsonDocument(doc);

  assert.deepEqual(errors, []);
  assert.equal(doc.apps.length, 20);
  assert.deepEqual(doc.env, { TEST_VAR: '1' });

  // First item is passthrough Desktop without prep-cmd
  assert.equal(doc.apps[0].name, 'Desktop｜原生雙螢幕');
  assert.equal(doc.apps[0]['prep-cmd'], undefined);
  assert.equal(doc.apps[0].cmd, undefined);

  // Efficiency entries appear before performance entries
  const landEffIdx = doc.apps.findIndex((a) => a.name.includes('Desktop｜Fold8U 展開橫向 (效率 2184×1968)'));
  const portEffIdx = doc.apps.findIndex((a) => a.name.includes('Desktop｜Fold8U 展開直向 (效率 1968×2184)'));
  const landPerfIdx = doc.apps.findIndex((a) => a.name.includes('Desktop｜Fold8U 展開橫向 (效能 2504×2256)'));
  assert.ok(landEffIdx > 0 && portEffIdx > landEffIdx && landPerfIdx > portEffIdx);

  // Wrapper paths do not contain empty commands
  const portEff = doc.apps[portEffIdx];
  assert.equal(portEff['prep-cmd'][0].elevated, true);
  assert.match(portEff['prep-cmd'][0].do, /Start_desktop-fold8u-port-eff\.bat"$/);
  assert.match(portEff['prep-cmd'][0].undo, /Restore_PC\.bat"$/);

  // Every preset entry points to an existing absolute .png cover
  for (const app of doc.apps) {
    assert.ok(path.isAbsolute(app['image-path']), `Expected absolute image-path for ${app.name}, got ${app['image-path']}`);
    assert.ok(fs.existsSync(app['image-path']), `Missing cover file for ${app.name}: ${app['image-path']}`);
  }
});
