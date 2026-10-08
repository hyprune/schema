import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const config=JSON.parse(readFileSync(new URL('../../core/config/input.default.json',import.meta.url)));
const req=(method,params)=>({jsonrpc:'2.0',id:'test',method,params});
test('0.6 input config is versioned, closed and limits three variants',()=>{
 assert.equal(validate('ipc',req('input.set',{config}),undefined,'0.6').valid,true);
 for(const version of ['0.1','0.2','0.3','0.4','0.5'])assert.equal(validate('ipc',req('input.set',{config}),undefined,version).valid,false);
 for(const mutate of [c=>c.longHoldMs=0,c=>c.scopeVignette=1,c=>c.modes.world.use=['e','f','g','t'],c=>c.modes.world.unknown=['p'],c=>c.extra=true]){const c=structuredClone(config);mutate(c);assert.equal(validate('ipc',req('input.set',{config:c}),undefined,'0.6').valid,false);}
});
test('capture requires a mode action slot and lease; response context stays exact',()=>{
 assert.equal(validate('ipc',req('input.capture',{leaseId:'lease',mode:'focus',action:'exit',slot:2}),undefined,'0.6').valid,true);
 assert.equal(validate('ipc',req('input.capture',{leaseId:'lease',mode:'unknown',action:'exit',slot:3}),undefined,'0.6').valid,false);
 const frame={jsonrpc:'2.0',id:'test',result:{config,conflicts:[],steals:[]}};
 assert.equal(validate('ipc',frame,'input.preview','0.6').valid,true);
 assert.equal(validate('ipc',frame,'input.set','0.6').valid,false);
});
