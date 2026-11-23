import {random} from '../world/WorldConfig.ts';
export const cloudShapes=['cumulus','tower','streak','broken','anvil','bank','humilis'] as const;
export type CloudShape=typeof cloudShapes[number];
type Lobe=[number,number,number,number,number,number];
/** Continuous shape fields shared by density baking and local cloud immersion. */
export function createCloudField(shape:CloudShape,seed:number){
 const rng=random(seed),lobes:Lobe[]=[];
 const add=(x:number,y:number,z:number,rx:number,ry:number,rz:number)=>lobes.push([x+(rng()-.5)*.12,y+(rng()-.5)*.09,z,rx*(.9+rng()*.2),ry*(.9+rng()*.2),rz]);
 if(shape==='cumulus'){
  add(-.4,-.25,0,.65,.40,.58);add(.35,-.22,0,.65,.42,.62);add(-.4,.2,.05,.48,.55,.47);add(.15,.48,0,.53,.60,.52);add(.63,.05,.05,.43,.41,.45);add(-.05,.05,.4,.51,.48,.42);add(-.70,.40,.13,.27,.32,.28);add(-.23,.82,.04,.29,.32,.29);add(.37,.84,.1,.30,.32,.30);add(.82,.26,.04,.23,.28,.25);
 }else if(shape==='humilis'){
  add(-.47,-.17,0,.59,.26,.43);add(.30,-.16,.03,.70,.28,.49);
  add(-.53,.10,-.06,.43,.40,.34);add(-.20,.35,.04,.40,.45,.39);
  add(.27,.19,-.06,.49,.32,.38);add(.74,.01,.03,.35,.23,.27);
  add(.08,-.04,.32,.48,.25,.29);
 }else if(shape==='tower'){
  add(-.2,-.55,0,.85,.35,.63);add(.2,-.14,0,.57,.62,.55);add(-.1,.45,.02,.57,.65,.49);add(.16,.95,.02,.46,.52,.45);add(-.48,.3,0,.37,.43,.40);
 }else if(shape==='streak'){
  for(let i=0;i<7;i++)add(-1.05+i*.34,Math.sin(i*.8)*.20+(rng()-.5)*.16,(rng()-.5)*.25,.32+rng()*.17,.32+rng()*.23,.32+rng()*.16);
 }else if(shape==='broken'){
  add(-.91,-.1,0,.42,.32,.42);add(-.73,.18,.05,.28,.33,.31);add(.15,.1,.15,.49,.42,.49);add(.4,.37,.10,.32,.35,.35);add(1.12,-.12,-.2,.30,.23,.31);
 }else if(shape==='anvil'){
  add(-.15,-.35,0,.80,.48,.61);add(-.25,.15,0,.65,.65,.53);add(-.60,.49,0,.56,.50,.46);add(.04,.68,.02,.63,.56,.57);add(.66,.47,.04,.58,.43,.46);add(.98,.29,.03,.37,.29,.36);
 }else{
  for(let i=0;i<8;i++){const a=i*2.4;add(Math.cos(a)*(.4+rng()*.45),-.05+rng()*.30,Math.sin(a)*.5,.58+rng()*.22,.30+rng()*.15,.52);}
 }
 const field=(x:number,y:number,z:number)=>{
  let d=10;
  for(const [px,py,pz,rx,ry,rz] of lobes){const v=(Math.hypot((x-px)/rx,(y-py)/ry,(z-pz)/rz)-1)*Math.min(rx,ry,rz),h=Math.max(.14-Math.abs(d-v),0)/.14;d=Math.min(d,v)-h*h*.035;}
  return d+Math.sin(x*7+seed)*Math.sin(y*8+z*3)*Math.sin(z*7-x*2)*.012;
 };
 return field;
}
