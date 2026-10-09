#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validate } from '../lib/validate.mjs';
const [kind, file, method, version, worldFile, ...extra] = process.argv.slice(2);
if (!kind || !file || extra.length || (worldFile && kind !== 'scene')) {
  console.error('Usage: npm run validate -- <world|extension|screen-type|ipc> <file.json|-> [response-method|-] [contract-version]\n' +
                '       npm run validate -- scene <scene.gltf> - <world-format> <world.json>');
  process.exitCode = 2;
} else {
  try {
    const bytes = readFileSync(file === '-' ? 0 : file);
    if (bytes.length > 1_048_576) throw new Error('Document exceeds 1 MiB');
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const world = worldFile ? JSON.parse(readFileSync(worldFile, 'utf8')) : undefined;
    const result = validate(kind, value, method === '-' ? undefined : method, version, { world });
    if (result.valid) console.log(`VALID ${kind}: ${file}`);
    else { console.error(result.errors.join('\n')); process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
