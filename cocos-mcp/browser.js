'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const manifest = require('./package.json');
/** Authenticated helpers and the runtime relay share this extension's lifecycle. */
const creatorBridge = require('./lib/creator-bridge/main');
const { loadConfig, getProjectPath, getProjectName, getProjectIdentity, getProjectPort, getCocosVersion } = require('./lib/config');
const { McpServer } = require('./lib/server');
const { createToolRegistry } = require('./lib/tool-registry');
const { ResourceProvider } = require('./lib/resources');
const { PromptProvider } = require('./lib/prompts');
const { InteractionLog } = require('./lib/interaction-log');
const { RuntimeLog } = require('./lib/runtime-log');
const { captureScriptExecution } = require('./lib/script-execution');
const { ConnectionFile } = require('./lib/connection-file');

const EXTENSION_NAME = manifest.name;
const LOG_PREFIX = '[Cocos MCP]';
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

class ExtensionService {
  constructor() {
    this.config = null;
    this.server = null;
    this.toolRegistry = null;
    this.resourceProvider = null;
    this.promptProvider = null;
    this.interactionLog = new InteractionLog();
    this.runtimeLog = new RuntimeLog();
    this.connectionFile = new ConnectionFile();
  }

  log(level, message, details) {
    if (this.runtimeLog && typeof this.runtimeLog.add === 'function') {
      this.runtimeLog.add(level, message, details);
    }
    if (this.config && this.config.enableConsoleLogging === false) return;
    const output = `${LOG_PREFIX} ${message}`;
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  /** Start the default MCP service automatically when Creator loads the bridge. */
  load() {
    this.reloadRuntime();
    this.log('info', 'Extension loading...');
    return this.startServer();
  }

  async unload() {
    this.log('info', 'Extension unloading...');
    this.connectionFile.remove();
    if (this.server) {
      await this.server.stop();
      this.server = null;
    }
    this.log('info', 'Extension unloaded.');
  }

  reloadRuntime() {
    this.config = loadConfig();
    this.interactionLog = new InteractionLog(this.config.maxInteractionLogEntries);
    this.runtimeLog = new RuntimeLog(this.config.maxInteractionLogEntries);
    this.log(
      'info',
      `Runtime config loaded: host=${this.config.host}, port=${this.config.port}, ` +
      `profile=${this.config.toolProfile}, autostart=${this.config.autostart}`
    );
    const sceneBridge = {
      call: async (method, payload) => {
        if (!global.Editor || !Editor.Message || typeof Editor.Message.request !== 'function') {
          throw new Error('Editor.Message.request is unavailable in the Cocos extension host.');
        }

        return await Editor.Message.request('scene', 'execute-scene-script', {
          name: EXTENSION_NAME,
          method,
          args: [payload || {}],
        });
      },
    };

    const runtimeContext = () => ({
      extensionName: EXTENSION_NAME,
      version: manifest.version || '0.0.0',
      config: this.config,
      projectPath: getProjectPath(),
      projectName: getProjectName(),
      projectIdentity: getProjectIdentity(),
      cocosVersion: getCocosVersion(),
      packagePath: path.dirname(__filename),
    });

    this.toolRegistry = createToolRegistry({
      getRuntimeContext: runtimeContext,
      getStatus: () => this.getStatus(),
      interactionLog: this.interactionLog,
      runtimeLog: this.runtimeLog,
      sceneBridge,
      editorExecutor: async (payload) => await this.executeEditorScript(payload, runtimeContext),
    });
    this.resourceProvider = new ResourceProvider(runtimeContext, sceneBridge, this.interactionLog, this.runtimeLog);
    this.promptProvider = new PromptProvider(runtimeContext, { onWarning: (message) => this.log('warn', message) });
  }

  async startServer() {
    if (this.server && this.server.isRunning()) {
      this.log('info', `Start requested but MCP server is already running at ${this.getStatus().url}`);
      return this.getStatus();
    }

    this.log('info', 'Starting MCP server...');
    this.reloadRuntime();
    this.server = new McpServer({
      config: this.config,
      interactionLog: this.interactionLog,
      runtimeLog: this.runtimeLog,
      toolRegistry: this.toolRegistry,
      resourceProvider: this.resourceProvider,
      promptProvider: this.promptProvider,
      serverName: `Cocos MCP - ${getProjectName()}`,
      serverVersion: manifest.version || '0.0.0',
      projectName: getProjectName(),
      projectIdentity: getProjectIdentity(),
    });

    await this.server.start();
    this.connectionFile.write(getProjectPath(), this.getStatus());
    this.log('info', `MCP server started at ${this.getStatus().url}`);
    return this.getStatus();
  }

  async stopServer() {
    this.log('info', 'Stop requested.');
    this.connectionFile.remove();
    if (this.server) {
      await this.server.stop();
      this.server = null;
      this.log('info', 'MCP server stopped.');
    } else {
      this.log('info', 'Stop requested but MCP server was not running.');
    }
    return this.getStatus();
  }

  async restartServer() {
    this.log('info', 'Restart requested.');
    await this.stopServer();
    const status = await this.startServer();
    this.log('info', `Restart completed. MCP server running=${status.running}, url=${status.url}`);
    return status;
  }

  getEffectiveServerConnection() {
    const port = this.server && this.server.isRunning() && typeof this.server.getPort === 'function'
      ? this.server.getPort()
      : this.config.port;
    return {
      host: this.config.host,
      port,
      url: `http://${this.config.host}:${port}/`,
    };
  }

  getStatus() {
    const effective = this.getEffectiveServerConnection();
    const fallbackInfo = this.server && this.server.isRunning() && typeof this.server.getPortFallbackInfo === 'function'
      ? this.server.getPortFallbackInfo()
      : null;
    const attachInfo = this.server && this.server.isRunning() && typeof this.server.getAttachInfo === 'function'
      ? this.server.getAttachInfo()
      : null;
    return {
      running: Boolean(this.server && this.server.isRunning()),
      attachedToExisting: Boolean(attachInfo),
      attachInfo,
      host: this.config.host,
      port: effective.port,
      requestedPort: this.config.port,
      portMode: this.config.portMode,
      derivedPort: getProjectPort(),
      portFallbackActive: Boolean(fallbackInfo),
      portFallbackInfo: fallbackInfo,
      toolProfile: this.config.toolProfile,
      enabledTools: this.config.enabledTools,
      disabledTools: this.config.disabledTools,
      enabledToolCategories: this.config.enabledToolCategories,
      disabledToolCategories: this.config.disabledToolCategories,
      enableSessions: this.config.enableSessions,
      enableConsoleLogging: this.config.enableConsoleLogging,
      executeJavascriptSafetyChecks: this.config.executeJavascriptSafetyChecks,
      autostart: this.config.autostart,
      version: manifest.version || '0.0.0',
      projectPath: getProjectPath(),
      projectName: getProjectName(),
      projectIdentity: getProjectIdentity(),
      cocosVersion: getCocosVersion(),
      url: effective.url,
    };
  }

  /** Dispatch an IPC tool call through the same registry used by HTTP MCP. */
  async callTool(name, args) {
    this.ensureRuntime();
    this.log('info', `Calling tool: ${name}`);
    return await this.toolRegistry.callTool(name, args || {});
  }

  async executeEditorScript(payload, runtimeContext) {
    const code = String(payload && payload.code || '');
    if (!code.trim()) {
      throw new Error('code is required.');
    }

    const args = payload && payload.args ? payload.args : {};
    const context = runtimeContext();
    const helpers = {
      getStatus: () => this.getStatus(),
      listTools: () => this.toolRegistry.listTools(),
      readResource: async (uri) => await this.resourceProvider.readResource(uri),
      callTool: async (name, toolArgs) => await this.toolRegistry.callTool(name, toolArgs || {}),
    };

    const execute = async (scriptConsole) => {
      const runner = new AsyncFunction(
        'require',
        'Editor',
        'args',
        'context',
        'helpers',
        'fs',
        'path',
        'os',
        'console',
        `
      const module = { exports: {} };
      const exports = module.exports;
      ${code}
      if (typeof run === 'function') {
        return await run({ Editor, args, context, helpers, fs, path, os, require, console });
      }
      if (typeof module.exports === 'function') {
        return await module.exports({ Editor, args, context, helpers, fs, path, os, require, console });
      }
      if (module.exports && typeof module.exports.run === 'function') {
        return await module.exports.run({ Editor, args, context, helpers, fs, path, os, require, console });
      }
        `
      );
      return await runner(require, global.Editor, args, context, helpers, fs, path, os, scriptConsole);
    };
    return payload.captureActivity
      ? captureScriptExecution(execute, { context: 'editor', targetConsole: console })
      : execute(console);
  }

  ensureRuntime() {
    if (!this.config || !this.toolRegistry || !this.resourceProvider || !this.promptProvider) {
      this.reloadRuntime();
    }
  }
}

const service = new ExtensionService();

module.exports = {
  load() {
    creatorBridge.load();
    try {
      return Promise.resolve(service.load()).catch(async (error) => { creatorBridge.unload(); await service.unload(); throw error; });
    } catch (error) {
      creatorBridge.unload(); void service.unload(); throw error;
    }
  },
  async unload() {
    try { await service.unload(); } finally { creatorBridge.unload(); }
  },
  methods: {
    /** Report the authenticated transport without exposing its token. */
    bridgeStatus() { return creatorBridge.methods.bridgeStatus(); },
    startServer() { return service.startServer(); },
    stopServer() { return service.stopServer(); },
    restartServer() { return service.restartServer(); },
    getStatus() { service.ensureRuntime(); return service.getStatus(); },
    callTool(name, args) { return service.callTool(name, args); },
  },
};
