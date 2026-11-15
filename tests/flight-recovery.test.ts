import test from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';
import {FlightController,neutralInput} from '../src/aircraft/FlightController.ts';
import {getAircraft} from '../src/aircraft/AircraftCatalog.ts';
import {relativeRainVelocity} from '../src/rendering/WeatherEffects.ts';
import {landingAdvice} from '../src/aircraft/LandingGuidance.ts';
test('crash recovery clears broken flight state and flies along the original heading on all three aircraft',()=>{
 for(const id of ['redwing','m5','mc72'] as const){const f=new FlightController(true,getAircraft(id).tuning),heading=1.47,p=new Vector3(300,450,-900);f.heading=heading;f.pitch=.8;f.bank=2;f.crash('test');f.recoverAt(p,heading);
 assert.equal(f.state,'AIRBORNE');assert.equal(f.crashReason,'');assert.equal(f.heading,heading);assert.equal(f.bank,0);assert.equal(f.pitch,0);assert(f.position.equals(p));assert(f.previousPosition.equals(p));assert(f.previousOrientation.equals(f.orientation));
 const expected=new Vector3(-Math.sin(heading),0,-Math.cos(heading));assert(f.velocity.clone().normalize().distanceTo(expected)<1e-8);
 f.update(1/60,neutralInput());assert(f.position.clone().sub(p).dot(expected)>0);assert.equal(f.state,'AIRBORNE');}
});
test('top view rain falls with world gravity and wind independent of aircraft velocity',()=>{
 const a=relativeRainVelocity(.4,new Vector3(120,-20,-110),true),b=relativeRainVelocity(.4,new Vector3(-80,10,90),true);
 assert(a.equals(b));assert.equal(a.y,-32);assert(Math.hypot(a.x,a.z)<Math.abs(a.y));assert(!relativeRainVelocity(.4,new Vector3(120,0,0)).equals(a));
});
test('auto landing guide only opens on descending airborne approaches at 50 metres or below',()=>{
 const c=getAircraft('redwing').tuning,s={state:'AIRBORNE' as const,speed:35,clearance:50,verticalSpeed:-1,bank:0,pitch:0,throttle:.1,overWater:true,clearAhead:true,landingCount:0};
 assert(landingAdvice(c,s).automatic);for(const change of [{clearance:50.01},{verticalSpeed:0},{verticalSpeed:1},{state:'ON_WATER' as const,landingCount:1},{state:'LANDING' as const}])assert(!landingAdvice(c,{...s,...change}).automatic);
});
