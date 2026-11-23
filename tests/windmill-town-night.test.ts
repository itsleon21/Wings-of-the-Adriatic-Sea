import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {islands,allLandforms,terrainHeight} from '../src/world/WorldConfig.ts';import {buildSettlementLayout} from '../src/world/SettlementLayout.ts';
import {coastalLandmarkSites} from '../src/world/CoastalLandmarkSites.ts';
import {WeatherController,morningFogWindow} from '../src/rendering/WeatherConfig.ts';import {SeaTraffic,vesselIslandScale} from '../src/world/SeaTraffic.ts';
import {FlightJournal} from '../src/journey/FlightJournal.ts';import {coveCampSite} from '../src/world/CoveCamp.ts';import {storyStepTarget,airPirateJobId} from '../src/journey/StoryMissions.ts';import {nightApproach} from '../src/world/HarborNavigation.ts';

test('island centres follow the revised chart and the town has half its former mills in close groups',()=>{
 assert.equal(islands[0].rx,525*.9);assert.equal(islands[0].rz,450*.9);assert.equal(islands[1].rx,864*Math.sqrt(.8));assert.equal(islands[1].rz,585*Math.sqrt(.8));
 assert.ok(islands[1].x<islands[2].x);assert.deepEqual([islands[1].x,islands[1].z],[-2700,-1400]);assert.deepEqual([islands[3].x,islands[3].z],[-2225,3800]);assert.deepEqual([islands[2].x,islands[2].z],[136,-1645]);assert.deepEqual([islands[4].x,islands[4].z],[3006,2905]);const town=buildSettlementLayout(islands[1]);
 const mills=town.houses.filter(p=>p.kind.startsWith('HouseMill'));
 const landmarks=coastalLandmarkSites.filter(site=>site.kind==='windmill'&&site.island==='town').length;
 assert.equal(mills.length+landmarks,68);
 assert.ok(Math.max(...mills.map(p=>p.height))/Math.min(...mills.map(p=>p.height))>2);
 const grouped=mills.filter(p=>mills.some(q=>q!==p&&Math.hypot(p.x-q.x,p.z-q.z)<75));
 assert.ok(grouped.length>=mills.length*.95);
});
test('automatic morning fog is pre-sunrise, clears after sunrise, and manual fog remains available',()=>{
 for(const hour of[0,3.49,6,8,12,23])assert.equal(morningFogWindow(hour),false);for(const hour of[3.5,4.5,5.99])assert.equal(morningFogWindow(hour),true);
 const weather=new WeatherController('fog');weather.update(.1,true,6);assert.equal(weather.target,'sunny');weather.select('fog',true);weather.setAutomatic(false);weather.update(.1,true,12);assert.equal(weather.target,'fog');
});
test('night-loaded vessels are docked, morning departures move, and dusk returns preserve nearby positions',()=>{
 const water=()=>({height:.4,dx:.02,dz:-.01}),fleet=new SeaTraffic();fleet.setNightness(1,23);fleet.update(0,water);
 const mobile=fleet.root.children.filter(o=>o.userData.route);assert.ok(mobile.filter(o=>o.userData.nightMode==='moored').length/mobile.length>=.90);const before=mobile.map(o=>o.position.clone());fleet.update(60,water);mobile.forEach((o,i)=>{if(o.userData.nightMode==='moored')assert.ok(o.position.equals(before[i]));});
 fleet.setNightness(0,7);fleet.update(61,water);assert.ok(mobile.some((o,i)=>o.position.distanceTo(before[i])>.1));
 const returning=new SeaTraffic();returning.update(120,water);const day=returning.root.children.slice(0,12).map(o=>o.position.clone());returning.setNightness(.5,18);returning.update(120.01,water);returning.root.children.slice(0,12).forEach((o,i)=>assert.ok(o.position.distanceTo(day[i])<2,'no dusk teleport'));
 for(let t=121;t<=5001;t+=10)returning.update(t,water);assert.ok(returning.root.children.slice(0,12).filter(o=>o.userData.nightMode==='moored').length>=11);
 assert.ok(Math.abs(mobile[0].scale.x-1.55*1.05*vesselIslandScale('harbor','town'))<1e-7);
});
test('precomputed night approaches remain on navigable water',()=>{
 const fleet=new SeaTraffic();fleet.routes.forEach((r,i)=>{for(const [end,id] of [[0,r.from],[1,r.to]] as const){const path=nightApproach(id,r.curve.getPointAt(end),i*10+(end?100:0));for(let j=0;j<=160;j++){const p=path.getPoint(j/160);assert.ok(allLandforms.every(d=>terrainHeight(d,p.x,p.z)<-2),id+' safe night approach');}}});
});
test('the hidden air pirate chapter persists, waits for the second fire and requires a crew conversation on the water',()=>{
 const saved=new Map<string,string>(),storage={getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,v);}};
 const journal=new FlightJournal(storage);
 assert.equal(journal.isRevealed(airPirateJobId),false);
 assert.equal(journal.accept(airPirateJobId,'cove'),false);
 assert.ok(journal.accept('post','harbor'));
 assert.ok(journal.update(.1,{x:coveCampSite.x,y:45,z:coveCampSite.z},true).some(m=>m.includes('隐藏委托')));
 assert.equal(journal.active?.id,'post');
 const loaded=new FlightJournal(storage);loaded.aircraft='mc72';
 assert.ok(loaded.isRevealed(airPirateJobId));assert.ok(loaded.accept(airPirateJobId,'cove'));
 assert.equal(loaded.stepCount,7);
 const atTarget=(j:FlightJournal,airborne:boolean,berth?:string,signal=false)=>{
  const step=j.storyStage!,p=storyStepTarget(step).position;
  j.update(.1,{...p,y:step.kind==='takeoff'?60:p.y},airborne,berth,160,0,signal);
 };
 atTarget(loaded,true);assert.equal(loaded.storyIndex,1);
 atTarget(loaded,true);assert.equal(loaded.pirateBoatVisible,false);
 atTarget(loaded,true,undefined,true);assert.equal(loaded.pirateBoatVisible,true);
 assert.equal(loaded.storyRequest,undefined);
 const boat=storyStepTarget(loaded.storyStage!).position;
 loaded.interruptForRecovery();
 assert.equal(loaded.active?.id,airPirateJobId);assert.equal(loaded.storyIndex,2);
 assert.equal(loaded.talkToPirateCrew(boat,false,0),undefined);
 assert.equal(loaded.talkToPirateCrew(boat,true,6),undefined);
 assert.equal(loaded.talkToPirateCrew({x:boat.x+60,z:boat.z},true,0),undefined);
 assert.match(loaded.talkToPirateCrew(boat,true,5)??'',/药品运单/);
 loaded.cancel();
 const resumed=new FlightJournal(storage);resumed.aircraft='m5';
 assert.ok(resumed.accept(airPirateJobId,'coral'));
 atTarget(resumed,true);assert.equal(resumed.storyIndex,3);
 resumed.update(.1,boat,false);
 atTarget(resumed,true);assert.ok(resumed.pirateWreckVisible);
 atTarget(resumed,true);atTarget(resumed,false,'cove');atTarget(resumed,false,'town');
 assert.ok(resumed.data.completed.includes(airPirateJobId));
 const credits=resumed.workshop.credits;assert.ok(credits>=250);
 assert.equal(resumed.accept(airPirateJobId,'cove'),false);assert.equal(resumed.workshop.credits,credits);
});

test('hotel evening visitors berth with warm running lamps and keep the cove free',()=>{
 const fleet=new SeaTraffic();fleet.setNightness(.7,20);fleet.update(0,()=>({height:0,dx:0,dz:0}));
 const guests=fleet.root.children.filter(o=>o.userData.route?.[1]==='hotel');
 assert.equal(guests.length,4);assert.ok(guests.every(o=>o.userData.nightMode==='moored'));
 assert.ok(fleet.root.children.filter(o=>o.userData.route).every(o=>!o.userData.route.includes('cove')));
});
