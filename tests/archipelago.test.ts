import {test} from 'node:test';import assert from 'node:assert/strict';import {Group,Mesh} from 'three';
import {islands,terrainHeight,WorldBounds} from '../src/world/WorldConfig.ts';
import {buildSettlementLayout} from '../src/world/SettlementLayout.ts';
import {addCoralBiome} from '../src/world/ArchipelagoDetails.ts';

test('all six islands fit the extended chart and the five rebuilt footprints follow the reference',()=>{
 assert.equal(islands.length,6);assert.equal(WorldBounds.size,12000);
 for(const [id,width,depth,height] of[['harbor',945,810,145],['town',1728*Math.sqrt(.8),1170*Math.sqrt(.8),126],['lighthouse',620*Math.sqrt(.6),700*Math.sqrt(.6),130],['pine',730,638,92],['coral',900,740,24]] as const){
  const d=islands.find(d=>d.id===id)!;assert.equal(d.rx*2,width);assert.equal(d.rz*2,depth);assert.equal(d.height,height);
 }
});
test('village main roads climb inland on dry ground without crossing steep cliff faces',()=>{
 for(const d of islands.slice(0,2)){
  const path=buildSettlementLayout(d).roads[1].points;assert.ok(path.length>20);
  const start=path[0],end=path.at(-1)!;assert.ok(terrainHeight(d,end.x,end.z)-terrainHeight(d,start.x,start.z)>20);
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],length=Math.hypot(a.x-b.x,a.z-b.z);if(length<.01)continue;
   for(let j=0;j<=4;j++){const t=j/4;assert.ok(terrainHeight(d,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t)>2.5);}
   const grade=Math.abs(terrainHeight(d,a.x,a.z)-terrainHeight(d,b.x,b.z))/length;assert.ok(grade<.25,`${d.id}: ${grade}`);
  }
 }
});
test('coral cay stays low and sandy while pine island has a substantial wooded upland',()=>{
 const coral=islands.find(d=>d.id==='coral')!,pine=islands.find(d=>d.id==='pine')!;let beach=0,land=0,upland=0;
 for(let x=-coral.rx;x<=coral.rx;x+=10)for(let z=-coral.rz;z<=coral.rz;z+=10){const h=terrainHeight(coral,coral.x+x,coral.z+z);assert.ok(h<=24);if(h>0){land++;if(h<7)beach++;}}
 assert.ok(beach/land>.5);
 for(let x=-pine.rx;x<pine.rx;x+=20)for(let z=-pine.rz;z<pine.rz;z+=20)if(terrainHeight(pine,pine.x+x,pine.z+z)>46)upland++;
 assert.ok(upland>100);
 const beacon=islands[2],summit=terrainHeight(beacon,beacon.x,beacon.z);
 assert.equal(summit,beacon.height);
 for(let dx=-beacon.rx;dx<beacon.rx;dx+=10)for(let dz=-beacon.rz;dz<beacon.rz;dz+=10){
  assert.ok(terrainHeight(beacon,beacon.x+dx,beacon.z+dz)<=summit);
 }
});
test('coral palms have finite curved trunks and drooping fronds with grounded bounds',()=>{
 const root=new Group(),d=islands.find(d=>d.id==='coral')!;addCoralBiome(root,d);
 const trunk=root.getObjectByName('珊瑚小岛 / curved palm trunks') as Mesh,fronds=root.getObjectByName('珊瑚小岛 / drooping palm fronds') as Mesh;
 assert.ok(trunk&&fronds);assert.ok(fronds.geometry.attributes.position.count>20000);
 for(const mesh of[trunk,fronds]){mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox!;assert.ok(b.min.y>=0&&b.max.y<65);for(const v of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(v));mesh.geometry.dispose();}
});

test('the lighthouse road joins the jetty deck and winds uphill to the summit steps',async()=>{
 const {lighthouseTrail,buildLighthouseTrail,lighthouseTrailEnd}=await import('../src/world/LighthouseTrail.ts');
 const {terrainSurfaceHeight}=await import('../src/world/TerrainSurface.ts');
 const {mooringSites}=await import('../src/world/Moorings.ts');
 const d=islands.find(island=>island.id==='lighthouse')!;
 const jetty=mooringSites.find(site=>site.id===d.id)!;
 const points=lighthouseTrail(d,jetty),road=buildLighthouseTrail(d,points,jetty);
 const positions=road.geometry.attributes.position;
 assert.deepEqual(points[0].toArray(),[jetty.shoreX,jetty.shoreZ]);
 assert.ok(Math.abs(positions.getY(2)-3.3)<1e-5);
 assert.deepEqual(points.at(-1)!.toArray(),[d.x,d.z+lighthouseTrailEnd]);
 assert.ok(points.every(p=>terrainSurfaceHeight(d,p.x,p.y)>0));
 assert.ok(positions.getY(positions.count-3)>d.height-5);
 const length=points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0);
 assert.ok(length>2.5*Math.hypot(jetty.shoreX-d.x,jetty.shoreZ-d.z));
 road.geometry.dispose();road.material.dispose();
 const coral=mooringSites.find(site=>site.id==='coral')!;
 assert.equal(coral.dz,-1);
 assert.ok(coral.shoreZ<islands.find(island=>island.id==='coral')!.z);
});
