import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';

// IPC 0.31 (draft) data-driven behaviours: objects.configure patch behaviours, the instance
// summary, and builder project 0.2 placement behaviours (with the validator's rules).
const req=(method,params)=>({jsonrpc:'2.0',id:'b1',method,params});
const ok=(params,v='0.31')=>validate('ipc',req('objects.configure',params),undefined,v).valid;
const height={key:'height',property:'scale',input:{source:'com.hyprune.sources.cpu',key:'value',min:0,max:100},from:[1,0.1,1],to:[1,3,1],anchor:'bottom',easing:'ease-out',smoothing:0.3};
const all=[height,{key:'slide',property:'move',from:[0,0,0],to:[0,2,0]},{key:'turn',property:'rotate',anchor:'centre',from:[0,0,0],to:[0,90,0]},
 {key:'tint',property:'colour',from:'#204060',to:'#ff8000'},{key:'lamp',property:'glow',from:0,to:8,colour:'#30e0ff'},
 {key:'warn',property:'visible',above:80},{key:'belt',property:'texture',mode:'scroll',from:[0,0],to:[1,0]}];

test('objects.configure patch behaviours: each property, 8 at most; 0.30 refuses it',()=>{
 assert.ok(ok({key:'tower',patch:{behaviours:all}}));
 assert.ok(ok({id:'u-1a2b3c',patch:{behaviours:[]}}));
 for(const bad of [{...height,property:'spin'},{...height,from:[1,0,1]},{...height,anchor:'middle'},{key:'warn',property:'visible',above:80,from:0},
  {key:'tint',property:'colour',from:'#FFF',to:'#000000'},{key:'lamp',property:'glow',from:0,to:20},{key:'belt',property:'texture',from:[0,0,0],to:[1,0,0]},
  {...height,input:{source:'Not An Id'}},{...height,key:'Height'},{property:'scale',from:[1,1,1],to:[1,1,1]}])
  assert.ok(!ok({key:'tower',patch:{behaviours:[bad]}}),JSON.stringify(bad));
 assert.ok(!ok({key:'tower',patch:{behaviours:Array.from({length:9},(_,i)=>({...height,key:'h'+i}))}}));
 assert.ok(!ok({id:'u-1a2b3c',patch:{behaviours:[height]}},'0.30'));
});

test('instances report their behaviours (null without any)',()=>{
 const d=JSON.parse(readFileSync(new URL('../v0.31/ipc.schema.json',import.meta.url))).$defs;
 assert.ok(d.objectInstance.required.includes('behaviours'));
 assert.deepEqual(d.behaviourState.required,['key','property','condition','value','t']);
 assert.deepEqual(d.behaviourState.properties.condition.enum,['fresh','stale','missing','error']);
 assert.ok(!('behaviours' in JSON.parse(readFileSync(new URL('../v0.30/ipc.schema.json',import.meta.url))).$defs.objectInstance.properties));
});

test('project 0.2 placements carry behaviours; keys unique, min != max, visible needs a threshold',()=>{
 const base={projectVersion:'0.2',id:'local.garden',name:'Garden',starter:'open-plain@0.2',base:'builder/base.json',
  sky:{image:'sky/panorama.jpg',preset:'sunset',license:'CC0-1.0',author:'a',source:'b'},placements:[]};
 const pose={position:[0,0,0],rotation:[0,0,0,1]};
 const p=behaviours=>({...base,placements:[{id:'u-000001',ref:'world/box-1a2b3c4d5e',pose,scale:1,key:'tower',behaviours}]});
 assert.deepEqual(validate('project',p(all)).errors,[]);
 assert.ok(validate('project',p([height,height])).errors.some(e=>e.includes('used twice')));
 assert.ok(validate('project',p([{...height,input:{min:5,max:5}}])).errors.some(e=>e.includes('differ')));
 assert.ok(validate('project',p([{key:'warn',property:'visible'}])).errors.some(e=>e.includes('threshold')||e.includes('above')));
});
