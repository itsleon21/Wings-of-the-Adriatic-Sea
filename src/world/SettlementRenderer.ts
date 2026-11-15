import {SettlementLights} from './SettlementLights.ts';
import {windmillSailGeometry} from './WindmillSails.ts';
import {windmillArchitecture} from './WindmillArchitecture.ts';
import * as T from 'three';
import {buildHarborDetail} from './HarborDetail.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight} from './WorldConfig.ts';
import type {IslandDefinition} from './WorldConfig.ts';
import {houseKinds,plotCorners,plotContains} from './SettlementLayout.ts';
import type {HouseKind,SettlementLayout} from './SettlementLayout.ts';
import {appendSurfacePolygon} from './TerrainSurface.ts';

function proxy(kind:HouseKind){
 const pieces:T.BufferGeometry[]=[];
 const colorize=(geo:T.BufferGeometry,color:number)=>{const c=new T.Color(color),count=geo.attributes.position.count,data=new Float32Array(count*3);for(let i=0;i<count;i++)data.set([c.r,c.g,c.b],i*3);geo.setAttribute('color',new T.BufferAttribute(data,3));const part=geo.index?geo.toNonIndexed():geo;for(const key of Object.keys(part.attributes))if(!['position','normal','color'].includes(key))part.deleteAttribute(key);if(part!==geo)geo.dispose();pieces.push(part);};
 const wall=kind.startsWith('HouseMill')?0xd8d0b8:kind==='HouseVilla'?0xe2bd8e:kind==='HouseTownhouse'?0xd8c5a0:kind==='HouseWorkshop'?0xb8aa8e:0xe6d9bc;
 colorize(new T.BoxGeometry(1,1,1),wall);
 const hip=kind==='HouseVilla'||kind==='HousePalazzo'||kind==='HouseLoggia',flat=kind==='HouseWorkshop'||kind==='HouseBoatyard';
 const geo=new T.BufferGeometry(),v=hip?[-.57,.5,-.57,.57,.5,-.57,0,.83,-.18,-.57,.5,.57,0,.83,.18,.57,.5,.57]:[-.57,.5,-.57,.57,.5,-.57,0,flat?.68:.85,-.57,-.57,.5,.57,0,flat?.68:.85,.57,.57,.5,.57];
 const indices=hip?[0,1,2,0,2,4,0,4,3,1,5,4,1,4,2,3,4,5]:[0,1,2,3,4,5,0,2,4,0,4,3,1,5,4,1,4,2];
 geo.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:indices.length/3},(_,i)=>[indices[i*3],indices[i*3+2],indices[i*3+1]]).flatMap(t=>t.flatMap(i=>v.slice(i*3,i*3+3))),3));geo.computeVertexNormals();colorize(geo,kind==='HouseWorkshop'?0x926249:0xa95739);
 const result=mergeGeometries(pieces,false)!;result.setAttribute('millPart',new T.Float32BufferAttribute(new Float32Array(result.attributes.position.count),1));result.setAttribute('surfaceAO',new T.Float32BufferAttribute(new Float32Array(result.attributes.position.count).fill(1),1));for(const p of pieces)p.dispose();return result;
}
interface Batch {mesh:T.InstancedMesh;coarse:T.BufferGeometry;detail?:T.BufferGeometry;kind:HouseKind;bounds?:T.Sphere}
/** One draw per house type preserves varied silhouettes while keeping the whole town instanced. */
export class SettlementRenderer {
 readonly root=new T.Group();private nightLights:SettlementLights;private batches:Batch[]=[];private near=false;private furniture:T.Mesh;private definition:IslandDefinition;
 private sails:{mesh:T.InstancedMesh;slots:{base:T.Matrix4;phase:number;speed:number}[]}[]=[];private spin=new T.Matrix4();private transform=new T.Matrix4();
 constructor(definition:IslandDefinition,layout:SettlementLayout,blockers:T.Box3[]){
  this.nightLights=new SettlementLights(definition,layout);this.root.add(this.nightLights.root);this.definition=definition;this.root.name=`${definition.id} / planned neighbourhoods`;
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.89}),dummy=new T.Object3D();material.userData.architecture=true;
  for(const kind of houseKinds){
   const plots=layout.houses.filter(p=>p.kind===kind);if(!plots.length||kind.startsWith('HouseMill'))continue;
   const coarse=proxy(kind),mesh=new T.InstancedMesh(coarse,material,plots.length);mesh.name=`${definition.id} / ${kind}`;mesh.castShadow=mesh.receiveShadow=true;
   plots.forEach((p,i)=>{dummy.position.set(p.x,p.ground+p.height/2,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.width,p.height,p.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setRGB(p.tint[0],p.tint[1],p.tint[2]));
    const corners=plotCorners(p);blockers.push(new T.Box3(new T.Vector3(Math.min(...corners.map(v=>v.x)),p.low,Math.min(...corners.map(v=>v.z))),new T.Vector3(Math.max(...corners.map(v=>v.x)),p.ground+p.height*1.62,Math.max(...corners.map(v=>v.z)))));
   });
   mesh.computeBoundingSphere();this.root.add(mesh);this.batches.push({mesh,coarse,kind});
  }
  const foundations=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0xb9af95,roughness:.95}),layout.houses.length);foundations.name=`${definition.id} / individual plot foundations`;foundations.receiveShadow=true;
  layout.houses.forEach((p,i)=>{const height=Math.max(.65,p.ground-p.low+.6);dummy.position.set(p.x,p.ground-height/2,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.width*1.035,height,p.depth*1.035);dummy.updateMatrix();foundations.setMatrixAt(i,dummy.matrix);});
  this.root.add(foundations);this.streets(layout,blockers);this.furniture=buildHarborDetail(definition,layout);this.root.add(this.furniture);
  const millParts:T.BufferGeometry[]=[],mills=layout.houses.filter(p=>p.kind.startsWith('HouseMill')),prepared=mills.map(p=>{const seed=Math.round(p.x*13+p.z*17),family=((seed%6)+6)%6,shaftAngle=Math.atan2(Math.sin(Math.PI*3/4-p.angle)/p.width,Math.cos(Math.PI*3/4-p.angle)/p.depth);return{p,seed,shaftAngle,model:windmillArchitecture(family,seed,shaftAngle)};});
  for(const style of[0,1,2]){
   const plots=prepared.filter(v=>v.model.sailStyle===style);if(!plots.length)continue;
   const mesh=new T.InstancedMesh(windmillSailGeometry(style),new T.MeshStandardMaterial({vertexColors:true,roughness:.87,side:T.DoubleSide}),plots.length),slots:{base:T.Matrix4;phase:number;speed:number}[]=[];
   mesh.name=definition.id+' / working mill-house sails / '+style;mesh.castShadow=mesh.receiveShadow=true;
   for(const [i,{p,seed,shaftAngle,model}] of plots.entries()){
    dummy.position.set(p.x,p.ground+p.height/2,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.set(p.width,p.height,p.depth);dummy.updateMatrix();model.geometry.applyMatrix4(dummy.matrix);millParts.push(model.geometry);
    const wind=new T.Vector3(Math.SQRT1_2,0,-Math.SQRT1_2),localWind=new T.Vector3(Math.sin(shaftAngle),0,Math.cos(shaftAngle)),reach=Math.hypot(localWind.x*p.width,localWind.z*p.depth)*model.shaft;
    dummy.position.set(p.x+wind.x*reach,p.ground+p.height/2+model.hubY*p.height,p.z+wind.z*reach);
    let radius=Math.min(p.width*.72,p.height*.44);const neighbours=layout.houses.filter(q=>q!==p&&Math.hypot(q.x-dummy.position.x,q.z-dummy.position.z)<42);
    for(let attempt=0;attempt<6;attempt++){let clash=false;for(const q of neighbours)for(let a=0;a<32;a++){const theta=a*Math.PI/16,x=dummy.position.x+Math.cos(theta)*radius*Math.SQRT1_2,z=dummy.position.z+Math.cos(theta)*radius*Math.SQRT1_2,y=dummy.position.y+Math.sin(theta)*radius;if(y>q.low&&y<q.ground+q.height*1.58&&plotContains(q,x,z,1.4))clash=true;}if(!clash)break;radius*=.88;}
    dummy.rotation.set(0,Math.PI*3/4,0);dummy.scale.setScalar(radius);dummy.updateMatrix();slots.push({base:dummy.matrix.clone(),phase:i*2.399,speed:.16+((seed%13+13)%13)*.012});
   }
   this.sails.push({mesh,slots});this.root.add(mesh);
  }
  if(millParts.length){const geo=mergeGeometries(millParts,false)!;millParts.forEach(g=>g.dispose());const mesh=new T.Mesh(geo,material);mesh.name=definition.id+' / bespoke western European windmill buildings';mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);}
  this.updateTime(0);
 }
 updateTime(time:number){for(const {mesh,slots} of this.sails){slots.forEach((slot,i)=>{this.spin.makeRotationZ(slot.phase+time*slot.speed);mesh.setMatrixAt(i,this.transform.multiplyMatrices(slot.base,this.spin));});mesh.instanceMatrix.needsUpdate=true;} }
 private streets(layout:SettlementLayout,blockers:T.Box3[]){
  const vertices:number[]=[],colors:number[]=[],tint=new T.Color(0xb4a88e);
  const roadTint=[tint.r,tint.g,tint.b];
  for(const road of layout.roads)for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],length=Math.hypot(b.x-a.x,b.z-a.z);if(length<.001)continue;
   const nx=-(b.z-a.z)/length*road.width/2,nz=(b.x-a.x)/length*road.width/2;
   appendSurfacePolygon(this.definition,[{x:a.x+nx,z:a.z+nz},{x:b.x+nx,z:b.z+nz},{x:b.x-nx,z:b.z-nz},{x:a.x-nx,z:a.z-nz}],.12,vertices,colors,roadTint);
  }
  const plazaTint=new T.Color(0xc8bda3);
  for(const plaza of layout.plazas){const polygon=Array.from({length:32},(_,i)=>({x:plaza.x+Math.cos(i/32*Math.PI*2)*plaza.radius,z:plaza.z+Math.sin(i/32*Math.PI*2)*plaza.radius}));appendSurfacePolygon(this.definition,polygon,.20,vertices,colors,[plazaTint.r,plazaTint.g,plazaTint.b]);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.96,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));mesh.name=`${this.definition.id} / lanes and market squares`;mesh.receiveShadow=true;this.root.add(mesh);
  // Small market canopies give the denser waterfront a lived-in focal point.
  const markets=layout.plazas.filter(p=>p.market),canopies=new T.InstancedMesh(new T.BoxGeometry(5,.14,3.7),new T.MeshStandardMaterial({roughness:.85}),markets.length*6),posts=new T.InstancedMesh(new T.CylinderGeometry(.10,.10,3,5),new T.MeshStandardMaterial({color:0x75634d,roughness:.9}),markets.length*24),dummy=new T.Object3D();
  canopies.name='Market square fabric canopies';posts.name='Market square timber posts';canopies.castShadow=posts.castShadow=true;let shadeIndex=0,postIndex=0;
  for(const p of markets)for(const side of[-1,1])for(const row of[-1,0,1]){
   const x=p.x+side*p.radius*.61,z=p.z+row*4.8,h=Math.max(...[-2.3,2.3].flatMap(dx=>[-1.65,1.65].map(dz=>terrainHeight(this.definition,x+dx,z+dz))));dummy.scale.set(1,1,1);dummy.position.set(x,h+3,z);dummy.updateMatrix();canopies.setMatrixAt(shadeIndex,dummy.matrix);canopies.setColorAt(shadeIndex++,new T.Color([0xbc8956,0xa36542,0xcbbb99][row+1]));
   blockers.push(new T.Box3(new T.Vector3(x-2.5,h,z-1.85),new T.Vector3(x+2.5,h+3.2,z+1.85)));
   for(const dx of[-2.3,2.3])for(const dz of[-1.65,1.65]){const ground=terrainHeight(this.definition,x+dx,z+dz),height=h+3-ground;dummy.position.set(x+dx,ground+height/2,z+dz);dummy.scale.set(1,height/3,1);dummy.updateMatrix();posts.setMatrixAt(postIndex++,dummy.matrix);}
  }
  this.root.add(canopies,posts);
 }
 loadKit(kit:Map<string,T.BufferGeometry>,material:T.MeshStandardMaterial){const buildingMaterial=material.clone();buildingMaterial.name='Coastal plaster and terracotta';buildingMaterial.userData.architecture=true;buildingMaterial.userData.architectureAO=true;
 buildingMaterial.customProgramCacheKey=()=> 'coastal-buildings-bespoke-mills-v2';for(const b of this.batches){b.detail=kit.get(b.kind);if(b.detail){b.mesh.material=buildingMaterial;b.mesh.geometry=b.detail;b.mesh.computeBoundingSphere();const detailBounds=b.mesh.boundingSphere!.clone();b.mesh.geometry=b.coarse;b.mesh.computeBoundingSphere();b.bounds=b.mesh.boundingSphere!.clone().union(detailBounds);b.mesh.geometry=b.detail;b.mesh.boundingSphere=b.bounds;}}this.near=true;}
 get nightLampSites(){return this.nightLights.lampSites;}
 get lightStatus(){return this.nightLights.status;}
 setNightness(value:number){this.nightLights.setNightness(value);}
 updateLOD(position:T.Vector3){this.nightLights.updateView(position);this.furniture.visible=Math.hypot(position.x-this.definition.x,position.z-this.definition.z)<1250;const distance=Math.hypot(position.x-this.definition.x,position.z-this.definition.z),near=distance<(this.near?1950:1650);this.warmLOD(near);}
 warmLOD(near:boolean){if(near===this.near)return;this.near=near;for(const b of this.batches){b.mesh.geometry=near&&b.detail?b.detail:b.coarse;if(b.bounds)b.mesh.boundingSphere=b.bounds;}}
}
