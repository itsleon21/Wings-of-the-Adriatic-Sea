import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FlightJournal} from '../src/journey/FlightJournal.ts';
import {storyStepTarget} from '../src/journey/StoryMissions.ts';
const storage=()=>{const m=new Map<string,string>();return{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};};
test('optional chapter detours can be completed, persist on resume and never advance the main stage',()=>{
 const saved=storage(),j=new FlightJournal(saved);j.aircraft='redwing';assert(j.accept('story-rw-1','harbor'));
 j.update(.1,{x:0,y:60,z:0},true,undefined,200);
 j.update(.1,{x:0,y:150,z:0},true,undefined,200);
 assert.equal(j.storyRequest,'offered');const step=j.storyStage!.title;
 j.chooseStoryRequest(true);const target=j.storyRequestTarget!.position;
 for(let i=0;i<30;i++)j.update(.1,target,true,undefined,200,0);
 assert.equal(j.storyRequest,'completed');assert.equal(j.storyStage!.title,step);
 assert.equal(j.workshop.credits,0);
 j.resetFlight();const resumed=new FlightJournal(saved);resumed.aircraft='redwing';assert(resumed.accept('story-rw-1','harbor'));assert.equal(resumed.storyRequest,'completed');
 let guard=0;while(resumed.storyStage&&guard++<8){const s=resumed.storyStage,t=storyStepTarget(s);resumed.update(.1,t.position,s.kind!=='dock',s.kind==='dock'?s.island:undefined,200);}
 assert(!resumed.active);assert(resumed.lastSettlement);assert(resumed.workshop.credits>=290);
});
test('declining a chapter detour persists and leaves the main navigation active',()=>{
 const saved=storage(),j=new FlightJournal(saved);j.aircraft='m5';j.accept('story-m5-1','harbor');
 j.update(.1,{x:0,y:60,z:0},true);j.update(.1,{x:0,y:150,z:0},true);
 j.chooseStoryRequest(false);assert.equal(j.storyRequest,'declined');
 assert.equal(j.scenicStop!.name,j.storyStage!.title);
 j.resetFlight();const resumed=new FlightJournal(saved);resumed.aircraft='m5';resumed.accept('story-m5-1','harbor');assert.equal(resumed.storyRequest,'declined');
});
