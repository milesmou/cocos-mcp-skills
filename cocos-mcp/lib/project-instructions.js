'use strict';

const fs = require('fs');
const path = require('path');
const { resolveProjectFilePath: resolveProjectPath } = require('./path-safety');
const { readOptionalText, writeTextIfUnchanged } = require('./atomic-file');
const { getSkillsDirectory, getSkillProjectPath } = require('./skill-platforms');

const KNOWN_INSTRUCTION_PATHS = [
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules',
  '.windsurfrules',
  '.github/copilot-instructions.md',
];

function normalizeSkillName(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/g, '');
  if (!normalized) {
    throw new Error('skillName is required.');
  }
  return normalized;
}

function statFile(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (error) {
    return null;
  }
}

function decodeYamlScalar(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (text.startsWith('"')) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return text.slice(1, text.endsWith('"') ? -1 : undefined);
    }
  }
  if (text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function parseSkillMetadata(content) {
  const text = String(content || '');
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (frontmatter) {
    const values = {};
    for (const line of frontmatter[1].split(/\r?\n/)) {
      const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
      if (match) {
        values[match[1]] = decodeYamlScalar(match[2]);
      }
    }
    const name = String(values.name || '').trim();
    const description = String(values.description || '').trim();
    const validName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 63;
    const validDescription = Boolean(
      description && description.length <= 1024 && !/[<>]/.test(description)
    );
    return {
      name,
      description,
      format: 'frontmatter',
      valid: validName && validDescription,
    };
  }

  const title = /^#\s+(.+)$/m.exec(text);
  const description = /^Description:\s*(.+)$/m.exec(text);
  return {
    name: '',
    description: description ? description[1].trim() : '',
    title: title ? title[1].trim() : '',
    format: title || description ? 'legacy' : 'unknown',
    valid: false,
  };
}

function buildProjectSkillContent(options = {}) {
  const skillName = normalizeSkillName(options.skillName);
  const title = String(options.title || '').trim() || skillName;
  const description = String(options.description || '').trim() || `Project-specific workflow for ${title}.`;
  if (description.length > 1024) {
    throw new Error('Skill description must be 1024 characters or fewer.');
  }
  if (/[<>]/.test(description)) {
    throw new Error('Skill description cannot contain angle brackets.');
  }
  const body = String(options.instructions || '').trim() || [
    `Use this skill for ${title} work in this Cocos project.`,
    '',
    '- Inspect the active scene and project context before editing.',
    '- Prefer focused MCP tools before broad manual file edits.',
    '- Run relevant validation tools after changes.',
  ].join('\n');

  return [
    '---',
    `name: ${skillName}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Instructions',
    '',
    body,
    '',
  ].join('\n');
}

function listSkillFiles(projectPath, options = {}) {
  projectPath = getSkillProjectPath(projectPath, options);
  const skillRoot = resolveProjectPath(projectPath, getSkillsDirectory(options));
  if (!fs.existsSync(skillRoot)) {
    return [];
  }

  const skills = [];
  const stack = [skillRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = resolveProjectPath(projectPath, path.join(current, entry.name));
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.name === 'SKILL.md') {
        const stat = statFile(fullPath);
        const metadata = parseSkillMetadata(fs.readFileSync(fullPath, 'utf8'));
        skills.push({
          path: path.relative(projectPath, fullPath).replace(/\\/g, '/'),
          size: stat ? stat.size : 0,
          mtime: stat ? stat.mtime.toISOString() : '',
          name: metadata.name || path.basename(path.dirname(fullPath)),
          title: metadata.title || '',
          description: metadata.description,
          format: metadata.format,
          valid: metadata.valid,
        });
      }
    }
  }
  return skills.sort((left, right) => left.path.localeCompare(right.path));
}

function listProjectInstructions(projectPath, options = {}) {
  projectPath = getSkillProjectPath(projectPath, options);
  const files = [];
  for (const relativePath of KNOWN_INSTRUCTION_PATHS) {
    const fullPath = resolveProjectPath(projectPath, relativePath);
    const stat = statFile(fullPath);
    if (stat && stat.isFile()) {
      files.push({
        path: relativePath,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
      });
    }
  }

  return {
    files,
    skills: listSkillFiles(projectPath, options),
  };
}

function readProjectInstruction(projectPath, target) {
  const relativePath = String(target || '').trim();
  if (!relativePath) {
    throw new Error('target is required.');
  }
  const fullPath = resolveProjectPath(projectPath, relativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`Instruction file not found: ${relativePath}`);
  }
  return {
    path: relativePath,
    content: fs.readFileSync(fullPath, 'utf8'),
  };
}

function writeProjectInstruction(projectPath, options = {}) {
  const relativePath = String(options.target || '').trim();
  if (!relativePath) {
    throw new Error('target is required.');
  }
  const content = String(options.content || '');
  const fullPath = resolveProjectPath(projectPath, relativePath);
  const original = Object.prototype.hasOwnProperty.call(options, 'expectedContent') ? options.expectedContent : readOptionalText(fullPath);
  if (original !== null && options.overwrite === false) {
    throw new Error(`Instruction file already exists: ${relativePath}`);
  }
  writeTextIfUnchanged(fullPath, content, original);
  const stat = fs.statSync(fullPath);
  return {
    written: true,
    path: relativePath,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
  };
}

function createProjectSkill(projectPath, options = {}) {
  projectPath = getSkillProjectPath(projectPath, options);
  const skillName = normalizeSkillName(options.skillName);
  const relativePath = `${getSkillsDirectory(options)}/${skillName}/SKILL.md`;
  const content = buildProjectSkillContent({ ...options, skillName });
  return writeProjectInstruction(projectPath, {
    target: relativePath,
    content,
    overwrite: options.overwrite !== false,
  });
}

module.exports = {





  KNOWN_INSTRUCTION_PATHS,


  buildProjectSkillContent,

  createProjectSkill,
  listProjectInstructions,
  normalizeSkillName,
  parseSkillMetadata,
  readProjectInstruction,
  writeProjectInstruction,
};
