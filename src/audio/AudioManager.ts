import {coastalSound} from './CoastalSound.ts';
import {StreamingHotelRadio} from './StreamingHotelRadio.ts';
import type {Vector3} from 'three';
import {islands,hotelIsland,hotelScale} from '../world/WorldConfig.ts';
export class AudioManager {
 private hotelRadio?:StreamingHotelRadio;private hotelArrived=false;
 private taxiGain?:GainNode;private taxiFilter?:BiquadFilterNode;
 private bellClock=0;private engineFilter?:BiquadFilterNode;private splashBuffer?:AudioBuffer;private surfGain?:GainNode;private forestGain?:GainNode;private birdClock=0;private birdDelay=7;private birdIndex=0;
 private context?:AudioContext;private master?:GainNode;private engine?:OscillatorNode;private engineGain?:GainNode;private windGain?:GainNode;private rainGain?:GainNode;
 muted=false;available=true;private volume=.42;
 async unlock(){
  try{
   if(!this.context){
    const ctx=this.context=new AudioContext();this.master=ctx.createGain();this.master.connect(ctx.destination);
    this.engine=ctx.createOscillator();this.engine.type='sawtooth';this.engineGain=ctx.createGain();const filter=this.engineFilter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=310;
    this.engine.connect(filter);filter.connect(this.engineGain);this.engineGain.connect(this.master);this.engine.start();
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.04)/1.04;data[i]=last*3;}
    const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;const band=ctx.createBiquadFilter();band.type='lowpass';band.frequency.value=1200;
    this.windGain=ctx.createGain();source.connect(band);band.connect(this.windGain);this.windGain.connect(this.master);source.start();
    const rainBuffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),rainData=rainBuffer.getChannelData(0);for(let i=0;i<rainData.length;i++)rainData[i]=(Math.random()*2-1)*.35;
    this.splashBuffer=rainBuffer;const rain=ctx.createBufferSource();rain.buffer=rainBuffer;rain.loop=true;const rainFilter=ctx.createBiquadFilter();rainFilter.type='lowpass';rainFilter.frequency.value=2900;this.rainGain=ctx.createGain();this.rainGain.gain.value=0;rain.connect(rainFilter);rainFilter.connect(this.rainGain);this.rainGain.connect(this.master);rain.start();
    // Broadband wash has its own noise source; foliage retains the softer wind source.
    const surfFilter=ctx.createBiquadFilter();surfFilter.type='bandpass';surfFilter.frequency.value=850;surfFilter.Q.value=.45;this.surfGain=ctx.createGain();this.surfGain.gain.value=0;const surfSource=ctx.createBufferSource();surfSource.buffer=rainBuffer;surfSource.loop=true;surfSource.connect(surfFilter);surfSource.start();surfFilter.connect(this.surfGain);this.surfGain.connect(this.master);
    const forestFilter=ctx.createBiquadFilter();forestFilter.type='highpass';forestFilter.frequency.value=1500;this.forestGain=ctx.createGain();this.forestGain.gain.value=0;source.connect(forestFilter);forestFilter.connect(this.forestGain);this.forestGain.connect(this.master);
    const taxi=ctx.createBufferSource();taxi.buffer=rainBuffer;taxi.loop=true;
    this.taxiFilter=ctx.createBiquadFilter();this.taxiFilter.type='lowpass';this.taxiFilter.frequency.value=650;
    this.taxiGain=ctx.createGain();this.taxiGain.gain.value=0;taxi.connect(this.taxiFilter);this.taxiFilter.connect(this.taxiGain);this.taxiGain.connect(this.master);taxi.start();
    this.engineGain.gain.value=0;this.windGain.gain.value=0;
   }
   await this.context.resume();
  }catch{this.available=false;}
 }
 /** Local user-supplied hotel recording, sharing the game's audio unlock and master gain. */
 hotelMusic(position:Vector3,onWater:boolean,paused:boolean){
  if(!this.context||!this.master)return;
  const distance=Math.hypot(position.x-hotelIsland.x,position.z-hotelIsland.z);
  const rangeScale=hotelScale/Math.SQRT1_2;
  if(distance>650*rangeScale||position.y>60)this.hotelArrived=false;
  if(onWater&&distance<450*rangeScale&&position.y<25)this.hotelArrived=true;
  if(!this.hotelRadio&&this.hotelArrived)this.hotelRadio=new StreamingHotelRadio(this.context,this.master,import.meta.env.BASE_URL+'audio/hotel-nataligino-1920.mp3');
  this.hotelRadio?.update(this.hotelArrived,Math.max(0,Math.min(1,(650*rangeScale-distance)/(300*rangeScale)))*.30,paused);
 }
 thunder(){if(!this.context||!this.master||!this.splashBuffer||this.muted)return;const ctx=this.context,t=ctx.currentTime+1.2,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.splashBuffer;source.loop=true;filter.type='lowpass';filter.frequency.setValueAtTime(150,t);filter.frequency.exponentialRampToValueAtTime(35,t+3);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.55,t+.12);gain.gain.exponentialRampToValueAtTime(.001,t+3.2);source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start(t);source.stop(t+3.3);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 setVolume(value:number){this.volume=Math.max(0,Math.min(1,value));}
 toggle(){this.muted=!this.muted;return this.muted;}
 update(throttle:number,speed:number,onWater:boolean,paused:boolean,rain=0,wind=0,aircraft='redwing',enginePitch=1,engineStopped=false){
  if(!this.context||!this.master||!this.engine||!this.engineGain||!this.windGain)return;
  const t=this.context.currentTime;this.master.gain.setTargetAtTime(this.muted||paused?0:this.volume,t,.1);
  const base=aircraft==='m5'?25:aircraft==='redwing'?34:46,range=aircraft==='m5'?44:aircraft==='redwing'?67:88,response=aircraft==='m5'?.35:.18;this.engine.frequency.setTargetAtTime((base+throttle*range-(onWater?3:0))*enginePitch,t,response);this.engineFilter?.frequency.setTargetAtTime(240+throttle*(aircraft==='m5'?180:420)+speed*1.2,t,.25);this.engineGain.gain.setTargetAtTime(engineStopped?0:onWater&&speed<1&&throttle<.05?0:.024+throttle*.045,t,.1);
  const waterWash=onWater&&!engineStopped?Math.sqrt(Math.max(0,Math.min(1,speed/40)))*.075:0;
  this.taxiGain?.gain.setTargetAtTime(waterWash,t,.18);
  this.taxiFilter?.frequency.setTargetAtTime(420+Math.min(1800,speed*32),t,.2);
  this.rainGain?.gain.setTargetAtTime(rain*.17,t,.4);
  this.windGain.gain.setTargetAtTime(Math.min(.18,speed/400)+wind*.025+(onWater?Math.min(.06,speed/550):0),t,.1);
 }
 ambience(dt:number,position:Vector3,moored=false){
  if(!this.context||!this.master||!this.surfGain||!this.forestGain||dt<=0)return;
  const sound=coastalSound(position,moored);let forest=0;for(const d of [...islands,hotelIsland]){const r=Math.hypot((position.x-d.x)/d.rx,(position.z-d.z)/d.rz);if(d.id!=='coral')forest=Math.max(forest,Math.max(0,1-r));}
  const heightFade=Math.exp(-Math.max(0,position.y-8)/110),t=this.context.currentTime;
  this.bellClock+=dt;const town=islands.find(i=>i.id==='town')!,harbor=islands.find(i=>i.id==='harbor')!,nearTown=Math.hypot(position.x-town.x,position.z-town.z)<900,nearHarbor=Math.hypot(position.x-harbor.x,position.z-harbor.z)<750;
  if(this.bellClock>28&&heightFade>.2&&(nearTown||nearHarbor)){this.bellClock=0;const ctx=this.context,base=nearTown?440:110;for(const [n,ratio] of (nearTown?[1,2.71,4.13]:[1,1.5]).entries()){const tone=ctx.createOscillator(),gain=ctx.createGain();tone.type='sine';tone.frequency.value=base*ratio;tone.connect(gain);gain.connect(this.master);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.035*heightFade/(n+1),t+.04);gain.gain.exponentialRampToValueAtTime(.0001,t+(nearTown?3.8:1.7));tone.start(t);tone.stop(t+4);tone.onended=()=>{tone.disconnect();gain.disconnect();};}}
  this.birdClock+=dt;this.surfGain.gain.setTargetAtTime(sound.surf*(.90+.18*Math.sin(this.birdClock*.7)+.08*Math.sin(this.birdClock*.29)),t,.8);this.forestGain.gain.setTargetAtTime(forest*heightFade*.08,t,.8);
  if(this.birdClock<this.birdDelay||sound.bird<.15)return;
  this.birdDelay=this.birdClock+5+(this.birdIndex++%5)*1.7;
  // Brief original synthetic gull phrases; nodes stop and disconnect rather than accumulating loops.
  const ctx=this.context,pan=ctx.createStereoPanner();pan.pan.value=Math.sin(this.birdIndex*2.39)*.75;pan.connect(this.master);
  const calls=2+this.birdIndex%2;for(let call=0;call<calls;call++){const o=ctx.createOscillator(),g=ctx.createGain(),filter=ctx.createBiquadFilter(),start=t+call*.30;filter.type='bandpass';filter.frequency.value=1800;filter.Q.value=.8;o.type='triangle';o.connect(filter);filter.connect(g);g.connect(pan);const pitch=740+this.birdIndex%4*110;o.frequency.setValueAtTime(pitch,start);o.frequency.exponentialRampToValueAtTime(pitch*1.65,start+.065);o.frequency.exponentialRampToValueAtTime(pitch*.85,start+.24);g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(.085*sound.bird,start+.035);g.gain.exponentialRampToValueAtTime(.0001,start+.27);o.start(start);o.stop(start+.29);o.onended=()=>{o.disconnect();filter.disconnect();g.disconnect();if(call===calls-1)pan.disconnect();};}

 }
 touchdown(impact:number,speed:number,aircraft='redwing'){
  if(!this.context||!this.master||!this.splashBuffer)return;
  const ctx=this.context,t=ctx.currentTime,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.splashBuffer;filter.type='lowpass';filter.frequency.value=900+Math.min(1800,speed*18);source.connect(filter);filter.connect(gain);gain.connect(this.master);const duration=.42+Math.max(0,Math.min(1,impact))*.43;filter.frequency.exponentialRampToValueAtTime(aircraft==='m5'?260:380,t+duration);const strength=Math.min(.28,.04+Math.max(0,impact)*.14+speed*.001);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(strength,t+.035);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.start(t);source.stop(t+duration+.05);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
 }
 cue(kind:'checkpoint'|'complete'|'crash'|'splash'){
  if(!this.context||!this.master)return;try{
   const ctx=this.context,t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(this.master);
   o.type=kind==='splash'?'triangle':'sine';o.frequency.setValueAtTime(kind==='complete'?520:kind==='checkpoint'?700:kind==='crash'?95:160,t);o.frequency.exponentialRampToValueAtTime(kind==='complete'?1040:kind==='checkpoint'?1000:45,t+.25);
   g.gain.setValueAtTime(.09,t);g.gain.exponentialRampToValueAtTime(.0001,t+.42);o.start(t);o.stop(t+.45);o.onended=()=>{o.disconnect();g.disconnect();};
  }catch{this.available=false;}
 }
 dispose(){this.hotelRadio?.dispose();void this.context?.close();}
}
