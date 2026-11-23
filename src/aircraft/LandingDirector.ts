import * as T from 'three';
import type {FlightController} from './FlightController.ts';
import {landingAdvice,landingProfile} from './LandingGuidance.ts';
export interface LandingDestination{name:string;position:T.Vector3;outward?:T.Vector3;rescue?:boolean;crew?:boolean}
export interface LandingPlan {touchdown:T.Vector3;heading:number;distance:number;slope:number;taxiPath?:T.Vector3[]}
export function planWaterLanding(position:T.Vector3,heading:number,clear:(x:number,z:number)=>boolean):LandingPlan|undefined{
 const distance=T.MathUtils.clamp(Math.max(8,position.y)/.045,240,1800);
 for(const angle of [0,-.18,.18,-.35,.35])for(const factor of [1,1.25,.8]){
  const bearing=heading+angle,forward=new T.Vector3(-Math.sin(bearing),0,-Math.cos(bearing)),right=new T.Vector3(Math.cos(bearing),0,-Math.sin(bearing));
  const touchdown=position.clone().addScaledVector(forward,distance*factor);touchdown.y=0;
  let safe=true;
  for(let i=0;i<=20&&safe;i++){
   const p=position.clone().addScaledVector(forward,distance*factor*i/20);
   if(!clear(p.x,p.z))safe=false;
  }
  // Check the entire final water run, including both float-side margins.
  for(let along=-200;along<=300&&safe;along+=50)for(const side of [-35,0,35]){
   const p=touchdown.clone().addScaledVector(forward,along).addScaledVector(right,side);
   if(!clear(p.x,p.z)){safe=false;break;}
  }
  if(safe)return{touchdown,heading:bearing,distance:distance*factor,slope:Math.max(6,position.y)/(distance*factor)};
 }
}
export function waterTaxiRoute(from:T.Vector3,to:T.Vector3,clear:(x:number,z:number)=>boolean):T.Vector3[]|undefined{
 if(clearTaxiPath(from,to,clear))return[from.clone(),to.clone()];
 const step=35,minX=Math.min(from.x,to.x)-450,minZ=Math.min(from.z,to.z)-450;
 const width=Math.ceil((Math.abs(from.x-to.x)+900)/step)+1,height=Math.ceil((Math.abs(from.z-to.z)+900)/step)+1;
 if(width*height>16000)return;
 const point=(id:number)=>new T.Vector3(minX+id%width*step,0,minZ+Math.floor(id/width)*step);
 const start=Math.round((from.z-minZ)/step)*width+Math.round((from.x-minX)/step);
 const previous=new Int32Array(width*height).fill(-1),queue=[start];previous[start]=start;
 let goal=-1;
 for(let i=0;i<queue.length;i++){
  const id=queue[i],p=point(id);
  if(p.distanceTo(to)<55&&clearTaxiPath(p,to,clear)){goal=id;break;}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=id%width+dx,z=Math.floor(id/width)+dz,next=z*width+x;
   if(x<0||z<0||x>=width||z>=height||previous[next]>=0)continue;
   const q=point(next),mid=p.clone().lerp(q,.5);
   if(!clear(q.x,q.z)||!clear(mid.x,mid.z))continue;
   previous[next]=id;queue.push(next);
  }
 }
 if(goal<0)return;
 const path=[to.clone()];let id=goal;
 while(id!==start){path.push(point(id));id=previous[id];}
 path.push(from.clone());return path.reverse();
}
export function planTaskLanding(position:T.Vector3,target:LandingDestination,clear:(x:number,z:number)=>boolean):LandingPlan|undefined{
 const outward=target.outward?.clone().normalize()??position.clone().sub(target.position).setY(0).normalize();
 if(outward.lengthSq()<.5)outward.set(0,0,1);
 const distance=T.MathUtils.clamp(Math.max(30,position.y)/.045,650,2000);
 for(const offset of [0,-.25,.25,-.5,.5,-.8,.8,-1.2,1.2,-1.6,1.6,-2.2,2.2,Math.PI])for(const standOff of [500,320,750]){
  const away=outward.clone().applyAxisAngle(new T.Vector3(0,1,0),offset);
  const touchdown=target.position.clone().addScaledVector(away,target.rescue?300:standOff).setY(0);
  const forward=away.clone().negate(),right=new T.Vector3(-forward.z,0,forward.x);
  let safe=true;
  for(let along=-distance;along<=220&&safe;along+=60)for(const side of [-35,0,35]){
   const p=touchdown.clone().addScaledVector(forward,along).addScaledVector(right,side);
   if(!clear(p.x,p.z)){safe=false;break;}
  }
  if(safe){
   const taxiPath=waterTaxiRoute(touchdown,target.position,clear);
   if(taxiPath)return{touchdown,heading:Math.atan2(-forward.x,-forward.z),distance,slope:T.MathUtils.clamp(position.y/distance,.025,.065),taxiPath};
  }
 }
}
export function planLandingRetry(target:LandingDestination,clear:(x:number,z:number)=>boolean){
 const outward=target.outward?.clone().setY(0).normalize()??new T.Vector3(0,0,1);
 const reference=target.position.clone().addScaledVector(outward,1600).setY(70);
 const plan=planTaskLanding(reference,target,clear);
 if(!plan)return;
 const back=new T.Vector3(Math.sin(plan.heading),0,Math.cos(plan.heading));
 const position=plan.touchdown.clone().addScaledVector(back,plan.distance).setY(plan.distance*plan.slope+10);
 return {position,heading:plan.heading};
}
export function clearTaxiPath(from:T.Vector3,to:T.Vector3,clear:(x:number,z:number)=>boolean){
 const length=from.distanceTo(to),count=Math.max(2,Math.ceil(length/30));
 for(let i=0;i<count;i++){
  if(length*(1-i/count)<35)break;
  const p=from.clone().lerp(to,i/count);if(!clear(p.x,p.z))return false;
 }
 return true;
}
export class LandingDirector{
 readonly root=new T.Group();plan?:LandingPlan;message='';
 private corridor=new T.Group();private gates:T.LineSegments[]=[];
 private mat=new T.LineBasicMaterial({color:0xffd185,transparent:true,opacity:.65,depthWrite:false});
 private zone:T.Mesh;private retry=0;private activated=false;
 private destinationKey='';navigationPoint?:{name:string;position:T.Vector3};private taxiRoute?:T.Vector3[];private taxiClock=0;
 private taxi=new T.Line(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(new Float32Array(3072),3)),new T.LineBasicMaterial({color:0x9ae8c4,transparent:true,opacity:.8,depthWrite:false}));
 private dockMarker=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:32},(_,i)=>new T.Vector3(Math.cos(i/32*Math.PI*2)*9,0,Math.sin(i/32*Math.PI*2)*9))),this.mat);
 constructor(){
  this.root.name='Water landing / fixed approach and touchdown zone';this.root.visible=false;this.root.add(this.corridor,this.taxi,this.dockMarker);
  const positions=[-24,0,0,-24,9,0,-24,9,0,-17,9,0,24,0,0,24,9,0,24,9,0,17,9,0];
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  for(let i=0;i<7;i++){const gate=new T.LineSegments(geometry,this.mat);this.gates.push(gate);this.corridor.add(gate);}
  this.zone=new T.Mesh(new T.PlaneGeometry(48,220),new T.MeshBasicMaterial({color:0x78eac5,transparent:true,opacity:.09,side:T.DoubleSide,depthWrite:false}));
  this.zone.rotation.x=-Math.PI/2;this.corridor.add(this.zone);
  const edge=new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(48,220)),this.mat);edge.rotation.x=-Math.PI/2;edge.position.set(0,.15,-110);this.corridor.add(edge);
  // The touchdown aim mark sits at the near end of the water run.
  const aim=new T.LineSegments(new T.BufferGeometry().setFromPoints([new T.Vector3(-12,0,0),new T.Vector3(12,0,0),new T.Vector3(0,0,-8),new T.Vector3(0,0,8)]),this.mat);
  aim.position.y=.8;this.corridor.add(aim);
 }
 reset(){this.plan=undefined;this.activated=false;this.retry=0;this.root.visible=false;this.message='';this.navigationPoint=undefined;this.destinationKey='';this.taxiRoute=undefined;this.taxiClock=0;}
 update(dt:number,flight:FlightController,enabled:boolean,clear:(x:number,z:number)=>boolean,wave:(x:number,z:number)=>number,target?:LandingDestination){
  if(!enabled||flight.state==='CRASHED'||!target&&flight.state!=='AIRBORNE'){this.reset();return;}
  const key=target?target.name+'/'+target.position.x+'/'+target.position.z:'';
  if(key!==this.destinationKey){this.reset();this.destinationKey=key;}
  this.taxi.visible=this.dockMarker.visible=!!target;
  if(target){
   const goal=target.position;
   this.dockMarker.position.set(goal.x,wave(goal.x,goal.z)+.8,goal.z);
   const metres=Math.hypot(flight.position.x-goal.x,flight.position.z-goal.z);
   if(flight.state!=='AIRBORNE'){
    this.root.visible=true;this.corridor.visible=false;
    this.taxiClock-=dt;
    if(!this.taxiRoute||this.taxiClock<=0){this.taxiRoute=waterTaxiRoute(flight.position,goal,clear);this.taxiClock=3;}
    const path=this.taxiRoute;
    if(!path){this.taxi.visible=false;this.navigationPoint={name:target.name,position:goal.clone()};this.message='前方水道受阻 · 减速并沿开阔水面绕行';return;}
    let nearest=0;
    path.forEach((p,i)=>{if(p.distanceTo(flight.position)<path[nearest].distanceTo(flight.position))nearest=i;});
    const remainingPath=[flight.position.clone(),...path.slice(Math.min(path.length-1,nearest+1))];
    this.setTaxi(flight.position,goal,wave,remainingPath);
    this.navigationPoint={name:remainingPath.length>2?'沿水道前往 '+target.name:target.name,position:remainingPath[1].clone()};
    this.message=target.rescue?(metres<=35&&flight.groundSpeed<=.55?'保持静止 · 正在接人':'滑行至求救船35米内 · 降至2 km/h以下'):
     target.crew&&metres<=22&&flight.groundSpeed*3.6<=5?'已到蓝帆船侧 · 按 F 与船员交谈':
     target.crew?'循光线滑行至船侧 · '+Math.round(metres)+' m · 减速至 5 km/h 后按 F':
     metres<=35&&flight.groundSpeed<5?'已到任务停靠点 · 按 F 靠泊交付':flight.groundSpeed>5?'已着水 · 收油减速，再循光线滑行至 '+target.name:'沿水面光线滑行 · '+target.name+' '+Math.round(metres)+' m · 18 km/h以下按 F';
    return;
   }
  }
  this.corridor.visible=true;
  this.retry-=dt;
  if(!this.activated||!this.plan&&this.retry<=0){
   this.plan=target?planTaskLanding(flight.position,target,clear):planWaterLanding(flight.position,flight.groundTrack,clear);this.activated=true;this.retry=2;
  }
  const plan=this.plan;this.root.visible=!!plan;
  if(!plan){
   this.root.visible=!!target;this.corridor.visible=false;this.taxi.visible=false;
   this.navigationPoint=target?{name:'目的地外海 · 先寻找开阔进近方向',position:target.position.clone().addScaledVector(target.outward??new T.Vector3(0,0,1),1000)}:undefined;
   this.message='未找到安全接水航线 · 请转向目的地外海重新进近';return;
  }
  const forward=new T.Vector3(-Math.sin(plan.heading),0,-Math.cos(plan.heading)),right=new T.Vector3(Math.cos(plan.heading),0,-Math.sin(plan.heading));
  const delta=flight.position.clone().sub(plan.touchdown),remaining=-delta.dot(forward),lateral=delta.dot(right);
  const heightError=flight.position.y-Math.max(flight.tuning.hullOffset,remaining*plan.slope);
  const waterGood=clear(plan.touchdown.x,plan.touchdown.z);
  const contact=flight.landingContact;
  const advice=landingAdvice(flight.tuning,{...contact,state:flight.state,speed:flight.airspeed,groundSpeed:flight.groundSpeed,bank:flight.bank,pitch:flight.pitch,throttle:flight.throttle,landingCount:flight.landingCount,overWater:waterGood,clearAhead:waterGood,rolling:flight.rolling||!!flight.maneuver});
  const danger=!waterGood||Math.abs(lateral)>90||advice.tone==='danger'||remaining< -100;
  this.mat.color.setHex(danger?0xf28172:advice.speedGood&&advice.sinkGood&&advice.bankGood&&Math.abs(heightError)<12&&Math.abs(lateral)<25?0x78eac5:0xffd185);
  (this.zone.material as T.MeshBasicMaterial).color.copy(this.mat.color);
  this.corridor.position.copy(plan.touchdown);this.corridor.position.y=wave(plan.touchdown.x,plan.touchdown.z)+.5;
  this.corridor.rotation.y=plan.heading;
  this.zone.position.set(0,0,-110);
  this.gates.forEach((gate,i)=>{
   const back=70+i*Math.max(55,plan.distance/7);
   gate.position.set(0,back*plan.slope,back);gate.visible=remaining>back-100;
  });
  if(target){
   this.setTaxi(plan.touchdown,target.position,wave,plan.taxiPath);
   const entry=plan.touchdown.clone().addScaledVector(forward,-plan.distance);entry.y=plan.distance*plan.slope;
   this.navigationPoint=Math.abs(lateral)>90||remaining<0||remaining>plan.distance+150?
    {name:'任务降落 · 进近入口',position:entry}:{name:'任务降落 · 接水区',position:plan.touchdown.clone()};
  }else this.navigationPoint=undefined;
  const headingError=Math.abs(Math.atan2(Math.sin(flight.heading-plan.heading),Math.cos(flight.heading-plan.heading)));
  const profile=landingProfile(flight.tuning.id);
  this.message=target&&headingError>Math.PI/3?'循罗盘转向进近航线，先对正再下降':remaining<0?'已越过接水区 · 加油复飞，循罗盘绕回进近入口':
   Math.abs(lateral)>25?(lateral>0?'向左修正':'向右修正')+' · 偏离 '+Math.round(Math.abs(lateral))+' m':
   flight.altitude<profile.flareHeight?'拉平接水 · 机翼保持水平':
   heightError>12?'高于下滑路径 · 适当收油，平缓下降':heightError< -12?'低于下滑路径 · 适当加油减缓下降':
   '沿光框平稳下降 · 接水区 '+Math.round(remaining)+' m';
 }
 private setTaxi(from:T.Vector3,to:T.Vector3,wave:(x:number,z:number)=>number,path?:T.Vector3[]){
  const points=(path??[from,to]).map(p=>new T.Vector3(p.x,wave(p.x,p.z)+.65,p.z));
  let attribute=this.taxi.geometry.getAttribute('position') as T.BufferAttribute;
  if(attribute.count<points.length){
   attribute=new T.Float32BufferAttribute(new Float32Array(points.length*3),3);this.taxi.geometry.setAttribute('position',attribute);
  }
  points.forEach((p,i)=>attribute.setXYZ(i,p.x,p.y,p.z));
  attribute.needsUpdate=true;this.taxi.geometry.setDrawRange(0,points.length);this.taxi.frustumCulled=false;

 }
 dispose(){
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
  this.root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.root.removeFromParent();
 }
}
