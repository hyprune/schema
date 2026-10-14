import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, validateMotion, motionVersions, motionClipName, ipcProtocols} from '../lib/validate.mjs';

// The shared clip library (RFC-0010 amendment, draft): motion packs (motion.json 0.1) and
// IPC 0.28 (character styles, companion dances, catalog motion).
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const strip=(o,...keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const pack=(over={})=>({motionVersion:'0.1',id:'starter-motion',name:'Starter motions',skeleton:{id:'mixamo-v1'},license:'CC-BY-4.0',
 attribution:[{path:'.',author:'Hyprune contributors',license:'CC-BY-4.0'}],rigs:[{id:'desert',scene:'desert.glb'},{id:'dancer',scene:'dancer.glb'}],
 clips:[{name:'walk',role:'walk',rig:'desert'},{name:'walk-confident',role:'walk',style:'confident',rig:'dancer'},
  {name:'sit-down',role:'sit-down',rig:'dancer',loop:false},{name:'dance-shimmy',role:'dance',style:'shimmy',rig:'dancer',clip:'shimmy'}],...over});

test('motion.json 0.1: a valid pack, and the clip names characters play',()=>{
 assert.deepEqual(motionVersions,['0.1']);
 assert.ok(validateMotion(pack()).valid,JSON.stringify(validateMotion(pack()).errors));
 assert.equal(motionClipName('walk','confident'),'walk_confident');
 assert.equal(motionClipName('sit-down'),'sit');
 assert.equal(motionClipName('stand-up','quick'),'stand_quick');
 assert.equal(motionClipName('seated-idle'),'sit_idle');
 assert.equal(motionClipName('dance','hip-hop-2'),'dance_hip_hop_2');
 assert.ok(validate('ipc',{jsonrpc:'2.0',id:1,method:'session.ping'},undefined,'0.28').valid!==undefined);
});

test('motion.json 0.1 refuses broken packs',()=>{
 const bad=[
  pack({motionVersion:'0.2'}),pack({id:'Starter'}),pack({skeleton:{id:'mixamo v1'}}),pack({rigs:[]}),pack({clips:[]}),
  pack({rigs:Array.from({length:9},(_,i)=>({id:`r${i}`,scene:`r${i}.glb`}))}),
  pack({rigs:[{id:'desert',scene:'../desert.glb'}]}),pack({clips:[{name:'walk',role:'jog',rig:'desert'}]}),
  pack({clips:[{name:'walk',role:'walk',rig:'nobody'}]}),pack({clips:[{name:'dance',role:'dance',rig:'desert'}]}),
  pack({clips:[{name:'walk',role:'walk',rig:'desert'},{name:'walk',role:'run',rig:'desert'}]}),
  pack({clips:[{name:'walk',role:'walk',rig:'desert'},{name:'walk-2',role:'walk',rig:'dancer'}]}),
  pack({rigs:[{id:'desert',scene:'a.glb'},{id:'desert',scene:'b.glb'}]}),pack({license:'not a licence ('}),
  pack({extra:1}),pack({clips:[{name:'walk',role:'walk',rig:'desert',speed:1}]}),
 ];
 for(const p of bad)assert.ok(!validateMotion(p).valid,JSON.stringify(p).slice(0,120));
 assert.throws(()=>validateMotion(pack(),'0.9'));
});

test('IPC 0.28 inherits every 0.27 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.27'),latest=schema('0.28');
 assert.ok(latest.title.includes('0.28'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.28/ipc.schema.json');
 const changed=['session.hello.result','catalogEntry','objectInstance','npcs.spawn.params','npcs.bind.params','companionState','companion.mode.params',
  'npcsState','interaction.choose.params'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),['motionStyle','characterStyle','catalogMotion','interactionOption']);
 for(const [key,added] of [['catalogEntry','motion'],['objectInstance','style']]){
  assert.deepEqual(strip(latest.$defs[key].properties,added),old.$defs[key].properties,key);
  assert.deepEqual(latest.$defs[key].required,[...old.$defs[key].required,added],key);
 }
 for(const m of ['npcs.spawn.params','npcs.bind.params']){
  assert.deepEqual(strip(latest.$defs[m],'properties'),strip(old.$defs[m],'properties'),m);
  assert.deepEqual(strip(latest.$defs[m].properties,'style'),old.$defs[m].properties,m);
 }
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.28');
 assert.deepEqual(strip(hello,'protocol'),strip(oldHello,'protocol'),'no new methods or events');
 assert.deepEqual(latest.$defs['session.hello.params'],old.$defs['session.hello.params'],'no new grant');
 assert.ok(ipcProtocols.includes('0.28'));
});

const req=(method,params)=>({jsonrpc:'2.0',id:'m1',method,params});
const ok=(method,params,v='0.28')=>validate('ipc',req(method,params),undefined,v).valid;
const companion=(over={})=>({ref:'library/com.example.kit@1.0.0/dancer',name:'Dancer',state:'active',reason:null,mode:'follow',path:null,
 activity:'following',position:[1,0,2],carried:false,pace:'walk',style:null,dance:null,...over});
const delta=(changes,v='0.28')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;

test('IPC 0.28 styles: npcs.spawn/bind take a style; the companion keeps one and dances',()=>{
 for(const style of [null,{walk:'confident'},{walk:'stagger',run:'loose',idle:'sway'}]){
  assert.ok(ok('npcs.spawn',{ref:'library/com.hyprune.starter@0.3.0/resident-blue',style}),JSON.stringify(style));
  assert.ok(ok('npcs.bind',{id:'user-1',style}),JSON.stringify(style));
  assert.ok(ok('companion.mode',{mode:'follow',style}),JSON.stringify(style));
 }
 for(const style of [{},{walk:'Confident'},{sit:'calm'},{walk:'x'.repeat(33)}])assert.ok(!ok('npcs.bind',{id:'user-1',style}),JSON.stringify(style));
 assert.ok(!ok('npcs.bind',{id:'user-1',style:{walk:'confident'}},'0.27'),'0.27 has no style');
 assert.ok(delta({companion:companion({style:{walk:'groovy'},activity:'dancing',dance:'shimmy'})}));
 assert.ok(!delta({companion:companion({activity:'dancing'})},'0.27'));
 assert.ok(!delta({companion:strip(companion(),'style')}),'style is required');
 assert.ok(!delta({companion:strip(companion(),'dance')}),'dance is required');
 assert.ok(delta({companion:strip(companion(),'style','dance')},'0.27'));
});

test('IPC 0.28 dance interactions carry options; interaction.choose takes one',()=>{
 const npcs=(over={})=>({motion:'auto',state:'animating',reason:null,usage:{authored:4,user:1},limits:{authored:16,user:8},
  drawing:null,aimed:null,interaction:null,...over});
 const aimed=interactions=>npcs({aimed:{objectId:'companion',name:'Dancer',prompt:'Talk',interactions}});
 const talk={id:'talk',label:'Talk',type:'say',options:null};
 const dance={id:'dance',label:'Dance',type:'dance',options:[{id:'shimmy',label:'Shimmy'},{id:'step',label:'Step'}]};
 assert.ok(delta({npcs:aimed([talk,dance])}));
 assert.ok(delta({npcs:aimed([talk])}));
 for(const bad of [[{...talk,options:undefined}].map(i=>strip(i,'options')),[{...dance,options:[]}],[{...dance,options:Array(17).fill({id:'a',label:'A'})}],
  [{...dance,options:[{id:'Shimmy',label:'Shimmy'}]}],[{...dance,type:'jig'}]])
  assert.ok(!delta({npcs:aimed(bad)}),JSON.stringify(bad));
 assert.ok(!delta({npcs:aimed([dance])},'0.27'),'0.27 has no dance interaction');
 assert.ok(delta({npcs:aimed([strip(talk,'options')])},'0.27'));
 assert.ok(ok('interaction.choose',{objectId:'companion',interactionId:'dance',option:'shimmy'}));
 assert.ok(ok('interaction.choose',{objectId:'companion',interactionId:'dance'}));
 assert.ok(!ok('interaction.choose',{objectId:'companion',interactionId:'dance',option:'Shimmy!'}));
 assert.ok(!ok('interaction.choose',{objectId:'companion',interactionId:'dance',option:'shimmy'},'0.27'));
});

test('IPC 0.28 catalog motion: null or the styles, dances and packs of a character',()=>{
 const m=schema('0.28').$defs.catalogMotion;
 assert.ok(m.anyOf[1].required.includes('styles'));
 assert.deepEqual(m.anyOf[1].properties.styles.required,['walk','run','idle']);
});
