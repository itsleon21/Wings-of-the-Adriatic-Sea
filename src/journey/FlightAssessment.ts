import type {Role} from '../upgrades/Workshop.ts';
export interface Settlement{title:string;role:Role;base:number;bonus:number;total:number;score:number;reputation:number;reason:string;criteria:string[];balance:number}
export class FlightAssessment{
 seconds=0;roughSeconds=0;landingScore:number|undefined;dockingScore:number|undefined;rescueApproach=0;
 reset(){this.seconds=0;this.roughSeconds=0;this.landingScore=undefined;this.dockingScore=undefined;this.rescueApproach=0;}
 sample(dt:number,bank:number,sink:number,kmh:number,airborne:boolean){if(!airborne||!Number.isFinite(dt)||dt<=0||dt>.2)return;this.seconds+=dt;if(Math.abs(bank)>.38||Math.abs(sink)>3.5||kmh>160)this.roughSeconds+=dt;}
 landing(sink:number,bank:number){this.landingScore=Math.round(Math.max(0,100-Math.max(0,sink-.65)*18-Math.abs(bank)*70));}
 docking(speed:number,distance:number){this.dockingScore=Math.round(Math.max(0,100-speed*8-Math.max(0,distance-10)));}
 result(role:Role,place=0){let score=0,reason='';if(role==='tourism'){const comfort=this.seconds>0?Math.max(0,100*(1-this.roughSeconds/this.seconds)):0;score=Math.round(comfort*.65+(this.landingScore??0)*.20+(this.dockingScore??0)*.15);reason=`平稳飞行 ${Math.round(comfort)} · 着水 ${this.landingScore??0} · 靠泊 ${this.dockingScore??0}`;}else if(role==='rescue'){score=Math.round((this.landingScore??50)*.6+(this.dockingScore??Math.max(0,100-this.rescueApproach*5))*.4);reason=`着水 ${this.landingScore??50} · ${this.dockingScore===undefined?'接近控制':'靠泊'} ${this.dockingScore??Math.max(0,100-this.rescueApproach*5)}`;}else{score=place===0?Math.round((this.landingScore??50)*.6+(this.dockingScore??50)*.4):place===1?100:place===2?70:45;reason=place===0?'航空委托 · 着水与靠泊表现':`竞赛名次 ${place} · 完成比赛`;}
 const common=[
 '着水分：100 − max(0，着水下降速度 − 0.65) × 18 − |坡度弧度| × 70，最低0分。速度单位m/s；1°坡度约扣1.22分。',
 '靠泊分：100 − 靠泊速度 × 8 − max(0，距泊位距离 − 10)，最低0分。速度单位m/s，距离单位m。'
 ];
 const criteria=role==='tourism'?[
 '总分＝平稳飞行分×65%＋着水分×20%＋靠泊分×15%，最后四舍五入。',
 '平稳飞行分＝100×（1−不平稳飞行秒数÷总空中秒数）。坡度超过21.8°、升降速度绝对值超过3.5m/s或空速超过160km/h，任一条件成立即计为不平稳；同时触发只计一次。',
 ...common,'未记录空中飞行、着水或靠泊时，该项目按0分计算。'
 ]:role==='rescue'?[
 '总分＝着水分×60%＋接近控制／靠泊分×40%，最后四舍五入。',...common,
 '船旁救援的接近控制分＝100−危险接近累计秒数×5（最低0）。距船100m内且速度超过5m/s（18km/h）时累计危险接近；若任务含靠泊，则改用靠泊分。',
 '未记录着水时，着水项目按中性50分计算。救援仍须在35m内、速度≤约2km/h静止5秒。'
 ]:place===0?['航空委托总分＝着水分×60%＋靠泊分×40%，最后四舍五入。',...common,'未记录着水或靠泊时，该项目按中性50分计算。']:['竞赛评分按实际名次：第1名100分，第2名70分，第3名45分。'];
 criteria.push('表现奖金＝总分四舍五入至最近的10，发放0–100航空币；基础酬金250币。声望基础+10，总分≥85时为+15。');
 return {score,criteria,bonus:Math.round(score/10)*10,reputation:10+(score>=85?5:0),reason};}
}
export const reputationContracts=[
 {id:'veteran-rescue',aircraft:'redwing',from:'harbor',to:'lighthouse',title:'资深委托 · 灯塔急件',detail:'救援声望30解锁。穿过松林巡护点，将紧急补给送至灯塔。',stops:[{island:'pine',name:'巡护站确认',altitude:140}],limit:420},
 {id:'veteran-tourism',aircraft:'m5',from:'hotel',to:'hotel',title:'贵宾委托 · 双岛观光',detail:'观光声望30解锁。平稳游览珊瑚岛与海岸小镇后返回酒店。',stops:[{island:'coral',name:'珊瑚观景',altitude:120,maxKmh:145},{island:'town',name:'小镇观景',altitude:160,maxKmh:145}]},
 {id:'veteran-racing',aircraft:'mc72',from:'coral',to:'lighthouse',title:'竞速委托 · 海上冲刺',detail:'竞速声望30解锁。通过高速检查点后前往灯塔靠泊。',stops:[{island:'coral',name:'加速检查',altitude:160,minKmh:300},{island:'lighthouse',name:'冲刺检查',altitude:190,minKmh:300}],limit:240}
];
