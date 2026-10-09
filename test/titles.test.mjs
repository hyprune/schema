import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {atLeast} from '../lib/validate.mjs';

// Published schemas are frozen byte-for-byte, so these titles stay as they
// were published even though they name an earlier version (or none). Every
// other versioned schema, including all future ones, must name its own version
// in its title; docs label versions from the directory/$id, not the title.
const KNOWN_STALE_TITLES = {
  'v0.3/world.schema.json': 'Hyprune 0.2 world',
  'v0.4/common.schema.json': 'Hyprune 0.3 common',
  'v0.4/ipc.schema.json': 'Hyprune 0.3 ipc',
  'v0.5/common.schema.json': 'Hyprune 0.3 common',
  'v0.5/ipc.schema.json': 'Hyprune 0.3 ipc',
  'v0.6/common.schema.json': 'Hyprune 0.3 common',
  'v0.6/input.schema.json': 'Hyprune input keymap v2',
  'v0.7/common.schema.json': 'Hyprune 0.3 common',
  'v0.9/input.schema.json': null,
  'v0.9/ipc.schema.json': 'Hyprune IPC 0.8',
  'v0.10/ipc.schema.json': 'Hyprune IPC 0.8',
  'v0.15/ipc.schema.json': 'Hyprune IPC 0.14: efficient ink and persistent presentation overrides',
};
// The newest version with a known exception; nothing after it may be exempt.
const LAST_EXCEPTION = '0.15';

const root = new URL('../', import.meta.url);
const dirs = readdirSync(root).filter(d => /^v0(\.\d+)?$/.test(d));
const schemas = dirs.flatMap(d => readdirSync(new URL(d + '/', root)).filter(f => f.endsWith('.schema.json')).map(f => `${d}/${f}`));
const versionOf = path => (path.startsWith('v0/') ? '0.1' : path.split('/')[0].slice(1));
const names = (title, version) =>
  new RegExp(`(^|[^\\d.])${version === '0.1' ? '(v0|0\\.1)' : version.replace('.', '\\.')}(?!\\d)`).test(title ?? '');

test('versioned schema titles name their own version', () => {
  for (const path of schemas) {
    const {title, $id} = JSON.parse(readFileSync(new URL(path, root)));
    assert.equal($id, `https://hyprune.com/schema/${path}`, `${path}: $id must match its path`);
    if (Object.hasOwn(KNOWN_STALE_TITLES, path)) {
      assert.equal(title ?? null, KNOWN_STALE_TITLES[path], `${path}: frozen title changed`);
      continue;
    }
    assert.ok(names(title, versionOf(path)), `${path}: title ${JSON.stringify(title)} must name version ${versionOf(path)}`);
  }
});

test('stale-title exceptions are frozen history, not a loophole for new versions', () => {
  for (const path of Object.keys(KNOWN_STALE_TITLES)) {
    assert.ok(schemas.includes(path), `${path}: listed exception does not exist`);
    assert.ok(atLeast(LAST_EXCEPTION, versionOf(path)), `${path}: exceptions may not be added after ${LAST_EXCEPTION}`);
  }
});
