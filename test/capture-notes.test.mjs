import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, ipcProtocols} from '../lib/validate.mjs';
const annotate=params=>({jsonrpc:'2.0',id:'n1',method:'capture.annotate',params});
const taken=params=>({jsonrpc:'2.0',method:'capture.taken',params:{sessionId:'s',revision:3,...params}});
const schema=v=>JSON.parse(readFileSync(new URL(`../v${v}/ipc.schema.json`,import.meta.url)));
test('IPC 0.17 capture.annotate is bounded; 0.16 stays frozen',()=>{
 const ok=[{captureId:'capture-1791547507663',note:''},{captureId:'capture-1',note:'Brücke · 橋 · 🌉'},{captureId:'capture-2',note:'é'.repeat(1000)}];
 for(const p of ok){
  assert.equal(validate('ipc',annotate(p),undefined,'0.17').valid,true,JSON.stringify(p).slice(0,80));
  assert.equal(validate('ipc',annotate(p),undefined,'0.16').valid,false);
 }
 const bad=[{captureId:'capture-1',note:'é'.repeat(1001)},{captureId:'capture-1',note:'two\nlines'},{captureId:'capture-1',note:'tab\t'},
  {captureId:'capture-1',note:null},{captureId:'../etc/passwd',note:'x'},{captureId:'capture-1.json',note:'x'},{captureId:'capture-1'},{captureId:'capture-1',note:'x',extra:1}];
 for(const p of bad)assert.equal(validate('ipc',annotate(p),undefined,'0.17').valid,false,JSON.stringify(p).slice(0,80));
 assert.equal(validate('ipc',{jsonrpc:'2.0',id:'n1',result:{revision:4}},'capture.annotate','0.17').valid,true);
});
test('IPC 0.17 capture.taken names the capture and the mode it was taken in',()=>{
 for(const mode of ['world','interactive','focus','cursor','menu'])
  assert.equal(validate('ipc',taken({captureId:'capture-5',timestampMs:5,mode}),undefined,'0.17').valid,true,mode);
 assert.equal(validate('ipc',taken({captureId:'capture-5',timestampMs:5,mode:'typing'}),undefined,'0.17').valid,false);
 assert.equal(validate('ipc',taken({captureId:'capture-5',timestampMs:5,mode:'world'}),undefined,'0.16').valid,false);
});
test('IPC 0.17 inherits every 0.16 definition and is negotiable',()=>{
 const old=schema('0.16'),latest=schema('0.17');
 for(const key of Object.keys(old.$defs))if(key!=='session.hello.result'&&key!=='request'&&key!=='response'&&key!=='notification')assert.deepEqual(latest.$defs[key],old.$defs[key],key);
 const hello=latest.$defs['session.hello.result'].properties;
 assert.equal(hello.protocol.const,'0.17');
 assert.ok(hello.methods.items.enum.includes('capture.annotate')&&hello.events.items.enum.includes('capture.taken'));
 assert.ok(ipcProtocols.includes('0.17'));
});
