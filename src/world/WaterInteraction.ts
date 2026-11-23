import * as T from 'three';
import {random} from './WorldConfig.ts';
import type {Ocean} from './Ocean.ts';
import type {TouchdownContact} from '../aircraft/WaterContact.ts';
export interface WaterMotion {
 readonly planing:number;
 readonly floatLoadLeft:number;
 readonly floatLoadRight:number;
 readonly lastTouchdown?:TouchdownContact;
}
function splashMask(){
 const size=96,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)*2/size-1,v=(y+.5)*2/size-1,angle=Math.atan2(v,u),radius=Math.hypot(u,v);
  const edge=.88+.035*Math.sin(angle*9)+.018*Math.cos(angle*17);
  const band=Math.exp(-Math.pow((radius-edge)/.046,2));
  const gaps=T.MathUtils.smoothstep(Math.sin(angle*7+.8*Math.cos(angle*13)), -.58,.38);
  const texture=.62+.38*Math.sin(u*83+Math.cos(v*54))*Math.sin(v*67);
  const value=Math.round(255*band*gaps*texture);
  pixels.set([value,value,value,255],(y*size+x)*4);
 }
 const map=new T.DataTexture(pixels,size,size);
 map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
 return map;
}
interface WakeSample{x:number;z:number;sideX:number;sideZ:number;age:number;strength:number;segment:number;planing:number;left:number;right:number}
/** Wake history stays in world space after takeoff; spray follows gravity instead of the aircraft. */
export class WaterInteraction{
 readonly root=new T.Group();private brightness={value:1};private samples:WakeSample[]=[];private emission=0;private dropEmission=0;private rng=random(731);private last=new T.Vector3(Infinity,0,0);private wasOnWater=false;
 private positions=new Float32Array(700*3);private velocities=new Float32Array(700*3);private ages=new Float32Array(700).fill(10);private alpha=new Float32Array(700);private cursor=0;
 private drops:T.Points;private wake:T.Mesh;private wakePositions=new Float32Array(80*4*2*3);private wakeOpacity=new Float32Array(80*4*2);private wakeEdge=new Float32Array(80*4*2);
 private segment=0;private dripTime=0;private dripBudget=0;private impactStrength=0;private ocean:Ocean;private impactTime=10;private rings:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>[]=[];private impactCenters:T.Vector2[]=[];
 private impactHeading=0;private impactSpeed=0;
 constructor(ocean:Ocean){this.ocean=ocean;
  const alphaMap=splashMask();
  for(let i=0;i<2;i++){const g=new T.RingGeometry(.75,1,48,1);g.rotateX(-Math.PI/2);const ring=new T.Mesh(g,new T.MeshBasicMaterial({color:0xdcefe4,alphaMap,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));ring.frustumCulled=false;ring.visible=false;ring.name='Touchdown expanding foam';this.rings.push(ring);this.root.add(ring);}
  this.root.name='Water interaction / persistent Kelvin wake and ballistic spray';
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('opacity',new T.BufferAttribute(this.alpha,1).setUsage(T.DynamicDrawUsage));
  this.drops=new T.Points(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{foamBrightness:this.brightness},vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute float opacity;uniform float foamBrightness;varying float vOpacity;void main(){vOpacity=opacity;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(52./max(1.,-mvPosition.z),1.,5.5);
#include <logdepthbuf_vertex>
}`,fragmentShader:`#include <logdepthbuf_pars_fragment>
uniform float foamBrightness;varying float vOpacity;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||vOpacity<.005)discard;gl_FragColor=vec4(.86,.92,.89,(1.-r*r)*vOpacity*.7);
#include <logdepthbuf_fragment>
gl_FragColor.rgb*=foamBrightness;
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));this.drops.frustumCulled=false;this.drops.name='Hull and float spray / gravity particles';this.root.add(this.drops);
  const geo=new T.BufferGeometry(),indices:number[]=[];for(let strip=0;strip<4;strip++)for(let i=0;i<79;i++){const k=strip*160+i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}geo.setIndex(indices);geo.setAttribute('position',new T.BufferAttribute(this.wakePositions,3).setUsage(T.DynamicDrawUsage));geo.setAttribute('opacity',new T.BufferAttribute(this.wakeOpacity,1).setUsage(T.DynamicDrawUsage));for(let i=0;i<this.wakeEdge.length;i++)this.wakeEdge[i]=i%2;geo.setAttribute('foamEdge',new T.BufferAttribute(this.wakeEdge,1));
  this.wake=new T.Mesh(geo,new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{foamBrightness:this.brightness},vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute float opacity;attribute float foamEdge;uniform float foamBrightness;varying float vOpacity;varying float vEdge;varying vec3 vFoamWorld;void main(){vOpacity=opacity;vEdge=foamEdge;vFoamWorld=position;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
#include <logdepthbuf_vertex>
}`,fragmentShader:`#include <logdepthbuf_pars_fragment>
uniform float foamBrightness;varying float vOpacity;varying float vEdge;varying vec3 vFoamWorld;void main(){if(vOpacity<.005)discard;float edge=1.-pow(abs(vEdge*2.-1.),1.4);float churn=.5+.5*sin(vFoamWorld.x*3.+sin(vFoamWorld.z*2.7))*sin(vFoamWorld.z*4.1+vFoamWorld.x);float footprint=max(length(dFdx(vFoamWorld.xz)),length(dFdy(vFoamWorld.xz)));churn=mix(.5,churn,1.-smoothstep(.25,1.4,footprint));float alpha=vOpacity*edge*smoothstep(.1,.85,churn)*.68;gl_FragColor=vec4(.77,.85,.78,alpha);
#include <logdepthbuf_fragment>
gl_FragColor.rgb*=foamBrightness;
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}));this.wake.frustumCulled=false;this.wake.name='World-space wake / spreading foam ribbons';this.root.add(this.wake);
 }
 setNightness(nightness:number){this.brightness.value=1-.82*T.MathUtils.clamp(nightness,0,1);for(const ring of this.rings)ring.material.color.setRGB(.80*this.brightness.value,.88*this.brightness.value,.82*this.brightness.value);}
 private emit(x:number,y:number,z:number,vx:number,vy:number,vz:number){const i=this.cursor++%700,k=i*3;this.positions[k]=x;this.positions[k+1]=y;this.positions[k+2]=z;this.velocities[k]=vx;this.velocities[k+1]=vy;this.velocities[k+2]=vz;this.ages[i]=0;}
 reset(){this.samples=[];this.ages.fill(10);this.alpha.fill(0);this.wakeOpacity.fill(0);this.emission=this.dropEmission=0;this.dripTime=this.dripBudget=0;this.segment=0;this.impactStrength=0;this.wasOnWater=false;this.impactTime=10;for(const ring of this.rings)ring.visible=false;}
 update(dt:number,position:T.Vector3,heading:number,speed:number,onWater:boolean,impact:number,aircraft:string,motion?:WaterMotion){
  if(!Number.isFinite(dt)||dt<=0)return;
  if(position.distanceToSquared(this.last)>300**2)this.reset();this.last.copy(position);dt=Math.min(dt,.05);
  const localWater=this.ocean.surfaceAt(position.x,position.z);
  const twinFloat=['mc72','s6','gloster6','m67'].includes(aircraft),floatSpan=({mc72:1.18,s6:1.32,gloster6:1.16,m67:1.4} as Record<string,number>)[aircraft]??3.65;
  const profile=aircraft==='m5'?{spray:.70,spread:.75}:twinFloat?{spray:1.10,spread:.9}:{spray:1,spread:1};
  const sx=Math.cos(heading),sz=-Math.sin(heading),fx=-Math.sin(heading),fz=-Math.cos(heading);
  const planing=motion?.planing??0,left=motion?.floatLoadLeft??1,right=motion?.floatLoadRight??1;
  const contact=motion?.lastTouchdown;
  if(onWater&&!this.wasOnWater)this.segment++;
  const touchdown=onWater&&!this.wasOnWater&&impact>.08;
  if(touchdown){
   this.impactTime=0;this.impactStrength=contact?.impact??impact;
   this.impactHeading=heading;this.impactSpeed=speed;
   this.impactCenters=contact?[new T.Vector2(contact.x,contact.z)]:(twinFloat?[-1,1]:[0]).map(side=>new T.Vector2(position.x+sx*side*floatSpan,position.z+sz*side*floatSpan));
  }
  if(onWater&&twinFloat&&contact&&this.impactTime<1&&this.impactCenters.length===1&&
    (contact.side===-1?right:left)>.48){
   const opposite=-contact.side;
   this.impactCenters.push(new T.Vector2(position.x+sx*opposite*floatSpan,position.z+sz*opposite*floatSpan));
  }
  this.impactTime+=dt;
  this.rings.forEach((ring,index)=>{
   const center=this.impactCenters[index];
   ring.visible=!!center&&this.impactTime<2.2;
   if(!ring.visible||!center)return;
   const radius=1+this.impactTime*3.25,elongation=1+Math.min(1.2,this.impactSpeed/28);
   const acrossX=Math.cos(this.impactHeading),acrossZ=-Math.sin(this.impactHeading);
   const water=this.ocean.surfaceAt(center.x,center.y),attr=ring.geometry.attributes.position;
   for(let i=0;i<attr.count;i++){
    const angle=i%49/48*Math.PI*2,r=(i<49?radius*.75:radius)*(1.+.11*Math.sin(angle*3.+index*2.));
    const lateral=Math.cos(angle)*r,along=Math.sin(angle)*r*elongation;
    const dx=acrossX*lateral+acrossZ*along,dz=acrossZ*lateral-acrossX*along;
    attr.setXYZ(i,center.x+dx,water.height+water.dx*dx+water.dz*dz+.10,center.y+dz);
   }
   attr.needsUpdate=true;ring.material.opacity=(.14+.27*this.impactStrength)*Math.pow(1-this.impactTime/2.2,2);
  });
  for(const s of this.samples)s.age+=dt;this.samples=this.samples.filter(s=>s.age<11);
  if(onWater&&speed>2){this.emission+=dt;while(this.emission>=.14){this.emission-=.14;this.samples.unshift({x:position.x-fx*2,z:position.z-fz*2,sideX:sx,sideZ:sz,age:0,strength:Math.min(.7,speed/48),segment:this.segment,planing,left,right});if(this.samples.length>80)this.samples.pop();}}
  else this.emission=0;
  this.wakeOpacity.fill(0);const lastSample=this.samples[this.samples.length-1],tailHeight=lastSample?this.ocean.heightAt(lastSample.x,lastSample.z)+.075:position.y;
  // Every strip starts at the most recent valid sample; unused vertices cannot bridge to origin.
  for(let strip=0;strip<4;strip++)for(let i=this.samples.length;i<80;i++)for(let edge=0;edge<2;edge++){
   const k=(strip*160+i*2+edge)*3,last=lastSample;this.wakePositions[k]=last?.x??position.x;this.wakePositions[k+1]=tailHeight;this.wakePositions[k+2]=last?.z??position.z;
  }
  for(let i=0;i<this.samples.length;i++){
   const s=this.samples[i],surface=this.ocean.surfaceAt(s.x,s.z),joined=(i===0||this.samples[i-1].segment===s.segment)&&(i===this.samples.length-1||this.samples[i+1].segment===s.segment),fade=joined?(1-s.age/11)*Math.min(1,s.age*5)*s.strength:0;
   for(let strip=0;strip<4;strip++)for(let edge=0;edge<2;edge++){
    const side=strip%2===0?-1:1,outer=strip>=2;
    const spread=(outer?.54:.91)*(1-.47*s.planing)*profile.spread;
    const base=twinFloat?floatSpan+(outer?.42:0):outer?floatSpan:.82-.32*s.planing;
    const offset=side*(base+s.age*spread),width=.24+s.age*.11;
    const load=side===-1?s.left:s.right;
    const strength=twinFloat?(.28+.72*load)*(outer?.58:1):outer?.36*load:1;
    const delta=offset+(edge?width:-width),x=s.x+s.sideX*delta,z=s.z+s.sideZ*delta,k=strip*160+i*2+edge;
    this.wakePositions[k*3]=x;this.wakePositions[k*3+1]=surface.height+surface.dx*(x-s.x)+surface.dz*(z-s.z)+.075;this.wakePositions[k*3+2]=z;this.wakeOpacity[k]=fade*strength;
   }
  }
  (this.wake.geometry.attributes.position as T.BufferAttribute).needsUpdate=true;(this.wake.geometry.attributes.opacity as T.BufferAttribute).needsUpdate=true;
  if(onWater){const rate=speed>4?Math.min(235,(speed*(3.4-1.3*planing)+impact*85)*profile.spray):0;this.dropEmission+=dt*rate;let count=Math.floor(this.dropEmission);this.dropEmission-=count;
   const burst=touchdown?Math.round(impact*85):0;count+=burst;
   for(let j=0;j<count;j++){
    const entering=contact&&j<burst;
    const side=entering&&contact.side!==0?contact.side:this.rng()<(twinFloat?(left+.12)/(left+right+.24):.5)?-1:1;
    const float=twinFloat||this.rng()<.22*(side===-1?left:right);
    const offset=side*(float?floatSpan:.8-.35*planing),fore=1.65-2.25*planing+this.rng()*.6;
    const x=entering?contact.x+sx*(this.rng()-.5):position.x+sx*offset+fx*fore;
    const z=entering?contact.z+sz*(this.rng()-.5):position.z+sz*offset+fz*fore;
    const y=this.ocean.heightAt(x,z)+.13,outward=(.5+this.rng()*1.7)*(1+speed*.04)*(1-.30*planing);
    this.emit(x,y,z,fx*speed*.45+sx*side*outward,1+this.rng()*(1+speed*.055+impact*3),fz*speed*.45+sz*side*outward);
   }
  }
  // Water clinging to the hull sheds behind it for an instant on rotation.
  if(this.wasOnWater&&!onWater&&speed>12)this.dripTime=.85;
  if(onWater)this.dripTime=0;
  if(this.dripTime>0){
   this.dripTime=Math.max(0,this.dripTime-dt);
   this.dripBudget+=dt*56*(this.dripTime/.85)**2;
   while(this.dripBudget>=1){
    this.dripBudget--;
    const side=this.rng()<.5?-1:1,offset=side*(twinFloat?floatSpan:.68),aft=.8+this.rng()*1.6;
    this.emit(position.x+sx*offset-fx*aft,position.y-.38,position.z+sz*offset-fz*aft,
     fx*speed*.62+sx*side*this.rng(),this.rng()*.45-.2,fz*speed*.62+sz*side*this.rng());
   }
  }
  this.wasOnWater=onWater;
  for(let i=0;i<700;i++){const k=i*3;this.ages[i]+=dt;if(this.ages[i]>1.8){this.alpha[i]=0;continue;}this.velocities[k+1]-=9.81*dt;for(let n=0;n<3;n++)this.positions[k+n]+=this.velocities[k+n]*dt;this.alpha[i]=Math.max(0,1-this.ages[i]/1.8);if(this.positions[k+1]<localWater.height+localWater.dx*(this.positions[k]-position.x)+localWater.dz*(this.positions[k+2]-position.z)-.12){this.ages[i]=10;this.alpha[i]=0;}}
  (this.drops.geometry.attributes.position as T.BufferAttribute).needsUpdate=true;(this.drops.geometry.attributes.opacity as T.BufferAttribute).needsUpdate=true;
 }
}
