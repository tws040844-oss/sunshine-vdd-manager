const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COVER_WIDTH = 600;
const COVER_HEIGHT = 800;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getTheme(profile) {
  const cat = (profile.category || 'Desktop').toLowerCase();
  const tier = (profile.tier || 'standard').toLowerCase();
  const id = (profile.id || '').toLowerCase();

  if (profile.mode === 'passthrough' || id === 'desktop-native') {
    return {
      bgTop: '#334155',
      bgMid: '#1e293b',
      bgBottom: '#090d16',
      accent: '#38bdf8',
      accentGlow: 'rgba(56, 189, 248, 0.35)',
      catBg: '#0284c7',
      tierBg: '#475569',
      tierText: '#f8fafc',
      modeBg: 'rgba(245, 158, 11, 0.22)',
      modeBorder: '#fbbf24',
      modeText: '#fde68a',
    };
  }
  if (id.includes('ipad')) {
    return {
      bgTop: '#c2410c',
      bgMid: '#7c2d12',
      bgBottom: '#1c0a04',
      accent: '#fb923c',
      accentGlow: 'rgba(251, 146, 60, 0.36)',
      catBg: '#4f46e5',
      tierBg: '#ea580c',
      tierText: '#ffffff',
      modeBg: 'rgba(34, 211, 238, 0.16)',
      modeBorder: '#22d3ee',
      modeText: '#cffafe',
    };
  }
  if (id.includes('iphone')) {
    const isSafe = id.includes('safe');
    return {
      bgTop: isSafe ? '#be123c' : '#9f1239',
      bgMid: '#6b0f2b',
      bgBottom: '#19050c',
      accent: '#fb7185',
      accentGlow: 'rgba(251, 113, 133, 0.36)',
      catBg: '#4f46e5',
      tierBg: isSafe ? '#e11d48' : '#db2777',
      tierText: '#ffffff',
      modeBg: 'rgba(34, 211, 238, 0.16)',
      modeBorder: '#22d3ee',
      modeText: '#cffafe',
    };
  }
  if (profile.mode === 'physical-primary' || id.includes('2k-physical')) {
    return {
      bgTop: '#15803d',
      bgMid: '#14532d',
      bgBottom: '#041c0d',
      accent: '#4ade80',
      accentGlow: 'rgba(74, 222, 128, 0.36)',
      catBg: '#4f46e5',
      tierBg: '#16a34a',
      tierText: '#ffffff',
      modeBg: 'rgba(74, 222, 128, 0.2)',
      modeBorder: '#4ade80',
      modeText: '#dcfce7',
    };
  }
  if (id.includes('4k-tv')) {
    return {
      bgTop: '#b91c1c',
      bgMid: '#7f1d1d',
      bgBottom: '#1c0606',
      accent: '#f87171',
      accentGlow: 'rgba(248, 113, 113, 0.38)',
      catBg: '#4f46e5',
      tierBg: '#d97706',
      tierText: '#ffffff',
      modeBg: 'rgba(34, 211, 238, 0.16)',
      modeBorder: '#22d3ee',
      modeText: '#cffafe',
    };
  }
  if (id.includes('cover')) {
    return cat === 'desktop'
      ? {
          bgTop: '#047857',
          bgMid: '#064e3b',
          bgBottom: '#021c15',
          accent: '#34d399',
          accentGlow: 'rgba(52, 211, 153, 0.35)',
          catBg: '#0284c7',
          tierBg: '#0d9488',
          tierText: '#ffffff',
          modeBg: 'rgba(34, 211, 238, 0.16)',
          modeBorder: '#22d3ee',
          modeText: '#cffafe',
        }
      : {
          bgTop: '#0e7490',
          bgMid: '#164e63',
          bgBottom: '#061923',
          accent: '#22d3ee',
          accentGlow: 'rgba(34, 211, 238, 0.35)',
          catBg: '#4f46e5',
          tierBg: '#0891b2',
          tierText: '#ffffff',
          modeBg: 'rgba(34, 211, 238, 0.16)',
          modeBorder: '#22d3ee',
          modeText: '#cffafe',
        };
  }
  if (tier === 'efficiency') {
    return cat === 'desktop'
      ? {
          bgTop: '#0369a1',
          bgMid: '#0c4a6e',
          bgBottom: '#051b2c',
          accent: '#38bdf8',
          accentGlow: 'rgba(56, 189, 248, 0.38)',
          catBg: '#0284c7',
          tierBg: '#10b981',
          tierText: '#042f2e',
          modeBg: 'rgba(34, 211, 238, 0.16)',
          modeBorder: '#22d3ee',
          modeText: '#cffafe',
        }
      : {
          bgTop: '#1d4ed8',
          bgMid: '#1e3a8a',
          bgBottom: '#09112b',
          accent: '#60a5fa',
          accentGlow: 'rgba(96, 165, 250, 0.38)',
          catBg: '#4f46e5',
          tierBg: '#10b981',
          tierText: '#042f2e',
          modeBg: 'rgba(34, 211, 238, 0.16)',
          modeBorder: '#22d3ee',
          modeText: '#cffafe',
        };
  }
  if (tier === 'performance') {
    return cat === 'desktop'
      ? {
          bgTop: '#4338ca',
          bgMid: '#312e81',
          bgBottom: '#0e0c29',
          accent: '#a78bfa',
          accentGlow: 'rgba(167, 139, 250, 0.38)',
          catBg: '#0284c7',
          tierBg: '#f59e0b',
          tierText: '#1e1b4b',
          modeBg: 'rgba(34, 211, 238, 0.16)',
          modeBorder: '#22d3ee',
          modeText: '#cffafe',
        }
      : {
          bgTop: '#7e22ce',
          bgMid: '#581c87',
          bgBottom: '#150624',
          accent: '#c084fc',
          accentGlow: 'rgba(192, 132, 252, 0.40)',
          catBg: '#4f46e5',
          tierBg: '#f59e0b',
          tierText: '#1e1b4b',
          modeBg: 'rgba(34, 211, 238, 0.16)',
          modeBorder: '#22d3ee',
          modeText: '#cffafe',
        };
  }

  return {
    bgTop: '#1e40af',
    bgMid: '#1e293b',
    bgBottom: '#090d16',
    accent: '#38bdf8',
    accentGlow: 'rgba(56, 189, 248, 0.35)',
    catBg: cat === 'desktop' ? '#0284c7' : '#4f46e5',
    tierBg: '#64748b',
    tierText: '#ffffff',
    modeBg: 'rgba(34, 211, 238, 0.16)',
    modeBorder: '#22d3ee',
    modeText: '#cffafe',
  };
}

function describeProfileVisual(profile) {
  const id = (profile.id || '').toLowerCase();
  const tier = (profile.tier || 'standard').toLowerCase();
  const isSteam = (profile.category || '').toLowerCase() === 'steam';
  const catLabel = isSteam ? 'STEAM' : 'DESKTOP';

  let modeText = '⚡ VDD 關實體雙螢幕';
  if (profile.mode === 'passthrough') {
    modeText = '🖥️ 保留實體雙螢幕';
  } else if (profile.mode === 'physical-primary') {
    modeText = '🖥️ 單留主螢幕・關副螢幕';
  }

  let tierLabel = '標準';
  let iconType = profile.height > profile.width ? 'fold-portrait' : 'fold-landscape';
  let mainTitle = profile.height > profile.width ? '直向串流' : '橫向串流';
  let subtitle = profile.device || '自訂裝置';
  let resLabel = `${profile.width} × ${profile.height}`;

  if (id === 'desktop-native' || profile.mode === 'passthrough') {
    tierLabel = '原生';
    iconType = 'dual-monitors';
    mainTitle = '原生雙螢幕';
    subtitle = 'PC 雙實體螢幕';
    resLabel = '雙螢幕原樣';
  } else if (id.includes('fold8u-cover') || (profile.device || '').includes('Fold') && profile.width / profile.height > 2.1) {
    tierLabel = '外螢幕';
    iconType = 'fold-cover';
    mainTitle = '外螢幕閉合';
    subtitle = 'Fold8U ・ 外螢幕';
  } else if (id.includes('169') || Math.abs(profile.width / profile.height - 16 / 9) < 0.03 && (profile.device || '').includes('Fold')) {
    tierLabel = tier === 'efficiency' ? '效率版' : (tier === 'performance' ? '效能版' : '16:9');
    iconType = 'fold-169';
    mainTitle = '16:9 寬幕';
    subtitle = `Fold8U ・ ${tierLabel}`;
  } else if (id.includes('fold8u') || (profile.device || '').includes('Fold')) {
    tierLabel = tier === 'efficiency' ? '效率版' : (tier === 'performance' ? '效能版' : '標準');
    if (profile.height > profile.width) {
      iconType = 'fold-portrait';
      mainTitle = '展開直向';
    } else {
      iconType = 'fold-landscape';
      mainTitle = '展開橫向';
    }
    subtitle = `Fold8U ・ ${tierLabel}`;
  } else if (id.includes('ipad')) {
    tierLabel = '平板';
    iconType = 'ipad';
    mainTitle = 'iPad 滿版';
    subtitle = 'Apple iPad';
  } else if (id.includes('iphone15pro-safe')) {
    tierLabel = '安全區';
    iconType = 'iphone-safe';
    mainTitle = 'iPhone 安全區';
    subtitle = '避開動態島';
  } else if (id.includes('iphone15pro-full') || id.includes('iphone')) {
    tierLabel = '全螢幕';
    iconType = 'iphone-full';
    mainTitle = 'iPhone 全螢幕';
    subtitle = 'iPhone 15 Pro';
  } else if (id.includes('2k-physical') || profile.mode === 'physical-primary') {
    tierLabel = '2K 實體';
    iconType = 'monitor-2k';
    mainTitle = '2K 實體螢幕';
    subtitle = `PC 主螢幕 ${profile.refreshRate || 180}Hz`;
  } else if (id.includes('4k-tv')) {
    tierLabel = '4K UHD';
    iconType = 'tv-4k';
    mainTitle = '4K 電視';
    subtitle = '客廳大螢幕';
  }

  return {
    catLabel,
    isSteam,
    tierLabel,
    modeText,
    iconType,
    mainTitle,
    subtitle,
    resLabel,
  };
}

function buildCategoryBadgeSvg(isSteam) {
  if (isSteam) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="6" stroke="#ffffff" stroke-width="2.2"/>
      <path d="M7.5 10v4M5.5 12h4" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
      <circle cx="15.5" cy="10.8" r="1.1" fill="#ffffff"/>
      <circle cx="17.7" cy="13.1" r="1.1" fill="#ffffff"/>
    </svg>`;
  }
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="2.5" y="4" width="19" height="13" rx="2.2" stroke="#ffffff" stroke-width="2.2"/>
    <path d="M9 20h6M12 17v3" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;
}

function buildCenterDeviceSvg(iconType, accent) {
  switch (iconType) {
    case 'dual-monitors':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="18" y="48" width="132" height="88" rx="10" fill="rgba(15,23,42,0.75)" stroke="#94a3b8" stroke-width="6"/>
        <rect x="28" y="58" width="112" height="68" rx="4" fill="rgba(56,189,248,0.16)"/>
        <path d="M68 136v22M52 158h64" stroke="#94a3b8" stroke-width="6" stroke-linecap="round"/>
        <rect x="168" y="24" width="174" height="118" rx="12" fill="rgba(15,23,42,0.85)" stroke="#ffffff" stroke-width="7"/>
        <rect x="180" y="36" width="150" height="94" rx="5" fill="${accent}" fill-opacity="0.28"/>
        <text x="255" y="92" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="800" font-family="Microsoft JhengHei UI, sans-serif">主 2K</text>
        <path d="M255 142v26M220 168h70" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
      </svg>`;

    case 'fold-landscape':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="52" y="18" width="256" height="184" rx="18" fill="rgba(10,16,32,0.85)" stroke="#ffffff" stroke-width="7"/>
        <rect x="66" y="32" width="228" height="156" rx="10" fill="${accent}" fill-opacity="0.25"/>
        <line x1="180" y1="22" x2="180" y2="198" stroke="#ffffff" stroke-width="4" stroke-dasharray="10 8" stroke-opacity="0.7"/>
        <path d="M96 110H264" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <path d="M114 92L92 110L114 128M246 92L268 110L246 128" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'fold-portrait':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="96" y="10" width="168" height="200" rx="18" fill="rgba(10,16,32,0.85)" stroke="#ffffff" stroke-width="7"/>
        <rect x="110" y="24" width="140" height="172" rx="10" fill="${accent}" fill-opacity="0.25"/>
        <line x1="100" y1="110" x2="260" y2="110" stroke="#ffffff" stroke-width="4" stroke-dasharray="10 8" stroke-opacity="0.7"/>
        <path d="M180 44V176" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <path d="M162 62L180 40L198 62M162 158L180 180L198 158" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    case 'fold-169':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="52" y="18" width="256" height="184" rx="18" fill="rgba(10,16,32,0.85)" stroke="rgba(255,255,255,0.55)" stroke-width="6"/>
        <rect x="64" y="54" width="232" height="112" rx="8" fill="${accent}" fill-opacity="0.32" stroke="#ffffff" stroke-width="7"/>
        <text x="180" y="124" text-anchor="middle" fill="#ffffff" font-size="44" font-weight="900" font-family="Segoe UI, sans-serif">16:9</text>
      </svg>`;

    case 'fold-cover':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="26" y="54" width="308" height="112" rx="22" fill="rgba(10,16,32,0.88)" stroke="#ffffff" stroke-width="7"/>
        <rect x="42" y="68" width="276" height="84" rx="14" fill="${accent}" fill-opacity="0.28"/>
        <circle cx="58" cy="110" r="6" fill="#0f172a" stroke="#ffffff" stroke-width="3"/>
        <text x="190" y="122" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="800" font-family="Microsoft JhengHei UI, sans-serif">閉合外螢幕</text>
      </svg>`;

    case 'ipad':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="54" y="24" width="252" height="172" rx="18" fill="rgba(10,16,32,0.85)" stroke="#ffffff" stroke-width="7"/>
        <rect x="72" y="40" width="216" height="140" rx="8" fill="${accent}" fill-opacity="0.28"/>
        <circle cx="63" cy="110" r="4" fill="#ffffff"/>
        <text x="180" y="122" text-anchor="middle" fill="#ffffff" font-size="40" font-weight="900" font-family="Segoe UI, sans-serif">iPad</text>
      </svg>`;

    case 'iphone-full':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="34" y="46" width="292" height="128" rx="28" fill="rgba(10,16,32,0.88)" stroke="#ffffff" stroke-width="7"/>
        <rect x="46" y="58" width="268" height="104" rx="20" fill="${accent}" fill-opacity="0.32"/>
        <rect x="54" y="92" width="12" height="36" rx="6" fill="#0f172a" stroke="#ffffff" stroke-width="2.5"/>
        <text x="190" y="122" text-anchor="middle" fill="#ffffff" font-size="34" font-weight="800" font-family="Microsoft JhengHei UI, sans-serif">全螢幕滿版</text>
      </svg>`;

    case 'iphone-safe':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="34" y="46" width="292" height="128" rx="28" fill="rgba(10,16,32,0.88)" stroke="rgba(255,255,255,0.65)" stroke-width="6"/>
        <rect x="54" y="92" width="12" height="36" rx="6" fill="#ffffff"/>
        <rect x="78" y="60" width="222" height="100" rx="10" fill="${accent}" fill-opacity="0.32" stroke="#ffffff" stroke-width="6" stroke-dasharray="12 7"/>
        <text x="189" y="122" text-anchor="middle" fill="#ffffff" font-size="32" font-weight="800" font-family="Microsoft JhengHei UI, sans-serif">安全區域</text>
      </svg>`;

    case 'monitor-2k':
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="56" y="20" width="248" height="146" rx="12" fill="rgba(10,16,32,0.88)" stroke="#ffffff" stroke-width="7"/>
        <rect x="70" y="34" width="220" height="118" rx="6" fill="${accent}" fill-opacity="0.28"/>
        <path d="M180 166v28M136 194h88" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <text x="180" y="106" text-anchor="middle" fill="#ffffff" font-size="42" font-weight="900" font-family="Segoe UI, sans-serif">2K 180Hz</text>
      </svg>`;

    case 'tv-4k':
    default:
      return `<svg viewBox="0 0 360 220" width="360" height="220" fill="none">
        <rect x="44" y="22" width="272" height="152" rx="10" fill="rgba(10,16,32,0.88)" stroke="#ffffff" stroke-width="7"/>
        <rect x="58" y="36" width="244" height="124" rx="4" fill="${accent}" fill-opacity="0.28"/>
        <path d="M116 174l-16 24M244 174l16 24M140 198h80" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
        <text x="180" y="114" text-anchor="middle" fill="#ffffff" font-size="56" font-weight="900" font-family="Segoe UI, sans-serif">4K TV</text>
      </svg>`;
  }
}

function buildCoverHtml(profile) {
  const theme = getTheme(profile);
  const v = describeProfileVisual(profile);

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${COVER_WIDTH}px;
    height: ${COVER_HEIGHT}px;
    overflow: hidden;
    font-family: "Microsoft JhengHei UI", "Microsoft JhengHei", "Segoe UI", sans-serif;
    background: #090d16;
  }
  .card {
    position: relative;
    width: ${COVER_WIDTH}px;
    height: ${COVER_HEIGHT}px;
    padding: 30px 30px 32px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background:
      radial-gradient(circle at 50% 42%, ${theme.accentGlow} 0%, transparent 62%),
      linear-gradient(165deg, ${theme.bgTop} 0%, ${theme.bgMid} 52%, ${theme.bgBottom} 100%);
    border: 4px solid rgba(255,255,255,0.16);
  }
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .cat-pill {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 9px 18px;
    border-radius: 14px;
    background: ${theme.catBg};
    color: #ffffff;
    font-size: 25px;
    font-weight: 800;
    letter-spacing: 0.8px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.35);
  }
  .tier-pill {
    padding: 9px 18px;
    border-radius: 14px;
    background: ${theme.tierBg};
    color: ${theme.tierText};
    font-size: 25px;
    font-weight: 900;
    box-shadow: 0 6px 16px rgba(0,0,0,0.35);
  }
  .mode-row {
    display: flex;
    justify-content: center;
    margin-top: 16px;
  }
  .mode-pill {
    padding: 8px 22px;
    border-radius: 999px;
    background: ${theme.modeBg};
    border: 2.5px solid ${theme.modeBorder};
    color: ${theme.modeText};
    font-size: 23px;
    font-weight: 800;
    letter-spacing: 0.4px;
  }
  .icon-stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 0;
  }
  .bottom {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .title {
    color: #ffffff;
    font-size: 62px;
    font-weight: 900;
    line-height: 1.08;
    letter-spacing: 1px;
    text-shadow: 0 4px 16px rgba(0,0,0,0.55);
    white-space: nowrap;
  }
  .subtitle {
    color: #e2e8f0;
    font-size: 31px;
    font-weight: 700;
    line-height: 1.15;
    text-shadow: 0 2px 8px rgba(0,0,0,0.45);
    white-space: nowrap;
  }
  .res-pill {
    margin-top: 6px;
    padding: 10px 28px;
    border-radius: 16px;
    background: rgba(6, 10, 20, 0.72);
    border: 3px solid ${theme.accent};
    color: #ffffff;
    font-family: "Consolas", "Cascadia Mono", "Segoe UI", monospace;
    font-size: 40px;
    font-weight: 800;
    letter-spacing: 1px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.45);
    white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="card">
    <div>
      <div class="top-bar">
        <span class="cat-pill">${buildCategoryBadgeSvg(v.isSteam)}<span>${escapeHtml(v.catLabel)}</span></span>
        <span class="tier-pill">${escapeHtml(v.tierLabel)}</span>
      </div>
      <div class="mode-row">
        <span class="mode-pill">${escapeHtml(v.modeText)}</span>
      </div>
    </div>

    <div class="icon-stage">
      ${buildCenterDeviceSvg(v.iconType, theme.accent)}
    </div>

    <div class="bottom">
      <div class="title">${escapeHtml(v.mainTitle)}</div>
      <div class="subtitle">${escapeHtml(v.subtitle)}</div>
      <div class="res-pill">${escapeHtml(v.resLabel)}</div>
    </div>
  </div>
</body>
</html>`;
}

function findHeadlessBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) {
    throw new Error(`PNG too small: ${filePath}`);
  }
  const magic = buf.subarray(0, 8);
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!magic.equals(expected)) {
    throw new Error(`Invalid PNG signature: ${filePath}`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

function execBrowserScreenshot(browserPath, htmlPath, outPath, userDataDir) {
  return new Promise((resolve, reject) => {
    const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${COVER_WIDTH},${COVER_HEIGHT}`,
      `--user-data-dir=${userDataDir}`,
      `--screenshot=${outPath}`,
      fileUrl,
    ];
    execFile(browserPath, args, { windowsHide: true, timeout: 30000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || stdout || err.message || '').trim()));
        return;
      }
      resolve();
    });
  });
}

async function renderCoverPng(profile, outputPath, options = {}) {
  const browserPath = options.browserPath || findHeadlessBrowser();
  if (!browserPath) {
    throw new Error('Could not find msedge.exe or chrome.exe for headless PNG rendering.');
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sunshine-cover-'));
  const htmlPath = path.join(tempRoot, `${profile.id}.html`);
  const userDataDir = path.join(tempRoot, 'profile');
  fs.writeFileSync(htmlPath, buildCoverHtml(profile), 'utf8');

  try {
    await execBrowserScreenshot(browserPath, htmlPath, outputPath, userDataDir);
    const dims = readPngDimensions(outputPath);
    if (dims.width !== COVER_WIDTH || dims.height !== COVER_HEIGHT) {
      throw new Error(`Unexpected PNG dimensions ${dims.width}x${dims.height} for ${outputPath}`);
    }
    return {
      id: profile.id,
      outputPath,
      ...dims,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function getCoverRelativePath(rootDir, profile) {
  const rel = String(profile.imagePath || '').trim();
  if (rel && (rel.includes('/') || rel.includes('\\'))) {
    return rel.replace(/\\/g, '/');
  }
  const presetCover = path.join(rootDir, 'assets', 'covers', `${profile.id}.png`);
  if (fs.existsSync(presetCover)) {
    return `assets/covers/${profile.id}.png`;
  }
  return `local/covers/${profile.id}.png`;
}

async function generateAllCovers(rootDir, profiles, options = {}) {
  const browserPath = options.browserPath || findHeadlessBrowser();
  const concurrency = Math.max(1, options.concurrency || 4);
  const presetIds = options.presetIds || null;
  const results = [];
  const queue = [...profiles];

  async function worker() {
    while (queue.length > 0) {
      const profile = queue.shift();
      let rel = getCoverRelativePath(rootDir, profile);
      if (options.forcePresetDir && (!presetIds || presetIds.has(profile.id))) {
        rel = `assets/covers/${profile.id}.png`;
      } else if (!rel.startsWith('assets/covers/') && !rel.startsWith('local/covers/')) {
        rel = `local/covers/${profile.id}.png`;
      }
      const absOut = path.resolve(rootDir, rel);
      const rendered = await renderCoverPng(profile, absOut, { browserPath });
      results.push({ ...rendered, relativePath: rel });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = {
  COVER_WIDTH,
  COVER_HEIGHT,
  getTheme,
  describeProfileVisual,
  buildCoverHtml,
  findHeadlessBrowser,
  readPngDimensions,
  renderCoverPng,
  getCoverRelativePath,
  generateAllCovers,
};
