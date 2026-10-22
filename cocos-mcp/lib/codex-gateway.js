'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { createToolRegistry } = require('./tool-registry');
const { CONNECTION_FILE, readProject, installProjectBridge, openProjectConnection, checkCompatibilityBridge, forwardProjectRequest } = require('./project-bridge');
const { MCP_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } = require('./server');
const manifest = require('../package.json');
const { CocosDevtools, DEVTOOLS_TOOL } = require('./cocos-devtools');

const BOOTSTRAP_TOOLS = [
  {
    name: 'connect_cocos_project',
    description: 'Select a Cocos Creator 3.8 project by absolute path. Install missing project bridge extensions and return restart_required with instructions to restart Creator. Reuse existing extensions. Call again after restart to connect before editor operations.',
    inputSchema: {
      type: 'object', properties: {
        projectPath: { type: 'string', description: 'Absolute target Creator project directory.' },
        migrateLegacy: { type: 'boolean', default: false, description: 'Explicitly back up funplay-cocos-mcp/cocos3-codex-bridge and migrate to the single cocos-mcp-bridge extension. Requires Creator restart.' },
        includeCompatibilityBridge: { type: 'boolean', description: 'Deprecated compatibility parameter; the unified bridge always includes runtime and Prefab helpers.' },
      }, required: ['projectPath'], additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_cocos_connection', description: 'Report the selected project and check whether its editor bridge is ready. Works when Creator is not running.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function toolResult(data, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data, ...(isError ? { isError: true } : {}) };
}

class CodexGateway {
  constructor({ sourceRoot = path.resolve(__dirname, '..'), profile = 'core', devtoolsOptions = {} } = {}) {
    this.sourceRoot = sourceRoot;
    this.project = null;
    this.connection = null;
    this.pendingRestart = new Map();
    this.devtools = new CocosDevtools({ ...devtoolsOptions, getProject: () => this.project });
    this.state = { status: 'disconnected', connected: false, message: '请先调用 connect_cocos_project 指定目标 Cocos Creator 工程。' };
    this.tools = createToolRegistry({
      getRuntimeContext: () => ({ config: { toolProfile: profile }, projectPath: sourceRoot, version: manifest.version }),
      interactionLog: { add() {} }, runtimeLog: { add() {}, list: () => [] },
      sceneBridge: { call: async () => { throw new Error('Connect a project first.'); } },
    }).listTools();
  }

  async connect(args) {
    const previousProject = this.project;
    // A failed selection must never leave the previous project's write connection active.
    this.connection = null;
    this.project = null;
    this.state = { status: 'disconnected', connected: false };
    const cleanup = previousProject && (typeof args.projectPath !== 'string' || path.resolve(args.projectPath) !== previousProject.projectPath) ? await this.devtools.disconnect() : null;
    const project = readProject(args.projectPath);
    this.project = project;
    let installation;
    try {
      installation = installProjectBridge(project, this.sourceRoot, { migrateLegacy: args.migrateLegacy === true });
    } catch (error) {
      const completed = error.completedExtensions || [];
      const restartRequired = completed.some((extension) => extension.installed);
      if (restartRequired) this.pendingRestart.set(project.projectIdentity, Date.now());
      this.state = { ...project, status: 'connection_error', connected: false, extensions: completed, previewTemplate: error.previewTemplate || null, restartRequired, message: error.message };
      error.connectionState = this.state;
      throw error;
    }
    const { extensions, previewTemplate, migration } = installation;
    const installed = extensions.filter((extension) => extension.installed);
    const base = { ...project, extensions, previewTemplate, migration, documentationRoot: path.join(this.sourceRoot, 'docs'), ...(cleanup?.warning ? { devtoolsWarning: cleanup.warning } : {}) };
    if (installed.length || installation.restartRequired) {
      this.pendingRestart.set(project.projectIdentity, Date.now());
      return this.state = {
        ...base, status: 'restart_required', connected: false, restartRequired: true,
        message: '已安装缺失的工程桥接插件。请保存工作，完全退出并重新打开该工程的 Cocos Creator；若插件未启用，请在扩展管理器启用。重启后再次调用 connect_cocos_project。',
      };
    }
    return this.refresh(base);
  }

  async refresh(base = this.state) {
    if (!this.project) return this.state;
    this.connection = null;
    try {
      const installedAt = this.pendingRestart.get(this.project.projectIdentity);
      if (installedAt && fs.statSync(path.join(this.project.projectPath, 'temp', CONNECTION_FILE)).mtimeMs < installedAt) {
        throw new Error('The editor bridge has not restarted since installation.');
      }
      const helper = await checkCompatibilityBridge(this.project);
      this.connection = await openProjectConnection(this.project);
      this.pendingRestart.delete(this.project.projectIdentity);
      const { reason, ...current } = base;
      return this.state = { ...current, ...this.project, status: 'ready', connected: true, restartRequired: false,
        runtimeInspector: helper?.runtimeInspector || null,
        message: helper && !helper.runtimeInspector?.javascript ? '编辑器桥接已就绪；现有运行时桥接版本不支持 JavaScript，请升级桥接后重启 Creator。' : '工程桥接已就绪。运行时查询还需打开或刷新普通 Web 预览。' };
    } catch (error) {
      const pending = this.pendingRestart.has(this.project.projectIdentity);
      return this.state = {
        ...base, ...this.project, connected: false, status: pending ? 'restart_required' : 'editor_unavailable', restartRequired: pending,
        message: pending ? '请保存工作并重启该工程的 Cocos Creator，然后重新连接。' : '工程桥接尚未就绪。请打开目标工程；若刚安装插件，请重启 Creator 并确认扩展已启用，然后重新连接。',
        reason: error.message,
      };
    }
  }

  async handle(request) {
    const result = (value) => ({ jsonrpc: '2.0', id: request.id, result: value });
    const failure = (code, message) => ({ jsonrpc: '2.0', id: request?.id ?? null, error: { code, message } });
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return failure(-32600, 'Invalid Request');
    if (!Object.prototype.hasOwnProperty.call(request, 'id')) return null;
    if (request.method === 'initialize') return result({
      protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(request.params?.protocolVersion) ? request.params.protocolVersion : MCP_PROTOCOL_VERSION,
      serverInfo: { name: 'cocos-mcp', version: manifest.version },
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: 'Before editor operations, call connect_cocos_project with the absolute target project path. If restart_required, ask the user to save and restart Creator, then reconnect. Never treat installation as a ready connection.',
    });
    if (request.method === 'ping') return result({});
    if (request.method === 'tools/list') return result({ tools: [...BOOTSTRAP_TOOLS, DEVTOOLS_TOOL, ...this.tools] });
    if (request.method === 'tools/call') {
      const { name, arguments: args = {} } = request.params || {};
      try {
        if (name === 'connect_cocos_project') return result(toolResult(await this.connect(args)));
        if (name === 'get_cocos_connection') return result(toolResult(await this.refresh()));
        if (name === 'cocos_devtools') {
          try { return result(toolResult(await this.devtools.run(args))); }
          catch (error) { return result(toolResult({ status: 'devtools_error', message: error.message }, true)); }
        }
        if (!this.tools.some((tool) => tool.name === name)) return failure(-32602, `Unknown or disabled gateway tool: ${name}`);
        if (!this.connection) return result(toolResult(this.state, true));
      } catch (error) {
        return result(toolResult(error.connectionState || { status: 'connection_error', connected: false, message: error.message }, true));
      }
    }
    if (!this.connection) {
      if (request.method === 'resources/list') return result({ resources: [] });
      if (request.method === 'resources/templates/list') return result({ resourceTemplates: [] });
      if (request.method === 'prompts/list') return result({ prompts: [] });
      return failure(-32000, this.state.message || 'Connect a project first.');
    }
    try {
      return await forwardProjectRequest(this.connection, request);
    } catch (error) {
      this.connection = null;
      this.state = { ...this.state, status: 'editor_unavailable', connected: false, message: '编辑器连接已断开，请检查目标工程并重新连接。', reason: error.message };
      // Never replay a failed tool call: its editor-side effect may already have happened.
      return request.method === 'tools/call' ? result(toolResult(this.state, true)) : failure(-32000, error.message);
    }
  }
}

module.exports = { BOOTSTRAP_TOOLS, CodexGateway };
