import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const request=patch=>({jsonrpc:'2.0',id:'ink',method:'graphics.set',params:{patch}});
test('IPC 0.14 outline tiers validate and older contracts stay frozen',()=>{
 for(const value of ['fast','smooth',null]) {
  assert.equal(validate('ipc',request({outline_quality:value}),undefined,'0.14').valid,true);
  assert.equal(validate('ipc',request({outline_quality:value}),undefined,'0.13').valid,false);
 }
 for(const value of ['high',1,true,{},[]])assert.equal(validate('ipc',request({outline_quality:value}),undefined,'0.14').valid,false);
 const old=JSON.parse(readFileSync(new URL('../v0.13/ipc.schema.json',import.meta.url)));
 const latest=JSON.parse(readFileSync(new URL('../v0.14/ipc.schema.json',import.meta.url)));
 for(const key of Object.keys(old.$defs).filter(k=>k.endsWith('.params')||k.endsWith('.result')))assert.ok(latest.$defs[key],key);
});

test('persistent ink overrides are bounded and resettable',()=>{
 for(const patch of [{outline_width_px:3.5,outline_colour:[.1,.2,.3]},{outline_width_px:null,outline_colour:null}])
  assert.equal(validate('ipc',request(patch),undefined,'0.14').valid,true);
 for(const patch of [{outline_width_px:0},{outline_width_px:5},{outline_width_px:'2'},{outline_colour:[0,1]},{outline_colour:[0,1,2]}])
  assert.equal(validate('ipc',request(patch),undefined,'0.14').valid,false);
 assert.equal(validate('ipc',{jsonrpc:'2.0',id:'a',result:{revision:5}},undefined,'0.14').valid,true);
});
