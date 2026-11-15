import {allLandforms} from '../world/WorldConfig.ts';
import {mooringSites} from '../world/Moorings.ts';
export function coastalSound(position:{x:number;y:number;z:number},moored=false){
 const berthDistance=Math.min(...mooringSites.map(s=>Math.hypot(position.x-s.berth.x,position.z-s.berth.z)));
 const fade=Math.exp(-Math.max(0,position.y-8)/160);
 const shore=allLandforms.reduce((level,d)=>{const radius=Math.hypot((position.x-d.x)/d.rx,(position.z-d.z)/d.rz);return Math.max(level,Math.exp(-(((radius-1)*2.7)**2)));},0);
 const jetty=Math.max(0,1-berthDistance/320)*fade;
 return {coast:Math.max(shore*fade,jetty),surf:moored?.21:Math.max(shore*fade*.075,jetty*.15),bird:Math.max(shore*fade,jetty,moored?.8:0)};
}
