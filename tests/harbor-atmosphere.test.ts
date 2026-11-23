import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {World} from '../src/world/World.ts';import {islands,townPoint} from '../src/world/WorldConfig.ts';import {inTownHarborApproach,townBreakwaterArms} from '../src/world/IslandDetails.ts';import {createCloudLayout} from '../src/rendering/CloudLayout.ts';import {daylightAt,timePresets} from '../src/rendering/TimeOfDay.ts';
test('town harbour water approach has no decorative rock instances and retains rear coastline rocks',()=>{const world=new World(),d=islands.find(i=>i.id==='town')!,rocks=world.root.getObjectByName(d.name+' / exposed coastal rocks') as T.InstancedMesh;assert.ok(rocks.count>0);const m=new T.Matrix4(),p=new T.Vector3();for(let i=0;i<rocks.count;i++){rocks.getMatrixAt(i,m);p.setFromMatrixPosition(m);assert.equal(inTownHarborApproach(d,p.x,p.z,25),false);}const mouth=townPoint(d,d.x,d.z+d.rz);assert.ok(inTownHarborApproach(d,mouth.x,mouth.z));assert.equal(townBreakwaterArms.length,2);const ends=townBreakwaterArms.map(a=>a.at(-1)!);assert.ok(Math.abs(ends[0][0]-ends[1][0])*d.rx>500);const lights=world.root.getObjectByName('Harbour entrances / four illuminated small lighthouses')!;assert.equal(lights.children.filter(o=>o instanceof T.Sprite).length,4);});
test('sunrise has distinctly cooler direct light than sunset at the same solar elevation, continuously through noon',()=>{const dawn=daylightAt(timePresets.morning.hour),dusk=daylightAt(timePresets.dusk.hour);assert.ok(Math.abs(dawn.solarElevation-dusk.solarElevation)<1e-8);assert.ok(dawn.color[1]-dusk.color[1]>.09);assert.ok(dawn.color[2]-dusk.color[2]>.08);const a=daylightAt(11.999),b=daylightAt(12.001);assert.ok(Math.abs(a.color[2]-b.color[2])<.001);});
test('cloudy sky preserves low and elevated volumetric cloud layers over open sea',()=>{const cells=createCloudLayout(713);assert.ok(cells.some(c=>c.y>2300));assert.ok(cells.some(c=>c.y<500));assert.ok(cells.some(c=>c.island));assert.ok(new Set(cells.map(c=>c.shape)).size>=5);});

test('the marine horizon cools after sunset and stays blue at night in every weather',async()=>{
 const {horizonRadiance}=await import('../src/rendering/Daylight.ts');
 const {weatherPresets}=await import('../src/rendering/WeatherConfig.ts');
 const tint=(hour:number,weather=weatherPresets.sunny)=>{
  const clock=daylightAt(hour);
  const afterSunset=hour>=16?1-T.MathUtils.smoothstep(clock.solarElevation,-.076,.018):0;
  return horizonRadiance(new T.Color(),weather,clock,afterSunset);
 };
 const dusk=tint(timePresets.dusk.hour);
 assert.ok(dusk.r>dusk.b);
 assert.ok(tint(18.55).b>tint(18.55).r);
 for(const weather of Object.values(weatherPresets))for(const hour of [19,23,0,5]){
  const night=tint(hour,weather);
  assert.ok(night.r<night.g&&night.g<night.b&&night.b<=.016);
 }
});
