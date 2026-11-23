import * as T from 'three';
import {raceCourse} from './RaceManager.ts';
import type {RaceManager} from './RaceManager.ts';
import {FlightGate} from '../missions/FlightGate.ts';
export class RaceVisual{
 readonly root=new T.Group();
 private gates=raceCourse.map((point,i)=>new FlightGate(point,i===0||i===raceCourse.length-1?0xffc56b:0x73f1dc));
 constructor(){
  this.root.name='Race / luminous course gates';
  const shape=new T.Shape();
  shape.moveTo(-.10,-.09);shape.lineTo(-.025,-.09);shape.lineTo(.075,0);
  shape.lineTo(-.025,.09);shape.lineTo(-.10,.09);shape.lineTo(0,0);shape.closePath();
  const arrow=new T.ShapeGeometry(shape);
  const ivory=new T.MeshBasicMaterial({color:0xffe8aa,side:T.DoubleSide,toneMapped:false});
  this.gates.forEach((gate,i)=>{
   this.root.add(gate.root);
   const exit=raceCourse[i+1];
   if(!exit)return;
   const localRight=new T.Vector3(1,0,0).applyQuaternion(gate.root.quaternion);
   const lateral=exit.position.clone().sub(raceCourse[i].position).normalize().dot(localRight);
   if(Math.abs(lateral)<.12)return;
   const side=Math.sign(lateral),marker=new T.Mesh(arrow,ivory);
   marker.position.set(side*1.15,0,0);marker.scale.x=side;
   gate.root.add(marker);
  });
 }
 pass(index:number){this.gates[index]?.reset();}
 reset(){this.gates.forEach(g=>g.reset());}
 update(race:RaceManager,time:number){
  this.gates.forEach((g,i)=>g.update(time,!!race.current&&i===race.index,false));
 }
}
export class RaceFireworks{
 readonly points:T.Points;
 private readonly bursts=Array.from({length:10},()=>new T.Vector3());
 private readonly direction=new T.Vector3();
 private readonly right=new T.Vector3();
 private readonly origin=new T.Vector3();
 private nextBurst=0;
 private finish?:T.Vector3;
 private clock=0;private playing=false;private positions:Float32Array;private velocities:Float32Array;private starts:Float32Array;
 constructor(){
  const count=this.bursts.length*120;this.positions=new Float32Array(count*3);this.velocities=new Float32Array(count*3);this.starts=new Float32Array(count);const color=new Float32Array(count*3),geo=new T.BufferGeometry();
  for(let i=0;i<count;i++){const burst=Math.floor(i/120),a=i*2.39996,t=(i%120+.5)/120,y=1-2*t,r=Math.sqrt(1-y*y),speed=28+(i%9)*3;this.velocities.set([Math.cos(a)*r*speed,y*speed,Math.sin(a)*r*speed],i*3);this.starts[i]=Math.max(0,burst-1)*.42;const c=new T.Color().setHSL((burst*.173)%1,1,.48);color.set([c.r*4,c.g*4,c.b*4],i*3);}
  geo.setAttribute('position',new T.BufferAttribute(this.positions,3));geo.setAttribute('color',new T.BufferAttribute(color,3));geo.setAttribute('sparkAge',new T.BufferAttribute(new Float32Array(count),1));
  this.points=new T.Points(geo,new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:T.NormalBlending,vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute float sparkAge;varying float fade;varying vec3 tint;void main(){tint=color;fade=clamp(1.-sparkAge/2.65,0.,1.);vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(4000./max(1.,-p.z),2.,7.);gl_Position=projectionMatrix*p;
#include <logdepthbuf_vertex>
}`,fragmentShader:`#include <logdepthbuf_pars_fragment>
varying float fade;varying vec3 tint;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint*3.,pow(1.-d,.9)*sqrt(fade));
#include <logdepthbuf_fragment>
}`}));this.points.frustumCulled=false;this.points.visible=false;this.points.name='Race completion / fireworks';
 }
 get celebrating(){return this.playing;}
 start(position:T.Vector3,heading:T.Vector3,winner=position){
  this.finish=winner.distanceToSquared(position)>450**2?winner.clone():undefined;
  this.origin.copy(position);this.direction.copy(heading).setY(0).normalize();
  if(this.direction.lengthSq()<.01)this.direction.set(0,0,-1);
  this.right.set(-this.direction.z,0,this.direction.x);
  this.clock=0;this.nextBurst=0;this.playing=true;this.points.visible=true;
  this.update(0,position);
 }
 reset(){this.playing=false;this.points.visible=false;this.clock=0;}
 update(dt:number,position=this.origin){
  if(!this.playing)return;
  this.clock+=dt;
  while(this.nextBurst<this.bursts.length&&this.clock>=this.starts[this.nextBurst*120]){
   const b=this.nextBurst++,side=b%2===0?-1:1;
   const anchor=b===1&&this.finish?this.finish:position;
   this.bursts[b].copy(anchor).addScaledVector(this.direction,205+(b%3)*33).addScaledVector(this.right,side*(78+(b%4)*25));
   this.bursts[b].y=Math.max(75,anchor.y+18+(b%3)*32);
  }
  const age=this.points.geometry.attributes.sparkAge as T.BufferAttribute;
  for(let i=0;i<this.nextBurst*120;i++){
   const center=this.bursts[Math.floor(i/120)],t=this.clock-this.starts[i],j=i*3;
   this.positions[j]=center.x+this.velocities[j]*t;
   this.positions[j+1]=center.y+this.velocities[j+1]*t-6*t*t;
   this.positions[j+2]=center.z+this.velocities[j+2]*t;
   age.setX(i,t);
  }
  this.points.geometry.setDrawRange(0,this.nextBurst*120);
  this.points.geometry.attributes.position.needsUpdate=true;age.needsUpdate=true;
  if(this.clock>this.starts.at(-1)!+2.65)this.reset();
 }
 dispose(){this.points.geometry.dispose();(this.points.material as T.Material).dispose();}
}
