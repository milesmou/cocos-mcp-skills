'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const DEVTOOLS_VERSION = '1.11.0';
function devtoolsDirectory() {
  return path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'cocos-mcp', 'devtools', DEVTOOLS_VERSION);
}
function devtoolsEntry(directory = devtoolsDirectory()) {
  const manifestPath = path.join(directory, 'node_modules/chrome-devtools-mcp/package.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Chrome DevTools runtime is not installed. Run node scripts/install-codex.js --devtools in the source repository.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.name !== 'chrome-devtools-mcp' || manifest.version !== DEVTOOLS_VERSION) throw new Error(`Expected chrome-devtools-mcp@${DEVTOOLS_VERSION}; reinstall the DevTools runtime.`);
  return path.join(path.dirname(manifestPath), manifest.bin['chrome-devtools-mcp']);
}

/** A private MCP child client; it never launches Chrome or retries tool calls. */
class DevtoolsClient {
  constructor({ entry, projectPath, spawnProcess = spawn, timeoutMs = 60000 } = {}) {
    this.entry = entry;
    this.projectPath = projectPath;
    this.spawnProcess = spawnProcess;
    this.timeoutMs = timeoutMs;
    this.pending = new Map();
    this.sequence = 0;
    this.child = null;
    this.stderr = '';
  }

  async start() {
    if (this.ready) return this.ready;
    this.ready = this.initialize();
    try { return await this.ready; } catch (error) { this.close(); throw error; }
  }

  async initialize() {
    const entry = this.entry || devtoolsEntry();
    const child = this.child = this.spawnProcess(process.execPath, [entry, '--autoConnect', '--experimentalStructuredContent', '--memoryDebugging', '--no-usage-statistics', '--no-performance-crux'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], ...(this.projectPath ? { cwd: this.projectPath } : {}),
      env: { ...process.env, CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1', CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1' },
    });
    let buffered = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buffered += chunk;
      if (Buffer.byteLength(buffered) > 32 * 1024 * 1024) return this.fail(new Error('DevTools response exceeds 32 MiB.'));
      let boundary;
      while ((boundary = buffered.indexOf('\n')) >= 0) {
        const line = buffered.slice(0, boundary); buffered = buffered.slice(boundary + 1);
        if (!line.trim()) continue;
        try {
          const packet = JSON.parse(line);
          if (packet.method === 'roots/list' && Object.prototype.hasOwnProperty.call(packet, 'id')) {
            const roots = this.projectPath ? [{ uri: pathToFileURL(this.projectPath + path.sep).href, name: path.basename(this.projectPath) }] : [];
            child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: packet.id, result: { roots } }) + '\n');
            continue;
          }
          const request = this.pending.get(packet.id);
          if (!request) continue;
          clearTimeout(request.timer); this.pending.delete(packet.id);
          if (packet.error) request.reject(new Error(packet.error.message));
          else request.resolve(packet.result);
        } catch (error) { this.fail(new Error(`Invalid DevTools MCP response: ${error.message}`)); }
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { this.stderr = (this.stderr + chunk).slice(-4000); });
    child.on('error', (error) => { if (this.child === child) this.fail(error); });
    child.on('exit', () => {
      if (this.child !== child) return;
      this.fail(new Error('DevTools MCP process exited. Reconnect before continuing; calls were not replayed.'));
      this.child = null;
      this.ready = null;
    });
    child.stdin.on('error', (error) => this.fail(error));
    const initialized = await this.request('initialize', { protocolVersion: '2025-11-25', capabilities: this.projectPath ? { roots: { listChanged: false } } : {}, clientInfo: { name: 'cocos-mcp', version: '0.1.0' } });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    this.info = initialized.serverInfo;
    return this;
  }

  request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('DevTools response timed out; the operation may still have run. No automatic replay.'));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try { this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  async listTools() { await this.start(); return (await this.request('tools/list', {})).tools; }
  async callTool(name, args = {}) { await this.start(); return this.request('tools/call', { name, arguments: args }); }
  fail(error) {
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
    this.pending.clear();
  }
  close() {
    this.fail(new Error('DevTools session disconnected.'));
    this.child?.kill();
    this.child = null;
    this.ready = null;
  }
}

module.exports = { DEVTOOLS_VERSION, devtoolsDirectory, devtoolsEntry, DevtoolsClient };
