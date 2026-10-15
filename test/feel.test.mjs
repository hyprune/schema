import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.29 (draft): motion feel. Input version 3 (Ctrl+R
// records), graphics.frame_pacing.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const strip=(o,...keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const changed=['session.hello.result','inputConfig','graphicsConfig','graphicsPatch','playerConfig','playerOverrides','playerPatch','playerSettings','recordingStatus','state','state.delta.notification','request','response'];

test('IPC 0.29 inherits every 0.28 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.28'),latest=schema('0.29');
 assert.ok(latest.title.includes('0.29'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.29/ipc.schema.json');
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),['recordingStats','recordingState','recording.label.params','recording.label.result','recording.label.request','recording.label.response']);
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.29');
 assert.deepEqual(strip(hello,'protocol','methods'),strip(oldHello,'protocol','methods'),'no new events or grants');
 assert.deepEqual(hello.methods.items.enum.filter(m=>!oldHello.methods.items.enum.includes(m)),['recording.label']);
 assert.ok(ipcProtocols.includes('0.29'));
 assert.deepEqual(strip(latest.$defs.inputConfig.properties,'version'),strip(old.$defs.inputConfig.properties,'version'));
 for(const key of ['graphicsConfig','graphicsPatch'])
  assert.deepEqual(strip(latest.$defs[key].properties,'frame_pacing'),old.$defs[key].properties,key);
 assert.deepEqual(latest.$defs.graphicsConfig.required,[...old.$defs.graphicsConfig.required,'frame_pacing']);
});

const req=(method,params)=>({jsonrpc:'2.0',id:'f1',method,params});
const ok=(method,params,v='0.29')=>validate('ipc',req(method,params),undefined,v).valid;

test('IPC 0.29 graphics.frame_pacing: even, max_rate or null (the preset)',()=>{
 for(const v of ['even','max_rate',null])assert.ok(ok('graphics.set',{patch:{frame_pacing:v}}),String(v));
 assert.ok(!ok('graphics.set',{patch:{frame_pacing:'fast'}}));
 assert.ok(!ok('graphics.set',{patch:{frame_pacing:'even'}},'0.28'),'0.28 has no frame_pacing');
});

test('IPC 0.29 input config is version 3; older versions keep 2',()=>{
 const v3=schema('0.29').$defs.inputConfig.properties.version,v2=schema('0.28').$defs.inputConfig.properties.version;
 assert.equal(v3.const,3);
 assert.equal(v2.const,2);
});

const stats={t:5.01,windowS:5.01,final:false,presents:245,presentHz:48.9,fps:48.9,frameMs:{p50:20.4,p95:20.6,p99:30.6,max:40.8},
 dtMs:{mean:20.4,std:.3,max:30.6},refreshMs:10.207,missedVblanks:250,hitches:[{t:3.2,ms:61.2}]};
const status=(over={})=>({recording:true,playing:false,path:'/home/u/.local/state/hyprune/recordings/rec-20261015-101500.jsonl',frame:40000,mode:'input',failures:[],error:null,
 elapsedMs:200000,stats,last:null,...over});
const res=(method,result,v='0.29')=>validate('ipc',{jsonrpc:'2.0',id:'f1',result},method,v).valid;

test('IPC 0.29 recording status: elapsed time, statistics, the last recording; long live recordings',()=>{
 assert.ok(res('recording.status',status()));
 assert.ok(res('recording.stop',status({recording:false,elapsedMs:null,stats:null,last:{path:'/x/rec-1.jsonl',label:null}})));
 assert.ok(!res('recording.status',status({stats:{...stats,hitches:'x'}})));
 assert.ok(!res('recording.status',status(),'0.28'),'0.28 has no timing fields');
 const {elapsedMs,stats:_,last,...old}=status({frame:100});
 assert.ok(res('recording.status',old,'0.28'));
 assert.ok(!res('recording.status',status({frame:500000})));
});

test('IPC 0.29 recording.label: a 1-120 character label and optional meta',()=>{
 assert.ok(ok('recording.label',{label:'pan test 98 Hz'}));
 assert.ok(ok('recording.label',{label:'walk',meta:{shell:{version:'0.12.0'}}}));
 for(const bad of [{},{label:''},{label:'x'.repeat(121)},{label:'a',path:'/etc/passwd'}])assert.ok(!ok('recording.label',bad),JSON.stringify(bad));
 assert.ok(!ok('recording.label',{label:'a'},'0.28'),'0.28 has no recording.label');
 assert.ok(res('recording.label',status({recording:false,elapsedMs:null,stats:null,last:{path:'/x/rec-1-walk.jsonl',label:'walk'}})));
});

test('IPC 0.29 state.recording: active with statistics, or idle with the last recording',()=>{
 const st=read('v0.29/ipc.schema.json').$defs.state;
 assert.ok(st.required.includes('recording'));
 const delta=(recording,v='0.29')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'s',sessionId:'x',baseRevision:1,revision:2,changes:{recording}}},undefined,v).valid;
 assert.ok(delta({active:true,startedAt:123456,path:'/x/rec.jsonl',stats,last:null}));
 assert.ok(delta({active:false,startedAt:null,path:null,stats:null,last:{path:'/x/rec.jsonl',label:'walk'}}));
 assert.ok(!delta({active:true},'0.29'));
 assert.ok(!delta({active:false,startedAt:null,path:null,stats:null,last:null},'0.28'),'0.28 has no recording state');
});

test('IPC 0.29 player feel settings: look/move smoothing, bob roll, carry easing',()=>{
 const feel=['look_inertia','move_inertia','view_bob_roll','carry_turn','carry_follow'];
 const latest=schema('0.29').$defs,old=schema('0.28').$defs;
 assert.deepEqual(strip(latest.playerConfig.properties,...feel),old.playerConfig.properties);
 assert.deepEqual(latest.playerConfig.required,[...old.playerConfig.required,...feel]);
 assert.ok(ok('player.set',{patch:{carry_turn:.2,view_bob_roll:0,look_inertia:null}}));
 assert.ok(!ok('player.set',{patch:{carry_turn:.5}}),'above range');
 assert.ok(!ok('player.set',{patch:{carry_turn:.2}},'0.28'),'0.28 has no carry easing');
});
