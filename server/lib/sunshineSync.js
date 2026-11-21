const fs = require('fs');
const path = require('path');

function buildSunshineAppEntry(rootDir, profile) {
  const entry = {
    'auto-detach': true,
    elevated: true,
    'exclude-global-prep-cmd': false,
    'exit-timeout': 5,
    'image-path': profile.imagePath || '',
    name: profile.name,
  };

  if (profile.cmd && String(profile.cmd).trim() !== '') {
    entry.cmd = String(profile.cmd).trim();
  }

  if (profile.mode !== 'passthrough') {
    const startBat = path.join(rootDir, 'local', 'wrappers', `Start_${profile.id}.bat`);
    const undoBat = path.join(rootDir, 'local', 'wrappers', 'Restore_PC.bat');
    entry['prep-cmd'] = [
      {
        do: `"${startBat}"`,
        elevated: true,
        undo: `"${undoBat}"`,
      },
    ];
  }

  entry['wait-all'] = Boolean(profile.waitAll);
  return entry;
}

function buildAppsJsonDocument(rootDir, profiles, existingDoc = null) {
  const enabledProfiles = profiles.filter((p) => p.enabled !== false);
  const apps = enabledProfiles.map((p) => buildSunshineAppEntry(rootDir, p));
  return {
    apps,
    env: existingDoc && typeof existingDoc.env === 'object' && existingDoc.env !== null ? existingDoc.env : {},
  };
}

function validateAppsJsonDocument(doc) {
  const errors = [];
  if (!doc || !Array.isArray(doc.apps)) {
    return ['Document must contain an apps array'];
  }
  doc.apps.forEach((app, idx) => {
    if (!app.name || !String(app.name).trim()) {
      errors.push(`App #${idx} has empty name`);
    }
    if ('cmd' in app && !String(app.cmd).trim()) {
      errors.push(`App "${app.name}" contains blank cmd property`);
    }
    if (Array.isArray(app['prep-cmd'])) {
      app['prep-cmd'].forEach((pc, pIdx) => {
        if (!pc.do || !String(pc.do).trim() || !pc.undo || !String(pc.undo).trim()) {
          errors.push(`App "${app.name}" prep-cmd[${pIdx}] has blank do/undo`);
        }
        if (pc.elevated !== true) {
          errors.push(`App "${app.name}" prep-cmd[${pIdx}] must set elevated: true`);
        }
      });
    }
  });
  return errors;
}

function previewSunshineSync(rootDir, sunshineAppsPath, profiles) {
  let existingDoc = { apps: [], env: {} };
  const exists = Boolean(sunshineAppsPath && fs.existsSync(sunshineAppsPath));
  if (exists) {
    const raw = fs.readFileSync(sunshineAppsPath, 'utf8').replace(/^\uFEFF/, '');
    existingDoc = JSON.parse(raw);
  }

  const nextDoc = buildAppsJsonDocument(rootDir, profiles, existingDoc);
  const validationErrors = validateAppsJsonDocument(nextDoc);

  const oldNames = new Set((existingDoc.apps || []).map((a) => a.name));
  const newNames = new Set(nextDoc.apps.map((a) => a.name));

  const added = nextDoc.apps.map((a) => a.name).filter((n) => !oldNames.has(n));
  const removed = (existingDoc.apps || []).map((a) => a.name).filter((n) => !newNames.has(n));
  const kept = nextDoc.apps.map((a) => a.name).filter((n) => oldNames.has(n));

  return {
    exists,
    path: sunshineAppsPath,
    currentCount: (existingDoc.apps || []).length,
    nextCount: nextDoc.apps.length,
    added,
    removed,
    kept,
    validationErrors,
    nextDoc,
    formattedJson: JSON.stringify(nextDoc, null, 4) + '\n',
  };
}

module.exports = {
  buildSunshineAppEntry,
  buildAppsJsonDocument,
  validateAppsJsonDocument,
  previewSunshineSync,
};
