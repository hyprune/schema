import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import {validate, ipcProtocols} from '../lib/validate.mjs';
const ajv=new Ajv({strict:true,allErrors:true});
// Shared definitions the IPC schemas reference (common/world by version).
for(const dir of readdirSync(new URL('..',import.meta.url)).filter(d=>/^v0(\.\d+)?$/.test(d)))
 for(const name of ['common','world'])
  if(existsSync(new URL(`../${dir}/${name}.schema.json`,import.meta.url)))ajv.addSchema(JSON.parse(readFileSync(new URL(`../${dir}/${name}.schema.json`,import.meta.url))));
const blueprint=ajv.compile(JSON.parse(readFileSync(new URL('../extensions/blueprint.schema.json',import.meta.url))));
const level=(over={})=>({id:'ground',name:'Ground',minY:-2,maxY:4.5,path:'blueprint/ground.svg',...over});
const req=(method,params)=>({jsonrpc:'2.0',id:'p1',method,params});
const res=(method,result,v)=>validate('ipc',{jsonrpc:'2.0',id:'p1',result},method,v).valid;
const map={svg:'<svg/>',sha256:'a'.repeat(64),bounds:[0,0,1,1],worldToMap:[1,0,0,1,0,0]};

test('com.hyprune.blueprint 0.1 manifest value',()=>{
 assert.equal(blueprint({version:'0.1',levels:[level(),level({id:'upper',name:'Upper decks',minY:4.5,maxY:40,path:'blueprint/upper.svg'})]}),true);
 for(const bad of [{version:'0.2',levels:[level()]},{version:'0.1',levels:[]},{version:'0.1',levels:Array(7).fill(level())},
  {version:'0.1',levels:[level({id:'Ground'})]},{version:'0.1',levels:[level({name:''})]},{version:'0.1',levels:[level({path:'../x.svg'})]},
  {version:'0.1',levels:[level({path:'/abs.svg'})]},{version:'0.1',levels:[level({path:'blueprint/x.png'})]},{version:'0.1',levels:[level({extra:1})]},
  {version:'0.1',levels:[level()],other:true}])
  assert.equal(blueprint(bad),false,JSON.stringify(bad));
});

test('IPC 0.20 surface.pocket / surface.unpocket; 0.19 stays frozen',()=>{
 for(const m of ['surface.pocket','surface.unpocket']){
  assert.equal(validate('ipc',req(m,{surfaceId:'surface-1'}),undefined,'0.20').valid,true,m);
  assert.equal(validate('ipc',req(m,{surfaceId:'surface-1'}),undefined,'0.19').valid,false,m);
  for(const bad of [{},{surfaceId:''},{surfaceId:'s',anchorId:'a'},{surfaceId:1}])assert.equal(validate('ipc',req(m,bad),undefined,'0.20').valid,false,JSON.stringify(bad));
 }
 assert.equal(res('surface.pocket',{revision:3},'0.20'),true);
 assert.equal(res('surface.pocket',{revision:3,placed:true},'0.20'),false);
 assert.equal(res('surface.unpocket',{revision:3,placed:false},'0.20'),true);
 assert.equal(res('surface.unpocket',{revision:3},'0.20'),false);
});

test('IPC 0.20 map levels are optional, closed and bounded; 0.19 rejects them',()=>{
 const schema=JSON.parse(readFileSync(new URL('../v0.20/ipc.schema.json',import.meta.url)));
 // Just the map definition of each version (the root's message anyOf is not part of it).
 const mapAt=v=>{const s=JSON.parse(readFileSync(new URL(`../v${v}/ipc.schema.json`,import.meta.url)));return ajv.compile({$schema:s.$schema,$id:`test-map-${v}`,$defs:s.$defs,$ref:'#/$defs/map'});};
 const m20=mapAt('0.20'),m19=mapAt('0.19');
 const lv=(over={})=>({id:'ground',name:'Ground',minY:-2,maxY:4.5,svg:'<svg/>',sha256:'b'.repeat(64),...over});
 assert.equal(m20(map),true);
 assert.equal(m20({...map,levels:[lv(),lv({id:'upper',minY:4.5,maxY:40})]}),true);
 assert.equal(m19({...map,levels:[lv()]}),false);
 for(const bad of [[],Array(7).fill(lv()),[lv({svg:''})],[lv({svg:'x'.repeat(65537)})],[lv({sha256:'B'.repeat(64)})],[lv({id:'9x'})],[lv({path:'x.svg'})]])
  assert.equal(m20({...map,levels:bad}),false,JSON.stringify(bad).slice(0,80));
 assert.ok(schema.title.includes('0.20'));
});

test('IPC 0.20 inherits every 0.19 definition except the listed changes and is negotiable',()=>{
 const schema=v=>JSON.parse(readFileSync(new URL(`../v${v}/ipc.schema.json`,import.meta.url)));
 const old=schema('0.19'),latest=schema('0.20');
 const added=['surface.pocket','surface.unpocket'].flatMap(m=>['params','result','request','response'].map(p=>`${m}.${p}`));
 const changed=['session.hello.result','request','response','map'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)).sort(),added.sort());
 const {levels,...mapRest}=latest.$defs.map.properties;
 assert.ok(levels);assert.deepEqual(mapRest,old.$defs.map.properties);assert.deepEqual(latest.$defs.map.required,old.$defs.map.required);
 const hello=latest.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.20');
 for(const m of ['surface.pocket','surface.unpocket']){
  assert.ok(hello.methods.items.enum.includes(m),m);
  assert.ok(!old.$defs['session.hello.result'].properties.methods.items.enum.includes(m),m);
 }
 assert.ok(ipcProtocols.includes('0.20'));
});
