import * as T from 'three';
import {terrainSurfaceHeight} from './TerrainSurface.ts';
import {terrainHeight} from './WorldConfig.ts';
import type {IslandDefinition} from './WorldConfig.ts';
import type {MooringSite} from './Moorings.ts';

const halfWidth=2.8;
export const lighthouseTrailEnd=26;
export const lighthouseCottageOffset={x:-44,z:-12};

export function lighthouseTrail(d:IslandDefinition,jetty:MooringSite){
 const x=(jetty.shoreX-d.x)/d.rx,z=(jetty.shoreZ-d.z)/d.rz;
 const angle=Math.atan2(z,x),summitAngle=Math.PI/2+Math.PI*2;
 const shore=terrainHeight(d,jetty.shoreX,jetty.shoreZ);
 const top=terrainHeight(d,d.x,d.z+lighthouseTrailEnd);
 const bends=Array.from({length:225},(_,i)=>{
  const t=i/224,turn=t*t*1.045/(t+.045),a=T.MathUtils.lerp(angle,summitAngle,turn);
  const rise=1-(1-t)**1.5;
  const target=T.MathUtils.lerp(shore,top,rise);
  const dx=Math.cos(a)*d.rx,dz=Math.sin(a)*d.rz;
  let inner=0,outer=1.3;
  for(let j=0;j<17;j++){
   const r=(inner+outer)/2;
   if(terrainHeight(d,d.x+dx*r,d.z+dz*r)>target)inner=r;
   else outer=r;
  }
  const r=(inner+outer)/2;
  return new T.Vector2(d.x+dx*r,d.z+dz*r);
 });
 bends[0].set(jetty.shoreX,jetty.shoreZ);
 bends.at(-1)!.set(d.x,d.z+lighthouseTrailEnd);
 return bends;
}

export function lighthouseTrailClearance(d:IslandDefinition,path:readonly T.Vector2[],x:number,z:number,padding:number){
 if(Math.abs(x-d.x)>d.rx+padding||Math.abs(z-d.z)>d.rz+padding)return false;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=b.x-a.x,dz=b.y-a.y;
  const t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.y)*dz)/(dx*dx+dz*dz),0,1);
  if(Math.hypot(x-a.x-t*dx,z-a.y-t*dz)<halfWidth+padding)return true;
 }
 return false;
}

export function buildLighthouseTrail(d:IslandDefinition,path:readonly T.Vector2[],jetty:MooringSite){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 const limestone=new T.Color(0xcdb998),edge=new T.Color(0xa49377);
 const offsets=[-halfWidth,-2.3,0,2.3,halfWidth];
 for(const [i,p] of path.entries()){
  const before=path[Math.max(0,i-1)],after=path[Math.min(i+1,path.length-1)];
  const side=new T.Vector2(after.y-before.y,before.x-after.x).normalize();
  if(i===0)side.set(jetty.dz,-jetty.dx);
  for(const [lane,offset] of offsets.entries()){
   const x=p.x+side.x*offset,z=p.y+side.y*offset,h=terrainSurfaceHeight(d,x,z)+.28;
   // The first row meets the jetty deck, then blends into the ground.
   const y=T.MathUtils.lerp(3.3,h,Math.min(i/3,1));
   positions.push(x,y,z);
   const color=lane===0||lane===offsets.length-1?edge:limestone;
   const tint=.97+.03*Math.sin(i*.81+lane*1.9);
   colors.push(color.r*tint,color.g*tint,color.b*tint);
   if(i>0&&lane>0){
    const a=i*offsets.length+lane;
    indices.push(a-offsets.length-1,a-1,a,a-offsets.length-1,a,a-offsets.length);
   }
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.96,side:T.DoubleSide}));
 mesh.name='Lighthouse / winding limestone road from the jetty to the summit';
 mesh.receiveShadow=true;
 return mesh;
}
