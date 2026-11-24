import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const pathKey = (value) => resolve(value).replaceAll('\\', '/').toLowerCase();

async function relayEndpoint(projectPath) {
  const id = createHash('sha256').update('funplay-cocos-mcp:' + pathKey(projectPath)).digest('hex').slice(0, 24);
  const route = `/mcp/project/${id}/`;
  let config = null;
  try {
    config = JSON.parse((await readFile(join(projectPath, 'funplay-cocos-mcp.config.json'), 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const projectPort = 20000 + (parseInt(id.slice(0, 8), 16) % 10000);
  const port = config && config.portMode !== 'project' ? config.port ?? 8765 : projectPort;
  const host = config?.host === '::1' ? '[::1]' : config?.host || '127.0.0.1';
  const url = new URL(config?.clientConfigEntries?.codex?.url || `http://${host}:${port}${route}`);
  if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== route) {
    throw new Error('Funplay relay must use a project-scoped loopback endpoint');
  }
  return { id, url };
}

async function connectRelay(projectPath, relayPid, dashboardPid) {
  const { id, url } = await relayEndpoint(projectPath);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  let index = 0;
  async function rpc(method, params, notification = false) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(3500),
      body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id: ++index }), method, params })
    });
    if (!response.ok) throw new Error(`Funplay ${method}: HTTP ${response.status}`);
    const session = response.headers.get('mcp-session-id');
    if (session) headers['mcp-session-id'] = session;
    const body = await response.text();
    if (!body) return null;
    const event = body.match(/^data:\s*(\{.*\})\s*$/m);
    const message = JSON.parse(event ? event[1] : body);
    if (message.error) throw new Error(message.error.message);
    return message.result;
  }
  const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {},
    clientInfo: { name: 'cocos-skill-dashboard', version: '1.0' } });
  const context = init?.funplay?.context;
  if (!context?.expected_context || context.project_id !== id || pathKey(context.project_path) !== pathKey(projectPath)) {
    throw new Error('Funplay relay identity mismatch');
  }
  headers['MCP-Protocol-Version'] = init.protocolVersion;
  await rpc('notifications/initialized', {}, true);
  async function evaluate(code, args) {
    const response = await rpc('tools/call', { name: 'execute_javascript',
      arguments: { context: 'editor', expected_context: context.expected_context, code, args } });
    const result = response?.structuredContent ?? JSON.parse(response.content[0].text);
    if (!result.ok) throw new Error(result.summary || 'Funplay rejected the Dashboard relay request');
    return result.data;
  }

  const guard = `
    if (!process.connected || typeof process.send !== 'function' ||
        process.pid !== args.relayPid || process.ppid !== args.dashboardPid ||
        process.env.COCOS_DASHBOARD_VERSION !== '2.2.2') throw Error('Dashboard relay process changed');
  `;
  const identity = { relayPid, dashboardPid };
  await evaluate(guard + 'return true;', identity);
  return (target) => evaluate(guard + `
    await new Promise((resolve, reject) => process.send({ channel: 'open-project', options: { path: args.target } },
      error => error ? reject(error) : resolve()));
    return true;
  `, { ...identity, target });
}

export async function findDashboardRelay(projects, dashboardPid) {
  for (const project of projects) {
    for (const process of project.processes.filter(({ parentPid }) => parentPid === dashboardPid)) {
      try {
        return await connectRelay(project.path, process.pid, dashboardPid);
      } catch {
        // A Creator may have no active Funplay endpoint. Check the next verified child.
      }
    }
  }
  return null;
}
