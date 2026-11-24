#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, normalize } from 'node:path';
import { promisify } from 'node:util';

import semver from 'semver';

import { launchDashboardProject } from './dashboard-launch.mjs';

const execFileAsync = promisify(execFile);
const usage = `Usage:
  node dashboard-projects.mjs projects [--type 3D] [--version RANGE] [--filter JSON] [--snapshot]
  node dashboard-projects.mjs editors [--type Creator3D] [--version VERSION]
  node dashboard-projects.mjs inspect --path ABSOLUTE_PROJECT_PATH [--snapshot]
  node dashboard-projects.mjs open --path ABSOLUTE_PROJECT_PATH [--dashboard ABSOLUTE_DASHBOARD_EXE]

Use --profiles DIRECTORY with a query to read alternate Dashboard profiles. Use --snapshot to skip process lookup.
Open uses the local Windows Dashboard registration. Output is JSON.`;

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function jsonFile(file) {
  try {
    return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`, { cause: error });
  }
}

async function readRegistry(profiles, file, key) {
  const path = join(profiles, file);
  const registry = (await jsonFile(path))?.[key];
  if (!record(registry)) throw new Error(`Expected an object at ${key} in ${path}`);
  return registry;
}

async function pathStat(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) return null;
  try {
    return await stat(path);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

async function editorList(profiles) {
  const registry = await readRegistry(profiles, 'editor.json', 'editor');
  return Promise.all(Object.entries(registry).flatMap(([type, entries]) => {
    if (!Array.isArray(entries)) throw new Error(`Expected an editor list for ${type}`);
    return entries.map(async (info) => ({
      type,
      version: info.version ?? null,
      file: info.file ?? null,
      progress: info.progress ?? null,
      installed: info.progress === 'finish' && Boolean((await pathStat(info.file))?.isFile())
    }));
  }));
}

function pathKey(path) {
  const clean = normalize(path).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? clean.toLowerCase() : clean;
}

function processProjectPath(commandLine) {
  const args = commandLine.match(/(?:[^\s"]|"[^"]*")+/g)?.map((arg) => arg.replaceAll('"', '')) ?? [];
  const index = args.findIndex((arg) => /^--(?:project|path)(?:=|$)/i.test(arg));
  if (index < 0) return null;
  return args[index].includes('=') ? args[index].slice(args[index].indexOf('=') + 1) : args[index + 1];
}

async function runningProjects(snapshot) {
  if (snapshot) return { status: 'snapshot', projects: new Map() };
  if (process.platform !== 'win32') return { status: 'unavailable', projects: new Map(), reason: 'Windows process lookup is unavailable on this platform' };

  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$rows = @(Get-CimInstance Win32_Process -Filter "Name = 'CocosCreator.exe' OR Name = 'CocosCreator3D.exe'" |
  Select-Object ProcessId, ParentProcessId, ExecutablePath, CommandLine)
ConvertTo-Json -InputObject $rows -Compress`;
  try {
    const { stdout } = await execFileAsync('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const rows = JSON.parse(stdout);
    const projects = new Map();
    for (const row of rows) {
      if (!row.CommandLine) continue;
      const project = processProjectPath(row.CommandLine);
      if (!project || !isAbsolute(project)) continue;
      const key = pathKey(project);
      const processes = projects.get(key) ?? [];
      processes.push({ pid: row.ProcessId, parentPid: row.ParentProcessId, executable: row.ExecutablePath });
      projects.set(key, processes);
    }
    if (rows.some((row) => !row.CommandLine)) {
      return { status: 'partial', projects, reason: 'Some Creator command lines are inaccessible' };
    }
    return { status: 'live', projects };
  } catch (error) {
    return { status: 'unavailable', projects: new Map(), reason: error.code ?? error.name };
  }
}

function runtimeInfo(path, runtime) {
  const processes = runtime.projects.get(pathKey(path)) ?? [];
  return { running: processes.length > 0 ? true : runtime.status === 'live' ? false : null, processes };
}

async function projectList(registry, runtime) {
  return Promise.all(Object.entries(registry).map(async ([path, info]) => ({
    name: info.name ?? basename(path),
    directory: info.path ?? dirname(path),
    path,
    type: info.type ?? null,
    version: info.version ?? null,
    description: info.description ?? null,
    progress: info.progress ?? null,
    state: info.state ?? null,
    exists: Boolean((await pathStat(path))?.isDirectory()),
    ...runtimeInfo(path, runtime)
  })));
}

function projectFilter(values) {
  const filter = values.filter === undefined ? {} : JSON.parse(values.filter);
  if (!record(filter)) throw new Error('--filter requires a JSON object');
  if (values.type !== undefined) filter.type = values.type;
  if (values.version !== undefined) filter.version = values.version;
  const range = Object.hasOwn(filter, 'version') ? semver.validRange(filter.version) : null;
  if (Object.hasOwn(filter, 'version') && !range) throw new Error('Invalid SemVer range');
  return (project) => Object.entries(filter).every(([key, value]) => {
    if (key === 'version') return semver.satisfies(semver.coerce(project.version), range);
    return Object.hasOwn(project, key) && project[key] === value;
  });
}

async function inspectProject(path, registered, profiles, runtime) {
  const suppliedPath = normalize(path);
  const registration = registered.find((project) => pathKey(project.path) === pathKey(suppliedPath)) ?? null;
  const fullPath = registration?.path ?? suppliedPath;
  const exists = Boolean((await pathStat(fullPath))?.isDirectory());
  const assets = Boolean((await pathStat(join(fullPath, 'assets')))?.isDirectory());
  const packagePath = join(fullPath, 'package.json');
  const pkg = (await pathStat(packagePath))?.isFile() ? await jsonFile(packagePath) : null;
  const configuredVersion = typeof pkg?.creator?.version === 'string' ? pkg.creator.version : null;
  const version = configuredVersion ?? registration?.version;
  const editorType = registration?.type === '2D' ? 'Creator' : 'Creator3D';
  const editors = (await editorList(profiles)).filter((editor) => editor.type === editorType && editor.version === version);
  return { path: fullPath, exists, assets, configuredVersion, registration, editors, ...runtimeInfo(fullPath, runtime) };
}

async function readProjects(profiles, snapshot) {
  const [registry, runtime] = await Promise.all([
    readRegistry(profiles, 'project.json', 'map'),
    runningProjects(snapshot)
  ]);
  const registered = await projectList(registry, runtime);
  const status = { profiles, runtime: runtime.status, ...(runtime.reason && { runtimeReason: runtime.reason }) };
  return { registered, runtime, status };
}

async function openProject(project, profiles, dashboard, registered) {
  if (!project.registration) throw new Error('Project is not registered in Dashboard. Import it first.');
  if (project.registration.type !== '3D' || !project.exists || !project.assets || !project.configuredVersion) {
    throw new Error('Open requires a registered Creator 3.x project with assets and a configured Creator version');
  }
  if (project.registration.version !== project.configuredVersion) throw new Error('Dashboard and project Creator versions disagree');
  const editors = project.editors.filter((editor) => editor.installed);
  if (!editors.length) throw new Error('The matching Creator version must be installed in Dashboard');
  if (project.running) {
    const processes = project.processes.filter(({ executable }) =>
      executable && editors.some((editor) => pathKey(executable) === pathKey(editor.file)));
    if (!processes.length) throw new Error('The project is running, but its Creator installation could not be verified');
    return { status: 'already-running', path: project.path, version: project.configuredVersion, processes };
  }
  if (project.running === null) throw new Error('Could not verify whether the target project is already running');

  return launchDashboardProject(project, dashboard, async () => {
    const { registered, runtime } = await readProjects(profiles, false);
    return inspectProject(project.path, registered, profiles, runtime);
  }, { profiles, registered });
}

const commandOptions = {
  projects: ['type', 'version', 'filter', 'snapshot', 'profiles'],
  editors: ['type', 'version', 'profiles'],
  inspect: ['path', 'snapshot', 'profiles'],
  open: ['path', 'dashboard']
};

async function main([command, ...args]) {
  if (!command || command === '--help' || args.includes('--help')) {
    console.log(usage);
    return;
  }
  if (!Object.hasOwn(commandOptions, command)) throw new Error(`Unknown command: ${command}`);
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const key = option.slice(2);
    if (!option.startsWith('--') || !commandOptions[command].includes(key)) {
      throw new Error(`Unknown option: ${option}`);
    }
    if (key === 'snapshot') {
      values.snapshot = true;
      continue;
    }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`);
    values[key] = value;
  }
  const profiles = values.profiles ?? join(homedir(), '.Cocos', 'profiles');

  if (command === 'editors') {
    const editors = await editorList(profiles);
    return { profiles, editors: editors.filter((editor) =>
      (values.type === undefined || editor.type === values.type) &&
      (values.version === undefined || editor.version === values.version)) };
  }

  const matchesProject = command === 'projects' ? projectFilter(values) : null;
  if (command !== 'projects' && (!values.path || !isAbsolute(values.path))) throw new Error('--path must be an absolute project directory');
  if (command === 'open' && process.platform !== 'win32') throw new Error('Dashboard project launch is available on Windows');
  const { registered, runtime, status } = await readProjects(profiles, values.snapshot);
  if (command === 'projects') return { ...status, projects: registered.filter(matchesProject) };
  const project = await inspectProject(values.path, registered, profiles, runtime);
  if (command === 'inspect') return { ...status, project };
  const result = await openProject(project, profiles, values.dashboard, registered);
  if (['started', 'requested'].includes(result.status)) process.exitCode = 2;
  return result;
}

try {
  const result = await main(process.argv.slice(2));
  if (result) console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
