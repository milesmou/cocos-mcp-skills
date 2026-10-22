#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, lstatSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { readProject, installProjectBridge } = require('../../../lib/project-bridge');
const args = process.argv.slice(2);
const allowed = new Set(['--project', '--force', '--remove', '--migrate-legacy', '--help']);
let projectArgument;
for (let index = 0; index < args.length; index++) {
  if (!allowed.has(args[index])) throw new Error(`Unknown argument: ${args[index]}`);
  if (args[index] === '--project') projectArgument = args[++index];
}
if (args.includes('--help')) {
  console.log('Usage: node install-bridge.mjs --project <dir> [--migrate-legacy] [--force] [--remove]');
} else {
  if (!projectArgument) throw new Error('--project is required');
  const project = readProject(resolve(projectArgument));
  if (args.includes('--remove')) {
    const extensionRoot = resolve(project.projectPath, 'extensions');
    const target = resolve(extensionRoot, 'cocos-mcp-bridge');
    if (existsSync(extensionRoot) && lstatSync(extensionRoot).isSymbolicLink()) throw new Error('extensions must be a real directory');
    if (existsSync(target)) {
      if (dirname(target) !== extensionRoot || lstatSync(target).isSymbolicLink()) throw new Error('Invalid extension path');
      const manifest = require(resolve(target, 'package.json'));
      if (manifest.name !== 'cocos-mcp-bridge') throw new Error('Extension belongs to another package');
      const backup = resolve(project.projectPath, 'temp/cocos-mcp-install', `removed-${Date.now()}`, 'cocos-mcp-bridge');
      mkdirSync(dirname(backup), { recursive: true });
      renameSync(target, backup);
      console.log(JSON.stringify({ removed: target, backup }, null, 2));
    }
  } else {
    const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    console.log(JSON.stringify(installProjectBridge(project, sourceRoot, { migrateLegacy: args.includes('--migrate-legacy'), replaceExisting: args.includes('--force') }), null, 2));
  }
  console.log('Save your work and fully restart Cocos Creator, enable cocos-mcp-bridge if needed, then reconnect.');
}
