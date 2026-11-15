import {coveCampSite} from '../world/CoveCamp.ts';
import {landingProfile} from '../aircraft/LandingGuidance.ts';
import {resolveAircraftId} from '../aircraft/AircraftCatalog.ts';
import {mooringSites} from '../world/Moorings.ts';
import {storyJobs,storyJob,storyStepTarget} from './StoryMissions.ts';
import {FlightAssessment,reputationContracts} from './FlightAssessment.ts';
import type {Settlement} from './FlightAssessment.ts';
import type {Role} from '../upgrades/Workshop.ts';
import {Workshop} from '../upgrades/Workshop.ts';
import {aircraftJobs,jobWaypoint} from './AircraftJobs.ts';
import type {AviationJob} from './AircraftJobs.ts';
import {islands as coreIslands,hotelIsland} from '../world/WorldConfig.ts';
const islands=[...coreIslands,hotelIsland];
export const islandStories:Record<string,{role:string;souvenir:string}>={hotel:{role:'临海酒店 · 花园观光',souvenir:'花园酒店纪念章'},harbor:{role:'补给港 · 邮航起点',souvenir:'港湾船锚章'},town:{role:'风车磨坊 · 邮递与观光',souvenir:'风车小镇纪念章'},lighthouse:{role:'灯塔高地 · 导航训练',souvenir:'守灯人徽记'},pine:{role:'松林巡护站 · 补给运输',souvenir:'松枝巡护章'},coral:{role:'珊瑚浅海 · 纪念赛场',souvenir:'珊瑚航标章'},cove:{role:'隐秘海湾 · 探索发现',souvenir:'海蚀拱门章'}};
export const commissions=[
 {id:'hotel-arrival',from:'harbor',to:'hotel',title:'花园酒店的留声机',detail:'从港口飞往花园酒店岛，在栈桥外海平稳着水，减速至18 km/h以下，按 F 靠泊。着水停靠后可听到酒店留声机播放的音乐。'},
 {id:'post',from:'harbor',to:'town',title:'跨海邮袋',detail:'首次邮航练习。按 F 解缆，离开栈桥后加速起飞，循罗盘飞往小镇。进入进近阶段后若坠机，可选重飞再次练习。'},
 {id:'return-post',from:'town',to:'harbor',title:'给基地的回信',detail:'邮务员把回执交给你。带回基地完成第二段邮航，积攒首次改装的酬金。'},
 {id:'tour',from:'town',to:'lighthouse',title:'钟楼到灯塔',detail:'带访客沿海飞往灯塔岛，完成观光后靠泊灯塔栈桥。'},
 {id:'navigation',from:'lighthouse',to:'harbor',via:'lighthouse',title:'守灯人的导航课',detail:'先飞过灯塔岛外海观察点（海拔60–250米），再返回港口靠泊。'},
 {id:'supplies',from:'pine',to:'harbor',title:'松林巡护回执',detail:'从巡护站带回巡林记录，靠泊港口交给补给员。'},
 {id:'survey',from:'coral',to:'pine',via:'coral',title:'浅海观察笔记',detail:'低空经过珊瑚岛外海观察点（海拔60–250米），把记录送到松林巡护站。'},

];
export interface MailProgress {phase:'departure'|'cruise'|'approach';event:'unseen'|'offered'|'accepted'|'declined'|'completed'}
export interface JournalSave {version:1;discoveries?:string[];mail?:Record<string,MailProgress>;storyProgress?:Record<string,number>;visited:string[];docked:string[];completed:string[];entries:string[];airSeconds:number;distance:number;photos:number;raceWinner:boolean;livery:'original'|'azure'|'ivory'}
const empty=():JournalSave=>({version:1,visited:[],docked:[],completed:[],entries:[],airSeconds:0,distance:0,photos:0,raceWinner:false,livery:'original'});
export class FlightJournal {
 readonly workshop:Workshop;readonly assessment=new FlightAssessment();pendingSettlement?:Settlement;lastSettlement?:Settlement;
 private settle(title:string,role:Role,place=0){const r=this.assessment.result(role,place);this.workshop.reward(role,r.bonus,r.reputation);this.lastSettlement=this.pendingSettlement={title,role,base:250,total:250+r.bonus,...r,balance:this.workshop.credits};}
 reputationNeeded(id:string){return id.startsWith('veteran-')?30:0;}
 reputationRole(id:string):Role{return id.endsWith('tourism')?'tourism':id.endsWith('racing')?'racing':'rescue';}
 isRevealed(id:string){return id!=='secret'||this.data.discoveries?.includes('cove-logbook')===true||this.data.completed.includes('secret');}
 get guidedMail(){return this.active?.id==='post'||this.active?.id==='return-post';}
 get mailProgress(){return this.guidedMail?this.data.mail?.[this.active!.id]:undefined;}
 get mailDestination(){return this.guidedMail?mooringSites.find(s=>s.id===this.activeJob?.to):undefined;}
 get mailPhotoTarget(){const town=islands.find(i=>i.id==='town')!;return {name:'小镇海岸明信片 · 80–220米',position:{x:town.x+town.rx+320,y:150,z:town.z}};}
 chooseMailEvent(accept:boolean){
  if(this.mailProgress?.event!=='offered'&&!(this.mailProgress?.event==='accepted'&&!accept))return;
  this.mailProgress.event=accept?'accepted':'declined';
  this.note(accept?'邮务员：沿罗盘去海岸取景，80–220米平稳掠过即可。':'邮务员：先把邮袋送到，照片下次再拍。');
 }
 mailHint='';
 mailApproach=false;
 private steadyPhotoSeconds=0;
 aircraft='redwing';
 get story(){return this.active?storyJob(this.active.id):undefined;}
 get storyStage(){return this.story?.steps[this.stopIndex];}
 get storyIndex(){return this.stopIndex;}
 get nextStory(){return storyJobs.find(j=>j.aircraft===this.aircraft&&!this.data.completed.includes(j.id)&&(!j.previous||this.data.completed.includes(j.previous)));}
 storyLocked(id:string){const j=storyJob(id);return !!j?.previous&&!this.data.completed.includes(j.previous);}
 canBoard(id:string,berth?:string){const j=storyJob(id);return !!berth&&((['post','return-post'].includes(id)&&!!this.data.mail?.[id])||berth===this.jobs.find(c=>c.id===id)?.from||!!j&&(this.data.storyProgress?.[id]??0)>0);}
 private advanceStory(){const j=this.story;if(!j)return;const completed=j.steps[this.stopIndex];this.stopIndex++;this.data.storyProgress??={};this.data.storyProgress[j.id]=this.stopIndex;this.note('故事进展 · '+completed.title+' · '+completed.message);if(this.stopIndex>=j.steps.length){if(!this.data.completed.includes(j.id)){this.data.completed.push(j.id);this.settle(j.title,this.aircraft==='m5'?'tourism':this.aircraft==='mc72'?'racing':'rescue');}this.active=undefined;this.note('章节完成 · '+j.title);}this.persist();}
 private stopIndex=0;
 private scenicStops=['coral','lighthouse','town','cove','pine','harbor'].map(id=>{const d=islands.find(i=>i.id===id)!;return {name:d.name,position:{x:d.x+d.rx+120,y:150,z:d.z}};});
 get activeJob(){return this.jobs.find(c=>c.id===this.active?.id);}
 get scenicStop(){if(this.active?.id==='hotel-scenic'&&this.tourRequest==='accepted')return this.tourPhotoTarget;if(this.mailProgress?.event==='accepted')return this.mailPhotoTarget;if(this.storyStage)return storyStepTarget(this.storyStage);const c=this.activeJob;return c?.stops?.[this.stopIndex]?jobWaypoint(c.stops[this.stopIndex]):this.active?.id==='passengers'?this.scenicStops[this.stopIndex]:undefined;}
 get stepCount(){if(this.story)return this.story.steps.length;return this.activeJob?.stops?.length??6;}
 get rescueRemaining(){return Math.max(0,5-this.rescueSeconds);}
 private rescueSeconds=0;private jobSeconds=0;
 get taskHint(){if(this.active?.id==='hotel-scenic'){
 const comfort=this.assessment.seconds?Math.round(100*(1-this.assessment.roughSeconds/this.assessment.seconds)):100;
 return ' · 乘客平稳度 '+comfort+'%'+(this.tourRequest==='accepted'?' · 取景 '+this.tourPhotoSeconds.toFixed(1)+'/3秒 · 80–160米、≤145km/h、坡度≤8°':' · 轻柔转弯，保持低速观光');
 }if(this.guidedMail)return ' · '+this.mailHint;if(this.storyStage){const s=this.storyStage;return ` · 阶段 ${this.stopIndex+1}/${this.stepCount} · ${s.message}`+(s.minKmh?' · 至少'+s.minKmh+' km/h':'')+(s.maxKmh?' · 不超过'+s.maxKmh+' km/h':'');}const c=this.activeJob,step=c?.stops?.[this.stopIndex];return (this.aircraft==='m5'&&this.active?' · 乘客平稳度 '+Math.round(this.assessment.seconds>0?100*(1-this.assessment.roughSeconds/this.assessment.seconds):100)+'% · 避免急转与超速 ':'')+(step?[(step.minKmh?'至少'+step.minKmh+' km/h':''),(step.maxKmh?'不超过'+step.maxKmh+' km/h':'')].filter(Boolean).join(' · '):'')+(c?.limit?' · 空中剩余 '+Math.ceil(Math.max(0,c.limit-this.jobSeconds))+' 秒':'');}
 rescueUpdate(dt:number,onWater:boolean,speed:number,distance:number){if(this.active?.id!=='rescue'&&this.storyStage?.kind!=='rescue')return false;if(!Number.isFinite(dt)||dt<=0||dt>.2)return false;if(distance<100&&speed>5)this.assessment.rescueApproach+=dt;this.rescueSeconds=onWater&&speed<=.55&&distance<=35?this.rescueSeconds+dt:0;if(this.rescueSeconds<5-1e-7)return false;if(this.storyStage?.kind==='rescue'){this.advanceStory();this.rescueSeconds=0;return true;}return this.pickup();}
 allowed(id:string){if(!this.isRevealed(id))return false;if(id==='return-post'&&!this.data.completed.includes('post'))return false;if(this.storyLocked(id))return false;if(this.workshop.reputation[this.reputationRole(id)]<this.reputationNeeded(id))return false;const c=this.jobs.find(c=>c.id===id);if(c?.aircraft)return c.aircraft===this.aircraft;return id==='rescue'?this.aircraft==='redwing':id==='passengers'?this.aircraft==='m5':true;}
 docking(speed:number,distance:number){this.assessment.docking(speed,distance);const grade=speed<2&&distance<15?'精准靠泊':speed<3.5?'平稳靠泊':'安全靠泊';const text=grade+' · '+Math.round(speed*3.6)+' km/h · 距泊位 '+Math.round(distance)+' m';this.note(text);return text;}
 private charter=this.drawCharter();
 private drawCharter(previous?:string){const ports=islands.filter(i=>i.id!=='hotel'&&i.id!==previous&&i.id!=='cove');const dest=ports[Math.floor(Math.random()*ports.length)];return {id:'charter',from:'hotel',to:dest.id,title:'酒店水上出租机',detail:'接上旅客，飞往'+dest.name+'栈桥。交付后酒店将收到新的预约。'};}
 tourRequest:'unseen'|'offered'|'accepted'|'declined'|'completed'='unseen';
 tourPhotoSeconds=0;
 get tourPhotoTarget(){return {name:'酒店留影 · 80–160米，平飞3秒',position:{x:hotelIsland.x+hotelIsland.rx+230,y:110,z:hotelIsland.z+100}};}
 chooseTourRequest(accept:boolean){
  if(this.tourRequest!=='offered'&&!(this.tourRequest==='accepted'&&!accept))return;
  this.tourRequest=accept?'accepted':'declined';this.tourPhotoSeconds=0;
  this.note(accept?'乘客：谢谢！想从海上拍下酒店，请按罗盘去取景。':'乘客：好的，按原航线返回酒店。');
 }
 readonly jobs:AviationJob[]=[{id:'hotel-scenic',aircraft:'m5',from:'hotel',to:'hotel',title:'酒店晨风观光',detail:'在花园酒店接客，低速飞临珊瑚浅海，再返回酒店。乘客可能提出取景请求，可接受或跳过；保持平稳能获得更高评价。',stops:[{island:'coral',name:'珊瑚浅海观景',altitude:120,maxKmh:145},{island:'hotel',name:'酒店返航观景',altitude:110,maxKmh:145}]}, ...commissions,...storyJobs,...aircraftJobs,...reputationContracts,this.charter,{id:'passengers',from:'hotel',to:'hotel',title:'群岛观光包机',detail:'在酒店栈桥迎接旅客，依罗盘游览六岛。海拔40–350米飞近各观景点，最后返回酒店送客。'},{id:'rescue',from:'harbor',to:'harbor',title:'外海救援电报',detail:'按罗盘指向前往灯塔岛附近失去动力的渔船。循闪烁三角标记，着水后在船旁35米内静止5秒即可完成救援（速度不超过2 km/h）。'}];
 pickup(){if(this.active?.id!=='rescue')return false;if(!this.data.completed.includes('rescue'))this.data.completed.push('rescue');this.settle('外海救援电报','rescue');this.active=undefined;this.note('救援完成 · 灯塔外海船员已安全接回');return true;}
 landing(sink:number,bank:number){this.assessment.landing(sink,bank);const angle=Math.abs(bank)*180/Math.PI;const grade=sink<1&&angle<4?'轻柔着水':sink<2&&angle<8?'平稳着水':'着水成功';const text=grade+' · 下沉 '+sink.toFixed(1)+' m/s · 坡度 '+Math.round(angle)+'°';this.note(text);return text;}
 data=empty();active?:{id:string;observed:boolean};private saveTime=0;private previous?:{x:number;z:number};private storage?:Pick<Storage,'getItem'|'setItem'>;
 constructor(storage?:Pick<Storage,'getItem'|'setItem'>){this.workshop=new Workshop(storage);try{this.storage=storage??globalThis.localStorage;const v=JSON.parse(this.storage?.getItem('adriatic.journal.v1')??'null');if(v?.version===1){this.data.discoveries=Array.isArray(v.discoveries)&&v.discoveries.includes('cove-logbook')?['cove-logbook']:[];this.data.mail={};for(const id of ['post','return-post']){const m=v.mail?.[id];if(m&&['departure','cruise','approach'].includes(m.phase)&&['unseen','offered','accepted','declined','completed'].includes(m.event))this.data.mail[id]={phase:m.phase,event:m.event};}this.data.storyProgress={};for(const j of storyJobs){const n=v.storyProgress?.[j.id];if(Number.isInteger(n)&&n>=0&&n<j.steps.length)this.data.storyProgress[j.id]=n;}const ids=islands.map(d=>d.id);for(const key of ['visited','docked','completed'] as const)this.data[key]=Array.isArray(v[key])?[...new Set<string>(v[key].filter((s:unknown)=>typeof s==='string'&&(key==='completed'?this.jobs.map(c=>c.id):ids).includes(s)))]:[];this.data.entries=Array.isArray(v.entries)?v.entries.filter((s:unknown)=>typeof s==='string'&&s.length<180).slice(-40):[];for(const key of ['airSeconds','distance','photos'] as const)this.data[key]=Number.isFinite(v[key])?Math.max(0,Math.min(1e8,v[key])):0;this.data.raceWinner=v.raceWinner===true;this.data.livery=v.livery==='azure'||v.livery==='ivory'?v.livery:'original';if(!this.unlocked(this.data.livery))this.data.livery='original';}}catch{}}
 persist(){try{this.storage?.setItem('adriatic.journal.v1',JSON.stringify(this.data));}catch{}}
 private note(text:string){this.data.entries.push(new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date())+' · '+text);this.data.entries=this.data.entries.slice(-40);this.persist();}
 unlocked(id:string){return id==='original'||id==='azure'&&this.data.visited.length>=3||id==='ivory'&&(this.data.completed.length>=2||this.data.raceWinner);}
 selectLivery(id:string){if(!this.unlocked(id)||!['original','azure','ivory'].includes(id))return false;this.data.livery=id as JournalSave['livery'];this.persist();return true;}
 accept(id:string,berth?:string){const c=this.jobs.find(c=>c.id===id);if(!this.allowed(id)||!c||this.active||!this.canBoard(id,berth)||(!['passengers','charter','hotel-scenic'].includes(id)&&this.data.completed.includes(id)))return false;this.tourRequest='unseen';this.tourPhotoSeconds=0;this.mailHint='按 F 解缆，离开栈桥后加速起飞';this.mailApproach=false;this.assessment.reset();this.steadyPhotoSeconds=0;this.stopIndex=storyJob(id)?this.data.storyProgress?.[id]??0:0;this.rescueSeconds=0;this.jobSeconds=0;if(['post','return-post'].includes(id)){this.data.mail??={};this.data.mail[id]??={phase:'departure',event:'unseen'};this.mailApproach=this.data.mail[id].phase==='approach';}this.active={id,observed:!c.stops?.length&&id!=='passengers'&&!c.via&&id!=='rescue'};this.note('接取委托 · '+c.title);return true;}
 cancel(){if(this.active){this.note('取消委托 · '+this.jobs.find(c=>c.id===this.active!.id)!.title);this.active=undefined;}}
 resetFlight(){this.previous=undefined;this.cancel();this.persist();}
 update(dt:number,p:{x:number;y:number;z:number},airborne:boolean,berth?:string,speedKmh=0,bank=0){
  if(!Number.isFinite(dt)||dt<=0||dt>.2||![p.x,p.y,p.z].every(Number.isFinite))return [];
  this.saveTime+=dt;if(this.saveTime>=30){this.saveTime=0;this.persist();}
  const messages:string[]=[];
  if(!this.isRevealed('secret')&&p.y<80&&Math.hypot(p.x-coveCampSite.x,p.z-coveCampSite.z)<180){
   this.data.discoveries??=[];this.data.discoveries.push('cove-logbook');const text='发现隐藏委托 · 营地桌上的航海日志 · 靠泊隐湾后按 J 查看共享任务';this.note(text);messages.push(text);this.persist();
  }
  if(airborne){this.data.airSeconds+=dt;if(this.previous){const d=Math.hypot(p.x-this.previous.x,p.z-this.previous.z);if(d<200)this.data.distance+=d;}}this.previous={x:p.x,z:p.z};
  for(const island of islands){if(p.y<450&&Math.hypot((p.x-island.x)/island.rx,(p.z-island.z)/island.rz)<1.25&&!this.data.visited.includes(island.id)){this.data.visited.push(island.id);const text='发现 · '+island.name;this.note(text);messages.push(text);}}
  if(berth&&islandStories[berth]&&!this.data.docked.includes(berth)){this.data.docked.push(berth);if(!this.data.visited.includes(berth))this.data.visited.push(berth);this.note('靠泊纪念 · '+islandStories[berth].souvenir);messages.push('获得 '+islandStories[berth].souvenir);}
  if(this.guidedMail){
   const progress=this.mailProgress!,destination=this.mailDestination!;
   const distance=Math.hypot(p.x-destination.berth.x,p.z-destination.berth.z);
   const before=progress.phase+progress.event;
   if(airborne&&p.y>25&&progress.phase==='departure')progress.phase='cruise';
   if(this.active!.id==='post'&&airborne&&progress.event==='unseen'&&distance<2400)progress.event='offered';
   if(progress.event==='accepted'){
    const target=this.mailPhotoTarget.position;
    if(airborne&&p.y>=80&&p.y<=220&&Math.abs(bank)<.18&&Math.hypot(p.x-target.x,p.z-target.z)<260){
     progress.event='completed';this.photo();messages.push('明信片已拍摄 · 邮务员：谢谢！现在去小镇栈桥交付。');
    }
   }
   if(airborne&&distance<1400&&progress.event!=='accepted')progress.phase='approach';
   this.mailApproach=progress.phase==='approach';
   const profile=landingProfile(resolveAircraftId('?aircraft='+this.aircraft,null));
   this.mailHint=progress.event==='accepted'?'支线取景 · 80–220米，机翼放平，接近金色航标':progress.phase==='departure'?'阶段1/4 · F解缆，轻加油驶离栈桥；Shift加速，达到起飞速度后抬头':progress.phase==='cruise'?'阶段2/4 · 循罗盘巡航，建议海拔120–250米':airborne?'阶段3/4 · 开阔水面进近，空速 '+profile.minKmh+'–'+profile.maxKmh+' km/h；接水前下降率≤'+profile.maxTouchdownSink+' m/s':'阶段4/4 · 收油滑行，35米内且低于18 km/h按F靠泊';
   if(before!==progress.phase+progress.event)this.persist();
  }
  const job=this.activeJob;if(job&&airborne)this.jobSeconds+=dt;
  if(job?.limit&&this.jobSeconds>job.limit){this.note('任务超时 · '+job.title);this.active=undefined;messages.push('任务超时 · 可回出发栈桥重新接取');return messages;}
  if(this.storyStage){const s=this.storyStage,target=this.scenicStop!;let passed=false;
   if(s.kind==='takeoff')passed=airborne&&p.y>=30;
   else if(s.kind==='dock')passed=!airborne&&berth===s.island;
   else if(s.kind==='flyover')passed=airborne&&Math.abs(p.y-(s.altitude??150))<65&&speedKmh>=(s.minKmh??0)&&speedKmh<=(s.maxKmh??Infinity)&&Math.hypot(p.x-target.position.x,p.z-target.position.z)<240;
   if(s.photoSeconds){
    this.steadyPhotoSeconds=passed&&Math.abs(bank)<=Math.PI/18?this.steadyPhotoSeconds+dt:0;
    passed=this.steadyPhotoSeconds>=s.photoSeconds-1e-7;
    if(passed){this.photo();this.steadyPhotoSeconds=0;}
   }
   if(passed){const title=s.title;this.advanceStory();messages.push('故事进展 · '+title+(this.active?' · '+this.storyStage?.title:' · 本章完成'));}return messages;
  }
  if(this.active?.id==='hotel-scenic'){
   if(this.stopIndex>=1&&this.tourRequest==='unseen')this.tourRequest='offered';
   if(this.tourRequest==='accepted'){
    const target=this.tourPhotoTarget.position;
    const steady=airborne&&p.y>=80&&p.y<=160&&speedKmh<=145&&Math.abs(bank)<=8*Math.PI/180&&Math.hypot(p.x-target.x,p.z-target.z)<260;
    this.tourPhotoSeconds=steady?this.tourPhotoSeconds+dt:0;
    if(this.tourPhotoSeconds>=3-1e-7){this.tourRequest='completed';this.photo();messages.push('乘客：拍到了！谢谢你的平稳驾驶，现在回酒店吧。');}
    else return messages;
   }
  }
  const stop=this.scenicStop,step=job?.stops?.[this.stopIndex];
  const altitudeOK=step?Math.abs(p.y-stop!.position.y)<75:p.y>=40&&p.y<=350;
  if(!this.guidedMail&&stop&&airborne&&altitudeOK&&speedKmh>=(step?.minKmh??0)&&speedKmh<=(step?.maxKmh??Infinity)&&Math.hypot(p.x-stop.position.x,p.z-stop.position.z)<260){this.stopIndex++;messages.push('航程打卡 · '+stop.name+' '+this.stopIndex+'/'+this.stepCount);if(!this.scenicStop)this.active!.observed=true;}
  const c=this.jobs.find(c=>c.id===this.active?.id);if(c&&this.active){const target=c.via?islands.find(d=>d.id===c.via):undefined;if(target&&p.y>=60&&p.y<=250&&Math.hypot(p.x-target.x-target.rx-350,p.z-target.z)<220){this.active.observed=true;}if(berth===c.to&&this.active.observed){if(!this.data.completed.includes(c.id))this.data.completed.push(c.id);if(c.id==='charter'){this.charter=this.drawCharter(c.to);this.jobs[this.jobs.indexOf(c)]=this.charter;}this.settle(c.title,this.aircraft==='m5'?'tourism':this.aircraft==='mc72'?'racing':'rescue');this.active=undefined;this.note('完成委托 · '+c.title);messages.push('委托完成 · '+c.title);}}
  return messages;
 }
 photo(){this.data.photos++;this.note('摄影留念 · 第'+this.data.photos+'张');}
 raceFinished(place:number){this.settle('施耐德纪念赛','racing',place);if(place===1)this.raceWon();}
 raceWon(){if(!this.data.raceWinner){this.data.raceWinner=true;this.note('施耐德纪念赛 · 首次完赛');}}
}
