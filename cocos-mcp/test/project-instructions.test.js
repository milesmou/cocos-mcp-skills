'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createProjectSkill,
  listProjectInstructions,
  parseSkillMetadata,
  readProjectInstruction,
  writeProjectInstruction,
} = require('../lib/project-instructions');

test('skill metadata validation follows Codex name and description constraints', () => {
  assert.equal(parseSkillMetadata('---\nname: scene-qa\ndescription: "Validate scenes."\n---\n').valid, true);
  assert.equal(parseSkillMetadata('---\nname: scene_qa\ndescription: "Validate scenes."\n---\n').valid, false);
  assert.equal(parseSkillMetadata('---\nname: scene-qa\ndescription: "Use <unsafe>."\n---\n').valid, false);
  assert.equal(parseSkillMetadata(`---\nname: ${'a'.repeat(64)}\ndescription: "Validate scenes."\n---\n`).valid, false);
});

test('project instruction helpers list, read, and write safe project files', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'funplay-cocos-instructions-'));
  const write = writeProjectInstruction(projectPath, {
    target: 'AGENTS.md',
    content: '# Agent Notes\n',
  });

  assert.equal(write.written, true);
  assert.equal(readProjectInstruction(projectPath, 'AGENTS.md').content, '# Agent Notes\n');

  const listed = listProjectInstructions(projectPath);
  assert.equal(listed.files.some((file) => file.path === 'AGENTS.md'), true);
});

test('createProjectSkill writes a Codex project skill', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'funplay-cocos-skill-'));
  const result = createProjectSkill(projectPath, {
    skillName: 'scene_qa',
    title: 'Scene QA',
    description: 'Validate Cocos scenes.',
  });

  assert.equal(result.path, '.agents/skills/scene-qa/SKILL.md');
  const content = readProjectInstruction(projectPath, result.path).content;
  assert.match(content, /^---\nname: scene-qa\ndescription: "Validate Cocos scenes\."\n---/);
  const listed = listProjectInstructions(projectPath);
  const listedSkill = listed.skills.find((skill) => skill.path === result.path);
  assert.equal(Boolean(listedSkill), true);
  assert.equal(listedSkill.valid, true);
  assert.equal(listedSkill.name, 'scene-qa');
});





test('project instruction helpers reject traversal outside the project', () => {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'funplay-cocos-instructions-safe-'));
  assert.throws(
    () => writeProjectInstruction(projectPath, { target: '../AGENTS.md', content: 'x' }),
    /outside the Cocos project/
  );
});
