import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.24 (RFC-0013): machine inputs in the object catalog and the live state key.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const res=(method,result,v='0.24')=>validate('ipc',{jsonrpc:'2.0',id:'l1',result},method,v).valid;
const delta=(changes,v='0.24')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;
const clone=o=>JSON.parse(JSON.stringify(o));

const gauge='library/com.hyprune.starter@0.2.0/gauge-tube';
const inputs=[{id:'value',type:'number',min:0,max:100,default:0,label:'Value',explain:'How full the tube is.'},
 {id:'display',type:'text',maxLength:32,label:'Display',explain:'The text under the tube.'},
 {id:'health',type:'enum',values:['ok','warn','fail'],repeat:4,label:'Health',explain:'One lamp per server.'},
 {id:'pulse',type:'event',label:'Pulse',explain:'Each increase flashes the cap.'},
 {id:'jobs',type:'items',states:['running','ok','fail'],label:'Jobs',explain:'One crate per job.'},
 {id:'on',type:'bool',default:true,label:'On',explain:'Lit while true.'},
 {id:'count',type:'int',min:0,max:500,label:'Count',explain:'Crates in the stack.'}];
const machine={primary:'value',inputs};
const entry=(over={})=>({ref:gauge,source:'library',id:'gauge-tube',version:'0.2.0',formatVersion:'0.10',name:'Gauge tube',description:null,
 category:'machines',tags:[],traits:['decorative','movable','machine'],surfaces:['floor'],scale:[0.5,2],
 bounds:{min:[-0.2,0,-0.2],max:[0.2,1.2,0.2]},triangles:1200,gpuBytes:65536,collisionTriangles:null,thumbnail:null,license:'CC-BY-4.0',
 library:'com.hyprune.starter@0.2.0',versions:[],state:'ready',placeable:true,reason:null,errors:[],machine,...over});
const input=(over={})=>({source:'com.hyprune.sources.u-3f9a1c',key:'value',value:71,raw:71,condition:'fresh',publishedAt:1791800000000,...over});
const instance=(over={})=>({id:'u-3f9a1c',asset:'gauge-tube',ref:gauge,source:'com.hyprune.sources.u-3f9a1c',status:'ok',error:null,stale:false,
 inputs:{value:input(),display:input({key:'display',value:'71 %',raw:'71 %'})},...over});
const live=(instances=[instance()])=>({instances});

test('IPC 0.24 catalog entries carry machine: null or the declared inputs; 0.23 rejects it',()=>{
 const catalog=(entries,v)=>res('objects.catalog',{revision:4,entries},v);
 assert.ok(catalog([entry(),entry({id:'lamp',ref:'user/lamp',source:'user',library:null,traits:['decorative','movable'],machine:null})]));
 assert.ok(catalog([entry({machine:{primary:null,inputs:[inputs[0]]}})]),'no primary declared');
 for(const i of inputs)assert.ok(catalog([entry({machine:{primary:null,inputs:[i]}})]),i.id);
 assert.ok(catalog([entry({machine:{primary:'status',inputs:read('examples/object-machine.json').traits.machine.inputs}})]),'the example machine as authored');
 const {machine:_,...old}=entry();
 assert.ok(catalog([old],'0.23'));assert.ok(!catalog([old]),'machine is required');
 assert.ok(!catalog([entry()],'0.23'),'0.23 entries have no machine');
 const bad=[{machine:undefined},{machine:{inputs}},{machine:{primary:'value'}},{machine:{primary:'value',inputs:[]}},
  {machine:{primary:'value',inputs:Array(17).fill(inputs[0])}},{machine:{primary:'Value',inputs}},{machine:{primary:'value',inputs,drives:[]}},
  {machine:{primary:'value',inputs:[{...inputs[0],id:'value.1'}]}},{machine:{primary:'value',inputs:[{...inputs[0],type:'float'}]}},
  {machine:{primary:'value',inputs:[{id:'v',type:'number',label:'V',explain:'V.'}]}},
  {machine:{primary:'value',inputs:[{id:'v',type:'enum',label:'V',explain:'V.'}]}},
  {machine:{primary:'value',inputs:[{id:'v',type:'items',label:'V',explain:'V.'}]}},
  {machine:{primary:'value',inputs:[{...inputs[2],repeat:17}]}},{machine:{primary:'value',inputs:[{...inputs[2],repeat:1}]}},
  {machine:{primary:'value',inputs:[{...inputs[1],maxLength:65}]}},{machine:{primary:'value',inputs:[{...inputs[0],label:'a\nb'}]}},
  {machine:{primary:'value',inputs:[{...inputs[0],default:null}]}},{machine:{primary:'value',inputs:[{...inputs[0],explain:undefined}]}},
  {machine:{primary:'value',inputs:[{...inputs[0],map:{}}]}}];
 for(const over of bad)assert.ok(!catalog([clone(entry(over))]),JSON.stringify(over));
});

test('IPC 0.24 catalog inputs follow the object 0.10 input declaration',()=>{
 const ipc=schema('0.24').$defs.machineInput,object=read('v0.10/object.schema.json').$defs.input;
 assert.deepEqual(Object.keys(ipc.properties),Object.keys(object.properties));
 assert.deepEqual(ipc.required,object.required);
 assert.deepEqual(ipc.properties.type,object.properties.type);
 for(const k of ['label','explain','default','repeat','min','max','maxLength'])assert.deepEqual(ipc.properties[k],object.properties[k],k);
 assert.deepEqual(ipc.allOf,object.allOf);
 assert.deepEqual(schema('0.24').$defs.machineInputId,object.properties.id);
 assert.deepEqual(schema('0.24').$defs.catalogMachine.properties.primary.anyOf[1],{$ref:'#/$defs/machineInputId'});
});

test('IPC 0.24 live state: instances, inputs, conditions and bounds',()=>{
 assert.ok(delta({live:live()}));
 assert.ok(delta({live:live([])}));
 assert.ok(delta({live:live(Array(64).fill(instance()))}),'64 bound instances');
 assert.ok(!delta({live:live(Array(65).fill(instance()))}),'at most 64');
 for(const condition of ['fresh','stale','missing','error'])assert.ok(delta({live:live([instance({inputs:{value:input({condition})}})])}),condition);
 const good=[instance({source:null,status:null,error:null,inputs:{}}),instance({ref:null,asset:'armillary',id:'sun-court-armillary'}),
  instance({status:'error',error:'exit status 2',stale:true,inputs:{value:input({condition:'error'})}}),
  instance({error:'x'.repeat(256)}),instance({error:''}),
  instance({inputs:{'health.1':input({key:'health.1',value:'ok',raw:'green'}),'health.16':input({key:'health.16',value:'fail',raw:'red'})}}),
  instance({inputs:{value:input({value:0,raw:null,condition:'missing',publishedAt:null})}}),
  instance({inputs:{pulse:input({key:'pulse',value:null,raw:null,condition:'missing',publishedAt:null})}}),
  instance({inputs:{on:input({key:'on',value:true,raw:'yes'})}}),
  instance({inputs:{value:input({source:null,key:null,value:0,raw:null,condition:'missing',publishedAt:null})}}),
  instance({inputs:{display:input({key:'display',value:'x'.repeat(256),raw:'x'.repeat(256)})}}),
  instance({inputs:Object.fromEntries(Array.from({length:16},(_,i)=>[`health.${i+1}`,input({key:`health.${i+1}`})]))})];
 for(const i of good)assert.ok(delta({live:live([i])}),JSON.stringify(i));
 const bad=[{id:'U-1'},{asset:''},{asset:'x'.repeat(65)},{ref:'gauge-tube'},{source:'sources'},{status:'warn'},{status:'stale'},{error:'x'.repeat(257)},
  {stale:null},{inputs:[]},{inputs:{Value:input()}},{inputs:{'value.0':input()}},{inputs:{'value.100':input()}},{link:null},{ageMs:3},
  {inputs:Object.fromEntries(Array.from({length:17},(_,i)=>[`health.${i+1}`,input()]))},
  {inputs:{value:input({condition:'old'})}},{inputs:{value:input({value:[1]})}},{inputs:{value:input({raw:{a:1}})}},
  {inputs:{value:input({value:'x'.repeat(257)})}},{inputs:{value:input({raw:'x'.repeat(257)})}},{inputs:{value:input({publishedAt:-1})}},
  {inputs:{value:input({publishedAt:1.5})}},{inputs:{value:input({publishedAt:'2026-10-12'})}},{inputs:{value:input({ageMs:12})}},
  {inputs:{value:input({key:''})}},{inputs:{value:input({key:'x'.repeat(129)})}},{inputs:{value:input({source:'Bad Source'})}}];
 for(const over of bad)assert.ok(!delta({live:live([clone(instance(over))])}),JSON.stringify(over));
 for(const key of ['id','asset','ref','source','status','error','stale','inputs']){
  const i=instance();delete i[key];assert.ok(!delta({live:live([i])}),`instance needs ${key}`);
 }
 for(const key of ['source','key','value','raw','condition','publishedAt']){
  const i=input();delete i[key];assert.ok(!delta({live:live([instance({inputs:{value:i}})])}),`input needs ${key}`);
 }
 assert.ok(!delta({live:{instances:[],extra:1}}));assert.ok(!delta({live:{}}));assert.ok(!delta({live:null}));
 assert.ok(!delta({live:live()},'0.23'),'0.23 has no live key');
});

test('IPC 0.24 inherits every 0.23 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.23'),latest=schema('0.24');
 assert.ok(latest.title.includes('0.24'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.24/ipc.schema.json');
 const changed=['session.hello.result','state','state.delta.notification','catalogEntry'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 assert.deepEqual(added.sort(),['catalogMachine','liveInput','liveInstance','liveState','machineInput','machineInputId','machineInputKey']);
 assert.deepEqual(latest.anyOf,old.anyOf);
 assert.deepEqual(latest.$defs.request,old.$defs.request,'no new method');
 assert.deepEqual(latest.$defs.notification,old.$defs.notification,'no new event');
 assert.deepEqual(latest.$defs['session.hello.params'],old.$defs['session.hello.params'],'no new grant');
 const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
 assert.deepEqual(without(latest.$defs.state.properties,['live']),old.$defs.state.properties);
 assert.deepEqual(latest.$defs.state.properties.live,{$ref:'#/$defs/liveState'});
 assert.deepEqual(latest.$defs.state.required,[...old.$defs.state.required,'live'],'live is a required state key');
 const changes=d=>d.$defs['state.delta.notification'].properties.params.properties.changes;
 assert.deepEqual(without(changes(latest).properties,['live']),changes(old).properties);
 assert.deepEqual(without(changes(latest),['properties']),without(changes(old),['properties']));
 assert.deepEqual(without(latest.$defs.catalogEntry.properties,['machine']),old.$defs.catalogEntry.properties);
 assert.deepEqual(latest.$defs.catalogEntry.required,[...old.$defs.catalogEntry.required,'machine']);
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.24');
 assert.deepEqual(without(hello,['protocol']),without(oldHello,['protocol']),'same method list');
 assert.ok(ipcProtocols.includes('0.24'));
 // A 0.23 state delta without any 0.24 key stays valid as 0.24.
 const s=read('examples/ipc/state.delta.notification.json');
 for(const v of ['0.23','0.24'])assert.equal(validate('ipc',s,undefined,v).valid,validate('ipc',s,undefined,'0.23').valid,v);
});
