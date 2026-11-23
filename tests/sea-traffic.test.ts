import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {SeaTraffic,buildTrafficRoutes,trafficWater,harborVesselSites,localTrafficRoutes,trafficSchedule} from '../src/world/SeaTraffic.ts';import {islands,allLandforms,terrainHeight} from '../src/world/WorldConfig.ts';
test('traffic connects the six public islands along safe routes',()=>{
 const routes=buildTrafficRoutes(),connected=new Set(routes.flatMap(r=>[r.from,r.to]));
 assert.deepEqual(connected,new Set(islands.filter(d=>d.id!=='cove').map(d=>d.id).concat('hotel')));
for(const r of routes)for(let i=0;i<=400;i++){const p=r.curve.getPointAt(i/400);assert.ok(trafficWater(p.x,p.z),`${r.from}/${r.to} unsafe ${p.x},${p.z}`);assert.ok(allLandforms.every(d=>terrainHeight(d,p.x,p.z)<-2));}});
test('scheduled vessels move on shared sea height, keep collision bounds and are deterministic for a frozen clock',()=>{const fleet=new SeaTraffic(),water=()=>({height:.6,dx:.04,dz:-.03});assert.equal(fleet.bounds.length,trafficSchedule.reduce((n,r)=>n+r[2],0)+harborVesselSites().length+localTrafficRoutes().length);fleet.update(20,water);const before=fleet.root.children.map(o=>o.position.clone());fleet.update(20,water);fleet.root.children.forEach((o,i)=>{assert.ok(o.position.equals(before[i]));assert.equal(o.position.y,.6);assert.ok(fleet.bounds[i].containsPoint(o.position));});const turnTime=fleet.routes[0].curve.getLength()/7.2+30;fleet.update(turnTime-.001,water);const turnPosition=fleet.root.children[0].position.clone(),turnAttitude=fleet.root.children[0].quaternion.clone();fleet.update(turnTime+.001,water);assert.ok(fleet.root.children[0].position.distanceTo(turnPosition)<.1);assert.ok(fleet.root.children[0].quaternion.angleTo(turnAttitude)<.01);fleet.update(40,water);assert.ok(fleet.root.children.some((o,i)=>o.position.distanceTo(before[i])>10));});

test('detailed marine models stay within vessel collision clearances with finite normals and batched fittings',async()=>{
 const {buildVessel}=await import('../src/world/VesselModel.ts');
 for(const [i,kind] of(['ferry','fishing','sailing'] as const).entries()){
  const boat=buildVessel(kind,i,new T.MeshBasicMaterial()),bounds=new T.Box3().setFromObject(boat),scale=kind==='ferry'?1.55:kind==='fishing'?1.45:1.65;
  assert.ok(bounds.min.x*scale>=-20&&bounds.max.x*scale<=20);
  assert.ok(bounds.min.z*scale>=-20&&bounds.max.z*scale<=20);
  assert.ok(bounds.min.y*scale>=-2&&bounds.max.y*scale<=(kind==='sailing'?27:10));
  let meshes=0,triangles=0;boat.traverse(o=>{if(o instanceof T.Mesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const v of o.geometry.attributes.normal.array)assert.ok(Number.isFinite(v));}});
  assert.ok(meshes<18&&triangles>1500);
 }
});

 test('inner bays each contain three separated safe moored vessels away from aircraft berths',async()=>{const {mooringSites}=await import('../src/world/Moorings.ts');const {inTakeoffChannel}=await import('../src/world/IslandDetails.ts');const sites=harborVesselSites();for(const id of ['harbor','town']){const group=sites.filter(s=>s.island===id),d=islands.find(d=>d.id===id)!;assert.equal(group.length,3);for(const site of group){assert.equal(inTakeoffChannel(d,site.x,site.z,45),false);for(const m of mooringSites)assert.ok(Math.hypot(m.berth.x-site.x,m.berth.z-site.z)>=90);for(const dx of [-25,0,25])for(const dz of [-25,0,25])assert.ok(terrainHeight(d,site.x+dx,site.z+dz)<-2);}}});
 test('commercial routes are denser than nature routes and six bay boats remain anchored',()=>{const fleet=new SeaTraffic();assert.ok(fleet.routes.find(r=>r.from==='harbor'&&r.to==='town')!.count>fleet.routes.find(r=>r.to==='pine')!.count);const moored=fleet.root.children.filter(o=>o.userData.harbor);assert.equal(moored.length,6);const before=moored.map(o=>o.position.clone());fleet.update(500,()=>({height:0,dx:0,dz:0}));moored.forEach((o,i)=>{assert.equal(o.position.x,before[i].x);assert.equal(o.position.z,before[i].z);});});

test('each mooring has a local service lane outside the aircraft approach and berth clearance',async()=>{const {mooringSites}=await import('../src/world/Moorings.ts');const {allLandforms}=await import('../src/world/WorldConfig.ts');const routes=localTrafficRoutes();assert.equal(new Set(routes.map(r=>r.island)).size,mooringSites.length);for(const route of routes)for(let i=0;i<=100;i++){const p=route.curve.getPoint(i/100);assert.ok(allLandforms.every(d=>terrainHeight(d,p.x,p.z)<-3));for(const m of mooringSites){const dx=p.x-m.berth.x,dz=p.z-m.berth.z;assert.ok(Math.hypot(dx,dz)>130);assert.ok(!(Math.abs(dx*m.dz-dz*m.dx)<110&&dx*m.dx+dz*m.dz>-80&&dx*m.dx+dz*m.dz<600));}}});

test('scheduled hulls keep their separation and stay in water through a full day and night',()=>{
 const fleet=new SeaTraffic(),water=()=>({height:0,dx:0,dz:0});
 const boats=fleet.root.children.filter(o=>o.userData.route);
 for(const hour of [12,23]){
  fleet.setNightness(hour===23?1:0,hour);
  for(let time=0;time<7100;time+=13){
   fleet.update(time,water);
   for(const [i,boat] of boats.entries()){
    const {x,z}=boat.position;
    assert.ok([-19,19].every(dx=>[-19,19].every(dz=>allLandforms.every(d=>terrainHeight(d,x+dx,z+dz)<-2))),boat.name);
    for(let j=i+1;j<boats.length;j++)assert.ok(boat.position.distanceTo(boats[j].position)>=42,boat.name+' / '+boats[j].name);
   }
  }
 }
});
