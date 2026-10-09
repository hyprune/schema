import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validate} from '../lib/validate.mjs';
test('IPC 0.15 unzoned instances omit areaId; empty IDs remain invalid',()=>{
 const mounts={areas:[],anchors:[],objects:[],bindings:[],placements:[],placementZones:[],instances:[{surfaceId:'app',workspaceId:8,anchorId:'',status:'placed'}],carriedSurfaceId:null,desktopWorkspaceId:null};
 const frame={jsonrpc:'2.0',method:'mounts.changed',params:{sessionId:'test',revision:1,mounts}};
 assert.equal(validate('ipc',frame,undefined,'0.15').valid,true);
 mounts.instances[0].areaId='';assert.equal(validate('ipc',frame,undefined,'0.15').valid,false);
 mounts.instances[0].areaId='room';assert.equal(validate('ipc',frame,undefined,'0.15').valid,true);
});
