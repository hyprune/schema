import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate,atLeast,sceneExtensions,worldFormats} from '../lib/validate.mjs';
const example=()=>JSON.parse(readFileSync(new URL('../examples/world.json',import.meta.url)));
const as=(w,v)=>({...w,formatVersion:v});

test('world 0.7 inherits every 0.6 document; 0.6 stays frozen',()=>{
  const w=as(example(),'0.6');w.playable={volumes:[{type:'box',min:[-10,0,-10],max:[10,8,10]}],maxFlyHeight:7};w.backdrop={farCards:[0]};
  assert.equal(validate('world',w,undefined,'0.6').valid,true);
  assert.equal(validate('world',as(w,'0.7'),undefined,'0.7').valid,true);
  assert.equal(validate('world',as(example(),'0.7'),undefined,'0.7').valid,true);
  assert.equal(validate('world',as(w,'0.7'),undefined,'0.6').valid,false);
  assert.equal(validate('world',w,undefined,'0.7').valid,false);
});

test('version helper compares numerically',()=>{
  assert.equal(atLeast('0.10','0.7'),true);assert.equal(atLeast('0.6','0.7'),false);assert.equal(atLeast('0.7','0.7'),true);
  assert.ok(worldFormats.includes('0.7'));
  assert.ok(sceneExtensions('0.7').includes('EXT_meshopt_compression'));assert.ok(!sceneExtensions('0.6').includes('KHR_texture_basisu'));
});

const scene=()=>({asset:{version:'2.0'},extensionsUsed:['KHR_texture_basisu','EXT_meshopt_compression','KHR_mesh_quantization'],
  extensionsRequired:['KHR_texture_basisu','EXT_meshopt_compression','KHR_mesh_quantization'],
  images:[{uri:'textures/a.ktx2',mimeType:'image/ktx2'},{uri:'textures/lightmap.png',mimeType:'image/png'}],
  textures:[{extensions:{KHR_texture_basisu:{source:0}}},{source:1}],
  bufferViews:[{buffer:0,byteLength:4,extensions:{EXT_meshopt_compression:{buffer:1,byteLength:4,byteStride:4,count:1,mode:'ATTRIBUTES'}}}]});
const world={lightmaps:[{material:0,texture:1,texCoord:1,encoding:'srgb',intensity:1}]};
const ok=(g,v='0.7')=>validate('scene',g,undefined,v,{world});

test('scene 0.7: KTX2 material textures, meshopt and quantization allowed',()=>{
  assert.deepEqual(ok(scene()),{valid:true,errors:[]});
});

test('scene rules: older formats, missing required, KTX2 lightmaps',()=>{
  assert.equal(ok(scene(),'0.6').valid,false);
  const unlisted=scene();unlisted.extensionsRequired=['KHR_mesh_quantization'];
  assert.match(ok(unlisted).errors.join(),/KHR_texture_basisu must be listed/);
  assert.match(ok(unlisted).errors.join(),/EXT_meshopt_compression must be listed/);
  const ktxLightmap=scene();ktxLightmap.textures[1]={extensions:{KHR_texture_basisu:{source:0}}};
  assert.match(ok(ktxLightmap).errors.join(),/PNG image/);
  const wrongImage=scene();wrongImage.images[0]={uri:'textures/a.png',mimeType:'image/png'};
  assert.match(ok(wrongImage).errors.join(),/KTX2 image/);
  const unknown=scene();unknown.extensionsRequired.push('KHR_draco_mesh_compression');
  assert.match(ok(unknown).errors.join(),/KHR_draco_mesh_compression is not allowed/);
  // A 0.6 scene without new extensions stays valid.
  assert.equal(validate('scene',{asset:{version:'2.0'},images:[{uri:'l.png'}],textures:[{source:0}]},undefined,'0.6',{world:{lightmaps:[{texture:0}]}}).valid,true);
  assert.throws(()=>validate('scene',scene(),undefined,'0.99',{world}));
});
