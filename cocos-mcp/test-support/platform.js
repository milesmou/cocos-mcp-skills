'use strict';

const fs = require('node:fs');

function fileSymlinkOrSkip(t, target, link) {
  try {
    fs.symlinkSync(target, link);
    return true;
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) {
      t.skip(`File symlink creation unavailable: ${error.code}`);
      return false;
    }
    throw error;
  }
}

module.exports = { fileSymlinkOrSkip };
