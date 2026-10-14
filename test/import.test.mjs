import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, objectLimits, objectHardCaps} from '../lib/validate.mjs';

// Object format 0.11 sizes (RFC-0014: no refusals for size below the hard caps), import.json
// (importVersion 0.1) and the IPC 0.27 catalog fields an import shows (warnings, provenance, imported).
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const lantern=(v='0.11')=>({...read('examples/object.json'),formatVersion:v});
const box=(min,max,count)=>({componentType:5126,type:'VEC3',count,min,max});
const gltf=(triangles,proxy=12)=>({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],
 nodes:[{name:'post',mesh:0},{name:'flame',mesh:1},{name:'glass',mesh:2},{name:'proxy',mesh:3}],
 meshes:[{primitives:[{attributes:{POSITION:0},material:0}]},{primitives:[{attributes:{POSITION:1},material:1}]},
  {primitives:[{attributes:{POSITION:2},material:2}]},{primitives:[{attributes:{POSITION:3}}]}],
 materials:[{name:'iron'},{name:'flame'},{name:'lamp-glass'}],
 accessors:[box([-0.25,0,-0.25],[0.25,2.1,0.25],triangles*3),box([-0.05,2.2,-0.05],[0.05,2.4,0.05],3),box([-0.2,1.8,-0.2],[0.2,2.4,0.2],3),box([-0.25,0,-0.25],[0.25,2.4,0.25],proxy*3)]});
const check=(doc,options)=>validate('object',doc,undefined,undefined,options);

test('0.11: triangles, textures, GPU, proxy and directory budgets warn up to the hard caps',()=>{
 const big=check(lantern(),{gltf:gltf(180000,2500),measured:{maxTextureSize:4096,gpuBytes:200*1048576},files:[{path:'object.glb',size:40*1048576},{path:'thumbnail.png',size:1000}]});
 assert.equal(big.valid,true,big.errors.join('\n'));
 for(const w of ['triangles: 180001 exceeds 50000','proxy has 2500 triangles, more than 2000','textures: 4096 px exceeds 2048','gpu: 209715200 bytes exceeds','object.glb exceeds 33554432 bytes'])
  assert.ok(big.warnings.some(x=>x.includes(w) && x.endsWith('(recommended; it still loads)')),w+' in '+JSON.stringify(big.warnings));
 const huge=check(lantern(),{gltf:gltf(2100000),measured:{maxTextureSize:16384,gpuBytes:2048*1048576},files:[{path:'object.glb',size:70*1048576},{path:'thumbnail.png',size:1000}]});
 for(const e of ['exceeds 2000000 (the hard cap)','16384 px exceeds 8192 px (the hard cap)','exceeds 1073741824 (the hard cap)','exceeds 67108864 bytes (the hard cap)'])
  assert.ok(huge.errors.some(x=>x.includes(e)),e+' in '+JSON.stringify(huge.errors));
 assert.equal(objectHardCaps.triangles,2000000);assert.equal(objectLimits.triangles,50000);
});

test('formats before 0.11, characters and items keep their budgets as errors',()=>{
 const old=check(lantern('0.10'),{gltf:gltf(60000)});
 assert.ok(old.errors.some(e=>e==='triangles: 60001 exceeds 50000'),JSON.stringify(old.errors));
 const item=read('examples/object-machine.json');
 const r=check({...item,formatVersion:'0.11',slots:undefined,traits:{mover:{speed:1,item:true},decorative:item.traits.decorative}},{measured:{gpuBytes:2*1048576}});
 assert.ok(r.errors.some(e=>e.startsWith('gpu: 2097152 bytes exceeds 1048576')) && !r.errors.some(e=>e.includes('hard cap')),JSON.stringify(r.errors));
});

const record=(over={})=>({importVersion:'0.1',source:{name:'crate.gltf',format:'gltf',bytes:43211,sha256:'0'.repeat(64)},
 converter:{name:'hyprune object import',version:'0.11.0',backend:'gltf'},
 options:{units:'cm',scale:0.01,up:'z',yaw:0,surface:'floor',maxTriangles:50000,maxTexture:2048,collision:'convex',ktx2:'auto',lighting:'lit'},
 measured:{before:{triangles:12000,maxTexture:4096,gpuBytes:9e7,collisionTriangles:null,extent:[120,80,60]},
           after:{triangles:5000,maxTexture:2048,gpuBytes:2e7,collisionTriangles:120,extent:[1.2,0.8,0.6]}},
 steps:['read glTF','decimated 12000 -> 5000 triangles'],license:{spdx:'LicenseRef-unknown',author:'unknown',source:'unknown'},
 importedAt:'2026-10-14T21:00:00Z',...over});

test('import.json: importVersion 0.1, closed, an SPDX licence or LicenseRef-unknown',()=>{
 assert.deepEqual(validate('import',record()).errors,[]);
 assert.deepEqual(validate('import',record({license:{spdx:'CC0-1.0',author:'A. Modeller',source:'https://example.com/crate'}})).errors,[]);
 for(const bad of [{importVersion:'0.2'},{extra:1},{importedAt:'yesterday'},{license:{spdx:'Bogus 1.0',author:'a',source:'b'}},
  {source:{name:'x.blend',format:'blend',bytes:1,sha256:'0'.repeat(64)}},{steps:Array(33).fill('x')}])
  assert.equal(validate('import',record(bad)).valid,false,JSON.stringify(bad));
 // Beside an object it is checked with the object.
 const r=check(lantern(),{importRecord:record({importVersion:'0.9'})});
 assert.ok(r.errors.some(e=>e.startsWith('import.json: ')),JSON.stringify(r.errors));
 assert.equal(check(lantern(),{importRecord:record()}).valid,true);
});

test('IPC 0.27 catalog entries: warnings, provenance and imported are required',()=>{
 const entry=(over={})=>({ref:'user/crate',source:'user',id:'crate',version:'1.0.0',formatVersion:'0.11',name:'Crate',description:null,
  category:'other',tags:['imported'],traits:['collidable','movable'],surfaces:['floor'],scale:[0.25,4],bounds:{min:[-0.6,0,-0.4],max:[0.6,0.8,0.4]},
  triangles:5000,gpuBytes:2e7,collisionTriangles:120,thumbnail:null,license:'LicenseRef-unknown',library:null,versions:[],state:'ready',placeable:true,
  reason:null,errors:[],machine:null,companion:null,screen:null,warnings:['triangles: 60002 exceeds 50000 (recommended; it still loads)'],
  provenance:{license:'unknown',author:'unknown',source:'unknown'},imported:{at:'2026-10-14T21:00:00Z',sourceName:'crate.gltf'},...over});
 const ok=e=>validate('ipc',{jsonrpc:'2.0',id:'c',result:{revision:1,entries:[e]}},'objects.catalog','0.27').valid;
 assert.ok(ok(entry()));
 assert.ok(ok(entry({provenance:null,imported:null,warnings:[]})));
 for(const k of ['warnings','provenance','imported']){const e=entry();delete e[k];assert.ok(!ok(e),k);}
 assert.ok(!ok(entry({warnings:Array(9).fill('w')})));
 assert.ok(!ok(entry({provenance:{license:'CC0-1.0',author:'a'}})));
});
