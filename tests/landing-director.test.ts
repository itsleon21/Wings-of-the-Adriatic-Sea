import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {LandingDirector,planWaterLanding} from '../src/aircraft/LandingDirector.ts';
import {FlightController} from '../src/aircraft/FlightController.ts';
test('landing planner checks approach and the full float-width water run, rejects blocked sea',()=>{
 const p=new T.Vector3(0,45,0),plan=planWaterLanding(p,0,()=>true)!;
 assert.equal(plan.heading,0);assert.ok(plan.touchdown.z< -900);assert.equal(plan.touchdown.y,0);
 assert.equal(planWaterLanding(p,0,()=>false),undefined);
 assert.equal(planWaterLanding(p,0,(x,z)=>z> -700||z< -800),undefined);
 const alternate=planWaterLanding(p,0,(x,z)=>Math.abs(x)>30||z> -900);
 assert.ok(alternate);assert.notEqual(alternate.heading,0);
});
test('visual approach stays anchored, hides on landing and resets on request',()=>{
 const f=new FlightController();f.recoverAt(new T.Vector3(0,40,0),0);f.velocity.set(0,-1,-35);
 const director=new LandingDirector();
 director.update(.1,f,true,()=>true,()=>0);
 assert.equal(director.root.visible,true);const touchdown=director.plan!.touchdown.clone();
 f.position.z-=100;director.update(.1,f,true,()=>true,()=>.5);assert(director.plan!.touchdown.equals(touchdown));
 assert(director.message.length>0);
 director.update(.1,f,false,()=>true,()=>0);assert.equal(director.root.visible,false);assert.equal(director.plan,undefined);
 director.update(.1,f,true,()=>false,()=>0);assert.equal(director.root.visible,false);assert.match(director.message,/未找到/);
 f.state='LANDING';director.update(.1,f,true,()=>true,()=>0);assert.equal(director.root.visible,false);
 director.dispose();
});

import {planTaskLanding,clearTaxiPath} from '../src/aircraft/LandingDirector.ts';
import {mooringSites} from '../src/world/Moorings.ts';
import {allLandforms,terrainHeight} from '../src/world/WorldConfig.ts';
test('task approaches are anchored offshore of the actual mission berth with a clear run',()=>{
 const clear=(x:number,z:number)=>Math.abs(x)<5900&&Math.abs(z)<5900&&allLandforms.every(d=>terrainHeight(d,x,z)<-3);
 for(const site of mooringSites){
  const goal={name:site.name,position:site.berth.clone(),outward:new T.Vector3(site.dx,0,site.dz)};
  const start=site.berth.clone().addScaledVector(goal.outward,1500);start.y=100;
  const plan=planTaskLanding(start,goal,clear);
  assert(plan,site.id);assert.ok(plan.touchdown.distanceTo(goal.position)>=319,site.id);
  assert.ok(clear(plan.touchdown.x,plan.touchdown.z),site.id);
 }
});
test('mission guide persists into taxi, stops at delivery, and rejects taxi lines through land',()=>{
 const f=new FlightController();f.recoverAt(new T.Vector3(0,80,1500),0);
 const goal={name:'任务栈桥',position:new T.Vector3(),outward:new T.Vector3(0,0,1)};
 const guide=new LandingDirector();guide.update(.1,f,true,()=>true,()=>0,goal);
 assert(guide.plan);assert.equal(guide.plan.touchdown.z,500);
 f.state='LANDING';f.position.set(0,2,150);f.velocity.set(0,0,-4);guide.update(.1,f,true,()=>true,()=>0,goal);
 assert(guide.root.visible);assert.equal(guide.navigationPoint!.name,goal.name);assert.match(guide.message,/滑行/);
 f.position.z=20;guide.update(.1,f,true,()=>true,()=>0,goal);assert.match(guide.message,/F 靠泊/);
 assert.equal(clearTaxiPath(new T.Vector3(0,0,600),new T.Vector3(),(x,z)=>z<250||z>350),false);
 guide.update(.1,f,false,()=>true,()=>0);assert.equal(guide.root.visible,false);assert.equal(guide.navigationPoint,undefined);guide.dispose();
});
