'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const test = require('node:test');
const config = require('../lib/config');
const { McpServer } = require('../lib/server');
const { RuntimeLog } = require('../lib/runtime-log');

function project(t, settings = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'funplay-console-logging-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'funplay-cocos-mcp.config.json');
  fs.writeFileSync(file, JSON.stringify({ ...config.DEFAULTS, portMode: 'fixed', autostart: false, ...settings }));
  return { root, file };
}

// Exercise the real service class without exposing test-only exports or starting
// Cocos, and keep its console separate from Node's test runner.
function serviceFixture(root) {
  const file = require.resolve('../browser');
  const sourceRequire = createRequire(file);
  const printed = [];
  const sandbox = {
    __filename: file, module: { exports: {} }, global: {}, process, setTimeout, clearTimeout,
    console: Object.fromEntries(['log', 'warn', 'error'].map((level) => [level, (message) => printed.push({ level, message })])),
    require(name) {
      if (name === './lib/config') return {
        ...config,
        loadConfig: () => config.loadConfig({ projectPath: root, env: {} }),
        getProjectPath: () => root,
        getProjectName: () => path.basename(root),
        getProjectPort: () => config.getProjectPort(root),
        getProjectIdentity: () => config.getProjectIdentity(root),
      };
      return sourceRequire(name);
    },
  };
  const Service = vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nExtensionService;', sandbox, { filename: file });
  const service = new Service();
  return { service, printed, console: sandbox.console };
}

test('extension logging can be muted without suppressing diagnostics or project console messages', (t) => {
  const { root } = project(t);
  const { service, printed, console: targetConsole } = serviceFixture(root);
  service.config = { enableConsoleLogging: true };
  service.log('info', 'visible');
  service.config.enableConsoleLogging = false;
  for (const level of ['info', 'warn', 'error']) service.log(level, `muted ${level}`, { retained: true });
  assert.equal(printed.length, 1);
  assert.match(printed[0].message, /^\[Cocos MCP\] visible$/);
  assert.equal(service.runtimeLog.list().length, 4);
  assert.equal(service.runtimeLog.list()[0].details.retained, true);
  targetConsole.log('Project script log');
  assert.equal(printed[1].message, 'Project script log');
  service.config.enableConsoleLogging = true;
  service.log('error', 'visible again');
  assert.equal(printed[2].level, 'error');
});

test('HTTP server printing switches live for info, warnings and errors while keeping runtime records', (t) => {
  const printed = [];
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, (message) => printed.push({ method, message }));
  const runtimeLog = new RuntimeLog();
  const server = new McpServer({ config: { enableConsoleLogging: true }, runtimeLog });
  for (const level of ['info', 'warn', 'error']) server.log(level, `visible ${level}`);
  assert.equal(printed.length, 3);
  server.config.enableConsoleLogging = false;
  for (const level of ['info', 'warn', 'error']) server.log(level, `muted ${level}`);
  assert.equal(printed.length, 3);
  assert.equal(runtimeLog.list().length, 6);
  server.config.enableConsoleLogging = true;
  server.log('info', 'visible again');
  assert.equal(printed.length, 4);
  assert.match(printed[3].message, /^\[Cocos MCP Server\]/);
});
