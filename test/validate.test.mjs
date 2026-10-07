import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validate } from '../lib/validate.mjs';
const fixture = path => JSON.parse(readFileSync(new URL(`../examples/${path}.json`, import.meta.url)));
for (const kind of ['world', 'extension', 'screen-type']) test(`${kind} example`, () => assert.deepEqual(validate(kind, fixture(kind)), { valid: true, errors: [] }));
for (const name of readdirSync(new URL('../examples/ipc/', import.meta.url))) {
  test(`IPC ${name}`, () => {
    const value = fixture('ipc/' + name.replace(/\.json$/, ''));
    const method = name.endsWith('.response.json') ? name.replace('.response.json', '') : undefined;
    assert.equal(validate('ipc', value, method).valid, true);
    assert.equal(validate('ipc', value).valid, true);
  });
}
function reject(title, kind, source, mutate, method) {
  test(title, () => { const v = fixture(source); mutate(v); assert.equal(validate(kind, v, method).valid, false); });
}
for (const path of ['../scene.glb','/scene.glb','a/../../scene.glb','https://evil/scene.glb','a\\scene.glb','a//scene.glb','a/%2e%2e/scene.glb','./scene.glb']) {
  reject(`reject unsafe path ${path}`, 'world', 'world', v => v.scene = path);
}
reject('unknown format', 'world', 'world', v => v.formatVersion = '9.0');
reject('unknown fields', 'world', 'world', v => v.execute = 'bad');
reject('unknown spawn', 'world', 'world', v => v.defaultSpawn = 'missing');
reject('duplicate spawn IDs', 'world', 'world', v => v.spawns.push(v.spawns[0]));
reject('bad quaternion', 'world', 'world', v => v.spawns[0].pose.rotation = [0,0,0,0]);
reject('inverted bounds', 'world', 'world', v => v.zones[0].bounds.min[0] = 99);
reject('duplicate material lightmap', 'world', 'world', v => v.lightmaps.push(v.lightmaps[0]));
reject('UV0 is not a lightmap channel', 'world', 'world', v => v.lightmaps[0].texCoord = 0);
reject('missing required extension', 'world', 'world', v => v.requiredExtensions = ['org.example.missing']);
reject('invalid license', 'world', 'world', v => v.license = 'not-a-license');
reject('bad semver', 'world', 'world', v => v.version = '0.1.0-01');
reject('unknown capability', 'extension', 'extension', v => v.capabilities.push('root.execute'));
reject('no unsandboxed distribution', 'extension', 'extension', v => v.sandbox.required = false);
reject('no shared libraries', 'extension', 'extension', v => v.runtime = 'native');
reject('contribution namespace', 'extension', 'extension', v => v.contributes.widgets = ['org.someone.widget']);
reject('screen size positive', 'screen-type', 'screen-type', v => v.defaultSize = [0,1]);
reject('screen resolution bounded', 'screen-type', 'screen-type', v => v.resolution.width = 999999);
reject('no numeric IDs', 'ipc', 'ipc/session.ping.request', v => v.id = 1);
reject('request requires ID', 'ipc', 'ipc/session.ping.request', v => delete v.id);
reject('unknown method', 'ipc', 'ipc/session.ping.request', v => v.method = 'system.exec');
reject('closed params', 'ipc', 'ipc/session.ping.request', v => v.params.command = 'bad');
reject('result and error exclusive', 'ipc', 'ipc/session.ping.response', v => v.error = {code:-32603,message:'bad'});
reject('response method context', 'ipc', 'ipc/session.ping.response', v => {}, 'state.subscribe');
reject('delta must advance', 'ipc', 'ipc/state.delta.notification', v => v.params.revision = 0);
reject('empty delta', 'ipc', 'ipc/state.delta.notification', v => v.params.changes = {});
reject('hidden input grab', 'ipc', 'ipc/shell.overlay.request', v => v.params.visible = false);
reject('error null ID only for parse/request errors', 'ipc', 'ipc/error', v => v.id = null);
reject('duplicate lease ownership', 'ipc', 'ipc/state.subscribe.response', v => v.result.snapshot.state.shell.leases = [{id:'a',outputs:['output-1'],overlays:[]},{id:'b',outputs:['output-1'],overlays:[]}]);
test('no JSON-RPC batches', () => assert.equal(validate('ipc', [fixture('ipc/session.ping.request')]).valid, false));
test('CLI success, invalid schema, malformed JSON and usage exit codes', () => {
  const run = (args, input) => spawnSync(process.execPath, ['bin/validate.mjs', ...args], { cwd: new URL('..', import.meta.url), input, encoding: 'utf8' });
  assert.equal(run(['world','examples/world.json']).status, 0);
  assert.equal(run(['world','-'], '{}').status, 1);
  assert.equal(run(['world','-'], '{').status, 2);
  assert.equal(run([]).status, 2);
  assert.equal(run(['ipc','examples/ipc/session.ping.response.json','state.subscribe']).status, 1);
});
