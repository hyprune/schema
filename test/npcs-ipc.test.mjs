import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.23 (RFC-0011 P2, RFC-0010): characters, paths and interactions.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const req=(method,params)=>({jsonrpc:'2.0',id:'n1',method,params});
const ok=(method,params,v='0.23')=>validate('ipc',req(method,params),undefined,v).valid;
const res=(method,result,v='0.23')=>validate('ipc',{jsonrpc:'2.0',id:'n1',result},method,v).valid;
const delta=(changes,v='0.23')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;

const NEW_METHODS=['npcs.spawn','npcs.bind','npcs.disable','npcs.remove','paths.list','paths.set','paths.remove','paths.draw','paths.finish','interaction.choose'];
const resident='library/com.hyprune.starter@0.1.0/resident';
const pose={position:[3.2,0,-4.5],rotation:[0,0.259,0,0.966]};
const points=[{position:[-6.5,0,7],type:'line'},{position:[-6.5,0,-3],type:'line'},{position:[5,0,-3],type:'curve'},{position:[5,0,7],type:'arc'}];
const stops=[{point:1,seconds:3,clip:'look_around'},{point:2,seconds:20,seat:'court-bench-2/left'},{point:3,face:{anchor:'board-north'}},{point:0,face:{object:'u-7c2e91'}},{point:0,face:{position:[1,2,3]}}];
const instance=(over={})=>({id:'u-7c2e91',source:'user',ref:resident,name:'Resident',areaId:'sun-court',pose,scale:1,state:'active',
 movable:false,locked:false,rule:null,path:'user/path-3',activity:'walking',seat:null,character:true,accent:[0.9,0.5,0.1],...over});
const prop=(over={})=>instance({id:'u-1',ref:'user/lamp',name:'Lamp',movable:true,path:null,activity:null,character:false,accent:null,...over});
const objects=(instances=[instance(),prop()])=>({catalogRevision:3,instances,pocket:[],
 usage:{placements:2,assets:2,triangles:4210,gpuBytes:1048576,collisionTriangles:12},
 limits:{placements:128,assets:32,triangles:400000,gpuBytes:201326592,collisionTriangles:10000}});
const npcs=(over={})=>({motion:'auto',state:'animating',reason:null,usage:{authored:4,user:1},limits:{authored:16,user:8},
 drawing:null,aimed:null,interaction:null,...over});
const aimed={objectId:'porter-1',name:'Porter',prompt:'Talk',interactions:[{id:'talk',label:'Talk',type:'say'},{id:'where',label:'Where am I?',type:'panel'},
 {id:'show-desk',label:'Show me the desk',type:'guide'},{id:'mark',label:'Mark the desk',type:'waypoint'}]};
const saying={objectId:'porter-1',interactionId:'talk',type:'say',label:'Talk',choices:[],line:'The lifts run every few minutes.',lineIndex:0,lineCount:2,panel:null};
const choosing={objectId:'porter-1',interactionId:null,type:'choose',label:'Porter',choices:[{id:'talk',label:'Talk'},{id:'where',label:'Where am I?'}],
 line:null,lineIndex:0,lineCount:0,panel:null};
const editorPath=(over={})=>({id:'path-3',worldId:'com.example.courtyard',areaId:'sun-court',closed:true,points,use:'route',name:'Market loop',speed:1.1,stops,...over});
const record=(over={})=>({ref:'package/market-loop',source:'package',id:'market-loop',name:'Market loop',use:'route',closed:true,points,speed:1.1,stops,
 walkable:true,problems:[],bound:['porter-1','porter-2'],...over});

test('IPC 0.23 request shapes for every new method; 0.22 rejects them',()=>{
 const good=[['npcs.spawn',{ref:resident}],['npcs.spawn',{ref:resident,path:'market-loop',phase:0.25,speed:1.2,accent:[0.9,0.5,0.1],reverse:true}],
  ['npcs.spawn',{ref:'user/walker',path:'user/path-3'}],['npcs.spawn',{ref:'package/resident',pose,accent:null}],
  ['npcs.bind',{id:'u-7c2e91',path:'package/market-loop'}],['npcs.bind',{id:'u-7c2e91',pose}],['npcs.bind',{id:'u-7c2e91',reverse:true}],
  ['npcs.bind',{id:'u-7c2e91',speed:0.25,phase:0,accent:null}],['npcs.disable',{id:'porter-1',disabled:true}],['npcs.disable',{id:'u-7c2e91',disabled:false}],
  ['npcs.remove',{id:'u-7c2e91'}],['npcs.remove',{all:true}],['paths.list',{}],
  ['paths.set',{path:{use:'route',closed:true,points,stops}}],['paths.set',{path:{id:'path-3',name:'Loop',use:'generic',closed:false,points:points.slice(0,2),speed:2}}],
  ['paths.set',{path:{use:'track',closed:false,points,stops:[{point:1,seconds:5}]}}],
  ['paths.remove',{id:'path-3'}],['paths.remove',{id:'path-3',unbind:true}],['paths.draw',{}],['paths.draw',{use:'route',name:'Garden walk'}],
  ['paths.draw',{spawn:{ref:resident}}],['paths.draw',{spawn:{ref:resident,phase:0.5,speed:2,accent:null}}],['paths.draw',{bind:'u-7c2e91'}],
  ['paths.finish',{}],['interaction.choose',{objectId:'porter-1',interactionId:'talk'}],['interaction.choose',{objectId:'porter-1',interactionId:null}]];
 for(const [m,p] of good){assert.ok(ok(m,p),`${m} ${JSON.stringify(p)}`);assert.ok(!ok(m,p,'0.22'),`${m} in 0.22`);}
 const bad=[['npcs.spawn',{}],['npcs.spawn',{ref:'resident'}],['npcs.spawn',{ref:resident,path:'market-loop',pose}],['npcs.spawn',{ref:resident,reverse:true}],
  ['npcs.spawn',{ref:resident,speed:0.2}],['npcs.spawn',{ref:resident,speed:2.5}],['npcs.spawn',{ref:resident,phase:1}],['npcs.spawn',{ref:resident,accent:[1,1,2]}],
  ['npcs.spawn',{ref:resident,path:'library/x'}],['npcs.spawn',{ref:resident,path:'Market'}],['npcs.spawn',{ref:resident,scale:1}],
  ['npcs.bind',{id:'u-7c2e91'}],['npcs.bind',{id:'u-7c2e91',path:'market-loop',pose}],['npcs.bind',{path:'market-loop'}],['npcs.bind',{id:'u-7c2e91',seat:'bench'}],
  ['npcs.disable',{id:'porter-1'}],['npcs.disable',{id:'porter-1',disabled:'yes'}],['npcs.remove',{}],['npcs.remove',{all:false}],['npcs.remove',{id:'u-1',all:true}],
  ['paths.list',{source:'user'}],['paths.set',{}],['paths.set',{path:{closed:true,points}}],['paths.set',{path:{use:'route',points}}],
  ['paths.set',{path:{use:'route',closed:false,points:points.slice(0,1)}}],['paths.set',{path:{use:'route',closed:false,points,speed:31}}],
  ['paths.set',{path:{use:'loop',closed:false,points}}],['paths.set',{path:{use:'route',closed:false,points,stops:[{point:1,clip:'wave',seat:'bench'}]}}],
  ['paths.set',{path:{use:'route',closed:false,points,stops:[{point:1,clip:'dance'}]}}],['paths.set',{path:{use:'route',closed:false,points,stops:Array(33).fill({point:0})}}],
  ['paths.set',{path:{id:'package/market',use:'route',closed:false,points}}],['paths.set',{path:{use:'route',closed:false,points,areaId:'x'}}],
  ['paths.remove',{}],['paths.remove',{id:'path-3',unbind:'yes'}],['paths.draw',{use:'loop'}],['paths.draw',{spawn:{ref:resident},bind:'u-7c2e91'}],
  ['paths.draw',{spawn:{}}],['paths.draw',{spawn:{ref:resident,reverse:true}}],['paths.finish',{id:'path-3'}],
  ['interaction.choose',{objectId:'porter-1'}],['interaction.choose',{objectId:'porter-1',interactionId:'Talk'}],['interaction.choose',{interactionId:'talk'}]];
 for(const [m,p] of bad)assert.ok(!ok(m,p),`${m} ${JSON.stringify(p)} should fail`);
});

test('IPC 0.23 result shapes for every new method',()=>{
 const rev={revision:7};
 assert.ok(res('npcs.spawn',{revision:7,id:'u-7c2e91'}));
 for(const m of ['npcs.bind','npcs.disable','npcs.remove','paths.remove','interaction.choose'])assert.ok(res(m,rev),m);
 assert.ok(res('paths.list',{paths:[record(),record({ref:'user/path-3',source:'user',id:'path-3',name:null,speed:null,walkable:false,
  problems:['no floor under (4.2, 0.0, -3.0)'],bound:[]}),record({ref:'package/rail',id:'rail',use:'track',walkable:null,stops:[],bound:[]})]}));
 assert.ok(res('paths.list',{paths:[]}));
 assert.ok(res('paths.set',{revision:7,id:'path-4'}));
 assert.ok(res('paths.draw',{revision:7,id:'path-5'}));
 assert.ok(res('paths.finish',{revision:7,id:'path-5',bound:'u-7c2e91'}));
 assert.ok(res('paths.finish',{revision:7,id:null,bound:null}));
 assert.ok(!res('npcs.spawn',rev),'spawn returns the id');
 assert.ok(!res('paths.set',rev),'set returns the id');
 assert.ok(!res('paths.finish',{revision:7}),'finish names id and bound');
 assert.ok(!res('paths.list',{paths:Array(193).fill(record())}),'at most 192 paths');
 assert.ok(!res('paths.list',{paths:[record({problems:Array(9).fill('p')})]}),'at most 8 problems');
 assert.ok(!res('paths.list',{paths:[record({bound:Array(9).fill('u-1')})]}),'at most 8 bound characters');
 assert.ok(!res('paths.list',{paths:[record({source:'library'})]}));
 assert.ok(!res('paths.list',{paths:[record({ref:'market-loop'})]}),'records carry qualified refs');
 const {walkable:_,...noWalkable}=record();assert.ok(!res('paths.list',{paths:[noWalkable]}));
});

test('IPC 0.23 npcs state: required, bounded and closed; deltas accept it',()=>{
 const latest=schema('0.23').$defs;
 assert.ok(latest.state.required.includes('npcs'));
 for(const s of [npcs(),npcs({state:'paused',reason:'battery'}),npcs({motion:'still',state:'still'}),npcs({motion:'off',state:'off'}),npcs({state:'none',usage:{authored:0,user:0}}),
  npcs({drawing:{pathId:'path-5',use:'route',spawn:{ref:resident},bind:null}}),npcs({drawing:{pathId:'path-5',use:'route',spawn:null,bind:'u-7c2e91'}}),
  npcs({aimed}),npcs({aimed:{...aimed,interactions:[]}}),npcs({aimed,interaction:saying}),npcs({interaction:choosing}),
  npcs({interaction:{...saying,interactionId:'map',type:'panel',label:'Open the map',line:null,lineCount:0,panel:'map'}})])
  assert.ok(delta({npcs:s}),JSON.stringify(s));
 const bad=[npcs({motion:'sometimes'}),npcs({state:'running'}),npcs({reason:'x'.repeat(65)}),npcs({reason:''}),npcs({usage:{authored:17,user:0}}),
  npcs({usage:{authored:0,user:9}}),npcs({limits:{authored:16}}),npcs({drawing:{pathId:'path-5',use:'route',spawn:null}}),
  npcs({drawing:{pathId:'path-5',use:'route',spawn:{ref:resident,phase:0.5},bind:null}}),npcs({aimed:{...aimed,interactions:Array(9).fill(aimed.interactions[0])}}),
  npcs({aimed:{...aimed,interactions:[{id:'go',label:'Go',type:'travel'}]}}),npcs({aimed:{...aimed,prompt:''}}),
  npcs({interaction:{...saying,choices:Array(9).fill({id:'talk',label:'Talk'})}}),npcs({interaction:{...saying,type:'quest'}}),
  npcs({interaction:{...saying,line:'x'.repeat(161)}}),npcs({interaction:{...saying,lineIndex:8}}),npcs({interaction:{...saying,lineCount:9}}),
  npcs({extra:1})];
 for(const s of bad)assert.ok(!delta({npcs:s}),JSON.stringify(s));
 const {aimed:_,...noAimed}=npcs();assert.ok(!delta({npcs:noAimed}));
 assert.ok(!delta({npcs:npcs()},'0.22'),'0.22 has no npcs key');
});

test('IPC 0.23 objects.instances and editor.paths shapes',()=>{
 assert.ok(delta({objects:objects()}));
 for(const activity of ['idle','walking','running','stopped','sitting','guiding','interacting','suspended'])assert.ok(delta({objects:objects([instance({activity})])}),activity);
 assert.ok(delta({objects:objects([instance({path:null,activity:'sitting',seat:'fountain-ledge',accent:null}),instance({state:'suspended',activity:'suspended'}),
  instance({id:'porter-1',source:'authored',ref:'package/resident',path:'package/market-loop',seat:'bench-east/left',activity:'sitting'})])}));
 for(const over of [{character:undefined},{accent:undefined},{character:'yes'},{path:'market-loop'},{path:'library/x/y'},{activity:'dancing'},
  {seat:'x'.repeat(193)},{seat:''},{accent:[1,1]},{accent:[0,0,1.5]}])
  assert.ok(!delta({objects:objects([instance(over)])}),JSON.stringify(over));
 assert.ok(!delta({objects:objects([instance()])},'0.22'),'0.22 instances have no character or accent');
 const editor=v=>schema(v).$defs.editorPath;
 assert.deepEqual(editor('0.23').required,[...editor('0.22').required,'use','name','speed','stops']);
 // editor.paths items: the editorPath definition compiled on its own.
 const ajv=new Ajv2020({strict:true});
 for(const d of readdirSync(new URL('../',import.meta.url)))for(const f of ['common','world'])
  if(/^v0(\.\d+)?$/.test(d)&&existsSync(new URL(`../${d}/${f}.schema.json`,import.meta.url)))ajv.addSchema(read(`${d}/${f}.schema.json`));
 ajv.addSchema(schema('0.23'));ajv.addSchema(schema('0.22'));
 const edit=ajv.getSchema('https://hyprune.com/schema/v0.23/ipc.schema.json#/$defs/editorPath');
 const edit22=ajv.getSchema('https://hyprune.com/schema/v0.22/ipc.schema.json#/$defs/editorPath');
 const {use,name,speed,stops:_,...plain}=editorPath();
 assert.ok(edit22(plain));assert.ok(!edit22(editorPath()),'0.22 paths have no use, name, speed or stops');assert.ok(!edit(plain),'0.23 requires them');
 assert.ok(edit(editorPath()));
 assert.ok(edit(editorPath({use:'generic',name:null,speed:null,stops:[]})));
 for(const over of [{use:undefined},{name:undefined},{speed:undefined},{stops:undefined},{use:'rail'},{name:''},{speed:0},{stops:Array(33).fill({point:0})},
  {stops:[{point:0,clip:'wave',face:{anchor:'desk'}}]},{stops:[{point:0,face:{anchor:'desk',object:'x'}}]},{stops:[{point:0,seat:'x'.repeat(193)}]}])
  assert.ok(!edit(JSON.parse(JSON.stringify(editorPath(over)))),JSON.stringify(over));
});

test('IPC 0.23 reticle interact and graphics npc_motion',()=>{
 const reticle=(action,v='0.23')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'s',sessionId:'s',baseRevision:1,revision:2,
  changes:{interaction:{mode:'movement',tool:1,tools:['pointer','mount','path','position','placement'],noclip:false,cursor:'reticle',taggedSurfaceId:null,reticle:{state:'valid',action}}}}},undefined,v).valid;
 assert.ok(reticle('interact'));assert.ok(!reticle('interact','0.22'));assert.ok(reticle('click','0.22'));assert.ok(!reticle('talk'));
 const set=(patch,v='0.23')=>ok('graphics.set',{patch},v);
 for(const value of ['auto','always','still','off']){assert.ok(set({npc_motion:value}),value);assert.ok(!set({npc_motion:value},'0.22'),value);}
 for(const value of [null,'on',true,1])assert.ok(!set({npc_motion:value}),String(value));
 const latest=schema('0.23').$defs;
 assert.deepEqual(latest.graphicsConfig.properties.npc_motion.enum,['auto','always','still','off']);
 assert.deepEqual(latest.graphicsPatch.properties.npc_motion.enum,['auto','always','still','off']);
});

test('IPC 0.23 inherits every 0.22 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.22'),latest=schema('0.23');
 assert.ok(latest.title.includes('0.23'));
 const changed=['session.hello.result','request','response','state','state.delta.notification','objectInstance','editorPath','reticle','graphicsConfig','graphicsPatch'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 for(const m of NEW_METHODS)for(const p of ['params','result','request','response'])assert.ok(added.includes(`${m}.${p}`),`${m}.${p}`);
 for(const k of ['pathId','pathRef','pathParam','pathUse','pathPoint','pathStop','pathRecord','userPath','seatRef','interactionId','npcAccent','npcActivity','npcMotion','npcPhase','npcSpeed','npcsState'])
  assert.ok(added.includes(k),k);
 const refs=(def,key)=>latest.$defs[def][key].map(r=>r.$ref);
 assert.deepEqual(refs('request','oneOf'),[...old.$defs.request.oneOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.request`)]);
 assert.deepEqual(refs('response','anyOf'),[...old.$defs.response.anyOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.response`)]);
 assert.deepEqual(latest.$defs.notification,old.$defs.notification,'no new events; notices are runtime.notice codes');
 const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
 assert.deepEqual(without(latest.$defs.state.properties,['npcs']),old.$defs.state.properties);
 assert.deepEqual(latest.$defs.state.required,[...old.$defs.state.required,'npcs']);
 const changes=d=>d.$defs['state.delta.notification'].properties.params.properties.changes;
 assert.deepEqual(without(changes(latest).properties,['npcs']),changes(old).properties);
 assert.deepEqual(without(latest.$defs.objectInstance.properties,['path','activity','seat','character','accent']),without(old.$defs.objectInstance.properties,['path','activity','seat']));
 assert.deepEqual(latest.$defs.objectInstance.required,[...old.$defs.objectInstance.required,'character','accent']);
 assert.deepEqual(without(latest.$defs.editorPath.properties,['use','name','speed','stops']),old.$defs.editorPath.properties);
 assert.deepEqual(latest.$defs.reticle.properties.action.enum,[...old.$defs.reticle.properties.action.enum,'interact']);
 for(const key of ['graphicsConfig','graphicsPatch']){
  assert.deepEqual(without(latest.$defs[key].properties,['npc_motion']),old.$defs[key].properties,key);
  assert.deepEqual(latest.$defs[key].required,old.$defs[key].required,key);
 }
 assert.deepEqual(latest.$defs['session.hello.params'],old.$defs['session.hello.params'],'no new grant');
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.23');
 assert.deepEqual(hello.methods.items.enum,[...oldHello.methods.items.enum,...NEW_METHODS]);
 assert.deepEqual(without(hello,['protocol','methods']),without(oldHello,['protocol','methods']));
 assert.ok(ipcProtocols.includes('0.23'));
 // A 0.22 state delta without any 0.23 key stays valid as 0.23.
 const s=read('examples/ipc/state.delta.notification.json');
 for(const v of ['0.22','0.23'])assert.equal(validate('ipc',s,undefined,v).valid,validate('ipc',s,undefined,'0.22').valid,v);
 assert.ok(delta({objects:{catalogRevision:1,instances:[],pocket:[],usage:objects().usage,limits:objects().limits}},'0.22'));
 assert.ok(delta({objects:{catalogRevision:1,instances:[],pocket:[],usage:objects().usage,limits:objects().limits}},'0.23'));
});
