import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const req=(method,params)=>({jsonrpc:'2.0',id:'test',method,params});
test('0.7 publishes the exact shell graphics contract',()=>{
 const published=JSON.parse(readFileSync(new URL('../v0.7/ipc.schema.json',import.meta.url)));
 assert.equal(published.$defs['session.hello.result'].properties.protocol.const,'0.7');
 for(const v of ['0.7','0.8']) {
  assert.equal(validate('ipc',req('graphics.get',{}),undefined,v).valid,true);
  for(const patch of [{quality:'low',sharpen:.35},{msaa:4,bloom:'high',fog:'height'},{render_scale:'auto',target_fps:60},{normal_maps:null}])assert.equal(validate('ipc',req('graphics.set',{patch}),undefined,v).valid,true);
  for(const patch of [{unknown:true},{msaa:8},{target_fps:10},{render_scale:.1},{bloom:true},{sharpen:2}])assert.equal(validate('ipc',req('graphics.set',{patch}),undefined,v).valid,false);
 }
 for(const v of ['0.1','0.2','0.3','0.4','0.5','0.6'])assert.equal(validate('ipc',req('graphics.get',{}),undefined,v).valid,false);
});
test('0.8 hold timing is bounded and does not widen frozen 0.7',()=>{
 const old=JSON.parse(readFileSync(new URL('../v0.7/ipc.schema.json',import.meta.url))).$defs;
 const latest=JSON.parse(readFileSync(new URL('../v0.8/ipc.schema.json',import.meta.url))).$defs;
 assert.equal(old.keymap.properties.holds,undefined);
 assert.equal(latest.keymap.properties.holds.$ref,'#/$defs/inputHolds');
 // Compile the leaf separately so invalid timing cannot hide in a union.
 return import('ajv/dist/2020.js').then(({default:Ajv})=>{
  const check=new Ajv({strict:true}).compile(latest.inputHolds);
  const hold={action:'menu',binding:'Tab[L]',startedAtMs:1234,durationMs:1000};
  assert.equal(check([hold]),true);assert.equal(check([]),true);
  for(const h of [{...hold,durationMs:0},{...hold,startedAtMs:-1},{...hold,progress:.5}])assert.equal(check([h]),false);
 });
});
