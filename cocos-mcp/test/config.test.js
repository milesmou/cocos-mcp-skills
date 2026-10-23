'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DEFAULTS, loadConfig, getProjectPort, getProjectIdentity } = require('../lib/config');
const { createToolRegistry } = require('../lib/tool-registry');

test('fixed defaults ignore legacy files, exposure filters and environment overrides without changing files', (t) => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-defaults-'));
  t.after(() => fs.rmSync(projectPath, { recursive: true, force: true }));
  const identity = getProjectIdentity(projectPath);
  const legacy = path.join(projectPath, 'funplay-cocos-mcp.config.json');
  const current = path.join(projectPath, 'cocos-mcp-bridge.config.json');
  const custom = JSON.stringify({ host: '0.0.0.0', port: 9000, portMode: 'fixed', autostart: false, toolProfile: 'core', disabledTools: ['write_file'], disabledToolCategories: ['scene'], executeJavascriptSafetyChecks: false });
  fs.writeFileSync(legacy, custom); fs.writeFileSync(current, '{malformed legacy settings');
  const config = loadConfig({ projectPath, env: { COCOS_MCP_HOST: '0.0.0.0', COCOS_MCP_PORT: '9500', COCOS_MCP_PROFILE: 'core' } });
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, getProjectPort(projectPath));
  assert.equal(config.autostart, true);
  assert.equal(config.executeJavascriptSafetyChecks, true);
  assert.equal(config.configError, '');
  assert.equal(config.toolProfile, 'full');
  assert.deepEqual(config.disabledTools, []);
  assert.deepEqual(config.disabledToolCategories, []);
  const registry = createToolRegistry({ getRuntimeContext: () => ({ config, projectPath }) });
  assert.equal(registry.listTools().length, 105);
  assert.ok(registry.listToolCatalog().every(tool => tool.enabled));
  assert.equal(getProjectIdentity(projectPath), identity);
  assert.equal(fs.readFileSync(legacy, 'utf8'), custom);
  assert.equal(fs.readFileSync(current, 'utf8'), '{malformed legacy settings');
});

test('project configuration snapshots cannot leak filters into other projects', () => {
  const first = loadConfig({ projectPath: path.resolve('first') });
  first.disabledTools.push('write_file');
  assert.deepEqual(loadConfig({ projectPath: path.resolve('second') }).disabledTools, []);
  assert.deepEqual(DEFAULTS.disabledTools, []);
});
