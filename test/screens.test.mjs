import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols, objectFormats, screenAspect} from '../lib/validate.mjs';

// Object format 0.11 (draft) and IPC 0.27: workspace screens, the mount trait's
// mounted-workspace anchor placed as a user object that shows a workspace.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const screen=()=>read('examples/object-screen.json');
const errors=(doc,options,version)=>validate('object',doc,undefined,version,options).errors;
const rejects=(doc,pattern,options,version)=>{
 const r=validate('object',doc,undefined,version,options);
 assert.equal(r.valid,false,`expected ${pattern}`);
 assert.ok(r.errors.some(e=>pattern.test(e)),`${pattern} not in ${JSON.stringify(r.errors)}`);
};
const withAnchor=(over,doc=screen())=>{doc.traits.mount.anchors[0]={...doc.traits.mount.anchors[0],...over};return doc;};
const req=(method,params)=>({jsonrpc:'2.0',id:'s1',method,params});
const ok=(method,params,v='0.27')=>validate('ipc',req(method,params),undefined,v).valid;
const delta=(changes,v='0.27')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;

test('object format 0.11 is discovered and enables the mount trait',()=>{
 assert.ok(objectFormats.includes('0.11'));
 assert.deepEqual(errors(screen()),[]);
 rejects({...screen(),formatVersion:'0.10'},/^traits\.mount: needs object format 0\.11/,undefined,'0.10');
 // Every 0.10 object is still a valid 0.11 object (apart from formatVersion).
 for(const name of ['object','object-character','object-seat','object-machine'])
  assert.deepEqual(errors({...read(`examples/${name}.json`),formatVersion:'0.11'}),[],name);
 assert.deepEqual(validate('library',{...read('examples/library.json'),formatVersion:'0.11'}).errors,[]);
});

test('screen aspect: 16:9 within 0.5 %, 21:9 from 2.33 to 2.39',()=>{
 assert.equal(screenAspect([3.2,1.8]),'16:9');
 assert.equal(screenAspect([1.6*1.004,0.9]),'16:9');
 assert.equal(screenAspect([1.6*1.006,0.9]),null);
 for(const s of [[2.1,0.9],[2.56,1.08],[3.44,1.44]])assert.equal(screenAspect(s),'21:9',JSON.stringify(s));
 for(const s of [[1,1],[4,3],[2.0,0.9],[2.4,0.9]])assert.equal(screenAspect(s),null,JSON.stringify(s));
 assert.deepEqual(errors(withAnchor({size:[4.2,1.8],pose:{position:[0,0.96,0.07],rotation:[0,0,0,1]}},
  {...screen(),bounds:{min:[-2.2,0,0],max:[2.2,1.92,0.08]}})),[],'21:9');
 rejects(withAnchor({size:[2.4,1.8]}),/a workspace screen is 16:9 or 21:9, not 1\.333:1/);
 rejects(withAnchor({size:[1.2,0.675]}),/at least 0\.9 m high/);
 // tool-mount anchors keep any aspect and size.
 const tool=screen();tool.traits.mount.anchors.push({id:'tool',role:'tool-mount',mountType:'hanging-wall',
  pose:{position:[1.2,0.5,0.07],rotation:[0,0,0,1]},size:[0.4,0.4]});
 assert.deepEqual(errors(tool),[]);
});

test('mount anchors: shape, one workspace anchor, inside the bounds, combinations',()=>{
 for(const bad of [{role:'data-object'},{mountType:'billboard'},{size:[3.2]},{size:[3.2,0]},{size:[17,9]},{frameNode:''},{extra:1},{screenType:'Not an id'}])
  assert.equal(validate('object',withAnchor(bad)).valid,false,JSON.stringify(bad));
 const two=screen();two.traits.mount.anchors.push({...two.traits.mount.anchors[0],id:'second'});
 rejects(two,/at most one mounted-workspace anchor/);
 const dup=screen();dup.traits.mount.anchors.push({...dup.traits.mount.anchors[0],role:'tool-mount'});
 rejects(dup,/traits\.mount anchors: duplicate id/);
 rejects({...screen(),traits:{...screen().traits,mount:{anchors:[]}}},/fewer than 1/);
 rejects(withAnchor({pose:{position:[0,0.96,0.07],rotation:[0,0,0,0.5]}}),/quaternion must be normalized/);
 rejects(withAnchor({pose:{position:[0,1.2,0.07],rotation:[0,0,0,1]}}),/outside the bounds grown by 0\.1 m/);
 rejects(withAnchor({pose:{position:[0,0.96,0.07],rotation:[0,0.7071068,0,0.7071068]}}),/outside the bounds grown by 0\.1 m/);
 rejects({...screen(),traits:{...screen().traits,seat:{anchors:[{id:'a',position:[0,0,0.5],yaw:0,height:0.45}]}}},/mount and seat can't be combined/);
 const machine=read('examples/object-machine.json');
 rejects({...machine,formatVersion:'0.11',traits:{...machine.traits,mount:screen().traits.mount}},/machine and mount can't be combined/);
});

test('mount frameNode names one node of the scene',()=>{
 const box=(min,max,count=36)=>({componentType:5126,type:'VEC3',count,min,max});
 const gltf=names=>({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],
  nodes:[{name:names[0],mesh:0,children:[1]},{name:'face',mesh:1},{name:'proxy',mesh:2}],
  meshes:[{primitives:[{attributes:{POSITION:0}}]},{primitives:[{attributes:{POSITION:1}}]},{primitives:[{attributes:{POSITION:2}}]}],
  accessors:[box([-1.66,0,0],[1.66,1.92,0.08]),box([-1.6,0.06,0.07],[1.6,1.86,0.07]),box([-1.66,0,0],[1.66,1.92,0.08],12)]});
 assert.deepEqual(errors(screen(),{gltf:gltf(['bezel'])}),[]);
 rejects(screen(),/traits\.mount anchor screen: node "bezel" not found/,{gltf:gltf(['frame'])});
});

// ---- IPC 0.27 ----
const rack='user/workspace-screen-wall';
const pose={position:[3.2,1.1,-4.5],rotation:[0,0,0,1]};
const instance=(over={})=>({id:'u-7c2e91',source:'user',ref:rack,name:'Wall screen 16:9',areaId:'',pose,scale:1,state:'active',
 movable:true,locked:false,rule:null,path:null,activity:null,seat:null,character:false,accent:null,
 screen:{workspace:23,home:'screen-u-7c2e91',aspect:'16:9',size:[3.2,1.8]},...over});
const usage={placements:1,assets:1,triangles:4210,gpuBytes:1048576,collisionTriangles:12};
const limits={placements:128,assets:32,triangles:400000,gpuBytes:201326592,collisionTriangles:10000};
const objects=(list)=>({catalogRevision:3,instances:list,pocket:[],usage,limits});
const entry=(over={})=>({ref:rack,source:'user',id:'workspace-screen-wall',version:'1.0.0',formatVersion:'0.11',name:'Wall screen 16:9',description:null,
 category:'signage',tags:['screen'],traits:['collidable','movable','mount'],surfaces:['wall'],scale:[0.5,2],
 bounds:{min:[-1.66,0,0],max:[1.66,1.92,0.08]},triangles:220,gpuBytes:65536,collisionTriangles:12,thumbnail:null,license:'CC0-1.0',
 library:null,versions:[],state:'ready',placeable:true,reason:null,errors:[],machine:null,companion:null,
 screen:{aspect:'16:9',size:[3.2,1.8],mountType:'hanging-wall'},warnings:[],provenance:{license:'CC0-1.0',author:'Example Author',source:'unknown'},imported:null,...over});
const strip=(o,key)=>{const {[key]:_,...rest}=o;return rest;};

test('IPC 0.27 objects state: instances and catalog entries carry screen (required, nullable)',()=>{
 assert.ok(delta({objects:objects([instance(),instance({id:'u-000001',screen:{workspace:null,home:null,aspect:'21:9',size:[4.2,1.8]}}),instance({id:'lamp',screen:null})])}));
 assert.ok(!delta({objects:objects([strip(instance(),'screen')])}),'screen is required');
 for(const bad of [{workspace:0,home:null,aspect:'16:9',size:[3.2,1.8]},{workspace:10000,home:null,aspect:'16:9',size:[3.2,1.8]},
  {workspace:23,home:'Screen',aspect:'16:9',size:[3.2,1.8]},{workspace:23,home:null,aspect:'4:3',size:[3.2,1.8]},
  {workspace:23,home:null,aspect:'16:9',size:[3.2]},{workspace:23,home:null,aspect:'16:9',size:[3.2,1.8],extra:1}])
  assert.ok(!delta({objects:objects([instance({screen:bad})])}),JSON.stringify(bad));
 assert.ok(!delta({objects:objects([instance()])},'0.26'),'0.26 has no screen');
 assert.ok(delta({objects:objects([strip(instance(),'screen')])},'0.26'));
 const catalog=e=>validate('ipc',{jsonrpc:'2.0',id:'s1',result:{revision:3,entries:[e]}},'objects.catalog','0.27').valid;
 assert.ok(catalog(entry()));
 assert.ok(catalog(entry({screen:null,traits:['movable']})));
 assert.ok(!catalog(strip(entry(),'screen')));
 assert.ok(!catalog(entry({screen:{aspect:'16:9',size:[3.2,1.8]}})),'mountType is required');
});

test('IPC 0.27 objects.configure and objects.place take a workspace',()=>{
 for(const w of [1,23,9999,'next-free',null])assert.ok(ok('objects.configure',{id:'u-7c2e91',patch:{workspace:w}}),JSON.stringify(w));
 assert.ok(ok('objects.configure',{id:'u-7c2e91',patch:{workspace:23,locked:true}}));
 for(const w of [0,10000,-1,'next',1.5,'23'])assert.ok(!ok('objects.configure',{id:'u-7c2e91',patch:{workspace:w}}),JSON.stringify(w));
 assert.ok(!ok('objects.configure',{id:'u-7c2e91',patch:{workspace:23}},'0.26'));
 for(const w of [24,'next-free',null])assert.ok(ok('objects.place',{ref:rack,pose,workspace:w}),JSON.stringify(w));
 assert.ok(ok('objects.place',{ref:rack}));
 assert.ok(!ok('objects.place',{ref:rack,workspace:0}));
 assert.ok(!ok('objects.place',{ref:rack,workspace:24},'0.26'));
});

test('IPC 0.27 inherits every 0.26 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.26'),latest=schema('0.27');
 assert.ok(latest.title.includes('0.27'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.27/ipc.schema.json');
 const changed=['session.hello.result','catalogEntry','objectInstance','objects.configure.params','objects.place.params'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),['workspaceId','screenAspect','catalogScreen','instanceScreen','catalogProvenance','catalogImported']);
 for(const key of ['catalogEntry','objectInstance']){
  const added=key==='catalogEntry'?['screen','warnings','provenance','imported']:['screen'];
  assert.deepEqual(Object.fromEntries(Object.entries(latest.$defs[key].properties).filter(([k])=>!added.includes(k))),old.$defs[key].properties,key);
  assert.deepEqual(latest.$defs[key].required,[...old.$defs[key].required,...added],key);
 }
 const patch=d=>d.$defs['objects.configure.params'].properties.patch;
 assert.deepEqual(strip(patch(latest).properties,'workspace'),patch(old).properties);
 assert.deepEqual(strip(latest.$defs['objects.place.params'].properties,'workspace'),old.$defs['objects.place.params'].properties);
 assert.deepEqual(latest.$defs['session.hello.params'],old.$defs['session.hello.params'],'no new grant');
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.27');
 assert.deepEqual(strip(hello,'protocol'),strip(oldHello,'protocol'),'no new methods or events');
 assert.ok(ipcProtocols.includes('0.27'));
 const s=read('examples/ipc/state.delta.notification.json');
 assert.equal(validate('ipc',s,undefined,'0.27').valid,validate('ipc',s,undefined,'0.26').valid);
});
