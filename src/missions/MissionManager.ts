import { Vector3 } from 'three';
import {allLandforms,harborRunway} from '../world/WorldConfig.ts';
export interface Checkpoint { name:string; position:Vector3; normal:Vector3; radius:number; islandId?:string }
/** A full archipelago sightseeing loop, excluding offshore reefs. */
export const tourIslandOrder=['pine','cove','lighthouse','town','hotel','coral'] as const;
const scenicPoints:Omit<Checkpoint,'normal'>[]=[
 {name:'港湾出口',position:new Vector3(harborRunway.x+700,140,harborRunway.z),radius:180},
 ...tourIslandOrder.map(id=>{const d=allLandforms.find(d=>d.id===id)!;return{name:d.name,position:new Vector3(d.x,Math.max(180,d.height+140),d.z),radius:220,islandId:id};}),
 {name:'港口终点',position:new Vector3(harborRunway.x+300,210,harborRunway.z),radius:180,islandId:'harbor'},
];
export const route:Checkpoint[]=scenicPoints.map((point,i)=>{
 const previous=i?scenicPoints[i-1].position:new Vector3(harborRunway.x,point.position.y,harborRunway.z);
 return{...point,normal:new Vector3(point.position.x-previous.x,0,point.position.z-previous.z).normalize()};
});
export function crossesCheckpoint(from:Vector3,to:Vector3,checkpoint:Checkpoint){
 const a=from.clone().sub(checkpoint.position).dot(checkpoint.normal),b=to.clone().sub(checkpoint.position).dot(checkpoint.normal);
 if(a*b>0||Math.abs(a-b)<1e-8)return false;
 const t=a/(a-b);if(t<0||t>1)return false;
 return from.clone().lerp(to,t).distanceToSquared(checkpoint.position)<=checkpoint.radius**2;
}
/** Swept proximity test, independent of approach direction and robust at high speed. */
export function reachesTourCheckpoint(from:Vector3,to:Vector3,p:Checkpoint){const delta=to.clone().sub(from),length=delta.lengthSq(),t=length?Math.max(0,Math.min(1,p.position.clone().sub(from).dot(delta)/length)):0;return from.clone().addScaledVector(delta,t).distanceToSquared(p.position)<=p.radius*p.radius;}
export class MissionManager {
 state:'IDLE'|'RUNNING'|'COMPLETED'|'FAILED'='IDLE'; index=0; elapsed=0;
 get current(){return this.state==='RUNNING'?route[this.index]:undefined;}
 reset(){this.state='IDLE';this.index=0;this.elapsed=0;}
 start(){this.reset();this.state='RUNNING';}
 fail(){if(this.state==='RUNNING')this.state='FAILED';}
 update(dt:number,from:Vector3,to:Vector3){
  if(this.state!=='RUNNING')return false;this.elapsed+=dt;
  if(this.current&&reachesTourCheckpoint(from,to,this.current)){this.index++;if(this.index===route.length)this.state='COMPLETED';return true;}return false;
 }
}
export const formatTime=(seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toFixed(1).padStart(4,'0')}`;
