import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {FlightJournal} from '../src/journey/FlightJournal.ts';
import {resetJournalRecordsForRelease} from '../src/journey/JournalRecords.ts';

test('release clears souvenir and flight records once, preserving other save data',()=>{
 const records=new Map<string,string>([
  ['adriatic.journal.v1',JSON.stringify({
   version:1,visited:['harbor','town','hotel'],docked:['harbor'],entries:['old flight'],
   airSeconds:300,distance:4500,photos:3,livery:'ivory',raceWinner:true,
   completed:['post','return-post'],discoveries:['cove-logbook']
  })],
  ['adriatic.workshop.v1','workshop snapshot']
 ]);
 const storage={getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>{records.set(key,value);}};
 resetJournalRecordsForRelease(storage);
 const journal=new FlightJournal(storage);
 assert.deepEqual(journal.data.completed,['post','return-post']);
 assert.deepEqual(journal.data.discoveries,['cove-logbook']);
 assert.deepEqual([journal.data.visited,journal.data.docked,journal.data.entries],[[],[],[]]);
 assert.deepEqual([journal.data.airSeconds,journal.data.distance,journal.data.photos],[0,0,0]);
 assert.equal(journal.data.livery,'original');
 assert.equal(journal.unlocked('ivory'),false);
 assert.equal(journal.unlocked('azure'),false);
 assert.equal(records.get('adriatic.workshop.v1'),'workshop snapshot');
 journal.photo();
 resetJournalRecordsForRelease(storage);
 assert.equal(new FlightJournal(storage).data.photos,1);
});

test('starting at a berth does not record a visit or docking until flown or moored manually',()=>{
 const journal=new FlightJournal({getItem:()=>null,setItem:()=>{}});
 journal.update(.1,{x:0,y:0,z:0},false,'harbor',0,0,false,false);
 assert.deepEqual(journal.data.docked,[]);
 assert.deepEqual(journal.data.visited,[]);
 journal.update(.1,{x:0,y:0,z:0},false,'harbor');
 assert.deepEqual(journal.data.docked,['harbor']);
 assert.ok(journal.data.visited.includes('harbor'));
});
