import assert from 'node:assert/strict';
import { test } from 'node:test';

import { patchFunplayDefaults } from '../scripts/apply-funplay-defaults.mjs';

const source = [
  'const DEFAULTS = {',
  "  toolProfile: 'core',",
  '  enableConsoleLogging: true,',
  "  lastClientTargetId: 'claude_code',",
  '  executeJavascriptSafetyChecks: true,',
  '};',
  "const unrelated = { toolProfile: 'core' };",
  ''
].join('\r\n');

test('patches only the Funplay defaults and preserves line endings', () => {
  const expected = source
    .replace("  toolProfile: 'core',", "  toolProfile: 'full',")
    .replace('enableConsoleLogging: true,', 'enableConsoleLogging: false,')
    .replace("lastClientTargetId: 'claude_code',", "lastClientTargetId: 'codex',");
  assert.equal(patchFunplayDefaults(source), expected);
  assert.equal(patchFunplayDefaults(expected), expected);
});

test('rejects an unrecognized default before patching', () => {
  assert.throws(() => patchFunplayDefaults(source.replace("'claude_code'", "'other_client'")),
    /Unrecognized Funplay default for lastClientTargetId/);
  assert.throws(() => patchFunplayDefaults(source.replace('const DEFAULTS', 'const NEW_DEFAULTS')),
    /Unrecognized Funplay DEFAULTS declaration/);
});
