// Package cc-unlock-codex to a portable win-x64 app via @electron/packager.
// Run: npm run dist  ->  dist/cc-unlock-codex-win32-x64/cc-unlock-codex.exe
'use strict';
const path = require('path');
const { packager } = require('@electron/packager');

packager({
  dir: __dirname,
  name: 'cc-unlock-codex',
  platform: 'win32',
  arch: 'x64',
  out: 'dist',
  overwrite: true,
  asar: true,
  prune: true,
  icon: path.join(__dirname, '..', 'assets', 'cc-unlock.ico'),
  ignore: [/^\/dist($|\/)/, /^\/bundle($|\/)/, /^\/\.gitignore$/, /^\/pack\.js$/],
  extraResource: [
    '../codex-files',
    '../cc-unlock-files/skill-bundle',
  ],
}).then((paths) => {
  console.log('Packaged ->', paths.join(', '));
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
