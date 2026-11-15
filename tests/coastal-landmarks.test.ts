import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {mooringSites} from '../src/world/Moorings.ts';
import {CoastalLandmarks} from '../src/world/CoastalLandmarks.ts';
import {coastalLandmarkSites} from '../src/world/CoastalLandmarkSites.ts';
import {islands,terrainHeight,harborRunway} from '../src/world/WorldConfig.ts';
import {buildSettlementLayout,plotCorners,nearRoad} from '../src/world/SettlementLayout.ts';

test('windmills have grounded foundations, clear roads and reserved building plots',()=>{
 for(const site of coastalLandmarkSites.filter(s=>s.kind==='windmill')){
  const d=islands.find(d=>d.id===site.island)!,layout=buildSettlementLayout(d);assert.ok(terrainHeight(d,site.x,site.z)>24);
  assert.ok(!layout.roads.some(r=>nearRoad(site.x,site.z,r,8)));
  for(const p of layout.houses)for(const c of plotCorners(p))assert.ok(Math.hypot(c.x-site.x,c.z-site.z)>site.radius);
 }
});

test('merged harbour landmarks stay finite, fit modest draw budgets and leave the base departure channel clear',()=>{
 const blockers:T.Box3[]=[],landmarks=new CoastalLandmarks(blockers);let draws=0,triangles=0;
 landmarks.root.updateMatrixWorld(true);landmarks.root.traverse(o=>{if(o instanceof T.Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));}});
 assert.ok(draws<=9);assert.ok(triangles<22000);
 assert.equal(coastalLandmarkSites.filter(s=>s.kind==='fishery').length,2);assert.equal(coastalLandmarkSites.filter(s=>s.kind==='windmill').length,9);
 for(const dz of[-55,0,55]){const ray=new T.Ray(new T.Vector3(harborRunway.x-30,1.05,harborRunway.z+dz),new T.Vector3(1,0,0)),hit=new T.Vector3();for(const b of blockers)assert.ok(!ray.intersectBox(b,hit)||hit.x>harborRunway.x+800);}
 for(const s of mooringSites.slice(0,2)){const ray=new T.Ray(s.berth.clone().setY(2),new T.Vector3(s.dx,0,s.dz)),hit=new T.Vector3();for(const b of blockers)assert.ok(!ray.intersectBox(b.clone().expandByScalar(7),hit)||hit.distanceTo(ray.origin)>110,s.id+' mooring approach stays clear');}
 const boat=landmarks.root.getObjectByName('Fishing quays / moored working boats') as T.InstancedMesh;assert.equal(boat.count,4);
 const sails=landmarks.root.getObjectByName('Coastal mills / rotating canvas sails / 2') as T.InstancedMesh;assert.ok(sails.count>=1);const first=new T.Matrix4();sails.getMatrixAt(0,first);landmarks.update(20,.35,()=>({height:.8,dx:.1,dz:.05}));const changed=new T.Matrix4();sails.getMatrixAt(0,changed);assert.notDeepEqual(first.elements,changed.elements);landmarks.update(20,.35,()=>({height:.8,dx:.1,dz:.05}));const frozen=new T.Matrix4();sails.getMatrixAt(0,frozen);assert.deepEqual(frozen.elements,changed.elements);
 const matrix=new T.Matrix4();boat.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[13]-1)<1e-6);landmarks.updateView(new T.Vector3(100000,0,100000));assert.ok(landmarks.root.children.filter(o=>o instanceof T.Group).every(o=>!o.visible));landmarks.warmView();assert.ok(landmarks.root.children.every(o=>o.visible));
});
