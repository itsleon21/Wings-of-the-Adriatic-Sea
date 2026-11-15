import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {coastalLandmarkSites} from '../src/world/CoastalLandmarkSites.ts';import {CoastalLandmarks} from '../src/world/CoastalLandmarks.ts';
import {buildSettlementLayout,houseKinds} from '../src/world/SettlementLayout.ts';import {SettlementRenderer} from '../src/world/SettlementRenderer.ts';
import {islands,hotelScale,hotelWidthScale,hotelElevation} from '../src/world/WorldConfig.ts';import {IslandSurface} from '../src/rendering/IslandSurface.ts';
import {TownHarborLights} from '../src/world/TownHarborLights.ts';import {createSettlementLightMap} from '../src/rendering/SettlementLightMap.ts';
import {createNightStars} from '../src/rendering/NightSky.ts';import {GardenHotel} from '../src/world/GardenHotel.ts';

test('all working windmill shafts face NE and six structural families share the same wind direction',()=>{
 const sites=coastalLandmarkSites.filter(s=>s.kind==='windmill');assert.equal(new Set(sites.map(s=>s.style)).size,6);for(const s of sites)assert.ok(Math.abs(s.angle-Math.PI*3/4)<1e-8);
 const model=new CoastalLandmarks([]),sails:T.InstancedMesh[]=[];model.root.traverse(o=>{if(o instanceof T.InstancedMesh&&o.name.startsWith('Coastal mills / rotating canvas sails'))sails.push(o);});assert.equal(sails.reduce((n,s)=>n+s.count,0),9);model.update(38,.4,()=>({height:0,dx:0,dz:0}));const m=new T.Matrix4();for(const mesh of sails)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);const axis=new T.Vector3(0,0,1).transformDirection(m);assert.ok(axis.distanceTo(new T.Vector3(Math.SQRT1_2,0,-Math.SQRT1_2))<1e-6);}
});
test('land and harbour markets have real halls and granaries, while mill-house families remain varied',()=>{
 const d=islands[1],layout=buildSettlementLayout(d),markets=layout.plazas.filter(p=>p.market);assert.equal(markets.length,3);
 for(const plaza of markets){const near=layout.houses.filter(p=>Math.hypot(p.x-plaza.x,p.z-plaza.z)<135);assert.ok(near.some(p=>p.kind==='HouseMarketHall'));assert.ok(near.some(p=>p.kind==='HouseGranary'));}
 for(const kind of['HouseMill','HouseMillTall','HouseMillSquare'])assert.ok(layout.houses.some(p=>p.kind===kind));
});
test('bespoke windmills retain architectural surface decoration and district illumination is night controlled',()=>{
 const d=islands[1],settlement=new SettlementRenderer(d,buildSettlementLayout(d),[]),kit=new Map<string,T.BufferGeometry>();for(const kind of houseKinds){const g=new T.BoxGeometry();g.setAttribute('surfaceAO',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(1),1));g.setAttribute('millPart',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count),1));kit.set(kind,g);}
 settlement.loadKit(kit,new T.MeshStandardMaterial({vertexColors:true}));const surface=new IslandSurface();surface.setNightLightSources(settlement.nightLampSites);surface.prepare(settlement.root);
 const mesh=settlement.root.getObjectByName('town / bespoke western European windmill buildings') as T.Mesh,material=mesh.material as T.MeshStandardMaterial,shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(shader as never,{} as T.WebGLRenderer);
 assert.ok(shader.vertexShader.includes('vIslandSurface'));assert.ok(shader.fragmentShader.includes('districtGlow'));surface.setNightness(1);assert.equal((shader.uniforms as Record<string,T.IUniform>).districtNight.value,1);surface.dispose();
});
test('each bay has two beacons, local warm water light and bounded stable real-light counts',()=>{
 const model=new TownHarborLights();assert.equal(model.bounds.length,4);assert.equal(model.waterLights.length,4);model.setNightness(0);assert.ok(model.waterLights.every(v=>v.w===0));model.setNightness(1);assert.ok(model.waterLights.every(v=>v.w===1));let count=0;model.root.traverse(o=>{if(o instanceof T.PointLight){count++;assert.equal(o.visible,true);assert.equal(o.castShadow,false);}});assert.equal(count,2);
 model.updateView(new T.Vector3(1e5,0,1e5));model.root.traverse(o=>{if(o instanceof T.PointLight){assert.equal(o.intensity,0);assert.equal(o.visible,true);}});
});
test('warm bounce atlas keeps distinct harbour tiles and decays away from street fixtures',()=>{
 const d=islands[0],map=createSettlementLightMap([{x:d.x,y:14.8,z:d.z}]),pixels=map.texture.image.data as Uint8Array,w=map.texture.image.width;assert.equal(w,512);assert.ok(pixels[(128*w+128)*4]>240);assert.equal(pixels[(128*w+384)*4],0);assert.equal(map.areas.length,2);map.texture.dispose();
});
test('night sky has a magnitude hierarchy, constellation landmarks, an inward visible Milky Way and intermittent meteors',()=>{
 const stars=createNightStars();assert.ok(stars.geometry.attributes.position.count>2000);const m=stars.geometry.attributes.magnitude;assert.ok(m.getX(0)<3);assert.ok(Array.from(m.array).some(v=>v>5));
 const dome=stars.getObjectByName('Night / faint galactic dust band') as T.Mesh,streaks=stars.getObjectByName('Night / occasional meteor trails') as T.LineSegments;assert.ok(dome&&streaks);assert.equal((dome.material as T.ShaderMaterial).side,T.FrontSide);assert.ok(!(dome.material as T.ShaderMaterial).fragmentShader.includes('curtains'));assert.ok(stars.geometry.attributes.position.count>12000);assert.equal((streaks.material as T.ShaderMaterial).uniforms.time,stars.material.uniforms.time);
});
test('Italian hotel details stay connected to existing garden and jetty without resizing its main architecture',()=>{
 const blockers:T.Box3[]=[],hotel=new GardenHotel(blockers);hotel.root.updateMatrixWorld(true);
 const flag=hotel.root.getObjectByName('Hotel / Italian tricolour at jetty') as T.Mesh,paving=hotel.root.getObjectByName('Hotel / vine pergola garden paving') as T.Mesh;assert.ok(flag&&paving);
 const b=new T.Box3().setFromObject(flag),size=b.getSize(new T.Vector3());assert.ok(Math.abs(size.x/size.y-1.5)<.02);assert.ok(b.min.y>0);
 const p=new T.Box3().setFromObject(paving);assert.ok(Math.abs(p.max.y-hotelElevation(27.525)*hotelScale)<.001);assert.ok(blockers.some(b=>b.containsPoint(new T.Vector3(hotel.root.position.x+46*hotelWidthScale*hotelScale,hotelElevation(31)*hotelScale,hotel.root.position.z-49*hotelScale))));
 assert.ok(hotel.root.getObjectByName('Hotel continuous tower shaft'));assert.equal(hotel.root.scale.x,hotelScale);
});
