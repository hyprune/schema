import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const base=JSON.parse(readFileSync(new URL('../examples/world.json',import.meta.url)));
const ladder=()=>({id:'hatch',type:'ladder',bottom:[0,0,.55],top:[0,6,.55],facing:[0,0,1],width:1.4,depth:.8,exits:{bottom:[0,0,1.5],top:[0,6,-1]}});
const world=()=>({...structuredClone(base),formatVersion:'0.4',climbables:[ladder()]});
test('world 0.4 validates all climbable types and preserves old contracts',()=>{
 for(const type of ['ladder','rope','vines','chain-link']) {
  const w=world();w.climbables[0].type=type;assert.equal(validate('world',w,undefined,'0.4').valid,true);
 }
 for(const formatVersion of ['0.1','0.2','0.3']) {
  const w={...world(),formatVersion};assert.equal(validate('world',w,undefined,formatVersion).valid,false);
  delete w.climbables;assert.equal(validate('world',w,undefined,formatVersion).valid,true);
 }
 const w=world();w.climbables[0].top=[0,5,-1.45];w.climbables[0].facing=[0,2/Math.sqrt(29),5/Math.sqrt(29)];w.climbables[0].exits.top=[0,5,-2];assert.equal(validate('world',w,undefined,'0.4').valid,true);
});
test('reject malformed, unbounded, backwards, duplicate and contradictory climbing data',()=>{
 for(const mutate of [
  c=>delete c.exits,c=>c.exits.top=[0,90,0],c=>c.speed=0,c=>c.speed=9,c=>c.speed='2',
  c=>c.type='script',c=>c.script='run',c=>c.width=.1,c=>c.depth=3,c=>c.facing=[0,0,0],
  c=>c.facing=[0,1,0],c=>c.top=[0,0,.55],c=>c.top=[0,-2,.55],c=>c.top=[100,1,.55],
  c=>c.bottom=[Infinity,0,0],c=>c.width=NaN,c=>c.bottom=[1,2]
 ]) { const w=world();mutate(w.climbables[0]);assert.equal(validate('world',w,undefined,'0.4').valid,false,JSON.stringify(w)); }
 const w=world();w.climbables.push(ladder());assert.equal(validate('world',w,undefined,'0.4').valid,false);
 w.climbables=Array.from({length:129},(_,i)=>({...ladder(),id:'ladder-'+i}));assert.equal(validate('world',w,undefined,'0.4').valid,false);
});
test('0.11 climbing movement snapshot and delta are closed and version isolated',()=>{
 const state=JSON.parse(readFileSync(new URL('../examples/ipc/state.snapshot.response.json',import.meta.url))).result.snapshot.state;
 state.movement={...state.movement,state:'climbing',ladderId:'hatch',prompt:'W/S climb · Space let go'};
 const delta={jsonrpc:'2.0',method:'state.delta',params:{sessionId:'session-1',subscriptionId:'subscription-1',baseRevision:1,revision:2,changes:{movement:state.movement}}};
 assert.equal(validate('ipc',delta,undefined,'0.11').valid,true,JSON.stringify(validate('ipc',delta,undefined,'0.11')));
 for(const v of ['0.1','0.8','0.9','0.10']) assert.equal(validate('ipc',delta,undefined,v).valid,false);
 for(const bad of [null,5,'']) {delta.params.changes.movement.ladderId=bad;assert.equal(validate('ipc',delta,undefined,'0.11').valid,false);}
 delta.params.changes.movement.state='walking';delta.params.changes.movement.ladderId=null;assert.equal(validate('ipc',delta,undefined,'0.11').valid,true);
});
