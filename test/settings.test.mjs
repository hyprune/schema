import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.30 (draft): global settings presets and overrides (settings.get / settings.set).
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const strip=(o,...keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const added=['settingsEntry','settingsPreset','settingsState','settings.get.params','settings.get.result','settings.set.params','settings.set.result',
 'settings.get.request','settings.get.response','settings.set.request','settings.set.response'];

test('IPC 0.30 inherits every 0.29 definition except hello, request and response; adds the settings methods',()=>{
 const old=schema('0.29'),latest=schema('0.30');
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.30/ipc.schema.json');
 for(const key of Object.keys(old.$defs))if(!['session.hello.result','request','response'].includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),added);
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.30');
 assert.deepEqual(hello.methods.items.enum.filter(m=>!oldHello.methods.items.enum.includes(m)),['settings.get','settings.set']);
 assert.deepEqual(strip(hello,'protocol','methods'),strip(oldHello,'protocol','methods'));
 assert.ok(ipcProtocols.includes('0.30'));
});

const req=(method,params,v='0.30')=>validate('ipc',{jsonrpc:'2.0',id:'s',method,params},undefined,v).valid;
const res=(method,result,v='0.30')=>validate('ipc',{jsonrpc:'2.0',id:'s',result},method,v).valid;

test('IPC 0.30 settings.set: preset, set, reset, resetAll',()=>{
 for(const p of [{preset:'usb-c'},{set:{'graphics.msaa':2,'player.carry_turn':.2}},{reset:['graphics.msaa']},{resetAll:true},
                 {preset:'low',reset:['player.walk_speed'],set:{'graphics.target_fps':120}}])assert.ok(req('settings.set',p),JSON.stringify(p));
 for(const p of [{},{preset:'custom'},{set:{'graphics.msaa':null}},{set:{'input.x':1}},{reset:'graphics.msaa'},{reset:['a','a']},{extra:1}])
  assert.ok(!req('settings.set',p),JSON.stringify(p));
 assert.ok(!req('settings.set',{preset:'low'},'0.29'),'0.29 has no settings methods');
 assert.ok(req('settings.get',{}));
});

test('IPC 0.30 settings state: entries with value, default and source; presets with defaults',()=>{
 const state={preset:'medium',presets:[{id:'medium',name:'Medium',description:'d',values:{'graphics.quality':'medium'},defaults:{'graphics.msaa':1}}],
  settings:{'graphics.msaa':{value:2,default:1,source:'user'},'player.walk_speed':{value:4,default:4,source:'preset'}},overrides:1,
  keymapDefaults:read('examples/input-v3.json'),path:'/x/settings.json',error:''};
 assert.ok(res('settings.get',state),JSON.stringify(validate('ipc',{jsonrpc:'2.0',id:'s',result:state},'settings.get','0.30').errors||'').slice(0,400));
 assert.ok(res('settings.set',state));
 assert.ok(!res('settings.get',{...state,preset:'custom'}));
 assert.ok(!res('settings.get',{...state,settings:{'graphics.msaa':{value:2,default:1,source:'guess'}}}));
 const {keymapDefaults,...partial}=state;
 assert.ok(!res('settings.get',partial),'keymapDefaults is required');
});
