#!/usr/bin/env node
'use strict';

const { CodexGateway } = require('../lib/codex-gateway');
const { readMessage, writeMessage } = require('./funplay-cocos-mcp');

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.error('Usage: node cocos-mcp.js [--profile core|full]\nStarts the Codex-side MCP service. Use connect_cocos_project to install/check a project bridge.');
    return;
  }
  const profileIndex = args.indexOf('--profile');
  const profile = profileIndex < 0 ? 'core' : args[profileIndex + 1];
  if (!['core', 'full'].includes(profile) || args.length !== (profileIndex < 0 ? 0 : 2) || profileIndex > 0) throw new Error('Expected only --profile core|full.');
  const gateway = new CodexGateway({ profile });
  try {
    while (true) {
      const { message, framing } = await readMessage(process.stdin);
      if (message === null) break;
      let request;
      try { request = JSON.parse(message); }
      catch {
        await writeMessage(process.stdout, JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }), framing);
        continue;
      }
      const response = await gateway.handle(request);
      if (response) await writeMessage(process.stdout, JSON.stringify(response), framing);
    }
  } finally {
    const cleanup = await gateway.devtools.disconnect();
    if (cleanup.warning) console.error(`[Cocos MCP] ${cleanup.warning}`);
  }
}

if (require.main === module) main().catch((error) => { console.error(`[Cocos MCP] ${error.message}`); process.exitCode = 1; });

module.exports = { main };
