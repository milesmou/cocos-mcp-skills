'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SCRIPTS = ['runtime-agent.js', 'runtime-node-inspector.js'];
const LEGACY_INSPECTOR_HASHES = new Set([
  '00e3ce86ccc692f8a609e1bdbbe7a96baa4fc9253f1f9b2d5a5ecd8423bd69f0',
  '9139d085befb845a7f1bfb46ef12090e7c8e1ef5369ec3cdbf7871f106e0dcac',
]);
const hash = (content) => crypto.createHash('sha256').update(content).digest('hex');

function readOptional(file) {
  try { if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`Preview file is a symbolic link: ${file}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { return fs.readFileSync(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function installPreviewTemplate(projectPath, sourceRoot = path.resolve(__dirname, '..')) {
  const source = path.join(sourceRoot, 'preview-template');
  const target = path.join(projectPath, 'preview-template');
  try {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error('preview-template must be a real project directory.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const manifestPath = path.join(target, '.cocos-mcp-preview.json');
  const metadata = readOptional(manifestPath);
  const previous = metadata ? JSON.parse(metadata.toString('utf8')) : { files: {} };
  const plan = [];
  const hashes = {};
  for (const name of SCRIPTS) {
    const destination = path.join(target, name);
    try { if (fs.lstatSync(destination).isSymbolicLink()) throw new Error(`Preview script is a symbolic link: ${destination}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const wanted = fs.readFileSync(path.join(source, name));
    const existing = readOptional(destination);
    hashes[name] = hash(wanted);
    if (existing && hash(existing) === hashes[name]) continue;
    if (existing && previous.files?.[name] !== hash(existing) && !(name === 'runtime-node-inspector.js' && LEGACY_INSPECTOR_HASHES.has(hash(existing)))) {
      throw new Error(`Preview script has unmanaged local changes and was not overwritten: ${destination}`);
    }
    plan.push({ name, destination, content: wanted, previous: existing });
  }
  const indexPath = path.join(target, 'index.ejs');
  const oldIndex = readOptional(indexPath);
  let index = oldIndex ? oldIndex.toString('utf8') : fs.readFileSync(path.join(source, 'index.ejs'), 'utf8');
  for (const name of SCRIPTS) {
    const expression = new RegExp(`<script\\b[^>]*\\bsrc=["'](?:\\./)?${name.replaceAll('.', '\\.')}["'][^>]*>\\s*</script>`, 'i');
    if (expression.test(index)) continue;
    if (!/<\/body\s*>/i.test(index)) throw new Error('Existing preview index.ejs has no closing body tag.');
    const tag = `<script src="./${name}"></script>\n        `;
    const inspector = /<script\b[^>]*\bsrc=["'](?:\.\/)?runtime-node-inspector\.js["'][^>]*>/i;
    index = name === 'runtime-agent.js' && inspector.test(index) ? index.replace(inspector, (match) => tag + match) : index.replace(/<\/body\s*>/i, tag + '</body>');
  }
  if (!oldIndex || index !== oldIndex.toString('utf8')) plan.push({ name: 'index.ejs', destination: indexPath, content: Buffer.from(index), previous: oldIndex });
  fs.mkdirSync(target, { recursive: true });
  let backupDirectory = null;
  const changedFiles = [];
  try {
    for (const item of plan) {
      if (item.previous) {
        if (!backupDirectory) {
          backupDirectory = path.join(projectPath, 'temp/cocos-mcp-install', crypto.randomBytes(8).toString('hex'), 'preview-template');
          fs.mkdirSync(backupDirectory, { recursive: true });
        }
        fs.writeFileSync(path.join(backupDirectory, item.name), item.previous, { flag: 'wx' });
      }
      fs.writeFileSync(item.destination, item.content);
      changedFiles.push(item.name);
    }
    const nextMetadata = JSON.stringify({ schema: 1, files: hashes }, null, 2) + '\n';
    if (!metadata || metadata.toString('utf8') !== nextMetadata) fs.writeFileSync(manifestPath, nextMetadata);
    return { path: target, changedFiles, changed: plan.length > 0, createdTemplate: !oldIndex, backupDirectory, refreshRequired: plan.length > 0 };
  } catch (error) {
    error.previewTemplate = { path: target, changedFiles, backupDirectory, refreshRequired: changedFiles.length > 0 };
    throw error;
  }
}

module.exports = { installPreviewTemplate };
