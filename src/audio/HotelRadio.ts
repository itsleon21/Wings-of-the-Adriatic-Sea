/** Decoded local recording: no remote stream, CORS dependency or media autoplay gate. */
export class HotelRadio {
 private buffer?:AudioBuffer;private loading=false;private source?:AudioBufferSourceNode;
 private offset=0;private since=0;private retryAt=0;readonly gain:GainNode;
 private context:AudioContext;private url:string;
 constructor(context:AudioContext,output:AudioNode,url:string){this.context=context;this.url=url;this.gain=context.createGain();this.gain.gain.value=0;this.gain.connect(output);}
 update(active:boolean,level:number,paused:boolean){
  const ctx=this.context;this.gain.gain.setTargetAtTime(active&&!paused?level:0,ctx.currentTime,.5);
  if(!active||paused){this.stop();if(!active)this.offset=0;return;}
  if(!this.buffer&&!this.loading&&ctx.currentTime>=this.retryAt){
   this.loading=true;
   void fetch(this.url).then(r=>{if(!r.ok)throw Error('Hotel music unavailable');return r.arrayBuffer();}).then(b=>ctx.decodeAudioData(b)).then(b=>{this.buffer=b;}).catch(()=>{this.retryAt=ctx.currentTime+10;}).finally(()=>{this.loading=false;});
  }
  if(this.buffer&&!this.source&&ctx.state==='running'){
   const source=this.source=ctx.createBufferSource();source.buffer=this.buffer;source.loop=true;source.connect(this.gain);this.since=ctx.currentTime;source.start(0,this.offset%this.buffer.duration);
  }
 }
 private stop(){if(!this.source)return;this.offset+=Math.max(0,this.context.currentTime-this.since);this.source.stop();this.source.disconnect();this.source=undefined;}
 dispose(){this.stop();this.gain.disconnect();}
}
