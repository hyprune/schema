// RFC-0015 registry documents: index, entry file, release record, sources.json and the content lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateRegistry, registryVersions, registryLimits, parseSemver, compareSemver, tagVersion } from '../lib/validate.mjs';
const dir = new URL('../examples/registry/', import.meta.url);
const fixture = name => JSON.parse(readFileSync(new URL(name, dir)));
const kinds = { 'index.json': 'registry-index', 'entry.json': 'registry-entry', 'release-record.json': 'release-record', 'sources.json': 'sources', 'content-lock.json': 'content-lock' };

test('registry versions are discovered from registry/v0.N', () => assert.deepEqual(registryVersions, ['0.1']));
for (const [file, kind] of Object.entries(kinds))
  test(`valid ${kind}: examples/registry/${file}`, () => assert.deepEqual(validateRegistry(kind, fixture(file)), { valid: true, errors: [] }));
test('an index entry validates as an entry and the entry file has a $schema pointer', () => {
  for (const entry of fixture('index.json').entries) assert.equal(validateRegistry('registry-entry', entry).valid, true);
});
for (const name of readdirSync(new URL('invalid/', dir))) {
  const kind = name.split('--')[0];
  test(`invalid ${kind}: ${name}`, () => {
    const result = validateRegistry(kind, fixture('invalid/' + name));
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });
}
test('semantic errors name the problem', () => {
  const entry = fixture('entry.json');
  entry.versions.reverse();
  assert.match(validateRegistry('registry-entry', entry).errors.join('\n'), /newest first/);
  const index = fixture('index.json');
  index.entries.push(structuredClone(index.entries[0]));
  assert.match(validateRegistry('registry-index', index).errors.join('\n'), /duplicate id io\.github\.example-creator\.tidepool/);
  const record = fixture('release-record.json');
  record.source.tag = 'tidepool-v1.2.1';
  assert.match(validateRegistry('release-record', record).errors.join('\n'), /source\.tag: tidepool-v1\.2\.1 must name version 1\.2\.0/);
  const sources = fixture('sources.json');
  sources.custom[0].repo = 'example/repo';
  assert.match(validateRegistry('sources', sources).errors.join('\n'), /kind index takes no repo/);
});
test('multi-package tags and pre-releases', () => {
  const entry = fixture('entry.json');
  for (const v of entry.versions) v.tag = `tidepool-v${v.version}`;
  assert.equal(validateRegistry('registry-entry', entry).valid, true);
  entry.versions[1].version = '1.2.0-rc.01'; entry.versions[1].tag = 'v1.2.0-rc.01';
  assert.equal(validateRegistry('registry-entry', entry).valid, false);
});
test('per-type archive limits', () => {
  const index = fixture('index.json');
  index.entries[0].versions[0].bytes = registryLimits.world.bytes;
  assert.equal(validateRegistry('registry-index', index).valid, true);
  index.entries[1].versions[0].files = registryLimits.library.files + 1;
  assert.match(validateRegistry('registry-index', index).errors.join('\n'), /files 4001 exceed the library limit 4000/);
});
test('extension is a reserved entry type: it validates, without archive limits', () => {
  const index = fixture('index.json');
  index.entries.push({ ...structuredClone(index.entries[1]), id: 'io.github.ada.weather', type: 'extension', name: 'Weather' });
  index.entries.at(-1).versions[0].files = registryLimits.library.files + 1;
  assert.deepEqual(validateRegistry('registry-index', index), { valid: true, errors: [] });
  assert.equal(validateRegistry('registry-index', { ...index, entries: [{ ...index.entries[1], type: 'plugin' }] }).valid, false);
});
test('SemVer helpers', () => {
  const order = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.10.0', '2.0.0'];
  for (let i = 1; i < order.length; i++) { assert.equal(compareSemver(order[i - 1], order[i]), -1, `${order[i - 1]} < ${order[i]}`); assert.equal(compareSemver(order[i], order[i - 1]), 1); }
  assert.equal(compareSemver('1.0.0+a', '1.0.0+b'), 0);
  assert.equal(parseSemver('01.0.0'), undefined); assert.equal(parseSemver('1.0.0-01'), undefined);
  assert.deepEqual(parseSemver('1.2.3-rc.1+b'), { major: 1, minor: 2, patch: 3, prerelease: ['rc', '1'], build: 'b' });
  assert.throws(() => compareSemver('x', '1.0.0'), /Invalid SemVer/);
  assert.deepEqual(tagVersion('v1.2.0'), { name: null, version: '1.2.0' });
  assert.deepEqual(tagVersion('lumen-reach-v0.10.2'), { name: 'lumen-reach', version: '0.10.2' });
  assert.deepEqual(tagVersion('v1.3.0-rc.1'), { name: null, version: '1.3.0-rc.1' });
  for (const bad of ['1.2.0', 'release-1.2.0', 'V1.2.0', 'Lumen-v1.0.0', 'v1.2', 'x-v01.0.0']) assert.equal(tagVersion(bad), undefined, bad);
});
test('unknown kinds and versions are usage errors', () => {
  assert.throws(() => validateRegistry('registry-thing', {}), /Unknown registry kind/);
  assert.throws(() => validateRegistry('sources', {}, '0.9'), /Unknown registry version/);
});
test('the schema files are importable package paths', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.ok(pkg.files.includes('registry/'));
  for (const name of ['index', 'release-record', 'sources']) {
    const schema = JSON.parse(readFileSync(new URL(`../registry/v0.1/${name}.schema.json`, import.meta.url)));
    assert.equal(schema.$id, `https://hyprune.com/schema/registry/v0.1/${name}.schema.json`);
  }
});
test('CLI validates registry kinds', () => {
  const run = (...args) => spawnSync(process.execPath, ['bin/validate.mjs', ...args], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(run('registry-index', 'examples/registry/index.json').status, 0);
  assert.equal(run('release-record', 'examples/registry/release-record.json').status, 0);
  const bad = run('sources', 'examples/registry/invalid/sources--reserved-id.json');
  assert.equal(bad.status, 1); assert.match(bad.stderr, /reserved for a built-in source/);
});

test('content lock 0.1: packages with their fixed-output hashes', () => {
  const sha = '832cac3adeddc1873486f56b0ed25cf560c5d69d64453aac9c58f68305157ec3';
  const nix = 'sha256-' + Buffer.from(sha, 'hex').toString('base64');
  const pkg = { id: 'com.hyprune.starter', type: 'library', version: '0.3.0', tag: 'hyprune-starter-v0.3.0',
    url: 'https://github.com/hyprune/worlds/releases/download/hyprune-starter-v0.3.0/com.hyprune.starter-0.3.0.tar.zst',
    sha256: sha, nixHash: nix, sourceId: 'official', sourceLabel: 'Official', license: 'CC-BY-4.0' };
  const lock = { lockVersion: '0.1', generated: '2026-10-16T08:00:00Z', packages: [pkg, { ...pkg, id: 'io.github.ada.tidepool', type: 'world', version: '1.2.0', tag: 'v1.2.0', sourceId: 'community', sourceLabel: 'Community registry' }] };
  assert.deepEqual(validateRegistry('content-lock', lock), { valid: true, errors: [] });
  const bad = (p, why) => assert.equal(validateRegistry('content-lock', { lockVersion: '0.1', packages: p }).valid, false, why);
  bad([pkg, pkg], 'one id per type');
  bad([{ ...pkg, nixHash: 'sha256-' + Buffer.alloc(32).toString('base64') }], 'nixHash must match sha256');
  bad([{ ...pkg, tag: 'v0.2.0' }], 'the tag names the version');
  bad([{ ...pkg, url: 'http://example.org/x.tar.zst' }], 'https only');
  bad([{ ...pkg, extra: 1 }], 'no extra keys');
  assert.equal(validateRegistry('content-lock', { lockVersion: '0.1', packages: [{ ...pkg, type: 'library', id: 'io.github.ada.tidepool' }, { ...pkg, type: 'world', id: 'io.github.ada.tidepool', version: '1.2.0', tag: 'v1.2.0' }] }).valid, true, 'same id, two types');
});
