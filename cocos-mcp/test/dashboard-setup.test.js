'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { createPanel } = require('../panel/shared');
function element(value = '') {
  return { value, textContent: '', disabled: false, hidden: false, className: '',
    classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} };
}
function fixture(t, handler = async () => ({})) {
  const previous = global.Editor; const calls = [];
  global.Editor = { Panel: { define: d => d }, Message: { request: async (pkg, name, ...args) => {
    calls.push({ name, args }); return handler(name, ...args);
  } } }; t.after(() => { global.Editor = previous; });
  const definition = createPanel('dashboard');
  const panel = { ...definition.methods, language: 'en', state: {
    clientTargets: [{ id: 'codex', configPath: '/fixture/config.toml', serverName: 'cocos-project' }], clientConfig: {} },
    $: { clientTargetSelect: element('codex'), configureClientBtn: element(), clientTargetStatus: element(), clientTargetDetails: element(), clientActionStatus: element() }, async refresh() {} };
  return { panel, calls, definition };
}
test('dashboard exposes connection setup without installing skills', async (t) => {
  const { panel, calls, definition } = fixture(t);
  assert.doesNotMatch(definition.template, /configureWithSkillsBtn|projectSkillsNotice|openProjectSkillsBtn/);
  await panel.configureClientSetup();
  assert.deepEqual(calls, [{ name: 'configure-client', args: ['codex'] }]);
  assert.equal(panel.$.clientActionStatus.className, 'action-status success');
});
test('failed configuration remains visible and releases the controls', async (t) => {
  const { panel } = fixture(t, async () => { throw new Error('Test failure'); });
  await panel.configureClientSetup();
  assert.match(panel.$.clientActionStatus.textContent, /Test failure/);
  assert.equal(panel.$.clientActionStatus.className, 'action-status error');
  assert.equal(panel.configuringClient, false);
  assert.equal(panel.$.configureClientBtn.disabled, false);
});
test('temporary fallback blocks setup without writes', async (t) => {
  const { panel, calls } = fixture(t); panel.state.clientConfig.configurationBlocked = true;
  await panel.configureClientSetup(); assert.equal(calls.length, 0);
});
test('concurrent clicks do not configure twice', async (t) => {
  let complete; const pending = new Promise(resolve => { complete = resolve; });
  const { panel, calls } = fixture(t, () => pending);
  const first = panel.configureClientSetup(); await panel.configureClientSetup();
  assert.equal(calls.length, 1); complete({}); await first;
});
