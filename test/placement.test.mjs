import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const config=JSON.parse(readFileSync(new URL('../examples/placement-input.json',import.meta.url)));
test('IPC 0.15 placement bindings, older keymaps frozen',()=>{
 const request={jsonrpc:'2.0',id:'1',method:'input.preview',params:{config}};
 assert.equal(validate('ipc',request,undefined,'0.15').valid,true);
 assert.equal(validate('ipc',request,undefined,'0.14').valid,false);
 const bad=structuredClone(request);bad.params.config.modes.world['placement.return']=['MMB'];
 assert.equal(validate('ipc',bad,undefined,'0.15').valid,false);
});
test('IPC 0.15 retains all previous method and event contracts',()=>{
 const prior=JSON.parse(readFileSync(new URL('../v0.14/ipc.schema.json',import.meta.url))).$defs;
 const next=JSON.parse(readFileSync(new URL('../v0.15/ipc.schema.json',import.meta.url))).$defs;
 for(const key of Object.keys(prior)) assert.ok(next[key],key);
 assert.ok(next.editor.required.includes('unplaced'));
 assert.ok(next.editor.required.includes('contentScale'));
});

test('tool slot and pocket metadata are bounded and reject unknown fields',async()=>{
 const {default:Ajv}=await import('ajv/dist/2020.js');
 const defs=JSON.parse(readFileSync(new URL('../v0.15/ipc.schema.json',import.meta.url))).$defs;
 const selected=Object.fromEntries(['toolSlot','toolSlots','toolDefinition','unplaced','contentScaleFeedback'].map(k=>[k,defs[k]]));
 const ajv=new Ajv({strict:false});
 const slots=ajv.compile({$defs:selected,$ref:'#/$defs/toolSlots'});
 assert.ok(slots({primary:{action:'client.primary',label:'Click'},secondary:null,alternate:null,cycle:null}));
 assert.ok(!slots({primary:null,secondary:null,alternate:null,cycle:{label:'Missing action'}}));
 const pocket=ajv.compile({$defs:selected,$ref:'#/$defs/unplaced'});
 assert.ok(pocket({count:1,windows:[{surfaceId:'one',title:'Terminal',appClass:'kitty',logicalSize:[640,480]}],selectedId:'one',preview:true}));
 assert.ok(!pocket({count:1,windows:[],selectedId:null,preview:true,canReturn:true}));
});

test('latest HUD inherits earlier contracts and permits Placement in every tool event',async()=>{
 const {default:Ajv}=await import('ajv/dist/2020.js');
 const current=JSON.parse(readFileSync(new URL('../v0.15/ipc.schema.json',import.meta.url))).$defs;
 const prior=JSON.parse(readFileSync(new URL('../v0.14/ipc.schema.json',import.meta.url))).$defs;
 assert.equal(current['hud.pose.params'].properties.tool.maximum,5);
 assert.equal(current['tool.changed.params'].properties.slot.maximum,5);
 assert.equal(prior['hud.pose.params'].properties.tool.maximum,4);
 const check=new Ajv({strict:false}).compile(current.toolInput);
 assert.ok(check({modifiers:65,override:true,gestures:[{action:'content.scale',label:'Content scale',bindings:['Super+Shift+Wheel']}]}));
 assert.ok(!check({modifiers:256,override:true,gestures:[]}));
});
