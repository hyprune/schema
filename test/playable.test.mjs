import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate} from '../lib/validate.mjs';
const base=()=>({...JSON.parse(readFileSync(new URL('../examples/world.json',import.meta.url))),formatVersion:'0.6'});
const box={type:'box',min:[-10,0,-10],max:[10,8,10]};
const hull={type:'convex',points:[[0,0,0],[4,0,0],[0,4,0],[0,0,4]]};
const valid=w=>validate('world',w,undefined,'0.6').valid;
test('world 0.6 playable bounds and declared far cards; older versions frozen',()=>{
 const w=base();w.playable={volumes:[box,hull],maxFlyHeight:7};w.backdrop={farCards:[0,2]};
 assert.equal(valid(w),true);
 assert.equal(valid(base()),true);
 assert.equal(validate('world',{...w,formatVersion:'0.5'},undefined,'0.5').valid,false);
 for(const playable of [{},{volumes:[]},{volumes:[{...box,max:box.min}]},{volumes:[{...hull,points:[[0,0,0],[1,0,0],[0,1,0],[1,1,0]]}]},{maxFlyHeight:100001},{volumes:[{...box,extra:true}]}])
  assert.equal(valid({...w,playable}),false,JSON.stringify(playable));
 for(const backdrop of [{farCards:[-1]},{farCards:[1,1]},{farCards:[1.5]},{farCards:[],extra:true}]) assert.equal(valid({...w,backdrop}),false);
});
