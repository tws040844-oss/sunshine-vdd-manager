const fs = require('fs');

function parseVddResolutions(xmlText) {
  const list = [];
  const blockRegex = /<resolution>([\s\S]*?)<\/resolution>/gi;
  let match;
  while ((match = blockRegex.exec(xmlText)) !== null) {
    const inner = match[1];
    const wMatch = inner.match(/<width>\s*(\d+)\s*<\/width>/i);
    const hMatch = inner.match(/<height>\s*(\d+)\s*<\/height>/i);
    const rMatch = inner.match(/<refresh_rate>\s*(\d+)\s*<\/refresh_rate>/i);
    if (wMatch && hMatch) {
      list.push({
        width: Number.parseInt(wMatch[1], 10),
        height: Number.parseInt(hMatch[1], 10),
        refreshRate: rMatch ? Number.parseInt(rMatch[1], 10) : 30,
      });
    }
  }
  return list;
}

function collectRequiredResolutions(profiles, extraResolutions = []) {
  const map = new Map();
  for (const p of profiles) {
    if (!p.enabled || p.mode !== 'vdd') continue;
    const key = `${p.width}x${p.height}`;
    if (!map.has(key)) {
      map.set(key, {
        width: Number(p.width),
        height: Number(p.height),
        refreshRate: 30,
        sources: [p.name || p.id],
      });
    } else {
      map.get(key).sources.push(p.name || p.id);
    }
  }
  for (const extra of extraResolutions) {
    const key = `${extra.width}x${extra.height}`;
    if (!map.has(key)) {
      map.set(key, {
        width: Number(extra.width),
        height: Number(extra.height),
        refreshRate: Number(extra.refreshRate || 30),
        sources: [extra.note || 'extra'],
      });
    }
  }
  return Array.from(map.values());
}

function inspectVddXml(xmlText, profiles, extraResolutions = []) {
  const existing = parseVddResolutions(xmlText);
  const existingSet = new Set(existing.map((r) => `${r.width}x${r.height}`));
  const required = collectRequiredResolutions(profiles, extraResolutions);
  const missing = required.filter((r) => !existingSet.has(`${r.width}x${r.height}`));

  return {
    existing,
    required,
    missing,
  };
}

function patchVddXml(xmlText, missingResolutions) {
  if (!missingResolutions || missingResolutions.length === 0) {
    return xmlText;
  }

  const closeTag = '</resolutions>';
  const idx = xmlText.lastIndexOf(closeTag);
  if (idx === -1) {
    throw new Error('Could not find </resolutions> closing tag in vdd_settings.xml');
  }

  const lineBreak = xmlText.includes('\r\n') ? '\r\n' : '\n';
  const blocks = missingResolutions.map((r) => [
    '        <resolution>',
    `            <width>${Number(r.width)}</width>`,
    `            <height>${Number(r.height)}</height>`,
    `            <refresh_rate>${Number(r.refreshRate || 30)}</refresh_rate>`,
    '        </resolution>',
  ].join(lineBreak));

  const beforeClose = xmlText.slice(0, idx).replace(/[ \t]+$/, '');
  const separator = beforeClose.endsWith('\n') ? '' : lineBreak;
  const insertion = `${separator}${blocks.join(lineBreak + lineBreak)}${lineBreak}    `;
  return beforeClose + insertion + xmlText.slice(idx);
}

function inspectVddFile(vddSettingsPath, profiles, extraResolutions = []) {
  if (!vddSettingsPath || !fs.existsSync(vddSettingsPath)) {
    return { exists: false, path: vddSettingsPath, existing: [], required: [], missing: [] };
  }
  const xmlText = fs.readFileSync(vddSettingsPath, 'utf8');
  const analysis = inspectVddXml(xmlText, profiles, extraResolutions);
  return {
    exists: true,
    path: vddSettingsPath,
    xmlText,
    ...analysis,
  };
}

module.exports = {
  parseVddResolutions,
  collectRequiredResolutions,
  inspectVddXml,
  patchVddXml,
  inspectVddFile,
};
