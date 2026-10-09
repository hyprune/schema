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
