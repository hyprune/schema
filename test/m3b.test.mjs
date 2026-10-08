import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const inputSchema=JSON.parse(readFileSync(new URL('../v0.6/input.schema.json',import.meta.url)));
const config={version:2,longHoldMs:1000,scopeVignette:true,useDistance:6,useTolerance:.12,captureInputLimit:256,modes:Object.fromEntries(Object.entries(inputSchema.properties.modes.properties).map(([mode,s])=>[mode,Object.fromEntries(Object.keys(s.properties).map(action=>[action,[]]))]))};
const req=(method,params)=>({jsonrpc:'2.0',id:'test',method,params});
test('0.6 input config is versioned, closed and limits three variants',()=>{
 assert.equal(validate('ipc',req('input.set',{config}),undefined,'0.6').valid,true);
 for(const version of ['0.1','0.2','0.3','0.4','0.5'])assert.equal(validate('ipc',req('input.set',{config}),undefined,version).valid,false);
 for(const mutate of [c=>c.longHoldMs=0,c=>c.scopeVignette=1,c=>c.invert_y=1,c=>c.modes.world.use=['e','f','g','t'],c=>c.modes.world.unknown=['p'],c=>c.extra=true]){const c=structuredClone(config);mutate(c);assert.equal(validate('ipc',req('input.set',{config:c}),undefined,'0.6').valid,false);}
});
test('capture requires a mode action slot and lease; response context stays exact',()=>{
 assert.equal(validate('ipc',req('input.capture',{leaseId:'lease',mode:'focus',action:'exit',slot:2}),undefined,'0.6').valid,true);
 assert.equal(validate('ipc',req('input.capture',{leaseId:'lease',mode:'unknown',action:'exit',slot:3}),undefined,'0.6').valid,false);
 const frame={jsonrpc:'2.0',id:'test',result:{config,conflicts:[],steals:[]}};
 assert.equal(validate('ipc',frame,'input.preview','0.6').valid,true);
 assert.equal(validate('ipc',frame,'input.set','0.6').valid,false);
});

test('0.6 desktop app inventory includes uncaptured clients and remains bounded',()=>{
 const frame=count=>({jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes:{apps:Array.from({length:count},(_,i)=>({surfaceId:`desktop-window-${i}`,workspaceId:1+i%3,title:'Terminal',appClass:'kitty',icon:'kitty'}))}}});
 assert.equal(validate('ipc',frame(128),undefined,'0.6').valid,true);
 assert.equal(validate('ipc',frame(129),undefined,'0.6').valid,false);
 assert.equal(validate('ipc',frame(17),undefined,'0.5').valid,false);
});

test('optional invert Y and diagnostics in every mode keep older keymaps valid',()=>{
 for(const invert_y of [false,true])assert.equal(validate('ipc',req('input.set',{config:{...config,invert_y}}),undefined,'0.6').valid,true);
 const old=structuredClone(config);for(const m of ['interactive','focus','menu']){delete old.modes[m].debug;delete old.modes[m].capture;}
 assert.equal(validate('ipc',req('input.set',{config:old}),undefined,'0.6').valid,true);
});
