import {readTrial} from './TrialTelemetry';
import {PartViewer} from './PartViewer';
import {parts,applyParts} from './Workshop';
import type {Workshop} from './Workshop';
import {aircraftCatalog} from '../aircraft/AircraftCatalog';
export class WorkshopPanel{
 private viewer?:PartViewer;private aircraft:string;private selected='';private host:HTMLElement;private workshop:Workshop;
 constructor(host:HTMLElement,workshop:Workshop,aircraft:string){this.host=host;this.workshop=workshop;this.aircraft=['redwing','m5','mc72'].includes(aircraft)?aircraft:'redwing';this.render();}
 private render(){
  this.viewer?.dispose();const w=this.workshop,plane=aircraftCatalog.find(p=>p.id===this.aircraft)!,available=parts.filter(p=>p.aircraft===this.aircraft),p=available.find(p=>p.id===this.selected)??available[0];this.selected=p.id;
  this.host.innerHTML=`<section class="workbench"><header class="workbench-wallet"><div><small>AERO CLUB / ENGINEERING</small><h2>机库 · 改装工坊</h2></div><div><b>${w.credits}</b> 航空币<small>救援 ${w.reputation.rescue} · 观光 ${w.reputation.tourism} · 竞速 ${w.reputation.racing}</small></div></header><nav class="workbench-aircraft" aria-label="工坊机型">${aircraftCatalog.map(a=>`<button data-plane="${a.id}" aria-pressed="${a.id===plane.id}">${a.name}</button>`).join('')}</nav><div class="workbench-body"><section class="workbench-stage"><div class="workshop-canvas" aria-label="${p.name}旋转模型"></div><div class="workshop-controls"><button data-action="reset">复位视角</button><button data-action="motion">暂停动效</button><span>拖动旋转 · 滚轮缩放</span></div><h3>${p.name}</h3><p>${p.effect}</p><p class="workbench-provenance">${plane.id==='redwing'?'架空机型 · 时代风格结构设计':plane.id==='m5'?'参考：V.4B直列六缸、推式木桨与木质艇身。':'参考：AS.6串联双V12、同轴对转桨及表面散热器。'} 部件为参考结构模型，尚未完成尺寸级历史还原；性能为游戏调校。</p><div class="workbench-actions"></div><div class="workbench-comparison"></div></section><section class="workbench-parts" aria-label="部件与改装槽"></section></div><footer class="workbench-footer">已购部件永久免费换装。每槽只能安装一种方案；新配置在重新出发时生效。试飞不保存任务进度或收益。</footer></section>`;
  this.host.querySelectorAll<HTMLButtonElement>('[data-plane]').forEach(b=>b.onclick=()=>{this.aircraft=b.dataset.plane!;this.selected='';this.render();});
  this.viewer=new PartViewer(this.host.querySelector('.workshop-canvas')!,p);this.host.querySelector<HTMLButtonElement>('[data-action="reset"]')!.onclick=()=>this.viewer?.reset();this.host.querySelector<HTMLButtonElement>('[data-action="motion"]')!.onclick=e=>{if(!this.viewer)return;this.viewer.running=!this.viewer.running;(e.currentTarget as HTMLElement).textContent=this.viewer.running?'暂停动效':'播放动效';};
  const list=this.host.querySelector('.workbench-parts')!;
  for(const [slot,title] of [['power','01 / 动力'],['structure','02 / 结构与散热'],['water','03 / 水面起降']]){const group=document.createElement('section');group.innerHTML=`<h3>${title}</h3>`;for(const part of available.filter(x=>x.slot===slot)){const button=document.createElement('button');button.className='workbench-part';button.setAttribute('aria-pressed',String(part.id===p.id));const owned=w.owned.includes(part.id),installed=w.equipped[part.aircraft+':'+slot]===part.id;button.innerHTML=`<strong>${part.name}</strong><small>${part.effect}</small><span>${installed?'已装配':owned?'已拥有':part.cost+' 航空币'}</span>`;button.onclick=()=>{this.selected=part.id;this.render();};group.append(button);}list.append(group);}
  const actions=this.host.querySelector('.workbench-actions')!,owned=w.owned.includes(p.id),key=p.aircraft+':'+p.slot,installed=w.equipped[key]===p.id;
  const buy=document.createElement('button');buy.textContent=owned?'已拥有':w.credits<p.cost?`还需 ${p.cost-w.credits} 航空币`:`购买 · ${p.cost} 航空币`;buy.disabled=owned||w.credits<p.cost;buy.onclick=()=>{w.buy(p.id);this.render();};
  const equip=document.createElement('button');equip.textContent=installed?'卸下部件':'免费装配';equip.disabled=!owned;equip.onclick=()=>{if(installed){delete w.equipped[key];w.save();}else w.equip(p.id);this.render();};actions.append(buy,equip);
  for(const [text,query] of [['试飞此方案','trial='+p.id],['试飞基础配置','trial=stock&configuration=stock'],['试飞已装配置','trial=installed&configuration=modified']]){const a=document.createElement('a');a.textContent=text;a.href=`./?aircraft=${plane.id}&launch=1&berth=harbor&time=noon&weather=sunny&${query}`;actions.append(a);}
  const equipped=available.filter(p=>w.equipped[p.aircraft+':'+p.slot]===p.id),preview=[...equipped.filter(x=>x.slot!==p.slot),p],tuned=applyParts(plane.tuning,preview),base=plane.tuning;
  const current=applyParts(base,equipped);
  const stats:[string,keyof typeof base,string,boolean][]=[
   ['推力','thrust','',true],['阻力系数','drag','',false],['姿态响应','attitudeResponse','',true],
   ['起飞空速','takeoffSpeed','km/h',false],['极速上限','maxSpeed','km/h',true],
   ['水面阻力','waterDrag','',false],['安全着水下降率','safeLandingSink','m/s',true]];
  const comparison=this.host.querySelector('.workbench-comparison')!;
  comparison.innerHTML='<small>基础 / 目前装配 / 所选方案（含其他已装槽）</small><dl>'+stats.map(([name,key,unit,higher])=>{
   const factor=unit==='km/h'?3.6:1,a=Number(base[key])*factor,b=Number(current[key])*factor,c=Number(tuned[key])*factor;
   const delta=(c/b-1)*100,improves=higher?delta>0:delta<0;
   const digits=a<.01?5:a<10?2:0;
   return '<div><dt>'+name+'</dt><dd>'+a.toFixed(digits)+' / '+b.toFixed(digits)+' / <b>'+c.toFixed(digits)+'</b> '+unit+
    (Math.abs(delta)>.01?' <span style="color:'+(improves?'#276249':'#95532d')+'">'+(delta>0?'+':'')+delta.toFixed(1)+'%</span>':'')+'</dd></div>';
  }).join('')+'</dl>';
  const baseline=readTrial(plane.id,'stock'),candidate=readTrial(plane.id,preview.map(x=>x.id).sort().join('+'));
  const results=document.createElement('section');
  const format=(value:number|undefined,unit:string)=>value===undefined?'待实测':value.toFixed(1)+' '+unit;
  results.innerHTML='<h3>最近同场试飞记录</h3><p>晴天正午 · 基地栈桥出发。先试飞基础配置，再试飞此方案；测量会保存在本机。相同的油门和操纵方式便于比较。</p><dl>'+
   [['起飞距离',baseline?.takeoff?.distance,candidate?.takeoff?.distance,'m'],['起飞时间',baseline?.takeoff?.seconds,candidate?.takeoff?.seconds,'s'],['到100米用时',baseline?.climb,candidate?.climb,'s'],['实测最高空速',baseline?.maximum,candidate?.maximum,'km/h']].map(row=>'<div><dt>'+row[0]+'</dt><dd>'+format(row[1] as number|undefined,String(row[3]))+' → '+format(row[2] as number|undefined,String(row[3]))+'</dd></div>').join('')+'</dl>';
  comparison.append(results);

 }
 dispose(){this.viewer?.dispose();this.viewer=undefined;}
}
