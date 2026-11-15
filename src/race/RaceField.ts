import * as T from 'three';
import {FlightController} from '../aircraft/FlightController.ts';
import {AircraftModel} from '../aircraft/AircraftModel.ts';
import {raceAircraftCatalog} from './RaceAircraft.ts';
import {RaceManager,raceLaunch,raceHeading,raceCourse} from './RaceManager.ts';
import {RaceControls} from './RaceControls.ts';
import type {AircraftId} from '../aircraft/FlightConfig.ts';
const clamp=T.MathUtils.clamp;
export class RaceField{
 readonly rivals: {id:AircraftId;name:string;flight:FlightController;race:RaceManager;controls:RaceControls;model:AircraftModel}[]=[];
 readonly ready:Promise<unknown>;winner='';place=1;ended=false;
 constructor(scene:T.Scene,player:AircraftId,renderer?:T.WebGLRenderer){
  const loads:Promise<unknown>[]=[];for(const a of raceAircraftCatalog.filter(a=>a.id!==player).slice(0,2)){const model=new AircraftModel(a.id),flight=new FlightController(false,a.tuning);scene.add(model.root);loads.push(model.load(renderer));this.rivals.push({id:a.id,name:a.name,flight,race:new RaceManager(),controls:new RaceControls(),model});}this.ready=Promise.all(loads);this.reset();
 }
 reset(){this.winner='';this.place=1;this.ended=false;this.rivals.forEach((r,i)=>{r.flight.reset();const side=i===0?-18:18;r.flight.moorAt(raceLaunch.x+Math.cos(raceHeading)*side,raceLaunch.z-Math.sin(raceHeading)*side,raceHeading);r.race.reset();r.controls.reset();r.model.root.position.copy(r.flight.position);});}
 progress(race:RaceManager,position:T.Vector3){if(race.state==='COMPLETED')return raceCourse.length;const i=race.index,p=raceCourse[i]?.position;if(!p)return 0;const previous=i?raceCourse[i-1].position:raceLaunch,direction=p.clone().sub(previous),length=direction.length();return i+clamp(position.clone().sub(previous).dot(direction)/(length*length),0,.999);}
 update(dt:number,player:FlightController,race:RaceManager,collides:(a:T.Vector3,b:T.Vector3)=>boolean){
  if(dt<=0)return;if(this.ended){for(const r of this.rivals)if(r.flight.state==='AIRBORNE')r.flight.update(dt,{pitch:clamp((270-r.flight.position.y)*.015-r.flight.velocity.y*.1,-.2,.25),roll:.22,yaw:0,throttle:0});return;}
  for(const r of this.rivals){
   if(r.race.state==='COUNTDOWN'){r.race.update(dt,r.flight.position,r.flight.position);continue;}
   if(r.race.state==='FAILED'||r.race.state==='COMPLETED')continue;
   const p=r.race.current!,f=r.flight;let input={pitch:1,roll:0,yaw:0,throttle:1};
   if(f.state==='AIRBORNE'){const target=r.race.recovering?p.position.clone().addScaledVector(p.normal,-Math.max(450,f.airspeed*5)):p.position;
    const desired=Math.atan2(-(target.x-f.position.x),-(target.z-f.position.z)),error=Math.atan2(Math.sin(desired-f.heading),Math.cos(desired-f.heading));input={pitch:clamp((p.position.y-f.position.y)*.018-f.velocity.y*.13,-.18,.20)/f.tuning.maxPitch,roll:clamp(-error*2.7,-1,1),yaw:clamp(-error*.30,-.28,.28),throttle:clamp(((Math.abs(error)>.9&&f.position.distanceTo(p.position)<f.airspeed*4?.94:1)-f.throttle)*8,-1,1)};}
   f.update(dt,r.controls.update(dt,input,f));if(collides(f.previousPosition,f.position))f.crash('与地形碰撞');if(f.state==='CRASHED')r.race.fail();else r.race.update(dt,f.previousPosition,f.position);
  }
  const entries=[{name:raceAircraftCatalog.find(a=>a.id===player.tuning.id)?.name??player.tuning.id,race,position:player.position,player:true},...this.rivals.map(r=>({name:r.name,race:r.race,position:r.flight.position,player:false}))];
  entries.sort((a,b)=>this.progress(b.race,b.position)-this.progress(a.race,a.position));this.place=entries.findIndex(e=>e.player)+1;
  const finishers=entries.filter(e=>e.race.state==='COMPLETED').sort((a,b)=>a.race.elapsed-b.race.elapsed);
  if(finishers.length){this.ended=true;this.winner=finishers[0].name;this.place=finishers[0].player?1:Math.max(2,this.place);race.state='COMPLETED';}
 }
 render(alpha:number,dt:number){for(const r of this.rivals){r.model.root.position.lerpVectors(r.flight.previousPosition,r.flight.position,alpha);r.model.root.quaternion.slerpQuaternions(r.flight.previousOrientation,r.flight.orientation,alpha);r.model.update(dt,r.flight.throttle,0,r.flight.pitch,0,r.flight.airspeed,r.flight.state==='AIRBORNE',r.flight.state==='CRASHED');}}
 dispose(){this.rivals.forEach(r=>{r.model.root.removeFromParent();r.model.dispose();});}
}
