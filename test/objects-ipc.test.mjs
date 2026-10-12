import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.22 (RFC-0011 P1): object catalog, user placements, libraries and objects.control.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const req=(method,params)=>({jsonrpc:'2.0',id:'o1',method,params});
const ok=(method,params,v='0.22')=>validate('ipc',req(method,params),undefined,v).valid;
const res=(method,result,v='0.22')=>validate('ipc',{jsonrpc:'2.0',id:'o1',result},method,v).valid;
const delta=(changes,v='0.22')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;

const NEW_METHODS=['objects.catalog','objects.pocket','objects.place','objects.transform','objects.remove','objects.hide','objects.reset',
 'objects.configure','libraries.list','libraries.install','libraries.remove'];
const rack='library/com.hyprune.starter@0.1.0/server-rack';
const pose={position:[3.2,0,-4.5],rotation:[0,0.259,0,0.966]};
const instance=(over={})=>({id:'u-7c2e91',source:'user',ref:rack,name:'Server rack',areaId:'sun-court',pose,scale:1,state:'active',
 movable:true,locked:false,rule:null,path:null,activity:null,seat:null,...over});
const usage={placements:1,assets:1,triangles:4210,gpuBytes:1048576,collisionTriangles:12};
const limits={placements:128,assets:32,triangles:400000,gpuBytes:201326592,collisionTriangles:10000};
const objects=(over={})=>({catalogRevision:3,instances:[instance(),instance({id:'sun-court-armillary',source:'authored',ref:'package/armillary',
 name:'armillary',state:'hidden',movable:false})],pocket:[{itemId:'pocket-1',ref:'user/lamp',name:'Lamp'}],usage,limits,...over});
const entry=(over={})=>({ref:rack,source:'library',id:'server-rack',version:'1.0.0',formatVersion:'0.10',name:'Server rack',description:null,
 category:'machines',tags:['rack'],traits:['decorative','collidable','movable','machine'],surfaces:['floor'],scale:[1,1],
 bounds:{min:[-0.62,0,-0.65],max:[0.62,2.16,0.65]},triangles:4210,gpuBytes:1048576,collisionTriangles:12,
 thumbnail:'/home/u/.local/share/hyprune/libraries/com.hyprune.starter@0.1.0/objects/server-rack/thumbnail.png',license:'CC-BY-4.0',
 library:'com.hyprune.starter@0.1.0',versions:[],state:'ready',placeable:true,reason:null,errors:[],...over});
const library=(over={})=>({id:'com.hyprune.starter',version:'0.1.0',name:'Hyprune starter kit',formatVersion:'0.10',objects:11,root:'user',
 state:'ready',errors:[],digest:'a'.repeat(64),...over});

test('IPC 0.22 request shapes for every new method; 0.21 rejects them',()=>{
 const good=[['objects.catalog',{}],['objects.pocket',{ref:rack}],['objects.pocket',{ref:'user/street-lantern'}],['objects.pocket',{ref:'package/armillary'}],
  ['objects.place',{ref:rack}],['objects.place',{ref:rack,pose,scale:1.1}],['objects.transform',{id:'u-7c2e91',pose}],
  ['objects.transform',{id:'sun-court-armillary',pose,scale:0.5}],['objects.remove',{id:'u-7c2e91'}],['objects.remove',{all:true}],
  ['objects.hide',{id:'sun-court-armillary',hidden:true}],['objects.reset',{id:'u-7c2e91'}],['objects.reset',{all:true}],
  ['objects.configure',{id:'u-7c2e91',patch:{locked:true}}],['libraries.list',{}],
  ['libraries.install',{archive:'/tmp/com.hyprune.starter-0.1.0.tar.zst',sha256:'f'.repeat(64)}],
  ['libraries.remove',{id:'com.hyprune.starter',version:'0.1.0'}]];
 for(const [m,p] of good){assert.ok(ok(m,p),`${m} ${JSON.stringify(p)}`);assert.ok(!ok(m,p,'0.21'),`${m} in 0.21`);}
 const bad=[['objects.catalog',{all:true}],['objects.pocket',{}],['objects.pocket',{ref:'street-lantern'}],['objects.pocket',{ref:'library/street/lamp'}],
  ['objects.pocket',{ref:'library/com.hyprune.street@1.2/lamp'}],['objects.pocket',{ref:'package/../x'}],['objects.pocket',{ref:'user/Lamp'}],
  ['objects.place',{ref:rack,scale:5}],['objects.place',{ref:rack,scale:0.2}],['objects.place',{ref:rack,pose:{position:[0,0],rotation:[0,0,0,1]}}],
  ['objects.place',{ref:rack,pose:{position:[0,0,200000],rotation:[0,0,0,1]}}],['objects.place',{ref:rack,extra:1}],
  ['objects.transform',{id:'u-7c2e91'}],['objects.transform',{id:'U!',pose}],['objects.remove',{}],['objects.remove',{all:false}],
  ['objects.remove',{id:'u-7c2e91',all:true}],['objects.hide',{id:'x'}],['objects.reset',{}],['objects.configure',{id:'x',patch:{}}],
  ['objects.configure',{id:'x',patch:{speed:1}}],['objects.configure',{id:'x',patch:{locked:'yes'}}],
  ['libraries.install',{archive:'relative.tar.zst',sha256:'f'.repeat(64)}],['libraries.install',{archive:'/tmp/x.zip',sha256:'f'.repeat(64)}],
  ['libraries.install',{archive:'/tmp/x.tar.zst',sha256:'F'.repeat(64)}],['libraries.install',{archive:'/tmp/x.tar.zst'}],
  ['libraries.remove',{id:'starter',version:'0.1.0'}],['libraries.remove',{id:'com.hyprune.starter'}]];
 for(const [m,p] of bad)assert.ok(!ok(m,p),`${m} ${JSON.stringify(p)} should fail`);
});

test('IPC 0.22 result shapes for every new method',()=>{
 const rev={revision:7};
 assert.ok(res('objects.catalog',{revision:3,entries:[entry(),entry({ref:'user/broken',source:'user',id:'broken',library:null,version:'0.0.1',
  state:'invalid',placeable:false,reason:'invalid: bounds: min y must be 0',errors:['bounds: min y must be 0'],bounds:null,triangles:null,gpuBytes:null,
  collisionTriangles:null,thumbnail:null,traits:[],surfaces:null,scale:null}),entry({ref:'package/armillary',source:'package',id:'armillary',version:null,
  formatVersion:null,library:null,traits:['decorative'],surfaces:null,scale:null,placeable:false,reason:'not movable: only objects with the movable trait can be placed'})]}));
 assert.ok(res('objects.pocket',{revision:7,itemId:'pocket-3'}));
 assert.ok(res('objects.place',{revision:7,id:'u-7c2e91'}));
 for(const m of ['objects.transform','objects.remove','objects.hide','objects.reset','objects.configure','libraries.remove'])assert.ok(res(m,rev),m);
 assert.ok(res('libraries.list',{libraries:[library(),library({version:'0.2.0',root:'system',state:'conflict',errors:['digest differs'],digest:null})]}));
 assert.ok(res('libraries.install',{revision:9,id:'com.hyprune.starter',version:'0.1.0'}));
 assert.ok(!res('objects.place',rev),'place returns the id');
 assert.ok(!res('objects.pocket',{revision:1,itemId:'item-1'}));
 assert.ok(!res('objects.catalog',{revision:1,entries:[entry({state:'loading'})]}));
 assert.ok(!res('objects.catalog',{revision:1,entries:[entry({thumbnail:'relative.png'})]}),'thumbnails are absolute paths');
 assert.ok(!res('objects.catalog',{revision:1,entries:[entry({errors:Array(9).fill('e')})]}),'at most 8 errors');
 assert.ok(!res('objects.catalog',{revision:1,entries:[entry({traits:['wings']})]}));
 assert.ok(!res('objects.catalog',{revision:1,entries:Array(1025).fill(entry())}),'at most 1024 entries');
 assert.ok(!res('libraries.list',{libraries:[library({root:'system-wide'})]}));
});

test('IPC 0.22 state carries objects; deltas accept it; bounds and closed shapes',()=>{
 const s=read('examples/ipc/state.delta.notification.json');
 assert.ok(delta({objects:objects()}));
 assert.ok(!delta({objects:objects()},'0.21'),'0.21 has no objects key');
 assert.ok(delta({objects:objects({instances:[],pocket:[]})}));
 assert.ok(!delta({objects:objects({instances:Array(513).fill(instance())})}),'at most 512 instances');
 assert.ok(!delta({objects:objects({pocket:Array(17).fill({itemId:'pocket-1',ref:rack,name:'x'})})}),'at most 16 pocket items');
 assert.ok(!delta({objects:objects({instances:[instance({state:'gone'})]})}));
 assert.ok(!delta({objects:objects({instances:[instance({path:'user/path-1'})]})}),'path waits for P2');
 assert.ok(delta({objects:objects({instances:[instance({state:'blocked',rule:'walls'})]})}));
 assert.ok(!delta({objects:objects({instances:[instance({rule:'gravity'})]})}));
 assert.ok(!delta({objects:{...objects(),extra:1}}));
 const {usage:_,...noUsage}=objects();assert.ok(!delta({objects:noUsage}));
 assert.ok(s);
});

test('IPC 0.22 editor: node selection, universal submode, gizmo state and object pocket items',()=>{
 const latest=schema('0.22').$defs,old=schema('0.21').$defs;
 assert.deepEqual(latest.editor.properties.selectedKind.enum,[...old.editor.properties.selectedKind.enum,'node']);
 assert.deepEqual(latest.editor.properties.submode.enum,[...old.editor.properties.submode.enum,'universal']);
 assert.deepEqual(latest.editor.required,[...old.editor.required,'gizmo']);
 assert.deepEqual(latest.unplaced.required,[...old.unplaced.required,'objects']);
 assert.equal(latest.unplaced.properties.count.maximum,32);
 const err=(data,v='0.22')=>validate('ipc',{jsonrpc:'2.0',id:'o1',error:{code:-32007,message:'walls: the shape is inside a wall',data}},undefined,v).valid;
 assert.ok(err({retryable:false,rule:'walls'}));
 assert.ok(!err({retryable:false,rule:'walls'},'0.21'),'0.21 error data has no rule');
 assert.ok(err({retryable:true}));
 assert.ok(!err({rule:'walls'}),'retryable stays required');
});

test('IPC 0.22 inherits every 0.21 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.21'),latest=schema('0.22');
 assert.ok(latest.title.includes('0.22'));
 const changed=['session.hello.params','session.hello.result','request','response','state','state.delta.notification','editor','unplaced','error'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 for(const m of NEW_METHODS)for(const p of ['params','result','request','response'])assert.ok(added.includes(`${m}.${p}`),`${m}.${p}`);
 for(const k of ['objectRef','objectId','objectPose','objectInstance','objectsState','catalogEntry','libraryRecord','objectPocketItem'])assert.ok(added.includes(k),k);
 const refs=(def,key)=>latest.$defs[def][key].map(r=>r.$ref);
 assert.deepEqual(refs('request','oneOf'),[...old.$defs.request.oneOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.request`)]);
 assert.deepEqual(refs('response','anyOf'),[...old.$defs.response.anyOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.response`)]);
 assert.deepEqual(latest.$defs.notification,old.$defs.notification,'no new events');
 const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
 assert.deepEqual(without(latest.$defs.state.properties,['objects']),old.$defs.state.properties);
 assert.deepEqual(latest.$defs.state.required,[...old.$defs.state.required,'objects']);
 const changes=d=>d.$defs['state.delta.notification'].properties.params.properties.changes;
 assert.deepEqual(without(changes(latest).properties,['objects']),changes(old).properties);
 assert.deepEqual(without(latest.$defs.editor.properties,['selectedKind','submode','gizmo']),without(old.$defs.editor.properties,['selectedKind','submode']));
 assert.deepEqual(without(latest.$defs.unplaced.properties,['count','objects']),without(old.$defs.unplaced.properties,['count']));
 const data=d=>d.$defs.error.properties.error.properties.data;
 assert.deepEqual(without(data(latest).properties,['rule']),data(old).properties);
 assert.deepEqual(data(latest).required,data(old).required);
 for(const key of ['session.hello.params','session.hello.result']){
  const caps=v=>v.$defs[key].properties.capabilities.items.enum;
  assert.deepEqual(caps(latest),[...caps(old),'objects.control'],key);
  assert.deepEqual(without(latest.$defs[key].properties,['capabilities','protocol','methods']),without(old.$defs[key].properties,['capabilities','protocol','methods']));
 }
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.22');
 assert.deepEqual(hello.methods.items.enum,[...oldHello.methods.items.enum,...NEW_METHODS]);
 assert.ok(ipcProtocols.includes('0.22'));
 const helloRequest=(caps,v)=>validate('ipc',req('session.hello',{protocols:[v],client:{id:'org.example.shell',name:'Shell'},capabilities:caps}),undefined,v).valid;
 assert.ok(helloRequest(['state.read','objects.control'],'0.22'));
 assert.ok(!helloRequest(['state.read','objects.control'],'0.21'),'objects.control is new in 0.22');
});
