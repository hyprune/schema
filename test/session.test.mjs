import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../lib/validate.mjs';
const request=(method,params)=>({jsonrpc:'2.0',id:'test',method,params});
test('0.3 association and workspace requests are version isolated',()=>{
 for(const [method,params] of [['shell.bind',{leaseId:'lease',pid:123}],['workspace.activate',{id:2}]]) {
  assert.equal(validate('ipc',request(method,params),undefined,'0.3').valid,true);
  assert.equal(validate('ipc',request(method,params),undefined,'0.2').valid,false);
  assert.equal(validate('ipc',request(method,{...params,_pid:123}),undefined,'0.3').valid,false);
 }
 for(const pid of [0,-1,1.5,2147483648]) assert.equal(validate('ipc',request('shell.bind',{leaseId:'lease',pid}),undefined,'0.3').valid,false);
 assert.equal(validate('ipc',request('workspace.activate',{id:0}),undefined,'0.3').valid,false);
});
test('0.3 spatial descriptors reject unbounded and unknown fields',()=>{
 const schema={jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes:{spatial:{world:null,map:null,output:null,projection:{outputId:'output',worldId:'com.hyprune.switchyard',monotonicMs:10,markers:[{id:'build',label:'Build',x:.5,y:.5,distance:12,occluded:false}]}},workspaces:{currentId:1,locations:[{id:1,label:'Switchyard',worldId:'com.hyprune.switchyard',spawnId:'arrival'}]}}}};
 assert.equal(validate('ipc',schema,undefined,'0.3').valid,true);
 assert.equal(validate('ipc',schema,undefined,'0.2').valid,false);
 schema.params.changes.spatial.projection.markers[0].x=1.1;
 assert.equal(validate('ipc',schema,undefined,'0.3').valid,false);
});
