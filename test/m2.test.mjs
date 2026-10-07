import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const base=JSON.parse(readFileSync(new URL('../examples/world.json',import.meta.url)));
const anchor=id=>({id,screenType:'com.hyprune.window',pose:{position:[0,2,-5],rotation:[0,0,0,1]},size:[3.2,1.8],mount:{type:id==='wall'?'facade-wall':'operator-desk',role:id==='wall'?'mounted-workspace':'tool-mount',interaction:id==='wall'?'focus-in':'in-place'}});
const world=()=>({...structuredClone(base),formatVersion:'0.3',anchors:[anchor('wall'),anchor('desk')],areas:[{id:'sun-court',workspaceSlot:'01',primaryAnchor:'wall',toolAnchors:['desk'],dataAnchors:[],theme:'sun-court'}]});
test('0.3 world homes enforce roles, ownership, slots and limits',()=>{
 assert.equal(validate('world',world(),undefined,'0.3').valid,true);
 for(const change of [w=>w.areas[0].primaryAnchor='missing',w=>w.areas[0].toolAnchors.push('wall'),w=>w.anchors[1].mount.interaction='focus-in',w=>w.areas[0].workspaceSlot=1,w=>w.anchors[0].mount.type='unknown',w=>w.areas[0].freePlacementZones=['missing']]){
  const w=world();change(w);assert.equal(validate('world',w,undefined,'0.3').valid,false,JSON.stringify(w));
 }
 const w=world();w.anchors[1].mount.limits={minAspect:2,maxAspect:1,minSize:[1,1],maxSize:[3,3]};assert.equal(validate('world',w,undefined,'0.3').valid,false);
});
test('0.4 methods are isolated and have closed params',()=>{
 for(const [method,params] of [['workspace.bind',{id:10,worldId:'com.hyprune.lumen-reach',areaId:'sun-court'}],['surface.pull',{surfaceId:'surface-1'}],['surface.place',{surfaceId:'surface-1',anchorId:'desk'}],['surfaces.recall',{}],['camera.fov',{degrees:70}],['data.object.bind',{objectId:'globe',sourceId:'org.example.data'}]]){
  const request={jsonrpc:'2.0',id:'1',method,params};assert.equal(validate('ipc',request,undefined,'0.4').valid,true);
  for(const version of ['0.1','0.2','0.3'])assert.equal(validate('ipc',request,undefined,version).valid,false);
  request.params.unexpected=true;assert.equal(validate('ipc',request,undefined,'0.4').valid,false);
 }
 assert.equal(validate('ipc',{jsonrpc:'2.0',id:'1',method:'camera.fov',params:{degrees:120}},undefined,'0.4').valid,false);
});
