import type {FlightTuning} from './FlightConfig.ts';
/** Specific-energy approximation; lift changes the path, thrust/drag/gravity change speed. */
export function airborneSpeed(C:Readonly<FlightTuning>,speed:number,verticalSpeed:number,bank:number,throttle:number,alignment=1){
 const v=Math.max(1,speed),bankLoad=Math.min(2.5,1/Math.max(.4,Math.abs(Math.cos(bank)))),loadFactor=bankLoad;
 const inducedDrag=.12*C.gravity*(C.liftSpeed/Math.max(v,C.liftSpeed*.85))**2*(1+5*(loadFactor**2-1));
 const cruiseInduced=.12*C.gravity*(C.liftSpeed/C.cruiseSpeed)**2;
 const parasiteDrag=Math.max(0,C.linearDrag*v+C.drag*v*v-cruiseInduced);
 const thrust=throttle*C.thrust*Math.max(.35,alignment);
 return {acceleration:thrust-parasiteDrag-inducedDrag-C.gravity*verticalSpeed/v,inducedDrag,loadFactor};
}
