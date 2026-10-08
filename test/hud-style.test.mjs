import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
const ajv=new Ajv2020({strict:true});
const style=ajv.compile(JSON.parse(readFileSync(new URL('../extensions/hud-style.schema.json',import.meta.url))));
const manifest=ajv.compile(JSON.parse(readFileSync(new URL('../extensions/hud-style-manifest.schema.json',import.meta.url))));
test('world HUD style schema accepts bounded declarative package skins',()=>{
 assert.ok(style({version:1,colors:{accent:'#ffd28a',outline:'#101820'},font:'hud/fonts/Display.ttf',icons:{window:'hud/icons/window.svg'},stroke:{width:2,style:'outline'},corners:'bevel',warp:'ribbons'}));
 assert.ok(manifest({theme:'hud/theme.json'}));
});
test('world HUD style schema rejects URLs, traversal, invisible colors and executable fields',()=>{
 for(const theme of ['../theme.json','/tmp/theme.json','https://host/theme.json','hud/../theme.json']) assert.equal(manifest({theme}),false);
 for(const v of [{version:2},{version:1,script:'bad'},{version:1,colors:{foreground:'#00000000'}},{version:1,stroke:{width:0}},{version:1,font:'system:Comic Sans'},{version:1,icons:{window:'https://bad/icon.svg'}},{version:1,layout:'replace'}]) assert.equal(style(v),false,JSON.stringify(v));
});
