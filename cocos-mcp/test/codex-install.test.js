'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { installCodex } = require('../../scripts/install-codex');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-codex-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { repository: path.resolve(__dirname, '../..'), skillRoot: path.join(root, 'skills') };
}

test('dry-run changes neither Codex configuration nor skill directories', (t) => {
  const options = fixture(t);
  const plan = installCodex({ ...options, dryRun: true, run: () => assert.fail('dry-run must not run Codex') });
  assert.equal(plan.serverName, 'cocos-mcp');
  assert.equal(fs.existsSync(options.skillRoot), false);
});

test('Codex install registers the local service and links one unified skill idempotently', (t) => {
  const options = fixture(t);
  let registration;
  const calls = [];
  const run = (command, args) => {
    calls.push({ command, args });
    if (args[1] === 'list') return { status: 0, stdout: JSON.stringify(registration ? [registration] : []) };
    registration = { name: args[2], enabled: true, transport: { command: args[4], args: args.slice(5) } };
    return { status: 0, stdout: '' };
  };
  const installed = installCodex({ ...options, run });
  assert.equal(installed.installed, true);
  assert.equal(registration.name, 'cocos-mcp');
  assert.equal(fs.realpathSync(installed.skillPath), fs.realpathSync(path.join(options.repository, 'cocos-skill')));
  assert.equal(installCodex({ ...options, run }).alreadyRegistered, true);
  assert.equal(calls.filter((call) => call.args[1] === 'add').length, 1);
});

test('Codex install preserves conflicting server entries and existing user skills', (t) => {
  const options = fixture(t);
  assert.throws(() => installCodex({ ...options, run: () => ({ status: 0, stdout: '[{"name":"cocos-mcp","transport":{"url":"https://example.test"}}]' }) }), /already exists/);
  assert.equal(fs.existsSync(options.skillRoot), false);
  fs.mkdirSync(path.join(options.skillRoot, 'cocos-skill'), { recursive: true });
  assert.throws(() => installCodex({ ...options, run: () => assert.fail('must not change Codex') }), /Skill already exists/);
});

test('rename registers cocos-mcp before removing an owned legacy cocos entry', (t) => {
  const options = fixture(t);
  const plan = installCodex({ ...options, dryRun: true });
  const calls = [];
  const installed = installCodex({ ...options, run: (command, args) => {
    calls.push(args);
    return args[1] === 'list' ? { status: 0, stdout: JSON.stringify([{ name: 'cocos', enabled: true, transport: { command: plan.command, args: plan.args } }]) } : { status: 0 };
  } });
  assert.equal(installed.migratedLegacy, true);
  assert.deepEqual(calls.slice(1).map((args) => args.slice(0, 3)), [['mcp', 'add', 'cocos-mcp'], ['mcp', 'remove', 'cocos']]);
});

test('failed replacement registration keeps the legacy entry', (t) => {
  const options = fixture(t);
  const plan = installCodex({ ...options, dryRun: true });
  assert.throws(() => installCodex({ ...options, run: (command, args) => {
    if (args[1] === 'list') return { status: 0, stdout: JSON.stringify([{ name: 'cocos', transport: { command: plan.command, args: plan.args } }]) };
    assert.equal(args[1], 'add', 'legacy registration must not be removed');
    return { status: 1 };
  } }), /registration failed/);
});

test('unrelated or customized cocos entries remain intact', (t) => {
  const options = fixture(t);
  const plan = installCodex({ ...options, dryRun: true });
  const installed = installCodex({ ...options, run: (command, args) => {
    if (args[1] === 'list') return { status: 0, stdout: JSON.stringify([
      { name: 'cocos-mcp', enabled: true, transport: { command: plan.command, args: plan.args } },
      { name: 'cocos', enabled: true, transport: { command: plan.command, args: plan.args, env: { CUSTOM: 'preserve' } } },
    ]) };
    assert.fail('existing customized entries must not be changed');
  } });
  assert.equal(installed.migratedLegacy, false);
});
