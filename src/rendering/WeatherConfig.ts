import {random} from '../world/WorldConfig.ts';
import {dayCycleSeconds} from './TimeOfDay.ts';
export type WeatherId='sunny'|'cloudy'|'rain'|'fog';
export interface WeatherValues {coverage:number;density:number;sun:number;ambient:number;haze:number;fogNear:number;fogFar:number;rain:number;wind:number;wetness:number;tint:number[]}
export const weatherPresets:Record<WeatherId,WeatherValues&{name:string}>={
 sunny:{name:'晴天',coverage:.055,density:.65,sun:3.6,ambient:.16,haze:1.7,fogNear:4500,fogFar:18500,rain:0,wind:.25,wetness:0,tint:[.65,.69,.68]},
 cloudy:{name:'多云',coverage:.58,density:.85,sun:2.15,ambient:.44,haze:2.8,fogNear:3400,fogFar:14500,rain:0,wind:.48,wetness:0,tint:[.67,.68,.67]},
 rain:{name:'雨天',coverage:.995,density:1.6,sun:.32,ambient:.68,haze:6.5,fogNear:650,fogFar:4600,rain:1,wind:.85,wetness:1,tint:[.49,.51,.52]},
 fog:{name:'多雾',coverage:.67,density:.78,sun:.95,ambient:.66,haze:5.8,fogNear:250,fogFar:2400,rain:0,wind:.12,wetness:.28,tint:[.73,.74,.72]},
};
const maxRainSeconds=dayCycleSeconds/6,weatherFade=7;
export const morningFogWindow=(hour:number)=>hour>=3.5&&hour<6;
export const weatherIds=Object.keys(weatherPresets) as WeatherId[];
export const resolveWeather=(value:string|null|undefined):WeatherId=>value==='overcast'?'cloudy':weatherIds.includes(value as WeatherId)?value as WeatherId:'sunny';
const clone=(w:WeatherValues):WeatherValues=>({coverage:w.coverage,density:w.density,sun:w.sun,ambient:w.ambient,haze:w.haze,fogNear:w.fogNear,fogFar:w.fogFar,rain:w.rain,wind:w.wind,wetness:w.wetness,tint:[...w.tint]});
export class WeatherController{
 target:WeatherId;readonly current:WeatherValues;automatic=true;private from:WeatherValues;private transition=1;private elapsed=0;private nextChange=210;private rng:()=>number;private rainDuration=0;
 constructor(initial:WeatherId='sunny',seed=Math.floor(Math.random()*2**32)){this.rng=random(seed);this.target=initial;this.current=clone(weatherPresets[initial]);this.from=clone(this.current);this.rainDuration=this.randomRainDuration();}
 private randomRainDuration(){return 54+this.rng()*(maxRainSeconds-weatherFade-.1-54);}
 select(id:WeatherId,immediate=false){if(id==='rain'&&this.target==='rain')return;if(id==='rain')this.rainDuration=this.randomRainDuration();this.target=id;this.from=clone(this.current);this.transition=immediate?1:0;this.elapsed=0;if(immediate)Object.assign(this.current,clone(weatherPresets[id]));}
 setAutomatic(enabled:boolean){this.automatic=enabled;if(this.target!=='rain')this.elapsed=0;}
 update(dt:number,advance=true,hour=12,touring=false){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);
  if(advance){
   this.elapsed+=dt;
   const morning=morningFogWindow(hour);
   if(this.target==='rain'){
    if(this.elapsed>=this.rainDuration){this.select('cloudy');this.nextChange=65+this.rng()*85;}
   }else if(this.automatic){
    if(this.target==='fog'&&!morning)this.select('sunny');
    if(this.elapsed>=this.nextChange){
     const midnight=hour>=0&&hour<4;
     const chance=(midnight?.84:.012)*(touring?.35:1);
     const dry=weatherIds.filter(id=>id!=='rain'&&id!==this.target&&(id!=='fog'||morning));
     this.select(this.rng()<chance?'rain':dry[Math.floor(this.rng()*dry.length)]);
     this.nextChange=65+this.rng()*85;
    }
   }
  }
  this.transition=Math.min(1,this.transition+dt/weatherFade);const t=this.transition*this.transition*(3-2*this.transition),to=weatherPresets[this.target];
  for(const key of Object.keys(this.from) as (keyof WeatherValues)[]){if(key==='tint'){this.current.tint=this.from.tint.map((v,i)=>v+(to.tint[i]-v)*t);}else this.current[key]=this.from[key]+(to[key]-this.from[key])*t;}
 }
 get settled(){return this.transition===1;}
}
