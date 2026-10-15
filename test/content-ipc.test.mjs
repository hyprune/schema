import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';

// IPC 0.32 (draft): RFC-0015 content, sources and registry methods (the Library over IPC).
const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)));
const schema=v=>read(`v${v}/ipc.schema.json`);
const strip=(o,...keys)=>Object.fromEntries(Object.entries(o).filter(([k])=>!keys.includes(k)));
const METHODS=['content.install','content.confirm','content.cancel','content.update','content.rollback','content.pin','content.remove',
 'sources.list','sources.add','sources.set','sources.remove','sources.refresh','registry.list','registry.entry'];
const SHAPES=['contentPlanPackage','contentPlan','contentJob','contentInstall','contentSource','registryVersion','registryEntry'];

test('IPC 0.32 inherits every 0.31 definition except hello, request, response and state; adds the content methods',()=>{
 const old=schema('0.31'),latest=schema('0.32');
 assert.equal(latest.$id,'https://hyprune.com/schema/v0.32/ipc.schema.json');
 const changed=['session.hello.params','session.hello.result','request','response','state','state.delta.notification'];
 for(const key of Object.keys(old.$defs))if(!changed.includes(key))assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const added=Object.keys(latest.$defs).filter(k=>!(k in old.$defs));
 assert.deepEqual(added.filter(k=>!SHAPES.includes(k)).sort(),METHODS.flatMap(m=>['params','result','request','response'].map(s=>`${m}.${s}`)).sort());
 assert.deepEqual(added.filter(k=>SHAPES.includes(k)),SHAPES);
 const hello=latest.$defs['session.hello.result'].properties,oldHello=old.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.32');
 assert.deepEqual(hello.methods.items.enum.filter(m=>!oldHello.methods.items.enum.includes(m)),METHODS);
 assert.deepEqual(hello.capabilities.items.enum.filter(c=>!oldHello.capabilities.items.enum.includes(c)),['content.control']);
 assert.deepEqual(strip(hello,'protocol','methods','capabilities'),strip(oldHello,'protocol','methods','capabilities'));
 assert.deepEqual(strip(latest.$defs.state.properties,'content'),old.$defs.state.properties);
 assert.ok(ipcProtocols.includes('0.32'));
});

const req=(method,params,v='0.32')=>validate('ipc',{jsonrpc:'2.0',id:'s',method,params},undefined,v).valid;
const res=(method,result,v='0.32')=>validate('ipc',{jsonrpc:'2.0',id:'s',result},method,v).valid;
const sha='5d2f0c6e3b9a41d8e7c2b0f4a6d9e1c3b5a7f9e2d4c6b8a0f1e3d5c7b9a2e4f6';

test('IPC 0.32 content methods: params',()=>{
 for(const [m,p] of [
  ['content.install',{source:{entry:{sourceId:'community',id:'io.github.ada.tidepool'}}}],
  ['content.install',{source:{github:'ada/tidepool-world'},type:'world',tag:'v1.2.0',pin:true}],
  ['content.install',{source:{url:'https://example.org/x.tar.zst'},type:'library',sha256:sha,autoConfirm:true}],
  ['content.install',{source:{file:'/home/a/x.tar.zst'},type:'library',override:true}],
  ['content.confirm',{jobId:'j-41f0',accept:true}],['content.cancel',{jobId:'j-41f0'}],
  ['content.update',{id:'io.github.ada.tidepool'}],['content.update',{all:true}],['content.rollback',{id:'com.hyprune.street'}],
  ['content.pin',{id:'com.hyprune.street',pinned:false}],['content.remove',{id:'com.hyprune.street',version:'1.1.0',force:true}],
  ['sources.list',{}],['sources.add',{url:'https://example.org/hyprune/v0.1/index.json',label:'Frank\'s stuff'}],
  ['sources.add',{github:'ada/tidepool-world',id:'ada-tidepool'}],['sources.set',{id:'community',enabled:false}],
  ['sources.set',{id:'franks-stuff',label:'Frank'}],['sources.remove',{id:'franks-stuff'}],['sources.refresh',{}],
  ['sources.refresh',{ids:['official']}],['registry.list',{}],
  ['registry.list',{query:'tide',type:'world',sourceIds:['community'],tags:['water'],cursor:'50',limit:100}],
  ['registry.entry',{sourceId:'community',id:'io.github.ada.tidepool'}]])assert.ok(req(m,p),`${m} ${JSON.stringify(p)}`);
 for(const [m,p] of [
  ['content.install',{}],['content.install',{source:{url:'http://example.org/x.tar.zst'},type:'library'}],
  ['content.install',{source:{file:'relative.tar.zst'},type:'library'}],['content.install',{source:{github:'ada'},type:'world'}],
  ['content.install',{source:{entry:{sourceId:'community',id:'x.y'}},sha256:'abc'}],
  ['content.confirm',{jobId:'41f0',accept:true}],['content.confirm',{jobId:'j-41f0'}],['content.update',{all:false}],
  ['content.update',{}],['content.pin',{id:'a.b'}],['sources.set',{id:'community'}],['sources.add',{label:'x'}],
  ['sources.add',{url:'https://e.org/i.json',github:'a/b'}],['sources.refresh',{ids:[]}],['registry.list',{limit:101}],
  ['registry.list',{cursor:'abc'}],['registry.entry',{id:'a.b'}],['sources.remove',{id:'Frank'}],['sources.remove',{id:'-x'}]])
  assert.ok(!req(m,p),`${m} ${JSON.stringify(p)} refused`);
 assert.ok(!req('content.install',{source:{entry:{sourceId:'community',id:'io.github.ada.tidepool'}}},'0.31'),'0.31 has no content methods');
 assert.ok(res('content.install',{jobId:'j-41f0'}));assert.ok(res('content.confirm',{revision:3}));
 assert.ok(!res('content.install',{revision:3}));
});

const job={jobId:'j-41f0',kind:'install',stage:'confirm',target:'io.github.ada.tidepool',created:'2026-10-16T08:00:00Z',progress:null,error:null,result:null,
 plan:{packages:[{id:'io.github.ada.tidepool',type:'world',tag:'v1.2.0',version:'1.2.0',formatVersion:'0.9',replaces:'v1.1.0',sourceId:'community',
  sourceLabel:'Community registry',creator:'ada',repo:'https://github.com/ada/tidepool-world',license:'CC-BY-SA-4.0',licenceNote:'declared',
  bytes:48213004,expandedBytes:96424960,sha256:sha,url:'https://github.com/ada/tidepool-world/releases/download/v1.2.0/io.github.ada.tidepool-1.2.0.tar.zst',
  action:'update',requires:[]}],sourceChange:null,override:false,diskFreeAfter:182536110080}};
const install={id:'io.github.ada.tidepool',type:'world',sourceId:'community',display:'Community registry',sourceState:'enabled',tag:'v1.1.0',version:'1.1.0',
 previous:null,pinned:false,managed:'user',removedFromSource:false,newerTag:'v1.2.0',license:'CC-BY-SA-4.0'};
const source={id:'community',kind:'community',label:'Community registry',display:'Community registry',url:'https://hyprune.github.io/registry/v0.1/community.json',
 enabled:true,builtin:true,system:false,lastRefresh:'2026-10-16T07:00:00Z',serial:42,entries:12,error:null};
const version={tag:'v1.2.0',version:'1.2.0',formatVersion:'0.9',license:'CC-BY-SA-4.0',bytes:48213004,expandedBytes:96424960,published:'2026-10-01',
 status:'available',prerelease:false,loadable:true,requires:[]};
const entry={sourceId:'community',display:'Community registry',tier:'community',id:'io.github.ada.tidepool',type:'world',name:'Tidepool',
 summary:'A shore',description:null,creator:'ada',repo:'https://github.com/ada/tidepool-world',tags:['water'],latest:version,licenceNote:'declared',
 thumbnail:null,installed:{tag:'v1.1.0',sourceId:'community'},update:'v1.2.0',versions:[version]};

test('IPC 0.32 content state, jobs and listings',()=>{
 const delta=v=>validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'s',sessionId:'session',baseRevision:0,revision:1,changes:{content:v}}},undefined,'0.32');
 const content={revision:7,installs:[install],updates:1,sources:[source],jobs:[job,{...job,jobId:'j-41f1',kind:'source.refresh',stage:'failed',target:null,plan:null,
  error:{rule:'fetch.failed',message:'timed out'}}]};
 assert.ok(res('sources.list',{sources:[source]}));
 assert.ok(res('registry.list',{entries:[entry],cursor:null}));assert.ok(res('registry.list',{entries:[],cursor:'50'}));
 assert.ok(res('registry.entry',{entry,installed:install}));assert.ok(res('registry.entry',{entry,installed:null}));
 assert.ok(!res('registry.entry',{entry:{...entry,tier:'other'},installed:null}));
 assert.ok(!res('sources.list',{sources:[{...source,kind:'ftp'}]}));
 const r=delta(content);assert.ok(r.valid,JSON.stringify(r.errors?.slice(0,3)));
 assert.equal(delta({...content,jobs:[{...job,stage:'pending'}]}).valid,false,'no pending swaps in 0.32');
 assert.equal(validate('ipc',{jsonrpc:'2.0',method:'state.delta',params:{subscriptionId:'s',sessionId:'session',baseRevision:0,revision:1,changes:{content}}},undefined,'0.31').valid,false,'0.31 has no content key');
});
