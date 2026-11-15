import {instrumentMarkup,instrumentAngle} from './InstrumentPanel';
import {guideMarkup} from './GuideContent';
import type {Checkpoint} from '../missions/MissionManager.ts';
import {headingDegrees,headingDirection,coordinateLabel,compassMarks,targetBearing,navigationDistance} from './NavigationReadout';
import type {NavigationTarget} from './NavigationReadout';
import {remapPitchKeys} from '../aircraft/ControlPreferences';
import {timeIds,timePresets} from '../rendering/TimeOfDay';
import type {TimeId,DaylightValues} from '../rendering/TimeOfDay';
import {mooringSites} from '../world/Moorings';
import type {QualityId} from '../rendering/QualityConfig';
import {landingAdvice,landingProfile} from '../aircraft/LandingGuidance';
import {weatherIds,weatherPresets} from '../rendering/WeatherConfig';import type {WeatherId} from '../rendering/WeatherConfig';
import type {FlightController} from '../aircraft/FlightController';import {allLandforms as islands,WorldBounds,harborRunway,bayProfile,coralIslets,coralReefLinks} from '../world/WorldConfig';import {route,formatTime} from '../missions/MissionManager';import type {MissionManager} from '../missions/MissionManager';
import {cruiseKmh} from '../aircraft/AircraftCatalog';
import type {AircraftDefinition} from '../aircraft/AircraftCatalog';
export interface Actions{invertPitch:(enabled:boolean)=>void;time:(id:TimeId)=>void;automaticTime:(enabled:boolean)=>void;camera:()=>void;weather:(id:WeatherId)=>void;automaticWeather:(enabled:boolean)=>void;start:()=>void;pause:()=>void;reset:()=>void;recover:()=>void;challenge:()=>void;sound:()=>void;quality:(id:QualityId)=>void;comfort:(enabled:boolean)=>void;volume:(value:number)=>void}
const names={ON_WATER:'水面待机',TAKEOFF_RUN:'水面滑跑',AIRBORNE:'空中巡航',LANDING:'着水减速',CRASHED:'飞行中断',RESETTING:'返回港口'};
export class HUD {
 private maxGaugeSpeed=400;private flightStartedAt=0;private raceMap?:{points:Checkpoint[];index:number};
 setRaceMap(points:Checkpoint[],index:number){this.raceMap={points,index};}
 private pitchUp='W';private pitchDown='S';private controlTexts:{node:Text;original:string}[]=[];
 private landingMode:'auto'|'open'|'closed'='auto';private refs=new Map<string,HTMLElement>();private canvas:HTMLCanvasElement;private context:CanvasRenderingContext2D;
 constructor(app:HTMLElement,actions:Actions,aircraft:AircraftDefinition){
  this.maxGaugeSpeed=Math.ceil(aircraft.tuning.maxSpeed*3.6/100)*100;
  const takeoff=Math.round(aircraft.tuning.takeoffSpeed*3.6),landing=landingProfile(aircraft.id);
  app.innerHTML=`<div id="viewport"></div><div class="vignette"></div>
  <section class="heading-system play-ui" id="heading-system" aria-label="航向、坐标与目标导航"><div class="compass-meta"><span>航向 <b id="compass-value">090° E</b></span><span id="position-coordinates">X — · Z —</span></div><div class="compass-window" id="compass-window" aria-hidden="true"><div class="compass-tape" id="compass-tape">${compassMarks().map(mark=>`<span class="compass-mark ${mark.major?'major':''}" style="left:${mark.degree*6}px"><i></i><small>${mark.label}</small></span>`).join('')}</div><span class="compass-index"></span><span class="compass-target" id="compass-target" hidden><span id="compass-target-symbol">◆</span></span></div><div class="compass-objective" id="compass-objective" hidden><span class="objective-kind" id="objective-kind"></span><b id="objective-name"></b><span class="objective-distance" id="objective-distance"></span><small id="objective-bearing"></small></div></section>
  <header class="topbar"><div class="identity"><svg width="34" height="30" viewBox="0 0 40 32" aria-hidden="true"><path d="M20 20L2 4l5 17 13 7L33 21 38 4z" fill="currentColor"/><path d="M20 20V2" stroke="currentColor" stroke-width="2"/></svg><div><b>WINGS OF THE ADRIATIC</b><span>亚 德 里 亚 海 之 翼</span></div></div><div class="top-actions"><span class="aircraft-label">${aircraft.name}</span><a class="top-hangar" href="./aircraft.html?aircraft=${aircraft.id}">机库 ↗</a><span class="location" id="location">港口基地</span><label class="weather-selector time-selector"><span>时刻</span><select id="time-of-day" aria-label="时刻">${timeIds.map(id=>`<option value="${id}">${timePresets[id].name}</option>`).join('')}</select><small id="world-clock">12:00</small></label><label class="weather-selector"><span>天气</span><select id="weather" aria-label="天气">${weatherIds.map(id=>`<option value="${id}">${weatherPresets[id].name}</option>`).join('')}</select></label><button id="pause">暂停 <kbd>Esc</kbd></button></div></header>
  <section class="intro" id="intro" aria-label="主菜单"><span class="intro-index">AERO CLUB / ADRIATIC • 1930</span><h1>亚德里亚海<br><em>之翼</em></h1><div class="home-subtitle">WINGS OF THE ADRIATIC</div><p>把海面当作跑道，向阳光中的群岛出发。</p><nav class="home-menu" aria-label="出发菜单"><button id="start"><small>01</small><strong>开始飞行</strong><span>↗</span></button><a href="./aircraft.html?aircraft=${aircraft.id}"><small>02</small><strong>进入机库</strong><span>→</span></a><button id="intro-help"><small>03</small><strong>飞行指南</strong><span>＋</span></button><a href="./?view=harbor"><small>04</small><strong>群岛图鉴</strong><span>→</span></a></nav><div class="home-edition"><span>海风、群岛与自由。</span><small>THE SEA IS YOUR RUNWAY.</small></div></section>
  <aside class="home-aircraft"><div class="home-aircraft-heading"><span>READY FOR DEPARTURE</span><small>${aircraft.number}</small></div><div class="home-aircraft-body"><div><small>当前座驾</small><strong>${aircraft.name}</strong><span>${aircraft.subtitle}</span></div><div class="home-cruise"><b>${cruiseKmh(aircraft)}</b><small>KM/H · CRUISE</small></div></div><a href="./aircraft.html?aircraft=${aircraft.id}">选择飞机 <span>↗</span></a></aside>
  <div class="intro-footer"><span>ADRIATIC / FLIGHT JOURNAL</span><span>选择一双翅膀，写下自己的航线。</span></div>
  <section class="mission-panel play-ui" id="flight-journal" aria-label="航行日志"><div class="eyebrow">FLIGHT JOURNAL <span class="rule"></span></div><h2 id="mission-title">海岛之间，自由漫游</h2><p id="mission-description">从港湾起飞，游览全部主岛。</p><div class="mission-bottom"><button id="challenge">开始环岛挑战 <span>→</span></button><span id="mission-time"></span></div><div id="checkpoint-progress" class="checkpoint-progress"></div></section>
  <aside class="landing-assist play-ui" id="landing-assist" hidden aria-label="水面降落指导"><div class="landing-heading"><span>WATER LANDING</span><button id="landing-close" aria-label="收起降落指导">×</button></div><h3 id="landing-title">准备水面进近</h3><div class="landing-readings"><div><small>建议空速</small><b>${landing.minKmh}–${landing.maxKmh}<em> km/h</em></b><span id="landing-speed"></span></div><div><small>距浪面</small><b id="landing-height"></b><span id="landing-sink"></span></div></div><div class="landing-checks"><span id="landing-bank"></span><span id="landing-water"></span></div><p id="landing-instruction"></p><p id="landing-path" aria-live="polite"></p></aside>

  <aside class="mooring-hint play-ui" id="mooring-hint" hidden></aside>
  <footer class="flight-rail play-ui" aria-label="飞行仪表与操作">${instrumentMarkup(this.maxGaugeSpeed,landing)}<div class="flight-summary"><small>${aircraft.name} / ${aircraft.number}</small><strong id="flight-region">港口基地</strong><div class="flight-status"><span class="status-dot"></span><span id="state">水面待机</span><small id="heading">090° E</small></div></div><nav class="deck-shortcuts" aria-label="快捷操作"><button id="deck-tools" aria-expanded="false" aria-controls="flight-tools">工具 ＋</button><button id="deck-environment" aria-expanded="false">环境</button></nav><nav class="flight-tools" id="flight-tools" aria-label="飞行工具"><button id="deck-mission" aria-expanded="false" aria-controls="flight-journal">环岛游览</button><button class="camera-toggle" id="camera" aria-label="切换摄像机视角">追尾 <kbd>C</kbd></button><button id="map-toggle" aria-controls="chart" aria-expanded="false">航图 <kbd>M</kbd></button><button id="sound" aria-label="切换声音">声音 开</button><button class="landing-toggle" id="landing-toggle" aria-pressed="false">着水指导 <kbd>L</kbd></button><button class="guide-toggle" id="help">操作指南 <kbd>H</kbd></button></nav></footer>
  <aside class="chart" id="chart" hidden aria-label="群岛航图"><div class="chart-heading"><span>FLIGHT ATLAS / 航行地图</span><button id="chart-close" aria-label="关闭航图">×</button></div><div><span>群岛航图</span><span>${WorldBounds.size/1000} × ${WorldBounds.size/1000} KM</span></div><canvas id="chart-canvas" width="480" height="480" aria-label="群岛航图与飞机位置"></canvas><footer><span id="chart-caption">港口基地</span><span>按 M 关闭 · 飞行继续</span></footer></aside>
  <div class="bottom-hint play-ui" id="hint">按住 <kbd>Shift</kbd> 加油门，达到 90 km/h 后按 <kbd>W</kbd> 抬头起飞</div>

  ${guideMarkup(aircraft,takeoff)}
  <div class="pause-layer" id="pause-layer" hidden><div class="pause-card"><div class="eyebrow">TAKE YOUR TIME</div><h2 id="pause-title">风景会等你。</h2><p id="pause-description">飞行与挑战计时已暂停。</p><button class="primary" id="resume">继续飞行 <span>→</span></button><button class="primary" id="recover" hidden>重飞 · 保持原航向 ↗</button><button class="text-button" id="reset">返回港口 <kbd>R</kbd></button><a class="text-button pause-hangar" href="./aircraft.html?aircraft=${aircraft.id}">返回机库换机 ↗</a></div></div>
  <div class="toast" id="toast" role="status"></div>`;
  const commandbar=document.createElement('nav');commandbar.className='cockpit-commandbar';commandbar.setAttribute('aria-label','飞行操作与环境');commandbar.append(app.querySelector('.deck-shortcuts')!,app.querySelector('.top-actions')!);app.append(commandbar);
  for(const element of app.querySelectorAll<HTMLElement>('[id]'))this.refs.set(element.id,element);
  const walker=document.createTreeWalker(this.get('guide'),NodeFilter.SHOW_TEXT);let textNode:Node|null;while((textNode=walker.nextNode()))if(textNode.parentElement?.closest('p,.key-grid kbd')&&/\b[WS]\b/.test(textNode.textContent??''))this.controlTexts.push({node:textNode as Text,original:textNode.textContent!});
  this.get('pitch-invert').addEventListener('change',()=>{actions.invertPitch((this.get('pitch-invert') as HTMLInputElement).checked);this.get('pitch-invert').blur();});
  this.canvas=this.get('chart-canvas') as HTMLCanvasElement;this.context=this.canvas.getContext('2d')!;
  const bind=(id:string,fn:()=>void)=>this.get(id).addEventListener('click',()=>{fn();(document.activeElement as HTMLElement)?.blur();});
  const disclosure=(id:string,cls:string)=>bind(id,()=>{const open=!document.body.classList.contains(cls);document.body.classList.remove('deck-tools-open','deck-environment-open','deck-mission-open');if(open)document.body.classList.add(cls);for(const [button,flag] of [['deck-tools','deck-tools-open'],['deck-environment','deck-environment-open'],['deck-mission','deck-mission-open']])this.get(button).setAttribute('aria-expanded',String(document.body.classList.contains(flag)));});
  disclosure('deck-tools','deck-tools-open');disclosure('deck-environment','deck-environment-open');disclosure('deck-mission','deck-mission-open');
  bind('landing-toggle',()=>this.toggleLanding());bind('landing-close',()=>this.toggleLanding());bind('camera',actions.camera);bind('start',actions.start);bind('pause',actions.pause);bind('resume',actions.pause);bind('reset',actions.reset);bind('recover',actions.recover);bind('challenge',actions.challenge);bind('sound',actions.sound);
  bind('help',()=>this.toggleHelp());bind('intro-help',()=>this.toggleHelp());bind('guide-close',()=>this.toggleHelp());bind('map-toggle',()=>this.toggleMap());bind('chart-close',()=>this.toggleMap());
  this.get('volume').addEventListener('input',()=>{const value=Number((this.get('volume') as HTMLInputElement).value);actions.volume(value/100);this.get('volume-value').textContent=`${value}%`;});
  this.get('weather').addEventListener('change',()=>{actions.weather((this.get('weather') as HTMLSelectElement).value as WeatherId);this.get('weather').blur();});
  this.get('time-of-day').addEventListener('change',()=>{actions.time((this.get('time-of-day') as HTMLSelectElement).value as TimeId);this.get('time-of-day').blur();});
  this.get('time-auto').addEventListener('change',()=>actions.automaticTime((this.get('time-auto') as HTMLInputElement).checked));
  this.get('weather-auto').addEventListener('change',()=>actions.automaticWeather((this.get('weather-auto') as HTMLInputElement).checked));
  this.get('camera-movement').addEventListener('change',()=>actions.comfort((this.get('camera-movement') as HTMLInputElement).checked));
  for(const option of this.get('guide').querySelectorAll<HTMLInputElement>('input[name="pilot-quality"]'))option.addEventListener('change',()=>actions.quality(option.value as QualityId));
  for(const button of this.get('guide').querySelectorAll<HTMLButtonElement>('[data-guide-page]'))button.addEventListener('click',()=>{
   for(const tab of this.get('guide').querySelectorAll<HTMLButtonElement>('[data-guide-page]'))tab.setAttribute('aria-pressed',String(tab===button));
   for(const page of this.get('guide').querySelectorAll<HTMLElement>('[data-page]'))page.hidden=page.dataset.page!==button.dataset.guidePage;
  });
 }
 toggleInterface(){document.body.classList.toggle('hud-hidden');}
 showInterface(){document.body.classList.remove('hud-hidden');}
 controls(inverted:boolean){this.pitchUp=inverted?'S':'W';this.pitchDown=inverted?'W':'S';(this.get('pitch-invert') as HTMLInputElement).checked=inverted;this.get('viewport').dataset.invertPitch=String(inverted);for(const {node,original} of this.controlTexts)node.textContent=remapPitchKeys(original,inverted);}
 clock(value:DaylightValues,automatic:boolean,selection:TimeId=value.phase){(this.get('time-of-day') as HTMLSelectElement).value=selection;(this.get('time-auto') as HTMLInputElement).checked=automatic;this.get('world-clock').textContent=value.label;}
 docking(name:string,distance:number,water:boolean,speed:number,moored:boolean){const panel=this.get('mooring-hint');panel.hidden=!moored&&(!water||distance>180);if(moored){this.get('hint').hidden=false;this.get('hint').innerHTML='已系泊 · 按 <kbd>F</kbd> 解缆，再加油门驶离栈桥';}panel.textContent=moored?`${name} · 已系泊 · F 离泊`:`${name} · ${Math.round(distance)} m · ${distance<35&&speed<5?'F 靠泊':'接近栈桥外侧，减速至18 km/h以下'}`;}
 get(id:string){return this.refs.get(id)!;}
 weather(id:WeatherId,automatic:boolean){(this.get('weather') as HTMLSelectElement).value=id;(this.get('weather-auto') as HTMLInputElement).checked=automatic;}
 get landingAutoAllowed(){return this.landingMode!=='closed';}
 get landingVisible(){return !this.get('landing-assist').hidden;}
 toggleLanding(){const open=this.get('landing-assist').hidden;this.landingMode=open?'open':'closed';this.get('landing-assist').hidden=!open;this.get('landing-toggle').setAttribute('aria-pressed',String(open));}
 resetLanding(){this.landingMode='auto';this.get('landing-assist').hidden=true;this.get('landing-toggle').setAttribute('aria-pressed','false');}
 landing(f:FlightController,water:{overWater:boolean;clearAhead:boolean},started:boolean,taskApproach=false){
  const contact=f.landingContact,advice=landingAdvice(f.tuning,{...contact,...water,state:f.state,speed:f.airspeed,bank:f.bank,pitch:f.pitch,throttle:f.throttle,landingCount:f.landingCount,rolling:f.rolling||!!f.maneuver});
  const panel=this.get('landing-assist'),visible=started&&(this.landingMode==='open'||this.landingMode==='auto'&&(advice.automatic||taskApproach));panel.hidden=!visible;panel.dataset.tone=advice.tone;panel.dataset.ready=String(advice.ready);this.get('landing-toggle').setAttribute('aria-pressed',String(visible));
  this.get('landing-title').textContent=advice.title;this.get('landing-instruction').textContent=advice.ready?'机翼放平 · 收油 · 轻柔接水':advice.title.includes('偏高')?'Ctrl 收油减速':advice.title.includes('下降过快')?`松开 ${this.pitchDown}，轻点 ${this.pitchUp}；必要时加油复飞`:advice.title.includes('机翼')?'松开 A / D，保持机翼水平':`接水前下降率 ≤ ${landingProfile(f.tuning.id).maxTouchdownSink.toFixed(1)} m/s`;
  const set=(id:string,text:string,good:boolean)=>{this.get(id).textContent=text;this.get(id).dataset.good=String(good);};
  const touching=f.state==='LANDING'||f.state==='ON_WATER'&&f.landingCount>0;
  set('landing-speed',`当前 ${Math.round(advice.speedKmh)} km/h`,touching||advice.speedGood);this.get('landing-height').textContent=`${advice.height<10?advice.height.toFixed(1):Math.round(advice.height)} m`;
  set('landing-sink',`${advice.sink>=0?'下降':'爬升'} ${Math.abs(advice.sink).toFixed(1)} m/s`,touching||advice.sinkGood);
  set('landing-bank',advice.bankGood?'✓ 机翼接近水平':'△ 请放平机翼',advice.bankGood);set('landing-water',advice.waterGood?'✓ 前方为水域':'△ 留意岸线 / 障碍',advice.waterGood);
 }
 camera(name:string){this.get('camera').innerHTML=`${name} <kbd>C</kbd>`;this.get('camera').setAttribute('aria-label',`切换摄像机视角，当前${name}`);}
 start(){this.flightStartedAt=performance.now();document.body.classList.add('is-playing');}
 mapOpen(){return !this.get('chart').hidden;}
 toggleMap(){const open=!this.mapOpen();this.get('chart').hidden=!open;this.get('map-toggle').setAttribute('aria-expanded',String(open));if(!open&&(document.activeElement as HTMLElement)?.closest('#chart'))(this.get('map-toggle') as HTMLButtonElement).focus();}
 navigation(heading:number,x:number,z:number,target?:NavigationTarget,altitude=0){
  const width=this.get('compass-window').clientWidth,degrees=headingDegrees(heading);
  this.get('compass-value').textContent=`${Math.round(degrees)%360}° ${headingDirection(degrees)}`;
  this.get('compass-tape').style.transform=`translateX(${-degrees*6}px)`;
  this.get('position-coordinates').textContent=`X ${coordinateLabel(x)} · Z ${coordinateLabel(z)}`;
  const marker=this.get('compass-target'),details=this.get('compass-objective'),panel=this.get('heading-system');
  marker.hidden=details.hidden=!target;panel.dataset.target=target?.kind??'none';
  if(!target)return;
  const aim=targetBearing(heading,x,z,target,width/2);
  marker.style.left=`calc(50% + ${aim.offset}px)`;marker.dataset.edge=aim.edge;
  this.get('compass-target-symbol').textContent=aim.edge==='left'?'‹':aim.edge==='right'?'›':'◆';
  this.get('objective-kind').textContent={mission:'航点',race:'竞赛',commission:'委托'}[target.kind];
  this.get('objective-name').textContent=target.name;
  this.get('objective-distance').textContent=navigationDistance(Math.hypot(target.position.x-x,target.position.z-z,target.position.y-altitude));
  this.get('objective-bearing').textContent=`${Math.round(aim.bearing)%360}° ${headingDirection(aim.bearing)}`;
  details.setAttribute('aria-label',`${target.name}，${this.get('objective-distance').textContent}，方位${Math.round(aim.bearing)%360}度，${Math.abs(aim.delta)<4?'目标在正前方':aim.edge==='left'?'向左转向目标':aim.edge==='right'?'向右转向目标':'目标位于刻度标记处'}`);
 }
 toggleHelp(){const dialog=this.get('guide') as HTMLDialogElement;if(dialog.open)dialog.close();else dialog.showModal();}
 helpOpen(){return (this.get('guide') as HTMLDialogElement).open;}
 sound(muted:boolean){this.get('sound').textContent=muted?'声音 关':'声音 开';}
 toast(message:string){this.get('toast').textContent=message;this.get('toast').classList.add('visible');window.setTimeout(()=>this.get('toast').classList.remove('visible'),3000);}
 rpm(value:number){this.get('rpm').textContent=String(Math.round(value));this.get('rpm-needle').style.setProperty('--angle',instrumentAngle(value,0,2500)+'deg');}
 update(f:FlightController,m:MissionManager,paused:boolean,started:boolean){
  this.get('speed').textContent=String(Math.round(f.airspeed*3.6));this.get('altitude').textContent=String(Math.round(f.altitude));this.get('throttle').innerHTML=`${Math.round(f.throttle*100)}<span>%</span>`;this.get('throttle-bar').style.width=`${f.throttle*100}%`;
  this.get('speed-needle').style.setProperty('--angle',instrumentAngle(f.airspeed*3.6,0,this.maxGaugeSpeed)+'deg');this.get('altitude-needle').style.setProperty('--angle',instrumentAngle(f.altitude,0,2000)+'deg');this.get('climb').textContent=(f.velocity.y>=0?'+':'')+f.velocity.y.toFixed(1);this.get('climb-needle').style.setProperty('--angle',instrumentAngle(f.velocity.y,-20,20)+'deg');
  this.get('state').textContent=f.maneuver?`${f.maneuverName} ${Math.round(f.maneuverProgress*100)}%`:f.rolling?'机动翻滚':names[f.state];const heading=((-f.heading*180/Math.PI)%360+360)%360;this.get('heading').textContent=`${Math.round(heading).toString().padStart(3,'0')}°`;
  let nearest=islands[0],distance=Infinity;for(const d of islands){const n=Math.hypot(f.position.x-d.x,f.position.z-d.z);if(n<distance){distance=n;nearest=d;}}
  this.get('location').textContent=distance<1200?nearest.name:'群岛外海';this.get('flight-region').textContent=distance<1200?nearest.name:'群岛外海';this.get('flight-journal').dataset.mode=m.state.toLowerCase();this.get('chart-caption').textContent=nearest.name;
  const challenge=this.get('challenge') as HTMLButtonElement;challenge.disabled=false;
  this.get('mission-time').textContent=m.state==='IDLE'?'':formatTime(m.elapsed);
  if(m.state==='RUNNING'){
   this.get('mission-title').textContent=`${m.index+1} / ${route.length} · ${m.current!.name}`;this.get('mission-description').textContent='飞近黄色箭头即可打卡，沿途欣赏群岛风景。';challenge.textContent='重新挑战 ↻';
  }else if(m.state==='COMPLETED'){
   this.get('mission-title').textContent='航线完成，飞得漂亮。';this.get('mission-description').textContent=`本次用时 ${formatTime(m.elapsed)}。继续漫游，或再飞一次。`;challenge.textContent='再次挑战 ↻';
  }else if(m.state==='FAILED'){
   this.get('mission-title').textContent='这次航行，稍作休息。';this.get('mission-description').textContent='返回港口，重新开始这段航程。';challenge.textContent='重新挑战 ↻';
  }else{this.get('mission-title').textContent='自由漫游';this.get('mission-description').textContent='从港湾起飞，游览全部主岛。';challenge.textContent='开始环岛挑战 →';const home=Math.hypot(f.position.x-harborRunway.x,f.position.z-harborRunway.z)<450;challenge.disabled=!home;if(!home)challenge.textContent='返回港口开启环岛挑战';}
  this.get('checkpoint-progress').innerHTML=route.map((_,i)=>`<span class="${i<m.index?'done':i===m.index&&m.state==='RUNNING'?'active':''}"></span>`).join('');
  this.get('pause-layer').hidden=!started||(!paused&&f.state!=='CRASHED');
  this.get('resume').hidden=f.state==='CRASHED';this.get('recover').hidden=f.state!=='CRASHED';this.get('pause-title').textContent=f.state==='CRASHED'?'重新出发，也很好。':'风景会等你。';this.get('pause-description').textContent=f.state==='CRASHED'?f.crashReason:'飞行与挑战计时已暂停。';
  this.get('hint').innerHTML=f.state==='ON_WATER'||f.state==='TAKEOFF_RUN'?`按住 <kbd>Shift</kbd> 加油门，达到 ${Math.round(f.tuning.takeoffSpeed*3.6)} km/h 后按 <kbd>${this.pitchUp}</kbd> 抬头起飞`:Math.max(Math.abs(f.position.x),Math.abs(f.position.z))>WorldBounds.maxX?'你正在离开主要海域，沿航图返回群岛。':f.maneuver?`${f.maneuverName}进行中 · 可用 Shift / Ctrl 调节油门 · 完成后恢复手动操纵`:f.rolling?'松开 <kbd>空格</kbd> 与方向键，机翼自动回正':'<kbd>W</kbd> <kbd>S</kbd> 俯仰　<kbd>A</kbd> <kbd>D</kbd> 转弯'+(f.tuning.aerobatics?'　<kbd>空格</kbd>＋<kbd>A</kbd>/<kbd>D</kbd> 翻滚'+(f.tuning.id==='mc72'?'　<kbd>X</kbd> 筋斗 / <kbd>Z</kbd> 殷麦曼':''):'　慢速巡航 · 平缓观光');
  const boundary=Math.max(Math.abs(f.position.x),Math.abs(f.position.z))>WorldBounds.maxX;this.get('hint').hidden=!boundary&&!f.maneuver&&!f.rolling&&(f.state==='AIRBORNE'||performance.now()-this.flightStartedAt>14000);
  if(this.mapOpen())this.drawMap(f,m);
 }
 private drawMap(f:FlightController,m:MissionManager){
  const c=this.context,w=this.canvas.width,s=w/WorldBounds.size,convert=(x:number,z:number)=>[(x-WorldBounds.minX)*s,(z-WorldBounds.minZ)*s];c.clearRect(0,0,w,w);
  c.strokeStyle='#83998c33';c.lineWidth=1;for(let i=0;i<6;i++){c.beginPath();c.moveTo(i*w/5,0);c.lineTo(i*w/5,w);c.moveTo(0,i*w/5);c.lineTo(w,i*w/5);c.stroke();}
  for(const d of islands){const [x,y]=convert(d.x,d.z);if(d.id==='coral'){c.strokeStyle='#9bbbaa';c.lineWidth=5;for(const [a,b] of coralReefLinks){const p=coralIslets[a],q=coralIslets[b];c.beginPath();c.moveTo(x+p.x*d.rx*s,y+p.z*d.rz*s);c.lineTo(x+q.x*d.rx*s,y+q.z*d.rz*s);c.stroke();}c.fillStyle='#b6b68b';for(const p of coralIslets){c.beginPath();c.ellipse(x+p.x*d.rx*s,y+p.z*d.rz*s,p.rx*d.rx*s,p.rz*d.rz*s,0,0,Math.PI*2);c.fill();}c.fillStyle='#294d4c';c.font='16px "Songti SC",serif';c.textAlign='center';c.fillText(d.name,x,y-25);continue;}c.fillStyle=d.id==='cove'?'#8d9c85':'#b6b68b';c.beginPath();for(let i=0;i<48;i++){const a=i/48*Math.PI*2,t=a+(d.id==='town'?Math.PI:0),r=d.id==='town'?1+.085*Math.sin(t*2+.4)+.04*Math.sin(t*3-1)+.025*Math.cos(t*7):1+.065*Math.sin(t*5+d.seed)+.04*Math.cos(t*9+d.seed);c.lineTo(x+Math.cos(a)*d.rx*s*r,y+Math.sin(a)*d.rz*s*r);}c.closePath();c.fill();if(d.bay){c.save();c.clip();c.globalCompositeOperation='destination-out';c.beginPath();if(d.id==='cove'){c.ellipse(x,y+25*s,174*s,137*s,0,0,Math.PI*2);c.rect(x-23*s,y+100*s,116*s,240*s);}else c.ellipse(x,y+d.rz*bayProfile(d).offset*s*(d.id==='town'?-1:1),d.rx*bayProfile(d).rx*1.05*s,d.rz*bayProfile(d).rz*1.05*s,0,0,Math.PI*2);c.fill();c.restore();}c.fillStyle='#294d4c';c.font='16px "Songti SC",serif';c.textAlign='center';c.fillText(d.name,x,y-4);}
  if(m.state==='RUNNING'){c.strokeStyle='#bc5e3d';c.setLineDash([5,7]);c.beginPath();route.forEach((p,i)=>{const[x,y]=convert(p.position.x,p.position.z);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();c.setLineDash([]);route.forEach((p,i)=>{const[x,y]=convert(p.position.x,p.position.z);c.fillStyle=i<m.index?'#778e76':i===m.index?'#ba482c':'#e7dcc1';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();});}
  if(this.raceMap){
   const {points,index}=this.raceMap;
   c.strokeStyle='#a34b2c';c.lineWidth=2;c.setLineDash([5,5]);c.beginPath();
   points.forEach((p,i)=>{const[x,y]=convert(p.position.x,p.position.z);if(i)c.lineTo(x,y);else c.moveTo(x,y);});
   c.stroke();c.setLineDash([]);
   points.forEach((p,i)=>{
    const[x,y]=convert(p.position.x,p.position.z),endpoint=i===0||i===points.length-1;
    c.fillStyle=i===index?'#b74723':'#b59a65';c.beginPath();c.arc(x,y,i===index?7:4,0,Math.PI*2);c.fill();
    const label=i===0?'起点 / START':i===points.length-1?'终点 / FINISH':String(i+1);
    c.font=endpoint?'bold 13px Georgia':'12px Georgia';c.textAlign='center';
    if(endpoint){const width=c.measureText(label).width+12;c.fillStyle='#f4e7c8';c.fillRect(x-width/2,y-30,width,20);}
    c.fillStyle='#354f46';c.fillText(label,x,y-15);
   });c.textAlign='start';
  }
  const [x,y]=convert(f.position.x,f.position.z);c.save();c.translate(Math.max(6,Math.min(w-6,x)),Math.max(6,Math.min(w-6,y)));c.rotate(-f.heading);c.fillStyle='#b43725';c.beginPath();c.moveTo(0,-11);c.lineTo(7,8);c.lineTo(0,4);c.lineTo(-7,8);c.closePath();c.fill();c.restore();
  for(const site of mooringSites){const [mx,my]=convert(site.berth.x,site.berth.z);c.strokeStyle='#526f75';c.lineWidth=2;c.strokeRect(mx-3,my-3,6,6);}
  c.fillStyle='#42615c';c.font='14px Georgia';c.fillText('N ↑',w-26,25);c.textAlign='left';c.fillText(`${WorldBounds.size/1000} × ${WorldBounds.size/1000} km`,14,w-16);c.fillRect(14,w-40,1000*s,2);c.fillText('1 km',14,w-47);
 }
}
