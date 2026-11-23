import {harborPoint,townPoint,townDirection} from './WorldConfig.ts';
import {terrainHeight,bayProfile} from './WorldConfig.ts';
import type {IslandDefinition} from './WorldConfig.ts';
import {coastalLandmarkOccupied} from './CoastalLandmarkSites.ts';
/** Mid-slope parish sites, shared by architecture, plot exclusion and vegetation. */
export function churchSite(d:IslandDefinition):{x:number;z:number;y:number;low:number;nx:number;nz:number;score:number}{
 if(d.id==='harbor'&&!d.canonical){const p=churchSite({...d,canonical:true});return{...p,...harborPoint(d,p.x,p.z),nx:-p.nz,nz:p.nx};}
 if(d.id==='town'&&!d.canonical){const p=churchSite({...d,canonical:true}),v=townDirection(p.nx,p.nz);return{...p,...townPoint(d,p.x,p.z),nx:v.x,nz:v.z};}
 const desired={x:d.x+d.rx*.22,z:d.z-d.rz*.28};
 let best:{x:number;z:number;y:number;low:number;nx:number;nz:number;score:number}|undefined;
 for(let u=-.65;u<.66;u+=.035)for(let v=-.70;v<.15;v+=.035){
  const x=d.x+u*d.rx,z=d.z+v*d.rz;
  const world=d.id==='harbor'?harborPoint(d,x,z):d.id==='town'?townPoint(d,x,z):{x,z};
  if(coastalLandmarkOccupied(world.x,world.z,42))continue;
  const samples=[-28,0,28].flatMap(dx=>[-27,0,27].map(dz=>terrainHeight(d,x+dx,z+dz))),low=Math.min(...samples),high=Math.max(...samples);
  if(low<d.height*.23||high>d.height*.66||high-low>8)continue;
  const bayZ=d.z+d.rz*bayProfile(d).offset,dx=x-d.x,dz=z-bayZ,l=Math.hypot(dx,dz),score=Math.hypot(x-desired.x,z-desired.z)+Math.abs((high+low)/2-d.height*.40)*3+(high-low)*9;
  if(!best||score<best.score)best={x,z,y:high+.3,low,nx:dx/l,nz:dz/l,score};
 }
 if(!best)throw Error('No grounded mid-slope church site: '+d.id);
 return best;
}
