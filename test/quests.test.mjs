import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import {validate, ipcProtocols} from '../lib/validate.mjs';

const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const ajv=new Ajv({strict:true,allErrors:true});
for(const dir of readdirSync(new URL('..',import.meta.url)).filter(d=>/^v0(\.\d+)?$/.test(d)))
 for(const name of ['common','world'])
  if(existsSync(new URL(`../${dir}/${name}.schema.json`,import.meta.url)))ajv.addSchema(read(`${dir}/${name}.schema.json`));
// One definition of an IPC version, compiled on its own.
const defAt=(v,name)=>{const s=schema(v);return ajv.compile({$schema:s.$schema,$id:`test-${name}-${v}`,$defs:s.$defs,$ref:`#/$defs/${name}`});};

const req=(method,params)=>({jsonrpc:'2.0',id:'q1',method,params});
const ok=(method,params,v='0.21')=>validate('ipc',req(method,params),undefined,v).valid;
const res=(method,result,v='0.21')=>validate('ipc',{jsonrpc:'2.0',id:'q1',result},method,v).valid;
const note=(method,params,v='0.21')=>validate('ipc',{jsonrpc:'2.0',method,params},undefined,v).valid;
const delta=(changes,v='0.21')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;

const ref={source:'personal',id:'release-notes'};
const marker=(over={})=>({id:'quest:personal/release-notes/draft/done',kind:'quest',tier:1,label:'Draft the notes',icon:'quest',
 target:{areaId:'sun-court'},position:[12.4,3.1,-40.2],areaId:'sun-court',range:[2,400],labelRange:120,occlusion:'through',tracked:true,
 source:{questId:'personal/release-notes',stepId:'draft',objectiveId:'done'},...over});
const markers=(over={})=>({reveal:{startedAtMs:123,holdMs:4000,fadeMs:600,reason:'tap'},persistent:'edge',calm:false,coreDraw:true,list:[marker()],...over});
const active=(over={})=>({id:'release-notes',source:'personal',title:'Write the release notes',step:{id:'draft',title:'Draft',progress:[0,1]},progress:[0,2],...over});
const quests=(over={})=>({enabled:true,tracked:ref,active:[active()],counts:{available:0,active:1,completed:5},world:null,...over});
const idle={state:'idle',pausedState:null,sessionId:null,phaseStartedAtMs:null,phaseEndsAtMs:null,phaseMs:0,remainingMs:0,creditedMs:0,
 crediting:false,cycle:0,cycles:4,breakKind:null,countMode:'focus',target:null,calm:false};
const work={...idle,state:'work',sessionId:'focus-1a2b3c',phaseStartedAtMs:1000,phaseEndsAtMs:1501000,phaseMs:1500000,remainingMs:1200000,
 creditedMs:290000,crediting:true,cycle:1,target:{kind:'window',label:'Editor on 21',workspaceId:21,appClass:'org.example.Editor',questRef:ref},calm:true};
const paused={...work,state:'paused',pausedState:'work',phaseStartedAtMs:null,phaseEndsAtMs:null,crediting:false};
const brk={...work,state:'break',breakKind:'short',phaseMs:300000,remainingMs:300000,crediting:false,calm:false,target:{kind:'any',label:''}};

const guidanceDefaults={'markers.reveal_ms':4000,'markers.reveal_mode':'timer','markers.max_revealed':12,'markers.labels':5,'markers.persistent':'edge',
 'markers.core_draw':true,'quests.notifications':'all','focus.work_min':25,'focus.short_break_min':5,'focus.long_break_min':15,'focus.long_break_every':4,
 'focus.cycles':4,'focus.auto_start_breaks':true,'focus.auto_start_work':false,'focus.count_mode':'focus','focus.idle_s':180,'focus.grace_s':30,
 'focus.calm':true,'focus.calm_npc_distance':6,'focus.desktop_chip':false,'focus.history_days':90};
const ranges={'markers.reveal_ms':[1000,15000],'markers.max_revealed':[4,16],'markers.labels':[2,8],'focus.work_min':[5,120],'focus.short_break_min':[1,30],
 'focus.long_break_min':[5,60],'focus.long_break_every':[2,12],'focus.cycles':[1,12],'focus.idle_s':[60,900],'focus.grace_s':[0,120],
 'focus.calm_npc_distance':[2,20],'focus.history_days':[0,365]};
const options={'markers.reveal_mode':['timer','toggle'],'markers.persistent':['off','edge','always'],'quests.notifications':['all','important','off'],
 'focus.count_mode':['focus','wall']};
const settings=(over={})=>({config:{...guidanceDefaults,...over},defaults:guidanceDefaults,overrides:over,ranges,options,
 path:'/home/u/.config/hyprune/guidance.json',error:''});

const input=(over={})=>({title:'Write the release notes',steps:[{title:'Draft'},{id:'review',title:'Review',
 objectives:[{id:'sessions',type:'focus',sessions:2},{id:'read',type:'manual',label:'Read it aloud'}]}],...over});
const summary=(over={})=>({questRef:ref,title:'Write the release notes',category:'personal',state:'active',tracked:true,
 step:{id:'draft',title:'Draft',progress:[0,1]},progress:[0,2],offWorld:false,updatedAt:'2026-10-12T09:30:00',...over});
const detail=(over={})=>({questRef:ref,title:'Write the release notes',summary:'',category:'personal',state:'active',tracked:true,sequential:true,
 expires:null,createdAt:'2026-10-12T09:00:00',updatedAt:'2026-10-12T09:30:00',completedAt:null,personal:true,
 steps:[{id:'draft',title:'Draft',optional:false,any:false,state:'current',target:{workspaceId:21},
   objectives:[{id:'done',type:'manual',label:'Done',count:1,done:0}]},
  {id:'review',title:'Review',optional:false,any:false,state:'pending',target:null,
   objectives:[{id:'sessions',type:'focus',label:'2 focus sessions',count:1,done:0,sessions:2,minutes:20,focusTarget:'quest',creditedMinutes:0},
    {id:'walk',type:'reach',label:'Reach Array Hall',count:1,done:0,target:{areaId:'array-hall'},radius:4}]}],...over});
const interval=(over={})=>({start:'2026-10-12T09:00:00',end:'2026-10-12T09:25:00',phase:'work',plannedMin:25,creditedMin:21.5,
 targetKind:'workspace',workspaceId:21,questId:'personal/release-notes',outcome:'completed',...over});

const NEW_METHODS=['markers.reveal','guidance.get','guidance.set','quests.list','quests.get','quests.track','quests.accept','quests.abandon',
 'quests.resume','quests.create','quests.update','quests.delete','quests.mark','focus.start','focus.pause','focus.resume','focus.skip',
 'focus.stop','focus.history'];
const NEW_EVENTS=['quest.progress','focus.phase'];

test('IPC 0.21 request shapes for every new method; 0.20 rejects them',()=>{
 const good={
  'markers.reveal':[{},{durationMs:1000},{durationMs:15000}],
  'guidance.get':[{}],
  'guidance.set':[{patch:{'markers.reveal_ms':6000}},{patch:{'focus.count_mode':'wall','focus.calm':null}},{patch:{...guidanceDefaults}}],
  'quests.list':[{},{states:['active','completed']},{sources:['personal']}],
  'quests.get':[{questRef:ref}],
  'quests.track':[{questRef:ref},{questRef:null}],
  'quests.accept':[{questRef:ref}],'quests.abandon':[{questRef:ref}],'quests.resume':[{questRef:ref}],'quests.delete':[{questRef:ref}],
  'quests.create':[{quest:input()},{quest:input({id:'notes',summary:'For 0.21',sequential:false,expires:'2026-10-20T18:00'})},
   {quest:{title:'Visit the hall',steps:[{title:'Go',target:{areaId:'array-hall'},objectives:[{id:'go',type:'reach',radius:0.5}]}]}},
   {quest:{title:'Somewhere',steps:[{title:'There',objectives:[{id:'go',type:'reach',target:{position:[1,2,3],worldId:'com.example.world'},count:3}]}]}}],
  'quests.update':[{questRef:ref,quest:input()}],
  'quests.mark':[{questRef:ref,stepId:'draft',objectiveId:'done'}],
  'focus.start':[{},{target:{kind:'any'}},{target:{kind:'workspace',workspaceId:21,label:'Workspace 21'}},
   {target:{kind:'window',appClass:'org.example.Editor',workspaceId:21}},{target:{kind:'app',appClass:'org.example.Editor'}},
   {questRef:ref,objectiveId:'sessions'},{overrides:{work_min:1,short_break_min:1,long_break_min:60,long_break_every:2,cycles:12,
    count_mode:'wall',idle_s:900,grace_s:0,calm:false,auto_start_breaks:false,auto_start_work:true}}],
  'focus.pause':[{}],'focus.resume':[{}],'focus.skip':[{}],'focus.stop':[{}],
  'focus.history':[{},{days:1},{days:365}],
 };
 assert.deepEqual(Object.keys(good).sort(),[...NEW_METHODS].sort());
 for(const [m,list] of Object.entries(good))for(const params of list){
  assert.equal(ok(m,params),true,`${m} ${JSON.stringify(params)}`);
  assert.equal(ok(m,params,'0.20'),false,`${m} at 0.20`);
 }
 const bad={
  'markers.reveal':[{durationMs:999},{durationMs:15001},{durationMs:2000.5},{holdMs:2000}],
  'guidance.get':[{x:1}],
  'guidance.set':[{},{patch:{}},{patch:{'markers.reveal_ms':999}},{patch:{'markers.max_revealed':17}},{patch:{'markers.labels':1}},
   {patch:{'markers.persistent':'never'}},{patch:{'focus.work_min':4}},{patch:{'focus.idle_s':901}},{patch:{'focus.history_days':-1}},
   {patch:{'focus.calm':'yes'}},{patch:{'focus.unknown':1}},{patch:{work_min:25}}],
  'quests.list':[{states:['done']},{states:[]},{sources:['']},{x:1}],
  'quests.get':[{},{questRef:{source:'personal'}},{questRef:{source:'personal',id:'Release'}},{questRef:{source:'',id:'a'}},
   {questRef:{source:'personal',id:'-a'}},{questRef:{source:'personal',id:'a'.repeat(65)}},{questRef:{...ref,extra:1}}],
  'quests.track':[{}],
  'quests.create':[{},{quest:{title:'No steps',steps:[]}},{quest:{title:'',steps:[{title:'a'}]}},{quest:{title:'x'.repeat(65),steps:[{title:'a'}]}},
   {quest:input({summary:'x'.repeat(1001)})},{quest:input({expires:'2026-10-20'})},{quest:input({expires:'2026-10-20T18:00:00'})},
   {quest:{title:'Too many',steps:Array(17).fill({title:'s'})}},{quest:{title:'q',steps:[{title:'s',objectives:[]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:Array(9).fill({id:'a',type:'manual'})}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{type:'manual'}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'focus'}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'focus',sessions:13}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'focus',sessions:1,minutes:121}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'manual',sessions:1}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'reach',radius:0.4}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'manual',count:101}]}]}},
   {quest:{title:'q',steps:[{title:'s',objectives:[{id:'a',type:'interact'}]}]}},
   {quest:{title:'q',steps:[{title:'s',target:{areaId:'a',zoneId:'b'}}]}},{quest:{title:'q',steps:[{title:'s',target:{workspaceId:0}}]}},
   {quest:{title:'q',steps:[{title:'s',target:{objectId:'lantern'}}]}},{quest:input({category:'main'})}],
  'quests.update':[{questRef:ref},{quest:input()}],
  'quests.mark':[{questRef:ref,stepId:'draft'},{questRef:ref,stepId:'Draft',objectiveId:'done'}],
  'focus.start':[{target:{kind:'workspace'}},{target:{kind:'window',appClass:'x'}},{target:{kind:'app'}},{target:{kind:'any',workspaceId:3}},
   {target:{kind:'quest'}},{objectiveId:'sessions'},{overrides:{work_min:0}},{overrides:{work_min:121}},{overrides:{cycles:13}},
   {overrides:{idle_s:59}},{overrides:{long_break_every:1}},{overrides:{'focus.work_min':25}},{sessionId:'focus-1'}],
  'focus.pause':[{x:1}],'focus.stop':[{reason:'done'}],
  'focus.history':[{days:0},{days:366},{days:'7'}],
 };
 for(const [m,list] of Object.entries(bad))for(const params of list)assert.equal(ok(m,params),false,`${m} ${JSON.stringify(params)}`);
});

test('IPC 0.21 result shapes for every new method',()=>{
 const rev={revision:7};
 for(const m of ['markers.reveal','quests.track','quests.accept','quests.abandon','quests.resume','quests.update','quests.delete','quests.mark',
  'focus.pause','focus.resume','focus.skip','focus.stop']){
  assert.equal(res(m,rev),true,m);
  for(const bad of [{},{revision:-1},{revision:1.5},{revision:1,extra:true}])assert.equal(res(m,bad),false,`${m} ${JSON.stringify(bad)}`);
  assert.throws(()=>res(m,rev,'0.20'),/Unknown method/);
 }
 for(const m of ['guidance.get','guidance.set']){
  assert.equal(res(m,settings()),true,m);
  assert.equal(res(m,settings({'focus.work_min':50,'markers.persistent':'always'})),true,m);
  const {'focus.calm':_,...missing}=guidanceDefaults;
  const {'focus.idle_s':__,...fewRanges}=ranges;
  for(const bad of [{...settings(),config:missing},{...settings(),overrides:{'focus.calm':null}},{...settings(),ranges:fewRanges},
   {...settings(),ranges:{...ranges,'focus.calm':[0,1]}},{...settings(),options:{...options,'markers.persistent':['off','never']}},
   {...settings(),path:'/'+'x'.repeat(4096)},{...settings(),extra:1}])
   assert.equal(res(m,bad),false,JSON.stringify(bad).slice(0,120));
 }
 assert.equal(res('quests.create',{revision:3,questRef:ref}),true);
 assert.equal(res('quests.create',{revision:3}),false);
 assert.equal(res('quests.list',{quests:[]}),true);
 assert.equal(res('quests.list',{quests:[summary(),summary({questRef:{source:'personal',id:'other'},tracked:false,step:null,state:'completed',offWorld:true})]}),true);
 assert.equal(res('quests.list',{quests:Array(256).fill(summary())}),true);
 assert.equal(res('quests.list',{quests:Array(257).fill(summary())}),false);
 for(const bad of [summary({category:'chores'}),summary({state:'done'}),summary({updatedAt:'yesterday'}),summary({progress:[1]}),
  summary({progress:[0,10001]}),summary({offWorld:undefined}),{...summary(),extra:1}])
  assert.equal(res('quests.list',{quests:[JSON.parse(JSON.stringify(bad))]}),false,JSON.stringify(bad).slice(0,120));
 assert.equal(res('quests.get',{quest:detail()}),true);
 assert.equal(res('quests.get',{quest:detail({expires:'2026-10-20T18:00',state:'failed',completedAt:null})}),true);
 assert.equal(res('quests.get',{quest:detail({state:'completed',completedAt:'2026-10-12T10:00:00+02:00'})}),true);
 const step0=detail().steps[0];
 for(const bad of [detail({steps:[]}),detail({personal:undefined}),detail({steps:[{...step0,state:'active'}]}),
  detail({steps:[{...step0,objectives:[{id:'done',type:'manual',label:'Done',count:1}]}]}),
  detail({steps:[{...step0,objectives:[{id:'done',type:'manual',label:'Done',count:1,done:0,extra:1}]}]})])
  assert.equal(res('quests.get',{quest:JSON.parse(JSON.stringify(bad))}),false,JSON.stringify(bad).slice(0,120));
 assert.equal(res('focus.start',{revision:4,sessionId:'focus-00ff'}),true);
 for(const sessionId of ['focus-','Focus-1','focus-XYZ','focus-'+'a'.repeat(59)])assert.equal(res('focus.start',{revision:4,sessionId}),false,sessionId);
 assert.equal(res('focus.history',{intervals:[interval(),interval({phase:'break',targetKind:'any',workspaceId:undefined,questId:undefined,plannedMin:5,creditedMin:0,outcome:'skipped'})].map(i=>JSON.parse(JSON.stringify(i)))}),true);
 assert.equal(res('focus.history',{intervals:Array(512).fill(interval())}),true);
 assert.equal(res('focus.history',{intervals:Array(513).fill(interval())}),false);
 for(const bad of [interval({title:'Secret doc'}),interval({outcome:'failed'}),interval({phase:'idle'}),interval({questId:'release-notes'}),
  interval({creditedMin:-1})])
  assert.equal(res('focus.history',{intervals:[bad]}),false,JSON.stringify(bad));
});

test('IPC 0.21 state carries markers, quests and focus; deltas accept them',()=>{
 for(const changes of [{markers:markers()},{markers:markers({reveal:null,persistent:'off',list:[]})},
  {markers:markers({reveal:{startedAtMs:9007199254740991,holdMs:0,fadeMs:0,reason:'request'},calm:true,coreDraw:false})},
  {quests:quests()},{quests:quests({enabled:false,tracked:null,active:[],counts:{available:0,active:0,completed:0}})},
  {focus:idle},{focus:work},{focus:paused},{focus:brk},{focus:{...brk,state:'ready',breakKind:null,phaseStartedAtMs:null,phaseEndsAtMs:null}},
  {markers:markers(),quests:quests(),focus:work}])
  assert.equal(delta(changes),true,JSON.stringify(changes).slice(0,120));
 const kinds=['quest','waypoint','route','home','workspace','place','focus','break'];
 const list=kinds.map((kind,i)=>marker({id:`${kind}:${i}`,kind,icon:kind,tier:1+i%4,target:[{position:[0,0,0]},{zoneId:'z'},{areaId:'a'},{placeId:'p'},{workspaceId:21}][i%5],
  position:i%2?null:[0,1,0],areaId:null,tracked:false,source:[{waypoint:true},{route:true},{areaId:'a'},{workspaceId:21},{placeId:'p'},{zoneId:'z'},{focus:true},{break:true}][i]}));
 assert.equal(delta({markers:markers({list})}),true);
 const state=defAt('0.21','state'),state20=defAt('0.20','state');
 // A state with only the new keys fails only on the 0.20 keys it lacks; 0.20 has no such keys.
 assert.equal(state({markers:markers(),quests:quests(),focus:work}),false);
 const old=schema('0.20').$defs.state.required;
 assert.ok(state.errors.every(e=>e.keyword==='required'&&old.includes(e.params.missingProperty)),JSON.stringify(state.errors));
 state({});
 for(const k of ['markers','quests','focus'])assert.ok(state.errors.some(e=>e.params.missingProperty===k),k);
 state20({});
 assert.ok(!state20.errors.some(e=>['markers','quests','focus'].includes(e.params.missingProperty)));
 for(const [k,v] of [['markers',markers()],['quests',quests()],['focus',idle]]){
  assert.equal(delta({[k]:v},'0.20'),false,k);
  state20({[k]:v});
  assert.ok(state20.errors.some(e=>e.keyword==='additionalProperties'&&e.params.additionalProperty===k),k);
 }
});

test('IPC 0.21 state bounds and closed shapes',()=>{
 assert.equal(delta({markers:markers({list:Array(64).fill(marker())})}),true);
 assert.equal(delta({markers:markers({list:Array(65).fill(marker())})}),false,'65 markers');
 assert.equal(delta({quests:quests({active:Array(16).fill(active())})}),true);
 assert.equal(delta({quests:quests({active:Array(17).fill(active())})}),false,'17 active');
 assert.equal(delta({markers:markers({list:[marker({label:'x'.repeat(48)})]})}),true);
 assert.equal(delta({markers:markers({list:[marker({label:'x'.repeat(49)})]})}),false,'label 49');
 const reveal=over=>markers({reveal:{startedAtMs:1,holdMs:4000,fadeMs:600,reason:'tap',...over}});
 for(const holdMs of [0,1000,15000])assert.equal(delta({markers:reveal({holdMs})}),true,`holdMs ${holdMs}`);
 for(const holdMs of [1,999,15001,-1,4000.5])assert.equal(delta({markers:reveal({holdMs})}),false,`holdMs ${holdMs}`);
 for(const over of [{fadeMs:601},{fadeMs:-1},{reason:'hold'},{startedAtMs:-1},{startedAtMs:9007199254740992},{extra:1}])
  assert.equal(delta({markers:reveal(over)}),false,JSON.stringify(over));
 const badMarkers=[{id:''},{id:'x'.repeat(161)},{tier:0},{tier:5},{kind:'npc'},{icon:'star'},{target:{}},{target:{areaId:'a',placeId:'b'}},
  {target:{objectId:'lantern'}},{target:{workspaceId:0}},{target:{position:[1,2]}},{position:[1,2]},{range:[1]},{range:[-1,10]},{range:[0,10001]},
  {labelRange:10001},{occlusion:'never'},{tracked:'yes'},{source:{questId:'release-notes'}},{source:{waypoint:false}},{source:{stepId:'Draft'}},
  {source:{npcId:'x'}},{extra:1}];
 for(const over of badMarkers)assert.equal(delta({markers:markers({list:[marker(over)]})}),false,JSON.stringify(over));
 const {coreDraw,...noCoreDraw}=markers();
 assert.equal(delta({markers:noCoreDraw}),false);
 assert.equal(delta({markers:markers({persistent:'on'})}),false);
 for(const over of [{world:{progress:0.5}},{tracked:{source:'personal'}},{counts:{available:0,active:0}},{counts:{available:0,active:0,completed:10001}},
  {active:[active({title:''})]},{active:[active({title:'x'.repeat(65)})]},{active:[active({progress:[0,1,2]})]},{active:[active({step:{id:'a',title:'b'}})]},
  {active:[active({id:'Bad'})]},{extra:1}])
  assert.equal(delta({quests:quests(over)}),false,JSON.stringify(over));
 for(const over of [{state:'running'},{pausedState:'paused'},{sessionId:'session-1'},{phaseMs:-1},{remainingMs:null},{cycle:13},{cycles:0},
  {breakKind:'medium'},{countMode:'strict'},{target:{kind:'quest',label:''}},{target:{kind:'any'}},{target:{kind:'any',label:'x'.repeat(65)}},
  {target:{kind:'app',label:'',appClass:'x'.repeat(129)}},{crediting:undefined},{extra:1}])
  assert.equal(delta({focus:JSON.parse(JSON.stringify({...work,...over}))}),false,JSON.stringify(over));
});

test('IPC 0.21 quest.progress and focus.phase notifications',()=>{
 const progress=(over={})=>({questRef:ref,kind:'step',title:'Write the release notes',stepId:'draft',stepTitle:'Draft',nextStepTitle:'Review',
  objectiveId:'done',progress:[1,1],sessionId:'session-1',revision:12,...over});
 const phase=(over={})=>({focusSessionId:'focus-1a2b',phase:'break',cycle:1,cycles:4,creditedMs:1320000,breakKind:'short',outcome:'completed',counted:true,
  suggestion:{markerId:'break:place/north-lookout',label:'North lookout'},sessionId:'session-1',revision:13,...over});
 for(const kind of ['objective','step','completed','available','failed'])assert.equal(note('quest.progress',progress({kind})),true,kind);
 assert.equal(note('quest.progress',{questRef:ref,kind:'completed',title:'Write the release notes',sessionId:'s',revision:1}),true);
 for(const p of [progress({kind:'offered'}),progress({title:''}),progress({stepId:'Draft'}),progress({progress:[1]}),progress({unlocks:[]}),
  (({sessionId,...p})=>p)(progress()),(({revision,...p})=>p)(progress())])
  assert.equal(note('quest.progress',p),false,JSON.stringify(p));
 for(const p of [phase(),phase({phase:'work',breakKind:undefined,outcome:undefined,counted:undefined,suggestion:undefined}),phase({phase:'ended',outcome:'stopped',counted:false}),
  phase({phase:'paused'}),phase({phase:'ready',cycle:4})])
  assert.equal(note('focus.phase',JSON.parse(JSON.stringify(p))),true,JSON.stringify(p));
 for(const p of [phase({sessionId:undefined}),phase({phase:'idle'}),phase({focusSessionId:'session-1'}),phase({cycle:13}),phase({breakKind:'tiny'}),
  phase({outcome:'failed'}),phase({suggestion:{markerId:'x'}}),phase({suggestion:{markerId:'x',label:'x'.repeat(49)}}),phase({extra:1})])
  assert.equal(note('focus.phase',JSON.parse(JSON.stringify(p))),false,JSON.stringify(p));
 assert.equal(note('quest.progress',progress(),'0.20'),false);
 assert.equal(note('focus.phase',phase(),'0.20'),false);
});

test('IPC 0.21 hello, keymap, overlay style and projection markers',()=>{
 const caps=['state.read','shell.control','quest.control'];
 const hello=(v,over={})=>validate('ipc',{jsonrpc:'2.0',id:'h',result:{protocol:v,sessionId:'s',capabilities:caps,methods:['session.hello',...NEW_METHODS],events:['state.delta',...NEW_EVENTS],...over}},'session.hello',v).valid;
 assert.equal(hello('0.21'),true);
 assert.equal(hello('0.20'),false);
 assert.equal(hello('0.20',{capabilities:['state.read'],methods:['session.hello'],events:['state.delta']}),true);
 assert.equal(hello('0.20',{capabilities:['quest.control'],methods:['session.hello'],events:['state.delta']}),false);
 assert.equal(hello('0.21',{capabilities:['quest.provide']}),false);
 const helloReq=(v,capabilities)=>ok('session.hello',{protocols:[v],client:{id:'org.example.cli',name:'CLI'},capabilities},v);
 assert.equal(helloReq('0.21',['state.read','quest.control']),true);
 assert.equal(helloReq('0.20',['state.read','quest.control']),false);
 const style={waypointColor:[1,.5,0],routeColor:[1,.5,0],labelColor:[1,1,1],promptColor:[1,1,1],fontFamily:'DejaVu Sans',iconAtlas:null,
  reticleColor:[.95,.95,.95],validColor:[.35,.95,.6],invalidColor:[1,.62,.35]};
 assert.equal(ok('overlay.style',{leaseId:'lease',style:{questColor:[1,.78,.3]}}),true);
 assert.equal(ok('overlay.style',{leaseId:'lease',style:{questColor:[1,.78,.3]}},'0.20'),false);
 assert.equal(ok('overlay.style',{leaseId:'lease',style:{questColor:[1.1,0,0]}}),false);
 assert.equal(res('overlay.style',{style:{...style,questColor:[1,.78,.3]}}),true);
 assert.equal(res('overlay.style',{style}),false,'questColor is required');
 assert.equal(res('overlay.style',{style},'0.20'),true);
 const projection=markers=>({spatial:{world:null,map:null,output:null,projection:{outputId:'out',worldId:'com.example.world',monotonicMs:5,markers}}});
 const pm={id:'p1',label:'Draft',x:.5,y:.5,distance:12,occluded:false};
 assert.equal(delta(projection([pm,{...pm,id:'p2',markerId:'quest:personal/release-notes/draft/done'}])),true);
 assert.equal(delta(projection([{...pm,markerId:''}])),false);
 assert.equal(delta(projection([{...pm,markerId:'x'.repeat(161)}])),false);
 assert.equal(delta(projection([{...pm,markerId:'m'}]),'0.20'),false);
 assert.equal(delta(projection([pm]),'0.20'),true);
 const world=schema('0.21').$defs.inputConfig.properties.modes.properties.world;
 assert.ok(world.required.includes('markers.reveal'));
 assert.deepEqual(world.properties['markers.reveal'],world.properties.exit);
});

test('IPC 0.21 inherits every 0.20 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.20'),latest=schema('0.21');
 assert.ok(latest.title.includes('0.21'));
 const changed=['session.hello.params','session.hello.result','request','response','notification','state','state.delta.notification',
  'inputConfig','overlayStyle','overlayStylePatch','marker'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 for(const m of NEW_METHODS)for(const p of ['params','result','request','response'])assert.ok(added.includes(`${m}.${p}`),`${m}.${p}`);
 for(const e of NEW_EVENTS)for(const p of ['params','notification'])assert.ok(added.includes(`${e}.${p}`),`${e}.${p}`);
 for(const k of ['questRef','questTarget','guidanceMarker','markersState','questsState','focusState','guidanceSettings','questSummary','questDetail',
  'personalQuestInput','focusInterval','focusTargetInput','focusOverrides'])assert.ok(added.includes(k),k);
 // request/response/notification only append the new members.
 const refs=(def,key)=>latest.$defs[def][key].map(r=>r.$ref);
 assert.deepEqual(refs('request','oneOf'),[...old.$defs.request.oneOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.request`)]);
 assert.deepEqual(refs('response','anyOf'),[...old.$defs.response.anyOf.map(r=>r.$ref),...NEW_METHODS.map(m=>`#/$defs/${m}.response`)]);
 assert.deepEqual(refs('notification','oneOf'),[...old.$defs.notification.oneOf.map(r=>r.$ref),...NEW_EVENTS.map(e=>`#/$defs/${e}.notification`)]);
 const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
 const three=['markers','quests','focus'];
 assert.deepEqual(without(latest.$defs.state.properties,three),old.$defs.state.properties);
 assert.deepEqual(latest.$defs.state.required,[...old.$defs.state.required,...three]);
 const changes=d=>d.$defs['state.delta.notification'].properties.params.properties.changes;
 assert.deepEqual(without(changes(latest).properties,three),changes(old).properties);
 assert.deepEqual(changes(latest).required,[]);
 assert.deepEqual(without(latest.$defs['state.delta.notification'].properties.params.properties,['changes']),
  without(old.$defs['state.delta.notification'].properties.params.properties,['changes']));
 for(const key of ['overlayStyle','overlayStylePatch']){
  const {questColor,...rest}=latest.$defs[key].properties;
  assert.deepEqual(rest,old.$defs[key].properties,key);
  assert.deepEqual(questColor,old.$defs[key].properties.promptColor,key);
 }
 assert.deepEqual(latest.$defs.overlayStyle.required,[...old.$defs.overlayStyle.required,'questColor']);
 const {markerId,...markerRest}=latest.$defs.marker.properties;
 assert.ok(markerId);assert.deepEqual(markerRest,old.$defs.marker.properties);assert.deepEqual(latest.$defs.marker.required,old.$defs.marker.required);
 const world=v=>v.$defs.inputConfig.properties.modes.properties.world;
 assert.deepEqual(without(world(latest).properties,['markers.reveal']),world(old).properties);
 assert.deepEqual(world(latest).required,[...world(old).required,'markers.reveal']);
 assert.deepEqual(without(latest.$defs.inputConfig.properties,['modes']),without(old.$defs.inputConfig.properties,['modes']));
 const modes=v=>v.$defs.inputConfig.properties.modes;
 assert.deepEqual(without(modes(latest).properties,['world']),without(modes(old).properties,['world']));
 assert.deepEqual(without(modes(latest),['properties']),without(modes(old),['properties']));
 for(const key of ['session.hello.params','session.hello.result']){
  const caps=v=>v.$defs[key].properties.capabilities.items.enum;
  assert.deepEqual(caps(latest),[...caps(old),'quest.control'],key);
  assert.deepEqual(without(latest.$defs[key].properties,['capabilities','protocol','methods','events']),without(old.$defs[key].properties,['capabilities','protocol','methods','events']));
 }
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.21');
 assert.deepEqual(hello.methods.items.enum,[...oldHello.methods.items.enum,...NEW_METHODS]);
 assert.deepEqual(hello.events.items.enum,[...oldHello.events.items.enum,...NEW_EVENTS]);
 // Guidance: every key in config/patch/overrides; ranges = numeric keys; options = enum keys.
 const g=latest.$defs;
 assert.deepEqual(Object.keys(g.guidanceConfig.properties),Object.keys(guidanceDefaults));
 assert.deepEqual(Object.keys(g.guidancePatch.properties),Object.keys(guidanceDefaults));
 assert.deepEqual(Object.keys(g.guidanceOverrides.properties),Object.keys(guidanceDefaults));
 assert.deepEqual(Object.keys(g.guidanceSettings.properties.ranges.properties).sort(),Object.keys(ranges).sort());
 assert.deepEqual(Object.keys(g.guidanceSettings.properties.options.properties).sort(),Object.keys(options).sort());
 for(const [k,[lo,hi]] of Object.entries(ranges)){assert.equal(g.guidanceConfig.properties[k].minimum,lo,k);assert.equal(g.guidanceConfig.properties[k].maximum,hi,k);}
 for(const [k,values] of Object.entries(options))assert.deepEqual(g.guidanceConfig.properties[k].enum,values,k);
 assert.ok(ipcProtocols.includes('0.21'));
});

test('0.21 file schemas: personal quests, guidance overrides, focus history lines',()=>{
 const ipc=schema('0.21');
 const files={personal:read('v0.21/quests-personal.schema.json'),guidance:read('v0.21/guidance.schema.json'),history:read('v0.21/focus-history.schema.json')};
 // Their definitions are copies of the IPC schema's (except the stored quest record).
 for(const [name,s] of Object.entries(files))for(const [k,v] of Object.entries(s.$defs))if(k!=='storedQuest')assert.deepEqual(v,ipc.$defs[k],`${name} ${k}`);
 const personal=ajv.compile(files.personal),guidance=ajv.compile(files.guidance),history=ajv.compile(files.history);
 const stored=(over={})=>({...input({id:'release-notes'}),state:'active',progress:{draft:{done:1},review:{sessions:0}},
  createdAt:'2026-10-12T09:00:00',updatedAt:'2026-10-12T09:30:00',completedAt:null,...over});
 assert.equal(personal({version:1,tracked:null,quests:[]}),true);
 assert.equal(personal({version:1,tracked:ref,quests:[stored(),stored({id:'other',state:'completed',completedAt:'2026-10-12T10:00:00'})]}),true);
 for(const bad of [{version:2,tracked:null,quests:[]},{version:1,quests:[]},{version:1,tracked:null,quests:Array(65).fill(stored())},
  {version:1,tracked:null,quests:[(({id,...q})=>q)(stored())]},{version:1,tracked:null,quests:[stored({state:'done'})]},
  {version:1,tracked:null,quests:[stored({progress:{Draft:{done:1}}})]},{version:1,tracked:null,quests:[stored({progress:{draft:{done:-1}}})]},
  {version:1,tracked:null,quests:[stored({title:'x'.repeat(65)})]},{version:1,tracked:null,quests:[],extra:1}])
  assert.equal(personal(bad),false,JSON.stringify(bad).slice(0,120));
 assert.equal(guidance({}),true);
 assert.equal(guidance({'markers.reveal_ms':6000,'focus.count_mode':'wall','focus.calm':false}),true);
 assert.equal(guidance(guidanceDefaults),true);
 for(const bad of [{'markers.reveal_ms':null},{'markers.reveal_ms':500},{'focus.history_days':366},{unknown:1},{'focus':{work_min:25}}])
  assert.equal(guidance(bad),false,JSON.stringify(bad));
 assert.equal(history(interval()),true);
 assert.equal(history(interval({phase:'break',outcome:'stopped',appClass:'org.example.Editor'})),true);
 for(const bad of [interval({title:'x'}),interval({outcome:undefined}),interval({start:'09:00'})])
  assert.equal(history(JSON.parse(JSON.stringify(bad))),false,JSON.stringify(bad));
});
