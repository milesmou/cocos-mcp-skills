'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { getProjectIdentity, loadConfig } = require('./config');
const { postJsonRpc } = require('../bin/funplay-cocos-mcp');
const { CONNECTION_FILE } = require('./connection-file');
const { installPreviewTemplate } = require('./preview-template');
const { requestCompatibilityBridge } = require('./runtime-client');

const RUNTIME_FILES = ['package.json', 'browser.js', 'scene.js', 'lib', 'panel', 'bin', 'LICENSE', 'NOTICE.md'];

function readProject(projectPath) {
  if (typeof projectPath !== 'string' || !path.isAbsolute(projectPath)) throw new Error('projectPath must be an absolute Cocos Creator project path.');
  const project = fs.realpathSync(projectPath);
  const manifest = JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8'));
  if (!/^3\.8(?:\.|$)/.test(String(manifest.creator && manifest.creator.version || ''))) {
    throw new Error('Expected a Cocos Creator 3.8.x project.');
  }
  if (!fs.statSync(path.join(project, 'assets')).isDirectory()) throw new Error('Project assets directory is missing.');
  return { projectPath: project, creatorVersion: manifest.creator.version, projectIdentity: getProjectIdentity(project) };
}

function exists(target) {
  try { fs.lstatSync(target); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function ensureExtension(project, name, source, entries) {
  const extensions = path.join(project, 'extensions');
  if (exists(extensions) && (fs.lstatSync(extensions).isSymbolicLink() || !fs.statSync(extensions).isDirectory())) {
    throw new Error('Project extensions must be a real directory.');
  }
  const target = path.join(extensions, name);
  if (exists(target)) {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Existing extension path is a symbolic link: ${target}`);
    const installed = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
    if (installed.name !== name || !installed.main || !fs.existsSync(path.join(target, installed.main))) {
      throw new Error(`Existing extension is incomplete or belongs to another package: ${target}`);
    }
    return { name, path: target, installed: false, version: installed.version };
  }
  fs.mkdirSync(extensions, { recursive: true });
  // Keep staging beside its destination so rename is atomic and partial copies are never loaded.
  const stage = path.join(extensions, `.cocos-install-${crypto.randomBytes(8).toString('hex')}`);
  fs.mkdirSync(stage);
  try {
    for (const entry of entries) fs.cpSync(path.join(source, entry), path.join(stage, entry), { recursive: true, errorOnExist: true, force: false });
    fs.renameSync(stage, target);
  } finally {
    if (path.dirname(path.resolve(stage)) !== path.resolve(extensions)) throw new Error('Invalid staging cleanup path.');
    if (exists(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
  const installed = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
  return { name, path: target, installed: true, version: installed.version };
}

/** Validate a real extension directory before moving it into a project-local backup. */
function validateExtension(directory, name) {
  if (fs.lstatSync(directory).isSymbolicLink() || !fs.statSync(directory).isDirectory()) throw new Error(`Extension must be a real directory: ${directory}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  if (manifest.name !== name || !manifest.main || !fs.existsSync(path.join(directory, manifest.main))) throw new Error(`Extension belongs to another package or is incomplete: ${directory}`);
}

/** Install one bridge; explicit legacy migration/upgrade keeps recoverable copies outside extensions. */
function installProjectBridge(project, sourceRoot, options = {}) {
  const extensions = [];
  const root = project.projectPath;
  const extensionRoot = path.join(root, 'extensions');
  if (exists(extensionRoot) && (fs.lstatSync(extensionRoot).isSymbolicLink() || !fs.statSync(extensionRoot).isDirectory())) throw new Error('Project extensions must be a real directory.');
  const legacyNames = ['funplay-cocos-mcp', 'cocos3-codex-bridge'].filter(name => exists(path.join(extensionRoot, name)));
  for (const name of legacyNames) validateExtension(path.join(extensionRoot, name), name);
  if (legacyNames.length && !options.migrateLegacy) throw new Error('Legacy Cocos extensions detected. Reconnect with migrateLegacy: true to back them up and replace them with cocos-mcp-bridge, then restart Creator.');
  const replacements = [...legacyNames];
  const unified = path.join(extensionRoot, 'cocos-mcp-bridge');
  if (options.replaceExisting && exists(unified)) { validateExtension(unified, 'cocos-mcp-bridge'); replacements.push('cocos-mcp-bridge'); }
  // Reject a conflicting destination before changing templates or moving any plugin.
  if (exists(unified)) validateExtension(unified, 'cocos-mcp-bridge');
  let backupDirectory = null;
  const moved = [];
  try {
    const previewTemplate = installPreviewTemplate(root, sourceRoot);
    if (replacements.length) {
      backupDirectory = path.join(root, 'temp/cocos-mcp-install', `bridge-${crypto.randomBytes(8).toString('hex')}`);
      fs.mkdirSync(path.join(backupDirectory, 'extensions'), { recursive: true });
      for (const name of replacements) {
        const source = path.resolve(extensionRoot, name);
        const destination = path.resolve(backupDirectory, 'extensions', name);
        if (path.dirname(source) !== path.resolve(extensionRoot) || path.dirname(destination) !== path.resolve(backupDirectory, 'extensions')) throw new Error('Invalid extension migration path.');
        fs.renameSync(source, destination);
        moved.push(name);
      }
    }
    extensions.push(ensureExtension(root, 'cocos-mcp-bridge', sourceRoot, RUNTIME_FILES));
    const migration = { removedExtensions: legacyNames, backupDirectory, replacedExisting: moved.includes('cocos-mcp-bridge') };
    if (backupDirectory) fs.writeFileSync(path.join(backupDirectory, 'migration.json'), JSON.stringify({ project: root, ...migration }, null, 2));
    return { extensions, previewTemplate, migration, restartRequired: extensions.some(extension => extension.installed) || moved.length > 0 };
  } catch (error) {
    // Restore legacy plugins after a failed copy; report any successful new installation.
    for (const name of moved.reverse()) {
      const original = path.join(extensionRoot, name);
      if (!exists(original)) fs.renameSync(path.join(backupDirectory, 'extensions', name), original);
    }
    error.completedExtensions = extensions;
    throw error;
  }
}

function connectionEndpoint(project) {
  const file = path.join(project.projectPath, 'temp', CONNECTION_FILE);
  if (exists(file)) {
    const connection = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (connection.schema !== 1 || connection.projectIdentity !== project.projectIdentity) throw new Error('Bridge connection file belongs to a different project or schema.');
    const endpoint = new URL(connection.url);
    if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
      throw new Error('Bridge endpoint must be a local http://127.0.0.1:<port>/ URL.');
    }
    return endpoint;
  }
  const config = loadConfig({ projectPath: project.projectPath });
  if (config.configError) throw new Error(config.configError);
  if (config.host !== '127.0.0.1') throw new Error('Codex connections require a loopback project bridge.');
  return new URL(`http://127.0.0.1:${config.port}/`);
}

async function rpc(endpoint, message, { sessionId = '', timeoutMs = 3000 } = {}) {
  const response = await postJsonRpc(endpoint, JSON.stringify(message), { sessionId, timeoutMs });
  if (response.statusCode === 202 && !response.body.trim()) return { response, packet: null };
  if (response.statusCode < 200 || response.statusCode >= 300) throw new Error(`Project bridge returned HTTP ${response.statusCode}.`);
  const packet = JSON.parse(response.body);
  if (packet.error) throw new Error(packet.error.message);
  return { response, packet };
}

async function openProjectConnection(project) {
  const endpoint = connectionEndpoint(project);
  const { response, packet } = await rpc(endpoint, {
    jsonrpc: '2.0', id: 'codex-connect', method: 'initialize',
    params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'cocos-mcp-codex', version: '0.1.0' } },
  });
  if (packet.result?.funplay?.projectIdentity !== project.projectIdentity) throw new Error('The running bridge belongs to a different Cocos project.');
  if (packet.result?.funplay?.server !== 'cocos-mcp-bridge') throw new Error('The unified cocos-mcp-bridge has not loaded. Save and fully restart Creator.');
  const sessionId = response.headers['mcp-session-id'] || '';
  await rpc(endpoint, { jsonrpc: '2.0', method: 'notifications/initialized' }, { sessionId });
  return { endpoint, sessionId, project };
}

async function checkCompatibilityBridge(project) {
  return requestCompatibilityBridge(project.projectPath, 'status');
}

async function forwardProjectRequest(connection, message, timeoutMs = 120000) {
  // A port can be reused by a different project after disconnect/restart.
  const identity = await new Promise((resolve, reject) => {
    const request = http.get(new URL('/health', connection.endpoint), { timeout: 3000 }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('Project bridge health check failed.');
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')).projectIdentity);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Project bridge health check timed out.')));
    request.on('error', reject);
  });
  if (identity !== connection.project.projectIdentity) throw new Error('The bridge endpoint now belongs to a different Cocos project.');
  const { packet } = await rpc(connection.endpoint, message, { sessionId: connection.sessionId, timeoutMs });
  return packet;
}

module.exports = { CONNECTION_FILE, RUNTIME_FILES, readProject, installProjectBridge, connectionEndpoint, openProjectConnection, checkCompatibilityBridge, forwardProjectRequest };
