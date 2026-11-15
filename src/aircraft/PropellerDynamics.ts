export class PropellerDynamics{
 angularSpeed=0;
 update(dt:number,throttle:number,airspeed=0,airborne=false,stopped=false,id='redwing'){
 if(dt<=0||!Number.isFinite(dt))return this.angularSpeed;const power=Math.max(0,Math.min(1,throttle)),maximum=id==='mc72'?210:id==='m5'?120:155;
 const windmill=airborne?Math.min(maximum*.32,Math.max(0,airspeed)*.65):0;
 const target=stopped?0:Math.max(windmill,power>.005?18+(maximum-18)*Math.pow(power,.72):0);
 this.angularSpeed+=(target-this.angularSpeed)*(1-Math.exp(-dt*(target===0?3.7:target>this.angularSpeed?1.8:2.4)));
 if(target===0&&this.angularSpeed<.15)this.angularSpeed=0;return this.angularSpeed;
 }
 reset(){this.angularSpeed=0;}
}
