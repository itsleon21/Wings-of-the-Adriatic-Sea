import {nightApproach,wantsNightMooring} from './HarborNavigation.ts';
import {waterfrontPoint,inTakeoffChannel} from './IslandDetails.ts';
import {mooringSites} from './Moorings.ts';
import {buildVessel} from './VesselModel.ts';
import * as T from 'three';
import {islands,hotelIsland,allLandforms,harborRunway,terrainHeight,bayProfile,random} from './WorldConfig.ts';
const step=120,size=101,origin=-6000;
const base=islands[0],town=islands[1];
export const bayShuttleEndpoints=[new T.Vector3(base.x-10,0,base.z+base.rz*bayProfile(base).offset+99),new T.Vector3(town.x+125,0,town.z-town.rz*bayProfile(town).offset-79)] as const;
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
 if(x>harborRunway.x-180&&x<harborRunway.x+1700&&Math.abs(z-harborRunway.z)<280)return false;
 return allLandforms.every(d=>Math.hypot((x-d.x)/(d.rx*1.6+100),(z-d.z)/(d.rz*1.6+100))>(d.id==='cove'?1.35:1));
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
export const trafficSchedule=[['harbor','town',9],['harbor','hotel',3],['harbor','pine',4],['town','lighthouse',3],['town','coral',3],['coral','hotel',3],['pine','lighthouse',2],['pine','coral',2],['hotel','lighthouse',2]] as const;
let cachedRoutes:{from:string;to:string;curve:T.Curve<T.Vector3>;count:number;direct:boolean}[]|undefined;
export function buildTrafficRoutes(){if(cachedRoutes)return cachedRoutes;const ports=[...islands,hotelIsland].filter(d=>d.id!=='cove').map(d=>({id:d.id,point:new T.Vector3(d.x-d.rx*1.6-250,0,d.z)}));return cachedRoutes=trafficSchedule.map(([from,to,count])=>{const direct=from==='harbor'&&to==='town';return{from,to,count,direct,curve:direct?new T.LineCurve3(...bayShuttleEndpoints):route(ports.find(p=>p.id===from)!.point,ports.find(p=>p.id===to)!.point)};});}
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
 readonly root=new T.Group();readonly routes=buildTrafficRoutes();readonly bounds:T.Box3[]=[];private vessels:{root:T.Group;route:number;path:T.Curve<T.Vector3>;offset:number;speed:number;length:number;lane:number;sailing:boolean;approaches:T.CurvePath<T.Vector3>[];mode:'cruising'|'returning'|'moored'|'departing';end:number;progress:number;returnT:number;laneFade:number;returnLane:T.Vector3;wait:number}[]=[];private anchored:{root:T.Group;x:number;z:number;heading:number;bounds:T.Box3}[]=[];private local:{root:T.Group;curve:T.LineCurve3;phase:number;bounds:T.Box3;nightT?:number}[]=[];private hour=12;private previousTime=0;private initialized=false;private lamps=new T.MeshBasicMaterial({color:0xffd18a,toneMapped:false});
 constructor(){this.root.name='Inter-island ferries / secret cove excluded';
  this.routes.forEach((r,index)=>{for(let n=0;n<r.count;n++){const roam=r.direct?n>=4:n>=Math.ceil(r.count/2),path=roam?roamingSeaCurve(371+index*313+n*73):r.direct?bayShuttleCurve(417+n*113):r.curve,kind=n===0?'ferry':n%2?'fishing':'sailing',g=buildVessel(kind,index*7+n,this.lamps);g.name=`${r.from} ↔ ${r.to} / ${kind}`;g.userData.route=[r.from,r.to];g.userData.roaming=roam;if(r.direct)g.userData.track=path;g.scale.setScalar((kind==='ferry'?1.55:kind==='fishing'?1.45:1.65)*vesselIslandScale(r.from,r.to));this.root.add(g);this.vessels.push({root:g,route:index,path,offset:((Math.sin(index*81.3+n*37.1)*43758.5)%1+1)%1,speed:(kind==='sailing'?3.7+(n%3)*.2:kind==='fishing'?4.8:7.2)*( .76+random(729+n*17+index*131)()*.55),length:path.getLength(),lane:r.direct?0:19+random(981+index*73+n*11)()*58,sailing:kind==='sailing',approaches:[nightApproach(r.from,path.getPointAt(0),index*100+n,harborVesselSites()),nightApproach(r.to,path.getPointAt(1),index*100+n+50,harborVesselSites())],mode:'cruising',end:0,progress:0,returnT:0,laneFade:1,returnLane:new T.Vector3(),wait:0});this.bounds.push(new T.Box3());}});
  for(const [i,site] of harborVesselSites().entries()){const boat=buildVessel(i%3===2?'sailing':'fishing',31+i,this.lamps);boat.name=site.island+' / inner bay moored vessel';boat.userData.harbor=site.island;boat.scale.setScalar(i%3===2?.85:1);const bounds=new T.Box3();this.anchored.push({root:boat,...site,bounds});this.root.add(boat);this.bounds.push(bounds);}for(const [i,r] of localTrafficRoutes().entries()){const boat=buildVessel(i%2?'fishing':'sailing',73+i,this.lamps);boat.scale.setScalar(.75*vesselIslandScale(r.island,r.island));boat.name=r.island+' / harbour arrival and departure';boat.userData.localHarbor=r.island;const bounds=new T.Box3();this.local.push({root:boat,...r,bounds});this.root.add(boat);this.bounds.push(bounds);}this.root.children.forEach(boat=>boat.scale.multiplyScalar(1.05));this.update(0,()=>({height:0,dx:0,dz:0}));this.initialized=false;
 }

 setNightness(n:number,hour=12){if(this.previousTime<1&&wantsNightMooring(hour)&&!wantsNightMooring(this.hour))this.initialized=false;this.hour=hour;this.lamps.color.setRGB(1,.62,.28).multiplyScalar(.12+n*1.6);}
 update(time:number,water:(x:number,z:number)=>{height:number;dx:number;dz:number},aircraft?:{position:T.Vector3;speed:number;onWater:boolean}){
  if(time<this.previousTime){this.initialized=false;for(const v of this.vessels){v.mode='cruising';v.progress=0;v.wait=0;}}
  const dt=Math.max(0,time-this.previousTime),night=wantsNightMooring(this.hour);this.previousTime=time;
  this.vessels.forEach((v,i)=>{
   const curve=v.path,duration=v.length/v.speed,cycle=duration*2+60;
   // The crossing of the base water runway gives way to aircraft instead of detouring west.
   const giveWay=aircraft&&aircraft.speed>9&&aircraft.position.y<16&&Math.abs(v.root.position.z-harborRunway.z)<220&&v.root.position.distanceTo(aircraft.position)<340,movingDt=giveWay?0:dt;
   if(giveWay&&v.mode==='cruising')v.wait+=dt;
   const phase=((time-v.wait+v.offset*cycle)%cycle+cycle)%cycle;
   const backwards=phase>duration+30,t=phase<duration?phase/duration:phase<duration+30?1:phase<duration*2+30?1-(phase-duration-30)/duration:0;
   let p:T.Vector3,tangent:T.Vector3;
   const hotelEvening=this.hour>=17&&this.hour<23&&this.routes[v.route].to==='hotel';
   const dockTonight=night&&(i%10!==9);
   if((dockTonight||hotelEvening)&&v.mode==='cruising'){v.end=hotelEvening?1:t>.5?1:0;v.returnT=t;v.progress=0;v.laneFade=1;const oldDirection=curve.getTangentAt(t).multiplyScalar(backwards?-1:1);v.returnLane.set(-oldDirection.z,0,oldDirection.x).multiplyScalar(v.lane);v.mode=this.initialized?'returning':'moored';if(!this.initialized)v.progress=1;}
   if(!dockTonight&&!hotelEvening&&v.mode==='moored')v.mode='departing';
   let justDeparted=false;
   if(v.mode==='returning'){
    const amount=v.speed*movingDt/v.length;v.returnT=v.end?Math.min(1,v.returnT+amount):Math.max(0,v.returnT-amount);
    if(Math.abs(v.returnT-v.end)<1e-7)v.progress=Math.min(1,v.progress+v.speed*movingDt/v.approaches[v.end].getLength());
    if(v.progress===1)v.mode='moored';
   }else if(v.mode==='departing'){
    v.progress=Math.max(0,v.progress-v.speed*movingDt/v.approaches[v.end].getLength());
    if(v.progress===0){justDeparted=true;v.mode='cruising';v.offset=((v.end?duration:0)-time)/cycle;}
   }
   if(v.mode==='moored'||v.mode==='departing'||v.mode==='returning'&&v.progress>0){const path=v.approaches[v.end];p=path.getPoint(v.progress);tangent=path.getTangent(Math.min(.99999,v.progress)).multiplyScalar(v.mode==='departing'?-1:1);}
   else if(v.mode==='returning'){p=curve.getPointAt(v.returnT);tangent=curve.getTangentAt(v.returnT).multiplyScalar(v.end?1:-1);p.addScaledVector(v.returnLane,v.laneFade);}
   else if(justDeparted){p=curve.getPointAt(v.end);tangent=curve.getTangentAt(v.end).multiplyScalar(v.end?-1:1);}
   else{p=curve.getPointAt(t);tangent=curve.getTangentAt(t).multiplyScalar(backwards?-1:1);let turn=0;if(phase>=duration&&phase<=duration+30)turn=(phase-duration)/30;else if(phase>=duration*2+30)turn=(phase-duration*2-30)/30;const lane=new T.Vector3(-tangent.z,0,tangent.x).multiplyScalar(v.lane*Math.cos(turn*Math.PI));p.add(lane);if(turn)tangent.applyAxisAngle(new T.Vector3(0,1,0),turn*Math.PI);}
   if(v.mode==='returning'){if(v.progress>0)p.addScaledVector(v.returnLane,v.laneFade);v.laneFade=Math.max(0,v.laneFade-dt/8);}
   const w=water(p.x,p.z);v.root.position.set(p.x,w.height,p.z);v.root.rotation.set(Math.atan(w.dz)*.4,Math.atan2(-tangent.x,-tangent.z),-Math.atan(w.dx)*.4);v.root.userData.nightMode=v.mode;
   this.bounds[i].min.set(p.x-21,w.height-2.1,p.z-21);this.bounds[i].max.set(p.x+21,w.height+(v.sailing?28.4:10.5),p.z+21);
  });
  for(const v of this.local){const phase=(time/(165+v.phase*105)+v.phase)%2,dayT=phase<1?phase:2-phase;if(night)v.nightT=this.initialized?Math.max(0,(v.nightT??dayT)-dt*4/v.curve.getLength()):0;else if(v.nightT!==undefined){v.nightT=Math.min(1,v.nightT+dt*4/v.curve.getLength());if(v.nightT>=dayT)v.nightT=undefined;}const t=v.nightT??dayT,p=v.curve.getPoint(t),direction=v.curve.getTangent(t).multiplyScalar(phase<1?1:-1),w=water(p.x,p.z);v.root.position.set(p.x,w.height,p.z);v.root.rotation.set(Math.atan(w.dz)*.35,Math.atan2(-direction.x,-direction.z),-Math.atan(w.dx)*.35);v.bounds.min.set(p.x-16,w.height-2.1,p.z-16);v.bounds.max.set(p.x+16,w.height+24.2,p.z+16);}
  for(const v of this.anchored){const w=water(v.x,v.z);v.root.position.set(v.x,w.height,v.z);v.root.rotation.set(Math.atan(w.dz)*.4,v.heading+Math.sin(time*.14+v.x)*.012,-Math.atan(w.dx)*.4);v.bounds.min.set(v.x-15,w.height-2.1,v.z-15);v.bounds.max.set(v.x+15,w.height+17,v.z+15);}
  this.initialized=true;
 }
}
