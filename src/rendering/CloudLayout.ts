import * as T from 'three';
import {islands,random,harborRunway} from '../world/WorldConfig.ts';
import {createCloudField} from './CloudShapes.ts';
import type {CloudShape} from './CloudShapes.ts';
import type {WeatherId} from './WeatherConfig.ts';
const profiles:Record<WeatherId,{count:number;shapes:CloudShape[];base:number;range:number;width:number;tint:number}>={
 sunny:{count:3,shapes:['cumulus','broken','streak'],base:650,range:1900,width:.75,tint:0xfffaed},
 cloudy:{count:44,shapes:['cumulus','cumulus','cumulus','tower','streak','broken','anvil'],base:320,range:2400,width:1,tint:0xfff9ef},
 rain:{count:52,shapes:['bank','anvil','tower','bank','broken'],base:240,range:1100,width:1.45,tint:0x929ca8},
 fog:{count:18,shapes:['streak','broken','bank'],base:180,range:650,width:.9,tint:0xe2e1dc},
};
export type CloudLayer='sea'|'island'|'cruising'|'upper'|'high';
export function createCloudLayout(seed:number,weather:WeatherId='cloudy'){
 const rng=random(seed),cells=[],p=profiles[weather];
 const cell=(x:number,z:number,layer:CloudLayer,floor=0)=>{
  const high=layer==='high';
  const choices:CloudShape[]=layer==='sea'?['broken','streak','broken']:layer==='island'?['cumulus','broken','cumulus']:high?['streak','bank']:weather==='rain'?p.shapes:['cumulus','cumulus','tower','broken','anvil'];
  const shape=choices[Math.floor(rng()*choices.length)];
  const width=(layer==='sea'?100+rng()*140:layer==='island'?170+rng()*200:layer==='cruising'?280+rng()*340:layer==='upper'?580+rng()*480:850+rng()*650)*p.width;
  const height=layer==='sea'?35+rng()*45:width*(shape==='tower'?.62:shape==='bank'?.34:shape==='streak'?.43:.53);
  const base=layer==='sea'?65+rng()*100:layer==='island'?floor+55+rng()*140:layer==='cruising'?370+rng()*520:layer==='upper'?1450+rng()*1000:3100+rng()*1400;
  const y=Math.max(height*1.1+18,base);
  if(layer==='sea'&&Math.hypot(x-harborRunway.x,z-harborRunway.z)<650)x+=800;
  return{x,z,y,width,height,depth:width*(.6+rng()*.4),shape,variant:Math.floor(rng()*2),rotation:rng()*Math.PI*2,seed:rng()*100000,island:layer==='island',layer};
 };
 for(let i=0;i<p.count;i++){
  const band=i%10,layer:CloudLayer=weather==='sunny'?(i===0?'sea':i===1?'cruising':'upper'):weather==='fog'?(band<6?'sea':'cruising'):band<2?'sea':band<6?'cruising':band<9?'upper':'high';
  let x=(rng()-.5)*18000,z=(rng()-.5)*18000;
  // Nearby wisps provide speed cues; the larger, higher clouds frame the open sea.
  if(layer==='sea'){const d=islands[Math.floor(rng()*islands.length)],a=rng()*Math.PI*2;x=d.x+Math.cos(a)*d.rx*(1.3+rng());z=d.z+Math.sin(a)*d.rz*(1.3+rng());}
  if(layer==='cruising'&&i%3===0){x=(rng()-.5)*11000;z=(rng()-.5)*11000;}
  cells.push(cell(x,z,layer));
 }
 for(const island of islands){
  const chance=weather==='sunny'?.12:weather==='fog'?.4:.72;
  const count=rng()>chance?0:weather==='sunny'?1:rng()<.6?1:2;
  for(let i=0;i<count;i++)cells.push(cell(island.x+(rng()-.5)*island.rx*1.4,island.z+(rng()-.5)*island.rz*1.4,'island',island.height));
 }
 return cells;
}
/** Match the baked cloud boundary, including gaps between fragmented lobes. */
export function cloudImmersionAt(point:T.Vector3,cells:ReturnType<typeof createCloudLayout>,drift=new T.Vector3(),scale=1){
 let amount=0;
 for(const c of cells){
  const dx=point.x-c.x-drift.x,dz=point.z-c.z-drift.z,cs=Math.cos(c.rotation),sn=Math.sin(c.rotation),w=c.width*scale,h=c.height*scale,d=c.depth*scale;
  const x=(dx*cs+dz*sn)/w,y=(point.y-c.y)/h,z=(-dx*sn+dz*cs)/d;
  if(Math.abs(x)>2.1||y< -1.4||y>2.1||Math.abs(z)>1.6)continue;
  const key=c.shape+':'+c.variant;let field=immersionFields.get(key);if(!field){field=createCloudField(c.shape,57+c.variant*83);immersionFields.set(key,field);}
  const distance=field(x,y,z)*Math.min(w,h,d);
  amount=Math.max(amount,1-T.MathUtils.smoothstep(distance,-35,65));
 }
 return amount;
}
const immersionFields=new Map<string,ReturnType<typeof createCloudField>>();
