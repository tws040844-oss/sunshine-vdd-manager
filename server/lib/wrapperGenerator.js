const fs = require('fs');
const path = require('path');

function validateProfileId(id) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id || '')) {
    throw new Error(`Invalid profile id: ${id}`);
  }
}

function buildSwitchWrapperBat(rootDir, profileId) {
  validateProfileId(profileId);
  const ps1Path = path.join(rootDir, 'scripts', 'Switch-Display.ps1');
  return [
    '@echo off',
    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1Path}" -ProfileId "${profileId}"`,
    'exit /b %ERRORLEVEL%',
    '',
  ].join('\r\n');
}

function buildRestoreWrapperBat(rootDir) {
  const ps1Path = path.join(rootDir, 'scripts', 'Restore-Display.ps1');
  return [
    '@echo off',
    `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${ps1Path}"`,
    'exit /b %ERRORLEVEL%',
    '',
  ].join('\r\n');
}

function writeAllWrappers(rootDir, profiles) {
  const wrappersDir = path.join(rootDir, 'local', 'wrappers');
  fs.mkdirSync(wrappersDir, { recursive: true });
  const written = [];

  const restorePath = path.join(wrappersDir, 'Restore_PC.bat');
  fs.writeFileSync(restorePath, Buffer.from(buildRestoreWrapperBat(rootDir), 'ascii'));
  written.push(restorePath);

  for (const profile of profiles) {
    if (profile.mode === 'passthrough') continue;
    const batPath = path.join(wrappersDir, `Start_${profile.id}.bat`);
    fs.writeFileSync(batPath, Buffer.from(buildSwitchWrapperBat(rootDir, profile.id), 'ascii'));
    written.push(batPath);
  }

  return written;
}

module.exports = {
  validateProfileId,
  buildSwitchWrapperBat,
  buildRestoreWrapperBat,
  writeAllWrappers,
};
