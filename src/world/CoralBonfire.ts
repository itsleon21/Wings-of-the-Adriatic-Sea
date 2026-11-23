import * as T from 'three';
import {islands,terrainHeight} from './WorldConfig.ts';
import {inCoralJettyClearance} from './Moorings.ts';

const coral=islands.find(d=>d.id==='coral')!;
// Search the sheltered side of the southern cay for dry, level sand above the tide.
function beachSite(){
 let best=Infinity,site=new T.Vector3();
 for(let dx=-78;dx<92;dx+=4)for(let dz=85;dz<181;dz+=4){
  const x=coral.x+dx,z=coral.z+dz,y=terrainHeight(coral,x,z);
  if(y<2.2||y>7||inCoralJettyClearance(x,z))continue;
  const grade=Math.max(...[[8,0],[-8,0],[0,8],[0,-8]].map(([a,b])=>Math.abs(terrainHeight(coral,x+a,z+b)-y)));
  const score=grade*5+Math.abs(y-3.6);
  if(score<best){best=score;site.set(x,y,z);}
 }
 if(!Number.isFinite(best))throw new Error('No dry beach for the coral bonfire');
 return site;
}
export const coralFireSite=beachSite();
export function inCoralClearing(x:number,z:number,padding=0){
 return Math.hypot(x-coralFireSite.x,z-coralFireSite.z)<14+padding;
}
export class CoralBonfire{
 readonly root=new T.Group();
 private flames:T.InstancedMesh;
 private glow=new T.PointLight(0xff9a46,0,58,2);
 private heat=new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 private time=0;
 private pose=new T.Object3D();
 constructor(){
  const {x,y,z}=coralFireSite;
  this.root.position.copy(coralFireSite);this.root.name='Coral / beach bonfire gathering';
  const wood=new T.InstancedMesh(new T.CylinderGeometry(1,.92,1,8),new T.MeshStandardMaterial({color:0x78553a,roughness:1}),10);
  const stones=new T.InstancedMesh(new T.DodecahedronGeometry(1),new T.MeshStandardMaterial({color:0x897c66,roughness:1}),19);
  const p=this.pose,ground=(dx:number,dz:number)=>terrainHeight(coral,x+dx,z+dz)-y;
  for(let i=0;i<wood.count;i++){
   const seat=i>=4,a=seat?(i-4)*Math.PI/3+.19:i*Math.PI/4,r=seat?8:0,dx=Math.cos(a)*r,dz=Math.sin(a)*r;
   p.position.set(dx,ground(dx,dz)+(seat?.55:.38+i*.18),dz);p.rotation.order='YXZ';p.rotation.set(Math.PI/2,-a,0);
   p.scale.set(seat?.62:.42,seat?5.3:4.8,seat?.62:.42);p.updateMatrix();wood.setMatrixAt(i,p.matrix);
  }
  for(let i=0;i<stones.count;i++){
   const a=i*2*Math.PI/stones.count,dx=Math.sin(a)*3,dz=Math.cos(a)*3;p.position.set(dx,ground(dx,dz)+.23,dz);p.rotation.set(.13,a,.25);p.scale.set(.62,.47,.67);p.updateMatrix();stones.setMatrixAt(i,p.matrix);
  }
  this.flames=new T.InstancedMesh(new T.ConeGeometry(1,1,8),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),7);
  for(let i=0;i<7;i++)this.flames.setColorAt(i,new T.Color(i%3===0?0xffde79:i%3===1?0xff9438:0xfb6430));
  this.flames.frustumCulled=false;this.glow.position.y=3;
  // A sand-following diffuse pool reads at a distance, even when physical lights are culled.
  const verts:number[]=[],colors:number[]=[],index:number[]=[];
  for(let ring=0;ring<=6;ring++)for(let i=0;i<32;i++){
   const a=i*Math.PI/16,r=ring*2.65,dx=Math.cos(a)*r,dz=Math.sin(a)*r;
   verts.push(dx,ground(dx,dz)+.16,dz);const fall=Math.pow(1-ring/6,2);colors.push(fall,.31*fall,.073*fall);
   if(ring){const b=ring*32+i,c=ring*32+(i+1)%32;index.push(b-32,c-32,b,b,c-32,c);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(index);this.heat.side=T.DoubleSide;
  wood.castShadow=stones.castShadow=true;wood.receiveShadow=stones.receiveShadow=true;
  this.root.add(wood,stones,this.flames,this.glow,new T.Mesh(geo,this.heat));this.update(0,0);
 }
 update(night:number,dt:number){
  const strength=T.MathUtils.smoothstep(night,.32,.79);this.flames.visible=strength>.005;this.heat.visible=this.flames.visible;
  this.time+=dt;const t=this.time,flicker=.94+.045*Math.sin(t*4.7)+.025*Math.sin(t*9.1);
  this.glow.intensity=430*strength*flicker;this.heat.opacity=.63*strength*flicker;
  if(!this.flames.visible)return;
  const p=this.pose;
  for(let i=0;i<7;i++){
   const a=i*2.4,h=(i===0?6.8:3.7+.7*Math.cos(a))*(.93+.12*Math.sin(t*(4+i*.2)+a))*Math.sqrt(strength),r=i===0?0:1.3;
   p.position.set(Math.cos(a)*r+.21*Math.sin(t*2+a),.65+h/2,Math.sin(a)*r);p.rotation.set(.10*Math.sin(t*3+a),a,-.12);p.scale.set(1.05,h,1.02);p.updateMatrix();this.flames.setMatrixAt(i,p.matrix);
  }
  this.flames.instanceMatrix.needsUpdate=true;
 }
}
