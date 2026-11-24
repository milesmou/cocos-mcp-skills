import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { hasDashboardWork } from '../scripts/dashboard-launch.mjs';

const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/dashboard-projects.mjs', import.meta.url));

test('Dashboard snapshots preserve project identity and support version filters and preflight', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cocos-dashboard-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'first branch', 'SameName');
  const duplicate = join(root, 'second branch', 'SameName');
  const editor = join(root, 'CocosCreator.exe');
  await mkdir(join(project, 'assets'), { recursive: true });
  await writeFile(join(project, 'package.json'), JSON.stringify({ creator: { version: '3.8.8' } }));
  await writeFile(editor, '');
  await writeFile(join(root, 'project.json'), '\uFEFF' + JSON.stringify({ map: {
    [project]: { type: '3D', version: '3.8.7', progress: 'open' },
    [duplicate]: { type: '3D', version: '3.7.4' }
  } }));
  await writeFile(join(root, 'editor.json'), JSON.stringify({ editor: { Creator3D: [
    { version: '3.8.8', file: editor, progress: 'finish' },
    { version: '3.8.7', file: join(root, 'missing.exe'), progress: 'finish' }
  ] } }));

  async function run(command, ...args) {
    const { stdout } = await execFileAsync(process.execPath, [script, command, '--profiles', root, ...args]);
    return JSON.parse(stdout);
  }

  const all = await run('projects', '--snapshot', '--filter', '{"name":"SameName"}');
  assert.deepEqual(all.projects.map(({ path, running }) => [path, running]), [[project, null], [duplicate, null]]);
  assert.equal(all.projects[1].exists, false);
  const filtered = await run('projects', '--snapshot', '--type', '3D', '--version', '>=3.8.5 <3.9.0');
  assert.deepEqual(filtered.projects.map(({ path }) => path), [project]);
  await assert.rejects(run('projects', '--snapshot', '--version', '<bad'), /Invalid SemVer range/);

  const { editors } = await run('editors', '--type', 'Creator3D');
  assert.deepEqual(editors.map(({ version, installed }) => [version, installed]), [['3.8.8', true], ['3.8.7', false]]);
  const inspected = (await run('inspect', '--snapshot', '--path', project)).project;
  assert.equal(inspected.registration.version, '3.8.7');
  assert.equal(inspected.configuredVersion, '3.8.8');
  assert.equal(inspected.editors[0].file, editor);
  assert.equal(inspected.assets, true);
});

test('open refuses alternate registries and relative project paths before launching Dashboard', async () => {
  const run = (...args) => execFileAsync(process.execPath, [script, 'open', ...args]);
  await assert.rejects(run('--path', join(tmpdir(), 'Project'), '--profiles', tmpdir()), /Unknown option: --profiles/);
  await assert.rejects(run('--path', 'relative-project'), /--path must be an absolute project directory/);
});

test('Dashboard restart preflight preserves project operations and editor downloads or upgrades', () => {
  const idleProjects = { map: { project: { progress: 'idle', state: 'success' } } };
  const idleEditors = { editor: { Creator3D: [{ progress: 'finish', state: 'success' }] } };
  assert.equal(hasDashboardWork(idleProjects, idleEditors), false);
  assert.equal(hasDashboardWork({ map: { project: { progress: 'create', state: 'executing' } } }, idleEditors), true);
  assert.equal(hasDashboardWork(idleProjects, { editor: { Creator3D: [{ progress: 'download' }] } }), true);
  assert.equal(hasDashboardWork(idleProjects, { editor: { Creator3D: [{ progress: 'finish', upgrading: true }] } }), true);
});
