import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cutGarment } from '../src/avatar/clothing.js';

test('garment clips crossing triangles exactly at hems instead of retaining torn edges',()=>{
  const source=new THREE.CylinderGeometry(.2,.2,1,16,8,true);
  const clipped=cutGarment(source,-.13,.17,0);
  const p=clipped.attributes.position;
  let top=0,bottom=0;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i);assert.ok(y>=-.130001&&y<=.170001);
    if(Math.abs(y-.17)<1e-6)top++;
    if(Math.abs(y+.13)<1e-6)bottom++;
  }
  assert.ok(top>16&&bottom>16,'both hems must have clipped intersection vertices');
  assert.ok(Array.from(clipped.attributes.uv.array).every(Number.isFinite));
});
