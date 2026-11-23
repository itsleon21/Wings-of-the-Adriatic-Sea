import './journey/journey.css';
import './style.css';
import './flight-ui.css';
import './wood-flight.css';
import './race/race.css';
import './compass-ui.css';
import {installLanguage} from './ui/Language';
import './language.css';
import './aeroclub.css';
import './pilot-guide.css';
import './home.css';
import './instruments.css';
import {Game} from './game/Game';
import {resetJournalRecordsForRelease} from './journey/JournalRecords';
const app=document.querySelector<HTMLElement>('#app')!;
try{
 const resetUrl=new URL(location.href),resetToken=resetUrl.searchParams.get('resetTasks');
 try{
  const releaseKey='adriatic.tasks.reset.crossing-seas';
  if(localStorage.getItem(releaseKey)!=='1'||(resetToken&&localStorage.getItem('adriatic.tasks.lastReset')!==resetToken)){
   const previous=localStorage.getItem('adriatic.journal.v1');
   if(previous)localStorage.setItem('adriatic.tasks.previous',previous);
   localStorage.removeItem('adriatic.journal.v1');
   for(const key of Object.keys(localStorage))if(key.startsWith('adriatic.race.')||key.startsWith('adriatic.ghost.'))localStorage.removeItem(key);
   localStorage.setItem(releaseKey,'1');
   if(resetToken)localStorage.setItem('adriatic.tasks.lastReset',resetToken);
  }
  resetJournalRecordsForRelease(localStorage);
 }catch{/* Storage may be disabled; the game can still start with a fresh journal. */}
 if(resetToken){resetUrl.searchParams.delete('resetTasks');history.replaceState(null,'',resetUrl);}
 const game=new Game(app);const stopLanguage=installLanguage(app);window.addEventListener('pagehide',()=>{stopLanguage();game.dispose();},{once:true});}
catch(error){app.innerHTML='';const message=document.createElement('p');message.className='error';message.textContent=String(error);app.append(message);}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
