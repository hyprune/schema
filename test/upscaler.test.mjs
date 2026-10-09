import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const request=patch=>({jsonrpc:'2.0',id:'up',method:'graphics.set',params:{patch}});
const schema=v=>JSON.parse(readFileSync(new URL(`../v${v}/ipc.schema.json`,import.meta.url)));
test('IPC 0.16 upscaler setting validates; 0.15 stays frozen',()=>{
 for(const value of ['fsr1','bilinear',null]) {
  assert.equal(validate('ipc',request({upscaler:value}),undefined,'0.16').valid,true);
  assert.equal(validate('ipc',request({upscaler:value}),undefined,'0.15').valid,false);
 }
 for(const value of ['fsr2','',1,true,{}]) assert.equal(validate('ipc',request({upscaler:value}),undefined,'0.16').valid,false);
 assert.deepEqual(schema('0.16').$defs.graphicsConfig.properties.upscaler.enum,['fsr1','bilinear',null]);
});
test('IPC 0.16 inherits every 0.15 definition and only adds the upscaler key',()=>{
 const old=schema('0.15'),latest=schema('0.16');
 for(const key of Object.keys(old.$defs))assert.ok(latest.$defs[key],key);
 for(const key of ['graphicsConfig','graphicsPatch']) {
  const {upscaler,...rest}=latest.$defs[key].properties;assert.ok(upscaler);
  assert.deepEqual(rest,old.$defs[key].properties,key);
 }
 assert.equal(latest.$defs['session.hello.result'].properties.protocol.const,'0.16');
});
