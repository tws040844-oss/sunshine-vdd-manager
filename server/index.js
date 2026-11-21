const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const {
  readJson,
  writeJson,
  importMonitorsFromPcCfg,
  loadOrInitState,
  resolveToolPath,
} = require('./lib/machineConfig');
const { writeAllCfgs } = require('./lib/cfgGenerator');
const { writeAllWrappers, validateProfileId } = require('./lib/wrapperGenerator');
const { inspectVddFile, patchVddXml } = require('./lib/vddSync');
const { previewSunshineSync } = require('./lib/sunshineSync');
const { renderCoverPng, generateAllCovers, getCoverRelativePath } = require('./lib/coverGenerator');
const {
  getSunshineServiceStatus,
  runDetectMonitors,
  applySystemSync,
  runScriptWithOptionalElevation,
} = require('./lib/systemRunner');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const HOST = '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '47995', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > 2 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeProfile(input, existing = {}) {
  const id = String(input.id || existing.id || '').trim();
  validateProfileId(id);
  const width = Number.parseInt(input.width ?? existing.width, 10);
  const height = Number.parseInt(input.height ?? existing.height, 10);
  const refreshRate = Number.parseInt(input.refreshRate ?? existing.refreshRate ?? 60, 10);
  const rtssFps = Number.parseInt(input.rtssFps ?? existing.rtssFps ?? 0, 10);
  if (!Number.isFinite(width) || width < 256 || width > 8192) {
    throw new Error(`Invalid width: ${width}`);
  }
  if (!Number.isFinite(height) || height < 256 || height > 8192) {
    throw new Error(`Invalid height: ${height}`);
  }

  return {
    id,
    name: String(input.name || existing.name || id).trim(),
    category: String(input.category || existing.category || 'Desktop').trim(),
    device: String(input.device || existing.device || 'Custom').trim(),
    tier: String(input.tier || existing.tier || 'standard').trim(),
    orientation: width >= height ? 'landscape' : 'portrait',
    mode: ['passthrough', 'vdd', 'physical-primary'].includes(input.mode) ? input.mode : (existing.mode || 'vdd'),
    width,
    height,
    refreshRate: Number.isFinite(refreshRate) && refreshRate > 0 ? refreshRate : 60,
    rtssFps: Number.isFinite(rtssFps) && rtssFps >= 0 ? rtssFps : 0,
    cmd: String(input.cmd ?? existing.cmd ?? '').trim(),
    imagePath: String(input.imagePath ?? existing.imagePath ?? '').trim(),
    waitAll: Boolean(input.waitAll ?? existing.waitAll ?? false),
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : (existing.enabled !== false),
    notes: String(input.notes ?? existing.notes ?? '').trim(),
  };
}

function serveCoverFile(reqPath, res) {
  const match = reqPath.match(/^\/covers\/(assets|local)\/([a-zA-Z0-9_-]+\.png)$/);
  if (!match) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const baseDir = match[1] === 'assets'
    ? path.join(ROOT_DIR, 'assets', 'covers')
    : path.join(ROOT_DIR, 'local', 'covers');
  const resolved = path.resolve(baseDir, match[2]);
  if (!resolved.startsWith(baseDir + path.sep) || !fs.existsSync(resolved)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
  fs.createReadStream(resolved).pipe(res);
}

function serveStaticFile(reqPath, res) {
  if (reqPath.startsWith('/covers/')) {
    serveCoverFile(reqPath, res);
    return;
  }
  const rel = reqPath === '/' ? 'index.html' : reqPath.replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, rel);
  if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== path.join(PUBLIC_DIR, 'index.html')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(resolved).pipe(res);
}

async function handleApi(req, res, pathname) {
  const state = loadOrInitState(ROOT_DIR);
  const { paths, machine, profilesDoc } = state;

  if (req.method === 'GET' && pathname === '/api/status') {
    const mmtPath = resolveToolPath(ROOT_DIR, machine.tools?.multiMonitorToolPath);
    const parentMmt = path.join(path.dirname(ROOT_DIR), 'MultiMonitorTool.exe');
    const resolvedMmt = fs.existsSync(mmtPath) ? mmtPath : (fs.existsSync(parentMmt) ? parentMmt : mmtPath);

    const vddCheck = inspectVddFile(
      machine.tools?.vddSettingsPath,
      profilesDoc.profiles,
      profilesDoc.vddExtraResolutions || []
    );
    const sunshinePreview = previewSunshineSync(ROOT_DIR, machine.tools?.sunshineAppsPath, profilesDoc.profiles);
    const sunshineService = await getSunshineServiceStatus();

    const cfgCount = fs.existsSync(paths.cfgDir)
      ? fs.readdirSync(paths.cfgDir).filter((f) => f.endsWith('.cfg')).length
      : 0;
    const wrapperCount = fs.existsSync(paths.wrappersDir)
      ? fs.readdirSync(paths.wrappersDir).filter((f) => f.endsWith('.bat')).length
      : 0;

    return sendJson(res, 200, {
      ok: true,
      rootDir: ROOT_DIR,
      tools: {
        multiMonitorToolExists: Boolean(resolvedMmt && fs.existsSync(resolvedMmt)),
        multiMonitorToolPath: resolvedMmt,
        vddSettingsExists: vddCheck.exists,
        vddSettingsPath: machine.tools?.vddSettingsPath || '',
        sunshineAppsExists: sunshinePreview.exists,
        sunshineAppsPath: machine.tools?.sunshineAppsPath || '',
        rtssEnabled: Boolean(machine.rtss?.enabled),
        rtssProfileExists: Boolean(machine.rtss?.profilePath && fs.existsSync(machine.rtss.profilePath)),
      },
      monitors: {
        physicalCount: (machine.monitors?.physical || []).length,
        hasVirtualMonitorId: Boolean(machine.monitors?.virtual?.monitorId),
      },
      profiles: {
        total: profilesDoc.profiles.length,
        enabled: profilesDoc.profiles.filter((p) => p.enabled !== false).length,
        generatedCfgs: cfgCount,
        generatedWrappers: wrapperCount,
      },
      vdd: {
        existingCount: vddCheck.existing.length,
        requiredCount: vddCheck.required.length,
        missingResolutions: vddCheck.missing,
      },
      sunshine: {
        serviceStatus: sunshineService.status,
        serviceExists: sunshineService.exists,
        currentAppsCount: sunshinePreview.currentCount,
        plannedAppsCount: sunshinePreview.nextCount,
        pendingChangesCount: sunshinePreview.added.length + sunshinePreview.removed.length,
      },
    });
  }

  if (req.method === 'GET' && pathname === '/api/machine') {
    return sendJson(res, 200, { ok: true, machine });
  }

  if (req.method === 'PUT' && pathname === '/api/machine') {
    const body = await readRequestBody(req);
    const nextMachine = body.machine || body;
    writeJson(paths.machinePath, nextMachine);
    return sendJson(res, 200, { ok: true, machine: nextMachine });
  }

  if (req.method === 'POST' && pathname === '/api/machine/import-pc-cfg') {
    const body = await readRequestBody(req);
    const cfgPath = String(body.pcCfgPath || '').trim();
    if (!cfgPath || !fs.existsSync(cfgPath)) {
      return sendJson(res, 400, { ok: false, error: `找不到指定的 .cfg 檔案: ${cfgPath}` });
    }
    const imported = importMonitorsFromPcCfg(cfgPath, machine);
    if (imported.physical.length === 0) {
      return sendJson(res, 400, { ok: false, error: '未從此 .cfg 偵測到有效的 MonitorID' });
    }
    machine.monitors = {
      physical: imported.physical,
      virtual: imported.virtual || machine.monitors.virtual,
    };
    writeJson(paths.machinePath, machine);
    return sendJson(res, 200, { ok: true, machine });
  }

  if (req.method === 'POST' && pathname === '/api/machine/detect') {
    const body = await readRequestBody(req);
    const mmtPath = resolveToolPath(ROOT_DIR, machine.tools?.multiMonitorToolPath);
    const detected = await runDetectMonitors(ROOT_DIR, fs.existsSync(mmtPath) ? mmtPath : '');
    if (body.apply && Array.isArray(detected.monitors) && detected.monitors.length > 0) {
      const physical = detected.monitors.filter((m) => !m.isVirtual).map((m, idx) => ({
        id: m.isPrimary ? 'primary-monitor' : `physical-${idx + 1}`,
        label: m.monitorName || (m.isPrimary ? '主實體螢幕' : `副實體螢幕 ${idx + 1}`),
        name: m.name,
        monitorId: m.monitorId,
        serialNumber: m.serialNumber || '',
        isPrimary: Boolean(m.isPrimary),
        bitsPerPixel: m.bitsPerPixel || 32,
        width: m.width || 1920,
        height: m.height || 1080,
        displayFlags: 0,
        displayFrequency: m.displayFrequency || 60,
        displayOrientation: 0,
        positionX: m.positionX || 0,
        positionY: m.positionY || 0,
      }));
      const virt = detected.monitors.find((m) => m.isVirtual);
      if (physical.length > 0) {
        machine.monitors.physical = physical;
      }
      if (virt) {
        machine.monitors.virtual = {
          label: virt.monitorName || 'Virtual Display Driver (MTT VDD)',
          name: virt.name,
          monitorId: virt.monitorId,
          serialNumber: virt.serialNumber || '',
          displayFlags: 0,
          displayOrientation: 0,
          positionX: 0,
          positionY: 0,
        };
      }
      writeJson(paths.machinePath, machine);
    }
    return sendJson(res, 200, { ...detected, machine });
  }

  if (req.method === 'GET' && pathname === '/api/profiles') {
    return sendJson(res, 200, { ok: true, ...profilesDoc });
  }

  if (req.method === 'PUT' && pathname === '/api/profiles') {
    const body = await readRequestBody(req);
    const list = Array.isArray(body.profiles) ? body.profiles.map((p) => sanitizeProfile(p)) : [];
    profilesDoc.profiles = list;
    if (Array.isArray(body.vddExtraResolutions)) {
      profilesDoc.vddExtraResolutions = body.vddExtraResolutions;
    }
    writeJson(paths.profilesPath, profilesDoc);
    return sendJson(res, 200, { ok: true, ...profilesDoc });
  }

  if (req.method === 'POST' && pathname === '/api/profiles') {
    const body = await readRequestBody(req);
    const clean = sanitizeProfile(body);
    if (!clean.imagePath) {
      clean.imagePath = getCoverRelativePath(ROOT_DIR, clean);
    }
    const idx = profilesDoc.profiles.findIndex((p) => p.id === clean.id);
    if (idx >= 0) {
      profilesDoc.profiles[idx] = clean;
    } else {
      profilesDoc.profiles.push(clean);
    }
    if (clean.imagePath.startsWith('local/covers/') || !fs.existsSync(path.resolve(ROOT_DIR, clean.imagePath))) {
      await renderCoverPng(clean, path.resolve(ROOT_DIR, clean.imagePath));
    }
    writeJson(paths.profilesPath, profilesDoc);
    return sendJson(res, 200, { ok: true, profile: clean, profiles: profilesDoc.profiles });
  }

  if (req.method === 'POST' && pathname === '/api/covers/generate') {
    const body = await readRequestBody(req);
    const targetList = body.profileId
      ? profilesDoc.profiles.filter((p) => p.id === body.profileId)
      : profilesDoc.profiles;
    if (targetList.length === 0) {
      return sendJson(res, 404, { ok: false, error: '找不到指定的 Profile' });
    }
    const results = await generateAllCovers(ROOT_DIR, targetList, { concurrency: 4 });
    const byId = new Map(results.map((r) => [r.id, r.relativePath]));
    for (const p of profilesDoc.profiles) {
      if (byId.has(p.id) && !p.imagePath) {
        p.imagePath = byId.get(p.id);
      }
    }
    writeJson(paths.profilesPath, profilesDoc);
    return sendJson(res, 200, { ok: true, count: results.length, generatedAt: Date.now() });
  }

  if (req.method === 'POST' && pathname === '/api/profiles/reset-presets') {
    const presets = readJson(paths.presetProfilesPath);
    writeJson(paths.profilesPath, presets);
    return sendJson(res, 200, { ok: true, ...presets });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/profiles/')) {
    const id = decodeURIComponent(pathname.slice('/api/profiles/'.length));
    profilesDoc.profiles = profilesDoc.profiles.filter((p) => p.id !== id);
    writeJson(paths.profilesPath, profilesDoc);
    return sendJson(res, 200, { ok: true, profiles: profilesDoc.profiles });
  }

  if (req.method === 'POST' && pathname === '/api/generate') {
    const cfgs = writeAllCfgs(ROOT_DIR, machine, profilesDoc.profiles);
    const wrappers = writeAllWrappers(ROOT_DIR, profilesDoc.profiles);
    return sendJson(res, 200, { ok: true, cfgs, wrappers });
  }

  if (req.method === 'GET' && pathname === '/api/vdd/check') {
    const check = inspectVddFile(
      machine.tools?.vddSettingsPath,
      profilesDoc.profiles,
      profilesDoc.vddExtraResolutions || []
    );
    return sendJson(res, 200, {
      ok: true,
      exists: check.exists,
      path: check.path,
      existing: check.existing,
      required: check.required,
      missing: check.missing,
    });
  }

  if (req.method === 'POST' && pathname === '/api/vdd/sync') {
    const body = await readRequestBody(req);
    const check = inspectVddFile(
      machine.tools?.vddSettingsPath,
      profilesDoc.profiles,
      profilesDoc.vddExtraResolutions || []
    );
    if (!check.exists) {
      return sendJson(res, 404, { ok: false, error: `找不到 vdd_settings.xml: ${check.path}` });
    }
    const patchedXml = patchVddXml(check.xmlText, check.missing);
    const report = await applySystemSync(ROOT_DIR, {
      vddXmlText: check.missing.length > 0 ? patchedXml : null,
      vddTargetPath: check.path,
      vddPnpPattern: machine.tools?.vddPnpPattern || '*Virtual Display*',
      reloadVdd: body.reloadVdd !== false,
    });
    return sendJson(res, 200, { ok: true, addedCount: check.missing.length, added: check.missing, report });
  }

  if (req.method === 'GET' && pathname === '/api/sunshine/preview') {
    const preview = previewSunshineSync(ROOT_DIR, machine.tools?.sunshineAppsPath, profilesDoc.profiles);
    return sendJson(res, 200, { ok: true, ...preview });
  }

  if (req.method === 'POST' && pathname === '/api/sunshine/sync') {
    const body = await readRequestBody(req);
    for (const p of profilesDoc.profiles) {
      if (p.enabled !== false && (!p.imagePath || ((p.imagePath.includes('/') || p.imagePath.includes('\\')) && !fs.existsSync(path.resolve(ROOT_DIR, p.imagePath))))) {
        p.imagePath = p.imagePath || getCoverRelativePath(ROOT_DIR, p);
        await renderCoverPng(p, path.resolve(ROOT_DIR, p.imagePath));
      }
    }
    writeJson(paths.profilesPath, profilesDoc);
    const cfgs = writeAllCfgs(ROOT_DIR, machine, profilesDoc.profiles);
    const wrappers = writeAllWrappers(ROOT_DIR, profilesDoc.profiles);
    const preview = previewSunshineSync(ROOT_DIR, machine.tools?.sunshineAppsPath, profilesDoc.profiles);
    if (preview.validationErrors.length > 0) {
      return sendJson(res, 400, { ok: false, errors: preview.validationErrors });
    }
    const report = await applySystemSync(ROOT_DIR, {
      sunshineJsonText: preview.formattedJson,
      sunshineTargetPath: machine.tools?.sunshineAppsPath,
      restartSunshine: body.restartSunshine !== false,
    });
    return sendJson(res, 200, {
      ok: true,
      cfgsCount: cfgs.length,
      wrappersCount: wrappers.length,
      appsCount: preview.nextCount,
      report,
    });
  }

  if (req.method === 'POST' && pathname === '/api/actions/switch') {
    const body = await readRequestBody(req);
    const profileId = String(body.profileId || '').trim();
    validateProfileId(profileId);
    writeAllCfgs(ROOT_DIR, machine, profilesDoc.profiles);
    writeAllWrappers(ROOT_DIR, profilesDoc.profiles);
    const script = path.join(ROOT_DIR, 'scripts', 'Switch-Display.ps1');
    await runScriptWithOptionalElevation(script, ['-ProfileId', profileId]);
    return sendJson(res, 200, { ok: true, switchedTo: profileId });
  }

  if (req.method === 'POST' && pathname === '/api/actions/restore') {
    writeAllCfgs(ROOT_DIR, machine, profilesDoc.profiles);
    const script = path.join(ROOT_DIR, 'scripts', 'Restore-Display.ps1');
    await runScriptWithOptionalElevation(script, []);
    return sendJson(res, 200, { ok: true, restored: true });
  }

  return sendJson(res, 404, { ok: false, error: `Unknown API route: ${pathname}` });
}

function createAppServer() {
  return http.createServer(async (req, res) => {
    try {
      const urlObj = new URL(req.url, `http://${HOST}:${PORT}`);
      const pathname = decodeURIComponent(urlObj.pathname);
      if (pathname.startsWith('/api/')) {
        await handleApi(req, res, pathname);
        return;
      }
      serveStaticFile(pathname, res);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message || 'Internal error' });
    }
  });
}

if (require.main === module) {
  loadOrInitState(ROOT_DIR);
  const server = createAppServer();
  server.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.log(`Sunshine VDD Manager listening on ${url}`);
    if (process.argv.includes('--open')) {
      exec(`start "" "${url}"`);
    }
  });
}

module.exports = { createAppServer };
