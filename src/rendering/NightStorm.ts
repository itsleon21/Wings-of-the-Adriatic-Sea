import * as T from 'three';
import {random} from '../world/WorldConfig.ts';
export class StormState{
 flash=0;gust=0;strike=false;private time=0;private until=9;private age=10;private rng=random(9044);
 update(dt:number,night:number,rain:number){
  this.strike=false;if(night<.35||rain<.3){this.flash=this.gust=0;return;}if(dt<=0)return;
  this.time+=dt;this.until-=dt;this.age+=dt;
  if(this.until<=0){this.age=0;this.until=14+this.rng()*15;this.strike=true;}
  this.flash=(Math.exp(-this.age*24)+.45*Math.exp(-Math.abs(this.age-.23)*40))*night*rain;
  this.gust=Math.max(0,Math.sin(this.time*.37))**4*night*rain;
 }
}
export class NightStorm{
 readonly state=new StormState();private light=new T.AmbientLight(0xc2d5ff,0);private bolt:T.LineSegments;
 constructor(scene:T.Scene){this.bolt=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xddeaff,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));this.bolt.frustumCulled=false;scene.add(this.light,this.bolt);}
 update(dt:number,night:number,rain:number,camera:T.Camera){
  this.state.update(dt,night,rain);const s=this.state;this.light.intensity=s.flash*2.4;this.bolt.visible=s.flash>.02;(this.bolt.material as T.LineBasicMaterial).opacity=Math.min(1,s.flash*1.4);
  if(s.strike){const forward=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);forward.y=0;forward.normalize();const origin=camera.position.clone().addScaledVector(forward,1800),vertices:number[]=[];let previous=new T.Vector3(origin.x,1100,origin.z);const rng=random(Math.floor(camera.position.x+camera.position.z)+9281);for(let i=1;i<=12;i++){const next=new T.Vector3(origin.x+(rng()-.5)*180,1100-i*85,origin.z+(rng()-.5)*80);vertices.push(...previous.toArray(),...next.toArray());if(i===5){const branch=next.clone().add(new T.Vector3(130,-130,30));vertices.push(...next.toArray(),...branch.toArray());}previous=next;}this.bolt.geometry.dispose();this.bolt.geometry=new T.BufferGeometry();this.bolt.geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));}
 }
 dispose(){this.light.removeFromParent();this.bolt.removeFromParent();this.bolt.geometry.dispose();(this.bolt.material as T.Material).dispose();}
}
