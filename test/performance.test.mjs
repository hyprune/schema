import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../lib/validate.mjs';
const req=patch=>({jsonrpc:'2.0',id:'p',method:'graphics.set',params:{patch}});
test('0.10 performance hot-switch fields do not widen frozen 0.9',()=>{
 for(const patch of [{offload:'on',offload_power_cap_w:50},{scale_min:.5,scale_max:.8},{offload:'auto',target_fps:45}]) {
  assert.equal(validate('ipc',req(patch),undefined,'0.10').valid,true);
  assert.equal(validate('ipc',req(patch),undefined,'0.9').valid,false);
 }
 for(const patch of [{offload:'yes'},{offload_power_cap_w:150},{scale_min:.2},{scale_max:2}])assert.equal(validate('ipc',req(patch),undefined,'0.10').valid,false);
});
