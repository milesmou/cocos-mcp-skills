#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DEVTOOLS_VERSION, devtoolsDirectory, devtoolsEntry } = require('../cocos-mcp/lib/devtools-client');

function installDevtools({ directory = devtoolsDirectory(), run = spawnSync, dryRun = false } = {}) {
  const version = process.versions.node.split('.').map(Number);
  if (!(version[0] >= 23 || version[0] === 22 && version[1] >= 12 || version[0] === 20 && version[1] >= 19)) throw new Error('Chrome DevTools requires Node 20.19+, 22.12+, or 23+.');
  const plan = { version: DEVTOOLS_VERSION, directory, package: `chrome-devtools-mcp@${DEVTOOLS_VERSION}` };
  if (dryRun) return { ...plan, dryRun: true };
  try { return { ...plan, entry: devtoolsEntry(directory), alreadyInstalled: true }; }
  catch (error) { if (fs.existsSync(path.join(directory, 'node_modules/chrome-devtools-mcp/package.json'))) throw error; }
  const npmCli = [process.env.npm_execpath, path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'), '/usr/share/nodejs/npm/bin/npm-cli.js']
    .find((candidate) => candidate && path.basename(candidate) === 'npm-cli.js' && fs.existsSync(candidate));
  if (!npmCli) throw new Error('npm is required to install Chrome DevTools. Use a Node.js installation that includes npm.');
  fs.mkdirSync(directory, { recursive: true });
  const result = run(process.execPath, [npmCli, 'install', '--prefix', directory, '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', plan.package], { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`DevTools dependency installation failed: ${result.stderr || result.stdout || result.status}`);
  return { ...plan, entry: devtoolsEntry(directory), alreadyInstalled: false };
}

if (require.main === module) {
  try { console.log(JSON.stringify(installDevtools({ dryRun: process.argv.includes('--dry-run') }), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { installDevtools };
