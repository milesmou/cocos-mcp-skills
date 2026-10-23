'use strict';

const crypto = require('crypto');
const path = require('path');

/** Fixed bridge defaults; project files and environment variables cannot hide tools. */
const DEFAULTS = Object.freeze({
  host: '127.0.0.1', port: 8765, portMode: 'project', toolProfile: 'full',
  enabledTools: Object.freeze([]), disabledTools: Object.freeze([]),
  enabledToolCategories: Object.freeze([]), disabledToolCategories: Object.freeze([]),
  enableSessions: false, enableConsoleLogging: true, executeJavascriptSafetyChecks: true,
  autostart: true, maxInteractionLogEntries: 50,
});

function getProjectPath() {
  if (global.Editor && Editor.Project && typeof Editor.Project.path === 'string' && Editor.Project.path) {
    return Editor.Project.path;
  }
  return process.cwd();
}

function getProjectName() {
  return path.basename(getProjectPath());
}

function normalizeProjectIdentityPath(projectPath) {
  const normalized = path.resolve(String(projectPath || process.cwd())).replace(/\\/g, '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function getProjectIdentity(projectPath = getProjectPath()) {
  return crypto
    .createHash('sha256')
    .update(`funplay-cocos-mcp:${normalizeProjectIdentityPath(projectPath)}`)
    .digest('hex')
    .slice(0, 24);
}

function getProjectPort(projectPath = getProjectPath()) {
  return 20000 + (parseInt(getProjectIdentity(projectPath).slice(0, 8), 16) % 10000);
}

function getCocosVersion() {
  if (global.Editor && Editor.App) {
    if (typeof Editor.App.version === 'string' && Editor.App.version) {
      return Editor.App.version;
    }
    if (typeof Editor.App.ver === 'string' && Editor.App.ver) {
      return Editor.App.ver;
    }
  }
  return 'unknown';
}

/** Build a fresh configuration using the selected project's stable loopback port. */
function loadConfig(options = {}) {
  const projectPath = options.projectPath || getProjectPath();
  return { ...DEFAULTS, projectPath, port: getProjectPort(projectPath),
    enabledTools: [], disabledTools: [], enabledToolCategories: [], disabledToolCategories: [],
    configPath: '', configError: '',
  };
}

module.exports = { DEFAULTS, getProjectPath, getProjectName, getProjectIdentity, getProjectPort, getCocosVersion, loadConfig };
