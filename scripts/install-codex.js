#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function installCodex({
  repository = path.resolve(__dirname, '..'),
  skillRoot = path.join(os.homedir(), '.agents', 'skills'),
  dryRun = false,
} = {}) {
  const sourcePath = fs.realpathSync(path.join(repository, 'cocos-skill'));
  const skillPath = path.resolve(skillRoot, 'cocos-skill');
  fs.accessSync(path.join(sourcePath, 'SKILL.md'), fs.constants.R_OK);

  let existing;
  try {
    existing = fs.lstatSync(skillPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (existing) {
    let target;
    try {
      target = fs.realpathSync(skillPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (target !== sourcePath) throw new Error('Skill path already exists: ' + skillPath);
  }

  if (!existing && !dryRun) {
    fs.mkdirSync(path.dirname(skillPath), { recursive: true });
    fs.symlinkSync(sourcePath, skillPath, process.platform === 'win32' ? 'junction' : 'dir');
  }

  return { skillPath, sourcePath, dryRun, alreadyLinked: Boolean(existing) };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== '--dry-run')) {
      throw new Error('Usage: node scripts/install-codex.js [--dry-run]');
    }
    console.log(JSON.stringify(installCodex({ dryRun: args.includes('--dry-run') }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { installCodex };
