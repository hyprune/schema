import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate,worldFormats} from '../lib/validate.mjs';
const example=()=>JSON.parse(readFileSync(new URL('../examples/world.json',import.meta.url)));
const as=(w,v)=>({...w,formatVersion:v});
// RFC-0004 "world 0.8": the amendment's example.
const assets=()=>[{id:'armillary',scene:'objects/armillary.gltf',
  animations:[
    {node:'ring-equator',type:'spin',axis:[1,0,0],pivot:[0,0,0],period:20},
    {node:'ring-tilted',type:'spin',axis:[-0.955,0,0.295],pivot:[0,0,0],period:27,phase:0.3},
    {node:'moon',type:'orbit',axis:[0,1,0],pivot:[0,0,0],period:60},
    {node:'buoy',type:'bob',axis:[0,1,0],amplitude:0.05,period:4}],
  collision:{node:'proxy'},lighting:{mode:'probe'}}];
const objects=()=>[
  {id:'sun-court-armillary',asset:'armillary',pose:{position:[4,0,-6],rotation:[0,0.3826834,0,0.9238795]},scale:1,speed:1,phase:0,ambient:[0.3,0.28,0.25]},
  {id:'quiet-armillary',asset:'armillary',pose:{position:[-4,0,-6],rotation:[0,0,0,1]},phase:0.5}];
const world08=(a=assets(),o=objects())=>({...as(example(),'0.8'),objectAssets:a,objects:o});
const check=w=>validate('world',w,undefined,w.formatVersion);
const errors=w=>check(w).errors.join('\n');

test('world 0.8 is a listed format and accepts the amendment example',()=>{
  assert.ok(worldFormats.includes('0.8'));
  assert.deepEqual(check(world08()),{valid:true,errors:[]});
  assert.equal(check(world08([],[])).valid,true);
  assert.equal(check({...world08(),objects:undefined}).valid,true);
});

test('world 0.8 inherits every 0.7 document; 0.7 and older stay frozen',()=>{
  const w=as(example(),'0.7');w.playable={volumes:[{type:'box',min:[-10,0,-10],max:[10,8,10]}],maxFlyHeight:7};w.backdrop={farCards:[0]};
  assert.equal(validate('world',w,undefined,'0.7').valid,true);
  assert.equal(validate('world',as(w,'0.8'),undefined,'0.8').valid,true);
  for(const v of worldFormats.filter(v=>v!=='0.8'))
    for(const extra of [{objectAssets:assets()},{objects:objects()}])
      assert.equal(validate('world',{...as(example(),v),...extra},undefined,v).valid,false,v);
  assert.equal(validate('world',world08(),undefined,'0.7').valid,false);
  // The withdrawn top-level node-animation draft is not part of 0.8.
  assert.equal(check({...world08(),animations:[]}).valid,false);
});

test('asset and instance shape: references, ranges, unknown properties, limits',()=>{
  const bad=(edit,label)=>{const w=world08();edit(w);assert.equal(check(w).valid,false,label);};
  bad(w=>w.objectAssets[0].scene='objects/armillary.obj','scene must be glTF');
  bad(w=>w.objectAssets[0].scene='../armillary.gltf','scene must be package-relative');
  bad(w=>delete w.objectAssets[0].scene,'scene or library required');
  bad(w=>w.objectAssets[0].animations[0].type='wobble','type');
  bad(w=>w.objectAssets[0].animations[0].period=0.4,'period');
  bad(w=>w.objectAssets[0].animations[1].phase=1,'phase');
  bad(w=>w.objectAssets[0].animations[3].amplitude=0,'amplitude');
  bad(w=>w.objectAssets[0].animations[0].speed=2,'unknown animation property');
  bad(w=>w.objectAssets[0].lighting={mode:'baked'},'lighting mode');
  bad(w=>w.objectAssets[0].tint=[1,1,1],'unknown asset property');
  bad(w=>w.objects[0].scale=0,'scale');bad(w=>w.objects[0].speed=11,'speed');bad(w=>w.objects[0].phase=1,'instance phase');
  bad(w=>w.objects[0].ambient=[0,0,17],'ambient');bad(w=>w.objects[0].colour=[1,1,1],'unknown object property');
  bad(w=>w.objectAssets[0].animations=Array.from({length:17},(_,i)=>({node:`n${i}`,type:'spin',axis:[0,1,0],pivot:[0,0,0],period:2})),'more than 16 animations');
  bad(w=>w.objectAssets=Array.from({length:33},(_,i)=>({id:`a${i}`,scene:'a.gltf'})),'more than 32 assets');
  bad(w=>w.objects=Array.from({length:257},(_,i)=>({...objects()[1],id:`o${i}`})),'more than 256 objects');
});

test('object semantics: ids, references, axis, per-type fields, library reserved',()=>{
  const w=world08();w.objectAssets.push({...assets()[0]});assert.match(errors(w),/objectAssets: duplicate id/);
  const o=world08();o.objects[1].id=o.objects[0].id;assert.match(errors(o),/objects: duplicate id/);
  const r=world08();r.objects[1].asset='orrery';assert.match(errors(r),/objects quiet-armillary: unknown asset orrery/);
  const q=world08();q.objects[0].pose.rotation=[0,0,0,2];assert.match(errors(q),/objects sun-court-armillary: quaternion must be normalized/);
  const axis=world08();axis.objectAssets[0].animations[0].axis=[0.5,0.5,0.5];assert.match(errors(axis),/"ring-equator" axis must be a unit vector/);
  const near=world08();near.objectAssets[0].animations[0].axis=[0,0.6,0.8006];assert.equal(check(near).valid,true);
  const dup=world08();dup.objectAssets[0].animations[1].node='ring-equator';assert.match(errors(dup),/animations: duplicate node/);
  const pivotless=world08();delete pivotless.objectAssets[0].animations[2].pivot;assert.match(errors(pivotless),/orbit animation "moon" needs a pivot/);
  const bob=world08();delete bob.objectAssets[0].animations[3].amplitude;assert.match(errors(bob),/bob animation "buoy" needs an amplitude/);
  const bobPivot=world08();bobPivot.objectAssets[0].animations[3].pivot=[0,0,0];assert.match(errors(bobPivot),/bob animation "buoy" takes no pivot/);
  const spinAmp=world08();spinAmp.objectAssets[0].animations[0].amplitude=1;assert.match(errors(spinAmp),/spin animation "ring-equator" takes no amplitude/);
  const moving=world08();moving.objectAssets[0].collision={node:'moon'};assert.match(errors(moving),/collision node "moon" is animated/);
  const lib=world08();lib.objectAssets[0]={id:'armillary',library:'com.hyprune.objects.armillary@1.0.0'};
  assert.match(errors(lib),/library references are reserved/);
  lib.objectAssets[0].scene='objects/armillary.gltf';assert.match(errors(lib),/library references are reserved/);
});

// The asset's glTF: base > {ring-equator, ring-tilted, moon, buoy}; proxy outside the scene graph.
const asset=()=>({asset:{version:'2.0'},meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[
  {name:'base',children:[1,2,3,4],mesh:0},{name:'ring-equator',mesh:0},{name:'ring-tilted',mesh:0},{name:'moon',mesh:0},{name:'buoy',mesh:0},{name:'proxy',mesh:0}]});
const sceneCheck=(g,w=world08(),id='armillary',v='0.8')=>validate('scene',g,undefined,v,{world:w,asset:id});

test('asset glTF 0.8: node names, nesting, collision proxy, extension rules',()=>{
  assert.deepEqual(sceneCheck(asset()),{valid:true,errors:[]});
  const missing=asset();missing.nodes[4].name='float';assert.match(sceneCheck(missing).errors.join(),/node "buoy" not found/);
  const twice=asset();twice.nodes[5].name='moon';assert.match(sceneCheck(twice).errors.join(),/node "moon" is not unique/);
  const nested=asset();nested.nodes[1].children=[2];nested.nodes[0].children=[1,3,4];
  assert.match(sceneCheck(nested).errors.join(),/animation "ring-tilted" is inside animated node "ring-equator"/);
  const carried=asset();carried.nodes[3].children=[5];
  assert.match(sceneCheck(carried).errors.join(),/collision node "proxy" is inside animated node "moon"/);
  const meshless=asset();delete meshless.nodes[5].mesh;assert.match(sceneCheck(meshless).errors.join(),/collision node "proxy" has no mesh/);
  // Assets follow the world format's extension rules; they carry no lightmaps.
  const ktx=asset();ktx.extensionsRequired=['KHR_texture_basisu'];assert.equal(sceneCheck(ktx).valid,true);
  ktx.extensionsRequired=['KHR_draco_mesh_compression'];assert.match(sceneCheck(ktx).errors.join(),/not allowed in world 0.8/);
  assert.match(sceneCheck(asset(),world08(),'orrery').errors.join(),/unknown asset orrery/);
  assert.match(sceneCheck(asset(),as(world08(),'0.7'),'armillary','0.7').errors.join(),/unknown asset armillary for world 0.7/);
  // The world's own scene check is unchanged by objects.
  assert.equal(validate('scene',{asset:{version:'2.0'},images:[{uri:'l.png'}],textures:[{source:0},{source:0}]},undefined,'0.8',{world:world08()}).valid,true);
});
