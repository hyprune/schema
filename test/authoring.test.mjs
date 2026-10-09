import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const request=(method,params)=>({jsonrpc:'2.0',id:'photo-test',method,params});
test('IPC 0.13 photo lens bounds and frozen older methods',()=>{
 const params={position:[1,2,3],orientation:[0,0,Math.SQRT1_2,Math.SQRT1_2],fov:15,renderScale:.5,lensShift:[.2,-.1]};
 assert.equal(validate('ipc',request('camera.photo',params),undefined,'0.13').valid,true);
 assert.equal(validate('ipc',request('camera.photo',params),undefined,'0.12').valid,false);
 for(const patch of [{orientation:[0,0,0,2]},{fov:4},{fov:141},{renderScale:0},{lensShift:[3,0]},{extra:true}])
  assert.equal(validate('ipc',request('camera.photo',{...params,...patch}),undefined,'0.13').valid,false);
 const result={position:[1,2,3],orientation:params.orientation,roll:Math.PI/2,fov:15,lensShift:[.2,-.1],renderScale:.5,held:true};
 assert.equal(validate('ipc',{jsonrpc:'2.0',id:'q',result},'camera.get','0.13').valid,true);
 for(const v of [true,false,null])assert.equal(validate('ipc',request('graphics.set',{patch:{outline:v,visibility_culling:true}}),undefined,'0.13').valid,true);
});
test('world 0.5 validates ink and directed visibility regions',()=>{
 const world=JSON.parse(readFileSync(new URL('../examples/world.json',import.meta.url)));
 world.formatVersion='0.5';
 world.visibility={areas:[{id:'room',bounds:{min:[-4,-1,-4],max:[4,4,4]},nodes:[0],visibleFrom:[]}]};
 assert.equal(validate('world',world,undefined,'0.5').valid,true);
 // Invalid visibility links and duplicate ownership must fail independently of glTF.
 world.visibility.areas[0].visibleFrom=['missing'];assert.equal(validate('world',world,undefined,'0.5').valid,false);
 world.visibility.areas[0].visibleFrom=[];
 world.visibility.areas.push({...world.visibility.areas[0],id:'second'});assert.equal(validate('world',world,undefined,'0.5').valid,false);
});
test('dev capability and methods are advertised in the new hello contract',()=>{
 const params={protocols:['0.13'],client:{id:'org.example.author',name:'Author'},capabilities:['camera.author','state.read']};
 assert.equal(validate('ipc',request('session.hello',params),undefined,'0.13').valid,true);
 assert.equal(validate('ipc',request('session.hello',params),undefined,'0.12').valid,false);
});
