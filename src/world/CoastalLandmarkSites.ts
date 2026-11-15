import {islands,terrainHeight} from './WorldConfig.ts';
import type {IslandDefinition} from './WorldConfig.ts';
import {waterfrontPoint} from './IslandDetails.ts';
export interface CoastalLandmarkSite{id:string;island:string;kind:'windmill'|'shipyard'|'fishery';style?:number;x:number;z:number;angle:number;radius:number}
const chosenMills:CoastalLandmarkSite[]=[];
function mill(d:IslandDefinition,ax:number,az:number,id:string):CoastalLandmarkSite{
 const facing=d.id==='town'?-1:1,cx=d.x+ax*d.rx*facing,cz=d.z+az*d.rz*facing;
 for(let ring=0;ring<18;ring++)for(let j=0;j<Math.max(1,ring*8);j++){
  const a=j/Math.max(1,ring*8)*Math.PI*2,x=cx+Math.cos(a)*ring*8,z=cz+Math.sin(a)*ring*8,h=terrainHeight(d,x,z);
  if(h<24||h>d.height*(id==='town-hill-mill'?1:.88)||chosenMills.some(p=>Math.hypot(x-p.x,z-p.z)<90))continue;
  const heights=[[-9,-9],[9,-9],[-9,9],[9,9]].map(([dx,dz])=>terrainHeight(d,x+dx,z+dz));
  if(Math.max(...heights)-Math.min(...heights)>2.7)continue;
  const result:CoastalLandmarkSite={id,island:d.id,kind:'windmill',x,z,angle:Math.PI*3/4,style:chosenMills.length%6,radius:id==='town-hill-mill'?48:30};chosenMills.push(result);return result;
 }throw new Error('No grounded windmill site: '+id);
}
function shore(d:IslandDefinition,a:number,inland:number,kind:'shipyard'|'fishery',id:string,radius:number):CoastalLandmarkSite{
 const p=waterfrontPoint(d,a,inland);return{id,island:d.id,kind,x:p.x,z:p.z,angle:Math.atan2(-p.nx,-p.nz),radius};
}
export const coastalLandmarkSites:CoastalLandmarkSite[]=[
 mill(islands[0],-.45,-.20,'base-mill'),
 mill(islands[1],-.57,-.31,'town-west-mill'),mill(islands[1],.45,-.12,'town-east-mill'),
 mill(islands[1],-.25,.05,'town-quay-mill'),mill(islands[1],.22,.04,'town-market-mill'),
 mill(islands[1],-.469,-.53,'town-hill-mill'),mill(islands[1],.07777777777777757,-.20512820512820512,'town-lane-mill'),
 mill(islands[1],-.65,-.10,'town-headland-mill'),mill(islands[1],.68,-.20,'town-granary-mill'),
 shore(islands[0],-2.40,24,'shipyard','base-repair-slip',34),
 shore(islands[0],-1.86,-6,'fishery','base-fishing-quay',18),
 shore(islands[1],-.95,-6,'fishery','town-fishing-quay',18),
];
export function coastalLandmarkOccupied(x:number,z:number,padding=0){return coastalLandmarkSites.some(s=>Math.hypot(x-s.x,z-s.z)<s.radius+padding);}
