import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';
const req=(method,params)=>({jsonrpc:'2.0',id:'p1',method,params});
const res=(method,result,v)=>validate('ipc',{jsonrpc:'2.0',id:'p1',result},method,v).valid;
const schema=v=>JSON.parse(readFileSync(new URL(`../v${v}/ipc.schema.json`,import.meta.url)));
const defaults={walk_speed:4,run_speed:10,view_bob:'subtle',reticle_style:'cross_dot',reticle_size:18,reticle_thickness:2,reticle_gap:4,
 reticle_opacity:.9,reticle_outline:true,reticle_colour:'theme',reticle_dynamic:true,reach_grab:15,reach_mount:8,reach_placement:12};
const ranges={walk_speed:[.5,20],run_speed:[.5,30],reticle_size:[6,64],reticle_thickness:[1,6],reticle_gap:[0,20],reticle_opacity:[.2,1],
 reach_grab:[1,100],reach_mount:[1,100],reach_placement:[1,100]};
const settings=(over={})=>({config:{...defaults,...over},defaults,overrides:over,
 options:{view_bob:['off','subtle','normal'],reticle_style:['cross_dot','t_dot','circle_dot','dot','cross','chevron']},
 ranges,path:'/home/owner/.config/hyprune/player.json',error:''});
const interaction={mode:'movement',tool:5,tools:['pointer','mount','path','position','placement'],noclip:false,cursor:'reticle',taggedSurfaceId:null};
const delta=changes=>({jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}});
const style={waypointColor:[1,.5,0],routeColor:[1,.5,0],labelColor:[1,1,1],promptColor:[1,1,1],fontFamily:'DejaVu Sans',iconAtlas:null};
const colours={reticleColor:[.95,.95,.95],validColor:[.35,.95,.6],invalidColor:[1,.62,.35]};

test('IPC 0.19 player.get/player.set validate; 0.18 stays frozen',()=>{
 assert.equal(validate('ipc',req('player.get',{}),undefined,'0.19').valid,true);
 assert.equal(validate('ipc',req('player.get',{x:1}),undefined,'0.19').valid,false);
 const ok=[{walk_speed:5.5},{run_speed:30,walk_speed:.5},{view_bob:'off'},{reticle_style:'chevron',reticle_size:64},{reticle_colour:[1,0,.5]},
  {reticle_colour:'theme'},{reticle_colour:null},{reach_grab:100,reach_mount:1,reach_placement:null},{reticle_outline:false,reticle_dynamic:null},{...defaults}];
 for(const patch of ok){
  assert.equal(validate('ipc',req('player.set',{patch}),undefined,'0.19').valid,true,JSON.stringify(patch));
  assert.equal(validate('ipc',req('player.set',{patch}),undefined,'0.18').valid,false);
 }
 const bad=[{},{walk_speed:.4},{walk_speed:21},{run_speed:31},{view_bob:'strong'},{reticle_style:'square'},{reticle_size:5},{reticle_thickness:7},
  {reticle_gap:-1},{reticle_opacity:.1},{reticle_outline:'yes'},{reticle_colour:'red'},{reticle_colour:[1,1]},{reticle_colour:[2,0,0]},
  {reach_grab:0},{reach_mount:101},{run_multiplier:2},{unknown:true}];
 for(const patch of bad)assert.equal(validate('ipc',req('player.set',{patch}),undefined,'0.19').valid,false,JSON.stringify(patch));
 assert.equal(validate('ipc',req('player.set',{patch:{walk_speed:5},extra:1}),undefined,'0.19').valid,false);
 assert.equal(validate('ipc',req('player.set',{}),undefined,'0.19').valid,false);
});

test('IPC 0.19 playerSettings results are complete and closed',()=>{
 for(const m of ['player.get','player.set']){
  assert.equal(res(m,settings(),'0.19'),true,m);
  assert.equal(res(m,settings({reach_grab:30,reticle_colour:[0,1,0]}),'0.19'),true,m);
  assert.throws(()=>res(m,settings(),'0.18'),/Unknown method/);
 }
 const {reach_grab,...missing}=defaults;
 for(const bad of [{...settings(),config:missing},{...settings(),overrides:{walk_speed:null}},{...settings(),ranges:{walk_speed:[.5,20]}},
  {...settings(),options:{view_bob:['off']}},{...settings(),error:'x'.repeat(4097)},{...settings(),path:'/'+'x'.repeat(4096)},{...settings(),extra:1}])
  assert.equal(res('player.get',bad,'0.19'),false);
});

test('IPC 0.19 widens fov to 120 only in 0.19',()=>{
 const set=patch=>req('graphics.set',{patch});
 assert.equal(validate('ipc',set({fov:120}),undefined,'0.19').valid,true);
 assert.equal(validate('ipc',set({fov:121}),undefined,'0.19').valid,false);
 assert.equal(validate('ipc',set({fov:120}),undefined,'0.18').valid,false);
 assert.equal(validate('ipc',set({fov:110}),undefined,'0.18').valid,true);
});

test('IPC 0.19 overlay style carries reticle/valid/invalid colours',()=>{
 const params=s=>req('overlay.style',{leaseId:'lease',style:s});
 assert.equal(validate('ipc',params(colours),undefined,'0.19').valid,true);
 assert.equal(validate('ipc',params({promptColor:[1,1,1]}),undefined,'0.19').valid,true);
 assert.equal(validate('ipc',params(colours),undefined,'0.18').valid,false);
 assert.equal(validate('ipc',params({validColor:[2,0,0]}),undefined,'0.19').valid,false);
 assert.equal(res('overlay.style',{style:{...style,...colours}},'0.19'),true);
 assert.equal(res('overlay.style',{style},'0.19'),false);
 assert.equal(res('overlay.style',{style},'0.18'),true);
 assert.equal(res('overlay.style',{style:{...style,...colours}},'0.18'),false);
});

test('IPC 0.19 interaction.reticle is required and closed; 0.18 rejects it',()=>{
 for(const state of ['hidden','neutral','typing','target','valid','out_of_range','invalid','holding'])
  for(const action of ['','click','grab','pocket','place','mount','select','path','drop'])
   assert.equal(validate('ipc',delta({interaction:{...interaction,reticle:{state,action}}}),undefined,'0.19').valid,true,`${state}/${action}`);
 assert.equal(validate('ipc',delta({interaction}),undefined,'0.19').valid,false);
 assert.equal(validate('ipc',delta({interaction}),undefined,'0.18').valid,true);
 assert.equal(validate('ipc',delta({interaction:{...interaction,reticle:{state:'valid',action:'place'}}}),undefined,'0.18').valid,false);
 for(const reticle of [{state:'valid'},{state:'aiming',action:''},{state:'valid',action:'throw'},{state:'valid',action:'place',distance:3}])
  assert.equal(validate('ipc',delta({interaction:{...interaction,reticle}}),undefined,'0.19').valid,false,JSON.stringify(reticle));
});

test('IPC 0.19 inherits every 0.18 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.18'),latest=schema('0.19');
 const changed=['session.hello.result','request','response','graphicsConfig','graphicsPatch','overlayStyle','overlayStylePatch','interaction'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 for(const key of ['graphicsConfig','graphicsPatch']){
  const {fov,...rest}=latest.$defs[key].properties,{fov:oldFov,...oldRest}=old.$defs[key].properties;
  assert.deepEqual(rest,oldRest,key);assert.deepEqual(fov,{...oldFov,maximum:120},key);
 }
 for(const key of ['overlayStyle','overlayStylePatch']){
  const {reticleColor,validColor,invalidColor,...rest}=latest.$defs[key].properties;
  assert.deepEqual(rest,old.$defs[key].properties,key);
  for(const c of [reticleColor,validColor,invalidColor])assert.deepEqual(c,old.$defs[key].properties.promptColor,key);
 }
 const {reticle,...interactionRest}=latest.$defs.interaction.properties;
 assert.ok(reticle);assert.deepEqual(interactionRest,old.$defs.interaction.properties);
 const hello=latest.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.19');
 assert.ok(hello.methods.items.enum.includes('player.get')&&hello.methods.items.enum.includes('player.set'));
 assert.ok(!old.$defs['session.hello.result'].properties.methods.items.enum.includes('player.get'));
 assert.deepEqual(Object.keys(latest.$defs.playerConfig.properties),Object.keys(latest.$defs.playerPatch.properties));
 assert.deepEqual(Object.keys(latest.$defs.playerSettings.properties.ranges.properties),
  Object.entries(latest.$defs.playerConfig.properties).filter(([,v])=>v.type==='number').map(([k])=>k));
 assert.deepEqual(latest.$defs.performance,old.$defs.performance);
 for(const patch of [{offload_device:'0000:65:00.0'},{offload_power_cap_w:null},{offload_power_cap_w:350}])
  assert.equal(validate('ipc',req('graphics.set',{patch}),undefined,'0.19').valid,true,JSON.stringify(patch));
 assert.ok(ipcProtocols.includes('0.19'));
});
