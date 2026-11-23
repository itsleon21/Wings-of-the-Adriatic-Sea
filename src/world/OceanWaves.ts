import {harborPoint,townPoint,townYaw,covePoint} from './WorldConfig.ts';
import {islands,bayProfile} from './WorldConfig.ts';
import {marineWindDirection} from './MarineWind.ts';
const windHeading=Math.atan2(marineWindDirection.z,marineWindDirection.x);
/** Shared directional wind-sea spectrum for geometry, normals, buoyancy, spray and wakes. */
// Spread offshore energy across two crossing swells, each with its own bandwidth.
const bands=[
 [ .34,87,.33,.2],[ .67,71,.28,2.9],[ .06,58,.23,4.4],
 [1.31,49,.26,1.8],[1.76,37,.20,5.2],[1.04,27,.15,3.2],
 [windHeading-.59,17,.19,2.1],[windHeading+.41,11,.14,.7],
 [windHeading+.04,6.7,.073,4.1],[windHeading-.83,4.1,.048,5.9],
];
export const waveComponents=bands.map(([angle,wavelength,weight,phase])=>{
 const k=Math.PI*2/wavelength;
 return{x:Math.cos(angle),z:Math.sin(angle),k,speed:Math.sqrt(9.81*k),weight,phase};
});
export const waveAmplitude=(wind:number)=>.34+Math.max(0,Math.min(1,wind))*.64;
// Each train crosses a different patch of water. Phase bends change the local
// direction and spacing; the packet envelope changes which train dominates.
const seaTrains=waveComponents.map((wave,i)=>{
 const angle=1.23+i*2.39996;
 return {...wave,px:Math.cos(angle)*(.0048+i*.0011),pz:Math.sin(angle)*(.0048+i*.0011),bend:2.1+(i%4)*.72,shelterMix:i<6?.40:.65,mouthMix:i<6?0:.28};
});
export function sampleOceanWaves(x:number,z:number,time:number,wind:number){
 const amplitude=waveAmplitude(wind),shelter=seaShelter(x,z);
 let height=0,dx=0,dz=0,velocity=0,shelterDx=0,shelterDz=0;
 const u=x*.0081+z*.0063,v=z*.0137-x*.0043;
 const along=x+12*Math.sin(u)+5*Math.sin(v),across=z+9*Math.sin(v)-7*Math.sin(u);
 for(const c of seaTrains){
  const distance=along*c.x+across*c.z,patch=along*c.px+across*c.pz+c.phase;
  const phase=distance*c.k-time*c.speed+c.phase+c.bend*Math.sin(patch);
  const packet=distance*c.k*.16-time*c.speed*.12+patch*1.9+c.phase;
  const envelope=.60+.40*Math.sin(packet),edge=.40*Math.cos(packet);
  const calm=shelter.value,lee=1-calm;
  const shelterScale=calm*(1-c.shelterMix*lee)+c.mouthMix*4*calm*lee*lee;
  const shelterGrade=1-c.shelterMix+2*c.shelterMix*calm+c.mouthMix*4*lee*(1-3*calm);
  const a=amplitude*c.weight,sin=Math.sin(phase),cos=Math.cos(phase),bend=c.bend*Math.cos(patch);
  const h=a*sin*envelope;
  const gx=a*(cos*envelope*(c.k*c.x+bend*c.px)+sin*edge*(c.k*.16*c.x+1.9*c.px));
  const gz=a*(cos*envelope*(c.k*c.z+bend*c.pz)+sin*edge*(c.k*.16*c.z+1.9*c.pz));
  height+=h*shelterScale;dx+=gx*shelterScale;dz+=gz*shelterScale;
  shelterDx+=h*shelterGrade*shelter.dx;shelterDz+=h*shelterGrade*shelter.dz;
  velocity-=a*c.speed*(cos*envelope+sin*edge*.12)*shelterScale;
 }
 const du=(12*dx-7*dz)*Math.cos(u),dv=(5*dx+9*dz)*Math.cos(v);
 return{height,dx:dx+du*.0081-dv*.0043+shelterDx,dz:dz+du*.0063+dv*.0137+shelterDz,velocity};
}
const gl=(n:number)=>n.toFixed(12);
const basins=islands.filter(d=>d.id==='harbor'||d.id==='town'||d.id==='cove').map(d=>{
 const town=d.id==='town',z=d.z+(d.id==='cove'?40:d.rz*bayProfile(d).offset);
 const center=town?townPoint(d,d.x,z):d.id==='harbor'?harborPoint(d,d.x,z):covePoint(d,d.x,z);
 const yaw=town?townYaw:d.id==='harbor'?-Math.PI/2:Math.PI/2;
 return {...center,rx:d.rx*(town?.64:.48),rz:d.rz*(town?.26:.42),c:Math.cos(yaw),s:Math.sin(yaw)};
});
/** Gaussian wind shelter: calm enclosed basins blend continuously into offshore swell. */
export function seaShelter(x:number,z:number){
 let value=1,dx=0,dz=0;
 for(const b of basins){
  const ox=x-b.x,oz=z-b.z,xx=(b.c*ox-b.s*oz)/b.rx,zz=(b.s*ox+b.c*oz)/b.rz;
  const e=.62*Math.exp(-2*(xx*xx+zz*zz)),gx=4*e*xx/b.rx,gz=4*e*zz/b.rz;
  value-=e;dx+=b.c*gx+b.s*gz;dz+=-b.s*gx+b.c*gz;
 }
 return {value,dx,dz};
}

export const oceanWaveGLSL=`vec3 waveShelter(vec2 p){
 float shelter=1.;vec2 shelterGradient=vec2(0.);
 ${basins.map(b=>`{const mat2 axes=mat2(${gl(b.c)},${gl(b.s)},${gl(-b.s)},${gl(b.c)});vec2 radii=vec2(${gl(b.rx)},${gl(b.rz)});vec2 delta=axes*(p-vec2(${gl(b.x)},${gl(b.z)}))/radii;float e=.62*exp(-2.*dot(delta,delta));shelter-=e;shelterGradient+=vec2(dot(axes[0],4.*e*delta/radii),dot(axes[1],4.*e*delta/radii));}`).join('\n')}
 return vec3(shelter,shelterGradient);
}
vec3 oceanWave(vec2 p,float t,float wind){
 float a=.34+clamp(wind,0.,1.)*.64;vec3 result=vec3(0.);
 vec2 patchPhase=vec2(dot(p,vec2(.0081,.0063)),dot(p,vec2(-.0043,.0137)));
 vec2 warped=p+mat2(12.,-7.,5.,9.)*sin(patchPhase);
 vec3 basin=waveShelter(p);
 float shelter=basin.x;vec2 shelterGradient=basin.yz;
 vec2 shelterSlope=vec2(0.);
 ${seaTrains.map(c=>`{
  vec2 d=vec2(${gl(c.x)},${gl(c.z)}),g=vec2(${gl(c.px)},${gl(c.pz)});
  float distanceAlong=dot(warped,d),localPhase=dot(warped,g)+${gl(c.phase)};
  float phase=distanceAlong*${gl(c.k)}-t*${gl(c.speed)}+${gl(c.phase)}+${gl(c.bend)}*sin(localPhase);
  float packet=distanceAlong*${gl(c.k*.16)}-t*${gl(c.speed*.12)}+localPhase*1.9+${gl(c.phase)};
  float envelope=.60+.40*sin(packet),height=a*${gl(c.weight)}*sin(phase)*envelope;
  vec2 slope=a*${gl(c.weight)}*(cos(phase)*envelope*(d*${gl(c.k)}+g*${gl(c.bend)}*cos(localPhase))+
   sin(phase)*.40*cos(packet)*(d*${gl(c.k*.16)}+1.9*g));
  float lee=1.-shelter;
  float scale=shelter*(1.-${gl(c.shelterMix)}*lee)+${gl(c.mouthMix*4)}*shelter*lee*lee;
  result+=vec3(height,slope)*scale;
  shelterSlope+=height*(1.-${gl(c.shelterMix)}+2.*${gl(c.shelterMix)}*shelter+${gl(c.mouthMix*4)}*lee*(1.-3.*shelter))*shelterGradient;
 }`).join('\n')}
 vec2 chain=vec2(dot(result.yz,vec2(12.,-7.)),dot(result.yz,vec2(5.,9.)))*cos(patchPhase);
 result.yz+=mat2(.0081,.0063,-.0043,.0137)*chain+shelterSlope;
 return result;
}`;
export const oceanGridCoordinate=(u:number)=>Math.sign(u)*(190*Math.abs(u)+23810*Math.abs(u)**5);
