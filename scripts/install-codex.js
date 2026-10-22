#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SERVER_NAME = 'cocos-mcp';

function matchesEntry(server, command, args) {
  return server?.transport?.command === command && JSON.stringify(server.transport.args || []) === JSON.stringify(args);
}

function isLegacyRegistration(server, command, args) {
  return server?.name === 'cocos' && matchesEntry(server, command, args) && server.enabled !== false
    && !Object.keys(server.transport.env || {}).length && !(server.transport.env_vars || []).length
    && !server.transport.cwd && server.startup_timeout_sec == null && server.tool_timeout_sec == null;
}

function installCodex({ repository = path.resolve(__dirname, '..'), skillRoot = path.join(os.homedir(), '.agents/skills'), dryRun = false, run = spawnSync } = {}) {
  const sourceSkill = fs.realpathSync(path.join(repository, 'cocos-skill'));
  const gateway = fs.realpathSync(path.join(repository, 'cocos-mcp/bin/cocos-mcp.js'));
  const targetSkill = path.resolve(skillRoot, 'cocos-skill');
  let linked = false;
  try {
    fs.lstatSync(targetSkill);
    if (fs.realpathSync(targetSkill) !== sourceSkill) throw new Error(`Skill already exists at ${targetSkill}; existing skills are not overwritten.`);
    linked = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const command = process.execPath;
  const args = [gateway];
  const output = { serverName: SERVER_NAME, command, args, skillPath: targetSkill, sourcePath: repository, dryRun };
  if (dryRun) return output;

  const listed = run('codex', ['mcp', 'list', '--json'], { encoding: 'utf8', windowsHide: true });
  if (listed.error) throw listed.error;
  if (listed.status !== 0) throw new Error('Cannot read Codex MCP configuration. Check codex mcp list before installing.');
  const servers = JSON.parse(listed.stdout);
  const existing = servers.find((server) => server.name === SERVER_NAME);
  const legacy = servers.find((server) => isLegacyRegistration(server, command, args));
  if (existing && (!matchesEntry(existing, command, args) || existing.enabled === false)) {
    throw new Error(`A different or disabled Codex MCP entry named ${SERVER_NAME} already exists; it was not changed.`);
  }
  if (!linked) {
    fs.mkdirSync(skillRoot, { recursive: true });
    fs.symlinkSync(sourceSkill, targetSkill, process.platform === 'win32' ? 'junction' : 'dir');
  }
  if (!existing) {
    const added = run('codex', ['mcp', 'add', SERVER_NAME, '--', command, ...args], { encoding: 'utf8', windowsHide: true });
    if (added.error) throw added.error;
    if (added.status !== 0) throw new Error(`Skill is installed at ${targetSkill}, but MCP registration failed. Run codex mcp add ${SERVER_NAME} -- node "${gateway}" to complete setup.`);
  }
  // Register the replacement first so a failed add never removes the working legacy service.
  if (legacy) {
    const removed = run('codex', ['mcp', 'remove', 'cocos'], { encoding: 'utf8', windowsHide: true });
    if (removed.error) throw removed.error;
    if (removed.status !== 0) throw new Error('cocos-mcp is registered, but the legacy cocos entry could not be removed. Run codex mcp remove cocos to finish the rename.');
  }
  return { ...output, installed: true, alreadyRegistered: Boolean(existing), migratedLegacy: Boolean(legacy), message: 'Codex MCP 与技能已配置。请重新连接 MCP 或重启 Codex，让当前会话加载入口；首次使用时调用 connect_cocos_project。' };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.some((arg) => !['--dry-run', '--devtools'].includes(arg))) throw new Error('Usage: node scripts/install-codex.js [--dry-run] [--devtools]');
    const devtools = args.includes('--devtools') ? require('./install-devtools').installDevtools({ dryRun: args.includes('--dry-run') }) : undefined;
    console.log(JSON.stringify({ ...installCodex({ dryRun: args.includes('--dry-run') }), ...(devtools ? { devtools } : {}) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { installCodex };
