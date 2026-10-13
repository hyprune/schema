import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.25 (RFC-0010 companions amendment, draft): companion methods and state, and the
// object format 0.10 companion block.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const req=(method,params)=>({jsonrpc:'2.0',id:'c1',method,params});
const ok=(method,params,v='0.25')=>validate('ipc',req(method,params),undefined,v).valid;
const res=(method,result,v='0.25')=>validate('ipc',{jsonrpc:'2.0',id:'c1',result},method,v).valid;
const delta=(changes,v='0.25')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;

const NEW_METHODS=['companion.set','companion.clear','companion.mode'];
const pip='library/io.github.ada.pip@0.1.0/pip';
const companion=(over={})=>({ref:pip,name:'Pip',state:'active',reason:null,mode:'follow',path:null,activity:'following',position:[3.2,0,-4.1],carried:false,...over});
const none=companion({ref:null,name:null,state:'none',activity:null,position:null});

test('IPC 0.25 companion requests; 0.24 rejects them',()=>{
 const good=[['companion.set',{ref:pip}],['companion.set',{ref:'user/walker'}],['companion.clear',{}],['companion.mode',{mode:'follow'}],['companion.mode',{mode:'stay'}]];
 for(const [m,p] of good){assert.ok(ok(m,p),`${m} ${JSON.stringify(p)}`);assert.ok(!ok(m,p,'0.24'),`${m} in 0.24`);}
 const bad=[['companion.set',{}],['companion.set',{ref:'pip'}],['companion.set',{ref:pip,mode:'follow'}],['companion.clear',{ref:pip}],
  ['companion.mode',{}],['companion.mode',{mode:'route'}],['companion.mode',{mode:'follow',path:'user/path-3'}]];
 for(const [m,p] of bad)assert.ok(!ok(m,p),`${m} ${JSON.stringify(p)} should fail`);
 // Existing methods take the reserved id.
 for(const [m,p] of [['npcs.bind',{id:'companion',path:'user/path-3',phase:0.4}],['npcs.bind',{id:'companion',pose:{position:[1,0,2],rotation:[0,0,0,1]}}],
  ['paths.draw',{bind:'companion'}],['interaction.choose',{objectId:'companion',interactionId:'stay'}]])assert.ok(ok(m,p),m);
});

test('IPC 0.25 companion results',()=>{
 for(const m of NEW_METHODS){assert.ok(res(m,{revision:3}),m);assert.ok(!res(m,{}),m);assert.ok(!res(m,{revision:3,id:'x'}),m);}
});

test('IPC 0.25 companion state: required, closed, bounded',()=>{
 const latest=schema('0.25').$defs;
 assert.ok(latest.state.required.includes('companion'));
 for(const c of [companion(),none,companion({mode:'route',path:'user/path-3',activity:'walking'}),companion({mode:'stay',activity:'idle'}),
  companion({state:'waiting',reason:'no spot out of view',activity:'waiting',position:null}),companion({state:'unavailable',reason:'not installed',activity:null,position:null}),
  companion({state:'loading',activity:null,position:null}),companion({state:'hidden',reason:'npc motion off',activity:null}),companion({activity:'carried',carried:true}),
  companion({activity:'talking'}),companion({activity:'running'}),companion({activity:'sitting',mode:'route',path:'package/market-loop'})])
  assert.ok(delta({companion:c}),JSON.stringify(c));
 for(const c of [companion({state:'lost'}),companion({mode:'guide'}),companion({path:'market-loop'}),companion({activity:'flying'}),companion({position:[1,2]}),
  companion({reason:''}),companion({reason:'x'.repeat(65)}),companion({name:'x'.repeat(33)}),companion({carried:'no'}),companion({extra:1}),(({carried,...c})=>c)(companion())])
  assert.ok(!delta({companion:c}),JSON.stringify(c));
 assert.ok(!delta({companion:companion()},'0.24'),'0.24 has no companion key');
});

test('IPC 0.25 catalog entries carry companion capability',()=>{
 const entry=(companion)=>({ref:pip,source:'library',id:'pip',version:'0.1.0',formatVersion:'0.10',name:'Pip',description:null,category:'characters',tags:[],
  traits:['character'],surfaces:null,scale:null,bounds:null,triangles:7990,gpuBytes:5000000,collisionTriangles:null,thumbnail:null,license:'CC-BY-4.0',
  library:'io.github.ada.pip@0.1.0',versions:['0.1.0'],state:'ready',placeable:true,reason:null,errors:[],machine:null,companion});
 const catalog=e=>res('objects.catalog',{revision:1,entries:[e]});
 assert.ok(catalog(entry({capable:true,name:'Pip',reason:null})));
 assert.ok(catalog(entry({capable:false,name:'Pip',reason:'taller than 2.0 m'})));
 assert.ok(catalog(entry(null)));
 assert.ok(!catalog(entry({capable:true,name:'Pip'})));
 const {companion:_,...old}=entry(null);
 assert.ok(!catalog(old),'0.25 entries name companion');
 assert.ok(res('objects.catalog',{revision:1,entries:[old]},'0.24'));
 assert.ok(!res('objects.catalog',{revision:1,entries:[entry(null)]},'0.24'),'0.24 entries have no companion field');
});

test('IPC 0.25 aimed interactions may be of type companion (Stay, Follow)',()=>{
 const npcs={motion:'auto',state:'animating',reason:null,usage:{authored:0,user:0},limits:{authored:16,user:8},drawing:null,
  aimed:{objectId:'companion',name:'Pip',prompt:'Talk to Pip',interactions:[{id:'talk',label:'Talk',type:'say'},{id:'stay',label:'Stay',type:'companion'}]},interaction:null};
 assert.ok(delta({npcs}));
 assert.ok(!delta({npcs},'0.24'));
});

test('IPC 0.25 inherits every 0.24 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.24'),latest=schema('0.25');
 assert.ok(latest.title.includes('0.25'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.25/ipc.schema.json');
 const changed=['session.hello.result','request','response','state','state.delta.notification','catalogEntry','npcsState'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 const expected=[...NEW_METHODS.flatMap(m=>['params','result','request','response'].map(p=>`${m}.${p}`)),'companionState'];
 assert.deepEqual([...added].sort(),[...expected].sort());
 const refs=(def,key)=>latest.$defs[def][key].map(r=>r.$ref);
 assert.deepEqual(refs('request','oneOf'),[...old.$defs.request.oneOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.request`)]);
 assert.deepEqual(refs('response','anyOf'),[...old.$defs.response.anyOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.response`)]);
 assert.deepEqual(latest.$defs.notification,old.$defs.notification,'no new events; notices are runtime.notice codes');
 const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
 assert.deepEqual(without(latest.$defs.state.properties,['companion']),old.$defs.state.properties);
 assert.deepEqual(latest.$defs.state.required,[...old.$defs.state.required,'companion']);
 const changes=d=>d.$defs['state.delta.notification'].properties.params.properties.changes;
 assert.deepEqual(without(changes(latest).properties,['companion']),changes(old).properties);
 assert.deepEqual(without(changes(latest),['properties']),without(changes(old),['properties']));
 assert.deepEqual(without(latest.$defs.catalogEntry.properties,['companion']),old.$defs.catalogEntry.properties);
 assert.deepEqual(latest.$defs.catalogEntry.required,[...old.$defs.catalogEntry.required,'companion']);
 const aimedType=d=>d.$defs.npcsState.properties.aimed.anyOf[1].properties.interactions.items.properties.type.enum;
 assert.deepEqual(aimedType(latest),[...aimedType(old),'companion']);
 const strip=d=>{const c=structuredClone(d.$defs.npcsState);c.properties.aimed.anyOf[1].properties.interactions.items.properties.type.enum=[];return c;};
 assert.deepEqual(strip(latest),strip(old),'npcsState changes only the aimed interaction types');
 assert.deepEqual(latest.$defs['session.hello.params'],old.$defs['session.hello.params'],'no new grant');
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.25');
 assert.deepEqual(hello.methods.items.enum,[...oldHello.methods.items.enum,...NEW_METHODS]);
 assert.deepEqual(without(hello,['protocol','methods']),without(oldHello,['protocol','methods']));
 assert.ok(ipcProtocols.includes('0.25'));
 const s=read('examples/ipc/state.delta.notification.json');
 for(const v of ['0.24','0.25'])assert.equal(validate('ipc',s,undefined,v).valid,validate('ipc',s,undefined,'0.24').valid,v);
});

test('object format 0.10: the companion block', ()=>{
 const base=read('examples/object-character.json');
 const character=(companion,clips={})=>({...base,formatVersion:'0.10',traits:{character:{...base.traits.character,clips:{...base.traits.character.clips,...clips}}},companion});
 const errs=doc=>validate('object',doc,undefined,'0.10').errors||[];
 assert.deepEqual(errs(character({name:'Pip',followDistance:2,idles:['idle_alt1'],say:['Nice place.']},{idle_alt1:{}})),[]);
 assert.deepEqual(errs(character({})),[]);
 assert.deepEqual(errs(character(undefined)),[]);
 for(const [c,pattern] of [[{followDistance:1},/followDistance|minimum/],[{followDistance:3},/followDistance must be <= 2.5/],[{name:''},/name|fewer/],[{say:Array(9).fill('x')},/more than 8/],
  [{say:['x'.repeat(161)]},/160/],[{idles:['idle_alt1','idle_alt1']},/duplicate|identical/],[{idles:Array(5).fill(0).map((_,i)=>`idle_${i}`)},/more than 4/],[{voice:'deep'},/additional/]])
  assert.match(errs(character(c,{idle_alt1:{}})).join('\n'),pattern,JSON.stringify(c));
 assert.match(errs(character({idles:['idle_alt9']})).join('\n'),/idle variant "idle_alt9" is not a clip of traits.character/);
 assert.match(errs(character({idles:['idle_fidget']},{idle_fidget:{}})).join('\n'),/canonical clip/);
 const lamp={...read('examples/object-character.json'),formatVersion:'0.10',category:'lighting',traits:{decorative:{animations:[{node:'n',type:'bob',axis:[0,1,0],amplitude:0.1,period:2}]}},companion:{}};
 assert.match(errs(lamp).join('\n'),/only characters can be companions/);
 assert.match((validate('object',{...base,companion:{}},undefined,'0.9').errors||[]).join('\n'),/companion|additional/,'0.9 has no companion block');
});
