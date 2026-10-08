import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const request=(method,params)=>({jsonrpc:'2.0',id:'hud',method,params});
const event=(method,params)=>({jsonrpc:'2.0',method,params});
const base={subscriptionId:'hud-1',sessionId:'s',revision:3,monotonicMs:100};
test('0.9 HUD opt-in topics are bounded and frozen versions reject them',()=>{
 const r=request('hud.subscribe',{topics:['hud.frame','hud.pose','zone.entered','zone.exited','tool.changed']});
 assert.equal(validate('ipc',r,undefined,'0.9').valid,true);
 for(const v of ['0.6','0.7','0.8'])assert.equal(validate('ipc',r,undefined,v).valid,false);
 for(const topics of [[],['hud.pose','hud.pose'],['ui.hud.cycle'],['whatever']])
  assert.equal(validate('ipc',request('hud.subscribe',{topics}),undefined,'0.9').valid,false);
});
test('0.9 pose, performance and scoped cycle have precise fields',()=>{
 const frame=event('hud.frame',{...base,fps:60,frameMs:16.7,cpuMs:2,gpuMs:null,renderScale:.5,preset:'low'});
 assert.equal(validate('ipc',frame,undefined,'0.9').valid,true);
 frame.params.gpuMs=-1;assert.equal(validate('ipc',frame,undefined,'0.9').valid,false);
 const cycle=event('ui.hud.cycle',{sessionId:'s',revision:3,monotonicMs:100,leaseId:'l',outputId:'o',sequence:1});
 assert.equal(validate('ipc',cycle,undefined,'0.9').valid,true);
 delete cycle.params.leaseId;assert.equal(validate('ipc',cycle,undefined,'0.9').valid,false);
 const pose=event('hud.pose',{...base,outputId:'o',worldId:'w',worldName:'World',position:[1,2,3],heading:.5,pitch:0,zone:null,tool:2,subtype:'lock'});
 assert.equal(validate('ipc',pose,undefined,'0.9').valid,true);
 pose.params.tool=5;assert.equal(validate('ipc',pose,undefined,'0.9').valid,false);
});
test('canonical keymap replaces reserved slot without changing frozen 0.8',()=>{
 const a=JSON.parse(readFileSync(new URL('../v0.9/input.schema.json',import.meta.url)));
 const b=JSON.parse(readFileSync(new URL('../v0.8/ipc.schema.json',import.meta.url))).$defs.inputConfig;
 assert.ok(a.properties.modes.properties.world.properties['hud.cycle']);
 assert.equal(a.properties.modes.properties.world.properties.tool5,undefined);
 assert.ok(b.properties.modes.properties.world.properties.tool5);
});
