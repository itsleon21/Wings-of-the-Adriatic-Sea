import * as T from 'three';
import {islands,random,harborRunway,covePoint} from '../world/WorldConfig.ts';
import {createCloudField} from './CloudShapes.ts';
import type {CloudShape} from './CloudShapes.ts';
import type {WeatherId} from './WeatherConfig.ts';
const profiles:Record<WeatherId,{count:number;width:number}>={
 sunny:{count:3,width:.75},
 cloudy:{count:34,width:1},
 rain:{count:52,width:1.45},
 fog:{count:18,width:.9},
};
const rainShapes:CloudShape[]=['bank','anvil','tower','bank','broken'];
const fairShapes:CloudShape[]=['cumulus','cumulus','tower','broken','anvil'];
const cloudyShapes:Record<Exclude<CloudLayer,'cove-mist'>,CloudShape[]>={
 sea:['streak','broken'],
 island:['humilis','cumulus','broken'],
 cruising:['cumulus','humilis','cumulus','tower','humilis','broken'],
 upper:['humilis','cumulus','bank','tower'],
 high:['streak','bank'],
};
export type CloudLayer='cove-mist'|'sea'|'island'|'cruising'|'upper'|'high';
interface CloudCell{
 x:number;z:number;y:number;width:number;height:number;depth:number;shape:CloudShape;
 variant:number;rotation:number;seed:number;island:boolean;layer:CloudLayer;density?:number;opacity?:number;
}
export function createCloudLayout(seed:number,weather:WeatherId='cloudy'){
 const rng=random(seed),cells:CloudCell[]=[],p=profiles[weather];
 const cove=islands.find(island=>island.id==='cove')!;
 const cell=(x:number,z:number,layer:Exclude<CloudLayer,'cove-mist'>,floor=0):CloudCell=>{
  const high=layer==='high';
  const choices:CloudShape[]=weather==='cloudy'?cloudyShapes[layer]:layer==='sea'?['broken','streak','broken']:layer==='island'?['cumulus','broken','cumulus']:high?['streak','bank']:weather==='rain'?rainShapes:fairShapes;
  const shape=choices[Math.floor(rng()*choices.length)];
  const width=(layer==='sea'?100+rng()*140:layer==='island'?170+rng()*200:layer==='cruising'?280+rng()*340:layer==='upper'?580+rng()*480:850+rng()*650)*p.width;
  let height=layer==='sea'?35+rng()*45:width*(shape==='tower'?.62:shape==='bank'?.34:shape==='streak'?.43:.53);
  if(weather==='cloudy'&&layer!=='sea'){
   const aspect=shape==='humilis'?.48:shape==='tower'?1.12:shape==='streak'?.48:1;
   height*=aspect*(.78+rng()*.38);
  }
  const base=layer==='sea'?65+rng()*100:layer==='island'?floor+55+rng()*140:layer==='cruising'?370+rng()*520:layer==='upper'?1450+rng()*1000:3100+rng()*1400;
  const y=Math.max(height*1.1+18,base);
  if(layer==='sea'&&Math.hypot(x-harborRunway.x,z-harborRunway.z)<650)x+=800;
  return{x,z,y,width,height,depth:width*(.6+rng()*.4),shape,variant:Math.floor(rng()*2),rotation:rng()*Math.PI*2,seed:rng()*100000,island:layer==='island',layer};
 };
 // Separate the horizontal footprints across altitude bands. This leaves open sky
 // between silhouettes even when seen from directly below or during a climb.
 const place=(candidate:CloudCell)=>{
  if(weather==='cloudy'){
   if(Math.hypot(candidate.x-cove.x,candidate.z-cove.z)<candidate.width+650)return false;
   if(cells.some(other=>Math.hypot(candidate.x-other.x,candidate.z-other.z)<(candidate.width+other.width)*1.12+150))return false;
  }
  cells.push(candidate);return true;
 };
 for(let i=0;i<p.count;i++){
  const band=i%10;
  const layer=weather==='sunny'?(i===0?'sea':i===1?'cruising':'upper')
   :weather==='fog'?(band<6?'sea':'cruising')
   :weather==='cloudy'?(band===0?'sea':band<7?'cruising':band<9?'upper':'high')
   :band<2?'sea':band<6?'cruising':band<9?'upper':'high';
  for(let attempt=0;attempt<28;attempt++){
   let x=(rng()-.5)*18000,z=(rng()-.5)*18000;
   if(layer==='sea'){
    const d=islands[Math.floor(rng()*islands.length)],a=rng()*Math.PI*2;
    x=d.x+Math.cos(a)*d.rx*(1.3+rng());z=d.z+Math.sin(a)*d.rz*(1.3+rng());
   }
   if(layer==='cruising'&&i%3===0){x=(rng()-.5)*11000;z=(rng()-.5)*11000;}
   if(place(cell(x,z,layer)))break;
  }
 }
 for(const island of islands){
  const chance=weather==='sunny'?.12:weather==='fog'?.4:weather==='cloudy'?.64:.72;
  const count=rng()>chance?0:weather==='sunny'||weather==='cloudy'?1:rng()<.6?1:2;
  for(let i=0;i<count;i++)place(cell(island.x+(rng()-.5)*island.rx*1.4,island.z+(rng()-.5)*island.rz*1.4,'island',island.height));
 }
 // This bank belongs to the coastline, so global wind never carries it away.
 const mist=random(seed+3807);
 for(let i=0;i<6;i++){
  const angle=(i+mist()*.42)*Math.PI/3;
  const p=covePoint(cove,cove.x+Math.cos(angle)*(cove.rx+32+mist()*75),cove.z+Math.sin(angle)*(cove.rz+24+mist()*68));
  cells.push({
   ...p,
   y:28+mist()*48,width:128+mist()*91,height:22+mist()*34,depth:72+mist()*48,
   shape:i%3===0?'broken':'streak',variant:i%2,rotation:angle,seed:mist()*100000,
   island:false,layer:'cove-mist',density:weather==='sunny'?.62:weather==='fog'?1.02:.80,
  });
 }
 return cells;
}
/** Match the baked cloud boundary, including gaps between fragmented lobes. */
export function cloudImmersionAt(point:T.Vector3,cells:ReturnType<typeof createCloudLayout>,drift=new T.Vector3(),scale=1){
 let amount=0;
 for(const c of cells){
  const anchored=c.layer==='cove-mist',dx=point.x-c.x-(anchored?0:drift.x),dz=point.z-c.z-(anchored?0:drift.z),cs=Math.cos(c.rotation),sn=Math.sin(c.rotation),w=c.width*scale,h=c.height*scale,d=c.depth*scale;
  const x=(dx*cs+dz*sn)/w,y=(point.y-c.y)/h,z=(-dx*sn+dz*cs)/d;
  if(Math.abs(x)>2.1||y< -1.4||y>2.1||Math.abs(z)>1.6)continue;
  const key=c.shape+':'+c.variant;let field=immersionFields.get(key);if(!field){field=createCloudField(c.shape,57+c.variant*83);immersionFields.set(key,field);}
  const distance=field(x,y,z)*Math.min(w,h,d);
  amount=Math.max(amount,(1-T.MathUtils.smoothstep(distance,-35,65))*(c.density??1)*(c.opacity??1));
 }
 return amount;
}
const immersionFields=new Map<string,ReturnType<typeof createCloudField>>();
