import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate,worldFormats,atLeast,worldLimits} from '../lib/validate.mjs';
const read=name=>JSON.parse(readFileSync(new URL(`../examples/${name}.json`,import.meta.url)));
const as=(w,v)=>({...w,formatVersion:v});
// RFC-0011 world 0.9: two characters on a route (a seat stop), a standing character with
// a permanent seat, every allowed interaction type, keepClear, dir/library/inline assets.
const world09=()=>read('world-npcs');
const resident=()=>read('object-character');
const supplied=()=>({resident:resident(),porter:{...resident(),id:'porter'}});
const check=(w,options)=>validate('world',w,undefined,w.formatVersion,options);
const errors=(w,options)=>check(w,options).errors.join('\n');
const edit=(fn,w=world09())=>{fn(w);return w;};
const obj=(w,id)=>w.objects.find(o=>o.id===id);
const path=(w,id)=>w.paths.find(p=>p.id===id);
const asset=(w,id)=>w.objectAssets.find(a=>a.id===id);

test('world 0.9 is a listed format and accepts the example',()=>{
  assert.ok(worldFormats.includes('0.9'));
  assert.deepEqual(check(world09()),{valid:true,errors:[]});
  assert.deepEqual(check(world09(),{assets:supplied()}),{valid:true,errors:[]});
  const w=world09();
  assert.equal(w.objects.filter(o=>o.path).length,2);
  assert.deepEqual(new Set(w.objects.flatMap(o=>(o.interactions||[]).map(i=>i.action.type))),new Set(['say','waypoint','guide','panel']));
  assert.ok(w.paths[0].stops.some(s=>s.seat)&&obj(w,'reader').seat&&w.keepClear.length);
  assert.deepEqual(worldLimits,{characters:16,charactersPerPath:8,pathPoints:1024,arcChord:0.1});
});

test('world 0.9 inherits every 0.8 document; 0.8 and older reject each new field',()=>{
  const assets=[{id:'armillary',scene:'objects/armillary.gltf',animations:[{node:'ring',type:'spin',axis:[1,0,0],pivot:[0,0,0],period:20}],collision:{node:'proxy'},lighting:{mode:'probe'}}];
  const w8={...as(read('world'),'0.8'),objectAssets:assets,objects:[{id:'a1',asset:'armillary',pose:{position:[4,0,-6],rotation:[0,0,0,1]},scale:2,speed:1,phase:0,ambient:[0.3,0.3,0.3]}]};
  w8.playable={volumes:[{type:'box',min:[-10,0,-10],max:[10,8,10]}],maxFlyHeight:7};
  assert.equal(check(w8).valid,true);
  assert.deepEqual(check(as(w8,'0.9')),{valid:true,errors:[]});
  const ex=world09(),pose={position:[0,0,0],rotation:[0,0,0,1]};
  const extras=[{paths:ex.paths},{seats:ex.seats},{keepClear:ex.keepClear},
    {objectAssets:[{id:'r',dir:'characters/r'}]},{objectAssets:[{id:'r',library:'com.hyprune.starter@0.1.0',object:'porter'}]},
    {objectAssets:[{...assets[0],traits:{movable:{}}}]},{objectAssets:[{...assets[0],slots:{spawns:[{id:'s',pose}]}}]}];
  for(const f of ['path','reverse','seat','accent','interactions','locked']){
    const value={path:'p',reverse:true,seat:'s',accent:[1,1,1],interactions:[{id:'t',label:'T',action:{type:'say',lines:['x']}}],locked:true}[f];
    extras.push({objectAssets:assets,objects:[{id:'a1',asset:'armillary',pose,[f]:value}]});
  }
  for(const v of worldFormats.filter(v=>!atLeast(v,'0.9')))
    for(const extra of extras) assert.equal(validate('world',{...as(read('world'),v),...extra},undefined,v).valid,false,`${v} ${JSON.stringify(extra).slice(0,60)}`);
  assert.equal(validate('world',world09(),undefined,'0.8').valid,false);
});

test('asset sources: exactly one, closed shapes, library pattern',()=>{
  const bad=(fn,label)=>assert.equal(check(edit(fn)).valid,false,label);
  bad(w=>asset(w,'resident').scene='a.glb','dir and scene');
  bad(w=>asset(w,'resident').lighting={mode:'unlit'},'dir takes no other fields');
  bad(w=>asset(w,'resident').dir='characters/resident/','no trailing slash');
  bad(w=>asset(w,'resident').dir='../resident','package-relative');
  bad(w=>asset(w,'porter').scene='a.glb','library and scene');
  bad(w=>delete asset(w,'porter').object,'library needs object');
  bad(w=>asset(w,'porter').object='Porter','object is a slug');
  bad(w=>asset(w,'porter').library='com.hyprune.starter','library needs a version');
  bad(w=>asset(w,'porter').dir='x','library and dir');
  bad(w=>{w.objectAssets.push({id:'empty'});},'a source is required');
  bad(w=>{w.objectAssets=Array.from({length:33},(_,i)=>({id:`a${i}`,dir:`o/a${i}`}));w.objects=[];},'at most 32 assets of any source');
  bad(w=>asset(w,'guide').traits.character.clips.walk.speed=0,'inline trait shapes are object.json 0.9 shapes');
  bad(w=>asset(w,'guide').traits.character.interactions=[{id:'g',label:'Go',action:{type:'guide',path:'to-desk'}}],'asset-level interactions: say and panel only');
  assert.match(errors(edit(w=>asset(w,'porter').library='starter@0.1')),/library must be <reverse-domain id>@<semver>, is starter@0.1/);
  assert.equal(check(edit(w=>asset(w,'porter').library='com.hyprune.starter@1.2.0-rc.1')).valid,true);
});

test('inline traits: shorthand or trait, combinations, reserved traits with a plain reason',()=>{
  assert.match(errors(edit(w=>asset(w,'fountain').traits={decorative:{animations:asset(w,'fountain').animations}})),/objectAssets fountain: animations is shorthand for traits.decorative; give one form/);
  assert.match(errors(edit(w=>asset(w,'court-bench').traits.collidable={node:'proxy'})),/objectAssets court-bench: collision is shorthand for traits.collidable; give one form/);
  assert.equal(check(edit(w=>{const a=asset(w,'fountain');a.traits={decorative:{animations:a.animations},collidable:{node:'base'}};delete a.animations;})).valid,true);
  assert.match(errors(edit(w=>asset(w,'fountain').traits={collidable:{node:'spray'}})),/objectAssets fountain: collision node "spray" is animated/);
  assert.match(errors(edit(w=>asset(w,'guide').traits.movable={})),/objectAssets guide: traits: character and movable can't be combined/);
  assert.match(errors(edit(w=>asset(w,'fountain').traits={character:asset(w,'guide').traits.character})),/objectAssets fountain: traits: character and decorative can't be combined/);
  assert.match(errors(edit(w=>asset(w,'court-bench').traits.seat.capacity=3)),/objectAssets court-bench: traits.seat: capacity exceeds the number of anchors/);
  assert.match(errors(edit(w=>asset(w,'court-bench').traits.seat.anchors[1].id='left')),/objectAssets court-bench: traits.seat anchors: duplicate id/);
  assert.match(errors(edit(w=>asset(w,'court-bench').traits.movable.scale=[1.5,2])),/traits.movable: scale must be/);
  for(const [name,why] of [['mover',/needs world format 0.10/],['machine',/RFC-0013/],['mount',/hold a window/],['interactive',/use actions/]]){
    const result=check(edit(w=>asset(w,'court-bench').traits[name]={}));
    assert.equal(result.valid,false,name);
    assert.match(result.errors[0],new RegExp(`objectAssets court-bench: traits.${name}: .*rejected in world 0.9`));
    assert.match(result.errors[0],why);
    assert.ok(!result.errors.some(e=>e.startsWith('/objectAssets/3')),'the reason replaces the unmatched alternatives');
  }
});

test('objects: pose and path exclusive, binding fields, character-only and movable-only fields',()=>{
  assert.match(errors(edit(w=>obj(w,'porter-1').pose={position:[0,0,0],rotation:[0,0,0,1]})),/objects porter-1: pose and path are exclusive/);
  assert.match(errors(edit(w=>delete obj(w,'reader').pose)),/objects reader: pose is required unless path is set/);
  assert.match(errors(edit(w=>obj(w,'reader').reverse=true)),/objects reader: reverse needs a path/);
  assert.match(errors(edit(w=>obj(w,'porter-1').seat='fountain-ledge')),/objects porter-1: seat is for characters without a path/);
  assert.match(errors(edit(w=>obj(w,'porter-1').path='garden-walk')),/objects porter-1: path garden-walk is not a route \(use generic\)/);
  assert.match(errors(edit(w=>obj(w,'porter-1').path='nowhere')),/objects porter-1: unknown path nowhere/);
  // Character-only fields on an asset known not to be a character (inline, or a supplied object.json).
  for(const [field,value] of [['accent',[1,1,1]],['interactions',[{id:'t',label:'T',action:{type:'say',lines:['x']}}]],['seat','fountain-ledge']])
    assert.match(errors(edit(w=>obj(w,'fountain-1')[field]=value)),new RegExp(`objects fountain-1: ${field} is for characters; asset fountain is not a character`));
  const routed=edit(w=>{delete obj(w,'fountain-1').pose;obj(w,'fountain-1').path='court-loop';});
  assert.match(errors(routed),/objects fountain-1: path is for characters/);
  const bench={...read('object-seat'),id:'resident'};
  assert.match(errors(world09(),{assets:{resident:bench}}),/objects reader: seat is for characters; asset resident is not a character/);
  assert.equal(check(world09(),{assets:{}}).valid,true,'unknown dir assets skip the trait checks');
  assert.match(errors(edit(w=>obj(w,'guide-1').scale=1.2)),/objects guide-1: a character's scale must be 1/);
  assert.match(errors(edit(w=>obj(w,'reader').scale=2),{assets:supplied()}),/objects reader: a character's scale must be 1/);
  assert.match(errors(edit(w=>obj(w,'fountain-1').locked=true)),/objects fountain-1: locked is for movable assets/);
  assert.match(errors(edit(w=>obj(w,'reader').locked=false),{assets:supplied()}),/objects reader: locked is for movable assets/);
  // Supplied manifests: the object format may not be newer than the world, library objects match.
  assert.match(errors(world09(),{assets:{resident:{...resident(),formatVersion:'0.10'}}}),/objectAssets resident: object format 0.10 is newer than the world's 0.9/);
  assert.match(errors(world09(),{assets:{porter:resident()}}),/objectAssets porter: the supplied object.json is resident, not porter/);
  // Shapes.
  const bad=(fn,label)=>assert.equal(check(edit(fn)).valid,false,label);
  bad(w=>obj(w,'porter-1').accent=[1.2,0,0],'accent 0..1');
  bad(w=>obj(w,'porter-1').accent=[1,0],'accent rgb');
  bad(w=>obj(w,'porter-1').reverse='yes','reverse boolean');
  bad(w=>obj(w,'reader').seat='Bench/Left','seat ref');
  bad(w=>obj(w,'reader').seat='a/b/c','seat ref depth');
  bad(w=>obj(w,'porter-1').interactions=[],'1..8 interactions');
  bad(w=>obj(w,'porter-1').interactions=Array.from({length:9},(_,i)=>({id:`t${i}`,label:'T',action:{type:'say',lines:['x']}})),'at most 8 interactions');
  bad(w=>obj(w,'bench-east').locked='no','locked boolean');
  bad(w=>{w.objects=Array.from({length:257},(_,i)=>({id:`o${i}`,asset:'fountain',pose:{position:[0,0,0],rotation:[0,0,0,1]}}));},'at most 256 objects');
});

test('interactions: allowed types and shapes, travel and quest reserved, references',()=>{
  const bad=(fn,label)=>assert.equal(check(edit(fn)).valid,false,label);
  const talk=w=>obj(w,'porter-1').interactions[0];
  bad(w=>talk(w).label='x'.repeat(33),'label at most 32');
  bad(w=>talk(w).label='Talk\n','label printable');
  bad(w=>talk(w).prompt='x'.repeat(65),'prompt at most 64');
  bad(w=>talk(w).action.lines=Array(9).fill('x'),'at most 8 lines');
  bad(w=>talk(w).action.lines=['x'.repeat(161)],'lines at most 160');
  bad(w=>talk(w).action.lines=[],'at least one line');
  bad(w=>talk(w).action={type:'waypoint',target:{zoneId:'work',position:[0,0,0]}},'one waypoint target');
  bad(w=>talk(w).action={type:'waypoint',target:{marker:'m'}},'waypoint target kinds');
  bad(w=>talk(w).action={type:'guide'},'guide needs a path');
  bad(w=>talk(w).action={type:'panel',panel:'Map'},'panel slug');
  bad(w=>talk(w).action={type:'say',lines:['x'],panel:'map'},'closed actions');
  bad(w=>talk(w).extra=1,'closed interactions');
  for(const action of [{type:'travel',path:'to-desk'},{type:'quest',quest:'lost-signal',step:'find-relay'}]){
    const result=check(edit(w=>talk(w).action=action));
    assert.equal(result.valid,false,action.type);
    assert.match(result.errors[0],new RegExp(`objects porter-1 interaction talk: ${action.type} is reserved .*rejected in world 0.9`));
    assert.ok(!result.errors.some(e=>e.startsWith('/objects/2/interactions/0/action')));
  }
  assert.match(errors(edit(w=>obj(w,'porter-1').interactions[1].id='talk')),/objects porter-1 interactions: duplicate id/);
  assert.match(errors(edit(w=>obj(w,'porter-1').interactions[2].action.path='garden-walk')),/interaction show-desk: path garden-walk is not a route/);
  assert.match(errors(edit(w=>obj(w,'porter-1').interactions[2].action.path='nowhere')),/interaction show-desk: unknown path nowhere/);
  assert.match(errors(edit(w=>obj(w,'porter-1').interactions[1].action.target={zoneId:'play'})),/interaction where: unknown zone play/);
  assert.match(errors(edit(w=>obj(w,'porter-1').interactions[1].action.target={anchor:'wall'})),/interaction where: unknown anchor wall/);
  assert.match(errors(edit(w=>obj(w,'reader').interactions[0].action.target={object:'statue'})),/interaction fountain: unknown object statue/);
  assert.equal(check(edit(w=>obj(w,'porter-1').interactions[1].action.target={position:[1,0,2]})).valid,true);
});

test('paths: shape, limits, stop rules per use, arc chord, total points',()=>{
  const bad=(fn,label)=>assert.equal(check(edit(fn)).valid,false,label);
  bad(w=>path(w,'to-desk').points.pop(),'at least 2 points');
  bad(w=>path(w,'to-desk').points=Array.from({length:257},(_,i)=>({position:[i,0,0],type:'line'})),'at most 256 points');
  bad(w=>path(w,'to-desk').points[0].type='spline','point type');
  bad(w=>path(w,'to-desk').use='rail','use');
  bad(w=>path(w,'to-desk').speed=0.05,'speed 0.1..30');bad(w=>path(w,'to-desk').speed=31,'speed 0.1..30');
  bad(w=>path(w,'to-desk').name='','name 1..64');bad(w=>path(w,'to-desk').name='x'.repeat(65),'name 1..64');
  bad(w=>path(w,'court-loop').stops=Array.from({length:33},()=>({point:0})),'at most 32 stops');
  bad(w=>path(w,'court-loop').stops[0].seconds=0.4,'seconds 0.5..600');
  bad(w=>path(w,'court-loop').stops[0].seconds=601,'seconds 0.5..600');
  bad(w=>path(w,'court-loop').stops[0].clip='dance','clip');
  bad(w=>path(w,'court-loop').stops[0].point=-1,'point >= 0');
  bad(w=>path(w,'court-loop').stops[2].face={anchor:'desk',object:'fountain-1'},'one face target');
  bad(w=>path(w,'court-loop').stops[0].face={anchor:'desk'},'at most one of clip, face and seat');
  bad(w=>path(w,'court-loop').stops[1].clip='nod','seat and clip');
  bad(w=>path(w,'court-loop').stops[2].seat='fountain-ledge','face and seat');
  bad(w=>path(w,'court-loop').stops[0].source='x','track fields wait for 0.10');
  bad(w=>{w.paths=Array.from({length:65},(_,i)=>({id:`p${i}`,points:[{position:[0,0,0],type:'line'},{position:[1,0,0],type:'line'}]}));},'at most 64 paths');
  // Per use: generic paths have no stops; track stops only point and seconds.
  bad(w=>path(w,'garden-walk').stops=[{point:0}],'generic paths have no stops');
  bad(w=>{path(w,'garden-walk').use='generic';path(w,'garden-walk').stops=[{point:0,seconds:2}];},'explicit generic');
  assert.equal(check(edit(w=>path(w,'garden-walk').stops=[])).valid,true,'an empty list is fine');
  assert.equal(check(edit(w=>{const p=path(w,'garden-walk');p.use='track';p.stops=[{point:1,seconds:5}];})).valid,true,'track stops: point and seconds');
  bad(w=>{const p=path(w,'garden-walk');p.use='track';p.stops=[{point:1,clip:'wave'}];},'track stops take no clip');
  bad(w=>{const p=path(w,'garden-walk');p.use='track';p.stops=[{point:1,seat:'fountain-ledge'}];},'track stops take no seat');
  // Semantic.
  assert.match(errors(edit(w=>path(w,'to-desk').id='court-loop')),/paths: duplicate id/);
  assert.match(errors(edit(w=>path(w,'court-loop').stops[0].point=4)),/paths court-loop stop 4: the path has 4 points/);
  assert.match(errors(edit(w=>path(w,'court-loop').stops[1].point=1)),/paths court-loop: more than one stop at point 1/);
  assert.match(errors(edit(w=>path(w,'court-loop').stops[2].face={anchor:'board'})),/paths court-loop stop 3: unknown anchor board/);
  assert.match(errors(edit(w=>path(w,'court-loop').stops[2].face={object:'statue'})),/paths court-loop stop 3: unknown object statue/);
  assert.equal(check(edit(w=>path(w,'court-loop').stops[2].face={position:[0,1,0]})).valid,true);
  // Arc chord: the arriving segment's horizontal chord; a closed path's first point closes the loop.
  assert.match(errors(edit(w=>path(w,'court-loop').points[3].position=[3.05,2,-2])),/paths court-loop point 3: an arc needs a horizontal chord of at least 0.1 m/);
  assert.equal(check(edit(w=>path(w,'to-desk').points[0].type='arc')).valid,true,'an open path ignores its first point type');
  assert.match(errors(edit(w=>{const p=path(w,'court-loop');p.points[0]={position:[3.02,0,3.05],type:'arc'};})),/paths court-loop point 0: an arc needs/);
  // 1,024 points in total.
  const many=n=>Array.from({length:n},(_,i)=>({position:[i,0,0],type:'line'}));
  // The example has 8 points; four more paths bring it to 1,024 and one point more fails.
  const total=last=>w=>{w.paths.push(...[254,254,254,last].map((n,i)=>({id:`long-${i}`,points:many(n)})));};
  assert.equal(check(edit(total(254))).valid,true,'1,024 points pass');
  assert.match(errors(edit(total(255))),/paths: 1025 points in total, more than 1024/);
});

test('seats and keepClear: shapes, references, ordering',()=>{
  const bad=(fn,label)=>assert.equal(check(edit(fn)).valid,false,label);
  bad(w=>w.seats[0].height=0.1,'height 0.2..1');bad(w=>w.seats[0].height=1.1,'height 0.2..1');
  bad(w=>w.seats[0].approach=0.2,'approach 0.3..2');bad(w=>w.seats[0].approach=2.5,'approach 0.3..2');
  bad(w=>w.seats[0].use=['lean'],'use sit only');
  bad(w=>w.seats[0].yaw=0,'world seats use a pose');
  bad(w=>{w.seats=Array.from({length:65},(_,i)=>({...w.seats[0],id:`s${i}`}));},'at most 64 seats');
  bad(w=>w.keepClear[0].min=[0,0],'vec3');
  bad(w=>{w.keepClear=Array.from({length:65},(_,i)=>({...w.keepClear[0],id:`k${i}`}));},'at most 64 boxes');
  assert.match(errors(edit(w=>w.seats.push({...w.seats[0]}))),/seats: duplicate id/);
  assert.match(errors(edit(w=>w.seats[0].pose.rotation=[0,0,0,2])),/seats fountain-ledge: quaternion must be normalized/);
  assert.match(errors(edit(w=>w.keepClear.push({...w.keepClear[0]}))),/keepClear: duplicate id/);
  assert.match(errors(edit(w=>w.keepClear[0].max[1]=0)),/keepClear north-door: min must be below max on every axis/);
  // Seat references: a world seat id, else <objectId>[/<anchorId>]; anchors when the asset is known.
  assert.match(errors(edit(w=>obj(w,'reader').seat='ledge')),/objects reader seat: unknown seat ledge/);
  assert.match(errors(edit(w=>obj(w,'reader').seat='bench-east/middle')),/objects reader seat: seat bench-east has no anchor middle/);
  assert.equal(check(edit(w=>obj(w,'reader').seat='bench-east')).valid,true,'any free anchor');
  assert.match(errors(edit(w=>obj(w,'reader').seat='fountain-1')),/objects reader seat: object fountain-1 is not a seat/);
  assert.match(errors(edit(w=>path(w,'court-loop').stops[1].seat='bench-west/left')),/paths court-loop stop 2: unknown seat bench-west\/left/);
  assert.match(errors(edit(w=>path(w,'court-loop').stops[1].seat='bench-east/back')),/paths court-loop stop 2: seat bench-east has no anchor back/);
  // A dir seat asset: anchors are checked only with its object.json.
  const dirSeat=w=>{w.objectAssets.push({id:'bench',dir:'objects/bench'});w.objects.push({id:'bench-west',asset:'bench',pose:{position:[-3,0,0],rotation:[0,0,0,1]}});path(w,'court-loop').stops[1].seat='bench-west/middle';};
  assert.equal(check(edit(dirSeat)).valid,true);
  assert.match(errors(edit(dirSeat),{assets:{bench:read('object-seat')}}),/seat bench-west has no anchor middle/);
  // A world seat id wins over an object of the same id.
  assert.equal(check(edit(w=>{w.seats[0].id='fountain-1';obj(w,'reader').seat='fountain-1';})).valid,true);
});

test('character limits: 16 instances when assets are known, 8 per path',()=>{
  const standing=(n,asset='guide')=>Array.from({length:n},(_,i)=>({id:`c${i}`,asset,pose:{position:[i,0,0],rotation:[0,0,0,1]}}));
  // porter-1 and guide-1 are characters (guide inline; porter has a path); reader is unknown without its object.json.
  assert.equal(check(edit(w=>w.objects.push(...standing(14)))).valid,true);
  assert.match(errors(edit(w=>w.objects.push(...standing(15)))),/objects: 17 character instances, more than 16/);
  assert.match(errors(edit(w=>w.objects.push(...standing(14))),{assets:supplied()}),/objects: 17 character instances, more than 16/);
  assert.equal(check(edit(w=>w.objects.push(...standing(20,'fountain')))).valid,true,'other objects do not count');
  const walkers=n=>Array.from({length:n},(_,i)=>({id:`w${i}`,asset:'guide',path:'to-desk',phase:i/10}));
  assert.equal(check(edit(w=>w.objects.push(...walkers(8)))).valid,true);
  assert.match(errors(edit(w=>w.objects.push(...walkers(9)))),/paths to-desk: 9 characters, more than 8/);
});

test('asset glTF 0.9: trait-form animations and proxy, inline characters, dir and library assets',()=>{
  const w=edit(w=>{const a=asset(w,'fountain');a.traits={decorative:{animations:a.animations},collidable:{node:'proxy'}};delete a.animations;});
  const fountain={asset:{version:'2.0'},meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{name:'base',mesh:0,children:[1]},{name:'spray',mesh:0},{name:'proxy',mesh:0}]};
  const scene=(g,id,world=w)=>validate('scene',g,undefined,'0.9',{world,asset:id});
  assert.deepEqual(scene(fountain,'fountain'),{valid:true,errors:[]});
  const carried=structuredClone(fountain);carried.nodes[1].children=[2];
  assert.match(scene(carried,'fountain').errors.join(),/collision node "proxy" is inside animated node "spray"/);
  const guide={asset:{version:'2.0'},nodes:[{name:'root'}],skins:[{joints:[0]}],animations:['walk','idle','wave','nod','sit','sit_idle'].map(name=>({name,channels:[],samplers:[]}))};
  assert.deepEqual(scene(guide,'guide'),{valid:true,errors:[]});
  const unskinned={...guide,skins:[],animations:guide.animations.slice(1)};
  assert.match(scene(unskinned,'guide').errors.join('\n'),/objectAssets guide: traits.character: the glTF has no skin/);
  assert.match(scene(unskinned,'guide').errors.join('\n'),/clip "walk" not found/);
  assert.match(scene(guide,'resident').errors.join(),/objectAssets resident: not an inline glTF asset; check its object.json with kind object/);
  assert.match(scene(guide,'porter').errors.join(),/not an inline glTF asset/);
});
