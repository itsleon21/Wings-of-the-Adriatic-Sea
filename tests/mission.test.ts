import {test} from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {World} from '../src/world/World.ts';
import {MissionManager,crossesCheckpoint,route} from '../src/missions/MissionManager.ts';import {FlightController} from '../src/aircraft/FlightController.ts';import {allLandforms,islands,terrainHeight} from '../src/world/WorldConfig.ts';
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
test('high-speed segment crossing passes a ring without center proximity',()=>{const p=route[0];assert.equal(crossesCheckpoint(p.position.clone().addScaledVector(p.normal,-250),p.position.clone().addScaledVector(p.normal,250),p),true);assert.equal(crossesCheckpoint(new Vector3(-700,500,1130),new Vector3(-200,500,1130),p),false);});
test('checkpoint order, completion, failure and retries',()=>{const m=new MissionManager();m.start();const cross=(index:number)=>{const p=route[index];m.update(1,p.position.clone().addScaledVector(p.normal,-200),p.position.clone().addScaledVector(p.normal,200));};cross(2);assert.equal(m.index,0);for(let i=0;i<route.length;i++)cross(i);assert.equal(m.state,'COMPLETED');const elapsed=m.elapsed;m.update(9,new Vector3(),new Vector3());assert.equal(m.elapsed,elapsed);m.start();m.fail();assert.equal(m.state,'FAILED');m.start();assert.equal(m.elapsed,0);assert.equal(m.index,0);});
test('three complete physical flights: takeoff, every main island, landing and restart',()=>{
 const f=new FlightController(),m=new MissionManager(),world=new World();
 for(let cycle=0;cycle<3;cycle++){
  f.reset();m.start();
  for(let i=0;i<60*2100&&m.state==='RUNNING';i++){
   const p=m.current!;let input;
   if(f.state!=='AIRBORNE')input={pitch:1,roll:0,yaw:0,throttle:1};else{const dx=p.position.x-f.position.x,dz=p.position.z-f.position.z,desired=Math.atan2(-dx,-dz),error=Math.atan2(Math.sin(desired-f.heading),Math.cos(desired-f.heading));input={pitch:clamp((p.position.y-f.position.y)*.018-f.velocity.y*.13,-.28,.3)/.36,roll:clamp(-error*2,-1,1),yaw:0,throttle:clamp((.46-f.throttle)*5,-1,1)};}
   f.update(1/60,input);m.update(1/60,f.previousPosition,f.position);assert.notEqual(f.state,'CRASHED');assert.equal(world.collides(f.previousPosition,f.position),false);for(const d of islands)assert.ok(f.position.y-terrainHeight(d,f.position.x,f.position.z)>1);
  }
  assert.equal(m.state,'COMPLETED');assert.equal(m.index,route.length);
  for(let i=0;i<60*160&&f.state!=='ON_WATER'&&f.state!=='CRASHED';i++){f.update(1/60,{pitch:clamp((.5-f.position.y)*.009-f.velocity.y*.15,-.09,.2)/.36,roll:0,yaw:0,throttle:clamp(((f.state==='AIRBORNE'?.12:0)-f.throttle)*5,-1,1)});}
  assert.equal(f.state,'ON_WATER');assert.equal(f.landingCount,1);
 }
});

test('sightseeing route visits every main island with safe clearance and incoming-facing gates',()=>{
 assert.equal(route.length,allLandforms.filter(d=>!d.id.startsWith('reef-')&&d.id!=='north-coast').length+1);
 assert.deepEqual(new Set(route.flatMap(p=>p.islandId?[p.islandId]:[])),new Set(allLandforms.filter(d=>!d.id.startsWith('reef-')&&d.id!=='north-coast').map(d=>d.id)));
 for(let i=1;i<route.length;i++){
  const p=route[i],previous=route[i-1].position,d=allLandforms.find(d=>d.id===p.islandId)!;
  assert.ok(Math.hypot(p.position.x-d.x,p.position.z-d.z)<Math.max(d.rx,d.rz)*1.3);
  assert.ok(p.position.y-terrainHeight(d,p.position.x,p.position.z)>100);
  const direction=new Vector3(p.position.x-previous.x,0,p.position.z-previous.z).normalize();assert.ok(p.normal.dot(direction)>.999);
 }
});

test('tour proximity accepts a nearby pass without crossing a ring plane and excludes reefs',async()=>{
 const {reachesTourCheckpoint}=await import('../src/missions/MissionManager.ts');const p=route[1],a=p.position.clone().add(new Vector3(40,30,40)),b=a.clone().add(new Vector3(1,0,1));assert.ok(reachesTourCheckpoint(a,b,p));assert.ok(!reachesTourCheckpoint(p.position.clone().addScalar(1000),p.position.clone().addScalar(1001),p));assert.ok(route.every(p=>!p.islandId?.startsWith('reef-')));
});
