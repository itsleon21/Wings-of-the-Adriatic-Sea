import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {RaceControls} from '../src/race/RaceControls.ts';import {raceGuidance} from '../src/race/RaceGuidance.ts';
import {RaceManager,raceCourse} from '../src/race/RaceManager.ts';import {FlightController,neutralInput} from '../src/aircraft/FlightController.ts';import {raceAircraftCatalog} from '../src/race/RaceAircraft.ts';
const airborne=()=>{const f=new FlightController(false,raceAircraftCatalog[0].tuning);f.state='AIRBORNE';f.position.y=140;f.velocity.set(0,0,-100);return f;};
test('race keyboard onset is progressive, release is quick, and water/manual controls remain direct',()=>{
 const f=airborne(),controls=new RaceControls(),raw={pitch:1,roll:1,yaw:0,throttle:1},first=controls.update(1/60,raw,f);assert.ok(first.pitch>0&&first.pitch<.3);assert.ok(first.roll>0&&first.roll<.3);assert.equal(first.throttle,1);assert.equal(raw.roll,1);
 let held=first;for(let i=0;i<30;i++)held=controls.update(1/60,raw,f);assert.ok(held.roll>.99);
 for(let i=0;i<10;i++)held=controls.update(1/60,neutralInput(),f);assert.ok(Math.abs(held.roll)<.03);
 controls.enabled=false;assert.deepEqual(controls.update(1/60,raw,f),raw);controls.enabled=true;f.state='ON_WATER';assert.deepEqual(controls.update(1/60,raw,f),raw);
});
test('race assistance supports banked level flight while preserving explicit pitch and yaw control',()=>{
 const f=airborne(),controls=new RaceControls();f.bank=.5;
 const supported=controls.update(1/60,neutralInput(),f);assert.ok(supported.pitch>0&&supported.pitch<=.22);
 controls.reset();const descending=controls.update(1/60,{...neutralInput(),pitch:-1,yaw:-1},f);assert.ok(descending.pitch<0);assert.ok(descending.yaw<0);
 controls.reset();f.position.y=30;assert.equal(controls.update(1/60,neutralInput(),f).pitch,0);
});
test('missed gate recovery points the player back to entry without awarding a wrong-way pass',()=>{
 const r=new RaceManager(),start=raceCourse[0];r.update(3,start.position,start.position);r.update(.1,start.position.clone().addScaledVector(start.normal,-200),start.position.clone().addScaledVector(start.normal,200));
 const gate=r.current!,side=new T.Vector3(-gate.normal.z,0,gate.normal.x).multiplyScalar(gate.radius*2);
 r.update(.1,gate.position.clone().add(side).addScaledVector(gate.normal,-200),gate.position.clone().add(side).addScaledVector(gate.normal,200));assert.equal(r.index,1);assert.equal(r.recovering,true);
 const f=airborne();assert.match(raceGuidance(r,f).message,/漏过航门/);
 r.update(.1,gate.position.clone().add(side).addScaledVector(gate.normal,200),gate.position.clone().add(side).addScaledVector(gate.normal,-200));assert.equal(r.recovering,false);assert.equal(r.index,1);
 r.update(.1,gate.position.clone().addScaledVector(gate.normal,-200),gate.position.clone().addScaledVector(gate.normal,200));assert.equal(r.index,2);r.reset();assert.equal(r.recovering,false);
});
test('race guidance adapts to approach distance, low altitude and aircraft-specific turn speeds',()=>{
 const r=new RaceManager();r.state='RUNNING';r.index=1;
 for(const a of raceAircraftCatalog){const f=new FlightController(false,a.tuning);f.state='AIRBORNE';f.position.copy(r.current!.position).addScaledVector(r.current!.normal,-200);f.velocity.set(0,0,-a.tuning.maxSpeed);const guide=raceGuidance(r,f);assert.match(guide.message,/过门后.*建议 \d+ km\/h/);assert.equal(guide.warning,true);f.position.y=20;assert.match(raceGuidance(r,f).message,/高度偏低/);}
});
