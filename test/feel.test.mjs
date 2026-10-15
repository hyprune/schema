import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.29 (draft): motion feel. Input version 3 (Ctrl sprints, Shift goes down, Ctrl+R
// records), graphics.frame_pacing.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const strip=(o,...keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const changed=['session.hello.result','inputConfig','graphicsConfig','graphicsPatch'];

test('IPC 0.29 inherits every 0.28 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.28'),latest=schema('0.29');
 assert.ok(latest.title.includes('0.29'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.29/ipc.schema.json');
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),[]);
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.29');
 assert.deepEqual(strip(hello,'protocol'),strip(oldHello,'protocol'),'no new methods or events');
 assert.ok(ipcProtocols.includes('0.29'));
 assert.deepEqual(strip(latest.$defs.inputConfig.properties,'version'),strip(old.$defs.inputConfig.properties,'version'));
 for(const key of ['graphicsConfig','graphicsPatch'])
  assert.deepEqual(strip(latest.$defs[key].properties,'frame_pacing'),old.$defs[key].properties,key);
 assert.deepEqual(latest.$defs.graphicsConfig.required,[...old.$defs.graphicsConfig.required,'frame_pacing']);
});

const req=(method,params)=>({jsonrpc:'2.0',id:'f1',method,params});
const ok=(method,params,v='0.29')=>validate('ipc',req(method,params),undefined,v).valid;

test('IPC 0.29 graphics.frame_pacing: even, max_rate or null (the preset)',()=>{
 for(const v of ['even','max_rate',null])assert.ok(ok('graphics.set',{patch:{frame_pacing:v}}),String(v));
 assert.ok(!ok('graphics.set',{patch:{frame_pacing:'fast'}}));
 assert.ok(!ok('graphics.set',{patch:{frame_pacing:'even'}},'0.28'),'0.28 has no frame_pacing');
});

test('IPC 0.29 input config is version 3; older versions keep 2',()=>{
 const v3=schema('0.29').$defs.inputConfig.properties.version,v2=schema('0.28').$defs.inputConfig.properties.version;
 assert.equal(v3.const,3);
 assert.equal(v2.const,2);
});
