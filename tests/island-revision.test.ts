import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {islands,allLandforms,terrainHeight,bayProfile,townPoint} from '../src/world/WorldConfig.ts';import {buildSettlementLayout} from '../src/world/SettlementLayout.ts';import {findMooring} from '../src/world/Moorings.ts';import {waterfrontPoint} from '../src/world/IslandDetails.ts';import {SeaTraffic} from '../src/world/SeaTraffic.ts';import {distantIslandGeometry} from '../src/world/SmallIslands.ts';import {World} from '../src/world/World.ts';
test('town terrain, buildings and berth rotate together towards the northeast',()=>{
 const d=islands[1],raw={...d,canonical:true};
 for(let i=0;i<70;i++){
  const x=d.x+Math.sin(i)*400,z=d.z+Math.cos(i)*400,p=townPoint(d,x,z);
  assert.ok(Math.abs(terrainHeight(d,p.x,p.z)-terrainHeight(raw,x,z))<1e-8);
 }
 const a=buildSettlementLayout(d),b=buildSettlementLayout(raw);
 a.houses.forEach((p,i)=>{const q=townPoint(d,b.houses[i].x,b.houses[i].z);assert.equal(p.x,q.x);assert.equal(p.z,q.z);assert.ok(Math.abs(p.ground-terrainHeight(d,p.x,p.z))<6.1);});
 const mooring=findMooring(d),old=findMooring(raw),berth=townPoint(d,old.berth.x,old.berth.z);
 assert.deepEqual([mooring.berth.x,mooring.berth.z],[berth.x,berth.z]);
 assert.ok(mooring.dx>0&&mooring.dz<0&&terrainHeight(d,berth.x,berth.z)<-3);
});
test('chart has no standalone reefs and their former sites are open water',()=>{
 assert.equal(allLandforms.length,8);
 const world=new World();
 for(const [x,z] of [[-5200,-4200],[4600,-4500],[4720,-4400],[860,-5475],[1520,-5260],[2360,-5395]]){
  assert.ok(world.heightAt(x,z)<0);
  assert.equal(world.collides(new T.Vector3(x,1,z),new T.Vector3(x+1,1,z)),false);
 }
 assert.equal(world.root.getObjectByName('North coast / fishing harbour and landing pier'),undefined);
 assert.equal(world.root.getObjectByName('North coast / stone house'),undefined);
 for(const species of ['pine','cypress']){
  const woodland=world.root.getObjectByName('North coast / '+species+' woodland');
  assert.ok(woodland instanceof T.InstancedMesh&&woodland.count>100);
 }
});
test('fleet has scheduled enlarged multicoloured sailboats and distant silhouettes vary reproducibly',()=>{const fleet=new SeaTraffic(),sail=fleet.root.children.filter(o=>o.name.endsWith('/ sailing'));assert.equal(sail.length,4);for(const boat of sail){assert.ok(boat.scale.x>=1.2);let cloth=0;boat.traverse(o=>{if(o instanceof T.Mesh&&(o.material as T.MeshStandardMaterial).side===T.DoubleSide)cloth++;});assert.equal(cloth,2);}const a=distantIslandGeometry(32),b=distantIslandGeometry(79),c=distantIslandGeometry(32);assert.deepEqual(a.attributes.position.array,c.attributes.position.array);assert.notDeepEqual(a.attributes.position.array,b.attributes.position.array);for(const n of a.attributes.normal.array)assert.ok(Number.isFinite(n));a.dispose();b.dispose();c.dispose();});

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
 assert.ok(d.x>coral.x&&d.z<coral.z&&d.x===islands[1].x&&d.z>islands[1].z);const ratio=(4*d.rx*d.rz-24*24)/(Math.PI*coral.rx*coral.rz);assert.ok(ratio>.02&&ratio<.035);
 const world=new World();assert.ok(world.root.getObjectByName('Garden Hotel / villa, sea walls and flowering garden'));
 assert.ok(world.collides(new T.Vector3(d.x+47,20,d.z),new T.Vector3(d.x+48,20,d.z)));
 const berth=mooringSites.find(s=>s.id==='hotel')!;assert.ok(berth.dx===1&&berth.berth.x>d.x);assert.ok(world.heightAt(berth.berth.x,berth.berth.z)<-2);assert.ok(!world.collides(berth.berth.clone().setY(2),berth.berth.clone().setY(3)));
});

test('the northern mainland crosses the chart edge, with sandy shelves and headlands',async()=>{
 const {northCoast,WorldBounds}=await import('../src/world/WorldConfig.ts');
 const {x,z,rx}=northCoast;
 const headland=terrainHeight(northCoast,2600,WorldBounds.minZ);
 assert.ok(headland>45&&headland<88);
 assert.ok(terrainHeight(northCoast,1570,WorldBounds.minZ)<0);
 assert.ok(terrainHeight(northCoast,1570,WorldBounds.minZ-650)>10);
 assert.ok(terrainHeight(northCoast,x,z+650)<-3);
 let sand=0,cliffs=0;
 for(let px=x-rx;px<x+rx;px+=20)for(let pz=WorldBounds.minZ;pz<z+620;pz+=10){
  const h=terrainHeight(northCoast,px,pz);
  if(h>0&&h<4)sand++;
  if(h>12&&h-terrainHeight(northCoast,px,pz+10)>4)cliffs++;
 }
 assert.ok(sand>70&&cliffs>35);

});
