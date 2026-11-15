import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {islands,terrainHeight} from '../src/world/WorldConfig.ts';
import {houseKinds,buildSettlementLayout} from '../src/world/SettlementLayout.ts';
import {SettlementRenderer} from '../src/world/SettlementRenderer.ts';
import {ReflectionBlend,reflectionHours,reflectionInterval} from '../src/rendering/ReflectionBlend.ts';
import {FrameMetrics} from '../src/game/FrameMetrics.ts';

test('town has substantially more land and an elongated asymmetric outline compared with the base',()=>{
 const measure=(d:typeof islands[number])=>{let area=0,west=0,east=0,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(let x=-d.rx*1.12;x<d.rx*1.12;x+=12)for(let z=-d.rz*1.12;z<d.rz*1.12;z+=12)if(terrainHeight(d,d.x+x,d.z+z)>0){area+=144;if(x<0)west++;else east++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}return{area,aspect:(maxX-minX)/(maxZ-minZ),asymmetry:Math.abs(west-east)/(west+east)};};
 const base=measure(islands[0]),town=measure(islands[1]);assert.ok(town.area>base.area*2.3);assert.ok(town.aspect>base.aspect*1.15);assert.ok(town.asymmetry>.04);
});

test('building LOD transitions use cached union bounds and hysteresis without runtime bound rebuilding',()=>{
 const d=islands[0],settlement=new SettlementRenderer(d,buildSettlementLayout(d),[]),kit=new Map<string,T.BufferGeometry>();
 for(const kind of houseKinds){const g=new T.BoxGeometry(1.2,1.7,1.2);g.translate(0,.35,0);kit.set(kind,g);}
 settlement.loadKit(kit,new T.MeshStandardMaterial());
 const batch=settlement.root.children.find(o=>o.name.endsWith('/ HouseFisher')) as T.InstancedMesh,detail=batch.geometry,bounds=batch.boundingSphere;
 let rebuilds=0;for(const object of settlement.root.children)if(object instanceof T.InstancedMesh)object.computeBoundingSphere=()=>{rebuilds++;};
 const at=(x:number)=>settlement.updateLOD(new T.Vector3(d.x+x,0,d.z));
 at(1900);assert.equal(batch.geometry,detail);at(1960);const coarse=batch.geometry;assert.notEqual(coarse,detail);
 at(1800);at(1660);assert.equal(batch.geometry,coarse);at(1640);assert.equal(batch.geometry,detail);at(1800);assert.equal(batch.geometry,detail);
 assert.equal(rebuilds,0);assert.equal(batch.boundingSphere,bounds);
});

test('prefiltered sky blending wraps midnight continuously, blends weather and restores render target state',()=>{
 for(let h=-24;h<=48;h+=.1){const {a,b,t}=reflectionInterval(h);assert.ok(a>=0&&b<reflectionHours.length&&Number.isFinite(t)&&t>=-1e-8&&t<=1+1e-8);}
 assert.equal(reflectionInterval(24).a,reflectionInterval(0).a);assert.ok(reflectionInterval(23.999).t>.99);
 const maps=Array.from({length:reflectionHours.length*2},()=>new T.WebGLRenderTarget(336,256));const blend=new ReflectionBlend(maps),previous=new T.WebGLRenderTarget(8,8),calls:unknown[][]=[];let renders=0;
 const renderer={autoClear:false,getRenderTarget:()=>previous,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,setRenderTarget:(...args:unknown[])=>calls.push(args),render:()=>{renders++;}};
 blend.update(renderer as unknown as T.WebGLRenderer,18.5,.58);
 assert.equal(renders,1);assert.equal(renderer.autoClear,false);assert.deepEqual(calls.at(-1),[previous,2,1]);assert.equal(blend.target.texture.type,maps[0].texture.type);blend.dispose();previous.dispose();
});

test('frame diagnostics retain individual hitches that a P95 can hide',()=>{
 const m=new FrameMetrics();let time=0;for(let i=0;i<130;i++){time+=16;m.frame(time);}for(let i=0;i<200;i++){time+=i===100?130:16;m.frame(time);}
 assert.equal(m.snapshot.p95,16);assert.equal(m.snapshot.max,130);assert.equal(m.snapshot.hitches,1);m.reset();assert.equal(m.snapshot.hitches,0);
});

test('bounded cloud shadow rasterization retains the original projected coverage without full-map cloud scans',async()=>{
 const {createCloudLayout}=await import('../src/rendering/CloudLayout.ts'),{rasterCloudShadows}=await import('../src/rendering/CloudShadowMap.ts');
 const cells=createCloudLayout(1234,'cloudy'),sun=new T.Vector3(.4,.35,-.7).normalize(),data=new Uint8Array(64*64*4),acc=new Float32Array(64*64);
 rasterCloudShadows(cells,sun,data,acc);
 for(let z=0;z<64;z++)for(let x=0;x<64;x++){
  const wx=(x/63-.5)*22000,wz=(z/63-.5)*22000;let sum=0;
  for(const c of cells){const ox=wx-c.x+sun.x/sun.y*c.y,oz=wz-c.z+sun.z/sun.y*c.y,cs=Math.cos(c.rotation),sn=Math.sin(c.rotation),dx=(ox*cs+oz*sn)/(c.width*1.1),dz=(-ox*sn+oz*cs)/(c.depth*1.1),d=dx*dx+dz*dz;if(d<2.5)sum+=Math.exp(-d*2)*.65;}
  assert.ok(Math.abs(data[(z*64+x)*4]-Math.round(Math.min(1,sum)*255))<=1);
 }
 const old=Array.from(data);rasterCloudShadows([],sun,data,acc);assert.ok(old.some((v,i)=>i%4!==3&&v>0));assert.ok(data.every((v,i)=>i%4===3?v===255:v===0),'clears stale cloud shadows');
});
