'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function resolveBuildDependencies(root) {
  const candidates = [
    process.env.CC_UNLOCK_BUILD_MODULES,
    path.join(root, 'cc-unlock-codex', 'node_modules'),
    path.join(root, 'cc-unlock-claude', 'node_modules'),
    // Existing local workstation builds can reuse their installed toolchain.
    path.resolve(root, '..', 'cc-unlock', 'cc-unlock-codex', 'node_modules'),
  ].filter(Boolean);
  for (const value of candidates) {
    const modules = path.resolve(value);
    if (['@electron/asar/package.json', '@electron/packager/package.json', 'resedit/package.json', 'electron/dist/electron.exe']
        .every(name => fs.existsSync(path.join(modules, name)))) {
      return { modules, require: createRequire(path.join(modules, '.cc-unlock-build.cjs')),
        runtime: path.join(modules, 'electron', 'dist') };
    }
  }
  throw new Error('Build dependencies missing. Run: npm --prefix cc-unlock-codex ci (Node.js 20+), or set CC_UNLOCK_BUILD_MODULES to an installed node_modules directory.');
}

module.exports = { resolveBuildDependencies };
