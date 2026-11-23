import {AirPirateScene,pirateBoatPosition,pirateBoatStop} from '../journey/AirPirate';
import {airPirateJobId} from '../journey/StoryMissions';
import {LandingDirector,planLandingRetry,type LandingDestination} from '../aircraft/LandingDirector';
import {SunGlarePass} from '../rendering/SunGlarePass';
import {WingtipTrails,CondensationController} from '../rendering/WingtipTrails';
import {TrialTelemetry} from '../upgrades/TrialTelemetry';
import {installedAppearance} from '../upgrades/InstalledAppearance';
import {configuredParts,applyParts,trialStorage} from '../upgrades/Workshop';
import {NavigationBeacon} from '../missions/NavigationBeacon';
import {RescueBoat} from '../journey/RescueBoat';
import type {NavigationTarget} from '../ui/NavigationReadout';
import {FlightJournal} from '../journey/FlightJournal';
import {JournalUI} from '../journey/JournalUI';
import {PhotoStudio} from '../camera/PhotoStudio';
import {AircraftLivery} from '../rendering/AircraftLivery';
import {TemporalResolve} from '../rendering/TemporalResolve';
import type {CloudPass} from '../rendering/CloudPass';
import {DynamicResolution} from '../rendering/DynamicResolution';
import {NightStorm} from '../rendering/NightStorm';
import {RaceField} from '../race/RaceField';
import {RaceControls} from '../race/RaceControls';
import {RaceGhost} from '../race/RaceGhost';
import {RaceManager,raceLaunch,raceHeading,raceCourse,raceStops} from '../race/RaceManager.ts';
import {marineWindDirection,marineWindSpeed} from '../world/MarineWind.ts';
import {RaceVisual,RaceFireworks} from '../race/RaceVisual.ts';
import {RaceUI} from '../race/RaceUI.ts';
import {isAircraftId} from '../aircraft/AircraftCatalog.ts';
import * as T from 'three';
import {TimeOfDay,resolveTime} from '../rendering/TimeOfDay';
import {mooringSites} from '../world/Moorings';
import type {MooringSite} from '../world/Moorings';
import {CockpitLook} from '../camera/CockpitLook';
import {FrameMetrics} from './FrameMetrics';
import {qualityPresets,resolveQuality} from '../rendering/QualityConfig';
import type {QualityId} from '../rendering/QualityConfig';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {adriaticFXAA} from '../rendering/AdriaticLook';
import WebGL from 'three/addons/capabilities/WebGL.js';
import {WeatherController,resolveWeather} from '../rendering/WeatherConfig';
import {WeatherEffects} from '../rendering/WeatherEffects';
import {Daylight} from '../rendering/Daylight';
import {harbor,harborRunway,allLandforms,terrainHeight,northFlightLimit,WorldBounds,townPoint,hotelPoint,covePoint} from '../world/WorldConfig';
import {IslandSurface} from '../rendering/IslandSurface';
import {getAircraft,selectedAircraftId,saveAircraftSelection} from '../aircraft/AircraftCatalog';
import {GameLoop} from './GameLoop';import {FlightController} from '../aircraft/FlightController';import {AircraftModel} from '../aircraft/AircraftModel';import {Input} from '../aircraft/Input';import {ChaseCamera} from '../camera/ChaseCamera';import {World} from '../world/World';import {HUD} from '../ui/HUD';import {MissionManager} from '../missions/MissionManager';import {RouteVisual} from '../missions/RouteVisual';import {AudioManager} from '../audio/AudioManager';
export class Game{
 private taskLandingActive=false;
 private landingDirector=new LandingDirector();
 private trialMeter?:TrialTelemetry;private menuRenderTime=0;private wasInMenu=false;
 private trial=new URLSearchParams(location.search).has('trial')&&new URLSearchParams(location.search).get('race')!=='1';private journal=new FlightJournal(this.trial?trialStorage({getItem:key=>{try{return localStorage.getItem(key);}catch{return null;}},setItem:()=>{}}):undefined);private journalUI!:JournalUI;private photo!:PhotoStudio;private livery=new AircraftLivery();
 private resolution=new DynamicResolution();private autoQuality=new URLSearchParams(location.search).get('quality')==='auto';private ghost?:RaceGhost;private cloudPass:CloudPass;private cockpitLook:CockpitLook;private metrics=new FrameMetrics();private qualityId:QualityId=resolveQuality(new URLSearchParams(location.search).get('quality'));
 private antiAliasing=new URLSearchParams(location.search).get('aa');private renderScale=1;private temporal?:TemporalResolve;
 private accelerationBlur=0;
 private glare=new SunGlarePass();private composer:EffectComposer;private fxaa:ShaderPass;private renderer:T.WebGLRenderer;private scene=new T.Scene();private camera=new T.PerspectiveCamera(55,1,.4,26000);private daylight:Daylight;private islandSurface=new IslandSurface();private churchView=new URLSearchParams(location.search).get('church')==='1';private streetView=new URLSearchParams(location.search).get('street')==='1';private shorelineView=new URLSearchParams(location.search).get('shore')==='1';private overviewIsland=allLandforms.find(d=>d.id===new URLSearchParams(location.search).get('view'));private overviewFocus=new T.Vector3(harbor.x,40,harbor.z);

 private fleetStudy=new URLSearchParams(location.search).has('fleet');private fleetIndex=Math.max(0,Math.min(3,Number(new URLSearchParams(location.search).get('fleet'))||0));
 private fireworksPreview=new URLSearchParams(location.search).get('fireworks')==='1';
 private storm!:NightStorm;private raceField?:RaceField;private raceControls=new RaceControls();private racing=new URLSearchParams(location.search).get('race')==='1';private race=new RaceManager();private raceVisual=new RaceVisual();private fireworks=new RaceFireworks();private raceUI:RaceUI;
 private clock=new TimeOfDay(resolveTime(new URLSearchParams(location.search).get('time')));private moored?:MooringSite;private spawnedMoored=false;
 private baseAircraft=getAircraft(selectedAircraftId());private installed= configuredParts(this.journal.workshop,this.baseAircraft.id,location.search);private aircraft={...this.baseAircraft,tuning:applyParts(this.baseAircraft.tuning,this.installed)};
 private loop:GameLoop;private input:Input;private flight=new FlightController(false,this.aircraft.tuning);private model=new AircraftModel(this.aircraft.id);private chase=new ChaseCamera(this.camera);private world=new World(this.racing?raceStops:[]);private hud:HUD;private disposed=false;private compassForward=new T.Vector3();
 private weather=new WeatherController(resolveWeather(new URLSearchParams(location.search).get('weather')));private weatherEffects:WeatherEffects;
 private condensation=new CondensationController();private trailVelocity?:T.Vector3;private trailLoad=1;private wingtipTrails=new WingtipTrails();private beacon=new NavigationBeacon();private mission=new MissionManager();private route=new RouteVisual();private audio=new AudioManager();private paused=false;private started=false;private elapsed=0;private hudTime=0;
 constructor(app:HTMLElement){
  if(!WebGL.isWebGL2Available())throw new Error('当前浏览器无法使用 WebGL 2，请启用硬件加速或更换桌面浏览器。');

  this.scene.add(this.beacon.root,this.wingtipTrails.root,this.landingDirector.root);saveAircraftSelection(this.aircraft.id);this.journal.aircraft=this.aircraft.id;
  if(new URLSearchParams(location.search).has('time'))this.clock.setAutomatic(false);
  this.hud=new HUD(app,{invertPitch:enabled=>this.invertPitch(enabled),time:id=>this.clock.select(id,this.paused||this.hud.helpOpen()||!this.started),automaticTime:enabled=>this.clock.setAutomatic(enabled),camera:()=>this.cycleCamera(),weather:id=>{this.weather.setAutomatic(false);this.weather.select(id,this.paused||this.hud.helpOpen());},automaticWeather:enabled=>this.weather.setAutomatic(enabled),start:()=>this.start(),pause:()=>this.togglePause(),reset:()=>this.reset(),recover:()=>this.recover(),challenge:()=>this.challenge(),sound:()=>this.hud.sound(this.audio.toggle()),quality:id=>{this.autoQuality=(id as string)==='auto';this.resolution.reset();this.quality(this.autoQuality?'balanced':id);},comfort:enabled=>this.chase.setMovement(enabled),volume:value=>this.audio.setVolume(value)},this.aircraft);
  const returnId=new URLSearchParams(location.search).get('returnAircraft');this.raceUI=new RaceUI(app,isAircraftId(returnId)?returnId:this.racing?'redwing':this.aircraft.id);
  if(this.racing){for(const anchor of app.querySelectorAll<HTMLAnchorElement>('.top-hangar,.pause-hangar'))anchor.href=`./aircraft.html?race=1&aircraft=${this.aircraft.id}&returnAircraft=${this.raceUI.returnAircraft}`;this.clock.select('noon',true);this.clock.setAutomatic(false);this.weather.select('sunny',true);this.weather.setAutomatic(false);for(const id of ['weather','time-of-day','weather-auto','time-auto'])(this.hud.get(id) as HTMLInputElement).disabled=true;}
  if(this.racing)this.ghost=new RaceGhost(this.aircraft.id+(new URLSearchParams(location.search).get('configuration')==='modified'?'.modified':''));this.scene.add(this.raceVisual.root,this.fireworks.points);this.raceVisual.root.visible=this.racing;this.route.root.visible=false;
  if(this.fireworksPreview){document.body.classList.add('island-preview');this.previewFireworks();app.insertAdjacentHTML('beforeend','<aside class="island-preview-caption"><small>CELEBRATION / EFFECT PREVIEW</small><h1>完赛烟花 · 效果预览</h1><p>这是烟花效果检查，不记录比赛成绩。</p><a href="?fireworks=1&time=dusk">重新播放 ↗</a><a href="./">返回游戏</a></aside>');}
  if(this.fleetStudy){document.body.classList.add('island-preview');app.insertAdjacentHTML('beforeend',`<aside class="island-preview-caption"><small>ADRIATIC MARINE / VESSEL STUDY</small><h1>${['沿岸客船','渔船','橙帆游艇','金帆游艇'][this.fleetIndex]}</h1><p>木甲板 · 舷窗 · 护栏 · 帆具</p><nav><a href="?fleet=0">沿岸客船</a><a href="?fleet=1">渔船</a><a href="?fleet=2">帆船</a><a href="./">返回游戏</a></nav></aside>`);}
  if(this.overviewIsland){const d=this.overviewIsland;document.body.classList.add('island-preview');app.insertAdjacentHTML('beforeend',`<aside class="island-preview-caption"><small>ISLAND STUDY / ${Math.round(d.rx*2)} × ${Math.round(d.rz*2)} M</small><h1>${d.name}</h1><p>${d.id==='north-coast'?'意大利亚得里亚海沿岸风貌 · 低海岬 · 沙滩与疏林':d.id==='hotel'?'临海酒店 · 石砌护岸 · 四季花园':d.id==='coral'?'三座沙洲 · 浅滩礁链 · 椰林':d.id==='pine'?'低丘与谷地 · 海岸松林 · 巡护小屋':d.id==='lighthouse'?'石灰岩高台 · 灯塔 · 守塔人步道':d.id==='cove'?'石灰岩高地 · 环抱沙滩 · 海蚀拱门':d.id==='town'?'山顶风车与残拱 · 台地磨坊 · 海港市集':'避风港湾 · 基地码头 · 层叠林地'}</p><nav>${allLandforms.map(i=>`<a href="?view=${i.id}" ${i.id===d.id?'aria-current="page"':''}>${i.name}</a>`).join('')}</nav><a href="?view=${d.id}${this.shorelineView?'':'&shore=1'}&weather=${this.weather.target}">${this.shorelineView?'返回全岛视角':'近岸细看材质'} ↗</a>${d.id==='harbor'||d.id==='town'?`<a href="?view=${d.id}&street=1">临海街区细看 ↗</a><a href="?view=${d.id}&church=1">教堂近景 ↗</a><a href="?view=${d.id}&harbor=1&time=night&weather=sunny">港湾夜景 ↗</a>`:''}<a href="./">返回港口，驾驶飞机探索 ↗</a></aside>`);}
  this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance',logarithmicDepthBuffer:true});this.renderer.setPixelRatio(1);this.renderer.setClearColor(0xaecaca);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.82;
  this.renderer.shadowMap.enabled=false;this.hud.get('viewport').append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','群岛飞行场景');
  this.composer=new EffectComposer(this.renderer);
  if(this.antiAliasing==='msaa'){
   const samples=Math.min(2,this.renderer.capabilities.maxSamples);
   for(const target of[this.composer.renderTarget1,this.composer.renderTarget2])target.samples=samples;
  }
  for(const target of[this.composer.renderTarget1,this.composer.renderTarget2])target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  this.composer.addPass(new RenderPass(this.scene,this.camera));this.composer.addPass(this.glare);const output=new OutputPass();this.composer.addPass(output);this.fxaa=new ShaderPass(adriaticFXAA());this.composer.addPass(this.fxaa);this.renderer.info.autoReset=false;
  this.storm=new NightStorm(this.scene);this.daylight=new Daylight(this.renderer,this.scene,this.camera);this.world.ocean.bindCloudShadows(this.daylight.seaCloudUniforms);this.daylight.setShadows(new URLSearchParams(location.search).get('shadows')!=='off');if(this.racing)this.raceField=new RaceField(this.scene,this.aircraft.id,this.renderer);this.weatherEffects=new WeatherEffects(this.scene);this.cloudPass=this.weatherEffects.createCloudPass(this.camera);this.composer.insertPass(this.cloudPass,1);
  if(this.antiAliasing==='taa'||this.antiAliasing==='taau'){
   const upsample=this.antiAliasing==='taau';
   this.temporal=new TemporalResolve(this.camera,()=>this.cloudPass.sceneDepth,upsample);
   if(upsample){
    this.preserveSceneDepth(output);
    this.preserveSceneDepth(this.fxaa);
    this.composer.addPass(this.temporal);
   }
   else this.composer.insertPass(this.temporal,2);
  }
  if(new URLSearchParams(location.search).has('weather'))this.weather.setAutomatic(false);
  this.flight.setWaterSurface((x,z,time)=>this.world.ocean.surfaceAt(x,z,time));this.raceField?.rivals.forEach(r=>r.flight.setWaterSurface((x,z,time)=>this.world.ocean.surfaceAt(x,z,time)));
  this.scene.add(this.world.root,this.model.root,this.route.root);this.world.ocean.excludeFromReflection(this.model.root);this.world.ocean.excludeFromReflection(this.daylight.starField);this.world.ocean.setQuality(new URLSearchParams(location.search).get('reflection')==='off');this.route.update(this.mission,0);this.chase.reset(this.flight);
  this.islandSurface.setContactOccluders(this.world.surfaceOccluders);this.islandSurface.setNightLightSources(this.world.nightLampSites);this.islandSurface.prepare(this.world.root);this.daylight.prepare(this.world.root);this.daylight.setAircraft(this.model.root);this.daylight.prepare(this.model.root);
  const ready=Promise.all([this.model.load(this.renderer),this.world.loadAssets(),this.islandSurface.ready,this.raceField?.ready,this.daylight.warmEnvironment()]).then(async()=>{if(!this.disposed){installedAppearance(this.model.root,this.installed);this.metrics.reset();this.islandSurface.prepare(this.world.root);this.daylight.prepare(this.world.root);this.daylight.setAircraft(this.model.root);this.daylight.prepare(this.model.root);this.raceField?.rivals.forEach(r=>this.daylight.prepare(r.model.root));this.applyLivery();await this.warmFlightScene();this.metrics.reset();}});
  if(this.trial){this.clock.select('noon',true);this.clock.setAutomatic(false);this.weather.select('sunny',true);this.weather.setAutomatic(false);const badge=document.createElement('aside');badge.className='trial-banner';badge.innerHTML='<strong>改装试飞 · 不保存收益与任务进度</strong><a href="./?aircraft='+this.aircraft.id+'&workshop=1">结束试飞，返回工坊 ↗</a>';app.append(badge);this.trialMeter=new TrialTelemetry(this.installed.length?'改装配置':'基础配置',this.aircraft.id,this.installed.map(p=>p.id).sort().join('+')||'stock');}
  this.input=new Input(key=>{if(this.hud.helpOpen()){if(key==='Escape'||key==='KeyH'){this.hud.toggleHelp();this.input.clear();this.loop.clearAccumulator();}return;}if(this.photo?.active){if(key==='KeyP'||key==='Escape'){this.photo.exit();this.input.clear();this.loop.clearAccumulator();}return;}if(this.journalUI?.open){if(key==='KeyJ'||key==='Escape')this.journalUI.close();return;}if(key==='KeyJ'&&!this.hud.helpOpen()&&!this.raceUI.blocking){this.input.clear();this.journalUI.toggle();return;}if(key==='KeyP'){this.togglePhoto();return;}if(this.raceUI.blocking){if(key==='Escape')this.raceUI.close();return;}if(key==='KeyU'&&this.started&&!this.paused&&!this.hud.helpOpen())this.hud.toggleInterface();if(this.started)void this.audio.unlock();if(key==='KeyI')this.invertPitch(!this.input.preferences.inverted);if((key==='KeyX'||key==='KeyZ')&&this.started&&!this.paused&&!this.hud.helpOpen())this.hud.toast(this.flight.requestManeuver(key==='KeyX'?'loop':'immelmann'));if((key==='KeyR'||key==='Enter'&&this.racing&&['COMPLETED','FAILED'].includes(this.race.state))&&this.started)this.reset();if(key==='Escape'&&!this.hud.helpOpen()){if(this.hud.mapOpen())this.hud.toggleMap();else if(this.started)this.togglePause();}if(key==='KeyH')this.hud.toggleHelp();if(key==='KeyM')this.hud.toggleMap();if(key==='KeyC')this.cycleCamera();if(key==='KeyV')this.chase.recenter();if(key==='KeyF'&&!this.talkToPirateCrew())this.toggleMooring();if(key==='KeyL'&&this.started&&!this.hud.helpOpen())this.hud.toggleLanding();},()=>{if(this.started)this.setPaused(true);});
  this.hud.controls(this.input.preferences.inverted);
  this.cockpitLook=new CockpitLook(this.renderer.domElement,this.chase,()=>this.started&&!this.paused&&!this.hud.helpOpen()&&!this.photo.active&&!this.journalUI.open);this.photo=new PhotoStudio(app,this.camera,this.renderer.domElement,()=>this.renderScene(0),()=>this.journal.photo(),()=>{this.input.clear();this.loop.clearAccumulator();});this.journalUI=new JournalUI(app,this.journal,()=>this.racing?undefined:this.moored?.id,()=>this.applyLivery(),()=>this.togglePhoto(),()=>this.clock.waitUntil(19));this.scene.add(this.pirateScene.root);this.quality(this.autoQuality?'balanced':this.qualityId);document.addEventListener('visibilitychange',this.visibility);
  this.loop=new GameLoop(dt=>this.update(dt),(alpha,dt)=>this.render(alpha,dt));window.addEventListener('resize',this.resize);this.resize();this.hud.update(this.flight,this.mission,this.paused,this.started,!this.racing&&(!!this.journal.active||this.mission.state==='RUNNING'));this.loop.start();if(new URLSearchParams(location.search).get('workshop')==='1')this.journalUI.openWorkshop();
  const startButton=this.hud.get('start') as HTMLButtonElement,startLabel=startButton.querySelector('strong')??startButton;startButton.disabled=true;startLabel.textContent='正在准备飞机与群岛…';
  void ready.then(()=>{if(!this.disposed){startButton.disabled=false;startLabel.textContent='开始飞行';}});
  if(new URLSearchParams(location.search).get('launch')==='1'){
   void ready.then(()=>{if(this.disposed)return;this.start();this.hud.toast(this.moored?`${this.moored.name} · 按 F 解缆` : this.model.assetStatus.includes('未加载')?this.model.assetStatus:`${this.aircraft.name}已就绪 · 按住 Shift 滑跑起飞`);});
  }
 }
 private async warmFlightScene(){
  // Prepare shaders and upload both building LODs before allowing takeoff.
  // A tiny top-down render sees all islands, including assets beyond the menu camera.
  const camera=new T.PerspectiveCamera(90,1,1,30000);camera.position.set(0,13000,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const target=new T.WebGLRenderTarget(16,16),previous=this.renderer.getRenderTarget();
  try{
   for(const detail of[false,true]){
    this.world.warmBuildingLOD(detail);await this.renderer.compileAsync(this.scene,camera);
    if(this.disposed)return;
    this.world.warmBuildingLOD(detail);
    this.renderer.setRenderTarget(target);this.renderer.render(this.scene,camera);this.renderer.setRenderTarget(previous);
   }
  }finally{this.renderer.setRenderTarget(previous);target.dispose();this.world.endBuildingWarmup();this.world.updateView(this.camera.position,this.camera.fov);}
 }
 private rescueBoat=new RescueBoat();
 private pirateScene=new AirPirateScene();
 private rescuePosition(){return this.rescueBoat.root.position.clone();}
 private updateRescue(dt:number){
  if(!this.rescueBoat.root.parent)this.scene.add(this.rescueBoat.root);
  this.rescueBoat.update(dt,false,this.camera);
  const d=Math.hypot(this.flight.position.x-this.rescueBoat.root.position.x,this.flight.position.z-this.rescueBoat.root.position.z);
  if(this.journal.rescueUpdate(dt,['LANDING','ON_WATER'].includes(this.flight.state),Math.hypot(this.flight.velocity.x,this.flight.velocity.z),d)){this.hud.toast('救援完成 · 船员已安全登机');this.audio.cue('complete');}
 }
 private applyLivery(){this.livery.apply(this.model.root,this.journal.data.livery,this.aircraft.id);}
 private togglePhoto(){if(!this.started||this.hud.helpOpen()||this.journalUI.open||this.raceUI.blocking)return;this.input.clear();this.loop.clearAccumulator();this.photo.enter(this.model.root.position);}
 private previewFireworks(){this.fireworks.start(raceCourse.at(-1)!.position,new T.Vector3(0,0,-1));}
 private resetRace(){this.accelerationBlur=0;this.landingDirector.reset();this.raceField?.reset();this.raceControls.reset();this.moored=undefined;this.world.resetWater();this.flight.reset();this.flight.moorAt(raceLaunch.x,raceLaunch.z,raceHeading);this.race.reset();this.raceVisual.reset();this.route.reset();this.ghost?.reset();this.fireworks.reset();this.mission.reset();this.hud.resetLanding();this.input.clear();this.chase.reset(this.flight);this.hud.camera(this.chase.view.name);this.hud.get('viewport').dataset.camera=this.chase.view.id;this.paused=false;this.loop.clearAccumulator();this.hud.toast('港口基地外海起跑 · 三秒后同时出发');}
 private invertPitch(enabled:boolean){this.input.preferences.setInverted(enabled);this.input.clear();this.hud.controls(enabled);this.hud.toast(enabled?'俯仰已反转 · S 抬头 / W 低头':'标准俯仰 · W 抬头 / S 低头');}
 private start(){if(this.started)return;this.started=true;this.paused=false;this.hud.start();if(this.racing){this.resetRace();return;}const requestedBerth=this.trial?'harbor':new URLSearchParams(location.search).get('berth');const berth=this.trial&&!requestedBerth?undefined:mooringSites.find(s=>s.id===(requestedBerth??'harbor'));if(berth){this.flight.moorAt(berth.berth.x,berth.berth.z,berth.heading);this.moored=berth;this.spawnedMoored=true;}this.input.clear();this.chase.reset(this.flight);this.loop.clearAccumulator();void this.audio.unlock();}
 private cycleCamera(){if(!this.started||this.hud.helpOpen())return;const view=this.chase.cycle(this.flight);this.hud.camera(view.name);this.hud.get('viewport').dataset.camera=view.id;this.hud.toast(view.id==='cockpit'?'驾驶舱 · 鼠标拖动观察 · V 回正':`摄像机 · ${view.name}`,2400,true);}
 private setPaused(value:boolean){this.paused=value;if(value)this.hud.showInterface();this.input.clear();this.raceControls.reset();this.loop.clearAccumulator();}
 private landingWaterClear(x:number,z:number){
  return x>WorldBounds.minX+100&&x<WorldBounds.maxX-100&&z>WorldBounds.minZ+100&&z<WorldBounds.maxZ-100
   &&this.world.landingClearAt(x,z)&&this.pirateScene.clear(x,z);
 }
 private recover(landingTarget?:LandingDestination,automatic=false){
  if(this.flight.state!=='CRASHED')return;
  const target=landingTarget??this.taskLandingTarget();
  const candidate=target&&planLandingRetry(target,(x,z)=>this.landingWaterClear(x,z));
  const retry=candidate&&!this.world.collides(candidate.position,candidate.position.clone().add(
   new T.Vector3(-Math.sin(candidate.heading),0,-Math.cos(candidate.heading)).multiplyScalar(400),
  ))?candidate:undefined;
  const heading=retry?.heading??this.flight.heading;
  const position=retry?.position??this.flight.position.clone();
  if(!retry){
   position.y=Math.max(130,position.y+80);
   // Maintain clearance along the rebased flight path before handing control back.
   for(let step=0;step<=10;step++){
    const x=position.x-Math.sin(heading)*step*100,z=position.z-Math.cos(heading)*step*100;
    position.y=Math.max(position.y,this.world.heightAt(x,z)+130);
   }
  }
  this.accelerationBlur=0;this.landingDirector.reset();this.wingtipTrails.clear();this.trailVelocity=undefined;this.trailLoad=1;this.condensation.clear();
  this.journal.interruptForRecovery();this.flight.recoverAt(position,heading);
  this.moored=undefined;this.paused=false;this.world.clearWake();this.input.clear();this.hud.resetLanding();this.chase.reset(this.flight);this.loop.clearAccumulator();
  const message=retry?'已复飞 · 任务进度已保留，重新进近':automatic?'着水失败 · 已复飞，继续当前任务':this.journal.active||this.mission.state==='RUNNING'?'已重飞 · 继续当前任务':'已重飞 · 保持原航向继续飞行';
  this.hud.toast(message,3000,!!target||automatic);
 }
 private togglePause(){if(this.flight.state==='CRASHED')return;this.setPaused(!this.paused);if(!this.paused)void this.audio.unlock();}
 private reset(){this.accelerationBlur=0;this.landingDirector.reset();this.wingtipTrails.clear();this.trailVelocity=undefined;this.trailLoad=1;this.condensation.clear();this.trialMeter?.reset();this.journal.resetFlight();if(this.racing){this.resetRace();return;}this.moored=undefined;this.flight.reset();if(!this.trial){const home=mooringSites.find(s=>s.id==='harbor')!;this.flight.moorAt(home.berth.x,home.berth.z,home.heading);this.moored=home;this.spawnedMoored=true;}this.world.resetWater();this.hud.resetLanding();this.mission.reset();this.route.reset();this.input.clear();this.chase.reset(this.flight);this.hud.camera(this.chase.view.name);this.hud.get('viewport').dataset.camera=this.chase.view.id;this.paused=false;this.loop.clearAccumulator();this.hud.toast('已返回港口，准备下一段航程');}
 private challenge(){if(this.racing)return;if(this.mission.state==='IDLE'&&Math.hypot(this.flight.position.x-harborRunway.x,this.flight.position.z-harborRunway.z)>450)return;this.reset();this.mission.start();this.hud.toast('全岛游览已开始 · 飞近黄色箭头，逐岛打卡');void this.audio.unlock();}
 private talkToPirateCrew(){
  if(!this.started||this.paused||!this.journal.pirateRendezvous||this.moored)return false;
  const f=this.flight,reply=this.journal.talkToPirateCrew(f.position,f.state==='ON_WATER'||f.state==='LANDING',f.groundSpeed*3.6);
  if(reply){this.hud.toast(reply,10500);this.audio.cue('checkpoint');this.landingDirector.reset();return true;}
  if(Math.hypot(f.position.x-pirateBoatStop.x,f.position.z-pirateBoatStop.z)<150){
   this.hud.toast('在船侧标记着水并减速至 5 km/h，再按 F 交谈');return true;
  }
  return false;
 }
 private toggleMooring(){if(this.racing&&this.race.state!=='COMPLETED'){this.hud.toast('比赛期间请沿航门飞行；完赛后可以着水靠泊');return;}if(!this.started||this.paused||this.hud.helpOpen()||this.flight.state==='CRASHED')return;if(this.moored){this.moored=undefined;this.spawnedMoored=false;this.hud.toast('已解缆 · 轻加油门驶离栈桥');return;}const site=this.world.moorings.nearest(this.flight.position),distance=Math.hypot(this.flight.position.x-site.berth.x,this.flight.position.z-site.berth.z);if(distance>35||this.flight.groundSpeed>=5||this.flight.state==='AIRBORNE'){this.hud.toast('靠近航图中的栈桥外侧，着水并减速至18 km/h以下，再按 F');return;}const assessment=this.journal.docking(this.flight.groundSpeed,distance);this.flight.moorAt(site.berth.x,site.berth.z,site.heading);this.moored=site;this.spawnedMoored=false;this.world.clearWake();this.input.clear();this.hud.toast(`${site.name} · ${assessment} · F 离泊`);}
 private quality(id:QualityId){this.qualityId=id;this.glare.enabled=id==='high';const p=qualityPresets[id];this.resolution.reset(p.resolution);this.setRenderScale(p.resolution);this.daylight.setShadows(p.shadows&&new URLSearchParams(location.search).get('shadows')!=='off');this.world.ocean.setQuality(!p.reflection||new URLSearchParams(location.search).get('reflection')==='off');this.cloudPass.setResolution(p.cloudScale);(this.hud.get('quality') as HTMLInputElement).value=this.autoQuality?'auto':id;
  for(const option of this.hud.get('guide').querySelectorAll<HTMLInputElement>('input[name="pilot-quality"]'))option.checked=option.value===(this.autoQuality?'auto':id);this.metrics.reset();this.resize();}
 private visibility=()=>{this.metrics.reset();};
 private update(dt:number){
  if(!this.started||this.paused||this.hud.helpOpen()||this.raceUI.blocking||this.journalUI.open||this.photo.active)return;
  const previousState=this.flight.state,bank=this.flight.bank;
  if(previousState==='CRASHED')return;
  this.storm.update(dt,this.clock.current.nightness,this.weather.current.rain,this.camera);
  if(this.storm.state.strike)this.audio.thunder();
  const gust=this.storm.state.gust;
  // Keep the established time-trial conditions repeatable for saved ghosts.
  const wind=this.racing?0:marineWindSpeed(this.weather.current.wind,gust);
  this.flight.setWind(marineWindDirection.x*wind,marineWindDirection.z*wind);
  if(this.flight.state==='AIRBORNE')this.flight.bank+=Math.sin(this.flight.simulationTime*1.3)*gust*.025*dt;

  if(this.racing&&this.race.state==='COUNTDOWN')this.flight.moorAt(raceLaunch.x,raceLaunch.z,raceHeading);
  const raw=this.input.read(),controls=this.racing?this.raceControls.update(dt,raw,this.flight):raw;
  // Compare the same speed measure on either side of a physics tick. Sampling
  // once per render would produce false jolts on frames with no physics step.
  const wasFlying=previousState==='AIRBORNE',wasDescending=this.flight.velocity.y<0;
  const entrySpeed=wasFlying?this.flight.airspeed:this.flight.groundSpeed;
  this.flight.update(dt,(this.moored||this.racing&&this.race.state==='COUNTDOWN')?{pitch:0,roll:0,yaw:0,throttle:0}:controls);
  if(this.flight.position.z<northFlightLimit){
   const justReached=this.flight.previousPosition.z>northFlightLimit;
   this.flight.position.z=northFlightLimit;
   this.flight.velocity.z=Math.max(0,this.flight.velocity.z);
   if(justReached)this.hud.toast('已到达北部飞行边界 · 请向南折返');
  }
  if(this.world.collides(this.flight.previousPosition,this.flight.position)||this.pirateScene.blocks(this.flight.previousPosition,this.flight.position))this.flight.crash('与岛屿或建筑发生碰撞，请返回港口重新出发');
  const exitSpeed=wasFlying?this.flight.airspeed:this.flight.groundSpeed;
  const acceleration=(exitSpeed-entrySpeed)/dt;
  const tuning=this.flight.tuning;
  const speedWeight=T.MathUtils.smoothstep(exitSpeed,tuning.takeoffSpeed*.08,tuning.takeoffSpeed*.58);
  const push=T.MathUtils.smoothstep(acceleration/tuning.thrust,.035,.55);
  const target=previousState===this.flight.state||this.flight.state==='AIRBORNE'?push*speedWeight:0;
  this.accelerationBlur=T.MathUtils.damp(this.accelerationBlur,target,target>this.accelerationBlur?6:3,dt);
  const touchdown=previousState==='AIRBORNE'&&this.flight.state==='LANDING'?this.flight.lastTouchdown:undefined;
  const airborne=this.flight.state==='AIRBORNE';
  this.trialMeter?.update(dt,this.flight.position,airborne,airborne?this.flight.airspeed:this.flight.groundSpeed,touchdown?.sink??this.flight.velocity.y);
  if(touchdown){this.audio.touchdown(touchdown.impact,this.flight.groundSpeed,this.aircraft.id);if(!this.racing)this.hud.toast(this.journal.landing(touchdown.sink,bank),3000,true);}
  if(this.flight.state==='CRASHED'){
   const target=this.taskLandingTarget();
   const nearTarget=target&&this.flight.position.distanceTo(target.position)<1800;
   const lowApproach=nearTarget&&(previousState==='LANDING'||previousState==='ON_WATER'||wasFlying&&wasDescending&&this.flight.previousPosition.y<55);
   const missionRunning=!!this.journal.active||this.mission.state==='RUNNING';
   if(!this.racing&&missionRunning&&(this.flight.hardLanding||lowApproach)){
    this.recover(target,true);return;
   }
   this.audio.cue('crash');
   this.journal.interruptForRecovery();
   if(this.racing)this.race.fail();
   return;
  }
  if(this.racing){const crossedIndex=this.race.index,wasFinished=this.race.state==='COMPLETED';const changed=this.race.update(dt,this.flight.previousPosition,this.flight.position);this.raceField?.update(dt,this.flight,this.race,(a,b)=>this.world.collides(a,b));if(this.race.state==='RUNNING'||this.race.state==='COMPLETED'&&this.race.index===raceCourse.length-1&&this.raceField?.place===1)this.ghost?.record(this.race.elapsed,this.flight.position,this.flight.orientation,this.race.state==='COMPLETED',this.race.sectors);if(changed){this.raceVisual.pass(crossedIndex);this.audio.cue('checkpoint');}if(!wasFinished&&this.race.state==='COMPLETED'){this.journal.raceFinished(this.raceField?.place??3);this.fireworks.start(this.flight.position,this.flight.velocity,this.raceField?.finishFlight?.position);this.audio.cue('complete');}return;}
  if(this.journal.active)this.journal.assessment.sample(dt,this.flight.bank,this.flight.velocity.y,this.flight.airspeed*3.6,this.flight.state==='AIRBORNE');this.updateRescue(dt);const journalMessages=this.journal.update(dt,this.flight.position,this.flight.state==='AIRBORNE',this.moored?.id,(this.flight.state==='AIRBORNE'?this.flight.airspeed:this.flight.groundSpeed)*3.6,this.flight.bank,this.clock.current.nightness>.40,!this.spawnedMoored||!this.moored);if(journalMessages.length)this.hud.toast(journalMessages.join(' · '),this.journal.active?.id===airPirateJobId?8500:3000);this.journalUI.updateHint();if(this.journal.pendingSettlement)this.journalUI.showSettlement();
  const crossedIndex=this.mission.index;if(this.mission.update(dt,this.flight.previousPosition,this.flight.position)){this.route.pass(crossedIndex);this.audio.cue(this.mission.state==='COMPLETED'?'complete':'checkpoint');this.hud.toast(this.mission.state==='COMPLETED'?'环岛航线已完成！':`打卡完成 · 下一个：${this.mission.current?.name}`);}
 }
 private render(alpha:number,dt:number){
  if(document.hidden)return;
  if(this.journalUI.open){this.wasInMenu=true;this.menuRenderTime+=dt;if(this.menuRenderTime<.2)return;this.menuRenderTime=0;}else if(this.wasInMenu){this.wasInMenu=false;this.menuRenderTime=0;this.metrics.reset();}
  this.renderer.info.reset();
  const frozen=this.paused||this.hud.helpOpen()||this.raceUI.blocking||this.journalUI.open||this.photo.active;if(!frozen)this.elapsed+=dt;
  const interpolation=frozen||this.flight.state==='CRASHED'?1:alpha;this.model.root.position.lerpVectors(this.flight.previousPosition,this.flight.position,interpolation);this.model.root.quaternion.slerpQuaternions(this.flight.previousOrientation,this.flight.orientation,interpolation);
  if(!frozen){const input=this.input.read();this.model.update(dt,this.flight.throttle,input.roll,input.pitch,input.yaw,this.flight.airspeed,this.flight.state==='AIRBORNE',!!this.moored||this.flight.state==='CRASHED');this.world.update(dt,this.flight.position,this.flight.heading,this.flight.groundSpeed,this.started&&this.flight.state!=='AIRBORNE'&&this.flight.state!=='CRASHED',this.started?this.flight.simulationTime:undefined,this.flight.waterImpact,this.aircraft.id,this.flight);}

  if(this.photo.active)this.photo.update(dt,(x,z)=>this.world.heightAt(x,z));
  else if(this.started){this.chase.update(this.flight,dt,false,this.model.root,this.racing && this.race.state==='RUNNING');if(this.chase.view.id!=='cockpit')this.chase.keepAbove(this.world.heightAt(this.camera.position.x,this.camera.position.z)+5);}
  else if(this.fireworksPreview){const origin=raceCourse[raceCourse.length-1].position;this.camera.position.copy(origin).add(new T.Vector3(0,15,65));this.camera.lookAt(origin.x,origin.y+40,origin.z-240);this.overviewFocus.copy(origin);this.camera.fov=55;this.camera.updateProjectionMatrix();}
  else if(this.fleetStudy){const vessel=this.world.root.getObjectByName('Inter-island ferries / secret cove excluded')?.children[this.fleetIndex];if(vessel){this.camera.position.copy(vessel.position).add(new T.Vector3(36,24,-40).applyQuaternion(vessel.quaternion));this.camera.lookAt(vessel.position.clone().add(new T.Vector3(0,9,0)));this.overviewFocus.copy(vessel.position);this.camera.fov=43;this.camera.updateProjectionMatrix();}}
  else if(this.overviewIsland){const d=this.overviewIsland,s=Math.max(d.rx,d.rz);const street=this.streetView||this.churchView?this.world.streetView(d.id,this.churchView):undefined;const elevation=new URLSearchParams(location.search).get('elevation');if(new URLSearchParams(location.search).has('harbor')&&(d.id==='town'||d.id==='harbor')){if(d.id==='harbor')this.camera.position.set(d.x-d.rz*1.85,32,d.z+d.rx*.20);else{const p=townPoint(d,d.x-d.rx*.20,d.z+d.rz*1.85);this.camera.position.set(p.x,32,p.z);}this.camera.lookAt(d.x,Math.max(55,d.height*.32),d.z);}else if(d.id==='hotel'&&elevation){const cx=d.x,cz=d.z;this.camera.up.set(0,1,0);if(elevation==='front'){this.camera.position.set(cx+221,37,cz);this.camera.lookAt(cx+44,32,cz);}
   else if(elevation==='side'){this.camera.position.set(cx+6,48,cz-274);this.camera.lookAt(cx,29,cz);}
   else if(elevation==='rear'){this.camera.position.set(cx-194,95,cz+156);this.camera.lookAt(cx+5,24,cz);}
   else {this.camera.position.set(cx,259,cz+.01);this.camera.up.set(-1,0,0);this.camera.lookAt(cx,0,cz);}
  }else if(d.id==='hotel'){const p=hotelPoint(this.shorelineView?42:410,this.shorelineView?448:910);this.camera.position.set(p.x,this.shorelineView?19:210,p.z);this.camera.lookAt(d.x,32,d.z);
  }else if(d.id==='north-coast'){
   this.camera.position.set(d.x-(this.shorelineView?410:950),this.shorelineView?24:217,d.z+(this.shorelineView?1120:1940));
   this.camera.lookAt(d.x+155,20,d.z+258);
  }else if(this.shorelineView&&d.id==='lighthouse'){const pier=mooringSites.find(m=>m.id==='lighthouse')!;this.camera.position.set(pier.x+260*pier.dx,48,pier.z+260*pier.dz);this.camera.lookAt(d.x,terrainHeight(d,d.x,d.z)*.60,d.z);}else if(street){this.camera.position.copy(street.position);this.camera.lookAt(street.target);}else if(this.shorelineView&&d.id==='town'){const p=townPoint(d,d.x-20,d.z+d.rz*.85);this.camera.position.set(p.x,26,p.z);this.camera.lookAt(d.x,32,d.z);}else if(this.shorelineView&&d.id==='cove'){const p=covePoint(d,d.x+20,d.z+25),target=covePoint(d,d.x-50,d.z-170);this.camera.position.set(p.x,11,p.z);this.camera.lookAt(target.x,32,target.z);}else if(this.shorelineView){if(d.id==='harbor')this.camera.position.set(d.x-d.rz*.62,11,d.z+20);else this.camera.position.set(d.x+20,11,d.z+(d.id==='cove'?25:d.bay?-d.rz*.72:d.rz*1.12));this.camera.lookAt(d.x-50,32,d.z-(d.id==='cove'?170:d.rz*.10));}else if(d.id==='town'){const p=townPoint(d,d.x-190,d.z+1830);this.camera.position.set(p.x,480,p.z);this.camera.lookAt(d.x+40,54,d.z);}else{this.camera.position.set(d.x-s*1.65*(d.id==='town'?-1:1),d.height+s*1.30,d.z+s*1.95*(d.id==='town'?-1:1));this.camera.lookAt(d.x,d.height*.22,d.z);}this.camera.fov=this.streetView||this.churchView?53:this.shorelineView?58:43;this.camera.updateProjectionMatrix();if(street)this.overviewFocus.copy(street.target);else this.overviewFocus.set(d.x,d.height*.3,d.z);}
  else{const hotel=allLandforms.find(d=>d.id==='hotel')!;this.camera.position.set(hotel.x+390,42,hotel.z);this.camera.up.set(0,1,0);this.camera.lookAt(hotel.x,42,hotel.z+65);this.overviewFocus.set(hotel.x,35,hotel.z);this.camera.fov=43;this.camera.updateProjectionMatrix();}
  const landingTarget=this.taskLandingTarget(),landingDistance=landingTarget?this.flight.position.distanceTo(landingTarget.position):Infinity;
  this.taskLandingActive=!!landingTarget&&this.hud.landingAutoAllowed&&(this.flight.state==='AIRBORNE'?landingDistance<3000&&this.flight.altitude<350:landingDistance<1000);
  this.landingDirector.update(frozen?0:dt,this.flight,this.started&&(this.hud.landingVisible||this.taskLandingActive)&&!this.photo.active&&!document.body.classList.contains('hud-hidden'),(x,z)=>this.landingWaterClear(x,z),(x,z)=>this.world.ocean.heightAt(x,z),landingTarget);

  this.hud.get('landing-path').textContent=this.landingDirector.message;
  const trailAirborne=this.flight.state==='AIRBORNE';if(!frozen){if(this.trailVelocity&&trailAirborne&&dt>0&&dt<.1){const up=new T.Vector3(0,1,0).applyQuaternion(this.model.root.quaternion),force=this.flight.velocity.clone().sub(this.trailVelocity).multiplyScalar(1/dt).add(new T.Vector3(0,9.81,0)),load=Math.min(6,Math.abs(force.dot(up))/9.81);this.trailLoad+=(load-this.trailLoad)*(1-Math.exp(-dt*5));}else this.trailLoad=1;this.trailVelocity=this.flight.velocity.clone();}
  const moisture=Math.min(.99,(this.weather.target==='rain'?.96:this.weather.target==='fog'?.99:this.weather.target==='cloudy'?.79:.60)+this.weatherEffects.cloudImmersionAt(this.flight.position)*.35);
  this.wingtipTrails.update(frozen?0:dt,this.model.root,this.camera,this.aircraft.id,this.aircraft.span,this.condensation.update(frozen?0:dt,{id:this.aircraft.id,speed:this.flight.airspeed,liftSpeed:this.aircraft.tuning.liftSpeed,airborne:trailAirborne,loadFactor:this.trailLoad,moisture}));
  const compassForward=this.compassForward.set(0,0,-1).applyQuaternion(this.model.root.quaternion);const compassHeading=Math.hypot(compassForward.x,compassForward.z)>.08?-Math.atan2(compassForward.x,-compassForward.z):this.flight.heading;this.beacon.update(this.started?this.navigationTarget():undefined,this.camera,this.elapsed);this.hud.navigation(compassHeading,this.flight.position.x,this.flight.position.z,this.started?this.navigationTarget():undefined,this.flight.position.y);
  this.model.updateInstruments(frozen?0:dt,this.flight.airspeed,this.flight.altitude,this.chase.view.id==='cockpit');this.raceField?.render(interpolation,frozen?0:dt);this.world.updateView(this.camera.position,this.camera.fov);
  this.clock.update(dt,this.started&&!frozen);const clock=this.clock.current;this.renderer.toneMappingExposure+=(.98+clock.nightness*.045+clock.warm*.035-this.renderer.toneMappingExposure)*(1-Math.exp(-dt*(clock.day>.5?1.7:.88)));this.fxaa.uniforms.filmTime.value=this.elapsed;this.fxaa.uniforms.stormFlash.value=this.storm.state.flash;this.fxaa.uniforms.adriaticDay.value=clock.day;this.world.setTimeOfDay(frozen?0:dt,clock.nightness,clock.hour);this.pirateScene.update(this.elapsed,this.journal.pirateBoatVisible,this.journal.pirateWreckVisible,this.world.ocean.heightAt(pirateBoatPosition.x,pirateBoatPosition.z),clock.nightness);this.weather.update(dt,this.started&&!frozen,clock.hour,this.mission.state==='RUNNING'||!!this.journal.active&&this.aircraft.id==='m5');const weather=this.weather.current;this.daylight.setWeather(weather,clock);
  const celestialLight=this.daylight.celestialReflection;
  this.model.setNightness(clock.nightness,celestialLight,weather.rain);
  this.glare.setAtmosphere(clock.warm,clock.nightness,weather.rain,celestialLight);this.islandSurface.setNightness(clock.nightness);this.islandSurface.setWetness(weather.wetness);this.world.ocean.setWeather(weather.wind+this.storm.state.gust*.5,weather.rain,weather.sun*clock.day+.12*clock.nightness,weather.fogNear,weather.fogFar);this.world.updateWind(frozen?0:dt,marineWindSpeed(weather.wind,this.storm.state.gust));this.weatherEffects.update(frozen?0:dt,this.camera,weather.rain,weather.wind,this.weather.target,weather.fogFar,this.started?this.flight.velocity:undefined,this.chase.view.id==='overhead',this.storm.state.gust);this.daylight.setCloudLayout(this.weatherEffects.cloudLayout);
  // Cloud optical depth is integrated per view ray, preserving height and distance layers.
  this.weatherEffects.setLighting(this.daylight.sunDirection,this.daylight.sunColor,clock.day,weather.sun/3.6,clock);const lightFocus=this.started?this.flight.position:this.overviewFocus;this.daylight.update(lightFocus,this.camera,this.started&&!frozen,frozen?0:dt);this.world.ocean.setLighting(this.daylight.sunDirection,this.daylight.sunColor,this.daylight.fogColor,lightFocus,clock.day,clock.moonDirection,clock.solarDirection,this.daylight.moonIllumination);this.route.update(this.mission,this.elapsed);this.route.root.visible=false;this.raceVisual.update(this.race,this.elapsed);this.fireworks.update(frozen?0:dt,this.fireworksPreview?undefined:this.flight.position);if(this.fireworksPreview&&!this.fireworks.points.visible)this.previewFireworks();
  this.audio.hotelMusic(this.flight.position,this.flight.state!=='AIRBORNE'&&this.flight.state!=='CRASHED',frozen||!this.started||this.flight.state==='CRASHED');
  this.audio.ambience(frozen||!this.started?0:dt,this.flight.position,!!this.moored);
  this.audio.update(this.flight.throttle,this.flight.airspeed,this.flight.state!=='AIRBORNE',frozen||!this.started||this.flight.state==='CRASHED',weather.rain,weather.wind+this.storm.state.gust*.8,this.aircraft.id,this.installed.some(p=>p.kind==='engine')?1.09:this.installed.some(p=>p.kind==='propeller')?.95:1,!!this.moored,{rpm:this.model.rotor.angularSpeed*60/(Math.PI*2),cockpit:this.chase.view.id==='cockpit',groundSpeed:this.flight.groundSpeed,planing:this.flight.planing});
  if(this.ghost&&this.started&&this.model.assetStatus.includes('GLB')){this.ghost.attach(this.model.root,this.scene);this.ghost.show(this.race.elapsed,this.race.state==='RUNNING');}

  const lensActive=this.started&&!frozen&&!this.moored&&this.flight.state!=='CRASHED'
   &&this.chase.view.id!=='overhead'&&(!this.racing||this.raceControls.motionBlur);
  if(!lensActive)this.accelerationBlur=0;
  const raceSpeed=this.racing?T.MathUtils.smoothstep(this.flight.airspeed,35,120):0;
  this.fxaa.uniforms.flightMotion.value=lensActive?Math.max(this.accelerationBlur,raceSpeed):0;
  this.renderScene(dt);this.metrics.frame(performance.now());

  this.hudTime+=dt;if(this.hudTime>.1){const metrics=this.metrics.snapshot;if(this.autoQuality&&!frozen&&this.started){const next=this.resolution.update(this.hudTime,metrics.mean,metrics.samples);if(next!==undefined){this.setRenderScale(next);this.cloudPass.setResolution(qualityPresets[this.qualityId].cloudScale*Math.min(1,next/.85));this.resize();this.metrics.reset();}}this.hudTime=0;this.hud.update(this.flight,this.mission,this.paused,this.started,!this.racing&&(!!this.journal.active||this.mission.state==='RUNNING'));this.hud.landing(this.flight,this.world.landingWaterAt(this.flight.position,this.flight.groundTrack,this.flight.groundSpeed),this.started,this.taskLandingActive);this.hud.weather(this.weather.target,this.weather.automatic);this.hud.clock(clock,this.clock.automatic,this.clock.selection);const berth=this.world.moorings.nearest(this.flight.position);this.hud.docking(berth.name,Math.hypot(this.flight.position.x-berth.berth.x,this.flight.position.z-berth.berth.z),this.flight.state!=='AIRBORNE'&&this.flight.state!=='CRASHED',this.flight.groundSpeed,!!this.moored);this.hud.get('viewport').dataset.hour=clock.hour.toFixed(3);this.hud.get('viewport').dataset.timeOfDay=clock.phase;this.hud.get('viewport').dataset.stars=this.daylight.starStrength.toFixed(3);this.hud.get('viewport').dataset.nightLights=JSON.stringify(this.world.lightStatus);this.hud.get('viewport').dataset.weather=this.weather.target;this.hud.get('viewport').dataset.rain=weather.rain.toFixed(3);if(this.overviewIsland&&!this.started)this.hud.get('location').textContent=`${this.overviewIsland.name} · 地形预览`;this.hud.get('viewport').dataset.fps=metrics.fps.toFixed(1);this.hud.get('viewport').dataset.frameMean=metrics.mean.toFixed(2);this.hud.get('viewport').dataset.frameP95=metrics.p95.toFixed(2);this.hud.get('viewport').dataset.frameMax=metrics.max.toFixed(2);this.hud.get('viewport').dataset.frameHitches=String(metrics.hitches);this.hud.get('viewport').dataset.frameSamples=String(metrics.samples);this.hud.get('viewport').dataset.quality=this.qualityId;this.hud.get('viewport').dataset.renderScale=this.renderScale.toFixed(3);this.hud.get('performance-readout').textContent=metrics.samples?`${this.autoQuality?'自动 · '+qualityPresets[this.qualityId].name+' · ':''}${metrics.fps.toFixed(0)} FPS · 平均 ${metrics.mean.toFixed(1)} ms · P95 ${metrics.p95.toFixed(1)} ms`:'正在采样帧时间…';this.hud.get('viewport').dataset.drawCalls=String(this.renderer.info.render.calls);this.hud.get('viewport').dataset.triangles=String(this.renderer.info.render.triangles);this.hud.get('viewport').dataset.model=this.model.assetStatus;this.hud.get('viewport').dataset.aircraft=this.aircraft.id;this.hud.get('viewport').dataset.camera=this.chase.view.id;this.hud.rpm(this.model.rotor.angularSpeed*60/(Math.PI*2));this.hud.get('viewport').dataset.propellerRpm=String(Math.round(this.model.rotor.angularSpeed*60/(Math.PI*2)));this.hud.get('viewport').dataset.bank=this.flight.bank.toFixed(4);this.hud.get('viewport').dataset.maneuver=this.flight.maneuver??'none';this.hud.get('viewport').dataset.environment=this.world.assetStatus;
   if(this.racing&&this.started){this.raceUI.update(this.race,this.aircraft.id,()=>this.resetRace(),this.ghost,this.raceControls,this.flight,this.raceField,this.fireworks.celebrating,this.journal.lastSettlement);this.hud.setRaceMap(raceCourse,this.race.index);this.hud.get('reset').innerHTML='重新比赛 <kbd>R</kbd>';this.hud.get('viewport').dataset.race=this.race.state;this.hud.get('viewport').dataset.raceLap=String(this.race.lap);}
  }
 }
 private taskLandingTarget():LandingDestination|undefined{
  const job=this.journal.activeJob,active=this.journal.active,stage=this.journal.storyStage;
  if(this.racing||!job||!active||this.journal.storyRequest==='accepted')return;
  if(stage?.kind==='rescue'||job.id==='rescue'&&!active.observed)return{name:'求救渔船 · 静止接人',position:this.rescuePosition().clone(),rescue:true};
  if(stage?.kind==='crew')return{name:'蓝帆船 · 船侧会合点',position:pirateBoatStop,outward:new T.Vector3(0,0,1),crew:true};
  if(stage&&stage.kind!=='dock')return;
  if(!stage&&(!active.observed||this.journal.scenicStop))return;
  const site=mooringSites.find(s=>s.id===(stage?.island??job.to));
  if(!site)return;
  return{name:site.name,position:site.berth.clone(),outward:new T.Vector3(site.dx,0,site.dz)};
 }
 private navigationTarget():NavigationTarget|undefined{
  if(this.flight.state==='CRASHED')return;
  if(this.landingDirector.navigationPoint)return{...this.landingDirector.navigationPoint,kind:'commission'};
  if(this.racing){const target=this.race.current;return target?this.race.recovering?{name:'返回进门侧',position:target.position.clone().addScaledVector(target.normal,-350),kind:'race'}:{...target,kind:'race'}:undefined;}
  if(this.mission.current)return{...this.mission.current,kind:'mission'};
  const active=this.journal.active,c=this.journal.jobs.find(c=>c.id===active?.id);
  if(!active||!c)return;
  if(this.journal.storyStage?.kind==='rescue')return{name:'求救渔船 · 静止接人',position:this.rescuePosition(),kind:'commission'};if(this.journal.scenicStop)return{...this.journal.scenicStop,kind:'commission'};
  if(c.id==='rescue'&&!active.observed)return{name:'求救渔船',position:this.rescuePosition(),kind:'commission'};
  const island=allLandforms.find(i=>i.id===c.via);
  if(island&&!active.observed)return{name:'外海观察点',position:{x:island.x+island.rx+350,y:120,z:island.z},kind:'commission'};
  const site=mooringSites.find(i=>i.id===c.to)!;return{name:site.name,position:site.berth,kind:'commission'};
 }
 private preserveSceneDepth(pass:OutputPass|ShaderPass){
  // TAAU reads the original depth after these colour-only passes recycle the composer buffers.
  pass.material.depthWrite=false;pass.material.depthTest=false;
  const render=pass.render.bind(pass);
  pass.render=(renderer,write,read,deltaTime,maskActive)=>{
   const clearDepth=renderer.autoClearDepth;
   renderer.autoClearDepth=false;
   try{render(renderer,write,read,deltaTime,maskActive);}finally{renderer.autoClearDepth=clearDepth;}
  };
 }
 private setRenderScale(scale:number){this.renderScale=this.antiAliasing==='taau'?Math.min(.85,scale):scale;this.renderer.setPixelRatio(this.antiAliasing==='taau'?1:this.renderScale);}
 private renderScene(dt:number){const render=()=>this.composer.render(dt);if(this.temporal)this.temporal.withJitter(render);else render();}
 private resize=()=>{this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);const ratio=this.renderScale;this.composer.setPixelRatio(ratio);this.composer.setSize(innerWidth,innerHeight);this.temporal?.setOutputSize(this.renderer.domElement.width,this.renderer.domElement.height);this.fxaa.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));};
 dispose(){this.journal.resetFlight();this.photo.dispose();this.journalUI.dispose();this.disposed=true;this.loop.stop();this.input.dispose();this.cockpitLook.dispose();document.removeEventListener('visibilitychange',this.visibility);this.audio.dispose();window.removeEventListener('resize',this.resize);this.scene.remove(this.model.root);this.model.dispose();this.scene.remove(this.beacon.root);this.beacon.dispose();this.landingDirector.dispose();this.wingtipTrails.dispose();this.scene.traverse(obj=>{if(obj instanceof T.Points&&obj.material instanceof T.PointsMaterial){obj.material.map?.dispose();obj.geometry.dispose();obj.material.dispose();}if(obj instanceof T.Mesh){obj.geometry.dispose();for(const m of Array.isArray(obj.material)?obj.material:[obj.material])m.dispose();}});this.storm.dispose();this.raceField?.dispose();this.ghost?.dispose();this.fireworks.dispose();this.raceUI.offer.remove();this.weatherEffects.dispose();this.world.ocean.dispose();this.islandSurface.dispose();this.daylight.dispose();for(const pass of this.composer.passes)pass.dispose();this.composer.dispose();this.renderer.dispose();}
}
