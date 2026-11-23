const journalKey='adriatic.journal.v1';
const resetKey='adriatic.journal.records.reset.2026-11';

export function resetJournalRecordsForRelease(storage:Pick<Storage,'getItem'|'setItem'>){
 if(storage.getItem(resetKey)==='1')return;
 let previous;
 try{previous=JSON.parse(storage.getItem(journalKey)??'null');}catch{/* Treat a damaged journal as empty. */}
 storage.setItem(journalKey,JSON.stringify({
  ...(previous?.version===1?previous:{}),
  version:1,visited:[],docked:[],entries:[],airSeconds:0,distance:0,photos:0,
  raceWinner:false,livery:'original',recordCommissions:[]
 }));
 storage.setItem(resetKey,'1');
}
