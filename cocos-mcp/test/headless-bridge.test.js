'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const extension = require('../browser');
const manifest = require('../package.json');
const { CodexGateway } = require('../lib/codex-gateway');

test('headless bridge has no management menus, panels or settings IPC while preserving the Prefab renderer', () => {
  assert.deepEqual(manifest.contributions.menu || [], []);
  assert.deepEqual(Object.keys(manifest.panels), ['preview']);
  assert.equal(manifest.panels.preview.main, 'panel/prefab-preview.js');
  for (const name of ['openPanel', 'openToolExposurePanel', 'openSettingsPanel', 'getPanelState', 'saveConfig', 'configureClient', 'installUpdate', 'installGlobally', 'openProjectSkillsPanel']) assert.equal(extension.methods[name], undefined);
  assert.deepEqual(Object.keys(manifest.contributions.messages).sort(), ['bridge-status', 'call-tool', 'get-status', 'render-prefab-preview', 'restart-server', 'start-server', 'stop-server']);
  for (const file of ['index.js', 'settings.js', 'tool-exposure.js', 'shared.js']) assert.equal(fs.existsSync(require('node:path').resolve(__dirname, '../panel', file)), false);
});

test('gateway always exposes all tools before Creator is available, even with a legacy core preference', async () => {
  const gateway = new CodexGateway({ profile: 'core' });
  const reply = await gateway.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(reply.result.tools.length, 108);
  assert.ok(reply.result.tools.some(tool => tool.name === 'write_file'));
  assert.ok(reply.result.tools.some(tool => tool.name === 'create_node'));
  const denied = await gateway.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'create_node', arguments: {} } });
  assert.equal(denied.result.isError, true);
  assert.equal(denied.result.structuredContent.status, 'disconnected');
});

test('legacy CLI profile flags cannot hide tools from the default Codex entry', () => {
  const input = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n';
  const child = spawnSync(process.execPath, [require.resolve('../bin/cocos-mcp'), '--profile', 'core'], { input, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(JSON.parse(child.stdout).result.tools.length, 108);
});
