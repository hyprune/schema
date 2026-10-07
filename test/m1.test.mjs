import test from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../lib/validate.mjs';
const request=(method,params)=>({jsonrpc:'2.0',id:'1',method,params});
const check=(m,p,valid=true)=>assert.equal(validate('ipc',request(m,p),undefined,'0.2').valid,valid,`${m}: ${JSON.stringify(p)}`);
test('0.2 methods are explicit; 0.1 stays frozen',()=>{
 const examples={'camera.get':{},'camera.set':{position:[0,1.7,0],orientation:[0,0,0,1]},'waypoint.set':{id:'yard',label:'Yard',target:{zoneId:'yard'}},'waypoint.clear':{},'route.set':{points:[{position:[0,1.7,0]},{zoneId:'yard'}]},'route.clear':{},'travel.start':{to:{position:[1,1.7,2]},durationMs:600},'travel.cancel':{},'autodrive.start':{speed:3},'autodrive.stop':{},'ui.open':{leaseId:'a',outputId:'b',panel:'overview'},'ui.close':{leaseId:'a',outputId:'b'},'data.publish':{sourceId:'org.example.metrics',sequence:1,values:{cpuPercent:12}},'data.remove':{sourceId:'org.example.metrics'}};
 for(const [m,p] of Object.entries(examples)){check(m,p);assert.equal(validate('ipc',request(m,p)).valid,false);}
 check('waypoint.set',{id:'x',label:'X',position:[1,2,3]});
 check('travel.start',{to:{zoneId:'yard',position:[0,0,0]}},false);
 check('route.set',{points:[]},false);check('camera.set',{position:[0,0,0],orientation:[0,0,0,2]},false);
 check('data.publish',{sourceId:'org.example.metrics',sequence:1,values:{secret:{nested:1}}},false);
 check('data.publish',{sourceId:'org.example.metrics',sequence:1,values:{},ttlMs:1},false);
});
test('warp notifications carry session/revision and bounded progress',()=>{
 let j={jsonrpc:'2.0',method:'location.transition',params:{sessionId:'s',revision:2,id:'transition-1',outputId:'output-1',monotonicMs:100,phase:'travelling',progress:.5,to:{zoneId:'yard'}}};
 assert.equal(validate('ipc',j,undefined,'0.2').valid,true);j.params.progress=2;assert.equal(validate('ipc',j,undefined,'0.2').valid,false);
});
