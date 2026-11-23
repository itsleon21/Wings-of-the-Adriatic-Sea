import {airborneSpeed} from './AirborneEnergy.ts';
import { Euler, Quaternion, Vector3 } from 'three';
import {touchdownProblems} from './LandingEnvelope.ts';
import {hasTwinFloats,hullWaterContact,keelHeights} from './WaterContact.ts';
import type {TouchdownContact,WaterField} from './WaterContact.ts';
import { FlightConfig, Spawn } from './FlightConfig.ts';
import type { FlightTuning } from './FlightConfig.ts';
export type ManeuverId = 'loop' | 'immelmann';
export type FlightState = 'ON_WATER' | 'TAKEOFF_RUN' | 'AIRBORNE' | 'LANDING' | 'CRASHED' | 'RESETTING';
export interface FlightInput { pitch: number; roll: number; yaw: number; throttle: number; aerobatic?: boolean }
export const neutralInput = (): FlightInput => ({ pitch: 0, roll: 0, yaw: 0, throttle: 0 });
const flatWater=()=>({height:0,dx:0,dz:0,velocity:0});
export class FlightController {
  readonly position = new Vector3(); readonly previousPosition = new Vector3();
  readonly velocity = new Vector3(); readonly orientation = new Quaternion(); readonly previousOrientation = new Quaternion();
  state: FlightState = 'ON_WATER'; throttle = 0; pitch = 0; bank = 0; heading = Spawn.heading;
  crashReason = ''; hardLanding=false; landingCount = 0; rolling = false;
  maneuver: ManeuverId|null=null; maneuverProgress=0;private maneuverAngle=0;private maneuverRoll=0;private maneuverEntryPitch=0;private maneuverEntryBank=0;
  get maneuverName(){return this.maneuver==='loop'?'垂直筋斗':this.maneuver==='immelmann'?'殷麦曼转向':'';}
  private clearManeuver(){this.maneuver=null;this.maneuverProgress=this.maneuverAngle=this.maneuverRoll=this.maneuverEntryPitch=this.maneuverEntryBank=0;}
  requestManeuver(id:ManeuverId):string {
    if(this.tuning.id!=='mc72')return '此机型不支持辅助特技';
    if(this.maneuver)return '当前特技进行中';
    if(this.state!=='AIRBORNE')return '起飞后才能执行特技';
    if(this.altitude<180)return '特技需要海拔至少180米，并远离岛屿';
    if(this.airspeed<85)return '特技需要空速至少306 km/h';
    if(Math.abs(this.levelBank)>.2||Math.abs(this.pitch)>.12||Math.abs(this.velocity.y)/this.airspeed>.15||this.rolling)return '先松开操纵键，恢复平飞姿态';
    this.clearManeuver();this.maneuver=id;this.maneuverEntryPitch=this.pitch;this.maneuverEntryBank=this.levelBank;this.waterPitch=this.waterBank=0;return `${this.maneuverName}开始 · 油门仍可调节`;
  }
  simulationTime=0;waterImpact=0;planing=0;floatLoadLeft=0;floatLoadRight=0;
  lastTouchdown?:TouchdownContact;
  private windX=0;private windZ=0;
  private waterField?:WaterField;private waterPitch=0;private waterBank=0;
  setWind(x:number,z:number){this.windX=Number.isFinite(x)?x:0;this.windZ=Number.isFinite(z)?z:0;}
  setWaterSurface(field:WaterField){this.waterField=field;this.reset(this.state==='AIRBORNE');}
  private forward = new Vector3(); private up = new Vector3(); private acceleration = new Vector3();
  private euler = new Euler(0, 0, 0, 'YXZ');
  readonly tuning: Readonly<FlightTuning>;
  constructor(airborne = false, tuning: Readonly<FlightTuning> = FlightConfig) { this.tuning=tuning;this.reset(airborne); }
  private sampleWater(){return hullWaterContact(this.waterField??flatWater,this.position.x,this.position.z,this.heading,this.simulationTime,this.tuning.floatHalfSpan);}
  get landingContact(){
    const water=this.sampleWater(),keels=keelHeights(water,this.levelBank,this.tuning.floatHalfSpan,hasTwinFloats(this.tuning.id));
    const sample=keels.first===-1?water.left:keels.first===1?water.right:water.center;
    return{clearance:this.position.y-this.tuning.hullOffset-Math.max(keels.left,keels.right,keels.center),verticalSpeed:this.velocity.y-(sample.velocity??0)};
  }
  get airspeed(){return Math.hypot(this.velocity.x-this.windX,this.velocity.y,this.velocity.z-this.windZ);}
  get groundSpeed(){return Math.hypot(this.velocity.x,this.velocity.z);}
  get groundTrack(){return this.groundSpeed<3?this.heading:Math.atan2(-this.velocity.x,-this.velocity.z);}
  get altitude() { return Math.max(0, this.position.y - this.tuning.hullOffset); }
  get levelBank() { return Math.atan2(Math.sin(this.bank),Math.cos(this.bank)); }
  reset(airborne = false) {
    this.clearManeuver();this.state = 'RESETTING';this.simulationTime=0;this.waterImpact=0;this.waterPitch=this.waterBank=0; this.position.set(Spawn.x, airborne ? 130 : this.tuning.hullOffset, Spawn.z);
    this.velocity.set(airborne ? this.tuning.initialSpeed : 0, 0, 0); this.throttle = airborne ? 0.6 : 0;
    this.lastTouchdown=undefined;this.planing=this.floatLoadLeft=this.floatLoadRight=0;
    if(airborne){this.velocity.x+=this.windX;this.velocity.z+=this.windZ;}
    this.pitch = this.bank = 0; this.heading = Spawn.heading; this.crashReason = ''; this.hardLanding=false; this.landingCount = 0; this.rolling = false;
    if(!airborne&&this.waterField)this.position.y+=hullWaterContact(this.waterField,this.position.x,this.position.z,this.heading,0,this.tuning.floatHalfSpan).height;
    this.setOrientation(); this.previousPosition.copy(this.position); this.previousOrientation.copy(this.orientation);
    this.state = airborne ? 'AIRBORNE' : 'ON_WATER';
  }
  recoverAt(position:Vector3,heading:number){
    const time=this.simulationTime,landings=this.landingCount;
    this.reset(true);this.simulationTime=time;this.landingCount=landings;
    this.position.copy(position);this.heading=heading;
    this.velocity.set(-Math.sin(heading)*this.tuning.initialSpeed+this.windX,0,-Math.cos(heading)*this.tuning.initialSpeed+this.windZ);
    this.setOrientation();this.previousPosition.copy(this.position);this.previousOrientation.copy(this.orientation);
  }
  private setOrientation() { this.orientation.setFromEuler(this.euler.set(this.pitch+this.waterPitch, this.heading, this.bank+this.waterBank, 'YXZ')); }
  moorAt(x:number,z:number,heading:number){this.clearManeuver();this.waterImpact=this.planing=this.floatLoadLeft=this.floatLoadRight=0;this.lastTouchdown=undefined;this.position.set(x,this.tuning.hullOffset,z);this.heading=heading;this.bank=this.pitch=this.waterPitch=this.waterBank=0;this.velocity.set(0,0,0);this.throttle=0;this.rolling=false;this.state='ON_WATER';this.position.y+=this.sampleWater().height;this.setOrientation();this.previousPosition.copy(this.position);this.previousOrientation.copy(this.orientation);}
  crash(reason: string) { if (this.state === 'CRASHED') return; this.clearManeuver();this.state = 'CRASHED'; this.crashReason = reason; this.velocity.set(0, 0, 0); this.throttle = 0; this.rolling = false; }
  private updateManeuver(dt:number,waterHeight:number){
    const C=this.tuning,id=this.maneuver!,total=id==='loop'?Math.PI*2:Math.PI;
    const before=this.velocity.clone();
    if(this.maneuverAngle<total){
      this.maneuverAngle=Math.min(total,this.maneuverAngle+.85*dt);const t=Math.min(1,this.maneuverAngle/.35),entry=1-t*t*(3-2*t);this.pitch=this.maneuverAngle+this.maneuverEntryPitch*entry;this.bank=this.maneuverEntryBank*entry;
    }else if(id==='immelmann'){this.maneuverRoll=Math.min(Math.PI,this.maneuverRoll+1.65*dt);this.bank=this.maneuverRoll;}
    this.setOrientation();this.forward.set(0,0,-1).applyQuaternion(this.orientation);
    const speed=Math.max(0,this.airspeed+(airborneSpeed(C,this.airspeed,this.airspeed*this.forward.y,0,this.throttle).acceleration)*dt);
    this.velocity.copy(this.forward).multiplyScalar(Math.min(C.maxSpeed,speed));
    this.velocity.x+=this.windX;this.velocity.z+=this.windZ;
    // Trapezoidal integration follows the arc; no teleport or extra invulnerability.
    this.position.addScaledVector(before,dt*.5).addScaledVector(this.velocity,dt*.5);
    this.maneuverProgress=id==='loop'?this.maneuverAngle/total:.75*this.maneuverAngle/total+.25*this.maneuverRoll/Math.PI;
    if(this.position.y-C.hullOffset<=waterHeight){this.crash('特技时接触水面，请先爬升至安全高度');return;}
    if(speed<C.liftSpeed*.85){this.crash('特技空速不足，请保留足够油门后重试');return;}
    if(this.maneuverAngle>=total&&(id==='loop'||this.maneuverRoll>=Math.PI)){
      if(id==='immelmann')this.heading+=Math.PI;
      this.pitch=this.bank=0;this.clearManeuver();this.setOrientation();
    }
  }
  update(dt: number, input: FlightInput) {
    if (!Number.isFinite(dt) || dt <= 0 || this.state === 'CRASHED') return;
    const C=this.tuning;
    dt = Math.min(dt, 1 / 30);this.simulationTime+=dt;this.waterImpact*=Math.exp(-dt*3); this.previousPosition.copy(this.position); this.previousOrientation.copy(this.orientation);
    this.throttle = Math.max(0, Math.min(1, this.throttle + input.throttle * C.throttleRate * dt));
    const water=this.sampleWater();
    if(this.maneuver){this.updateManeuver(dt,water.height);return;}
    const speed = this.airspeed, onWater = this.state !== 'AIRBORNE';
    const response = 1 - Math.exp(-C.attitudeResponse * dt), authority = Math.min(1, Math.max(0.15, speed / C.liftSpeed));
    this.pitch += (input.pitch * (onWater ? 0.13 : C.maxPitch) - this.pitch) * response;
    this.rolling=!onWater&&C.aerobatics&&Boolean(input.aerobatic)&&Math.abs(input.roll)>.05&&speed>=C.liftSpeed*.9;
    if(this.rolling) this.bank-=input.roll*C.rollRate*authority*dt;
    else {
      const upright=Math.round(this.bank/(Math.PI*2))*Math.PI*2;
      this.bank += (upright+(onWater?0:-input.roll*C.maxBank*authority)-this.bank)*response;
    }
    this.heading += (Math.sin(this.bank) * C.turnRate * authority - input.yaw * C.yawRate * (onWater ? 1 : authority)) * dt;
    const groundSpeed=this.groundSpeed,twin=hasTwinFloats(C.id);
    const step=Math.max(0,Math.min(1,(groundSpeed/C.takeoffSpeed-.28)/.67));
    this.planing=onWater&&this.waterField?step*step*(3-2*step):0;
    const waterBlend=1-Math.exp(-dt*3.5),waveResponse=1-.62*this.planing;
    this.waterPitch+=((onWater?water.pitch*waveResponse+.04*this.planing:0)-this.waterPitch)*waterBlend;
    this.waterBank+=((onWater?water.bank*waveResponse:0)-this.waterBank)*waterBlend;
    this.setOrientation(); this.forward.set(0, 0, -1).applyQuaternion(this.orientation); this.up.set(0, 1, 0).applyQuaternion(this.orientation);
    if (onWater) {
      const draftDrag=this.waterField?1+.26*Math.sin(this.planing*Math.PI)-.27*this.planing:1;
      const nextSpeed=Math.max(0,groundSpeed+(this.throttle*C.thrust-groundSpeed*C.waterDrag*draftDrag-groundSpeed**2*.0015)*dt);
      const heave=this.waterField?this.velocity.y:0;
      const sx=Math.cos(this.heading),sz=-Math.sin(this.heading);
      const slip=this.velocity.x*sx+this.velocity.z*sz,sideSlip=Math.max(-nextSpeed,Math.min(nextSpeed,slip*Math.exp(-dt*3.4)));
      const forwardSpeed=Math.sqrt(Math.max(0,nextSpeed**2-sideSlip**2));
      this.velocity.set(-Math.sin(this.heading)*forwardSpeed+sx*sideSlip,heave,-Math.cos(this.heading)*forwardSpeed+sz*sideSlip);
      if(this.waterField){
        const keels=keelHeights(water,this.bank+this.waterBank,C.floatHalfSpan,twin);
        const keel=this.position.y-C.hullOffset;
        this.floatLoadLeft=Math.max(0,Math.min(1,(keels.left-keel+.16)/.27));
        this.floatLoadRight=Math.max(0,Math.min(1,(keels.right-keel+.16)/.27));
        const floatHeight=(water.left.height+water.right.height)*.5;
        const target=(twin?floatHeight:water.height)+C.hullOffset+.16*this.planing,error=target-this.position.y;
        const verticalAcceleration=(C.id==='m5'?15:22)*error-(C.id==='m5'?7:8)*(this.velocity.y-water.velocity);
        this.velocity.y=Math.max(-4,Math.min(4,this.velocity.y+verticalAcceleration*dt));
        this.waterImpact=Math.max(this.waterImpact,Math.min(1,Math.abs(verticalAcceleration)*nextSpeed/320));
        const chop=Math.abs(water.dx*this.velocity.x+water.dz*this.velocity.z-water.velocity);
        const differential=twin?(this.floatLoadLeft-this.floatLoadRight):0;
        this.heading+=differential*Math.min(1,nextSpeed/12)*.12*dt;
        const extraDrag=Math.min(.025,(chop*.002+Math.abs(differential)*.06)*dt);
        this.velocity.x*=1-extraDrag;this.velocity.z*=1-extraDrag;
      }
      this.position.addScaledVector(this.velocity,dt);if(!this.waterField)this.position.y=C.hullOffset;
      if (this.state === 'LANDING' && nextSpeed < 7) { this.state = 'ON_WATER'; this.landingCount++; }
      else if (this.state !== 'LANDING') this.state = nextSpeed > 1.5 ? 'TAKEOFF_RUN' : 'ON_WATER';
      const intoAir=(this.velocity.x-this.windX)*-Math.sin(this.heading)+(this.velocity.z-this.windZ)*-Math.cos(this.heading);
      if (intoAir >= C.takeoffSpeed && nextSpeed>=C.takeoffSpeed*.68 && input.pitch > 0.1 && this.throttle > 0.5) {
        this.state = 'AIRBORNE'; this.velocity.y = 2.2+water.velocity; this.position.y += 0.15; this.pitch = 0.18; this.setOrientation();
        this.lastTouchdown=undefined;
      }
      return;
    }
    const liftFraction = Math.min(1, (speed / C.liftSpeed) ** 2);
    const oldVertical=this.velocity.y;
    // Keep the accessible pitch response, but pay for altitude with kinetic energy.
    const verticalAcceleration=this.throttle*C.thrust*this.forward.y+C.gravity*(this.up.y*liftFraction-1)+this.pitch*speed*.65-this.velocity.y*.62;
    const vertical=Math.max(-30,Math.min(30,oldVertical+verticalAcceleration*dt));
    const airX=this.velocity.x-this.windX,airZ=this.velocity.z-this.windZ;
    const alignment=speed>1?(this.forward.x*airX+this.forward.y*this.velocity.y+this.forward.z*airZ)/speed:1;
    const energy=airborneSpeed(C,speed,(oldVertical+vertical)*.5,this.bank,this.throttle,alignment);
    const nextSpeed=Math.max(Math.abs(vertical),Math.min(C.maxSpeed,speed+energy.acceleration*dt));
    const nextVertical=Math.max(-nextSpeed*.85,Math.min(nextSpeed*.85,vertical));
    const horizontalSpeed=Math.sqrt(Math.max(0,nextSpeed*nextSpeed-nextVertical*nextVertical));
    const steering=1-Math.exp(-1.4*authority*dt);
    this.acceleration.set(airX,0,airZ);if(this.acceleration.lengthSq()<.0001)this.acceleration.set(-Math.sin(this.heading),0,-Math.cos(this.heading));this.acceleration.normalize();
    this.acceleration.lerp(this.forward.set(-Math.sin(this.heading),0,-Math.cos(this.heading)),steering).normalize();
    this.velocity.set(this.acceleration.x*horizontalSpeed+this.windX,nextVertical,this.acceleration.z*horizontalSpeed+this.windZ);
    this.position.addScaledVector(this.velocity,dt);
    if(this.position.y-C.hullOffset>Math.max(water.center.height,water.left.height,water.right.height)+C.floatHalfSpan+.12)return;
    const surface=this.sampleWater(),keels=keelHeights(surface,this.bank,C.floatHalfSpan,twin);
    const contactHeight=Math.max(keels.left,keels.right,keels.center);
    if(this.position.y-C.hullOffset<=contactHeight){
      const side=keels.first,sample=side===-1?surface.left:side===1?surface.right:surface.center;
      const verticalSpeed=this.velocity.y-(sample.velocity??0);
      this.position.y=C.hullOffset+contactHeight;
      if(touchdownProblems(C,Math.max(nextSpeed,this.groundSpeed),verticalSpeed,this.bank,this.pitch).length>0){
        this.hardLanding=true;
        this.crash('着水过猛，请降低下降率并保持机翼水平');
      }else{
        const impact=Math.min(1,Math.max(0,-verticalSpeed)/C.safeLandingSink+.2);
        this.lastTouchdown={side,sink:Math.max(0,-verticalSpeed),impact,
          x:this.position.x+Math.cos(this.heading)*C.floatHalfSpan*side,
          z:this.position.z-Math.sin(this.heading)*C.floatHalfSpan*side};
        this.waterImpact=impact;this.state='LANDING';this.velocity.y=sample.velocity??0;
        this.floatLoadLeft=side===-1?1:0;this.floatLoadRight=side===1?1:0;
      }
    }
  }
}
