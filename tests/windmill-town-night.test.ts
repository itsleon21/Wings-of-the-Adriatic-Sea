import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {islands,allLandforms,terrainHeight} from '../src/world/WorldConfig.ts';import {buildSettlementLayout} from '../src/world/SettlementLayout.ts';
import {WeatherController,morningFogWindow} from '../src/rendering/WeatherConfig.ts';import {SeaTraffic,vesselIslandScale} from '../src/world/SeaTraffic.ts';
import {FlightJournal} from '../src/journey/FlightJournal.ts';import {coveCampSite} from '../src/world/CoveCamp.ts';import {storyStepTarget} from '../src/journey/StoryMissions.ts';import {nightApproach} from '../src/world/HarborNavigation.ts';

test('10 percent horizontal reduction keeps island centres and three satellite mill houses outside the port',()=>{
 assert.equal(islands[0].rx,525*.9);assert.equal(islands[0].rz,450*.9);assert.equal(islands[1].rx,960*.9);assert.equal(islands[1].rz,650*.9);
 assert.equal(islands[0].x,-2400);assert.equal(islands[1].z,4900);const town=buildSettlementLayout(islands[1]);assert.ok(town.houses.filter(p=>p.kind.startsWith('HouseMill')).length===3);
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
test('hidden logbook requires discovery, persists, runs four stages, pays once and never hijacks another task',()=>{
 const saved=new Map<string,string>(),storage={getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,v);}},journal=new FlightJournal(storage);
 assert.equal(journal.isRevealed('secret'),false);assert.equal(journal.accept('secret','cove'),false);assert.ok(journal.accept('post','harbor'));
 const messages=journal.update(.1,{x:coveCampSite.x,y:45,z:coveCampSite.z},true);assert.ok(messages.some(m=>m.includes('隐藏委托')));assert.equal(journal.active?.id,'post');
 const loaded=new FlightJournal(storage);assert.ok(loaded.isRevealed('secret'));assert.ok(loaded.accept('secret','cove'));assert.equal(loaded.stepCount,4);
 for(let i=0;i<4;i++){const step=loaded.storyStage!,p=storyStepTarget(step).position;loaded.update(.1,{...p,y:step.kind==='takeoff'?60:p.y},step.kind!=='dock',step.kind==='dock'?step.island:undefined,180);}
 assert.ok(loaded.data.completed.includes('secret'));const credits=loaded.workshop.credits;assert.ok(credits>=250);assert.equal(loaded.accept('secret','cove'),false);assert.equal(loaded.workshop.credits,credits);
});

test('hotel evening visitors berth with warm running lamps and keep the cove free',()=>{
 const fleet=new SeaTraffic();fleet.setNightness(.7,20);fleet.update(0,()=>({height:0,dx:0,dz:0}));
 const guests=fleet.root.children.filter(o=>o.userData.route?.[1]==='hotel');
 assert.ok(guests.length>=6);assert.ok(guests.every(o=>o.userData.nightMode==='moored'));
 assert.ok(fleet.root.children.filter(o=>o.userData.route).every(o=>!o.userData.route.includes('cove')));
});
