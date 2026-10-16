import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.33 (draft): RFC-0016 pairing (session.pair before hello), the assistant profile,
// connections (state for shell.control peers, answer, revoke, disconnect, pause),
// assistant.report and preview.render.
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const strip=(o,...keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const METHODS=['session.pair','connections.answer','connections.revoke','connections.disconnect','connections.pause','assistant.report','preview.render'];
const SHAPES=['agent','connectionRequest','connectionLive','connectionApproval','connections','releaseDraft'];

test('IPC 0.33 inherits every 0.32 definition except hello, request, response and state; adds pairing, connections and previews',()=>{
 const old=schema('0.32'),latest=schema('0.33');
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.33/ipc.schema.json');
 const changed=['session.hello.result','request','response','state','state.delta.notification','companion.set.params'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 assert.deepEqual(added.filter(k=>!SHAPES.includes(k)).sort(),METHODS.flatMap(m=>['params','result','request','response'].map(s=>`${m}.${s}`)).sort());
 assert.deepEqual(added.filter(k=>SHAPES.includes(k)).sort(),[...SHAPES].sort());
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.33');
 assert.deepEqual(hello.methods.items.enum.filter(m=>!oldHello.methods.items.enum.includes(m)),METHODS.filter(m=>m!=='session.pair'),'pairing happens before hello');
 assert.deepEqual(strip(hello,'protocol','methods','profile'),strip(oldHello,'protocol','methods'));
 assert.deepEqual(strip(latest.$defs.state.properties,'connections'),old.$defs.state.properties);
 assert.deepEqual(latest.$defs.state.required,[],'profile-limited peers receive some keys only');
 assert.ok(ipcProtocols.includes('0.33'));
});

const req=(method,params,v='0.33')=>validate('ipc',{jsonrpc:'2.0',id:'s',method,params},undefined,v).valid;
const res=(method,result,v='0.33')=>validate('ipc',{jsonrpc:'2.0',id:'s',result},method,v).valid;
const token='5d2f0c6e3b9a41d8e7c2b0f4a6d9e1c3b5a7f9e2d4c6b8a0f1e3d5c7b9a2e4f6';
const pair={protocols:['0.33'],client:{id:'com.hyprune.mcp',name:'Hyprune MCP server'},agent:{name:'Example Chat',version:'1.4'},profile:'assistant'};

test('session.pair: params and the token; an unknown profile or a long agent name is refused',()=>{
 assert.ok(req('session.pair',pair));
 assert.ok(req('session.pair',{...pair,agent:{name:'x'}}));
 assert.ok(!req('session.pair',{...pair,profile:'admin'}));
 assert.ok(!req('session.pair',{...pair,agent:{name:'x'.repeat(65)}}));
 assert.ok(!req('session.pair',{...pair,agent:{name:'a\u0007b'}}));
 assert.ok(!req('session.pair',pair,'0.32'));
 assert.ok(res('session.pair',{token,profile:'assistant',remembered:false}));
 assert.ok(!res('session.pair',{token:'abc',profile:'assistant',remembered:false}));
});

test('connections: answer, revoke, disconnect, pause; the state key',()=>{
 assert.ok(req('connections.answer',{requestId:'p-0a1b',decision:'always'}));
 assert.ok(!req('connections.answer',{requestId:'p-0a1b',decision:'maybe'}));
 assert.ok(res('connections.answer',{ok:true}));
 assert.ok(req('connections.revoke',{clientId:'com.hyprune.mcp',agent:'Example Chat'}));
 assert.ok(res('connections.revoke',{removed:true}));
 assert.ok(req('connections.disconnect',{actor:'a1b2'}));assert.ok(res('connections.disconnect',{disconnected:false}));
 assert.ok(req('connections.pause',{actor:'a1b2',paused:true}));assert.ok(res('connections.pause',{paused:true}));
 const connections={pending:[{requestId:'p-0a1b',clientId:'com.hyprune.mcp',clientName:'Hyprune MCP server',agent:{name:'Example Chat',version:'1.4'},profile:'assistant',expiresInMs:118000}],
  live:[{actor:'a1b2',clientId:'com.hyprune.mcp',agent:{name:'Example Chat'},profile:'assistant',connectedMs:5200,changes:12,action:'placed cpu-tower',paused:false,remembered:true,releaseDraft:null}],
  approvals:[{clientId:'com.hyprune.mcp',agent:'Example Chat',profile:'assistant',approvedAt:'2026-10-16T03:00:00Z'}]};
 const delta=changes=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'s',sessionId:'x',baseRevision:1,revision:2,changes}},undefined,'0.33').valid;
 assert.ok(delta({connections}));
 assert.ok(delta({builder:null}),'an assistant peer may see few keys');
 assert.ok(!delta({connections:{...connections,live:[{...connections.live[0],profile:'shell'}]}}));
});

test('E2: companion names, release drafts in assistant.report and the live connection',()=>{
 assert.ok(req('companion.set',{ref:'library/com.hyprune.companions@0.1.0/fox',name:'Ember'}));
 assert.ok(req('companion.set',{ref:'library/com.hyprune.companions@0.1.0/fox',name:null}));
 assert.ok(!req('companion.set',{ref:'library/com.hyprune.companions@0.1.0/fox',name:'x'.repeat(33)}));
 assert.ok(!req('companion.set',{ref:'library/com.hyprune.companions@0.1.0/fox',name:'Ember'},'0.32'),'names from 0.33');
 assert.ok(req('assistant.report',{changes:9,releaseDraft:{projectId:'rooftop-garden',version:'0.2.0',notes:'The garden'}}));
 assert.ok(req('assistant.report',{changes:9,releaseDraft:null}));
 assert.ok(!req('assistant.report',{changes:9,releaseDraft:{projectId:'rooftop-garden',version:'v1'}}));
});

test('assistant.report and preview.render',()=>{
 assert.ok(req('assistant.report',{changes:3,action:'placed the bench'}));
 assert.ok(req('assistant.report',{changes:0}));
 assert.ok(!req('assistant.report',{changes:-1}));
 assert.ok(res('assistant.report',{paused:false,changes:3}));
 assert.ok(req('preview.render',{pose:{position:[0,1.7,4],yaw:180,pitch:-10},fov:70,size:[1024,576]}));
 assert.ok(req('preview.render',{pose:{position:[0,1.7,4]}}));
 assert.ok(!req('preview.render',{pose:{position:[0,1.7,4]},size:[4096,4096]}));
 assert.ok(!req('preview.render',{pose:{position:[0,1.7]}}));
 assert.ok(res('preview.render',{path:'/run/user/1000/hyprune/preview-1.png',width:1024,height:576,pose:{position:[0,1.7,4],yaw:180,pitch:-10},fov:70,renderMs:412}));
});
