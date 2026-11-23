import type {RaceField} from './RaceField';
import type {RaceControls} from './RaceControls';
import type {FlightController} from '../aircraft/FlightController';
import {raceGuidance} from './RaceGuidance';
import type {RaceGhost} from './RaceGhost';
import {getAircraft} from '../aircraft/AircraftCatalog.ts';
import type {AircraftId} from '../aircraft/FlightConfig.ts';
import {formatTime} from '../missions/MissionManager.ts';
import type {Settlement} from '../journey/FlightAssessment.ts';
import {raceCourse,raceCourseId} from './RaceManager.ts';
import type {RaceManager} from './RaceManager.ts';
export class RaceUI{
 readonly offer:HTMLDialogElement;private panel:HTMLElement;
 constructor(app:HTMLElement,readonly returnAircraft:string){
  app.insertAdjacentHTML('beforeend',`<dialog id="race-invitation" aria-labelledby="race-offer-title"><div class="eyebrow">HOME HARBOR / SCHNEIDER MEMORIAL</div><h2 id="race-offer-title">来一场海上竞速？</h2><p>三架飞机从港口基地外海同时起跑，依次飞越风车小镇、珊瑚群岛、花园酒店岛、松林岛和灯塔岛，回到基地终点即分出胜负。建议保持海拔 220–310 米。</p><p>可随时继续游览。比赛是游戏中的纪念赛，飞机性能为游戏调校。</p><div class="race-offer-actions"><a class="primary" href="./index.html?race=1&launch=1&aircraft=mc72&returnAircraft=${returnAircraft}">驾驶 MC.72 参赛 ↗</a><button id="race-decline" class="text-button">继续飞行游览</button></div></dialog><aside id="race-status" hidden aria-label="比赛进度"><small>施耐德纪念赛 / 群岛竞速</small><div id="race-aircraft"></div><h2 id="race-phase"></h2><b id="race-timer">00:00.0</b><p id="race-next"></p><p id="race-guidance" aria-live="polite"></p><p id="race-best"></p><p id="race-sector"></p><p id="race-laps"></p><label class="ghost-option"><input id="race-motion" type="checkbox" checked> 高速动态模糊</label><label class="ghost-option" title="渐进键盘响应、自动协调转弯与轻微升力补偿"><input id="race-assist" type="checkbox" checked> 平稳转弯辅助</label><label class="ghost-option"><input id="race-ghost" type="checkbox" checked> 个人最佳幽灵</label><p id="race-ghost-note"></p><div id="race-finish" hidden><p id="race-reward"></p><button id="race-retry">再赛一次 ↻</button></div><p class="race-shortcut">R 随时重赛 · 完赛后 Enter 再赛</p><a class="race-exit" href="./?aircraft=${returnAircraft}&launch=1&berth=harbor">结束比赛，继续游览 ↗</a></aside>`);
  this.offer=app.querySelector('#race-invitation')!;this.panel=app.querySelector('#race-status')!;
  app.querySelector('#race-decline')!.addEventListener('click',()=>this.close());this.offer.addEventListener('cancel',()=>this.close());
 }
 get blocking(){return this.offer.open;}
 invite(){this.offer.showModal();}
 close(){this.offer.close();}
 update(race:RaceManager,aircraft:string,retry:()=>void,ghost?:RaceGhost,controls?:RaceControls,flight?:FlightController,field?:RaceField,celebrating=false,settlement?:Settlement){
  this.panel.hidden=celebrating;document.body.classList.add('race-playing');if(celebrating)return;const get=(id:string)=>document.getElementById(id)!;
  get('race-aircraft').textContent=getAircraft(aircraft as AircraftId).name;get('race-phase').textContent=race.state==='COUNTDOWN'?`准备 · ${Math.ceil(race.countdown)}`:race.state==='READY'?'起飞，前往计时起点':race.state==='COMPLETED'?`${field?.winner??''} 获胜`:race.state==='FAILED'?'比赛中断':`第 ${field?.place??1} / 3 名`;
  get('race-timer').textContent=formatTime(race.elapsed);get('race-next').textContent=race.current?`航门 ${race.index+1}/${raceCourse.length} · ${raceCourse[race.index].name}`:race.state==='COMPLETED'?'完赛 · 可继续自由飞行':'';
  if(flight){const guide=raceGuidance(race,flight);if(get('race-guidance').textContent!==guide.message)get('race-guidance').textContent=guide.message;get('race-guidance').dataset.warning=String(guide.warning);}
  const motion=get('race-motion') as HTMLInputElement;motion.checked=controls?.motionBlur??true;motion.onchange=()=>{if(controls)controls.motionBlur=motion.checked;motion.blur();};
  const assist=get('race-assist') as HTMLInputElement;assist.checked=controls?.enabled??true;assist.onchange=()=>{if(controls){controls.enabled=assist.checked;controls.reset();}assist.blur();};
  const sector=race.sectors.length,last=sector?race.sectors[sector-1]:0,previous=sector>1?race.sectors[sector-2]:0,benchmark=ghost?.best?.sectors[sector-1],delta=benchmark===undefined?undefined:last-benchmark;
  get('race-sector').textContent=sector?`第 ${sector} 段 · ${formatTime(last-previous)}${delta===undefined?'':` / ${delta<=0?'领先':'落后'} ${Math.abs(delta).toFixed(1)}秒`}`:'绿灯同时起跑 · 首架到终点即结束';
  get('race-laps').textContent=field?.rivals.map(r=>`${r.name} · ${r.race.state==='FAILED'?'退赛':`${r.race.index+1}/${raceCourse.length} 航门`}`).join('\n')??'';
  const toggle=get('race-ghost') as HTMLInputElement;toggle.disabled=!ghost?.best;toggle.onchange=()=>{if(ghost)ghost.enabled=toggle.checked;toggle.blur();};get('race-ghost-note').textContent=ghost?.best?'淡青色线框 · 本机型最佳航迹':'首次完赛后解锁';toggle.title=ghost?.best?'淡青色线框显示本机型的个人最佳航迹':'首次完赛后解锁个人最佳幽灵';
  const terminal=race.state==='COMPLETED'||race.state==='FAILED';get('race-finish').hidden=!terminal;get('race-reward').textContent=race.state==='COMPLETED'&&settlement?`评价 ${settlement.score}/100 · +${settlement.total} 航空币 · +${settlement.reputation} 竞速声望`:'';(get('race-retry') as HTMLButtonElement).onclick=()=>{(document.activeElement as HTMLElement)?.blur();retry();};
  let best='';try{const key='adriatic.race.'+raceCourseId+'.best.'+aircraft+(new URLSearchParams(location.search).get('configuration')==='modified'?'.modified':''),old=Number(localStorage.getItem(key));if(race.state==='COMPLETED'&&field?.place===1&&(!old||race.elapsed<old))localStorage.setItem(key,String(race.elapsed));const saved=Number(localStorage.getItem(key));if(saved)best='本机最佳 · '+formatTime(saved);}catch{}get('race-best').textContent=best;
 }
}
