// Package cc-unlock-claude to a portable win-x64 app via @electron/packager.
// electron-builder's NSIS target needs winCodeSign, whose extraction fails on
// non-admin Windows (symlink privilege). @electron/packager avoids that entirely.
// Run: npm run dist  ->  dist/cc-unlock-claude-win32-x64/cc-unlock-claude.exe
'use strict';
const path = require('path');
const { packager } = require('@electron/packager');

packager({
  dir: __dirname,
  name: 'cc-unlock-claude',
  platform: 'win32',
  arch: 'x64',
  out: 'dist',
  overwrite: true,
  asar: true,
  prune: true,
  icon: path.join(__dirname, '..', 'assets', 'cc-unlock.ico'),
  ignore: [/^\/dist($|\/)/, /^\/bundle($|\/)/, /^\/\.gitignore$/, /^\/pack\.js$/],
  extraResource: [
    '../cc-unlock-files/memory-bundle',
    '../cc-unlock-files/skill-bundle',
    '../cc-unlock-files/config-bundle',
    'bundle',
  ],
}).then((paths) => {
  console.log('Packaged ->', paths.join(', '));
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
