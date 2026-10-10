import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';
const request=patch=>({jsonrpc:'2.0',id:'od',method:'graphics.set',params:{patch}});
const schema=v=>JSON.parse(readFileSync(new URL(`../v${v}/ipc.schema.json`,import.meta.url)));
const config={quality:'high',msaa:null,bloom:null,fog:null,sky:null,anisotropy:null,reflections:null,normal_maps:null,specular:null,
 ambient_occlusion:null,alpha_haze:null,dynamic_resolution:true,reduced_motion:false,render_scale:'auto',target_fps:60,fov:70,exposure:1,
 bloom_strength:1,sharpen:0.2,offload:'auto',offload_power_cap_w:null,offload_device:'auto',scale_min:0.5,scale_max:1,outline:null,
 visibility_culling:true,outline_quality:null,outline_width_px:null,outline_colour:null};
const device={pci:'0000:65:00.0',node:'renderD129',name:'NVIDIA GeForce RTX 3090',enforcedLimitW:350,selection:'auto',drivesCompositor:false};
const performance=extra=>({profile:'full-ac',powerW:41.5,capW:262.5,capSource:'device',device,targetFPS:60,reason:'',pid:4242,generation:3,mode:'auto',
 activeRenderer:'offload',status:'active',preset:'high',requested:config,effective:config,costsMs:{},workerTimings:null,controls:{},...extra});
const result=perf=>({jsonrpc:'2.0',id:'g',result:{config,effective:config,overrides:{},path:'/tmp/graphics.json',error:'',presets:{},options:{},
 unsupported:[],timings:{},performance:perf}});
const get=(perf,v='0.18')=>validate('ipc',result(perf),'graphics.get',v).valid;
test('IPC 0.18 offload cap and device settings validate; 0.17 stays frozen',()=>{
 for(const patch of [{offload_power_cap_w:null},{offload_power_cap_w:350},{offload_power_cap_w:1000},{offload_device:'auto'},{offload_device:'0000:65:00.0'}]) {
  assert.equal(validate('ipc',request(patch),undefined,'0.18').valid,true,JSON.stringify(patch));
  assert.equal(validate('ipc',request(patch),undefined,'0.17').valid,false,JSON.stringify(patch));
 }
 for(const patch of [{offload_power_cap_w:20},{offload_power_cap_w:80}]) assert.equal(validate('ipc',request(patch),undefined,'0.18').valid,true);
 for(const patch of [{offload_power_cap_w:10},{offload_power_cap_w:2000},{offload_power_cap_w:'auto'},{offload_device:'0000:65:00.0x'},
  {offload_device:'renderD128'},{offload_device:'0000:6A:00.0'},{offload_device:'AUTO'},{offload_device:'65:00.0'},{offload_device:'0000:65:00.8'},
  {offload_device:''},{offload_device:null}])
  assert.equal(validate('ipc',request(patch),undefined,'0.18').valid,false,JSON.stringify(patch));
});
test('IPC 0.18 performance reports the cap source and the offload device',()=>{
 assert.equal(get(performance()),true);
 for(const capSource of ['profile','device','configured','fallback'])assert.equal(get(performance({capSource})),true,capSource);
 assert.equal(get(performance({capSource:'user'})),false);
 assert.equal(get(performance({device:null,capSource:'fallback',capW:80})),true);
 assert.equal(get(performance({device:{...device,name:null,enforcedLimitW:null,selection:'explicit',drivesCompositor:true}})),true);
 const {capSource,...noSource}=performance();assert.equal(get(noSource),false);
 const {device:_,...noDevice}=performance();assert.equal(get(noDevice),false);
 for(const bad of [{pci:'auto'},{pci:'0000:65:00.0x'},{pci:'0000:6A:00.0'},{node:'card1'},{node:'/dev/dri/renderD128'},{name:'x'.repeat(257)},
  {enforcedLimitW:-1},{selection:'manual'},{drivesCompositor:null},{extra:1}])
  assert.equal(get(performance({device:{...device,...bad}})),false,JSON.stringify(bad));
 for(const key of Object.keys(device)){const {[key]:_,...missing}=device;assert.equal(get(performance({device:missing})),false,key);}
 assert.equal(get(performance({profile:'mains'})),false);
 const old={...performance(),requested:{...config,offload_power_cap_w:80},effective:{...config,offload_power_cap_w:80}};
 delete old.capSource;delete old.device;delete old.requested.offload_device;delete old.effective.offload_device;
 const oldConfig=old.requested,oldResult={...result(old)};oldResult.result={...oldResult.result,config:oldConfig,effective:oldConfig};
 assert.equal(validate('ipc',oldResult,'graphics.get','0.17').valid,true);
 assert.equal(get(performance(),'0.17'),false);
});
test('IPC 0.18 inherits every 0.17 definition and only changes the offload keys',()=>{
 const old=schema('0.17'),latest=schema('0.18');
 for(const key of Object.keys(old.$defs))assert.ok(latest.$defs[key],key);
 for(const key of Object.keys(old.$defs))if(!['graphicsConfig','graphicsPatch','performance','session.hello.result'].includes(key))
  assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 for(const key of ['graphicsConfig','graphicsPatch']) {
  const {offload_power_cap_w,offload_device,...rest}=latest.$defs[key].properties;assert.ok(offload_power_cap_w&&offload_device);
  const {offload_power_cap_w:oldCap,...oldRest}=old.$defs[key].properties;
  assert.deepEqual(rest,oldRest,key);
  assert.deepEqual(offload_power_cap_w.anyOf,[{type:'number',minimum:20,maximum:1000},{type:'null'}]);
  assert.deepEqual(oldCap,{type:'number',minimum:20,maximum:100});
  assert.deepEqual(latest.$defs[key].required,old.$defs[key].required,key);
 }
 const {capSource,device:dev,...perf}=latest.$defs.performance.properties;assert.ok(capSource&&dev);
 assert.deepEqual(perf,old.$defs.performance.properties);
 assert.deepEqual(latest.$defs.performance.properties.profile.enum,['unknown','battery','usb-c','limited-ac','full-ac']);
 assert.deepEqual(latest.$defs.performance.required.filter(k=>k!=='capSource'&&k!=='device'),old.$defs.performance.required);
 assert.ok(latest.$defs.performance.required.includes('capSource')&&latest.$defs.performance.required.includes('device'));
 const {protocol,...hello}=latest.$defs['session.hello.result'].properties;
 assert.equal(protocol.const,'0.18');
 const {protocol:_,...oldHello}=old.$defs['session.hello.result'].properties;assert.deepEqual(hello,oldHello);
 assert.deepEqual(latest.anyOf,old.anyOf);
 assert.ok(ipcProtocols.includes('0.18'));
});
