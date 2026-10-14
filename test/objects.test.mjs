import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validate, objectFormats, worldFormats, objectLimits} from '../lib/validate.mjs';

const example = name => JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url)));
const lantern = () => example('object');
const errors = (kind, doc, options, version) => validate(kind, doc, undefined, version, options).errors;
const rejects = (kind, doc, pattern, options, version) => {
  const result = validate(kind, doc, undefined, version, options);
  assert.equal(result.valid, false, `expected ${pattern}`);
  assert.ok(result.errors.some(e => pattern.test(e)), `${pattern} not in ${JSON.stringify(result.errors)}`);
};
// A glTF for the lantern: post (box 0.5 x 2.4 x 0.5 from the floor), flame, glass and an off-scene proxy.
function lanternGltf() {
  const box = (min, max, count = 36) => ({componentType: 5126, type: 'VEC3', count, min, max});
  return {
    asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}],
    nodes: [
      {name: 'post', mesh: 0, children: [1, 2]},
      {name: 'flame', mesh: 1, translation: [0, 2.2, 0]},
      {name: 'glass', mesh: 2},
      {name: 'proxy', mesh: 3},
    ],
    meshes: [
      {primitives: [{attributes: {POSITION: 0}, material: 0}]},
      {primitives: [{attributes: {POSITION: 1}, material: 1}]},
      {primitives: [{attributes: {POSITION: 2}, material: 2}]},
      {primitives: [{attributes: {POSITION: 3}}]},
    ],
    materials: [{name: 'iron'}, {name: 'flame'}, {name: 'lamp-glass'}],
    accessors: [box([-0.25, 0, -0.25], [0.25, 2.1, 0.25]), box([-0.05, 0, -0.05], [0.05, 0.2, 0.05]),
      box([-0.2, 1.8, -0.2], [0.2, 2.4, 0.2]), box([-0.25, 0, -0.25], [0.25, 2.4, 0.25], 12)],
  };
}

test('object formats are the v0.N directories with an object schema; world formats are unchanged', () => {
  assert.deepEqual(objectFormats, ['0.9', '0.10', '0.11']);
  assert.equal(worldFormats.includes('0.10'), false);
  assert.throws(() => validate('object', lantern(), undefined, '0.8'), /Unknown object format/);
  assert.throws(() => validate('object', lantern(), 'objects.catalog'), /only valid for IPC/);
});

test('examples are valid: objects, a library and a release record', () => {
  for (const name of ['object', 'object-character', 'object-seat', 'object-machine']) assert.deepEqual(errors('object', example(name)), [], name);
  assert.deepEqual(errors('library', example('library')), []);
  assert.deepEqual(errors('library-releases', example('library-releases')), []);
  // The manifest's own formatVersion selects the schema unless a version is given.
  assert.equal(validate('object', example('object-machine'), undefined, '0.9').valid, false);
});

test('manifest shape: required fields, closed objects, ranges', () => {
  for (const field of ['formatVersion', 'id', 'version', 'name', 'category', 'scene', 'license', 'attribution', 'bounds', 'traits']) {
    const doc = lantern(); delete doc[field];
    assert.equal(validate('object', doc, undefined, '0.9').valid, false, field);
  }
  rejects('object', {...lantern(), extra: 1}, /additional properties/);
  rejects('object', {...lantern(), category: 'weapons'}, /allowed values/);
  rejects('object', {...lantern(), tags: Array.from({length: 9}, (_, i) => `t${i}`)}, /more than 8/);
  rejects('object', {...lantern(), name: 'Bad\nname'}, /pattern/);
  rejects('object', {...lantern(), scene: '../object.glb'}, /pattern/);
  rejects('object', {...lantern(), thumbnail: 'thumbnail.jpg'}, /pattern/);
  rejects('object', {...lantern(), license: 'not a licence'}, /invalid SPDX/);
  assert.deepEqual(errors('object', {...lantern(), license: 'LicenseRef-private', attribution: [{path: '.', author: 'Me', license: 'LicenseRef-private'}]}), []);
  rejects('object', {...lantern(), version: '1.0.0-01'}, /leading zeros/);
});

test('reserved and unknown traits reject with a readable reason', () => {
  for (const name of ['machine', 'mover', 'mount', 'interactive']) {
    rejects('object', {...lantern(), traits: {[name]: {}}}, new RegExp(`^traits\\.${name}: .*rejected in object format 0\\.9`));
    assert.deepEqual(errors('object', {...lantern(), traits: {[name]: {}}}).length, 1, `${name}: one message`);
  }
  rejects('object', {...lantern(), formatVersion: '0.8'}, /^formatVersion: "0.8" is not an object format \(0.9, 0.10, 0.11\)$/);
  rejects('object', lantern(), /^formatVersion: "0.9" is not the requested 0.10$/, undefined, '0.10');
  rejects('object', {...lantern(), formatVersion: '0.10', traits: {mount: {}}}, /^traits\.mount: needs object format 0\.11/);
  rejects('object', {...lantern(), traits: {glowing: {}}}, /additional properties/);
  const machine = example('object-machine');
  rejects('object', {...machine, traits: {...machine.traits, mount: {}}}, /^traits\.mount: needs object format 0\.11/);
});

test('trait combinations follow RFC-0011', () => {
  const character = example('object-character');
  rejects('object', {...character, traits: {...character.traits, movable: {}}}, /character and movable can't be combined/);
  const machine = example('object-machine');
  rejects('object', {...machine, traits: {mover: {speed: 1}, collidable: {node: 'proxy'}}}, /collidable and mover can't be combined/);
  assert.deepEqual(errors('object', {...machine, slots: undefined, traits: {mover: {speed: 1, item: true}, decorative: machine.traits.decorative}}), []);
  rejects('object', {...lantern(), traits: {...lantern().traits, seat: {anchors: [{id: 'a', position: [0, 0, 0.5], yaw: 0, height: 0.45}], capacity: 2}}}, /capacity exceeds/);
});

test('origin conventions by support surface', () => {
  const doc = lantern(); doc.bounds.min[1] = 0.1;
  rejects('object', doc, /min y must be 0/);
  const wall = lantern(); wall.traits.movable.surfaces = ['wall'];
  rejects('object', wall, /min z must be 0/);
  wall.bounds = {min: [-0.25, -1, 0], max: [0.25, 1.4, 0.5]}; wall.slots = undefined;
  assert.deepEqual(errors('object', wall), []);
  const ceiling = {...wall, traits: {movable: {surfaces: ['ceiling']}}};
  rejects('object', ceiling, /max y must be 0/);
  assert.deepEqual(errors('object', {...wall, traits: {movable: {surfaces: ['any']}}}), []);
  rejects('object', {...lantern(), bounds: {min: [0, 0, 0], max: [0, 1, 1]}}, /min x must be below max/);
  const feet = example('object-character'); feet.bounds.min[1] = 0.03;
  assert.deepEqual(errors('object', feet), []);
  feet.bounds.min[1] = -0.08;
  rejects('object', feet, /within 0.05 m of 0 \(the feet at the origin\)/);
  rejects('object', {...lantern(), traits: {movable: {scale: [1.5, 2]}}}, /min <= 1 <= max/);
});

test('slots: ids, poses inside the grown bounds, palettes, one source per states slot', () => {
  const far = lantern(); far.slots.labels[0].pose.position = [0, 3.0, 0];
  rejects('object', far, /labels title: lies outside the bounds grown by 0.5 m/);
  const tilted = lantern(); tilted.slots.effects[0].pose.rotation = [0, 0, 0, 2];
  rejects('object', tilted, /quaternion must be normalized/);
  const dup = lantern(); dup.slots.effects.push(dup.slots.effects[0]);
  rejects('object', dup, /slots.effects: duplicate id/);
  const palette = lantern(); palette.slots.states[0].palette.push(palette.slots.states[0].palette[0]);
  rejects('object', palette, /palette: duplicate id/);
  const both = lantern(); both.slots.states[0].nodes = ['glass'];
  rejects('object', both, /must match exactly one schema in oneOf/);
  const tooMany = lantern(); tooMany.slots.labels = Array.from({length: 9}, (_, i) => ({...tooMany.slots.labels[0], id: `l${i}`}));
  rejects('object', tooMany, /more than 8/);
  // 0.10 slot kinds are not part of 0.9.
  rejects('object', {...lantern(), slots: {toggles: [{id: 'flag', nodes: ['flag']}]}}, /additional properties/);
});

test('glTF cross-checks: nodes, materials, variants, scene membership, extensions', () => {
  assert.deepEqual(validate('object', lantern(), undefined, undefined, {gltf: lanternGltf()}), {valid: true, errors: [], warnings: [], triangles: 36});
  const missing = lanternGltf(); missing.nodes[1].name = 'fire';
  rejects('object', lantern(), /node "flame" not found/, {gltf: missing});
  const twice = lanternGltf(); twice.nodes[2].name = 'flame';
  rejects('object', lantern(), /node "flame" is not unique/, {gltf: twice});
  const offScene = lanternGltf(); offScene.nodes[0].children = [2]; offScene.scenes[0].nodes = [0, 3];
  rejects('object', lantern(), /node "flame" is not in the scene/, {gltf: offScene});
  const noGlass = lanternGltf(); noGlass.materials[2].name = 'glass';
  rejects('object', lantern(), /material "lamp-glass" not found/, {gltf: noGlass});
  const shared = lantern(); shared.slots.states.push({id: 'other', materials: ['lamp-glass'], palette: [{id: 'on', colour: [1, 1, 1], emission: 1}]});
  rejects('object', shared, /material "lamp-glass" is also in states slot status/, {gltf: lanternGltf()});
  const proxyAnimated = lantern(); proxyAnimated.traits.decorative.animations[0].node = 'proxy';
  rejects('object', proxyAnimated, /node "proxy" is animated/, {gltf: lanternGltf()});
  const noMesh = lanternGltf(); delete noMesh.nodes[3].mesh;
  rejects('object', lantern(), /collision node "proxy" has no mesh/, {gltf: noMesh});
  const draco = {...lanternGltf(), extensionsRequired: ['KHR_draco_mesh_compression']};
  rejects('object', lantern(), /KHR_draco_mesh_compression is not allowed/, {gltf: draco});
  // KHR_materials_variants: names unique, mappings valid, a states slot's variants are palette ids.
  const variants = lanternGltf();
  variants.extensions = {KHR_materials_variants: {variants: [{name: 'idle'}, {name: 'busy'}, {name: 'night'}]}};
  variants.materials.push({name: 'glass-busy'});
  variants.meshes[2].primitives[0].extensions = {KHR_materials_variants: {mappings: [{material: 3, variants: [1]}]}};
  assert.deepEqual(errors('object', lantern(), {gltf: variants}), []);
  variants.meshes[2].primitives[0].extensions.KHR_materials_variants.mappings.push({material: 2, variants: [2]});
  rejects('object', lantern(), /variant "night" is not a palette id of the slot/, {gltf: variants});
  variants.meshes[2].primitives[0].extensions.KHR_materials_variants.mappings = [{material: 9, variants: [0, 0]}];
  rejects('object', lantern(), /unknown material 9/, {gltf: variants});
  rejects('object', lantern(), /variant 0 is mapped twice/, {gltf: variants});
  // Skins and clips belong to characters.
  rejects('object', lantern(), /only characters may be skinned/, {gltf: {...lanternGltf(), skins: [{joints: [0]}]}});
  assert.match(validate('object', lantern(), undefined, undefined, {gltf: {...lanternGltf(), animations: [{name: 'x', channels: [], samplers: []}]}}).warnings[0], /ignored outside characters/);
});

test('bounds: exact for axis-aligned meshes, a containing box for rotated ones, 1 cm for measured', () => {
  const tall = lantern(); tall.bounds.max[1] = 2.5;
  rejects('object', tall, /max y 2.5 does not match the scene \(2.4\)/, {gltf: lanternGltf()});
  const rotated = lanternGltf(); rotated.nodes[2].rotation = [0, 0.382683, 0, 0.92388];
  const result = validate('object', lantern(), undefined, undefined, {gltf: rotated});
  assert.equal(result.valid, true); assert.match(result.warnings.join(), /containing box only/);
  const wide = lantern(); wide.bounds.max[0] = 0.4;
  rejects('object', wide, /max x 0.4 does not match/, {gltf: rotated});
  const measured = {bounds: {min: [-0.25, 0, -0.25], max: [0.25, 2.395, 0.25]}};
  assert.deepEqual(errors('object', lantern(), {gltf: rotated, measured}), []);
  measured.bounds.max[1] = 2.38;
  rejects('object', lantern(), /max y 2.4 is more than 1 cm from the scene's 2.38/, {measured});
  // Quantised positions: normalized integer min/max are dequantised before the node transform.
  const quantised = lanternGltf();
  Object.assign(quantised.accessors[0], {componentType: 5122, normalized: true, min: [-32767, 0, -32767], max: [32767, 32767, 32767]});
  quantised.nodes[0].scale = [0.25, 2.1, 0.25];
  quantised.nodes[0].children = [];
  quantised.scenes[0].nodes = [0, 1, 2];
  assert.deepEqual(errors('object', lantern(), {gltf: quantised}), []);
});

test('budgets: triangles, proxy, textures, GPU memory, thumbnail, directory files', () => {
  const heavy = lanternGltf(); heavy.accessors[0].count = (objectLimits.triangles + 1) * 3;
  rejects('object', lantern(), /triangles: \d+ exceeds 50000/, {gltf: heavy});
  const proxy = lanternGltf(); proxy.accessors[3].count = 2001 * 3;
  rejects('object', lantern(), /proxy has 2001 triangles/, {gltf: proxy});
  rejects('object', lantern(), /textures: 4096 px exceeds 2048 px/, {measured: {maxTextureSize: 4096}});
  rejects('object', example('object-character'), /textures: 2048 px exceeds 1024 px/, {measured: {maxTextureSize: 2048}});
  rejects('object', lantern(), /gpu: .* exceeds 50331648/, {measured: {gpuBytes: 49 * 1048576}});
  rejects('object', lantern(), /thumbnail: 512 x 512, must be 256 x 256/, {thumbnail: {width: 512, height: 512, bytes: 1000}});
  rejects('object', lantern(), /thumbnail: 300000 bytes/, {thumbnail: {width: 256, height: 256, bytes: 300000}});
  const files = [{path: 'object.json', size: 900}, {path: 'object.glb', size: 1000}, {path: 'thumbnail.png', size: 2000}];
  assert.deepEqual(errors('object', lantern(), {files, directory: 'street-lantern'}), []);
  rejects('object', lantern(), /differs from its directory "lantern"/, {directory: 'lantern'});
  rejects('object', lantern(), /thumbnail: thumbnail.png not found/, {files: files.slice(0, 2)});
  rejects('object', lantern(), /directory: 65 files/, {files: [...files, ...Array.from({length: 62}, (_, i) => ({path: `t${i}.png`, size: 1}))]});
  rejects('object', lantern(), /object.glb exceeds/, {files: [files[0], {path: 'object.glb', size: 33 * 1048576}, files[2]]});
  const narrow = lantern(); narrow.attribution = [{path: 'object.glb', author: 'A', license: 'CC0-1.0'}, {path: 'thumbnail.png', author: 'A', license: 'CC0-1.0'}];
  rejects('object', narrow, /attribution: object.json is not covered/, {files});
});

test('characters: clips, measured speeds against extras.speed, a skin', () => {
  const doc = example('object-character');
  const gltf = {asset: {version: '2.0'}, scenes: [{nodes: [0]}], nodes: [{name: 'root'}], skins: [{joints: [0]}],
    animations: ['walk', 'run', 'idle', 'sit', 'sit_idle'].map(name => ({name, channels: [], samplers: [],
      ...(name === 'walk' ? {extras: {speed: 1.1}} : name === 'run' ? {extras: {speed: 2.9}} : {})}))};
  const result = validate('object', doc, undefined, undefined, {gltf});
  assert.deepEqual(result.errors, []); assert.match(result.warnings.join(), /measured bounds/);
  rejects('object', doc, /clip "walk" speed 1.12 differs from extras.speed 1.05/, {gltf: {...gltf, animations: gltf.animations.map(a => a.name === 'walk' ? {...a, extras: {speed: 1.05}} : a)}});
  rejects('object', doc, /clip "sit" not found/, {gltf: {...gltf, animations: gltf.animations.filter(a => a.name !== 'sit')}});
  rejects('object', doc, /clip "run" has no extras.speed/, {gltf: {...gltf, animations: gltf.animations.map(a => a.name === 'run' ? {name: 'run'} : a)}});
  rejects('object', doc, /has no skin/, {gltf: {...gltf, skins: []}});
  const noWalk = example('object-character'); delete noWalk.traits.character.clips.walk;
  rejects('object', noWalk, /must have required property 'walk'/);
  const guide = example('object-character'); guide.traits.character.interactions.push({id: 'go', label: 'Go', action: {type: 'guide', path: 'loop'}});
  rejects('object', guide, /oneOf/);
  const tall = example('object-character'); tall.traits.character.height = 2.5;
  rejects('object', tall, /must be <= 2.2/);
});

test('machines (0.10 draft): inputs, drives, domains, recipes', () => {
  const machine = () => example('object-machine');
  const m = machine(), drive = (input, target, map) => ({input, target, ...(map ? {map} : {})});
  const withDrives = (...drives) => { const d = machine(); d.traits.machine.drives = drives; return d; };
  assert.deepEqual(errors('object', m), []);
  rejects('object', withDrives(drive('status', 'state:beacon')), /unknown state target "beacon"/);
  rejects('object', withDrives(drive('nope', 'state:lamp')), /unknown input nope/);
  rejects('object', withDrives(drive('status', 'state:lamp', {cases: [{equals: 'x', to: 'broken'}], else: 'idle'})), /"broken" is not a palette id of lamp/);
  rejects('object', withDrives(drive('queued', 'state:lamp')), /needs palette ids/);
  rejects('object', withDrives(drive('queued', 'animation:belt-rollers')), /range 0-64 exceeds 0-10/);
  assert.deepEqual(errors('object', withDrives(drive('queued', 'animation:belt-rollers', {scale: {from: [0, 64], to: [0, 2]}}))), []);
  rejects('object', withDrives(drive('queued', 'animation:belt-rollers', {scale: {from: [0, 64], to: [0, 2]}, clamp: false})), /needs a numeric mapping/);
  rejects('object', withDrives(drive('queued', 'spawn:belt-in')), /needs an event/);
  assert.deepEqual(errors('object', withDrives(drive('queued', 'spawn:belt-in', {counter: true}))), []);
  rejects('object', withDrives(drive('jobStarted', 'label:sign')), /events can't be shown as text/);
  const rack = machine(); rack.traits.machine.inputs.push({id: 'health', type: 'enum', values: ['idle', 'warn'], repeat: 8, label: 'Health', explain: 'Unit health.'});
  rack.traits.machine.drives.push(drive('health', 'state:lamp'));
  rejects('object', rack, /health needs an index 1-8/);
  rack.traits.machine.drives.at(-1).input = 'health.9';
  rejects('object', rack, /health.9 needs an index/);
  rack.traits.machine.drives.at(-1).input = 'health.2';
  rejects('object', rack, /"warn" is not a palette id of lamp/);
  rack.traits.machine.inputs.push({id: 'load', type: 'number', min: 0, max: 1, repeat: 8, label: 'Load', explain: 'Unit load.'});
  rejects('object', rack, /20 inputs counting repeats, more than 16/);
  const primary = machine(); primary.traits.machine.primary = 'lamp';
  rejects('object', primary, /primary names unknown input lamp/);
  const bad = machine(); bad.traits.machine.inputs[0].default = 'paused';
  rejects('object', bad, /default "paused" is not a valid enum value/);
  const enumNeedsValues = machine(); delete enumNeedsValues.traits.machine.inputs[0].values;
  rejects('object', enumNeedsValues, /must have required property 'values'/);
  const recipe = machine(); recipe.traits.machine.recipes[0].maps = {status: {cases: [{equals: 'success', to: 'green'}], else: 'idle'}};
  rejects('object', recipe, /maps to "green", not a value of the input/);
  const position = machine(); position.traits.machine.positions = [{node: 'belt', range: [0, 0.5]}];
  rejects('object', position, /position "belt" is not a decorative animation/);
  const stack = machine(); stack.slots.stacks[0].cap = 101;
  rejects('object', stack, /must be <= 100/);
  stack.slots.stacks[0] = {...stack.slots.stacks[0], cap: 20, layout: {grid: [2, 2, 2], spacing: [0.3, 0.3, 0.3], fill: 'xzy'}};
  rejects('object', stack, /cap exceeds the layout grid/);
  const spawn = machine(); spawn.slots.spawns[0].track = 'lane';
  rejects('object', spawn, /unknown track lane/);
  spawn.slots.spawns[0] = {...spawn.slots.spawns[0], track: 'belt', items: ['parcel']};
  rejects('object', spawn, /item parcel is not in track belt/);
  const arc = machine(); arc.slots.tracks[0].points[1] = {position: [-1.95, 0.8, 0], type: 'arc'};
  rejects('object', arc, /horizontal chord/);
  const toggle = machine(); toggle.slots.toggles = [{id: 'proxy-flag', nodes: ['proxy']}];
  rejects('object', toggle, /collision proxy can't be toggled/, {gltf: {asset: {version: '2.0'}, scenes: [{nodes: [0]}], nodes: [{name: 'proxy', mesh: 0}], meshes: [{primitives: [{attributes: {POSITION: 0}}]}], accessors: [{count: 3, min: [0, 0, 0], max: [1, 1, 1]}]}});
});

test('machines (0.10 draft): running average, levels slots, stack cap and rate', () => {
  // The conveyor plus a gauge's value/average inputs and two levels slots.
  const gauge = () => {
    const d = example('object-machine');
    d.traits.machine.inputs.push(
      {id: 'value', type: 'number', min: 0, max: 100, default: 0, label: 'Value', explain: 'The reading.'},
      {id: 'average', type: 'number', min: 0, max: 100, label: 'Average', explain: 'An average the source computed.'});
    d.slots.levels = [
      {id: 'liquid', node: 'liquid', mode: 'fill', axis: [0, 1, 0], length: 1, surface: 'liquid-surface', settle: 'spring'},
      {id: 'average-ring', node: 'average-ring', mode: 'slide', length: 1}];
    d.traits.machine.drives.push(
      {input: 'value', target: 'level:liquid', map: {scale: {from: [0, 100], to: [0, 1]}}},
      {input: 'value', target: 'level:average-ring', map: {average: {windowS: 60, override: 'average'}, scale: {from: [0, 100], to: [0, 1]}}});
    return d;
  };
  const drive = d => d.traits.machine.drives.at(-1);
  assert.deepEqual(errors('object', gauge()), []);
  // average composes with the value forms, never with becomes or counter.
  for (const form of [{scale: {from: [0, 64], to: [0, 2]}}, {thresholds: [{below: 50, to: 'idle'}], else: 'fail'}, {format: {decimals: 0}}]) {
    const d = gauge(), target = form.thresholds ? 'state:lamp' : form.format ? 'label:sign' : 'animation:belt-rollers';
    d.traits.machine.drives.push({input: 'queued', target, map: {average: {windowS: 30}, ...form}});
    assert.deepEqual(errors('object', d), [], JSON.stringify(form));
  }
  for (const map of [{average: {}, becomes: 'ok'}, {average: {}, counter: true}]) {
    const d = gauge(); drive(d).map = map;
    rejects('object', d, /must NOT be valid/);
  }
  const windows = gauge();
  drive(windows).map.average.windowS = 0.5; rejects('object', windows, /average\/windowS must be >= 1/);
  drive(windows).map.average.windowS = 3601; rejects('object', windows, /average\/windowS must be <= 3600/);
  drive(windows).map.average = {window: 60}; rejects('object', windows, /must NOT have additional properties/);
  drive(windows).map.average = {override: 'Average'}; rejects('object', windows, /must match pattern/);
  // The override names another value input of the machine; average needs a numeric input.
  const override = gauge();
  drive(override).map.average.override = 'nope'; rejects('object', override, /average override: unknown input nope/);
  drive(override).map.average.override = 'value'; rejects('object', override, /average override must name another input/);
  drive(override).map.average.override = 'jobStarted'; rejects('object', override, /average override jobStarted must be a value input, not event/);
  const textInput = gauge(); drive(textInput).input = 'lastJob';
  rejects('object', textInput, /average needs an int or number input/);
  // A direct average of an int is fractional, and an override widens the range.
  const intAverage = gauge(); intAverage.traits.machine.drives.push({input: 'queued', target: 'count:waiting', map: {average: {}}});
  rejects('object', intAverage, /counts need an int input or a rounded scale/);
  intAverage.traits.machine.drives.at(-1).map = {average: {}, scale: {from: [0, 64], to: [0, 64]}, round: 'nearest'};
  assert.deepEqual(errors('object', intAverage), []);
  const wide = gauge(); wide.traits.machine.drives.push({input: 'queued', target: 'animation:belt-rollers', map: {average: {override: 'value'}}});
  rejects('object', wide, /range 0-100 exceeds 0-10/);
  // Recipes (bindings) may average numeric inputs; override is for drives only.
  const recipe = gauge(); recipe.traits.machine.recipes[0].maps = {queued: {average: {windowS: 120}}};
  assert.deepEqual(errors('object', recipe), []);
  recipe.traits.machine.recipes[0].maps = {queued: {average: {override: 'value'}}};
  rejects('object', recipe, /queued average override is for drives only/);
  recipe.traits.machine.recipes[0].maps = {lastJob: {average: {}}};
  rejects('object', recipe, /lastJob average needs an int or number input/);
  // level: targets resolve to a levels slot and take 0-1.
  const level = gauge(); drive(level).target = 'level:ring';
  rejects('object', level, /unknown level target "ring"/);
  const levelRange = gauge(); drive(levelRange).map = {average: {}};
  rejects('object', levelRange, /range 0-100 exceeds 0-1/);
  // Levels slot fields.
  const slot = (patch, pattern) => { const d = gauge(); Object.assign(d.slots.levels[0], patch); rejects('object', d, pattern); };
  slot({mode: 'pour'}, /must be equal to one of the allowed values/);
  slot({length: 0}, /must be > 0/);
  slot({length: 10.5}, /must be <= 10/);
  slot({axis: [0, 2, 0]}, /must be <= 1/);
  slot({axis: [0, 0.5, 0]}, /slots.levels liquid: axis must be a unit vector/);
  slot({settle: 'bounce'}, /must be equal to one of the allowed values/);
  slot({mode: 'slide'}, /must NOT be valid/);
  const noLength = gauge(); delete noLength.slots.levels[1].length;
  rejects('object', noLength, /must have required property 'length'/);
  const nine = gauge(); nine.slots.levels = Array.from({length: 9}, (_, i) => ({id: `l${i}`, node: `n${i}`, mode: 'slide', length: 1}));
  rejects('object', nine, /must NOT have more than 8 items/);
  const twice = gauge(); twice.slots.levels[1].id = 'liquid';
  rejects('object', twice, /slots.levels: duplicate id/);
  // With the glTF: nodes exist, the surface sits outside the fill, nothing moves the proxy.
  const gltf = (nodes, scene = [0, 1, 2]) => ({asset: {version: '2.0'}, scenes: [{nodes: scene}], nodes, meshes: [{primitives: [{attributes: {POSITION: 0}}]}],
    accessors: [{componentType: 5126, type: 'VEC3', count: 3, min: [0, 0, 0], max: [0.1, 0.1, 0.1]}]});
  const parts = () => [{name: 'liquid', mesh: 0}, {name: 'liquid-surface', mesh: 0}, {name: 'average-ring', mesh: 0}, {name: 'proxy', mesh: 0}];
  const levelErrors = (d, nodes, scene) => errors('object', d, {gltf: gltf(nodes, scene)}).filter(e => /slots\.levels/.test(e));
  assert.deepEqual(levelErrors(gauge(), parts()), []);
  assert.match(levelErrors(gauge(), parts().filter(n => n.name !== 'liquid-surface'), [0, 1]).join('\n'), /slots.levels liquid: node "liquid-surface" not found in the glTF/);
  assert.match(levelErrors(gauge(), parts().filter(n => n.name !== 'average-ring'), [0, 1]).join('\n'), /slots.levels average-ring: node "average-ring" not found in the glTF/);
  const nested = parts(); nested[0].children = [1];
  assert.match(levelErrors(gauge(), nested, [0, 2]).join('\n'), /surface "liquid-surface" must not be inside the fill node's subtree/);
  const proxy = gauge(); proxy.slots.levels[1].node = 'proxy';
  assert.match(levelErrors(proxy, parts()).join('\n'), /slots.levels average-ring: the collision proxy can't be moved/);
  const shared = gauge(); shared.slots.levels[1].node = 'liquid';
  assert.match(levelErrors(shared, parts()).join('\n'), /node "liquid" is also moved by levels slot liquid/);
  // Stacks: cap up to 100 and an optional rate 0-1000 copies per second.
  const stack = gauge(); stack.slots.stacks[0] = {...stack.slots.stacks[0], cap: 100, rate: 40, layout: {grid: [5, 4, 5], spacing: [0.1, 0.1, 0.1], fill: 'xzy'}};
  assert.deepEqual(errors('object', stack), []);
  stack.slots.stacks[0].rate = 0; assert.deepEqual(errors('object', stack), []);
  stack.slots.stacks[0].rate = -1; rejects('object', stack, /rate must be >= 0/);
  stack.slots.stacks[0].rate = 1001; rejects('object', stack, /rate must be <= 1000/);
  stack.slots.stacks[0] = {...stack.slots.stacks[0], rate: 40, cap: 101, layout: {grid: [11, 10, 1], spacing: [0.1, 0.1, 0.1], fill: 'xyz'}};
  rejects('object', stack, /cap must be <= 100/);
  // Spacing may be negative (fill from the node towards -axis); zero only where the grid is 1.
  stack.slots.stacks[0] = {...stack.slots.stacks[0], cap: 100, layout: {grid: [10, 10, 1], spacing: [-0.05, -0.08, 0], fill: 'xyz'}};
  assert.deepEqual(errors('object', stack), []);
  stack.slots.stacks[0].layout.spacing = [0.05, 0, 0]; rejects('object', stack, /slots.stacks waiting: spacing y must be non-zero for 10 cells/);
  stack.slots.stacks[0].layout.spacing = [-10.5, 0.05, 0]; rejects('object', stack, /spacing\/0 must be >= -10/);
  // None of it is 0.9.
  const old = lantern(); old.slots = {levels: gauge().slots.levels};
  rejects('object', old, /must NOT have additional properties/);
});

test('libraries: listed objects, object formats, files and attribution', () => {
  const lib = example('library'), objects = {'street-lantern': lantern(), bench: example('object-seat')};
  const files = ['library.json', 'LICENSE', 'ATTRIBUTION.md', 'objects/bench/object.json'].map(path => ({path, size: 10}));
  assert.deepEqual(errors('library', lib, {objects, files}), []);
  rejects('library', lib, /bench has no objects\/bench\/object.json/, {objects: {'street-lantern': lantern()}});
  rejects('library', lib, /objects\/extra is not listed/, {objects: {...objects, extra: lantern()}});
  rejects('library', lib, /objects\/bench\/object.json has id street-lantern/, {objects: {...objects, bench: lantern()}});
  rejects('library', lib, /uses object format 0.10, newer than the library's 0.9/, {objects: {...objects, bench: example('object-machine')}});
  rejects('library', lib, /bench has no known object formatVersion \(undefined\)/, {objects: {...objects, bench: {id: 'bench'}}});
  assert.deepEqual(errors('library', {...lib, formatVersion: '0.10'}, {objects: {...objects, bench: {...example('object-machine'), id: 'bench'}}}), []);
  rejects('library', lib, /missing ATTRIBUTION.md/, {files: files.filter(f => f.path !== 'ATTRIBUTION.md')});
  rejects('library', {...lib, attribution: [{path: 'LICENSE', author: 'A', license: 'CC0-1.0'}]}, /library.json is not covered/, {files});
  rejects('library', {...lib, id: 'street'}, /pattern/);
  rejects('library', {...lib, objects: []}, /fewer than 1/);
  rejects('library', {...lib, objects: ['bench', 'bench']}, /duplicate items/);
});

test('library release record: key, url, hashes, format', () => {
  const record = example('library-releases'), key = 'com.example.street@1.2.0', entry = record[key];
  rejects('library-releases', {'com.example.street@1.3.0': entry}, /key must be id@version/);
  rejects('library-releases', {[key]: {...entry, url: 'https://example.com/street.tar.zst'}}, /url must end with/);
  rejects('library-releases', {[key]: {...entry, url: 'http://example.com/com.example.street-1.2.0.tar.zst'}}, /pattern/);
  rejects('library-releases', {[key]: {...entry, nixHash: 'sha256-' + 'A'.repeat(43) + '='}}, /nixHash does not encode sha256/);
  rejects('library-releases', {[key]: {...entry, formatVersion: '0.8'}}, /not a known object format/);
  rejects('library-releases', {[key]: {...entry, published: undefined}}, /required property 'published'/);
  rejects('library-releases', {'Street@1.2.0': entry}, /property name/);
});
