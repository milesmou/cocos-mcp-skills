'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const extension = require('../browser');
const manifest = require('../package.json');

test('source distribution has no upstream replacement or global-install entrypoints', () => {
  for (const method of ['installUpdate', 'installGlobally', 'autoCheckUpdates', 'openUpdateRelease']) assert.equal(extension.methods[method], undefined);
  for (const message of ['install-update', 'install-globally', 'auto-check-updates', 'open-update-release']) assert.equal(manifest.contributions.messages[message], undefined);
});
