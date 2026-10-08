import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../lib/validate.mjs';
const interaction={mode:'typing',tool:2,tools:['pointer','mount','path','path','path'],noclip:false,cursor:'virtual',taggedSurfaceId:null};
const delta=changes=>({jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}});
test('0.5 hands and apps are closed, bounded and isolated from older versions',()=>{
 const frame=delta({interaction,apps:[{surfaceId:'surface-1',workspaceId:10,title:'Terminal',appClass:'kitty',icon:'kitty'}]});
 assert.equal(validate('ipc',frame,undefined,'0.5').valid,true);
 for(const v of ['0.1','0.2','0.3','0.4'])assert.equal(validate('ipc',frame,undefined,v).valid,false);
 for(const bad of [{...interaction,tool:6},{...interaction,cursor:'hardware'},{...interaction,tools:['mount']},{...interaction,secret:1}])assert.equal(validate('ipc',delta({interaction:bad}),undefined,'0.5').valid,false);
});
test('0.5 arbitrary mounts require complete pose/size and retain authored placements',()=>{
 const p={worldId:'org.hyprune.world',areaId:'home',anchorId:'',rule:{appClass:'kitty',title:'Terminal'},pose:{position:[1,2,3],rotation:[0,0,0,1]},size:[1.6,.9]};
 const response=placements=>({jsonrpc:'2.0',id:'test',result:{placements}});
 assert.equal(validate('ipc',response([p]),'placements.list','0.5').valid,true);
 assert.equal(validate('ipc',response([p]),'placements.list','0.4').valid,false);
 delete p.size;assert.equal(validate('ipc',response([p]),'placements.list','0.5').valid,false);
 const authored={worldId:'org.hyprune.world',areaId:'home',anchorId:'desk',rule:{appClass:'kitty',title:'Terminal'}};
 assert.equal(validate('ipc',response([authored]),'placements.list','0.5').valid,true);
});
