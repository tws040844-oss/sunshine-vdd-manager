const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildCoverHtml, describeProfileVisual, readPngDimensions } = require('../server/lib/coverGenerator');

const ROOT_DIR = path.resolve(__dirname, '..');

test('all 20 preset profiles produce valid HTML with crisp device labels and resolution captions', () => {
  const presets = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'presets', 'devices.json'), 'utf8'));
  assert.equal(presets.profiles.length, 20);

  for (const profile of presets.profiles) {
    const visual = describeProfileVisual(profile);
    const html = buildCoverHtml(profile);
    assert.ok(html.includes('<svg'), `Missing SVG in ${profile.id}`);
    assert.ok(html.includes(visual.mainTitle), `Missing title in ${profile.id}`);
    assert.ok(html.includes(visual.modeText), `Missing mode pill in ${profile.id}`);
    assert.ok(html.includes(visual.resLabel), `Missing resolution label in ${profile.id}`);
  }
});

test('all 20 committed cover PNGs exist and have exact 600x800 dimensions', () => {
  const presets = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'presets', 'devices.json'), 'utf8'));
  for (const profile of presets.profiles) {
    assert.ok(profile.imagePath.startsWith('assets/covers/'), `Unexpected imagePath: ${profile.imagePath}`);
    const absPath = path.resolve(ROOT_DIR, profile.imagePath);
    assert.ok(fs.existsSync(absPath), `Missing cover PNG: ${absPath}`);
    const dims = readPngDimensions(absPath);
    assert.equal(dims.width, 600, `Width mismatch for ${profile.id}`);
    assert.equal(dims.height, 800, `Height mismatch for ${profile.id}`);
  }
});
