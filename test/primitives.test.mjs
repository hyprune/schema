import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.31 (draft): primitives and materials in the builder: placement keys, dry runs, asset
// swaps (objects.configure ref), catalog primitives, 512 placements in a world folder; the
// primitive.json and material.json records; project 0.2 placement keys.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const req=(method,params)=>({jsonrpc:'2.0',id:'p1',method,params});
const res=(result)=>({jsonrpc:'2.0',id:'p1',result});
const ok=(method,params,v='0.31')=>validate('ipc',req(method,params),undefined,v).valid;
const okResult=(method,result,v='0.31')=>validate('ipc',res(result),method,v).valid;
const pose={position:[1,0,-2],rotation:[0,0,0,1]};
const changed=['session.hello.result','objects.place.params','objects.place.result','objects.transform.params','objects.transform.result',
 'objects.configure.params','objects.configure.result','objects.remove.params','objects.remove.result','objectInstance','catalogEntry','builderState','error'];

test('IPC 0.31 inherits every 0.30 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.30'),latest=schema('0.31');
 assert.ok(latest.title.includes('0.31'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.31/ipc.schema.json');
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),['objectKey','catalogPrimitive']);
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.31');
 const {protocol:_a,...rest}=hello,{protocol:_b,...oldRest}=oldHello;
 assert.deepEqual(rest,oldRest,'no new method, event or grant');
 assert.ok(ipcProtocols.includes('0.31'));
});

test('objects.place: key, ifExists and dryRun in 0.31 only',()=>{
 assert.ok(ok('objects.place',{ref:'world/box-1a2b3c4d',pose,key:'cpu-tower',ifExists:'update',dryRun:true}));
 for(const bad of [{key:'Tower'},{key:'x'.repeat(49)},{ifExists:'replace'},{dryRun:1}])
  assert.ok(!ok('objects.place',{ref:'world/box',pose,...bad}),JSON.stringify(bad));
 assert.ok(!ok('objects.place',{ref:'world/box',pose,key:'tower'},'0.30'),'0.30 has no key');
 assert.ok(okResult('objects.place',{revision:3,id:'u-1a2b3c',dryRun:true}));
 assert.ok(okResult('objects.place',{revision:3,id:'u-1a2b3c',updated:true}));
 assert.ok(!okResult('objects.place',{revision:3,id:'u-1a2b3c',dryRun:false}));
});

test('transform, configure and remove take an id or a key; configure swaps ref and names keys',()=>{
 assert.ok(ok('objects.transform',{key:'tower',pose,dryRun:true}));
 assert.ok(ok('objects.transform',{id:'u-1a2b3c',pose}));
 assert.ok(!ok('objects.transform',{id:'u-1a2b3c',key:'tower',pose}),'one of id and key');
 assert.ok(!ok('objects.transform',{pose}));
 assert.ok(!ok('objects.transform',{key:'tower',pose},'0.30'));
 assert.ok(ok('objects.configure',{key:'tower',patch:{ref:'world/box-2b3c4d5e'}}));
 assert.ok(ok('objects.configure',{id:'u-1a2b3c',patch:{key:'tower'},dryRun:true}));
 assert.ok(ok('objects.configure',{id:'u-1a2b3c',patch:{key:null}}));
 assert.ok(!ok('objects.configure',{id:'u-1a2b3c',patch:{ref:'world/box'}},'0.30'));
 assert.ok(ok('objects.remove',{key:'tower'}));
 assert.ok(ok('objects.remove',{all:true}));
 assert.ok(!ok('objects.remove',{key:'tower'},'0.30'));
 assert.ok(okResult('objects.remove',{revision:4,removed:false}));
});

test('errors may carry a hint, a field and the placement a taken key names',()=>{
 const err=data=>validate('ipc',{jsonrpc:'2.0',id:'p1',error:{code:-32005,message:'the key beacon names Box (u-1a2b3c)',data}},undefined,'0.31').valid;
 assert.ok(err({retryable:false,rule:'key.taken',id:'u-1a2b3c',key:'beacon',hint:'Use ifExists: update to move it, or another key'}));
 assert.ok(err({retryable:false,rule:'budget',field:'scale'}));
 assert.ok(!err({retryable:false,extra:1}));
 assert.ok(!validate('ipc',{jsonrpc:'2.0',id:'p1',error:{code:-32005,message:'x',data:{retryable:false,hint:'h'}}},undefined,'0.30').valid,'0.30 has no hint');
});

test('state: instances carry key; catalog entries carry primitive; folders hold 512 placements',()=>{
 const d=schema('0.31').$defs;
 assert.ok(d.objectInstance.required.includes('key') && !schema('0.30').$defs.objectInstance.required.includes('key'));
 assert.ok(d.catalogEntry.required.includes('primitive'));
 assert.equal(d.builderState.properties.placements.maximum,512);
 assert.equal(schema('0.30').$defs.builderState.properties.placements.maximum,128);
 const prim={shape:'box',size:[2,0.2,1],material:{key:'oak',name:'Oak',colour:'#a0703c',textured:true}};
 const v=validate('ipc',{jsonrpc:'2.0',id:'c',result:{revision:1,entries:[]}},'objects.catalog','0.31');
 assert.ok(v.valid);
 assert.equal(JSON.stringify(d.catalogPrimitive.properties.shape.enum),JSON.stringify(['cube','box','cylinder','sphere','plane','ramp','stairs']));
 assert.ok(prim);
});

const material=(over={})=>({materialVersion:'0.1',key:'oak',name:'Oak planks',colour:'#ffffff',texture:{image:'texture.jpg',tile:1.2,width:1024,height:1024},
 emissive:null,roughness:0.8,metallic:0,license:'CC0-1.0',author:'Ada',source:'https://example.com/oak',...over});
const primitive=(over={})=>({primitiveVersion:'0.1',shape:'box',size:[2,0.2,1],material:{key:'oak',name:'Oak planks',colour:'#ffffff',textured:true,
 digest:'sha256:'+'a'.repeat(64)},generator:{name:'hyprune builder primitive',version:'0.13.0'},...over});

test('material.json and primitive.json records',()=>{
 assert.deepEqual(validate('material',material()).errors,[]);
 assert.deepEqual(validate('material',material({texture:null,emissive:{colour:'#ff8800',strength:4}})).errors,[]);
 for(const bad of [{colour:'#FFF'},{texture:{image:'x.png',tile:1,width:2,height:2}},{texture:{image:'texture.jpg',tile:0,width:2,height:2}},
  {emissive:{colour:'#ffffff',strength:20}},{roughness:2},{key:'Oak'},{extra:1}])
  assert.equal(validate('material',material(bad)).valid,false,JSON.stringify(bad));
 assert.ok(validate('material',material({license:'Bogus 9'})).errors.some(e=>e.startsWith('license')));
 assert.ok(validate('material',material({texture:{image:'texture.ktx2',tile:1,width:1000,height:1000}})).warnings.length===1);
 assert.deepEqual(validate('primitive',primitive()).errors,[]);
 assert.deepEqual(validate('primitive',primitive({shape:'stairs',size:[1.2,1,2],steps:6})).errors,[]);
 assert.deepEqual(validate('primitive',primitive({shape:'cube',size:[1,1,1]})).errors,[]);
 assert.ok(validate('primitive',primitive({shape:'cube',size:[1,2,1]})).errors.some(e=>e.includes('cube')));
 assert.ok(validate('primitive',primitive({shape:'stairs'})).errors.some(e=>e.includes('steps')));
 assert.ok(validate('primitive',primitive({steps:3})).errors.some(e=>e.includes('only stairs')));
 for(const bad of [{shape:'torus'},{size:[0,1,1]},{size:[1,1]},{material:{key:null,name:'x',colour:'#000000',textured:false}}])
  assert.equal(validate('primitive',primitive(bad)).valid,false,JSON.stringify(bad));
});

test('project 0.2 placements take unique keys; 0.1 has none',()=>{
 const base={projectVersion:'0.2',id:'local.garden',name:'Garden',starter:'open-plain@0.2',base:'builder/base.json',
  sky:{image:'sky/panorama.jpg',preset:'sunset',license:'CC0-1.0',author:'a',source:'b'},placements:[]};
 const p=(id,key)=>({id,ref:'world/box-1a2b3c4d',pose,scale:1,...(key?{key}:{})});
 assert.deepEqual(validate('project',{...base,placements:[p('u-000001','tower'),p('u-000002','desk'),p('u-000003')]}).errors,[]);
 assert.ok(validate('project',{...base,placements:[p('u-000001','tower'),p('u-000002','tower')]}).errors.some(e=>e.includes('key tower')));
 assert.equal(validate('project',{...base,placements:[p('u-000001','Tower')]}).valid,false);
 assert.equal(validate('project',{...base,projectVersion:'0.1',starter:'flat-land@0.1',sky:{image:null,license:'CC0-1.0',author:'a',source:'b'},placements:[p('u-000001','tower')]}).valid,false);
});
