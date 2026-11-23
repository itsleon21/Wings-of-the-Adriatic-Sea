import {nightApproach,wantsNightMooring} from './HarborNavigation.ts';
import {waterfrontPoint,inTakeoffChannel} from './IslandDetails.ts';
import {mooringSites} from './Moorings.ts';
import {buildVessel,trimVesselSails} from './VesselModel.ts';
import * as T from 'three';
import {islands,hotelIsland,northCoast,allLandforms,harborRunway,terrainHeight,bayProfile,random,townPoint,townLocal,terrainRadii,coveLocal} from './WorldConfig.ts';
import type {IslandDefinition} from './WorldConfig.ts';
const step=120,size=101,origin=-6000;
const base=islands[0],town=islands[1];
const townApproach=townPoint(town,town.x-70,town.z+town.rz*bayProfile(town).offset+235);
export const bayShuttleEndpoints=[new T.Vector3(base.x-base.rz*bayProfile(base).offset-99,0,base.z-10),new T.Vector3(townApproach.x,0,townApproach.z)] as const;
/** Seeded personal tracks keep traffic inside the bay-to-bay corridor without a queue of identical lines. */
export function bayShuttleCurve(seed:number){
 const rng=random(seed),[a,b]=bayShuttleEndpoints,forward=b.clone().sub(a),normal=new T.Vector3(-forward.z,0,forward.x).normalize();
 for(let attempt=0;attempt<40;attempt++){
  const start=a.clone().addScaledVector(normal,(rng()-.5)*15),end=b.clone().addScaledVector(normal,(rng()-.5)*20),c1=start.clone().addScaledVector(forward,.27+rng()*.10).addScaledVector(normal,(rng()-.5)*250),c2=end.clone().addScaledVector(forward,-.27-rng()*.10).addScaledVector(normal,(rng()-.5)*250),curve=new T.CubicBezierCurve3(start,c1,c2,end);
  if(Array.from({length:81},(_,i)=>curve.getPoint(i/80)).every(p=>allLandforms.every(d=>[-24,24].every(dx=>[-24,24].every(dz=>terrainHeight(d,p.x+dx,p.z+dz)<-3)))))return curve;
 }
 throw Error('No safe varied bay shuttle track');
}

// Curved open-water excursions, with complete hull-clearance sampling.
export function roamingSeaCurve(seed:number){
 const rng=random(seed);
 for(let attempt=0;attempt<250;attempt++){
  const cx=(rng()-.5)*10000,cz=(rng()-.5)*10000,rx=240+rng()*520,rz=200+rng()*480;
  const points=Array.from({length:9},(_,i)=>{const a=i/8*Math.PI*2;return new T.Vector3(cx+Math.cos(a)*rx,0,cz+Math.sin(a)*rz);});
  const curve=new T.CatmullRomCurve3(points,true,'centripetal');
  if(Array.from({length:121},(_,i)=>curve.getPointAt(i/120)).every(p=>trafficWater(p.x,p.z)&&allLandforms.every(d=>[-30,30].every(dx=>[-30,30].every(dz=>terrainHeight(d,p.x+dx,p.z+dz)<-3)))))return curve;
 }throw Error('No open-water excursion');
}
export function inBayShuttleLane(x:number,z:number){const [a,b]=bayShuttleEndpoints,dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<72;}
/** Offshore service routes exclude the secret cove, reefs and the base takeoff lane. */
export function trafficWater(x:number,z:number){
 if(Math.abs(x)>5900||Math.abs(z)>5900)return false;
 if(inBayShuttleLane(x,z))return allLandforms.every(d=>[-24,24].every(dx=>[-24,24].every(dz=>terrainHeight(d,x+dx,z+dz)<-3)));
 if(Math.abs(x-harborRunway.x)<280&&z>harborRunway.z-180&&z<harborRunway.z+1700)return false;
 return allLandforms.every(d=>d.id===northCoast.id
  ? [-35,0,35].every(dx=>terrainHeight(d,x+dx,z-45)<-4)&&terrainHeight(d,x,z)<-5
  : trafficIslandClearance(d,x,z));
}
function trafficIslandClearance(d:(typeof islands)[number],x:number,z:number){
 const p=d.id==='town'?townLocal(d,x,z):d.id==='cove'?coveLocal(d,x,z):{x,z};
 return Math.hypot((p.x-d.x)/(d.rx*1.6+100),(p.z-d.z)/(d.rz*1.6+100))>(d.id==='cove'?1.35:1);
}
function route(a:T.Vector3,b:T.Vector3){
 const key=(x:number,z:number)=>z*size+x,cell=(p:T.Vector3)=>[Math.round((p.x-origin)/step),Math.round((p.z-origin)/step)],start=cell(a),end=cell(b),from=new Int32Array(size*size).fill(-1),queue=[key(start[0],start[1])],goal=key(end[0],end[1]);from[queue[0]]=queue[0];
 for(let i=0;i<queue.length&&from[goal]<0;i++){const id=queue[i],x=id%size,z=Math.floor(id/size);for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,nz=z+dz,n=key(nx,nz);if(nx<0||nz<0||nx>=size||nz>=size||from[n]>=0||!trafficWater(origin+nx*step,origin+nz*step))continue;if(dx&&dz&&(!trafficWater(origin+x*step,origin+nz*step)||!trafficWater(origin+nx*step,origin+z*step)))continue;from[n]=id;queue.push(n);}}
 if(from[goal]<0)throw Error('Missing safe sea traffic route');const points:T.Vector3[]=[];let id=goal;while(true){points.push(new T.Vector3(origin+(id%size)*step,0,origin+Math.floor(id/size)*step));if(from[id]===id)break;id=from[id];}points.reverse();return new T.CatmullRomCurve3(points,false,'centripetal');
}
export function vesselIslandScale(from:string,to:string){
 const ports=[...islands,hotelIsland],a=ports.find(d=>d.id===from)!,b=ports.find(d=>d.id===to)!;
 const small=Math.sqrt(Math.min(a.rx*a.rz,b.rx*b.rz));
 return T.MathUtils.clamp(.66+small/1200,.72,1.10);
}
export const trafficSchedule=[
 ['harbor','town',9],['harbor','hotel',2],['harbor','pine',1],['town','lighthouse',1],
 ['town','coral',1],['coral','hotel',2],['pine','lighthouse',1],['pine','coral',1],['hotel','lighthouse',1],
] as const;
let cachedRoutes:{from:string;to:string;curve:T.Curve<T.Vector3>;count:number;direct:boolean}[]|undefined;
export function buildTrafficRoutes(){
 if(cachedRoutes)return cachedRoutes;
 const ports=[...islands,hotelIsland].filter(d=>d.id!=='cove').map(d=>({id:d.id,point:new T.Vector3(d.x-d.rx*1.6-250,0,d.z)}));
 return cachedRoutes=trafficSchedule.map(([from,to,count])=>{
  const direct=from==='harbor'&&to==='town';
  return{from,to,count,direct,curve:direct?new T.LineCurve3(...bayShuttleEndpoints):route(ports.find(p=>p.id===from)!.point,ports.find(p=>p.id===to)!.point)};
 });
}
let cachedAnchorages:{island:string;x:number;z:number;heading:number}[]|undefined;
export function harborVesselSites(){if(cachedAnchorages)return cachedAnchorages;const sites:{island:string;x:number;z:number;heading:number}[]=[];for(const d of islands.filter(d=>d.id==='harbor'||d.id==='town')){const chosen:typeof sites=[];for(let i=0;i<320&&chosen.length<3;i++){const a=-3.0+(i%80)/80*2.85,p=waterfrontPoint(d,a,-65-Math.floor(i/80)*30);
 if(inTakeoffChannel(d,p.x,p.z,45)||mooringSites.some(m=>Math.hypot(m.berth.x-p.x,m.berth.z-p.z)<90)||chosen.some(s=>Math.hypot(s.x-p.x,s.z-p.z)<85))continue;
 if(![-25,0,25].every(dx=>[-25,0,25].every(dz=>terrainHeight(d,p.x+dx,p.z+dz)<-2)))continue;
 chosen.push({island:d.id,x:p.x,z:p.z,heading:Math.atan2(-p.nx,-p.nz)});
 }if(chosen.length!==3)throw new Error('Insufficient safe harbour anchorages: '+d.id);sites.push(...chosen);}return cachedAnchorages=sites;}

/** Small harbour shuttles use a side corridor, not the aircraft's straight-in approach. */
export function localTrafficRoutes(){return mooringSites.map((site,index)=>{
 for(const lateral of [150,220,300,400,550])for(const side of [-1,1])for(const outward of [100,200,350,500]){
  const point=(t:number)=>new T.Vector3(site.x+site.dz*lateral*side+site.dx*(outward+t*260),0,site.z-site.dx*lateral*side+site.dz*(outward+t*260));
  const samples=Array.from({length:25},(_,i)=>point(i/24));
  if(samples.every(p=>Math.abs(p.x)<5900&&Math.abs(p.z)<5900&&allLandforms.every(d=>terrainHeight(d,p.x,p.z)<-3&&!inTakeoffChannel(d,p.x,p.z,65))&&mooringSites.every(m=>{const dx=p.x-m.berth.x,dz=p.z-m.berth.z;return Math.hypot(dx,dz)>130&&!(Math.abs(dx*m.dz-dz*m.dx)<110&&dx*m.dx+dz*m.dz>-80&&dx*m.dx+dz*m.dz<600);})))return{island:site.id,curve:new T.LineCurve3(point(0),point(1)),phase:(index*.381)%1};
 }
 throw new Error('No clear harbour service lane: '+site.id);
});}

export class SeaTraffic{
 readonly root=new T.Group();readonly routes=buildTrafficRoutes();readonly bounds:T.Box3[]=[];private vessels:{root:T.Group;route:number;path:T.Curve<T.Vector3>;offset:number;speed:number;length:number;lane:number;sailing:boolean;approaches:T.CurvePath<T.Vector3>[];mode:'cruising'|'returning'|'moored'|'departing';end:number;progress:number;returnT:number;laneFade:number;returnLane:T.Vector3;wait:number;berthDelay?:number;holding?:T.Vector3}[]=[];private anchored:{root:T.Group;x:number;z:number;heading:number;bounds:T.Box3}[]=[];private local:{root:T.Group;curve:T.LineCurve3;phase:number;bounds:T.Box3;nightT?:number}[]=[];private hour=12;private previousTime=0;private initialized=false;private lamps=new T.MeshBasicMaterial({color:0xffd18a,toneMapped:false});
 constructor(){this.root.name='Inter-island ferries / secret cove excluded';
  this.routes.forEach((r,index)=>{for(let n=0;n<r.count;n++){const roam=r.direct?n>=7:n>=Math.ceil(r.count/2),path=roam?roamingSeaCurve(371+index*313+n*73):r.direct?bayShuttleCurve(417+n*113):r.curve,kind=n===0?'ferry':n%2?'fishing':'sailing',g=buildVessel(kind,index*7+n,this.lamps);g.name=`${r.from} ↔ ${r.to} / ${kind}`;g.userData.route=[r.from,r.to];g.userData.roaming=roam;if(r.direct)g.userData.track=path;g.scale.setScalar((kind==='ferry'?1.55:kind==='fishing'?1.45:1.65)*vesselIslandScale(r.from,r.to));this.root.add(g);this.vessels.push({root:g,route:index,path,offset:((Math.sin(index*81.3+n*37.1)*43758.5)%1+1)%1,speed:(kind==='sailing'?3.7+(n%3)*.2:kind==='fishing'?4.8:7.2)*( .76+random(729+n*17+index*131)()*.55),length:path.getLength(),lane:r.direct?25:26+random(981+index*73+n*11)()*44,sailing:kind==='sailing',approaches:[nightApproach(r.from,path.getPointAt(0),index*100+n,harborVesselSites()),nightApproach(r.to,path.getPointAt(1),index*100+n+50,harborVesselSites())],mode:'cruising',end:0,progress:0,returnT:0,laneFade:1,returnLane:new T.Vector3(),wait:0});this.bounds.push(new T.Box3());}});
  for(const [i,site] of harborVesselSites().entries()){const boat=buildVessel(i%3===2?'sailing':'fishing',31+i,this.lamps);boat.name=site.island+' / inner bay moored vessel';boat.userData.harbor=site.island;boat.scale.setScalar(i%3===2?.85:1);const bounds=new T.Box3();this.anchored.push({root:boat,...site,bounds});this.root.add(boat);this.bounds.push(bounds);}for(const [i,r] of localTrafficRoutes().entries()){const boat=buildVessel(i%2?'fishing':'sailing',73+i,this.lamps);boat.scale.setScalar(.75*vesselIslandScale(r.island,r.island));boat.name=r.island+' / harbour arrival and departure';boat.userData.localHarbor=r.island;const bounds=new T.Box3();this.local.push({root:boat,...r,bounds});this.root.add(boat);this.bounds.push(bounds);}this.root.children.forEach(boat=>boat.scale.multiplyScalar(1.05));this.update(0,()=>({height:0,dx:0,dz:0}));this.initialized=false;
 }

 addRaceSpectators(islandsOnCourse:readonly IslandDefinition[]){
  if(!islandsOnCourse.length)return;
  const localLanes=localTrafficRoutes(),selected:T.Vector3[]=[];
  for(const [index,island] of islandsOnCourse.entries()){
   const rng=random(315+island.seed),{rx,rz}=terrainRadii(island),startAngle=rng()*Math.PI*2;
   const count=island.bay?3:2;
   for(let attempt=0,placed=0;attempt<120&&placed<count;attempt++){
    const angle=startAngle+attempt*2.39996,spacing=90+rng()*145;
    const point=new T.Vector3(island.x+Math.cos(angle)*(rx+spacing),0,island.z+Math.sin(angle)*(rz+spacing));
    if(Math.max(Math.abs(point.x),Math.abs(point.z))>5750)continue;
    if(island.id==='harbor'&&Math.abs(point.z-island.z)<160&&point.x<island.x)continue;
    if(inBayShuttleLane(point.x,point.z)||allLandforms.some(d=>inTakeoffChannel(d,point.x,point.z,110)))continue;
    if(allLandforms.some(d=>[-40,0,40].some(dx=>[-40,0,40].some(dz=>terrainHeight(d,point.x+dx,point.z+dz)>-5))))continue;
    if(mooringSites.some(m=>Math.hypot(point.x-m.berth.x,point.z-m.berth.z)<205))continue;
    if(localLanes.some(lane=>new T.Line3(lane.curve.v1,lane.curve.v2).closestPointToPoint(point,true,new T.Vector3()).distanceTo(point)<80))continue;
    if(selected.some(p=>p.distanceTo(point)<125)||this.anchored.some(v=>Math.hypot(v.x-point.x,v.z-point.z)<95))continue;
    if(this.vessels.some(v=>Math.hypot(v.root.position.x-point.x,v.root.position.z-point.z)<80))continue;
    const root=buildVessel(placed%2===0?'fishing':'sailing',index*13+placed+82,this.lamps);
    root.name=island.id+' / race spectator boat';root.userData.spectatorIsland=island.id;
    root.position.copy(point);root.scale.setScalar(1.05);
    const heading=Math.atan2(point.x-island.x,point.z-island.z)+Math.PI*.32,bounds=new T.Box3();
    this.anchored.push({root,x:point.x,z:point.z,heading,bounds});this.root.add(root);this.bounds.push(bounds);
    selected.push(point);placed++;
   }
  }
  this.update(0,()=>({height:0,dx:0,dz:0}));
 }
 setNightness(n:number,hour=12){if(this.previousTime<1&&wantsNightMooring(hour)&&!wantsNightMooring(this.hour))this.initialized=false;this.hour=hour;this.lamps.color.setRGB(1,.62,.28).multiplyScalar(.12+n*1.6);}
 update(time:number,water:(x:number,z:number)=>{height:number;dx:number;dz:number},aircraft?:{position:T.Vector3;speed:number;onWater:boolean}){
  if(time<this.previousTime){this.initialized=false;for(const v of this.vessels){v.mode='cruising';v.progress=0;v.wait=0;v.holding=undefined;v.berthDelay=0;}}
  const dt=Math.max(0,time-this.previousTime),night=wantsNightMooring(this.hour);this.previousTime=time;
  this.vessels.forEach((v,i)=>{
   const curve=v.path,duration=v.length/v.speed,cycle=duration*2+60;
   const previousProgress=v.progress,previousReturn=v.returnT;
   const clearOfFleet=(p:T.Vector3,spawn=false)=>{
    const close=(q:T.Vector3,r:number)=>Math.hypot(p.x-q.x,p.z-q.z)<r;
    return !this.vessels.some((other,j)=>j!==i&&(!spawn||j<i)&&close(other.root.position,45))
     &&!this.anchored.some(other=>close(other.root.position,40))
     &&!this.local.some(other=>close(other.root.position,39));
   };
   // The crossing of the base water runway gives way to aircraft instead of detouring west.
   const giveWay=aircraft&&aircraft.speed>9&&aircraft.position.y<16&&Math.abs(v.root.position.x-harborRunway.x)<220&&v.root.position.distanceTo(aircraft.position)<340,movingDt=giveWay?0:dt;
   if(giveWay&&v.mode==='cruising')v.wait+=dt;
   const phase=((time-v.wait+v.offset*cycle)%cycle+cycle)%cycle;
   const backwards=phase>duration+30,t=phase<duration?phase/duration:phase<duration+30?1:phase<duration*2+30?1-(phase-duration-30)/duration:0;
   let p:T.Vector3,tangent:T.Vector3;
   const hotelEvening=this.hour>=17&&this.hour<23&&this.routes[v.route].to==='hotel';
   const dockTonight=night&&(i%10!==9);
   if((dockTonight||hotelEvening)&&v.mode==='cruising'){v.end=hotelEvening?1:t>.5?1:0;v.returnT=t;v.progress=0;v.laneFade=1;v.berthDelay=0;v.holding=undefined;v.returnLane.copy(v.root.position).sub(curve.getPointAt(t));v.returnLane.y=0;v.mode=this.initialized?'returning':'moored';if(!this.initialized)v.progress=1;}
   if(!dockTonight&&!hotelEvening&&v.mode==='moored'){v.mode='departing';v.holding=undefined;}
   let justDeparted=false;
   if(v.mode==='returning'){
    const amount=v.speed*movingDt/v.length;v.returnT=v.end?Math.min(1,v.returnT+amount):Math.max(0,v.returnT-amount);
    if(Math.abs(v.returnT-v.end)<1e-7)v.progress=Math.min(1,v.progress+v.speed*movingDt/v.approaches[v.end].getLength());
    if(v.progress===1&&v.root.position.distanceTo(v.approaches[v.end].getPoint(1))<Math.max(2,v.speed*movingDt)&&clearOfFleet(v.approaches[v.end].getPoint(1)))v.mode='moored';
   }else if(v.mode==='departing'){
    v.progress=Math.max(0,v.progress-v.speed*movingDt/v.approaches[v.end].getLength());
    if(v.progress===0){justDeparted=true;v.mode='cruising';v.offset=((v.end?duration:0)-time)/cycle;}
   }
   if(v.mode==='moored'||v.mode==='departing'||v.mode==='returning'&&v.progress>0){const path=v.approaches[v.end];p=v.holding?.clone()??path.getPoint(v.progress);tangent=path.getTangent(Math.min(.99999,v.progress)).multiplyScalar(v.mode==='departing'?-1:1);}
   else if(v.mode==='returning'){p=curve.getPointAt(v.returnT);tangent=curve.getTangentAt(v.returnT).multiplyScalar(v.end?1:-1);p.addScaledVector(v.returnLane,v.laneFade);}
   else if(justDeparted){p=curve.getPointAt(v.end);tangent=curve.getTangentAt(v.end).multiplyScalar(v.end?-1:1);}
   else{p=curve.getPointAt(t);tangent=curve.getTangentAt(t).multiplyScalar(backwards?-1:1);let turn=0;if(phase>=duration&&phase<=duration+30)turn=(phase-duration)/30;else if(phase>=duration*2+30)turn=(phase-duration*2-30)/30;const lane=new T.Vector3(-tangent.z,0,tangent.x).multiplyScalar(v.lane*Math.cos(turn*Math.PI));const offset=p.clone().add(lane);
    if(trafficWater(offset.x,offset.z))p.copy(offset);
    if(turn)tangent.applyAxisAngle(new T.Vector3(0,1,0),turn*Math.PI);}
   if(v.mode==='returning'){if(v.progress>0)p.addScaledVector(v.returnLane,v.laneFade);v.laneFade=Math.max(0,v.laneFade-dt/8);}
   if(this.initialized&&movingDt>0&&v.mode!=='moored'){
    const start=v.root.position.clone().setY(0),delta=p.clone().sub(start);
    const limit=v.speed*movingDt*1.45;
    if(delta.length()>Math.max(1.1,limit)){p=start.add(delta.clampLength(0,limit));tangent=delta.normalize();}
   }
   if(!this.initialized&&v.mode==='cruising'&&!clearOfFleet(p,true)){
    // Pick another point on the same route rather than spawning a hull inside another boat.
    for(let attempt=1;attempt<=32;attempt++){
     const candidateT=(t+attempt*61/v.length)%1,candidate=curve.getPointAt(candidateT);
     if(!clearOfFleet(candidate,true))continue;
     p=candidate;tangent=curve.getTangentAt(candidateT);
     v.offset=(candidateT*duration-time+v.wait)/cycle;break;
    }
   }else if(this.initialized&&dt>0&&v.mode!=='moored'&&!clearOfFleet(p)){
    // Give way to the occupied channel, including across different route families.
    // Keeping the previous progress prevents a teleport when the channel clears.
    const start=v.root.position.clone().setY(0);
    const side=new T.Vector3(-tangent.z,0,tangent.x).normalize();
    // At a merge use a short, speed-limited sidestep if the right-hand water is clear.
    // Smaller partial advances also let a following boat close a gap without overlapping.
    const step=v.speed*movingDt;
    const choices=[p.clone().addScaledVector(side,52),p.clone().addScaledVector(side,-52),p];
    p=start;tangent=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),v.root.rotation.y);
    const wet=(q:T.Vector3)=>[-20,20].every(dx=>[-20,20].every(dz=>
     allLandforms.every(land=>terrainHeight(land,q.x+dx,q.z+dz)<-2)));
    for(const goal of choices){
     if(!clearOfFleet(goal)||!wet(goal))continue;
     const heading=goal.clone().sub(start),candidate=start.clone().add(heading.clone().clampLength(0,step));
     if(candidate.distanceToSquared(start)<1e-6||!clearOfFleet(candidate)||!wet(candidate))continue;
     p=candidate;tangent=heading.normalize();break;
    }
    if(!giveWay&&v.mode==='cruising')v.wait+=dt;
    if(v.mode==='returning'||v.mode==='departing'){v.progress=previousProgress;v.returnT=previousReturn;}
    if(v.mode==='returning'){
     v.berthDelay=(v.berthDelay??0)+dt;
     // If berths back up, anchor in the approach roadstead at the current safe position.
     if(v.berthDelay>=35&&p.distanceTo(v.approaches[v.end].getPoint(1))<550&&wet(p)){
      v.holding=p.clone();v.mode='moored';
     }
    }
   }else if(v.mode==='returning'){
    v.berthDelay=0;
   }
   const w=water(p.x,p.z);v.root.position.set(p.x,w.height,p.z);v.root.rotation.set(Math.atan(w.dz)*.4,Math.atan2(-tangent.x,-tangent.z),-Math.atan(w.dx)*.4);v.root.userData.nightMode=v.mode;
   if(v.sailing)trimVesselSails(v.root,this.windSpeed,v.speed,dt,v.mode!=='moored');
   this.bounds[i].min.set(p.x-21,w.height-2.1,p.z-21);this.bounds[i].max.set(p.x+21,w.height+(v.sailing?28.4:10.5),p.z+21);
  });
  for(const v of this.local){const phase=(time/(165+v.phase*105)+v.phase)%2,dayT=phase<1?phase:2-phase;if(night)v.nightT=this.initialized?Math.max(0,(v.nightT??dayT)-dt*4/v.curve.getLength()):0;else if(v.nightT!==undefined){v.nightT=Math.min(1,v.nightT+dt*4/v.curve.getLength());if(v.nightT>=dayT)v.nightT=undefined;}const t=v.nightT??dayT,p=v.curve.getPoint(t);
   if(this.initialized&&dt>0&&[...this.vessels,...this.anchored,...this.local].some(other=>other!==v&&Math.hypot(other.root.position.x-p.x,other.root.position.z-p.z)<40))p.copy(v.root.position);
   const direction=v.curve.getTangent(t).multiplyScalar(phase<1?1:-1),w=water(p.x,p.z);v.root.position.set(p.x,w.height,p.z);v.root.rotation.set(Math.atan(w.dz)*.35,Math.atan2(-direction.x,-direction.z),-Math.atan(w.dx)*.35);trimVesselSails(v.root,this.windSpeed,4,dt,!night||t>.008);v.bounds.min.set(p.x-16,w.height-2.1,p.z-16);v.bounds.max.set(p.x+16,w.height+24.2,p.z+16);}
  for(const v of this.anchored){const w=water(v.x,v.z);v.root.position.set(v.x,w.height,v.z);v.root.rotation.set(Math.atan(w.dz)*.4,v.heading+Math.sin(time*.14+v.x)*.012,-Math.atan(w.dx)*.4);trimVesselSails(v.root,this.windSpeed,0,dt,false);v.bounds.min.set(v.x-15,w.height-2.1,v.z-15);v.bounds.max.set(v.x+15,w.height+17,v.z+15);}
  this.initialized=true;
 }
 private windSpeed=2.25;
 setWind(speed:number){this.windSpeed=speed;}
}
