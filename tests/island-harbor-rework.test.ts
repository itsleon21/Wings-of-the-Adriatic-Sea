import {townPoint} from '../src/world/WorldConfig.ts';
import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {islands,terrainHeight,coralIslets,coralReefLinks,allLandforms} from '../src/world/WorldConfig.ts';
import {bayShuttleCurve} from '../src/world/SeaTraffic.ts';import {breakwaterLayout} from '../src/world/IslandDetails.ts';
import {TownHarborLights} from '../src/world/TownHarborLights.ts';import {windmillArchitecture,windmillFamilies,windmillWindowPanes} from '../src/world/WindmillArchitecture.ts';
import {SettlementRenderer} from '../src/world/SettlementRenderer.ts';import {buildSettlementLayout,plotsOverlap,roadIntersectsPlot} from '../src/world/SettlementLayout.ts';
import {churchSite} from '../src/world/ChurchSite.ts';import {addMediterraneanPlants,plantSpecies} from '../src/world/MediterraneanPlants.ts';
import {mooringSites} from '../src/world/Moorings.ts';import {addOutpostIslands} from '../src/world/ArchipelagoDetails.ts';

test('bay shuttles use distinct reproducible curved tracks in the water between the two facing bays',()=>{
 const midpoints:T.Vector3[]=[];
 for(let n=0;n<7;n++){
  const curve=bayShuttleCurve(417+n*113),again=bayShuttleCurve(417+n*113);assert.deepEqual(curve.getPoint(.4),again.getPoint(.4));midpoints.push(curve.getPoint(.5));
  for(let i=0;i<=240;i++){const p=curve.getPoint(i/240);assert.ok(p.x>islands[1].x&&p.x<islands[0].x,'service stays between the relocated bays');for(const d of allLandforms)for(const dx of[-24,24])for(const dz of[-24,24])assert.ok(terrainHeight(d,p.x+dx,p.z+dz)<-3);}
 }
 assert.ok(Math.max(...midpoints.map(p=>p.x))-Math.min(...midpoints.map(p=>p.x))>60);
});
test('six windmill structural families have bounded real geometry and each seeded building differs',()=>{
 const signatures=new Set<string>();assert.equal(windmillFamilies.length,6);
 for(let f=0;f<6;f++){
  const a=windmillArchitecture(f,817+f),b=windmillArchitecture(f,875+f);a.geometry.computeBoundingBox();const box=a.geometry.boundingBox!;
  assert.ok(box.min.y>=-.52&&box.max.y<=1.14);assert.ok(box.min.x>=-.65&&box.max.x<=.65&&box.min.z>=-.65&&box.max.z<=.65);
  assert.ok(a.hubY>.63&&a.hubY<.80);assert.ok(a.geometry.attributes.position.count/3<1600);assert.notDeepEqual(a.geometry.attributes.position.array,b.geometry.attributes.position.array);
  signatures.add(JSON.stringify([a.geometry.attributes.position.count,box.min.toArray(),box.max.toArray()]));
  for(const value of a.geometry.attributes.normal.array)assert.ok(Number.isFinite(value));a.geometry.dispose();b.geometry.dispose();
 }assert.equal(signatures.size,6);
});
test('windmill night panes lie on the new glass surfaces rather than floating at retired window positions',()=>{
 for(let f=0;f<6;f++){const seed=817+f,model=windmillArchitecture(f,seed),mesh=new T.Mesh(model.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
  for(const p of windmillWindowPanes(f,seed)){const ray=new T.Raycaster(new T.Vector3(p.x,p.y,p.z+.03),new T.Vector3(0,0,-1),0,.05),hit=ray.intersectObject(mesh)[0];assert.ok(hit,model.family);assert.ok(Math.abs(hit.point.z-p.z)<.003,model.family+' window remains attached to glass');}
 }
});
test('mill-house sails face across the bay and compact mill profiles fit their reserved plots',()=>{
 const d=islands[1],layout=buildSettlementLayout(d),mills=layout.houses.filter(p=>p.kind.startsWith('HouseMill'));assert.ok(mills.some(p=>p.height<12)&&mills.some(p=>p.height>18));
 const settlement=new SettlementRenderer(d,layout,[]),sails=settlement.root.children.filter(o=>o.name.includes('/ working mill-house sails /')) as T.InstancedMesh[];
 assert.equal(sails.reduce((n,m)=>n+m.count,0),mills.length);const first=new T.Matrix4();sails[0].getMatrixAt(0,first);settlement.updateTime(3);const changed=new T.Matrix4();sails[0].getMatrixAt(0,changed);assert.notDeepEqual(changed.elements,first.elements);
 for(const s of sails)for(let i=0;i<s.count;i++){s.getMatrixAt(i,changed);const axis=new T.Vector3(0,0,1).transformDirection(changed);
  assert.ok(mills.some(p=>{const bay=townPoint(d,d.x,d.z+.79*d.rz),yaw=Math.atan2(bay.x-p.x,bay.z-p.z)+Math.PI/9;return Math.hypot(p.x-changed.elements[12],p.z-changed.elements[14])<Math.max(p.width,p.depth)*.46&&axis.distanceTo(new T.Vector3(Math.sin(yaw),0,Math.cos(yaw)))<1e-6;}));}
 for(const island of islands.slice(0,2)){const l=buildSettlementLayout(island),nearest=l.houses.map(p=>Math.min(...l.houses.filter(q=>q!==p).map(q=>Math.hypot(p.x-q.x,p.z-q.z))));assert.ok(nearest.filter(n=>n<42).length/l.houses.length>.75);for(const p of l.houses){for(const q of l.houses)if(q!==p)assert.equal(plotsOverlap(p,q),false);for(const r of l.roads)assert.equal(roadIntersectsPlot(r,p),false);}}
});
test('bay beacon foundations coincide with shared, capped breakwater ends',()=>{
 const lights=new TownHarborLights(),tips=islands.slice(0,2).flatMap(breakwaterLayout);assert.equal(tips.length,4);
 tips.forEach((a,i)=>{const b=lights.bounds[i];assert.ok(Math.abs((b.min.x+b.max.x)/2-a.tip.x)<1e-8);assert.ok(Math.abs((b.min.z+b.max.z)/2-a.tip.z)<1e-8);assert.equal(b.min.y,a.deckY);});
});
test('both churches sit on supported mid-slope foundations outside house plots',()=>{
 for(const d of islands.slice(0,2)){const site=churchSite(d);assert.ok(site.low>d.height*.23&&site.y<d.height*.67);assert.ok(site.y-site.low<8.5);for(const p of buildSettlementLayout(d).houses)assert.ok(Math.hypot(p.x-site.x,p.z-site.z)>43);}
});
test('pine footprint expands over the previous smaller island and the lighthouse has one mooring jetty',()=>{
 const pine=islands.find(d=>d.id==='pine')!;assert.ok(pine.rx*pine.rz/(410*380*.5)>1.45);assert.equal(mooringSites.filter(s=>s.id==='lighthouse').length,1);
 const root=new T.Group();addOutpostIslands(root,[]);root.traverse(o=>{if(o instanceof T.Mesh&&o.geometry instanceof T.BoxGeometry)assert.notDeepEqual([o.geometry.parameters.width,o.geometry.parameters.height,o.geometry.parameters.depth],[6,1.2,45]);});
});
test('coral has exactly three dry islets, separated by submerged reef links with a larger total land area',()=>{
 const d=islands.find(d=>d.id==='coral')!,n=180,mask=new Uint8Array(n*n),visited=new Uint8Array(n*n);let dry=0;
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const h=terrainHeight(d,d.x-d.rx+(x+.5)/n*d.rx*2,d.z-d.rz+(z+.5)/n*d.rz*2);if(h>0){mask[z*n+x]=1;dry++;}}
 const components:number[]=[];for(let i=0;i<mask.length;i++)if(mask[i]&&!visited[i]){const queue=[i];visited[i]=1;for(let j=0;j<queue.length;j++){const k=queue[j],x=k%n,z=Math.floor(k/n);for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,zz=z+dz,t=zz*n+xx;if(xx>=0&&zz>=0&&xx<n&&zz<n&&mask[t]&&!visited[t]){visited[t]=1;queue.push(t);}}}if(queue.length>10)components.push(queue.length);}
 assert.equal(components.length,3);assert.ok(dry/n/n*(d.rx*2)*(d.rz*2)>125000);
 for(const [a,b] of coralReefLinks){const p=coralIslets[a],q=coralIslets[b],h=terrainHeight(d,d.x+(p.x+q.x)*.5*d.rx,d.z+(p.z+q.z)*.5*d.rz);assert.ok(h<0&&h>-3);}
});
test('large islands support denser stands and seventeen species in shared batches',()=>{
 const root=new T.Group();let update!:(position:T.Vector3)=>void;
 const counts=addMediterraneanPlants(root,()=>false,callback=>update=callback);
 assert.equal(plantSpecies.length,17);
 for(const id of['harbor','town']){
  for(const species of plantSpecies)assert.ok((counts[id][species]??0)>0,species);
  assert.ok(Object.values(counts[id]).reduce((sum,count)=>sum+count,0)>900);
 }
 // One batch per species, trunks and the shared near-leaf draw.
 assert.ok(root.children.length<=plantSpecies.length+2);
 const leaves=root.getObjectByName('Mediterranean vegetation / nearby leaf cards') as T.InstancedMesh;
 update(new T.Vector3(islands[0].x,15,islands[0].z-200));assert.ok(leaves.count>0&&leaves.count<leaves.instanceMatrix.count);
 update(new T.Vector3(islands[0].x,900,islands[0].z-200));assert.equal(leaves.count,0);
});
