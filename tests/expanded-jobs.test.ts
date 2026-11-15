import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {FlightJournal} from '../src/journey/FlightJournal.ts';
import {aircraftJobs} from '../src/journey/AircraftJobs.ts';
import {RescueBoat,rescueBoatPosition} from '../src/journey/RescueBoat.ts';
import {allLandforms,terrainHeight} from '../src/world/WorldConfig.ts';
const memory=()=>({getItem:()=>null,setItem:()=>{}});
test('rescue needs five continuous stopped seconds; drift, departure and flight reset progress',()=>{
 const j=new FlightJournal(memory());assert(j.accept('rescue','harbor'));
 for(let i=0;i<49;i++)assert(!j.rescueUpdate(.1,true,.2,20));assert(j.active);
 j.rescueUpdate(.1,true,1,20);assert.equal(j.rescueRemaining,5);
 j.rescueUpdate(.1,false,0,20);assert.equal(j.rescueRemaining,5);
 j.rescueUpdate(.1,true,0,36);assert.equal(j.rescueRemaining,5);
 for(let i=0;i<49;i++)j.rescueUpdate(.1,true,0,20);assert(j.active);
 assert(j.rescueUpdate(.1,true,0,20));assert(!j.active);assert(j.data.completed.includes('rescue'));assert(!j.rescueUpdate(.1,true,0,20));
});
test('rescue ship is clear of land near lighthouse and remains after marker turns off',()=>{
 const pos=rescueBoatPosition(),island=allLandforms.find(d=>d.id==='lighthouse')!;
 assert(pos.distanceTo(new T.Vector3(island.x,0,island.z))<1500);
 for(const land of allLandforms)for(const dx of [-55,0,55])for(const dz of [-55,0,55])assert(terrainHeight(land,pos.x+dx,pos.z+dz)<=0);
 const v=new RescueBoat(),camera=new T.PerspectiveCamera();v.update(.1,true,camera);assert(v.marker.visible);
 const opacity=v.marker.material.opacity;v.update(.1,true,camera);assert.notEqual(v.marker.material.opacity,opacity);
 v.update(0,false,camera);assert(!v.marker.visible);assert(v.boat.visible);assert(v.root.visible);
});
test('nine aircraft-specific jobs enforce types, ordered stages, speed, altitude and final berth',()=>{
 assert.equal(aircraftJobs.length,9);
 for(const plane of ['redwing','m5','mc72'])assert.equal(aircraftJobs.filter(j=>j.aircraft===plane).length,3);
 for(const c of aircraftJobs){
  const j=new FlightJournal(memory());j.aircraft=c.aircraft==='redwing'?'m5':'redwing';assert(!j.accept(c.id,c.from));
  j.aircraft=c.aircraft!;assert(j.accept(c.id,c.from));
  for(const step of c.stops!){const p=j.scenicStop!.position;
   j.update(.1,{...p,y:p.y+100},true,undefined,step.minKmh??100);assert.equal(j.scenicStop!.name,step.name);
   if(step.minKmh){j.update(.1,p,true,undefined,step.minKmh-10);assert.equal(j.scenicStop!.name,step.name);}
   if(step.maxKmh){j.update(.1,p,true,undefined,step.maxKmh+10);assert.equal(j.scenicStop!.name,step.name);}
   j.update(.1,p,true,undefined,step.minKmh??100);
  }
  assert(!j.scenicStop);assert(j.active);j.update(.1,{x:0,y:0,z:0},false,c.to);assert(!j.active);assert(j.data.completed.includes(c.id));
  const saved=new FlightJournal({getItem:()=>JSON.stringify(j.data),setItem:()=>{}});assert(saved.data.completed.includes(c.id));
 }
});
test('timed flight can fail and be retried, while ground time does not consume its clock',()=>{
 const j=new FlightJournal(memory());j.aircraft='mc72';assert(j.accept('mc-sprint','coral'));const p={x:0,y:0,z:0};
 for(let i=0;i<2000;i++)j.update(.1,p,false);assert(j.active);
 for(let i=0;i<1801;i++)j.update(.1,p,true);assert(!j.active);assert(!j.data.completed.includes('mc-sprint'));assert(j.accept('mc-sprint','coral'));
});
