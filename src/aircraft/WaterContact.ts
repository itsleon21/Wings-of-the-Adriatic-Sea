import type {AircraftId} from './FlightConfig.ts';

export interface WaterSample {height:number;dx:number;dz:number;velocity?:number}
export type WaterField=(x:number,z:number,time:number)=>WaterSample;
export type WaterSide=-1|0|1;
export interface TouchdownContact {side:WaterSide;x:number;z:number;sink:number;impact:number}
export const hasTwinFloats=(id:AircraftId)=>id!=='redwing'&&id!=='m5';
/** Hull bow/stern and two wing floats sample the very same surface as the water shader. */
export function hullWaterContact(field:WaterField,x:number,z:number,heading:number,time:number,halfSpan=3.7){
 const sideX=Math.cos(heading),sideZ=-Math.sin(heading),forwardX=-Math.sin(heading),forwardZ=-Math.cos(heading);
 const at=(side:number,forward:number)=>field(x+sideX*side+forwardX*forward,z+sideZ*side+forwardZ*forward,time);
 const center=at(0,0),bow=at(0,2.3),stern=at(0,-2),left=at(-halfSpan,0),right=at(halfSpan,0);
 return{left,right,center,height:center.height*.5+(bow.height+stern.height)*.2+(left.height+right.height)*.05,
  velocity:(center.velocity??0)*.5+((bow.velocity??0)+(stern.velocity??0))*.2+((left.velocity??0)+(right.velocity??0))*.05,
  pitch:Math.atan2(bow.height-stern.height,4.3),bank:Math.atan2(right.height-left.height,halfSpan*2),dx:center.dx,dz:center.dz};
}

/** Body height where each keel first meets the local surface. The outrigger
 * floats on a flying boat sit above its central keel when the wings are level. */
export function keelHeights(water:ReturnType<typeof hullWaterContact>,bank:number,halfSpan:number,twin:boolean){
 const tilt=Math.sin(bank)*halfSpan,outriggerLift=twin?0:.22;
 const left=water.left.height+tilt-outriggerLift;
 const right=water.right.height-tilt-outriggerLift;
 const center=twin?-Infinity:water.center.height;
 const first:WaterSide=left>center&&left>=right?-1:right>center?1:0;
 return {left,right,center,first};
}
