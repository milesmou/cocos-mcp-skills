'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { CodexGateway } = require('../lib/codex-gateway');
const { ConnectionFile } = require('../lib/connection-file');
const { readProject } = require('../lib/project-bridge');
const { loadConfig } = require('../lib/config');

function project(t, version = '3.8.8') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-gateway-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ creator: { version } }));
  return root;
}

function request(name, args = {}) {
  return { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } };
}

async function editor(t, root, { identity = readProject(root).projectIdentity, dropCalls = false } = {}) {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, projectIdentity: calls.identity || identity }));
    }
    if (req.url === '/request') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, result: { name: 'cocos-mcp-bridge', runtimeInspector: { javascript: true, instanceIds: [] } } })); }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    calls.push({ body, sessionId: req.headers['mcp-session-id'] });
    if (body.method === 'notifications/initialized') { res.writeHead(202); return res.end(); }
    if (body.method === 'tools/call' && dropCalls) return req.socket.destroy();
    res.setHeader('Content-Type', 'application/json');
    if (body.method === 'initialize') res.setHeader('Mcp-Session-Id', 'editor-session');
    res.end(JSON.stringify({
      jsonrpc: '2.0', id: body.id,
      result: body.method === 'initialize'
        ? { protocolVersion: '2025-11-25', funplay: { server: 'cocos-mcp-bridge', projectIdentity: identity } }
        : { content: [{ type: 'image', mimeType: 'image/png', data: 'dGVzdA==' }], structuredContent: { ok: true } },
    }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const connectionFile = new ConnectionFile();
  connectionFile.write(root, { projectIdentity: readProject(root).projectIdentity, version: '0.6.8', url: `http://127.0.0.1:${server.address().port}/` });
  // Filesystem timestamp precision must not make a newly started fake editor look older than the install.
  fs.writeFileSync(path.join(root, 'temp/cocos-mcp-bridge.json'), JSON.stringify({ schema: 1, host: '127.0.0.1', port: server.address().port, token: 'fake-token', project: root }));
  const now = new Date(Date.now() + 100);
  fs.utimesSync(connectionFile.file, now, now);
  return calls;
}

test('gateway initializes and lists tools before any project or Creator is available', async () => {
  const gateway = new CodexGateway();
  const initialized = await gateway.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
  assert.equal(initialized.result.serverInfo.name, 'cocos-mcp');
  const listed = await gateway.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(listed.result.tools.length, 42);
  assert.ok(listed.result.tools.some((tool) => tool.name === 'execute_javascript'));
  assert.ok(listed.result.tools.some((tool) => tool.name === 'connect_cocos_project'));
  const blocked = await gateway.handle(request('execute_javascript', { context: 'scene', code: 'return 1' }));
  assert.equal(blocked.result.isError, true);
  assert.equal(blocked.result.structuredContent.status, 'disconnected');
  assert.equal((await gateway.handle(null)).error.code, -32600);
});

test('missing bridge installs once, requests restart and leaves existing files intact', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  const installed = await gateway.connect({ projectPath: root });
  assert.equal(installed.status, 'restart_required');
  assert.equal(installed.extensions.length, 1);
  assert.equal(installed.previewTemplate.createdTemplate, true);
  assert.ok(fs.existsSync(path.join(root, 'preview-template/runtime-agent.js')));
  const extension = path.join(root, 'extensions/cocos-mcp-bridge');
  assert.ok(fs.existsSync(path.join(extension, 'scene.js')));
  assert.equal(fs.existsSync(path.join(extension, 'test')), false);
  const sentinel = path.join(extension, 'browser.js');
  fs.appendFileSync(sentinel, '\n// project-local change');
  const again = await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  assert.equal(again.status, 'restart_required');
  assert.equal(again.extensions[0].installed, false);
  assert.ok(fs.readFileSync(sentinel, 'utf8').endsWith('// project-local change'));
  const blocked = await gateway.handle(request('get_project_info'));
  assert.equal(blocked.result.structuredContent.status, 'restart_required');
  assert.equal(blocked.result.isError, true);
});

test('reconnecting after editor startup forwards MCP images and session headers', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  const calls = await editor(t, root);
  assert.equal((await gateway.connect({ projectPath: root, includeCompatibilityBridge: false })).status, 'ready');
  const packet = await gateway.handle(request('capture_scene_screenshot'));
  assert.equal(packet.result.content[0].type, 'image');
  assert.deepEqual(packet.result.structuredContent, { ok: true });
  assert.equal(calls.at(-1).sessionId, 'editor-session');
});

test('installed runtime starts its real HTTP service and is discovered by the Codex gateway', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  fs.writeFileSync(path.join(root, 'funplay-cocos-mcp.config.json'), JSON.stringify({ portMode: 'project', enableConsoleLogging: false, enableSessions: true }));
  const previousEditor = global.Editor;
  global.Editor = { Project: { path: root }, App: { version: '3.8.8' }, Message: { request: async () => true } };
  const extension = require(path.join(root, 'extensions/cocos-mcp-bridge/browser.js'));
  try {
    await extension.load();
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal((await gateway.connect({ projectPath: root, includeCompatibilityBridge: false })).connected, true);
    const response = await gateway.handle(request('get_project_info'));
    assert.equal(response.result.structuredContent.data.projectPath, root);
  } finally {
    await extension.unload();
    global.Editor = previousEditor;
  }
});

test('a different project listener and a failed selection never receive editor writes', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  const calls = await editor(t, root, { identity: 'another-project' });
  assert.equal((await gateway.connect({ projectPath: root, includeCompatibilityBridge: false })).connected, false);
  assert.equal((await gateway.handle(request('get_project_info'))).result.isError, true);
  assert.equal(calls.some((call) => call.body.method === 'tools/call'), false);
  await assert.rejects(gateway.connect({ projectPath: project(t, '2.4.0') }), /3.8.x/);
  assert.equal(gateway.connection, null);
});

test('a lost transport is reported without replaying a potentially completed mutation', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  const calls = await editor(t, root, { dropCalls: true });
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  const response = await gateway.handle(request('execute_javascript', { context: 'editor', code: 'return 1;' }));
  assert.equal(response.result.isError, true);
  assert.equal(calls.filter((call) => call.body.method === 'tools/call').length, 1);
});

test('a port reused by another project is detected before forwarding any later tool call', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  const calls = await editor(t, root);
  await gateway.connect({ projectPath: root, includeCompatibilityBridge: false });
  calls.identity = 'a-new-project-on-the-same-port';
  const response = await gateway.handle(request('execute_javascript', { context: 'editor', code: 'return 1;' }));
  assert.equal(response.result.isError, true);
  assert.equal(calls.filter((call) => call.body.method === 'tools/call').length, 0);
});

test('unified bridge must expose both MCP and authenticated transports', async (t) => {
  const root = project(t);
  const gateway = new CodexGateway();
  const result = await gateway.connect({ projectPath: root, includeCompatibilityBridge: true });
  assert.equal(result.extensions.filter((extension) => extension.installed).length, 1);
  await editor(t, root);
  fs.unlinkSync(path.join(root, 'temp/cocos-mcp-bridge.json'));
  const reconnected = await gateway.connect({ projectPath: root, includeCompatibilityBridge: true });
  assert.equal(reconnected.status, 'restart_required');
  assert.equal(reconnected.connected, false);
});

test('invalid projects and occupied extension directories are not modified', async (t) => {
  assert.throws(() => readProject('relative/project'), /absolute/);
  const root = project(t);
  const target = path.join(root, 'extensions/cocos-mcp-bridge');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'package.json'), '{"name":"user-plugin"}');
  await assert.rejects(new CodexGateway().connect({ projectPath: root }), /incomplete|another package/);
  assert.deepEqual(fs.readdirSync(target), ['package.json']);
});

test('legacy plugins require explicit migration and are preserved in a backup', async (t) => {
  const root = project(t);
  for (const name of ['funplay-cocos-mcp', 'cocos3-codex-bridge']) {
    const target = path.join(root, 'extensions', name); fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name, main: 'main.js' }));
    fs.writeFileSync(path.join(target, 'main.js'), '// local changes must survive');
  }
  const gateway = new CodexGateway();
  await assert.rejects(gateway.connect({ projectPath: root }), /migrateLegacy/);
  assert.equal(fs.existsSync(path.join(root, 'extensions/cocos-mcp-bridge')), false);
  const state = await gateway.connect({ projectPath: root, migrateLegacy: true });
  assert.equal(state.status, 'restart_required');
  assert.deepEqual(fs.readdirSync(path.join(root, 'extensions')), ['cocos-mcp-bridge']);
  for (const name of state.migration.removedExtensions) assert.equal(fs.readFileSync(path.join(state.migration.backupDirectory, 'extensions', name, 'main.js'), 'utf8'), '// local changes must survive');
  await editor(t, root);
  assert.equal((await gateway.connect({ projectPath: root })).connected, true);
});

test('failed migration restores both legacy extensions without leaving an active duplicate', async (t) => {
  const root = project(t);
  for (const name of ['funplay-cocos-mcp', 'cocos3-codex-bridge']) {
    const target = path.join(root, 'extensions', name); fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({ name, main: 'main.js' }));
    fs.writeFileSync(path.join(target, 'main.js'), '// retained');
  }
  const incompleteSource = path.join(root, 'source');
  fs.mkdirSync(incompleteSource);
  fs.cpSync(path.resolve(__dirname, '../preview-template'), path.join(incompleteSource, 'preview-template'), { recursive: true });
  const gateway = new CodexGateway({ sourceRoot: incompleteSource });
  await assert.rejects(gateway.connect({ projectPath: root, migrateLegacy: true }), /ENOENT/);
  assert.deepEqual(fs.readdirSync(path.join(root, 'extensions')).sort(), ['cocos3-codex-bridge', 'funplay-cocos-mcp']);
});

test('unified settings override legacy settings without changing the project identity', (t) => {
  const root = project(t);
  const identity = readProject(root).projectIdentity;
  fs.writeFileSync(path.join(root, 'funplay-cocos-mcp.config.json'), JSON.stringify({ port: 19234, enableSessions: true }));
  const legacy = loadConfig({ projectPath: root, env: {} });
  assert.equal(legacy.port, 19234);
  assert.equal(legacy.enableSessions, true);
  assert.equal(path.basename(legacy.configPath), 'cocos-mcp-bridge.config.json');
  fs.writeFileSync(legacy.configPath, JSON.stringify({ port: 19235, enableSessions: false }));
  const current = loadConfig({ projectPath: root, env: {} });
  assert.equal(current.port, 19235);
  assert.equal(current.enableSessions, false);
  assert.equal(readProject(root).projectIdentity, identity);
});

test('connection-file cleanup never removes a newer editor owner', (t) => {
  const root = project(t);
  const first = new ConnectionFile();
  const second = new ConnectionFile();
  first.write(root, { projectIdentity: 'first', url: 'http://127.0.0.1:1/' });
  second.write(root, { projectIdentity: 'second', url: 'http://127.0.0.1:2/' });
  first.remove();
  assert.equal(JSON.parse(fs.readFileSync(second.file, 'utf8')).projectIdentity, 'second');
  const file = second.file;
  second.remove();
  assert.equal(fs.existsSync(file), false);
});

test('Codex stdio entry starts without Creator and returns installation instructions as MCP data', (t) => {
  const root = project(t);
  const input = [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    request('connect_cocos_project', { projectPath: root }),
  ].map((message) => JSON.stringify(message)).join('\n') + '\n';
  const child = spawnSync(process.execPath, [path.resolve(__dirname, '../bin/cocos-mcp.js')], { input, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  const packets = child.stdout.trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(packets.length, 2);
  assert.equal(packets[1].result.structuredContent.status, 'restart_required');
});
