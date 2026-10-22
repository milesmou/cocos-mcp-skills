'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DEVTOOLS_VERSION, devtoolsEntry, DevtoolsClient } = require('./devtools-client');
const { requestCompatibilityBridge } = require('./runtime-client');

const ALLOWED_TOOLS = new Set([
  'list_console_messages', 'get_console_message', 'list_network_requests', 'get_network_request',
  'performance_start_trace', 'performance_stop_trace', 'performance_analyze_insight',
  'take_heapsnapshot', 'analyze_heapsnapshot_contexts', 'close_heapsnapshot', 'compare_heapsnapshots',
  'get_heapsnapshot_class_nodes', 'get_heapsnapshot_details', 'get_heapsnapshot_dominators',
  'get_heapsnapshot_duplicate_strings', 'get_heapsnapshot_edges', 'get_heapsnapshot_object_details',
  'get_heapsnapshot_retainers', 'get_heapsnapshot_retaining_paths', 'get_heapsnapshot_summary', 'query_heapsnapshot_objects',
]);
const DEVTOOLS_TOOL = {
  name: 'cocos_devtools',
  description: 'Inspect the existing project Chrome preview through official Chrome DevTools MCP. First list_tools for upstream schemas and list_pages for project-verified pageId. call forwards console, network, performance trace and heap analysis tools. All calls verify the preview instance against the project bridge. Does not launch Chrome. Keep this MCP session alive for console/network history and start/stop trace. Requires scripts/install-codex.js --devtools and Chrome remote-debugging consent.',
  inputSchema: {
    type: 'object', properties: {
      action: { type: 'string', enum: ['status', 'list_tools', 'list_pages', 'call', 'disconnect'] },
      pageId: { type: 'integer', description: 'Project preview ID returned by list_pages; required for call, including heap analysis.' },
      toolName: { type: 'string', description: 'Exact upstream tool from list_tools; required for call.' },
      toolArgs: { type: 'object', description: 'Arguments matching the upstream inputSchema. pageId is supplied from the verified top-level pageId. Output/input artifact paths stay in project temp/cocos-skill/devtools/.' },
    }, required: ['action'], additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
};

function requireResult(result) {
  if (result?.isError) throw new Error((result.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n') || 'Chrome DevTools request failed.');
  if (result?.structuredContent?.errorMessage || /^Error:/m.test(result?.structuredContent?.message || '')) throw new Error(result.structuredContent.errorMessage || result.structuredContent.message);
  return result;
}
function scriptResult(result) {
  const text = requireResult(result).content.filter((item) => item.type === 'text').map((item) => item.text).join('\n');
  const json = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!json) throw new Error('DevTools returned no preview identity.');
  return JSON.parse(json[1]);
}
function isPreviewUrl(value, port) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
      && Number(url.port || 80) === port && !url.username && !url.password;
  } catch { return false; }
}

class CocosDevtools {
  constructor({ getProject, clientFactory = (project) => new DevtoolsClient({ projectPath: project.projectPath }), getRuntimeStatus = (project) => requestCompatibilityBridge(project.projectPath, 'status') }) {
    this.getProject = getProject;
    this.clientFactory = clientFactory;
    this.getRuntimeStatus = getRuntimeStatus;
    this.client = null;
    this.tools = null;
    this.trace = null;
    this.verifiedPages = [];
    this.verifiedAt = null;
    this.queue = Promise.resolve();
  }
  run(args) {
    const next = this.queue.then(() => this.execute(args));
    this.queue = next.catch(() => {});
    return next;
  }
  async ensureClient() {
    if (!this.client) this.client = this.clientFactory(this.project());
    if (!this.tools) this.tools = (await this.client.listTools()).filter((tool) => ALLOWED_TOOLS.has(tool.name));
    return this.client;
  }
  project() {
    const project = this.getProject();
    if (!project) throw new Error('Select a project with connect_cocos_project before DevTools operations.');
    return project;
  }
  async pages() {
    const project = this.project();
    const status = await this.getRuntimeStatus(project);
    const inspector = status.runtimeInspector;
    if (!inspector?.port || !inspector.instanceIds?.length) throw new Error('No connected project Web preview. Open or refresh the original preview and reconnect.');
    const client = await this.ensureClient();
    const listed = requireResult(await client.callTool('list_pages'));
    if (!Array.isArray(listed.structuredContent?.pages)) throw new Error('Chrome DevTools returned no structured page list; check the pinned runtime version.');
    const pages = [];
    for (const page of listed.structuredContent.pages.filter((item) => isPreviewUrl(item.url, inspector.port - 1))) {
      const identity = scriptResult(await client.callTool('evaluate_script', {
        pageId: page.id, waitForStableDom: false,
        function: '() => ({ instanceId: globalThis.__cocosCodexRuntimeInspector?.instanceId || null, url: location.href })',
      }));
      if (isPreviewUrl(identity.url, inspector.port - 1) && inspector.instanceIds.includes(identity.instanceId)) {
        pages.push({ pageId: page.id, url: identity.url, title: page.title, instanceId: identity.instanceId });
      }
    }
    this.verifiedPages = pages;
    this.verifiedAt = new Date().toISOString();
    return pages;
  }

  artifactPath(input, extension = '') {
    const directory = path.join(this.project().projectPath, 'temp/cocos-skill/devtools');
    fs.mkdirSync(directory, { recursive: true });
    const realDirectory = fs.realpathSync(directory);
    const realProject = fs.realpathSync(this.project().projectPath);
    const projectRelative = path.relative(realProject, realDirectory);
    if (projectRelative.startsWith('..') || path.isAbsolute(projectRelative)) throw new Error('DevTools artifact directory resolves outside the project.');
    const target = input === undefined ? path.join(directory, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${extension}`) : path.resolve(directory, input);
    const relative = path.relative(directory, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('DevTools artifacts must stay in project temp/cocos-skill/devtools/.');
    let ancestor = target;
    while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
    const resolvedRelative = path.relative(realDirectory, fs.realpathSync(ancestor));
    if (resolvedRelative.startsWith('..') || path.isAbsolute(resolvedRelative)) throw new Error('DevTools artifact path follows a link outside its directory.');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    return target;
  }

  async execute(args) {
    if (args.action === 'status') {
      let installed = true;
      try { devtoolsEntry(); } catch { installed = false; }
      return { installed, version: DEVTOOLS_VERSION, sessionStarted: Boolean(this.client), previewVerifiedAt: this.verifiedAt, pages: this.verifiedPages, project: this.getProject()?.projectPath || null, trace: this.trace,
        setup: 'node scripts/install-codex.js --devtools; enable chrome://inspect/#remote-debugging and allow the connection in Chrome.' };
    }
    if (args.action === 'disconnect') return this.disconnect();
    this.project();
    if (args.action === 'list_tools') {
      await this.ensureClient();
      return { version: DEVTOOLS_VERSION, tools: this.tools };
    }
    if (args.action === 'list_pages') return { pages: await this.pages() };
    if (args.action !== 'call') throw new Error(`Unknown DevTools action: ${args.action}`);
    if (!Number.isInteger(args.pageId)) throw new Error('call requires a pageId from list_pages.');
    await this.ensureClient();
    const tool = this.tools.find((item) => item.name === args.toolName);
    if (!tool) throw new Error('Unknown or unsupported DevTools tool; call list_tools for available tools.');
    const pages = await this.pages();
    const page = pages.find((item) => item.pageId === args.pageId);
    if (!page) throw new Error('The page is no longer a verified preview of the selected project. Call list_pages again.');
    if (args.toolArgs !== undefined && (!args.toolArgs || Array.isArray(args.toolArgs) || typeof args.toolArgs !== 'object')) throw new Error('toolArgs must be a JSON object.');
    const parameters = { ...(args.toolArgs || {}) };
    if (tool.inputSchema.properties.pageId) parameters.pageId = page.pageId;
    for (const name of Object.keys(parameters).filter((name) => /filePath$/i.test(name))) parameters[name] = this.artifactPath(parameters[name]);
    if (args.toolName === 'performance_start_trace') {
      if (this.trace) throw new Error('A performance trace is already active; stop it before starting another.');
      parameters.reload ??= false;
      parameters.autoStop ??= false;
      parameters.filePath ??= this.artifactPath(undefined, '.json.gz');
    }
    if (args.toolName === 'performance_stop_trace') {
      if (!this.trace || this.trace.pageId !== page.pageId) throw new Error('No performance trace owned by this session is active on that page.');
      parameters.filePath ??= this.trace.filePath;
    }
    if (args.toolName === 'take_heapsnapshot') parameters.filePath ??= this.artifactPath(undefined, '.heapsnapshot');
    if ('pageSize' in tool.inputSchema.properties) parameters.pageSize ??= 50;
    const upstream = await this.client.callTool(args.toolName, parameters);
    requireResult(upstream);
    if (args.toolName === 'performance_start_trace' && !parameters.autoStop) this.trace = { pageId: page.pageId, instanceId: page.instanceId, filePath: parameters.filePath };
    if (args.toolName === 'performance_stop_trace') this.trace = null;
    return { page, toolName: args.toolName, artifacts: Object.fromEntries(Object.entries(parameters).filter(([name]) => /filePath$/i.test(name))), upstream };
  }

  async disconnect() {
    let stoppedTrace = null;
    let warning;
    if (this.client && this.trace) {
      try { stoppedTrace = requireResult(await this.client.callTool('performance_stop_trace', { pageId: this.trace.pageId, filePath: this.trace.filePath })); }
      catch (error) { warning = `Trace stop was not confirmed: ${error.message}`; }
    }
    this.client?.close();
    this.client = null;
    this.tools = null;
    this.trace = null;
    this.verifiedPages = [];
    this.verifiedAt = null;
    return { disconnected: true, ...(stoppedTrace ? { stoppedTrace } : {}), ...(warning ? { warning } : {}) };
  }
}

module.exports = { CocosDevtools, DEVTOOLS_TOOL, ALLOWED_TOOLS, isPreviewUrl };
