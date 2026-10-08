import test from 'node:test';import assert from 'node:assert/strict';import {validate} from '../lib/validate.mjs';
const req=(method,params)=>({jsonrpc:'2.0',id:'r',method,params});
test('record/replay is isolated to 0.12 and inherits 0.11',()=>{
 assert.equal(validate('ipc',req('recording.start',{}),undefined,'0.12').valid,true);
 assert.equal(validate('ipc',req('recording.start',{}),undefined,'0.11').valid,false);
 assert.equal(validate('ipc',req('replay.start',{path:'/tmp/session.jsonl',mode:'camera',smoothingMs:80,assertions:{marks:{end:{tool:2,camera:{position:[1,2,3]},tolerance:.02}}}}),undefined,'0.12').valid,true);
 for(const p of [{path:'x',smoothingMs:-1},{path:'x',mode:'inject'},{path:'x',assertions:{marks:{end:{unexpected:true}}}},{path:'x',extra:true}])assert.equal(validate('ipc',req('replay.start',p),undefined,'0.12').valid,false);
 assert.equal(validate('ipc',req('recording.start',{includeAppKeys:'yes'}),undefined,'0.12').valid,false);
 const result={recording:false,playing:false,path:'/tmp/session.jsonl',frame:120,mode:'input',failures:[],error:null};
 assert.equal(validate('ipc',{jsonrpc:'2.0',id:'r',result},'replay.status','0.12').valid,true);
});
