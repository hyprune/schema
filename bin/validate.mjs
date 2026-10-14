#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { validate, validateRegistry, validateMotion } from '../lib/validate.mjs';
const registryKinds = ['registry-index', 'registry-entry', 'release-record', 'sources'];
const [kind, file, method, version, worldFile, asset, ...extra] = process.argv.slice(2);
// For kind `object` the fifth argument is the object's glTF (.gltf or .glb) for the cross-checks.
const gltfJson = path => {
  const bytes = readFileSync(path);
  if (!/\.glb$/i.test(path)) return JSON.parse(bytes.toString('utf8'));
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid GLB header/JSON chunk');
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
};
if (!kind || !file || extra.length || ((worldFile || asset) && kind !== 'scene' && kind !== 'object') || (asset && kind === 'object') ||
    ((registryKinds.includes(kind) || kind === 'motion') && method && method !== '-')) {
  console.error('Usage: hyprune-validate <world|extension|screen-type|ipc> <file.json|-> [response-method|-] [contract-version]\n' +
                '       hyprune-validate scene <scene.gltf> - <world-format> <world.json> [object-asset-id]\n' +
                '       hyprune-validate <object|library|library-releases> <file.json|-> [-] [format] [object scene.gltf|.glb]\n' +
                '       hyprune-validate <registry-index|registry-entry|release-record|sources> <file.json|-> [-] [registry version]\n' +
                '       hyprune-validate motion <motion.json|-> [-] [motion version]\n(in this repository: npm run validate -- ...)');
  process.exitCode = 2;
} else {
  try {
    const bytes = readFileSync(file === '-' ? 0 : file);
    // Indexes may be up to 16 MiB as served (RFC-0015); every other document 1 MiB.
    const cap = kind === 'registry-index' ? 16 * 1_048_576 : 1_048_576;
    if (bytes.length > cap) throw new Error(`Document exceeds ${cap / 1_048_576} MiB`);
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const options = kind === 'object' ? { gltf: worldFile ? gltfJson(worldFile) : undefined }
      : { world: worldFile ? JSON.parse(readFileSync(worldFile, 'utf8')) : undefined, asset };
    const result = kind === 'motion' ? validateMotion(value, version || undefined)
      : registryKinds.includes(kind) ? validateRegistry(kind, value, version || undefined)
      : validate(kind, value, method === '-' ? undefined : method, version || undefined, options);
    for (const warning of result.warnings || []) console.error(`warning: ${warning}`);
    if (result.valid) console.log(`VALID ${kind}: ${file}`);
    else { console.error(result.errors.join('\n')); process.exitCode = 1; }
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
