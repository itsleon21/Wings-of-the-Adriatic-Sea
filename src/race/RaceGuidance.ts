import {raceCourse} from './RaceManager.ts';
import type {RaceManager} from './RaceManager.ts';
import type {FlightController} from '../aircraft/FlightController.ts';
export function raceGuidance(race:RaceManager,flight:FlightController){
 const gate=race.current;if(!gate)return{message:'',warning:false};
 if(race.recovering)return{message:'漏过航门 · 跟随航向指引绕回进门侧',warning:true};
 if(flight.state!=='AIRBORNE')return{message:flight.airspeed<flight.tuning.takeoffSpeed?'按住 Shift 滑跑，再抬头起飞':'保持油门，抬头离水后穿过起点',warning:false};
 if(flight.altitude<65)return{message:'高度偏低 · 轻抬机头，先保持安全高度',warning:true};
 if(race.index===raceCourse.length-1)return{message:'最后冲刺 · 对准终点航门',warning:false};
 const next=raceCourse[(race.index+1)%raceCourse.length],dx=next.position.x-gate.position.x,dz=next.position.z-gate.position.z,length=Math.hypot(dx,dz),cross=gate.normal.x*dz-gate.normal.z*dx;
 const angle=Math.acos(Math.max(-1,Math.min(1,(gate.normal.x*dx+gate.normal.z*dz)/length))),distance=flight.position.distanceTo(gate.position);
 if(distance>Math.max(550,flight.airspeed*(5+angle*2.5)))return{message:'直线加速 · 对准当前航门',warning:false};
 const speed=Math.round(Math.max(flight.tuning.takeoffSpeed*1.6,flight.tuning.cruiseSpeed*(angle>.8?.82:.95))*3.6/10)*10;
 const turn=angle<.12?'直行':(angle>1.5?'急':'')+(cross>0?'右转':'左转'),fast=flight.airspeed*3.6>speed*1.12;
 return{message:`过门后${turn} · 建议 ${speed} km/h${fast?' · 轻收油门':''}`,warning:fast};
}
