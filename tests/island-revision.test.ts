import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {islands,reefs,allLandforms,terrainHeight,bayProfile} from '../src/world/WorldConfig.ts';import {buildSettlementLayout} from '../src/world/SettlementLayout.ts';import {findMooring} from '../src/world/Moorings.ts';import {waterfrontPoint} from '../src/world/IslandDetails.ts';import {SeaTraffic} from '../src/world/SeaTraffic.ts';import {distantIslandGeometry} from '../src/world/SmallIslands.ts';import {World} from '../src/world/World.ts';
test('town geometry, buildings and berth share the same 180 degree rotation towards the base',()=>{const d=islands[1],raw={...d,canonical:true};for(let i=0;i<70;i++){const x=d.x+Math.sin(i)*400,z=d.z+Math.cos(i*2)*400;assert.ok(Math.abs(terrainHeight(d,x,z)-terrainHeight(raw,2*d.x-x,2*d.z-z))<1e-8);}const a=buildSettlementLayout(d),b=buildSettlementLayout(raw);a.houses.forEach((p,i)=>{assert.equal(p.x,2*d.x-b.houses[i].x);assert.equal(p.z,2*d.z-b.houses[i].z);assert.ok(Math.abs(p.ground-terrainHeight(d,p.x,p.z))<6.1);});const berth=findMooring(d),old=findMooring(raw);assert.equal(berth.berth.z,2*d.z-old.berth.z);assert.ok(berth.berth.z<d.z);const shore=waterfrontPoint(d,-Math.PI/2,-30);assert.ok(shore.z<d.z);assert.ok(terrainHeight(d,berth.berth.x,berth.berth.z)<-3);});
test('three small reefs have visible dry land and participate in rendered terrain and collision',()=>{assert.equal(reefs.length,3);assert.equal(allLandforms.length,10);const world=new World();for(const d of reefs){let peak=-30;for(let x=-.8;x<.9;x+=.1)for(let z=-.8;z<.9;z+=.1)peak=Math.max(peak,terrainHeight(d,d.x+x*d.rx,d.z+z*d.rz));assert.ok(peak>4&&peak<=d.height);assert.ok(world.root.getObjectByName(`${d.name} / continuous limestone terrain`));assert.ok(world.heightAt(d.x,d.z)>0);assert.ok(world.collides(new T.Vector3(d.x,1,d.z),new T.Vector3(d.x+1,1,d.z)));}});
test('fleet has scheduled enlarged multicoloured sailboats and distant silhouettes vary reproducibly',()=>{const fleet=new SeaTraffic(),sail=fleet.root.children.filter(o=>o.name.endsWith('/ sailing'));assert.equal(sail.length,9);for(const boat of sail){assert.ok(boat.scale.x>=1.2);let cloth=0;boat.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.MeshStandardMaterial).side===T.DoubleSide)cloth++;});assert.equal(cloth,2);}const a=distantIslandGeometry(32),b=distantIslandGeometry(79),c=distantIslandGeometry(32);assert.deepEqual(a.attributes.position.array,c.attributes.position.array);assert.notDeepEqual(a.attributes.position.array,b.attributes.position.array);for(const n of a.attributes.normal.array)assert.ok(Number.isFinite(n));a.dispose();b.dispose();c.dispose();});

test('town expands into a broad shallow waterfront with substantially more clustered housing than the compact base',()=>{
 const [base,town]=islands,bb=bayProfile(base),tb=bayProfile(town);
 assert.ok(town.rx*town.rz>base.rx*base.rz*1.8);
 assert.ok(town.rx*tb.rx/(town.rz*tb.rz)>2);
 assert.ok(base.rx*bb.rx/(base.rz*bb.rz)<1.2);
 const a=buildSettlementLayout(base),b=buildSettlementLayout(town);
 assert.ok(b.houses.length>=130&&b.houses.length>a.houses.length*1.8);
 assert.ok(b.roads.length>a.roads.length);
});

test('hotel island lies northeast of Coral, has a narrow garden footprint and a usable water berth',async()=>{
 const {hotelIsland}=await import('../src/world/WorldConfig.ts');const {mooringSites}=await import('../src/world/Moorings.ts');const coral=islands.find(d=>d.id==='coral')!,d=hotelIsland;
 assert.ok(d.x>coral.x&&d.z<coral.z);const ratio=(4*d.rx*d.rz-24*24)/(Math.PI*coral.rx*coral.rz);assert.ok(ratio>.02&&ratio<.035);
 const world=new World();assert.ok(world.root.getObjectByName('Garden Hotel / villa, sea walls and flowering garden'));
 assert.ok(world.collides(new T.Vector3(d.x,20,d.z+47),new T.Vector3(d.x,20,d.z+48)));
 const berth=mooringSites.find(s=>s.id==='hotel')!;assert.ok(world.heightAt(berth.berth.x,berth.berth.z)<-2);assert.ok(!world.collides(berth.berth.clone().setY(2),berth.berth.clone().setY(3)));
});
