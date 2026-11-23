import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {limestoneGeometry} from '../src/world/LimestoneGeometry.ts';
import {leafClusterGeometry} from '../src/world/FoliageDetail.ts';
import {createSettlementOcclusion} from '../src/rendering/SettlementOcclusion.ts';
import {instrumentAngle} from '../src/aircraft/CockpitInstruments.ts';
import {PackedSunShadows} from '../src/rendering/PackedSunShadows.ts';
import {islands} from '../src/world/WorldConfig.ts';
import type {HousePlot} from '../src/world/SettlementLayout.ts';

test('coastal limestone is a closed, finite solid suitable for visible near-field rocks',()=>{
 const g=limestoneGeometry(),p=g.attributes.position,n=g.attributes.normal,edges=new Map<string,number>();
 const index=g.index!;
 for(let i=0;i<index.count;i+=3){
  const triangle=[index.getX(i),index.getX(i+1),index.getX(i+2)];
  const a=new T.Vector3().fromBufferAttribute(p,triangle[0]),b=new T.Vector3().fromBufferAttribute(p,triangle[1]),c=new T.Vector3().fromBufferAttribute(p,triangle[2]);
  assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-10,'no collapsed faces');
  for(let k=0;k<3;k++){const edge=[triangle[k],triangle[(k+1)%3]].sort((a,b)=>a-b).join(':');edges.set(edge,(edges.get(edge)??0)+1);}
 }
 assert.ok([...edges.values()].every(count=>count===2),'every edge joins exactly two faces');
 for(let i=0;i<n.count;i++)assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)));
 assert.ok(g.boundingBox!.min.y<=-1&&g.boundingBox!.max.y>=1);
 g.dispose();
});

test('close foliage uses cutout geometry within a bounded triangle budget',()=>{
 const g=leafClusterGeometry();g.computeBoundingBox();assert.ok(g.index!.count/3<120);
 assert.equal(g.attributes.uv.count,g.attributes.position.count);
 for(const v of g.attributes.normal.array)assert.ok(Number.isFinite(v));
 assert.ok(g.boundingBox!.min.y<-.5&&g.boundingBox!.max.y>.5);
 g.dispose();
});

test('contact bake follows rotated footprint and stores the physical foundation height',()=>{
 const d=islands.find(i=>i.id==='harbor')!;
 const plot:HousePlot={kind:'HouseArcade',district:'waterfront',x:d.x,z:d.z,ground:36.25,low:35,width:30,depth:8,height:15,angle:Math.PI/2,tint:[1,1,1]};
 const bake=createSettlementOcclusion([plot]),pixels=bake.texture.image.data as Uint8Array,area=bake.areas[0];
 const sample=(x:number,z:number)=>{
  const px=T.MathUtils.clamp(Math.floor((x-area.x)/area.z*512+256),0,511),py=T.MathUtils.clamp(Math.floor((z-area.y)/area.w*512+256),0,511),k=(py*1024+px)*4;
  return [pixels[k],(pixels[k+1]*256+pixels[k+2])/65535*400-20];
 };
 assert.ok(sample(d.x,d.z+10)[0]>100,'rotated long side remains occluded');
 assert.ok(sample(d.x+14,d.z)[0]<15,'short side falls away quickly');
 assert.ok(sample(d.x+60,d.z+60)[0]===0,'no uniform dark veil over the district');
 assert.ok(Math.abs(sample(d.x,d.z)[1]-plot.ground)<.01);
 bake.texture.dispose();
});

test('cockpit instruments sweep clockwise, clamp safely and start below the horizon',()=>{
 assert.equal(instrumentAngle(0,300),225*Math.PI/180);
 assert.equal(instrumentAngle(300,300),-45*Math.PI/180);
 assert.equal(instrumentAngle(-20,300),instrumentAngle(0,300));
 assert.equal(instrumentAngle(Infinity,300),instrumentAngle(0,300));
 assert.ok(instrumentAngle(150,300)<instrumentAngle(50,300));
});

test('dedicated aircraft shadow isolates casters and restores scene visibility',()=>{
 const shadows=new PackedSunShadows(),scene=new T.Scene(),world=new T.Group(),aircraft=new T.Group();
 const ground=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()),plane=ground.clone(),glass=ground.clone();
 ground.castShadow=plane.castShadow=true;glass.castShadow=false;world.add(ground);aircraft.add(plane,glass);scene.add(world,aircraft);shadows.setAircraft(aircraft);
 const renders:{world:boolean;aircraft:boolean;glass:boolean}[]=[];
 const renderer={getRenderTarget:()=>null,getClearColor:(c:T.Color)=>c.set(0),getClearAlpha:()=>1,autoClear:false,setClearColor:()=>{},setRenderTarget:()=>{},clear:()=>{},render:()=>{renders.push({world:world.visible,aircraft:aircraft.visible,glass:glass.visible});}} as unknown as T.WebGLRenderer;
 shadows.update(renderer,scene,new T.Vector3(),new T.Vector3(-.5,.8,.3).normalize(),1/60);
 assert.equal(renders.length,3);assert.equal(renders[0].aircraft,false);assert.equal(renders[1].aircraft,false);
 assert.deepEqual(renders[2],{world:false,aircraft:true,glass:false});
 assert.equal(world.visible,true);assert.equal(aircraft.visible,true);assert.equal(glass.visible,true);assert.equal(renderer.autoClear,false);assert.equal(scene.overrideMaterial,null);
 shadows.dispose();ground.geometry.dispose();(ground.material as T.Material).dispose();
});
