'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const extension = require('../browser');
const manifest = require('../package.json');
const { createPanel } = require('../panel/shared');
test('removed skill panel has no registration, menu or IPC entrypoints', () => {
  assert.equal(manifest.panels['project-skills'], undefined);
  assert.equal(manifest.contributions.menu.some(item => item.message === 'open-project-skills'), false);
  assert.ok(Object.keys(manifest.contributions.messages).every(name => !name.includes('project-skill')));
  for (const name of ['openProjectSkillsPanel', 'getProjectSkillsState', 'previewProjectSkillUpdate', 'installOrUpdateProjectSkill', 'restoreProjectSkillBackup', 'createProjectSkillFromPanel', 'revealProjectSkill']) assert.equal(extension.methods[name], undefined);
});
test('remaining panels contain no skill management controls or callbacks', (t) => {
  const previous = global.Editor; global.Editor = { Panel: { define: d => d } }; t.after(() => { global.Editor = previous; });
  for (const mode of ['dashboard', 'tool-exposure', 'settings']) {
    const panel = createPanel(mode);
    assert.doesNotMatch(panel.template, /projectSkillsNotice|builtInSkillList|configureWithSkillsBtn|skills_manager/);
    assert.equal(panel.methods.renderProjectSkills, undefined);
    assert.equal(panel.methods.installProjectSkill, undefined);
  }
});
