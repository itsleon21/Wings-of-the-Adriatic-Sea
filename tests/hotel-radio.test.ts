import test from 'node:test';import assert from 'node:assert/strict';
import {HotelRadio} from '../src/audio/HotelRadio.ts';
import {readFileSync} from 'node:fs';
test('local hotel recording exists; radio resumes after pause without overlapping sources or a media element',async()=>{
 const bytes=readFileSync(new URL('../public/audio/hotel-nataligino-1920.mp3',import.meta.url));assert.ok(bytes.length>1000000);assert.equal(bytes.subarray(0,3).toString(),'ID3');
 const original=globalThis.fetch;let starts=0,stops=0;const offsets:number[]=[];
 const ctx={currentTime:0,state:'running',createGain:()=>({gain:{value:0,setTargetAtTime(){}},connect(){},disconnect(){}}),decodeAudioData:async()=>({duration:200}),createBufferSource:()=>({connect(){},disconnect(){},start(_t:number,offset:number){starts++;offsets.push(offset);},stop(){stops++;}})};
 globalThis.fetch=(async()=>({ok:true,arrayBuffer:async()=>bytes.buffer})) as typeof fetch;
 try{const radio=new HotelRadio(ctx as unknown as AudioContext,{} as AudioNode,'/audio/hotel-nataligino-1920.mp3');radio.update(true,.4,false);await new Promise(r=>setImmediate(r));radio.update(true,.4,false);radio.update(true,.4,false);assert.equal(starts,1);ctx.currentTime=8;radio.update(true,.4,true);assert.equal(stops,1);radio.update(true,.4,false);assert.equal(starts,2);assert.equal(offsets[1],8);radio.update(false,0,false);radio.update(true,.4,false);assert.equal(offsets[2],0);radio.dispose();}finally{globalThis.fetch=original;}
});
