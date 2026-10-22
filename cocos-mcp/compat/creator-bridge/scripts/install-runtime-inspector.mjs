#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { readProject } = require('../../../lib/project-bridge');
const { installPreviewTemplate } = require('../../../lib/preview-template');
const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('Usage: node install-runtime-inspector.mjs --project <dir>\n');
} else {
  if (argv.length !== 2 || argv[0] !== '--project' || !argv[1]) throw new Error('Usage: node install-runtime-inspector.mjs --project <dir>');
  const project = readProject(resolve(argv[1]));
  const result = installPreviewTemplate(project.projectPath);
  process.stdout.write(JSON.stringify({ ...result, next: 'Open or refresh the normal Creator Web preview after restarting an updated bridge.' }, null, 2) + '\n');
}
