import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.26: the debug tool (tool 9), the companion's pace and the longer pocket list.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const req=(method,params)=>({jsonrpc:'2.0',id:'d1',method,params});
const ok=(method,params,v='0.26')=>validate('ipc',req(method,params),undefined,v).valid;
const delta=(changes,v='0.26')=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'sub',sessionId:'session',baseRevision:1,revision:2,changes}},undefined,v).valid;
const event=(method,params,v='0.26')=>validate('ipc',{jsonrpc:'2.0',method,params:{subscriptionId:'hud',sessionId:'session',revision:2,monotonicMs:10,...params}},undefined,v).valid;

const slot=(action,label)=>({action,label});
const slots=(p,s,a,c)=>({primary:p,secondary:s,alternate:a,cycle:c});
const definitions=['pointer','mount','path','position','placement'].map((name,i)=>({slot:i+1,name,slots:slots(slot('use','Use'),null,null,null)}));
const debugDefinition={slot:9,name:'Debug',slots:slots(slot('debug.inspect','Inspect'),slot('debug.clear','Close info card'),null,slot('tool.cycle','Debug layer'))};
const debugTool=(over={})=>({layer:'collision',label:'Collision & backstops',index:2,count:10,
 legend:[{label:'floor',colour:[0.3,0.9,0.4]},{label:'wall',colour:[0.25,0.78,0.85]}],card:null,...over});
const window=i=>({surfaceId:`surface-${i}`,title:`Window ${i}`,appClass:'foot',logicalSize:[1280,720]});
const unplaced=(n,over={})=>({count:n,windows:Array.from({length:n},(_,i)=>window(i)),selectedId:n?'surface-0':null,preview:false,objects:[],...over});
const editor=(over={})=>({mode:'world',tool:1,submode:'normal',selectedId:null,selectedKind:'',paths:[],objects:[],locked:[],debug:false,
 unplaced:unplaced(0),carryFacing:null,contentScale:null,toolSlots:definitions[0].slots,toolDefinitions:[...definitions,debugDefinition],
 toolInput:{modifiers:0,override:false,gestures:[]},gizmo:{space:'world',pivot:'centre',snap:false},debugTool:null,...over});
const old=e=>{const {debugTool:_,...rest}=e;return {...rest,toolDefinitions:definitions};};
const companion=(over={})=>({ref:'user/walker',name:'Walker',state:'active',reason:null,mode:'follow',path:null,activity:'following',position:[1,0,2],carried:false,pace:'walk',...over});
const instance=i=>({surfaceId:`surface-${i}`,workspaceId:20,areaId:'room',anchorId:'',status:'placed'});
const mounts=n=>({areas:[],anchors:[],bindings:[],placements:[],objects:[],placementZones:[],instances:Array.from({length:n},(_,i)=>instance(i)),carriedSurfaceId:null,desktopWorkspaceId:null});

test('IPC 0.26 tool 9 in interaction, editor, hud.pose and tool.changed; 0.25 still says 1-5',()=>{
 const debug=editor({tool:9,submode:'collision',toolSlots:debugDefinition.slots,debugTool:debugTool()});
 assert.ok(delta({editor:debug}));
 assert.ok(!delta({editor:old(debug)},'0.25'),'0.25 has no tool 9');
 assert.ok(delta({editor:old(editor())},'0.25'));
 for(const t of [0,6,8,10])assert.ok(!delta({editor:editor({tool:t})}),`tool ${t}`);
 for(const layer of ['windows','window-zones','collision','playable','paths','keep-clear','seats','visibility','steering','placement'])
  assert.ok(delta({editor:editor({tool:9,submode:layer,debugTool:debugTool({layer})})}),layer);
 assert.ok(!delta({editor:editor({tool:9,submode:'wiring'})}));
 assert.ok(event('hud.pose',{outputId:'output-1',worldId:'w',worldName:'W',position:[0,0,0],heading:0,pitch:0,zone:null,tool:9,subtype:'collision'}));
 assert.ok(!event('hud.pose',{outputId:'output-1',worldId:'w',worldName:'W',position:[0,0,0],heading:0,pitch:0,zone:null,tool:9,subtype:'collision'},'0.25'));
 assert.ok(event('tool.changed',{slot:9,name:'debug',subtype:'paths'}));
 assert.ok(!event('tool.changed',{slot:9,name:'debug',subtype:'paths'},'0.25'));
 assert.ok(!event('tool.changed',{slot:7,name:'debug',subtype:'paths'}));
});

test('IPC 0.26 editor.debugTool: required, null or a closed, bounded layer description',()=>{
 for(const t of [debugTool(),debugTool({card:['wall-12','Collision wall','Does not block placement']}),debugTool({legend:[]}),debugTool({index:9})])
  assert.ok(delta({editor:editor({tool:9,submode:t.layer,debugTool:t})}),JSON.stringify(t));
 for(const t of [debugTool({layer:'wiring'}),debugTool({label:''}),debugTool({label:'x'.repeat(65)}),debugTool({index:-1}),debugTool({count:0}),
  debugTool({legend:Array(9).fill({label:'a',colour:[1,1,1]})}),debugTool({legend:[{label:'a',colour:[1,1]}]}),debugTool({legend:[{label:'a',colour:[2,0,0]}]}),
  debugTool({legend:[{label:'a',colour:[1,1,1],alpha:1}]}),debugTool({card:[]}),debugTool({card:Array(9).fill('x')}),debugTool({card:['x'.repeat(257)]}),
  debugTool({extra:1}),(({card,...t})=>t)(debugTool())])
  assert.ok(!delta({editor:editor({tool:9,submode:'collision',debugTool:t})}),JSON.stringify(t));
 const {debugTool:_,...missing}=editor();
 assert.ok(!delta({editor:missing}),'debugTool is required');
 assert.ok(!delta({editor:editor({toolDefinitions:definitions})}),'toolDefinitions name slot 9');
 assert.ok(!delta({editor:editor({toolDefinitions:[...definitions,{...debugDefinition,slot:6}]})}));
});

test('IPC 0.26 world action tool9 is part of the keymap',()=>{
 const world=schema('0.26').$defs.inputConfig.properties.modes.properties.world;
 assert.ok(world.required.includes('tool9'));
 assert.deepEqual(world.properties.tool9,world.properties.tool5);
 assert.ok(!schema('0.25').$defs.inputConfig.properties.modes.properties.world.properties.tool9);
});

test('IPC 0.26 companion pace: required in state, optional in companion.mode',()=>{
 for(const pace of ['walk','run'])assert.ok(delta({companion:companion({pace})}),pace);
 assert.ok(!delta({companion:companion({pace:'sprint'})}));
 const {pace:_,...without}=companion();
 assert.ok(!delta({companion:without}),'pace is required');
 assert.ok(delta({companion:without},'0.25'));
 assert.ok(!delta({companion:companion()},'0.25'),'0.25 has no pace');
 for(const p of [{mode:'follow'},{mode:'stay'},{mode:'follow',pace:'run'},{mode:'stay',pace:'walk'}])assert.ok(ok('companion.mode',p),JSON.stringify(p));
 for(const p of [{pace:'run'},{mode:'follow',pace:'jog'},{mode:'route',pace:'run'}])assert.ok(!ok('companion.mode',p),JSON.stringify(p));
 assert.ok(!ok('companion.mode',{mode:'follow',pace:'run'},'0.25'));
});

test('IPC 0.26 pocket list and mount instances reach the 128-app limit',()=>{
 assert.ok(delta({editor:editor({unplaced:unplaced(128,{count:144})})}));
 assert.ok(!delta({editor:editor({unplaced:unplaced(129)})}));
 assert.ok(!delta({editor:editor({unplaced:unplaced(16,{count:145})})}));
 assert.ok(!delta({editor:old(editor({unplaced:unplaced(17)}))},'0.25'),'0.25 lists 16');
 assert.ok(delta({editor:old(editor({unplaced:unplaced(16)}))},'0.25'));
 assert.ok(delta({mounts:mounts(128)}));
 assert.ok(!delta({mounts:mounts(129)}));
 assert.ok(!delta({mounts:mounts(17)},'0.25'));
 assert.ok(delta({mounts:mounts(16)},'0.25'));
});

test('IPC 0.26 inherits every 0.25 definition except the listed changes and is negotiable',()=>{
 const old=schema('0.25'),latest=schema('0.26');
 assert.ok(latest.title.includes('0.26'));
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.26/ipc.schema.json');
 const changed=['session.hello.result','mounts','interaction','inputConfig','editor','hud.pose.params','tool.changed.params','unplaced','toolDefinition','companion.mode.params','companionState'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 assert.deepEqual(Object.keys(latest.$defs).filter(k=>!(k in old.$defs)),['debugTool']);
 const without=(o,keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
 const strip=(d,f)=>{const c=structuredClone(d);f(c);return c;};
 // Tool slots: 1-5 plus 9, nothing else in those definitions.
 const tools=[1,2,3,4,5,9];
 for(const [def,key] of [['interaction','tool'],['editor','tool'],['hud.pose.params','tool'],['tool.changed.params','slot'],['toolDefinition','slot']]){
  assert.deepEqual(latest.$defs[def].properties[key].enum,tools,def);
  assert.deepEqual(without(latest.$defs[def].properties,[key,'name','submode','toolDefinitions','debugTool']),without(old.$defs[def].properties,[key,'name','submode','toolDefinitions']),def);
 }
 assert.deepEqual(without(latest.$defs['tool.changed.params'].properties.name,['description']),old.$defs['tool.changed.params'].properties.name);
 const e=latest.$defs.editor,oe=old.$defs.editor;
 assert.deepEqual(e.properties.submode.enum,[...oe.properties.submode.enum,...['windows','window-zones','collision','playable','paths','keep-clear','seats','visibility','steering']]);
 assert.deepEqual(e.required,[...oe.required,'debugTool']);
 assert.deepEqual(without(e.properties.toolDefinitions,['minItems','maxItems','description']),without(oe.properties.toolDefinitions,['minItems','maxItems']));
 const world=d=>d.$defs.inputConfig.properties.modes.properties.world;
 assert.deepEqual(without(world(latest).properties,['tool9']),world(old).properties);
 assert.deepEqual(world(latest).required,[...world(old).required,'tool9']);
 assert.deepEqual(strip(latest.$defs.inputConfig,c=>{c.properties.modes.properties.world={};}),strip(old.$defs.inputConfig,c=>{c.properties.modes.properties.world={};}));
 assert.deepEqual(without(latest.$defs.companionState.properties,['pace']),old.$defs.companionState.properties);
 assert.deepEqual(latest.$defs.companionState.required,[...old.$defs.companionState.required,'pace']);
 assert.deepEqual(without(latest.$defs['companion.mode.params'].properties,['pace']),old.$defs['companion.mode.params'].properties);
 assert.deepEqual(latest.$defs['companion.mode.params'].required,['mode']);
 assert.deepEqual(strip(latest.$defs.unplaced,c=>{c.properties.windows.maxItems=0;c.properties.count.maximum=0;}),strip(old.$defs.unplaced,c=>{c.properties.windows.maxItems=0;c.properties.count.maximum=0;}));
 assert.equal(latest.$defs.unplaced.properties.objects.maxItems,16,'the object pocket keeps its 16-item budget');
 assert.deepEqual(strip(latest.$defs.mounts,c=>{c.properties.instances.maxItems=0;}),strip(old.$defs.mounts,c=>{c.properties.instances.maxItems=0;}));
 assert.equal(latest.$defs.apps.maxItems,128);
 assert.deepEqual(latest.$defs['session.hello.params'],old.$defs['session.hello.params'],'no new grant');
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.26');
 assert.deepEqual(without(hello,['protocol']),without(oldHello,['protocol']),'no new methods or events');
 assert.ok(ipcProtocols.includes('0.26'));
 const s=read('examples/ipc/state.delta.notification.json');
 assert.equal(validate('ipc',s,undefined,'0.26').valid,validate('ipc',s,undefined,'0.25').valid);
});
