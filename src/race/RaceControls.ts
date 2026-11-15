import type {FlightInput,FlightController} from '../aircraft/FlightController.ts';
/** Gentle keyboard onset, quick release, and limited coordinated-turn assistance. */
export class RaceControls{
 enabled=true;motionBlur=true;private pitch=0;private roll=0;private yaw=0;
 reset(){this.pitch=this.roll=this.yaw=0;}
 update(dt:number,input:FlightInput,flight:FlightController):FlightInput{
  if(!this.enabled||flight.state!=='AIRBORNE'){this.reset();return{...input};}
  if(!Number.isFinite(dt)||dt<=0)return{...input,pitch:this.pitch,roll:this.roll,yaw:this.yaw};
  const smooth=(current:number,target:number)=>{
   const reversing=current*target<0;
   const response=reversing?32:Math.abs(target)<Math.abs(current)?24:14;
   return current+(target-current)*(1-Math.exp(-dt*response));
  };
  this.pitch=smooth(this.pitch,input.pitch);this.roll=smooth(this.roll,input.roll);this.yaw=smooth(this.yaw,input.yaw);
  const curve=(v:number)=>v*(.72+.28*v*v),speed=Math.max(flight.tuning.liftSpeed,flight.airspeed);
  const turning=Math.abs(flight.bank)>.12&&Math.abs(input.pitch)<.05&&flight.altitude>45;
  const lift=turning?Math.min(.22,flight.tuning.gravity*(1-Math.cos(flight.bank))/(speed*.9*flight.tuning.maxPitch)):0;
  return{...input,pitch:Math.max(-1,Math.min(1,curve(this.pitch)+lift)),roll:curve(this.roll),yaw:Math.max(-1,Math.min(1,curve(this.yaw)+(Math.abs(input.yaw)<.05?-Math.sin(flight.bank)*.12:0)))};
 }
}
