import {townDirection} from './WorldConfig.ts';
import {roomLight} from './WindowLight.ts';
import * as T from 'three';
import {random,terrainHeight} from './WorldConfig.ts';import type {IslandDefinition} from './WorldConfig.ts';import type {SettlementLayout} from './SettlementLayout.ts';
import {appendSurfacePolygon} from './TerrainSurface.ts';
import {windmillWindowPanes} from './WindmillArchitecture.ts';
/** Selectively lit windows, batched street fixtures and terrain-conforming warm light pools. */
export class SettlementLights{
 readonly root=new T.Group();private glow=new T.MeshBasicMaterial({color:0xffcd79,toneMapped:false});private panes=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false});private pools=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});private active=[false,false];private selected=[-1,-1];private attenuation=[0,0];private lights=[0,1].map(()=>new T.PointLight(0xffc17d,0,92,2));private sites:T.Vector3[]=[];private strength=0;
 constructor(d:IslandDefinition,layout:SettlementLayout){
  this.root.name=`${d.id} / night windows and street lighting`;const tints:T.Color[]=[],matrices:T.Matrix4[]=[],o=new T.Object3D(),rng=random(d.seed+1940);
  layout.houses.forEach((p,index)=>{
   if(index%4===0)return;
   const seed=Math.round(p.x*13+p.z*17),configs=p.kind.startsWith('HouseMill')?windmillWindowPanes(((seed%6)+6)%6,seed).map(v=>({xs:[v.x],ys:[v.y],z:v.z-.026,w:v.w,h:v.h})):
    p.kind==='HouseFisher'?[{xs:[-.27,.20],ys:[-.035],z:.416,w:.16,h:.21}]:p.kind==='HouseTownhouse'?[{xs:[-.22,.22],ys:[-.27,.08,.42],z:.481,w:.14,h:.21}]:
    p.kind==='HousePalazzo'?[{xs:[-.27,0,.27],ys:[-.05,.28],z:.46,w:.13,h:.23}]:p.kind==='HouseArcade'?[{xs:[-.27,.27],ys:[.30],z:.544,w:.16,h:.20}]:
    p.kind==='HouseVilla'?[{xs:[-.28,.28],ys:[-.22,.16],z:.389,w:.17,h:.21}]:p.kind==='HouseGranary'?[{xs:[-.30,.30],ys:[.20],z:.49,w:.15,h:.19}]:
    p.kind==='HouseLoggia'||p.kind==='HouseMarketHall'?[{xs:[-.34,0,.34],ys:[-.04],z:-.07,w:.13,h:.25}]:p.kind==='HouseWorkshop'?[{xs:[-.37],ys:[-.12],z:.487,w:.11,h:.16}]:
    p.kind==='HouseBoatyard'?[{xs:[-.18],ys:[.39],z:.51,w:.19,h:.14}]:[{xs:[-.36,-.10],ys:[.18],z:.514,w:.12,h:.20}];
   for(const config of configs)for(const x of config.xs)for(const y of config.ys){if(rng()<.38)continue;const offset=new T.Vector3(x*p.width,(y+.5)*p.height,(config.z+.026)*p.depth).applyAxisAngle(new T.Vector3(0,1,0),p.angle);o.position.set(p.x+offset.x,p.ground+offset.y,p.z+offset.z);o.rotation.set(0,p.angle,0);o.scale.set(config.w*p.width*.88,config.h*p.height*.88,1);o.updateMatrix();matrices.push(o.matrix.clone());tints.push(roomLight(seed+Math.round(x*71+y*109)));}
  });
  const windows=new T.InstancedMesh(new T.PlaneGeometry(1,1),this.panes,matrices.length);windows.name='Warm inhabited window panes';matrices.forEach((m,i)=>{windows.setMatrixAt(i,m);windows.setColorAt(i,tints[i]);});windows.computeBoundingSphere();this.root.add(windows);
  const lamp=(x:number,z:number)=>{if(this.sites.some(p=>Math.hypot(p.x-x,p.z-z)<10))return;this.sites.push(new T.Vector3(x,terrainHeight(d,x,z)+4.8,z));};
  for(const [r,road] of layout.roads.entries())for(let i=2;i<road.points.length;i+=r===0?6:9){const p=road.points[i];const offset=road.width*.65,side=d.id==='town'&&!d.canonical?townDirection(offset,0):{x:offset,z:0};lamp(p.x+side.x,p.z+side.z);}
  for(const plaza of layout.plazas.filter(p=>p.market))for(let i=0;i<4;i++){const a=i*Math.PI/2;lamp(plaza.x+Math.cos(a)*plaza.radius*.82,plaza.z+Math.sin(a)*plaza.radius*.82);}
  const poles=new T.InstancedMesh(new T.CylinderGeometry(.09,.15,4.8,6),new T.MeshStandardMaterial({color:0x38403b,roughness:.72}),this.sites.length),bulbs=new T.InstancedMesh(new T.SphereGeometry(.30,8,6),this.glow,this.sites.length);poles.name='Batched promenade and market lamp posts';bulbs.name='Batched promenade lantern glass';
  const vertices:number[]=[],colors:number[]=[];for(const [i,p] of this.sites.entries()){
   o.position.set(p.x,p.y-2.4,p.z);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.updateMatrix();poles.setMatrixAt(i,o.matrix);o.position.copy(p);o.updateMatrix();bulbs.setMatrixAt(i,o.matrix);
   const start=vertices.length,polygon=Array.from({length:20},(_,j)=>({x:p.x+Math.cos(j/20*Math.PI*2)*9,z:p.z+Math.sin(j/20*Math.PI*2)*9})),tint:number[]=[];appendSurfacePolygon(d,polygon,.18,vertices,tint,[1,.60,.26]);
   for(let j=start;j<vertices.length;j+=3){const r=Math.hypot(vertices[j]-p.x,vertices[j+2]-p.z)/9;colors.push(1,.60,.26,Math.pow(Math.max(0,1-r),1.5));}
  }
  poles.castShadow=true;poles.receiveShadow=true;poles.computeBoundingSphere();bulbs.computeBoundingSphere();this.root.add(poles,bulbs);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,4));geo.computeVertexNormals();const pools=new T.Mesh(geo,this.pools);pools.name='Warm street light pools';this.root.add(pools,...this.lights);this.setNightness(0);
 }
 get lampSites(){return this.sites;}
 get status(){return {strength:this.strength,glow:this.glow.color.r,lamps:this.sites.length};}
 setNightness(n:number){this.strength=T.MathUtils.smoothstep(n,.20,.78);this.panes.color.setScalar(.035+this.strength*1.65);this.glow.color.setRGB(1,.64,.30).multiplyScalar(.035+this.strength*4.5);this.pools.opacity=this.strength*.30;for(const light of this.lights)light.intensity=this.active[this.lights.indexOf(light)]?this.strength*210*this.attenuation[this.lights.indexOf(light)]:0;}
 updateView(position:T.Vector3){
  // Keep each physical light at its fixture; replace it only after it has faded out.
  this.lights.forEach((light,i)=>{
   let index=this.selected[i];
   if(index<0||this.sites[index].distanceToSquared(position)>650*650){
    let best=Infinity;index=-1;this.sites.forEach((p,j)=>{const d=p.distanceToSquared(position);if(!this.selected.some((v,k)=>k!==i&&v===j)&&d<best){best=d;index=j;}});this.selected[i]=index;
   }
   const site=this.sites[index],distance=site?site.distanceTo(position):Infinity;
   this.active[i]=distance<650;if(site)light.position.copy(site);
   this.attenuation[i]=1.-T.MathUtils.smoothstep(distance,480,650);light.intensity=this.strength*210*this.attenuation[i];
  });
 }
}
