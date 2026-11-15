import * as T from 'three';
import {allLandforms,terrainHeight,islands,hotelIsland,bayProfile} from './WorldConfig.ts';
import {mooringSites} from './Moorings.ts';import {inTakeoffChannel} from './IslandDetails.ts';
const step=80,size=151,origin=-6000;
let mask:Uint8Array|undefined;const cached=new Map<string,T.CurvePath<T.Vector3>>(),reserved:T.Vector3[]=[];
/** Conservative navigation grid is prepared during scene loading, never when dusk begins. */
function waterGrid(){if(mask)return mask;mask=new Uint8Array(size*size);for(let iz=0;iz<size;iz++)for(let ix=0;ix<size;ix++){
 const x=origin+ix*step,z=origin+iz*step;
 if(Math.abs(x)>5840||Math.abs(z)>5840)continue;
 if(mooringSites.some(m=>{const dx=x-m.berth.x,dz=z-m.berth.z;return Math.hypot(dx,dz)<115||Math.abs(dx*m.dz-dz*m.dx)<90&&dx*m.dx+dz*m.dz>-80&&dx*m.dx+dz*m.dz<600;}))continue;
 if(allLandforms.some(d=>[-23,23].some(dx=>[-23,23].some(dz=>terrainHeight(d,x+dx,z+dz)>-3))))continue;
 mask[iz*size+ix]=1;
 }return mask;}
export function nightApproach(home:string,offshore:T.Vector3,slot:number,occupied:readonly {x:number;z:number}[]=[]){
 const key=home+'/'+slot,existing=cached.get(key);if(existing)return existing;
 const grid=waterGrid(),index=(p:T.Vector3)=>Math.round((p.z-origin)/step)*size+Math.round((p.x-origin)/step),start=index(offshore),from=new Int32Array(size*size).fill(-1),queue=[start];from[start]=start;
 for(let i=0;i<queue.length;i++){const at=queue[i],x=at%size,z=Math.floor(at/size);for(const [dx,dz] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
  const nx=x+dx,nz=z+dz,k=nz*size+nx;if(nx<0||nz<0||nx>=size||nz>=size||!grid[k]||from[k]>=0)continue;
  if(dx&&dz&&(!grid[z*size+nx]||!grid[nz*size+x]))continue;from[k]=at;queue.push(k);
 }}
 const d=[...islands,hotelIsland].find(d=>d.id===home)!,berth=mooringSites.find(m=>m.id===home)!,bay=bayProfile(d),facing=home==='town'?-1:1;
 const candidates=queue.filter(k=>{const x=origin+k%size*step,z=origin+Math.floor(k/size)*step;return !allLandforms.some(land=>inTakeoffChannel(land,x,z,75))&&Math.hypot((x-d.x)/Math.max(d.rx,220),(z-d.z)/Math.max(d.rz,220))<2.2&&reserved.every(p=>Math.hypot(x-p.x,z-p.z)>75)&&occupied.every(p=>Math.hypot(x-p.x,z-p.z)>65);});
 const score=(k:number)=>{const x=origin+k%size*step,z=origin+Math.floor(k/size)*step,inBay=home==='harbor'||home==='town'?Math.hypot((x-d.x)/(d.rx*bay.rx),((z-d.z)*facing-d.rz*bay.offset)/(d.rz*bay.rz))<1:false;return Math.hypot(x-berth.shoreX,z-berth.shoreZ)+(inBay?0:600);};
 candidates.sort((a,b)=>score(a)-score(b));if(!candidates.length)throw new Error('No safe night anchorage: '+home);
 const goal=candidates[0],points:T.Vector3[]=[];let at=goal;while(true){points.push(new T.Vector3(origin+at%size*step,0,origin+Math.floor(at/size)*step));if(at===start)break;at=from[at];}points.reverse();points.unshift(offshore.clone());
 const path=new T.CurvePath<T.Vector3>();for(let i=1;i<points.length;i++)if(points[i].distanceToSquared(points[i-1])>.001)path.add(new T.LineCurve3(points[i-1],points[i]));reserved.push(points.at(-1)!.clone());cached.set(key,path);return path;
}
export const wantsNightMooring=(hour:number)=>hour>=18||hour<6;
