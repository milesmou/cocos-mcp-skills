'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const extension = require('../browser');

test('source distribution rejects upstream replacement before runtime initialization', async () => {
  await assert.rejects(
    extension.methods.installUpdate({ force: true, forceCheck: true }),
    /managed by cocos-mcp-skills source/
  );
  await assert.rejects(
    extension.methods.installGlobally({ force: true, forceCheck: true }),
    /managed by cocos-mcp-skills source/
  );
});
