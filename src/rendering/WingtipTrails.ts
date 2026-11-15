import * as T from 'three';
export interface CondensationState{id:string;speed:number;liftSpeed:number;airborne:boolean;loadFactor:number;moisture:number}
/** Visual proxy only: no measured dewpoint, wing loading or thermodynamic solver. */
export function condensationStrength(s:CondensationState){
 if(!s.airborne||!['redwing','mc72'].includes(s.id)||s.speed<s.liftSpeed*.95||s.moisture<.86||s.loadFactor<1.9)return 0;
 const smooth=(a:number,b:number,v:number)=>T.MathUtils.smoothstep(v,a,b);
 // Conservative light-seaplane visibility proxy: moist air AND sustained loaded flight.
 return smooth(.86,.98,s.moisture)*smooth(1.9,3.2,s.loadFactor)*smooth(.65,1.45,s.loadFactor*s.liftSpeed/s.speed);
}
export class CondensationController{
 private eligibleTime=0;private value=0;
 update(dt:number,state:CondensationState){if(dt<=0)return this.value;const raw=condensationStrength(state);this.eligibleTime=raw>.015?this.eligibleTime+Math.min(dt,.1):0;const target=this.eligibleTime>=.25?raw:0;this.value+=(target-this.value)*(1-Math.exp(-Math.min(dt,.1)*(target>this.value?5:10)));if(!state.airborne)this.clear();return this.value>.015?this.value:0;}
 clear(){this.eligibleTime=0;this.value=0;}
}

export class WingtipTrails{
 readonly root=new T.Group();private time=0;private accumulator=0;private points:{left:T.Vector3;right:T.Vector3;t:number;strength:number}[]=[];private geometry=new T.BufferGeometry();private positions=new Float32Array(96*2*6*3);private opacity=new Float32Array(96*2*6);
 private material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{},vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
attribute float fade;varying float vFade;void main(){vFade=fade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`#include <logdepthbuf_pars_fragment>
varying float vFade;void main(){gl_FragColor=vec4(.96,.98,1.,vFade*.43);
#include <logdepthbuf_fragment>
#include <colorspace_fragment>
}`});
 constructor(){this.geometry.setAttribute('position',new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage));this.geometry.setAttribute('fade',new T.BufferAttribute(this.opacity,1).setUsage(T.DynamicDrawUsage));this.geometry.setDrawRange(0,0);const mesh=new T.Mesh(this.geometry,this.material);mesh.frustumCulled=false;this.root.add(mesh);this.root.name='Wingtip condensation / redwing and MC72';}
 update(dt:number,plane:T.Object3D,camera:T.Camera,id:string,span:number,active:boolean|number){if(dt<=0)return;this.time+=dt;this.accumulator+=dt;plane.updateMatrixWorld(true);const strength=typeof active==='boolean'?(active?1:0):active;if(strength>.025&&this.accumulator>=1/40){this.accumulator=0;const y=id==='redwing'?1.5:0,z=id==='redwing'?-.3:-.35,left=plane.localToWorld(new T.Vector3(-span*.49,y,z)),right=plane.localToWorld(new T.Vector3(span*.49,y,z));if(this.points.length&&this.points.at(-1)!.left.distanceTo(left)>100)this.points=[];this.points.push({left,right,t:this.time,strength});}this.points=this.points.filter(p=>this.time-p.t<1.4).slice(-96);
 let index=0;for(const side of ['left','right'] as const)for(let i=1;i<this.points.length;i++){const a=this.points[i-1],b=this.points[i],ageA=(this.time-a.t)/1.4,ageB=(this.time-b.t)/1.4;if(b.t-a.t>.09)continue;const axis=b[side].clone().sub(a[side]).cross(camera.position.clone().sub(b[side])).normalize();const edge=(p:T.Vector3,age:number,s:number)=>p.clone().addScaledVector(axis,s*(.035+age*.12));const vertices=[edge(a[side],ageA,-1),edge(a[side],ageA,1),edge(b[side],ageB,-1),edge(a[side],ageA,1),edge(b[side],ageB,1),edge(b[side],ageB,-1)];for(let j=0;j<6;j++){vertices[j].toArray(this.positions,index*3);this.opacity[index++]=Math.pow(1-((j===2||j>=4)?ageB:ageA),1.8)*((j===2||j>=4)?b.strength:a.strength);}}
 this.geometry.setDrawRange(0,index);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.fade.needsUpdate=true;}
 clear(){this.points=[];this.accumulator=0;this.geometry.setDrawRange(0,0);}
 dispose(){this.geometry.dispose();this.material.dispose();}
}
