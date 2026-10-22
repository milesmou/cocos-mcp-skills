'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CONNECTION_FILE = 'cocos-mcp-connection.json';

class ConnectionFile {
  constructor() {
    this.owner = crypto.randomBytes(16).toString('hex');
    this.file = '';
  }

  write(projectPath, status) {
    this.file = path.join(projectPath, 'temp', CONNECTION_FILE);
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({
      schema: 1, owner: this.owner, pid: process.pid, projectPath,
      projectIdentity: status.projectIdentity, url: status.url, version: status.version,
    }, null, 2));
  }

  remove() {
    if (!this.file) return;
    try {
      if (JSON.parse(fs.readFileSync(this.file, 'utf8')).owner === this.owner) fs.unlinkSync(this.file);
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code) && !(error instanceof SyntaxError)) throw error;
    }
    this.file = '';
  }
}

module.exports = { CONNECTION_FILE, ConnectionFile };
