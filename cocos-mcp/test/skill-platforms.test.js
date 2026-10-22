'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SKILL_PLATFORMS, getSkillsDirectory, getSkillProjectPath } = require('../lib/skill-platforms');
const { createProjectSkill } = require('../lib/project-instructions');
function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-platforms-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}
for (const platform of SKILL_PLATFORMS) {
  test(platform.id + ' supports explicitly authored custom project skills', (t) => {
    const root = project(t);
    const result = createProjectSkill(root, { clientId: platform.id, skillName: 'project-check', instructions: 'Check this project.' });
    assert.equal(result.path, getSkillsDirectory({ clientId: platform.id }) + '/project-check/SKILL.md');
    assert.ok(fs.existsSync(path.join(root, result.path)));
  });
}
test('Kimi uses its Git root while Codex and CodeBuddy retain the Cocos project root', (t) => {
  const root = project(t); fs.writeFileSync(path.join(root, '.git'), 'gitdir: elsewhere');
  const child = path.join(root, 'games/cocos'); fs.mkdirSync(child, { recursive: true });
  assert.equal(getSkillProjectPath(child, { clientId: 'kimi' }), root);
  for (const clientId of ['codex', 'codebuddy', 'opencode']) assert.equal(getSkillProjectPath(child, { clientId }), child);
});
