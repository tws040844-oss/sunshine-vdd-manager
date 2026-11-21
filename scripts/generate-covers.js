const path = require('path');
const { loadOrInitState, readJson, writeJson } = require('../server/lib/machineConfig');
const { generateAllCovers } = require('../server/lib/coverGenerator');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const presetsPath = path.join(rootDir, 'presets', 'devices.json');
  const presetsDoc = readJson(presetsPath);
  const presetIds = new Set(presetsDoc.profiles.map((p) => p.id));

  // Generate committed preset covers in assets/covers/
  const results = await generateAllCovers(rootDir, presetsDoc.profiles, {
    forcePresetDir: true,
    presetIds,
    concurrency: 4,
  });

  // Ensure presets/devices.json references assets/covers/<id>.png
  for (const p of presetsDoc.profiles) {
    p.imagePath = `assets/covers/${p.id}.png`;
  }
  writeJson(presetsPath, presetsDoc);

  // Also sync local/profiles.json if present
  const state = loadOrInitState(rootDir);
  for (const p of state.profilesDoc.profiles) {
    if (presetIds.has(p.id)) {
      p.imagePath = `assets/covers/${p.id}.png`;
    }
  }
  writeJson(state.paths.profilesPath, state.profilesDoc);

  console.log(`Generated ${results.length} cover PNGs (${results[0].width}x${results[0].height}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
