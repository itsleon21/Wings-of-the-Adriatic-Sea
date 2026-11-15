/** Bounded steps with warmup and hysteresis; DOM UI stays at native resolution. */
export class DynamicResolution {
 scale=.85;private slow=0;private fast=0;private cooldown=3;
 reset(scale=.85){this.scale=scale;this.slow=this.fast=0;this.cooldown=3;}
 update(dt:number,ms:number,samples:number):number|undefined{
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(ms)||ms<=0)return;
  this.cooldown=Math.max(0,this.cooldown-dt);if(samples<90||this.cooldown>0)return;
  this.slow=ms>19?this.slow+dt:0;this.fast=ms<17.2?this.fast+dt:0;
  const next=this.slow>1.2?Math.max(.55,this.scale-.05):this.fast>8?Math.min(1,this.scale+.025):this.scale;
  if(Math.abs(next-this.scale)<.001)return;
  this.scale=Math.round(next*1000)/1000;this.slow=this.fast=0;this.cooldown=3;return this.scale;
 }
}
