import {harborOuterShore,harborRelief} from './HarborRelief.ts';
export interface IslandDefinition { id:string; name:string; x:number; z:number; rx:number; rz:number; height:number; seed:number; bay:boolean; canonical?:boolean }
const islandTemplates:IslandDefinition[] = [
 {id:'harbor',name:'港口基地',x:3300,z:450,rx:472.5,rz:405,height:145,seed:13,bay:true},
 {id:'town',name:'风车小镇',x:400,z:-2600,rx:864*Math.sqrt(.8),rz:585*Math.sqrt(.8),height:126,seed:37,bay:true},
 {id:'lighthouse',name:'灯塔岛',x:3000,z:120,rx:310*Math.sqrt(.6),rz:350*Math.sqrt(.6),height:130,seed:63,bay:false},
 {id:'cove',name:'隐秘海湾',x:-2900,z:-2500,rx:400,rz:300,height:120,seed:81,bay:true},
 {id:'pine',name:'松林岛',x:-250,z:4000,rx:365,rz:319,height:92,seed:107,bay:false},
 {id:'coral',name:'珊瑚群岛',x:3200,z:3800,rx:450,rz:370,height:24,seed:151,bay:false},
];
/** Fixed sea seed gives reproducible, irregular spacing while preserving the harbour runway. */
export function createArchipelago(seed:number):IslandDefinition[]{
 // Keep the published chart stable when refining an island's footprint.
 if(seed===8033){const centres=[[3300,450],[-2700,-1400],[136,-1645],[-2225,3800],[3006,2905],[-4230,860]];return islandTemplates.map((d,i)=>({...d,x:centres[i][0],z:centres[i][1]}));}
 const rng=random(seed);
 for(let restart=0;restart<200;restart++){
  const result=[{...islandTemplates[0]}];let failed=false;
  // Place an interior island first, then sample the entire sea with unequal clear-water gaps.
  const order=[islandTemplates[4],...islandTemplates.slice(1).filter(d=>d.id!=='pine')];
  for(const template of order){let placed=false;
   for(let attempt=0;attempt<1000;attempt++){
    const interior=template.id==='pine',x=Math.round(interior?-600+rng()*2000:-5100+rng()*10200),z=Math.round(interior?-700+rng()*1800:-5100+rng()*10200),radius=Math.max(template.rx,template.rz)*1.12;
    if(Math.abs(x)+radius>5750||Math.abs(z)+radius>5750)continue;
    const gap=template.id==='coral'?1450:1700;
    if(result.some(other=>Math.hypot(x-other.x,z-other.z)-radius-Math.max(other.rx,other.rz)*1.12<gap))continue;
    // Keep the base's departure water runway clear of unrelated islands.
    if(x>-2500&&x<-1000&&Math.abs(z-2010)<700+radius)continue;
    result.push({...template,x,z});placed=true;break;
   }if(!placed){failed=true;break;}
  }if(!failed)return islandTemplates.map(t=>result.find(d=>d.id===t.id)!);
 }throw new Error('无法生成安全的群岛布局');
}
export const SeaSeed=8033;
export const islands=createArchipelago(SeaSeed);
const coralIsland=islands.find(d=>d.id==='coral')!;
const townIsland=islands.find(d=>d.id==='town')!;
/** Hotel architecture is authored facing +Z and rotated to face east. */
export const hotelScale=Math.SQRT1_2*2/3;
export const hotelWidthScale=.72;
export const hotelArchitectureWidth=.86;
// Keep the pier at its established waterline. Above it, the tall sea wall
// supports two main storeys, the roof and a shorter clock lantern.
export const hotelElevation=(y:number)=>y<=6?y*21/27:y<=27?6*21/27+(y-6)*(34-6*21/27)/21:34+(y-27)*.90;
export const hotelPlan:readonly (readonly [number,number])[]=[
 [-88,-190],[86,-190],[100,-149],[118,-105],[105,-62],[112,-31],[125,0],[125,166],[101,190],
 [-101,190],[-125,166],[-125,14],[-113,-8],[-113,-43],[-98,-58],[-105,-111]
];
// Narrow the garden end into a headland while keeping the quay and villa frontage fixed.
export function hotelGardenX(x:number,z:number){
 const t=Math.max(0,Math.min(1,(-z-52)/138));
 return x*(1-.35*t)+14*t;
}
export const hotelOutline=hotelPlan.map(([x,z])=>[hotelGardenX(x*hotelWidthScale,z),z] as const);
export function insideHotel(x:number,z:number){let inside=false;for(let i=0,j=hotelOutline.length-1;i<hotelOutline.length;j=i++){
 const [ax,az]=hotelOutline[i],[bx,bz]=hotelOutline[j];if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
}return inside;}
export const hotelIsland:IslandDefinition={id:'hotel',name:'花园酒店岛',x:townIsland.x,z:coralIsland.z-800,rx:125*hotelScale*hotelWidthScale,rz:190*hotelScale,height:hotelElevation(27)*hotelScale,seed:719,bay:false};
export function hotelPoint(x:number,z:number){return{x:hotelIsland.x+z*hotelScale,z:hotelIsland.z-x*hotelScale};}
// Mainland continues past the northern chart edge.
export const northCoast:IslandDefinition={id:'north-coast',name:'北境海岸',x:1660,z:-6050,rx:8100,rz:760,height:88,seed:907,bay:false};
export const allLandforms=[...islands,hotelIsland,northCoast];

export const northFlightLimit=-6570;
export const northTerrainSeam=northCoast.z-northCoast.rz*1.125;
// Authored west-to-east cross-sections: landfall offset, shelf width and cliff height.
const northSections=[
 [-7600,255,110,7],[-5900,390,51,29],[-4840,181,102,13],[-4420,119,144,5],
 [-3650,298,30,37],[-2800,432,28,49],[-2240,275,67,26],[-1530,214,125,10],
 [-870,312,62,21],[-210,431,24,36],[440,330,44,38],[810,198,78,17],
 [1160,60,125,6],[1570,1,149,5],[1940,96,101,16],[2280,262,44,37],
 [2600,425,17,54],[3010,341,36,43],[3530,228,69,20],[4120,148,122,6],
 [4780,176,121,8],[5450,383,53,33],[6480,314,92,19],[8400,180,132,8],[11000,245,81,23],
] as const;
function northProfile(x:number){
 let low=0,high=northSections.length-1;
 while(high-low>1){const mid=(low+high)>>1;if(x<northSections[mid][0])high=mid;else low=mid;}
 const a=northSections[low],b=northSections[high],t=smooth(a[0],b[0],x);
 return {shore:a[1]+(b[1]-a[1])*t,beach:a[2]+(b[2]-a[2])*t,cliff:a[3]+(b[3]-a[3])*t};
}
export function northShoreOffset(x:number){return northProfile(x).shore;}

// Individual asymmetric massifs, separated by scooped-out valleys. Coordinates
// and orientations are independent of the shoreline stations and of each other.
const northMassifs=[
 [-5300,-7790,1680,970,.23,151],[-3030,-7050,1120,670,-.62,171],
 [-895,-8380,1730,1260,.39,124],[750,-7480,1040,800,-.46,161],
 [2590,-7370,1270,640,.51,147],[4320,-8750,2020,1410,-.12,168],
 [5750,-7570,1020,790,.63,112],[-3000,-10500,2600,1700,-.21,148],
 [1700,-11100,3000,1650,.29,156],[5800,-12600,2200,1900,-.44,184],
].map(([cx,cz,w,l,yaw,peak])=>({cx,cz,w,l,c:Math.cos(yaw),s:Math.sin(yaw),peak}));
const northValleys=[
 [-1650,-6900,300,1050,.48,24],[1470,-6910,310,920,-.32,40],
 [3750,-7300,430,1210,.56,33],
].map(([cx,cz,w,l,yaw,depth])=>({cx,cz,w,l,c:Math.cos(yaw),s:Math.sin(yaw),depth}));
function landformDistance(x:number,z:number,f:{cx:number;cz:number;w:number;l:number;c:number;s:number}){
 const dx=x-f.cx,dz=z-f.cz;
 const along=(dx*f.c+dz*f.s)/f.w;
 const across=(-dx*f.s+dz*f.c)/f.l;
 return Math.hypot(along,across*(across>0?1.25:.87));
}
export function northCoastHeight(x:number,z:number){
 const v=z-northCoast.z;
 if(v>820||Math.abs(x-northCoast.x)>northCoast.rx*1.125)return -30;
 const {shore,beach,cliff}=northProfile(x),inland=shore-v;
 const shelf=4*smooth(-9,beach,inland);
 const rockFace=cliff*smooth(beach,beach+30+beach*.43,inland);
 let mountain=0,cut=0;
 if(inland>110){
  for(const f of northMassifs)mountain=Math.max(mountain,f.peak*(1-smooth(.04,1.50,landformDistance(x,z,f))));
  for(const f of northValleys)cut=Math.max(cut,f.depth*(1-smooth(0,1.2,landformDistance(x,z,f))));
 }
 const foothills=Math.max(6,14+mountain*.29-cut*.26)*smooth(100,570,inland);
 return Math.min(northCoast.height,-27+27*smooth(-123,-8,inland)+shelf+rockFace+foothills);
}
/** Chart coverage, in meters. The sea remains open beyond the chart. */
export const WorldBounds=Object.freeze({minX:-6000,maxX:6000,minZ:-6000,maxZ:6000,size:12000});
export const harbor=islands[0];
// The base is authored facing +Z. Rotate its shore and facilities a quarter turn west.
const canonicalHarbors=new WeakMap<IslandDefinition,IslandDefinition>();
function canonicalHarbor(d:IslandDefinition){
 let local=canonicalHarbors.get(d);
 if(!local){local={...d,canonical:true};canonicalHarbors.set(d,local);}
 return local;
}
export function harborPoint(d:IslandDefinition,x:number,z:number){return{x:d.x-(z-d.z),z:d.z+(x-d.x)};}
export function harborLocal(d:IslandDefinition,x:number,z:number){return{x:d.x+(z-d.z),z:d.z-(x-d.x)};}
// The town was authored facing south. Its harbour now faces northeast.
export const townYaw=3*Math.PI/4;
const townCos=Math.cos(townYaw),townSin=Math.sin(townYaw);
export function townDirection(x:number,z:number){return{x:townCos*x+townSin*z,z:townCos*z-townSin*x};}
export function townPoint(d:IslandDefinition,x:number,z:number){const p=townDirection(x-d.x,z-d.z);return{x:d.x+p.x,z:d.z+p.z};}
export function townLocal(d:IslandDefinition,x:number,z:number){
 const dx=x-d.x,dz=z-d.z;
 return{x:d.x+townCos*dx-townSin*dz,z:d.z+townCos*dz+townSin*dx};
}
export function terrainRadii(d:IslandDefinition){
 if(d.id==='harbor'||d.id==='hotel'||d.id==='cove'&&!d.canonical)return {rx:d.rz,rz:d.rx};
 if(d.id==='town'&&!d.canonical){
  return {rx:Math.hypot(d.rx*townCos,d.rz*townSin)*1.1,rz:Math.hypot(d.rx*townSin,d.rz*townCos)*1.1};
 }
 return {rx:d.rx,rz:d.rz};
}
export const harborRunway=Object.freeze({x:harbor.x-510,z:harbor.z,dx:0,dz:1,heading:Math.PI,length:950,width:190});
export function onHarborRunway(distance:number){return{x:harborRunway.x+distance*harborRunway.dx,z:harborRunway.z+distance*harborRunway.dz};}
export const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function pineGrove(x:number,z:number){
 const west=Math.exp(-(((x+171)/122)**2+((z+64)/136)**2));
 const north=Math.exp(-(((x-34)/151)**2+((z+169)/80)**2));
 const east=Math.exp(-(((x-157)/119)**2+((z-95)/101)**2));
 const margins=.13*Math.sin(x*.043+z*.018)+.10*Math.cos(z*.062-x*.027);
 return smooth(.13,.75,Math.max(west,north,east)+margins);
}
export const terrainSegments=(d:IslandDefinition)=>d.id==='north-coast'?360:192;
/** Three separate dry cays share one continuous seabed, so rendering and collision agree. */
export const coralIslets=[{x:-.39,z:-.19,rx:.39,rz:.39,peak:24},{x:.40,z:-.25,rx:.34,rz:.34,peak:18},{x:.06,z:.49,rx:.34,rz:.29,peak:12}] as const;
export const coralReefLinks=[[0,1],[0,2],[1,2]] as const;
export function coralBedHeight(d:IslandDefinition,x:number,z:number){
 const u=(x-d.x)/d.rx,v=(z-d.z)/d.rz;let h=-30;
 for(const [i,c] of coralIslets.entries()){
  const a=Math.atan2((v-c.z)/c.rz,(u-c.x)/c.rx),r=Math.hypot((u-c.x)/c.rx,(v-c.z)/c.rz)/(1+.055*Math.sin(a*5+i*2)+.025*Math.cos(a*9));
  const sand=-7+12*(1-smooth(.60,1.15,r)),dune=-7+(c.peak+7)*Math.exp(-r*r*5.4);
  h=Math.max(h,Math.min(sand+Math.max(0,dune-5),-30+58*(1-smooth(1.09,1.48,r))));
 }
 for(const [a,b] of coralReefLinks){const p=coralIslets[a],q=coralIslets[b],dx=(q.x-p.x)*d.rx,dz=(q.z-p.z)*d.rz,ox=x-d.x-p.x*d.rx,oz=z-d.z-p.z*d.rz,t=Math.max(0,Math.min(1,(ox*dx+oz*dz)/(dx*dx+dz*dz))),distance=Math.hypot(ox-t*dx,oz-t*dz);h=Math.max(h,-1.5-4.5*smooth(7,29,distance)-24*smooth(30,68,distance));}
 return Math.min(d.height,h);
}
export const bayProfile=(d:IslandDefinition)=>d.id==='town'?{offset:.72,rx:.52,rz:.27}:{offset:.62,rx:.43,rz:.48};
/** Meter-scale distance from the sheltered bay shore, positive towards the land. */
export function harborInlandDistance(d:IslandDefinition,x:number,z:number){
 if(d.id==='harbor'&&!d.canonical){const p=harborLocal(d,x,z);return harborInlandDistance(canonicalHarbor(d),p.x,p.z);}
 if(d.id==='town'&&!d.canonical){const p=townLocal(d,x,z);return harborInlandDistance(canonicalHarbor(d),p.x,p.z);}
 const bay=bayProfile(d),dx=x-d.x,dz=z-d.z-d.rz*bay.offset,r=Math.hypot(dx,dz),a=Math.atan2(dz,dx);
 const shore=1/Math.hypot(Math.cos(a)/(d.rx*bay.rx),Math.sin(a)/(d.rz*bay.rz));
 return r-shore;
}
/** Broad low waterfront, town terraces, then wooded uplands. All transitions are gentle ramps. */
export function harborTerraceHeight(inland:number){
 return -9+9*smooth(-38,0,inland)+4.5*smooth(0,18,inland)
  +11.5*smooth(48,108,inland)+18*smooth(138,208,inland)
  +24*smooth(235,315,inland)+32*smooth(350,440,inland)+24*smooth(475,575,inland);
}
/** Reference island: an enclosed lagoon, southern beach outlet and eastern sea cave. */
export function covePoint(d:IslandDefinition,x:number,z:number){return{x:d.x+z-d.z,z:d.z-(x-d.x)};}
export function coveLocal(d:IslandDefinition,x:number,z:number){return{x:d.x-(z-d.z),z:d.z+x-d.x};}
export const coveCave=Object.freeze({minX:220,maxX:365,z:-55,halfWidth:52});
export function coveRoofBottom(z:number,x=290){
 const t=(z-coveCave.z)/coveCave.halfWidth,shaped=t+.10*Math.sin(Math.PI*t),envelope=Math.max(0,1-t*t);
 return -7+68*Math.sqrt(Math.max(0,1-shaped*shaped))+envelope*(4*Math.sin(z*.12+x*.041)+3*Math.cos(z*.21-x*.033));
}
export function coveLandHeight(d:IslandDefinition,x:number,z:number){
 const lx=x-d.x,lz=z-d.z,angle=Math.atan2((lz-25)/.8,lx);
 const ripple=22*Math.sin(angle*3+.8)+13*Math.sin(angle*7)+6*Math.sin(angle*13);
 const r=Math.hypot(lx,(lz-25)/.79),shore=174+ripple;
 const inland=r-shore;
 // The beach is broad and low; successive limestone shelves rise behind it.
 const north=1-smooth(-160,150,lz);
 const shelf=12*Math.sin(angle*4+.7)+8*Math.cos(angle*9);
 let h=-8+8*smooth(-46,0,inland)+4*smooth(0,26,inland)
  +(18+17*north)*smooth(36+shelf,61+shelf,inland)
  +(15+19*north)*smooth(83-shelf,108-shelf,inland)
  +(15+23*north)*smooth(130+shelf,159+shelf,inland);
 h+=smooth(28,100,inland)*(7*Math.sin(lx*.039+lz*.015)+5*Math.cos(lz*.043)+4*Math.sin(lx*.08)*Math.cos(lz*.065));
 const outer=Math.hypot(lx/(d.rx*(1+.065*Math.sin(angle*5)+.03*Math.sin(angle*11))),lz/(d.rz*(1+.065*Math.cos(angle*7))));
 h=Math.min(h, -30+(1-smooth(.84,1.025,outer))*158);
 // A gently sloping sand spit frames a water outlet towards the foreground.
 const mouth=(1-smooth(58,104,Math.abs(lx-35)))*smooth(108,205,lz);
 return Math.min(h,-9+(1-mouth)*150);
}
export function terrainHeight(d:IslandDefinition,x:number,z:number) {
 if(d.id==='harbor'&&!d.canonical){const p=harborLocal(d,x,z);return terrainHeight(canonicalHarbor(d),p.x,p.z);}
 if(d.id==='hotel')return insideHotel((d.z-z)/hotelScale,(x-d.x)/hotelScale)?d.height:-25;
 if(d.id==='town'&&!d.canonical){const p=townLocal(d,x,z);return terrainHeight(canonicalHarbor(d),p.x,p.z);}
 if(d.id==='north-coast')return northCoastHeight(x,z);
 if(d.id==='coral')return coralBedHeight(d,x,z);

 if(d.id==='cove'){
  const p=d.canonical?{x,z}:coveLocal(d,x,z),lx=p.x-d.x,lz=p.z-d.z;
  const h=coveLandHeight(d,p.x,p.z);
  // The roof is a separate solid mesh: a height field cannot represent an overhang.
  if(lx>150&&Math.abs(lz-coveCave.z)<coveCave.halfWidth)return Math.min(h,-8);
  return h;
 }
 const lx=x-d.x,lz=z-d.z, angle=Math.atan2(lz/d.rz,lx/d.rx);
 // The town is a broad, lopsided headland; the base retains its compact horseshoe.
 const coast=d.id==='town'?Math.max(.80,Math.min(1.08,1+.14*Math.cos(angle-.25)+.085*Math.sin(angle*3-.8)-.045*Math.cos(angle*5))):d.id==='lighthouse'?1+.14*Math.cos(angle-.9)+.09*Math.sin(2*angle+.65)+.047*Math.cos(5*angle-.45):d.id==='pine'?1+.09*Math.cos(angle+.65)+.055*Math.sin(angle*3-.7)+.035*Math.sin(angle*7):1+0.065*Math.sin(angle*5+d.seed)+0.04*Math.cos(angle*9+d.seed);
 const r=Math.hypot(lx/d.rx,lz/d.rz)/coast;
 if(r>1.08)return -30;
 const nx=lx/d.rx,nz=lz/d.rz;
 const gaussian=(cx:number,cz:number,sx:number,sz:number)=>Math.exp(-(((nx-cx)/sx)**2+((nz-cz)/sz)**2));
 let h:number;
 if(d.id==='lighthouse'){
  // A single broad summit falls through rocky shoulders to a low landing shelf.
  const taper=1-smooth(.77,1.035,r);
  const summit=d.height-22*smooth(.045,.28,r)-42*smooth(.18,.68,r)-54*smooth(.46,.98,r);
  const shoulders=(23*gaussian(-.53,.21,.26,.33)+18*gaussian(.30,-.48,.29,.24)-15*gaussian(.39,.37,.28,.23))*smooth(.13,.42,r);
  const cliffs=(5*Math.sin(lx*.049+lz*.028)+3*Math.cos(lz*.061-lx*.014))*smooth(.49,.72,r)*(1-smooth(.79,.98,r));
  h=-24+(24+Math.min(summit+shoulders+cliffs,d.height-12*smooth(.045,.19,r)))*taper;
 }else if(d.id==='pine'){
  const ridges=70*gaussian(-.33,-.22,.41,.57)+57*gaussian(.38,.04,.35,.49)+29*gaussian(.05,-.62,.52,.29);
  const valley=15*gaussian(.03,.39,.20,.56);
  const folds=(5*Math.sin(lx*.021+lz*.018)+3.4*Math.cos(lz*.031-lx*.012))*(1-smooth(.72,.99,r));
  const shoreline=1-smooth(.70,1.06,r);
  h=-23+shoreline*(34+ridges-valley+folds);
 }else{
  const north=1-smooth(-.75,.25,nz),ridge=6*Math.sin(lx*.018)+4*Math.cos(lz*.027+lx*.009);
  const high=(d.id==='town'?216:d.height)*(.48+.38*north)+ridge+28*gaussian(.08,-.63,.28,.23);
  h=-12+(1-smooth(.76,1.035,r))*(high+12);
  const inland=harborInlandDistance(d,x,z);
  const town=d.id==='town';
  const terraces=town?(-9+13.5*smooth(-38,18,inland)+13*smooth(78,150,inland)+20*smooth(220,320,inland)+34*smooth(390,510,inland)+28*smooth(560,700,inland)):harborTerraceHeight(inland);
  h=Math.min(h,terraces);
  if(!town)h+=54*gaussian(-.43,-.64,.20,.26)*smooth(155,270,inland);
  else h+=102*gaussian(-.46,-.52,.43,.25)*smooth(260,410,inland)+95*gaussian(.38,-.62,.34,.23)*smooth(350,490,inland);
 }
 if(d.id==='town'){
  // Preserve the landing beach; compress the high terraces to the reference skyline.
  if(h>40)h=40+(h-40)*.55;
  const mouth=(1-smooth(.22,.36,Math.abs(nx)))*smooth(.73,.82,nz);
  h=Math.min(h,-9+(1-mouth)*(d.height+9));
 }
 if(d.id==='harbor'){
  h+=harborRelief(lx,lz,h,r);
  h=harborOuterShore(lx,lz,r,h,harborInlandDistance(d,x,z));
  // The full marked 190 m water runway stays clear, including the irregular eastern shore.
  const channel=(1-smooth(95,125,Math.abs(lz-510)))*smooth(-160,-100,lx)*(1-smooth(900,1100,lx));
  h=Math.min(h,-7+(1-channel)*d.height);
 }
 return Math.min(d.height,h);
}
export function random(seed:number) {return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
