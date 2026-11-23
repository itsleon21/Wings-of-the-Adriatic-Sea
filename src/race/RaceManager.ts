import {Vector3} from 'three';
import {crossesCheckpoint} from '../missions/MissionManager.ts';
import type {Checkpoint} from '../missions/MissionManager.ts';
import {islands,hotelIsland} from '../world/WorldConfig.ts';
const [base,town,lighthouse,,pine,coral]=islands;
export const raceCourseId='harbor-circuit-recharted-3';
export const raceLaunch=new Vector3(base.x-1160,0,base.z);
export const raceStops=[base,town,coral,hotelIsland,pine,lighthouse] as const;
const gatePositions=[
 new Vector3(base.x-2240,220,base.z),
 new Vector3(town.x,310,town.z),
 new Vector3(coral.x+100,245,coral.z-70),
 new Vector3(hotelIsland.x,235,hotelIsland.z),
 new Vector3(pine.x,270,pine.z),
 new Vector3(lighthouse.x,310,lighthouse.z),
 new Vector3(base.x-180,280,base.z+330),
];
export const raceCourse:Checkpoint[]=gatePositions.map((position,i)=>{
 const inbound=position.clone().sub(gatePositions[i-1]??raceLaunch).setY(0).normalize();
 const next=gatePositions[i+1];
 const normal=next?inbound.add(next.clone().sub(position).setY(0).normalize()).normalize():inbound;
 const name=i===0?'起点 · 港口基地外海':i===gatePositions.length-1?'终点 · 港口基地':raceStops[i].name+'上空';
 return {name,position,normal,islandId:i===gatePositions.length-1?base.id:raceStops[i].id,radius:i===0?150:175};
});
export const raceHeading=Math.atan2(-(raceCourse[0].position.x-raceLaunch.x),-(raceCourse[0].position.z-raceLaunch.z));
export class RaceInvitation{
 private armed=true;
 constructor(suppressed=false){this.armed=!suppressed;}
 update(distance:number,height:number){if(distance>350)this.armed=true;if(this.armed&&distance<165&&height<80){this.armed=false;return true;}return false;}
}
export class RaceManager{
 state:'COUNTDOWN'|'READY'|'RUNNING'|'COMPLETED'|'FAILED'='COUNTDOWN';
 recovering=false;countdown=3;elapsed=0;lap=0;index=0;readonly laps=1;readonly splits:number[]=[];readonly sectors:number[]=[];
 get current(){return this.state==='READY'||this.state==='RUNNING'?raceCourse[this.index]:undefined;}
 reset(){this.recovering=false;this.state='COUNTDOWN';this.countdown=3;this.elapsed=0;this.lap=this.index=0;this.splits.length=0;this.sectors.length=0;}
 fail(){if(this.state!=='COMPLETED')this.state='FAILED';}
 update(dt:number,from:Vector3,to:Vector3){
  if(!Number.isFinite(dt)||dt<=0)return false;
  if(this.state==='COUNTDOWN'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0)this.state='RUNNING';return false;}
  if(this.state!=='READY'&&this.state!=='RUNNING')return false;
  if(this.state==='RUNNING')this.elapsed+=dt;
  const gate=this.current!,side=to.clone().sub(gate.position).dot(gate.normal);
  if(this.recovering&&side< -gate.radius*.8)this.recovering=false;
  if(!crossesCheckpoint(from,to,gate)){if(side>gate.radius)this.recovering=true;return false;}
  // Forward crossings only: reversing through the same gate cannot award a lap.
  if(to.clone().sub(from).dot(gate.normal)<=0)return false;
  const a=from.clone().sub(gate.position).dot(gate.normal),b=to.clone().sub(gate.position).dot(gate.normal),t=a/(a-b);if(from.y+(to.y-from.y)*t<45)return false;
  this.recovering=false;
  if(this.state==='READY')this.state='RUNNING';
  this.sectors.push(this.elapsed);
  if(this.index===raceCourse.length-1){this.elapsed-=dt*(1-t);this.sectors[this.sectors.length-1]=this.elapsed;this.lap=1;this.splits.push(this.elapsed);this.state='COMPLETED';return true;}
  this.index++;return true;
 }
}
