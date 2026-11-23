import {test} from 'node:test';import assert from 'node:assert/strict';
import {islands,terrainHeight,townPoint,covePoint} from '../src/world/WorldConfig.ts';
import {Spawn} from '../src/aircraft/FlightConfig.ts';
test('safe harbor spawn and southbound takeoff corridor stay on water',()=>{
 for(let z=Spawn.z-30;z<Spawn.z+650;z+=10)for(const d of islands)assert.ok(terrainHeight(d,Spawn.x,z)<0);
});
test('core islands have distinct heights and retain navigable harbor bays',()=>{
 assert.equal(new Set(islands.slice(0,3).map(d=>d.height)).size,3);
 for(const d of islands){
  let peak=-30;for(let x=-d.rx;x<d.rx;x+=20)for(let z=-d.rz;z<d.rz;z+=20)peak=Math.max(peak,terrainHeight(d,d.x+x,d.z+z));
  assert.ok(peak>d.height*.7&&peak<=d.height+5,`${d.id}: ${peak}`);
  assert.ok(terrainHeight(d,d.x+d.rx*3,d.z)<0);if(d.bay){const p=d.id==='town'?townPoint(d,d.x,d.z+d.rz*.65):d.id==='harbor'?{x:d.x-d.rz*.65,z:d.z}:covePoint(d,d.x,d.z+d.rz*.65);assert.ok(terrainHeight(d,p.x,p.z)<0);}
 }
});
