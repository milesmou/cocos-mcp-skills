import { randomUUID } from 'node:crypto';
import { readFile, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const values = [
  ['toolProfile', "'core'", "'full'"],
  ['enableConsoleLogging', 'true', 'false'],
  ['lastClientTargetId', "'claude_code'", "'codex'"]
];

export function patchFunplayDefaults(source) {
  const declaration = /^const DEFAULTS = \{\r?\n([\s\S]*?)^\};/gm;
  if ([...source.matchAll(declaration)].length !== 1) throw new Error('Unrecognized Funplay DEFAULTS declaration');
  return source.replace(declaration, (block) => {
    for (const [key, original, preferred] of values) {
      const entries = new RegExp(`^([ \\t]*${key}:[ \\t]*)([^,\\r\\n]+)(,)[ \\t]*(?=\\r?$)`, 'gm');
      const matches = [...block.matchAll(entries)];
      if (matches.length !== 1 || ![original, preferred].includes(matches[0][2].trim())) {
        throw new Error(`Unrecognized Funplay default for ${key}`);
      }
      block = block.replace(entries, (_line, prefix, _value, comma) => prefix + preferred + comma);
    }
    return block;
  });
}

async function applyDefaults(creatorVersion) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(creatorVersion ?? '')) {
    throw new Error('Usage: node apply-funplay-defaults.mjs --creator-version <version>');
  }
  const extension = join(homedir(), '.CocosCreator', 'builtin-extensions', creatorVersion, 'funplay-cocos-mcp');
  const manifest = JSON.parse(await readFile(join(extension, 'package.json'), 'utf8'));
  if (manifest.name !== 'funplay-cocos-mcp') throw new Error('The global extension is not Funplay Cocos MCP');

  const file = join(extension, 'lib', 'config.js');
  const source = await readFile(file, 'utf8');
  const updated = patchFunplayDefaults(source);
  if (updated !== source) {
    const temporary = join(dirname(file), `.cocos-skill-config-${randomUUID()}.tmp`);
    await writeFile(temporary, updated, { flag: 'wx', mode: (await stat(file)).mode });
    try {
      if (await readFile(file, 'utf8') !== source) throw new Error('Funplay config changed while preparing the patch');
      await rename(temporary, file);
    } finally {
      await unlink(temporary).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
  return { creatorVersion, extensionVersion: manifest.version, file, changed: updated !== source };
}

if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  try {
    const [option, creatorVersion, ...extra] = process.argv.slice(2);
    if (option !== '--creator-version' || extra.length) {
      throw new Error('Usage: node apply-funplay-defaults.mjs --creator-version <version>');
    }
    console.log(JSON.stringify(await applyDefaults(creatorVersion), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
