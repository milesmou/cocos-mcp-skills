'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const test = require('node:test');
const { installPreviewTemplate } = require('../lib/preview-template');
const { requestCompatibilityBridge } = require('../lib/runtime-client');
const { createToolRegistry } = require('../lib/tool-registry');

const source = path.resolve(__dirname, '../preview-template');
const agent = fs.readFileSync(path.join(source, 'runtime-agent.js'), 'utf8');
const inspector = fs.readFileSync(path.join(source, 'runtime-node-inspector.js'), 'utf8');
function temporaryProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ creator: { version: '3.8.8' } }));
  return root;
}

function gameContext(extra = {}) {
  class Node {}
  class Component {}
  const scene = Object.assign(new Node(), { name: 'Playing Scene', uuid: 'runtime-scene', score: 42, children: [], active: true, activeInHierarchy: true });
  const cc = { Node, Component, director: { getScene: () => scene }, js: { getClassName: () => 'Player' } };
  const context = vm.createContext({ System: { import: async (name) => { assert.equal(name, 'cc'); return cc; } },
    performance, document: { title: 'Running Game', visibilityState: 'visible', getElementById: () => ({}) },
    location: { port: '7456', href: 'http://localhost:7456/' }, ...extra });
  vm.runInContext(agent, context);
  return { context, scene, execute: context.__cocosAgentRuntime.execute };
}

test('template installation preserves custom EJS, is idempotent, and backs up managed script upgrades', (t) => {
  const root = temporaryProject(t);
  const target = path.join(root, 'preview-template');
  fs.mkdirSync(target);
  const original = '<html><body><custom-game-toolbar></custom-game-toolbar></body></html>';
  fs.writeFileSync(path.join(target, 'index.ejs'), original);
  const first = installPreviewTemplate(root);
  assert.equal(first.createdTemplate, false);
  assert.equal(fs.readFileSync(path.join(first.backupDirectory, 'index.ejs'), 'utf8'), original);
  const index = fs.readFileSync(path.join(target, 'index.ejs'), 'utf8');
  assert.match(index, /<custom-game-toolbar>/);
  assert.ok(index.indexOf('runtime-agent.js') < index.indexOf('runtime-node-inspector.js'));
  assert.equal(installPreviewTemplate(root).changed, false);
  const secondSource = path.join(root, 'new-source');
  fs.cpSync(source, path.join(secondSource, 'preview-template'), { recursive: true });
  fs.appendFileSync(path.join(secondSource, 'preview-template/runtime-agent.js'), '\n// updated\n');
  const upgraded = installPreviewTemplate(root, secondSource);
  assert.deepEqual(upgraded.changedFiles, ['runtime-agent.js']);
  assert.equal(fs.readFileSync(path.join(upgraded.backupDirectory, 'runtime-agent.js'), 'utf8'), agent);
});

test('unmanaged preview script collisions are rejected before template changes', (t) => {
  const root = temporaryProject(t);
  fs.mkdirSync(path.join(root, 'preview-template'));
  fs.writeFileSync(path.join(root, 'preview-template/runtime-node-inspector.js'), '// project customization');
  assert.throws(() => installPreviewTemplate(root), /unmanaged local changes/);
  assert.equal(fs.existsSync(path.join(root, 'preview-template/index.ejs')), false);
  assert.equal(fs.existsSync(path.join(root, 'preview-template/runtime-agent.js')), false);
});

test('runtime executor reads changing game data and awaits supported entrypoints', async () => {
  const { scene, execute } = gameContext();
  assert.equal((await execute({ code: 'return scene.score;' })).result, 42);
  scene.score = 85;
  for (const definition of ['async function run(env)', 'module.exports = async function(env)', 'module.exports.run = async function(env)']) {
    const result = await execute({ code: `${definition} { await Promise.resolve(); return env.scene.score + env.args.bonus; }`, args: { bonus: 5 } });
    assert.equal(result.result, 90);
    assert.equal(result.scene.uuid, 'runtime-scene');
    assert.equal(result.page.title, 'Running Game');
  }
  await assert.rejects(execute({ code: 'throw new Error("game failure")' }), /game failure/);
  await assert.rejects(execute({ code: 'return {;' }), /Unexpected/);
  await assert.rejects(execute({ code: '' }), /required/);
});

test('runtime serialization bounds cycles, engine objects, BigInt and long strings', async () => {
  const { execute } = gameContext();
  const result = await execute({ code: 'const data = { node: scene, money: 25n, text: "x".repeat(300000), many: Array(5000).fill(1) }; data.self = data; return data;' });
  assert.equal(result.result.node.type, 'cc.Node');
  assert.equal(result.result.money, '25');
  assert.ok(result.result.text.length < 66000);
  assert.ok(result.result.many.length < 2100);
  assert.equal(result.serialization.truncated, true);
  assert.ok(JSON.stringify(result).length < 100000);
});

test('authenticated bridge executes the installed browser scripts over real SSE/HTTP and routes the MCP tool', async (t) => {
  const root = temporaryProject(t);
  // Reserve a free runtime relay port; the fixture uses its preceding port as Creator's preview port.
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const runtimePort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  fs.mkdirSync(path.join(root, 'profiles/v2/packages'), { recursive: true });
  fs.writeFileSync(path.join(root, 'profiles/v2/packages/server.json'), JSON.stringify({ server_port: runtimePort - 1 }));
  const previousEditor = global.Editor;
  const editorRequests = [];
  global.Editor = { Project: { path: root }, App: { version: '3.8.8' }, Message: { request: async (...args) => { editorRequests.push(args); return true; } } };
  const extension = require('../lib/creator-bridge/main');
  const streams = [];
  t.after(() => { for (const stream of streams) stream.destroy(); extension.unload(); global.Editor = previousEditor; });
  extension.load();
  while (!fs.existsSync(path.join(root, 'temp/cocos-mcp-bridge.json'))) await new Promise((resolve) => setTimeout(resolve, 5));

  async function browser(id) {
    let connected;
    const ready = new Promise((resolve) => { connected = resolve; });
    class EventSource {
      constructor(url) {
        let buffered = '';
        const request = http.get(url, (response) => {
          streams.push(response);
          response.on('data', (data) => {
            buffered += data;
            let end;
            while ((end = buffered.indexOf('\n\n')) >= 0) {
              const event = buffered.slice(0, end); buffered = buffered.slice(end + 2);
              if (event.startsWith('retry:')) connected();
              if (event.startsWith('data:')) this.onmessage?.({ data: event.slice(6) });
            }
          });
        });
        streams.push(request);
      }
    }
    const game = gameContext({ EventSource, fetch, sessionStorage: { getItem: () => id },
      location: { port: String(runtimePort - 1), href: `http://localhost:${runtimePort - 1}/` } });
    vm.runInContext(inspector, game.context);
    await ready;
    return game;
  }

  await assert.rejects(requestCompatibilityBridge(root, 'execute-runtime-javascript', [{ code: 'return 1;' }]), /no runtime/);
  const game = await browser('runtime-instance-one');
  const result = await requestCompatibilityBridge(root, 'execute-runtime-javascript', [{ code: 'return { score: scene.score, name: scene.name };' }]);
  assert.deepEqual(result.result, { score: 42, name: 'Playing Scene' });
  assert.equal(result.instanceId, 'runtime-instance-one');
  const registry = createToolRegistry({ getRuntimeContext: () => ({ projectPath: root, config: {} }),
    interactionLog: { add() {} }, runtimeLog: { add() {} }, sceneBridge: { call() { throw new Error('Editor scene must not be used for runtime queries'); } } });
  game.scene.score = 99;
  const called = await registry.callToolDetailed('execute_javascript', { context: 'runtime', code: 'return scene.score;' });
  assert.equal(called.value.data.result, 99);
  await assert.rejects(requestCompatibilityBridge(root, 'execute-runtime-javascript', [{ code: 'throw new Error("real script error");' }]), /real script error/);
  await assert.rejects(requestCompatibilityBridge(root, 'execute-runtime-javascript', [{ code: 'await new Promise(() => {});', timeoutMs: 100 }]), /timed out.*do not replay/);
  await browser('runtime-instance-two');
  const status = await requestCompatibilityBridge(root, 'status');
  assert.equal(status.runtimeInspector.javascript, true);
  assert.equal(status.runtimeInspector.instanceIds.length, 2);
  await assert.rejects(requestCompatibilityBridge(root, 'execute-runtime-javascript', [{ code: 'return 1;' }]), /select a connected runtime instanceId/);
  assert.equal((await requestCompatibilityBridge(root, 'execute-runtime-javascript', [{ code: 'return scene.score;', instanceId: 'runtime-instance-one' }])).result, 99);
  const descriptor = JSON.parse(fs.readFileSync(path.join(root, 'temp/cocos-mcp-bridge.json')));
  const forwarded = await fetch(`http://127.0.0.1:${descriptor.port}/request`, { method: 'POST', body: JSON.stringify({ token: descriptor.token, target: 'scene-script', method: 'createNode', args: [{ name: 'Requested' }] }) });
  assert.equal(forwarded.status, 200);
  assert.deepEqual(editorRequests.at(-1), ['scene', 'execute-scene-script', { name: 'cocos-mcp-bridge', method: 'bridgeCreateNode', args: [{ name: 'Requested' }] }]);
  const denied = await fetch(`http://127.0.0.1:${descriptor.port}/request`, { method: 'POST', body: JSON.stringify({ token: 'wrong-token', target: 'bridge', method: 'execute-runtime-javascript', args: [{ code: 'return 1;' }] }) });
  assert.equal(denied.status, 401);
});
