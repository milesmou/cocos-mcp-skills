'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const { CocosDevtools } = require('../lib/cocos-devtools');
const { DevtoolsClient } = require('../lib/devtools-client');
const { CodexGateway } = require('../lib/codex-gateway');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-devtools-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const response = { content: [{ type: 'text', text: 'captured' }], structuredContent: {} };
  const tools = [
    { name: 'list_console_messages', inputSchema: { properties: { pageId: {}, pageSize: {} } } },
    { name: 'get_network_request', inputSchema: { properties: { pageId: {}, responseFilePath: {} } } },
    { name: 'performance_start_trace', inputSchema: { properties: { pageId: {}, filePath: {} } } },
    { name: 'performance_stop_trace', inputSchema: { properties: { pageId: {}, filePath: {} } } },
    { name: 'take_heapsnapshot', inputSchema: { properties: { pageId: {}, filePath: {} } } },
    { name: 'navigate_page', inputSchema: { properties: {} } },
  ];
  const state = { identity: 'preview-instance-one', closed: false, failure: null };
  const client = {
    listTools: async () => tools,
    callTool: async (name, args) => {
      calls.push({ name, args });
      if (name === 'list_pages') return { structuredContent: { pages: [
        { id: 1, url: 'https://unrelated.example/' },
        { id: 2, url: 'http://localhost:7456/', title: 'Game' },
        { id: 3, url: 'http://localhost:7458/', title: 'Another project' },
      ] } };
      if (name === 'evaluate_script') return { content: [{ type: 'text', text: 'Script returned:\n```json\n' + JSON.stringify({ instanceId: state.identity, url: 'http://localhost:7456/' }) + '\n```' }] };
      if (state.failure) return state.failure;
      return response;
    },
    close() { state.closed = true; },
  };
  const options = { clientFactory: () => client, getRuntimeStatus: async () => ({ runtimeInspector: { port: 7457, instanceIds: ['preview-instance-one'] } }) };
  const controller = new CocosDevtools({ ...options, getProject: () => ({ projectPath: root }) });
  t.after(() => controller.disconnect());
  return { root, controller, options, calls, state, response };
}

test('DevTools only returns project previews and revalidates their runtime identity before every call', async (t) => {
  const { controller, calls, state } = fixture(t);
  const catalog = await controller.run({ action: 'list_tools' });
  assert.equal(catalog.tools.some((tool) => tool.name === 'navigate_page'), false);
  assert.deepEqual((await controller.run({ action: 'list_pages' })).pages.map((page) => page.pageId), [2]);
  assert.ok(calls.filter((call) => call.name === 'evaluate_script').every((call) => call.args.pageId === 2));
  const result = await controller.run({ action: 'call', pageId: 2, toolName: 'list_console_messages' });
  assert.equal(result.page.instanceId, 'preview-instance-one');
  assert.equal(calls.at(-1).args.pageSize, 50);
  state.identity = 'a-different-project';
  await assert.rejects(controller.run({ action: 'call', pageId: 2, toolName: 'list_console_messages' }), /no longer a verified preview/);
  assert.equal(calls.filter((call) => call.name === 'list_console_messages').length, 1);
});

test('traces preserve game state by default, own their stop, and save artifacts under project temp', async (t) => {
  const { controller, calls, root, state } = fixture(t);
  await assert.rejects(controller.run({ action: 'call', pageId: 2, toolName: 'performance_stop_trace' }), /No performance trace owned/);
  const started = await controller.run({ action: 'call', pageId: 2, toolName: 'performance_start_trace' });
  assert.equal(calls.at(-1).args.reload, false);
  assert.equal(calls.at(-1).args.autoStop, false);
  assert.ok(started.artifacts.filePath.startsWith(path.join(root, 'temp/cocos-skill/devtools')));
  await assert.rejects(controller.run({ action: 'call', pageId: 2, toolName: 'performance_start_trace' }), /already active/);
  await controller.run({ action: 'disconnect' });
  assert.equal(calls.at(-1).name, 'performance_stop_trace');
  assert.equal(calls.at(-1).args.filePath, started.artifacts.filePath);
  assert.equal(state.closed, true);
});

test('artifact escapes and logical upstream errors fail without replay or a false trace state', async (t) => {
  const { controller, calls, state } = fixture(t);
  await assert.rejects(controller.run({ action: 'call', pageId: 2, toolName: 'get_network_request', toolArgs: { responseFilePath: '../escape.json' } }), /artifacts must stay/);
  state.failure = { content: [{ type: 'text', text: 'Error: a trace is already running.' }], structuredContent: { message: 'Error: a trace is already running.' } };
  await assert.rejects(controller.run({ action: 'call', pageId: 2, toolName: 'performance_start_trace' }), /already running/);
  assert.equal(controller.trace, null);
  assert.equal(calls.filter((call) => call.name === 'performance_start_trace').length, 1);
});

test('gateway exposes DevTools without claiming an editor disconnect when a DevTools call fails', async (t) => {
  const { root, options, state } = fixture(t);
  const gateway = new CodexGateway({ devtoolsOptions: options });
  gateway.project = { projectPath: root };
  gateway.state = { connected: true, status: 'ready' };
  state.identity = 'wrong-instance';
  const response = await gateway.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'cocos_devtools', arguments: { action: 'call', pageId: 2, toolName: 'list_console_messages' } } });
  assert.equal(response.result.isError, true);
  assert.equal(response.result.structuredContent.status, 'devtools_error');
  assert.equal(gateway.state.connected, true);
  await gateway.devtools.disconnect();
});

test('private MCP child preserves results and never replays a timed-out command', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-devtools-child-'));
  const entry = path.join(root, 'fake-devtools.js');
  fs.writeFileSync(entry, `const readline=require('node:readline');let rootUri;let toolsPacket;
const respondTools=()=>{if(rootUri&&toolsPacket)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:toolsPacket.id,result:{tools:[{name:'test-tool',rootUri}]}})+'\\n');};
readline.createInterface({input:process.stdin}).on('line',line=>{const packet=JSON.parse(line);if(packet.id==='root-query'){rootUri=packet.result.roots[0].uri;respondTools();return;}if(!('id' in packet))return;
if(packet.method==='tools/call')return;
if(packet.method==='tools/list'){toolsPacket=packet;respondTools();return;}
process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:packet.id,result:{serverInfo:{name:'fixture'}}})+'\\n');if(packet.method==='initialize')process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:'root-query',method:'roots/list'})+'\\n');});`);
  const client = new DevtoolsClient({ entry, projectPath: root, timeoutMs: 5000 });
  t.after(async () => {
    const child = client.child;
    const exited = child && new Promise((resolve) => child.once('exit', resolve));
    client.close();
    if (exited) await exited;
    fs.rmSync(root, { recursive: true, force: true });
  });
  const tools = await client.listTools();
  assert.equal(tools[0].name, 'test-tool');
  assert.equal(tools[0].rootUri, pathToFileURL(root + path.sep).href);
  client.timeoutMs = 50;
  await assert.rejects(client.callTool('timed-out-operation'), /No automatic replay/);
  assert.equal(client.sequence, 3);
  assert.equal(client.pending.size, 0);
});
