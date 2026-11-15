import {Vector3} from 'three';
import {crossesCheckpoint} from '../missions/MissionManager.ts';
import type {Checkpoint} from '../missions/MissionManager.ts';
import {islands} from '../world/WorldConfig.ts';
export const coral=islands.find(d=>d.id==='coral')!;
const cove=islands.find(d=>d.id==='cove')!,pine=islands.find(d=>d.id==='pine')!,lighthouse=islands.find(d=>d.id==='lighthouse')!;
const corners=[[-4750,180,-2000],[cove.x-700,260,cove.z+650],[pine.x+800,270,pine.z+650],[lighthouse.x+500,210,lighthouse.z-650]];
export const raceCourse:Checkpoint[]=corners.map(([x,y,z],i)=>{const previous=i?corners[i-1]:[coral.x-450,0,coral.z-450];return{name:i===0?'出发航门':i===corners.length-1?'灯塔外海终点':'海上航门 '+i,position:new Vector3(x,y,z),normal:new Vector3(x-previous[0],0,z-previous[2]).normalize(),radius:110};});
export const raceLaunch=new Vector3(coral.x-450,0,coral.z-450);
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
