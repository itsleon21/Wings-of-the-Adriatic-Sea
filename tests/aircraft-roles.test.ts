import test from 'node:test';import assert from 'node:assert/strict';
import {FlightJournal} from '../src/journey/FlightJournal.ts';
test('M5 boards at the hotel, visits each stop in flight and docks to disembark',()=>{
 const j=new FlightJournal();const hotel={x:0,y:0,z:0};assert(!j.accept('passengers','hotel'));j.aircraft='m5';assert(!j.accept('rescue','harbor'));assert(j.accept('passengers','hotel'));j.update(.1,hotel,false,'hotel');assert(j.active);
 for(let i=0;i<6;i++){const p=j.scenicStop!.position;j.update(.1,p,false);assert.equal(j.scenicStop!.position,p);j.update(.1,p,true);}
 assert(!j.scenicStop);assert(j.active);j.update(.1,hotel,false,'hotel');assert(!j.active);assert(j.accept('passengers','hotel'));
});
test('fleet shares deliveries and docking reports; rescue belongs to Red Wing',()=>{
 for(const id of ['redwing','m5','mc72']){const j=new FlightJournal();j.aircraft=id;assert(j.accept('post','harbor'));j.cancel();assert.equal(j.accept('rescue','harbor'),id==='redwing');assert.match(j.docking(1,8),/精准靠泊/);assert.match(j.data.entries.at(-1)!,/8 m/);}
});
