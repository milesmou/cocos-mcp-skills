'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

/** Read credentials only from the selected project's local extension descriptor. */
async function requestCompatibilityBridge(projectPath, method, args = [], timeoutMs = 3000) {
  const project = fs.realpathSync(projectPath);
  const info = JSON.parse(fs.readFileSync(path.join(project, 'temp/cocos-mcp-bridge.json'), 'utf8'));
  if (info.schema !== 1 || info.host !== '127.0.0.1' || !Number.isInteger(info.port) || info.port < 1 || info.port > 65535 || typeof info.token !== 'string' || !info.token || fs.realpathSync(info.project) !== project) {
    throw new Error('Runtime bridge is unavailable or belongs to another project.');
  }
  const body = JSON.stringify({ token: info.token, target: 'bridge', method, args });
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: info.host, port: info.port, path: '/request', method: 'POST', headers: {
      'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
    } }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) response.destroy(new Error('Runtime result exceeds 2 MiB.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (response.statusCode !== 200 || !payload.ok) throw new Error(payload.error || 'Runtime bridge request failed.');
          resolve(payload.result);
        } catch (error) { reject(error); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('Runtime bridge request timed out; execution may still be running. Do not replay automatically.')), timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
    request.end(body);
  });
}

module.exports = { requestCompatibilityBridge };
