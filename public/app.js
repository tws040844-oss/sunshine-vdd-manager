const state = {
  status: null,
  machine: null,
  profilesDoc: null,
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, isError = false) {
  const area = document.getElementById('toastArea');
  const el = document.createElement('div');
  el.className = `toast ${isError ? 'err' : 'ok'}`;
  el.textContent = msg;
  area.prepend(el);
  setTimeout(() => el.remove(), 5500);
}

async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body !== null) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  const data = await resp.json();
  if (!resp.ok || data.ok === false) {
    const errMsg = data.error || (data.errors ? data.errors.join('; ') : `HTTP ${resp.status}`);
    throw new Error(errMsg);
  }
  return data;
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
  if (tabName === 'vdd') loadVddCheck();
  if (tabName === 'sunshine') loadSunshinePreview();
}

function renderHeaderPills() {
  const s = state.status;
  if (!s) return;
  const pills = [];
  const svcOk = s.sunshine.serviceStatus === 'Running';
  pills.push(`<span class="pill ${svcOk ? 'ok' : 'warn'}">Sunshine: ${esc(s.sunshine.serviceStatus)}</span>`);
  pills.push(`<span class="pill ${s.tools.multiMonitorToolExists ? 'ok' : 'err'}">MultiMonitorTool: ${s.tools.multiMonitorToolExists ? '就緒' : '遺失'}</span>`);
  const miss = s.vdd.missingResolutions.length;
  pills.push(`<span class="pill ${miss === 0 ? 'ok' : 'warn'}">VDD 缺少: ${miss}</span>`);
  document.getElementById('headerPills').innerHTML = pills.join('');
}

function renderDashboard() {
  const s = state.status;
  const profiles = state.profilesDoc?.profiles || [];
  if (!s) return;

  document.getElementById('summaryCards').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">本機螢幕 / VDD</div>
      <div class="stat-value">${s.monitors.physicalCount} 實體 + ${s.monitors.hasVirtualMonitorId ? '1 虛擬' : '未設定'}</div>
      <div class="stat-sub">MMT: ${esc(s.tools.multiMonitorToolExists ? '已就緒' : '請設定路徑')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">裝置 Profile</div>
      <div class="stat-value">${s.profiles.enabled} / ${s.profiles.total} 啟用</div>
      <div class="stat-sub">已生成 .cfg: ${s.profiles.generatedCfgs} 份 / .bat: ${s.profiles.generatedWrappers} 份</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">VDD XML 解析度</div>
      <div class="stat-value">${s.vdd.existingCount} 已載入</div>
      <div class="stat-sub">缺少 ${s.vdd.missingResolutions.length} 組</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Sunshine 同步狀態</div>
      <div class="stat-value">${s.sunshine.currentAppsCount} → ${s.sunshine.plannedAppsCount} 項</div>
      <div class="stat-sub">RTSS: ${s.tools.rtssEnabled ? '已啟用' : '選配停用'}</div>
    </div>
  `;

  const enabled = profiles.filter((p) => p.enabled !== false && p.mode !== 'passthrough');
  document.getElementById('quickSwitchGrid').innerHTML = enabled.map((p) => `
    <div class="quick-item">
      <div>
        <div class="quick-title">${esc(p.name)}</div>
        <div class="quick-meta">
          <span class="badge ${p.tier === 'efficiency' ? 'eff' : (p.tier === 'performance' ? 'perf' : '')}">${esc(p.tier)}</span>
          <span class="badge ${p.orientation === 'portrait' ? 'port' : 'land'}">${p.width}×${p.height} (${p.orientation === 'portrait' ? '直向' : '橫向'})</span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="triggerSwitch('${esc(p.id)}')">▶ 測試切換此解析度</button>
    </div>
  `).join('');
}

function tierBadge(tier) {
  if (tier === 'efficiency') return '<span class="badge eff">效率版</span>';
  if (tier === 'performance') return '<span class="badge perf">效能版</span>';
  if (tier === 'native') return '<span class="badge">原生</span>';
  return '<span class="badge">標準</span>';
}

function renderProfilesTable() {
  const cat = document.getElementById('filterCategory').value;
  const tier = document.getElementById('filterTier').value;
  const profiles = state.profilesDoc?.profiles || [];

  const filtered = profiles.filter((p) => {
    if (cat !== 'ALL' && p.category !== cat) return false;
    if (tier !== 'ALL' && p.tier !== tier) return false;
    return true;
  });

  document.getElementById('profilesTableBody').innerHTML = filtered.map((p) => {
    const isPort = p.height > p.width;
    const hasAutoRes = /\d{3,4}\s*[×x]\s*\d{3,4}/.test(p.name);
    return `
      <tr>
        <td><input type="checkbox" ${p.enabled !== false ? 'checked' : ''} onchange="toggleProfileEnabled('${esc(p.id)}', this.checked)"></td>
        <td>
          <strong>${esc(p.name)}</strong>
          ${hasAutoRes ? '<span class="badge auto" title="Moonlight KATO v0.6 會自動讀取此尺寸">KATO 自動套用</span>' : ''}
          <div class="muted">${esc(p.notes || p.id)}</div>
        </td>
        <td>
          <div>${esc(p.device)}</div>
          ${tierBadge(p.tier)}
        </td>
        <td>
          <div><code>${p.width}×${p.height}</code> @ ${p.refreshRate}Hz</div>
          <span class="badge ${isPort ? 'port' : 'land'}">${isPort ? '直向 Portrait' : '橫向 Landscape'}</span>
        </td>
        <td><code>${esc(p.mode)}</code></td>
        <td>
          <div class="btn-row">
            ${p.mode !== 'passthrough' ? `<button class="btn btn-secondary btn-sm" onclick="swapProfileOrientation('${esc(p.id)}')">🔄 互換橫直</button>` : ''}
            <button class="btn btn-secondary btn-sm" onclick="openProfileModal('${esc(p.id)}')">編輯</button>
            <button class="btn btn-secondary btn-sm" onclick="cloneProfile('${esc(p.id)}')">複製</button>
            <button class="btn btn-danger btn-sm" onclick="deleteProfile('${esc(p.id)}')">刪除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderMachineForm() {
  const m = state.machine;
  if (!m) return;
  document.getElementById('toolMmtPath').value = m.tools?.multiMonitorToolPath || '';
  document.getElementById('toolVddPath').value = m.tools?.vddSettingsPath || '';
  document.getElementById('toolSunshinePath').value = m.tools?.sunshineAppsPath || '';
  document.getElementById('toolVddPattern').value = m.tools?.vddPnpPattern || '*Virtual Display*';

  document.getElementById('rtssEnabled').checked = Boolean(m.rtss?.enabled);
  document.getElementById('rtssRestoreFps').value = m.rtss?.restoreFps ?? 120;
  document.getElementById('rtssProfilePath').value = m.rtss?.profilePath || '';
  document.getElementById('rtssShortcutPath').value = m.rtss?.shortcutPath || '';

  const physicalHtml = (m.monitors?.physical || []).map((mon, idx) => `
    <div class="monitor-box" data-phy-idx="${idx}">
      <div class="monitor-box-head">
        <strong>實體螢幕 #${idx + 1}：${esc(mon.label || mon.name)}</strong>
        <label class="checkbox-inline">
          <input type="radio" name="primaryMonitor" ${mon.isPrimary ? 'checked' : ''} data-field="isPrimary"> 設為主螢幕
        </label>
      </div>
      <div class="form-grid">
        <label>Display Name <input type="text" data-field="name" value="${esc(mon.name)}"></label>
        <label>MonitorID <input type="text" data-field="monitorId" value="${esc(mon.monitorId)}"></label>
        <label>SerialNumber <input type="text" data-field="serialNumber" value="${esc(mon.serialNumber || '')}"></label>
        <label>寬 × 高 / Hz
          <div class="btn-row">
            <input type="number" data-field="width" value="${mon.width}" style="width:90px">
            <input type="number" data-field="height" value="${mon.height}" style="width:90px">
            <input type="number" data-field="displayFrequency" value="${mon.displayFrequency}" style="width:75px">
          </div>
        </label>
        <label>Position X / Y
          <div class="btn-row">
            <input type="number" data-field="positionX" value="${mon.positionX}" style="width:100px">
            <input type="number" data-field="positionY" value="${mon.positionY}" style="width:100px">
          </div>
        </label>
      </div>
    </div>
  `).join('');

  const virt = m.monitors?.virtual || {};
  const virtualHtml = `
    <div class="monitor-box" id="virtualMonitorBox">
      <div class="monitor-box-head"><strong>虛擬顯示器 (MTT VDD)</strong></div>
      <div class="form-grid">
        <label>Display Name <input type="text" id="virtName" value="${esc(virt.name || '\\\\.\\DISPLAY6')}"></label>
        <label>MonitorID <input type="text" id="virtMonitorId" value="${esc(virt.monitorId || '')}"></label>
        <label>SerialNumber <input type="text" id="virtSerial" value="${esc(virt.serialNumber || '')}"></label>
      </div>
    </div>
  `;

  document.getElementById('monitorsEditor').innerHTML = physicalHtml + virtualHtml;
}

async function refreshAll() {
  try {
    const [status, machineResp, profilesResp] = await Promise.all([
      api('/api/status'),
      api('/api/machine'),
      api('/api/profiles'),
    ]);
    state.status = status;
    state.machine = machineResp.machine;
    state.profilesDoc = profilesResp;
    renderHeaderPills();
    renderDashboard();
    renderProfilesTable();
    renderMachineForm();
  } catch (err) {
    showToast(`載入失敗：${err.message}`, true);
  }
}

async function saveProfilesToServer() {
  const data = await api('/api/profiles', 'PUT', {
    profiles: state.profilesDoc.profiles,
    vddExtraResolutions: state.profilesDoc.vddExtraResolutions,
  });
  state.profilesDoc = data;
  await api('/api/generate', 'POST', {});
  await refreshAll();
}

window.toggleProfileEnabled = (id, checked) => {
  const p = state.profilesDoc.profiles.find((item) => item.id === id);
  if (p) p.enabled = checked;
};

window.swapProfileOrientation = async (id) => {
  const p = state.profilesDoc.profiles.find((item) => item.id === id);
  if (!p) return;
  const oldW = p.width;
  const oldH = p.height;
  p.width = oldH;
  p.height = oldW;
  p.orientation = p.width >= p.height ? 'landscape' : 'portrait';
  p.name = p.name
    .replace(`${oldW}×${oldH}`, `${p.width}×${p.height}`)
    .replace(`${oldW}x${oldH}`, `${p.width}x${p.height}`);
  if (p.orientation === 'portrait') {
    p.name = p.name.replace('展開橫向', '展開直向');
  } else {
    p.name = p.name.replace('展開直向', '展開橫向');
  }
  await saveProfilesToServer();
  showToast(`已切換橫直向：${p.name}`);
};

window.deleteProfile = async (id) => {
  if (!confirm(`確定刪除 Profile「${id}」？`)) return;
  await api(`/api/profiles/${encodeURIComponent(id)}`, 'DELETE');
  await refreshAll();
  showToast(`已刪除 ${id}`);
};

window.cloneProfile = (id) => {
  const p = state.profilesDoc.profiles.find((item) => item.id === id);
  if (!p) return;
  openProfileModal(null, { ...p, id: `${p.id}-copy`, name: `${p.name} (複製)` });
};

window.openProfileModal = (id, presetOverride = null) => {
  const modal = document.getElementById('profileModal');
  const p = presetOverride || state.profilesDoc.profiles.find((item) => item.id === id) || {
    id: '',
    name: '',
    category: 'Desktop',
    device: 'Galaxy Z Fold 8 Ultra',
    tier: 'efficiency',
    mode: 'vdd',
    width: 2184,
    height: 1968,
    refreshRate: 60,
    rtssFps: 60,
    cmd: '',
    imagePath: 'desktop.png',
    waitAll: false,
    enabled: true,
    notes: '',
  };

  document.getElementById('modalTitle').textContent = id ? `編輯 Profile：${id}` : '新增 / 複製 Profile';
  document.getElementById('pfOriginalId').value = id || '';
  document.getElementById('pfId').value = p.id;
  document.getElementById('pfName').value = p.name;
  document.getElementById('pfCategory').value = p.category || 'Desktop';
  document.getElementById('pfDevice').value = p.device || 'Custom';
  document.getElementById('pfTier').value = p.tier || 'standard';
  document.getElementById('pfMode').value = p.mode || 'vdd';
  document.getElementById('pfWidth').value = p.width;
  document.getElementById('pfHeight').value = p.height;
  document.getElementById('pfHz').value = p.refreshRate || 60;
  document.getElementById('pfRtssFps').value = p.rtssFps ?? 60;
  document.getElementById('pfCmd').value = p.cmd || '';
  document.getElementById('pfImagePath').value = p.imagePath || '';
  document.getElementById('pfWaitAll').checked = Boolean(p.waitAll);
  document.getElementById('pfEnabled').checked = p.enabled !== false;
  document.getElementById('pfNotes').value = p.notes || '';
  modal.classList.remove('hidden');
};

window.triggerSwitch = async (profileId) => {
  try {
    showToast(`正在切換至 ${profileId}...（如跳出 UAC 請確認）`);
    await api('/api/actions/switch', 'POST', { profileId });
    showToast(`已切換顯示器至 ${profileId}`);
  } catch (err) {
    showToast(`切換失敗：${err.message}`, true);
  }
};

async function loadVddCheck() {
  const el = document.getElementById('vddCheckResult');
  try {
    const data = await api('/api/vdd/check');
    if (!data.exists) {
      el.innerHTML = `<p class="muted">找不到 <code>${esc(data.path)}</code>，請先至「本機硬體精靈」確認路徑。</p>`;
      return;
    }
    const missingHtml = data.missing.length === 0
      ? '<span class="badge auto">✅ 所有需要的解析度都已存在於 vdd_settings.xml</span>'
      : data.missing.map((r) => `<span class="badge port">缺少 ${r.width}×${r.height}</span>`).join(' ');

    el.innerHTML = `
      <p>檔案路徑：<code>${esc(data.path)}</code></p>
      <div style="margin: 12px 0;">${missingHtml}</div>
      <div class="diff-grid">
        <div class="diff-box">
          <h4>目前 XML 已登錄 (${data.existing.length})</h4>
          <ul>${data.existing.map((r) => `<li><code>${r.width}×${r.height}</code> (${r.refreshRate}Hz)</li>`).join('')}</ul>
        </div>
        <div class="diff-box">
          <h4>Profiles 需求清單 (${data.required.length})</h4>
          <ul>${data.required.map((r) => `<li><code>${r.width}×${r.height}</code> — ${esc(r.sources[0])}</li>`).join('')}</ul>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<p class="toast err">${esc(err.message)}</p>`;
  }
}

async function loadSunshinePreview() {
  const el = document.getElementById('sunshinePreviewArea');
  try {
    const p = await api('/api/sunshine/preview');
    el.innerHTML = `
      <p>目標檔案：<code>${esc(p.path)}</code> ｜ 目前 <strong>${p.currentCount}</strong> 項 → 同步後 <strong>${p.nextCount}</strong> 項</p>
      <div class="diff-grid">
        <div class="diff-box">
          <h4>➕ 新增項目 (${p.added.length})</h4>
          <ul>${p.added.map((n) => `<li>${esc(n)}</li>`).join('') || '<li class="muted">無</li>'}</ul>
        </div>
        <div class="diff-box">
          <h4>♻️ 保留／更新項目 (${p.kept.length})</h4>
          <ul>${p.kept.map((n) => `<li>${esc(n)}</li>`).join('') || '<li class="muted">無</li>'}</ul>
        </div>
        <div class="diff-box">
          <h4>➖ 將被取代移除 (${p.removed.length})</h4>
          <ul>${p.removed.map((n) => `<li>${esc(n)}</li>`).join('') || '<li class="muted">無</li>'}</ul>
        </div>
      </div>
      <details>
        <summary style="cursor:pointer; margin-bottom:8px;">檢視完整 apps.json 輸出內容</summary>
        <pre class="json-preview">${esc(p.formattedJson)}</pre>
      </details>
    `;
  } catch (err) {
    el.innerHTML = `<p class="toast err">${esc(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('btnEmergencyRestore').addEventListener('click', async () => {
    try {
      showToast('正在還原實體雙螢幕並停用虛擬螢幕...');
      await api('/api/actions/restore', 'POST', {});
      showToast('已還原實體雙螢幕配置！');
    } catch (err) {
      showToast(`還原失敗：${err.message}`, true);
    }
  });

  document.getElementById('btnDashRefresh').addEventListener('click', refreshAll);
  document.getElementById('btnDashGenerate').addEventListener('click', async () => {
    try {
      const res = await api('/api/generate', 'POST', {});
      showToast(`已生成 ${res.cfgs.length} 份 .cfg 與 ${res.wrappers.length} 份 .bat`);
      await refreshAll();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('filterCategory').addEventListener('change', renderProfilesTable);
  document.getElementById('filterTier').addEventListener('change', renderProfilesTable);
  document.getElementById('btnAddProfile').addEventListener('click', () => openProfileModal(null));
  document.getElementById('btnSaveAllProfiles').addEventListener('click', async () => {
    try {
      await saveProfilesToServer();
      showToast('已儲存 Profile 並更新 .cfg / .bat');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('btnResetPresets').addEventListener('click', async () => {
    if (!confirm('確定要還原成內建預設清單（包含 Fold 8 Ultra 效率/效能/橫直向）嗎？')) return;
    await api('/api/profiles/reset-presets', 'POST', {});
    await api('/api/generate', 'POST', {});
    await refreshAll();
    showToast('已還原為預設裝置清單');
  });

  document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('profileModal').classList.add('hidden');
  });
  document.getElementById('btnSwapDimsModal').addEventListener('click', () => {
    const w = document.getElementById('pfWidth').value;
    const h = document.getElementById('pfHeight').value;
    document.getElementById('pfWidth').value = h;
    document.getElementById('pfHeight').value = w;
  });

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const origId = document.getElementById('pfOriginalId').value;
      const payload = {
        id: document.getElementById('pfId').value.trim(),
        name: document.getElementById('pfName').value.trim(),
        category: document.getElementById('pfCategory').value,
        device: document.getElementById('pfDevice').value.trim(),
        tier: document.getElementById('pfTier').value,
        mode: document.getElementById('pfMode').value,
        width: Number(document.getElementById('pfWidth').value),
        height: Number(document.getElementById('pfHeight').value),
        refreshRate: Number(document.getElementById('pfHz').value),
        rtssFps: Number(document.getElementById('pfRtssFps').value),
        cmd: document.getElementById('pfCmd').value.trim(),
        imagePath: document.getElementById('pfImagePath').value.trim(),
        waitAll: document.getElementById('pfWaitAll').checked,
        enabled: document.getElementById('pfEnabled').checked,
        notes: document.getElementById('pfNotes').value.trim(),
      };
      if (origId && origId !== payload.id) {
        await api(`/api/profiles/${encodeURIComponent(origId)}`, 'DELETE');
      }
      await api('/api/profiles', 'POST', payload);
      await api('/api/generate', 'POST', {});
      document.getElementById('profileModal').classList.add('hidden');
      await refreshAll();
      showToast(`已儲存 ${payload.name}`);
    } catch (err) {
      showToast(err.message, true);
    }
  });

  document.getElementById('btnDetectMonitors').addEventListener('click', async () => {
    try {
      const data = await api('/api/machine/detect', 'POST', { apply: false });
      const box = document.getElementById('detectPreviewArea');
      box.classList.remove('hidden');
      box.innerHTML = `
        <div class="card-header">
          <strong>偵測到 ${data.monitors.length} 台活躍顯示器（VDD ${data.vddPresent ? (data.vddEnabled ? '已啟用' : '已停用') : '未偵測到'}）</strong>
          <button id="btnApplyDetected" class="btn btn-primary btn-sm">✅ 套用偵測結果到本機設定</button>
        </div>
        <ul>${data.monitors.map((m) => `<li><code>${esc(m.name)}</code> | <code>${esc(m.monitorId)}</code> | ${m.width}×${m.height}@${m.displayFrequency}Hz ${m.isVirtual ? '(VDD)' : (m.isPrimary ? '(主螢幕)' : '')}</li>`).join('')}</ul>
      `;
      document.getElementById('btnApplyDetected').addEventListener('click', async () => {
        await api('/api/machine/detect', 'POST', { apply: true });
        await refreshAll();
        showToast('已套用自動偵測的螢幕設定');
      });
    } catch (err) {
      showToast(`偵測失敗：${err.message}`, true);
    }
  });

  document.getElementById('btnImportPcCfg').addEventListener('click', async () => {
    try {
      const pcCfgPath = document.getElementById('inputPcCfgPath').value.trim();
      await api('/api/machine/import-pc-cfg', 'POST', { pcCfgPath });
      await api('/api/generate', 'POST', {});
      await refreshAll();
      showToast('已成功從 PC.cfg 匯入硬體 MonitorID 並重新生成 .cfg');
    } catch (err) {
      showToast(`匯入失敗：${err.message}`, true);
    }
  });

  document.getElementById('btnSaveMachine').addEventListener('click', async () => {
    try {
      const m = structuredClone(state.machine);
      m.tools = {
        multiMonitorToolPath: document.getElementById('toolMmtPath').value.trim(),
        vddSettingsPath: document.getElementById('toolVddPath').value.trim(),
        sunshineAppsPath: document.getElementById('toolSunshinePath').value.trim(),
        vddPnpPattern: document.getElementById('toolVddPattern').value.trim() || '*Virtual Display*',
      };
      m.rtss = {
        enabled: document.getElementById('rtssEnabled').checked,
        restoreFps: Number(document.getElementById('rtssRestoreFps').value || 120),
        profilePath: document.getElementById('rtssProfilePath').value.trim(),
        shortcutPath: document.getElementById('rtssShortcutPath').value.trim(),
      };
      document.querySelectorAll('[data-phy-idx]').forEach((box) => {
        const idx = Number(box.dataset.phyIdx);
        const mon = m.monitors.physical[idx];
        mon.name = box.querySelector('[data-field="name"]').value.trim();
        mon.monitorId = box.querySelector('[data-field="monitorId"]').value.trim();
        mon.serialNumber = box.querySelector('[data-field="serialNumber"]').value.trim();
        mon.isPrimary = box.querySelector('[data-field="isPrimary"]').checked;
        mon.width = Number(box.querySelector('[data-field="width"]').value);
        mon.height = Number(box.querySelector('[data-field="height"]').value);
        mon.displayFrequency = Number(box.querySelector('[data-field="displayFrequency"]').value);
        mon.positionX = Number(box.querySelector('[data-field="positionX"]').value);
        mon.positionY = Number(box.querySelector('[data-field="positionY"]').value);
      });
      m.monitors.virtual = {
        ...(m.monitors.virtual || {}),
        name: document.getElementById('virtName').value.trim(),
        monitorId: document.getElementById('virtMonitorId').value.trim(),
        serialNumber: document.getElementById('virtSerial').value.trim(),
      };
      await api('/api/machine', 'PUT', { machine: m });
      await api('/api/generate', 'POST', {});
      await refreshAll();
      showToast('已儲存本機硬體與路徑設定並重建全部 .cfg / .bat');
    } catch (err) {
      showToast(`儲存失敗：${err.message}`, true);
    }
  });

  document.getElementById('btnCheckVdd').addEventListener('click', loadVddCheck);
  document.getElementById('btnSyncVdd').addEventListener('click', async () => {
    try {
      showToast('正在更新 vdd_settings.xml 並重載虛擬顯示卡（若跳出 UAC 請確認）...');
      const res = await api('/api/vdd/sync', 'POST', { reloadVdd: true });
      showToast(`VDD 同步完成！新增 ${res.addedCount} 組解析度。`);
      await loadVddCheck();
      await refreshAll();
    } catch (err) {
      showToast(`VDD 同步失敗：${err.message}`, true);
    }
  });

  document.getElementById('btnPreviewSunshine').addEventListener('click', loadSunshinePreview);
  document.getElementById('btnSyncSunshine').addEventListener('click', async () => {
    try {
      showToast('正在生成 .cfg / .bat 並同步至 Sunshine apps.json（若跳出 UAC 請確認）...');
      const res = await api('/api/sunshine/sync', 'POST', { restartSunshine: true });
      showToast(`Sunshine 同步完成！共寫入 ${res.appsCount} 項設定並已重啟服務。`);
      await loadSunshinePreview();
      await refreshAll();
    } catch (err) {
      showToast(`Sunshine 同步失敗：${err.message}`, true);
    }
  });

  refreshAll();
});
