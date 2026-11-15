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
const app=document.querySelector<HTMLElement>('#app')!;
try{const game=new Game(app);const stopLanguage=installLanguage(app);window.addEventListener('pagehide',()=>{stopLanguage();game.dispose();},{once:true});}
catch(error){app.innerHTML='';const message=document.createElement('p');message.className='error';message.textContent=String(error);app.append(message);}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
