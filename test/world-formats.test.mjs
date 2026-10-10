import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync} from 'node:fs';
import {validate, worldFormats} from '../lib/validate.mjs';
test('world formats are exactly the vendored world schema directories', () => {
  const root = new URL('../', import.meta.url);
  const dirs = readdirSync(root).filter(d => /^v0\.\d+$/.test(d) && existsSync(new URL(`${d}/world.schema.json`, root)))
    .map(d => d.slice(1)).sort((a, b) => Number(a.split('.')[1]) - Number(b.split('.')[1]));
  assert.deepEqual(worldFormats, ['0.1', ...dirs]);
  assert.ok(worldFormats.includes('0.7'));
});
test('every listed world format has a usable validator', () => {
  for (const version of worldFormats) {
    const result = validate('world', {formatVersion: version}, undefined, version);
    assert.equal(result.valid, false, version); // reachable schema; an empty world is invalid
  }
});
