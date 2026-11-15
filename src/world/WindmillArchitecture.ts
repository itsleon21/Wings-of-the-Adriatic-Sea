import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from './WorldConfig.ts';
export const windmillFamilies=['Dutch gallery','English post','Iberian white tower','Flemish sawmill','French stone tower','Octagonal smock'] as const;
/** The night lighting uses these exact glass positions rather than the retired GLB windows. */
export function windmillWindowPanes(family:number,seed:number){
 const rng=random(seed);rng();const height=1.20+(rng()-.5)*.10,f=family%6;
 if(f===1)return[{x:0,y:.77-.5,z:.276,w:.10,h:.13}];
 if(f===3)return[-.11,.11].map(x=>({x,y:.86-.5,z:.228,w:.095,h:.125}));
 const panes:{x:number;y:number;z:number;w:number;h:number}[]=[];
 for(let level=0;level<(f===0?2:3);level++)for(const side of[-1,1]){
  const y=.27+level*.31,radius=f===0?(y>.45?.32-(y-.45)/(height-.45)*.13:.36-y*.10):f===2?.32-.065*y/height:f===4?.34-.11*y/height:y<.32?.30/.924:.35-(y-.32)/(height-.32)*.17;
  const z=(f===5?radius*.924:Math.sqrt(Math.max(.01,radius*radius-.105*.105)))+.003;
  panes.push({x:side*.105,y:y-.5,z:z+.0225,w:.058,h:.11});
 }return panes;
}
/** Original interpretations of historical structures. Floor = −.5, positive Z = entrance. */
export function windmillArchitecture(family:number,seed:number,windAngle=0){
 const rng=random(seed),parts:T.BufferGeometry[]=[],f=family%6;
 const roof=[0xad623b,0x8b5138,0x784e37,0xb77247][Math.floor(rng()*4)],stone=[0xc8b99b,0xd2c6ad,0xbdb49f][((seed%3)+3)%3],timber=[0x586b58,0x6b6250,0x78634b,0x605a4a][((seed%4)+4)%4],trim=0xdcd0b4;
 const add=(g:T.BufferGeometry,color:number,x=0,y=0,z=0)=>{if(g.index){const n=g.toNonIndexed();g.dispose();g=n;}g.translate(x,y-.5,z);for(const k of Object.keys(g.attributes))if(!['position','normal'].includes(k))g.deleteAttribute(k);const c=new T.Color(color);g.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:g.attributes.position.count},()=>c.toArray()).flat(),3));parts.push(g);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>add(new T.BoxGeometry(w,h,d),c,x,y,z);
 const cyl=(x:number,y:number,z:number,rt:number,rb:number,h:number,n:number,c:number)=>{const g=new T.CylinderGeometry(rt,rb,h,n);g.rotateY(Math.PI/8);add(g,c,x,y,z);};
 const beam=(a:T.Vector3,b:T.Vector3,w:number,c:number)=>{const v=b.clone().sub(a),m=a.clone().add(b).multiplyScalar(.5),g=new T.BoxGeometry(w,v.length(),w);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));add(g,c,m.x,m.y,m.z);};
 const gable=(x:number,y:number,z:number,w:number,depth:number,height:number,c:number)=>{const p=[-w/2,0,-depth/2,w/2,0,-depth/2,0,height,-depth/2,-w/2,0,depth/2,w/2,0,depth/2,0,height,depth/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4].flatMap(i=>p.slice(i*3,i*3+3)),3));g.computeVertexNormals();add(g,c,x,y,z);};
 const windows=()=>{for(const p of windmillWindowPanes(f,seed)){const y=p.y+.5,z=p.z-.0225;box(p.x,y,z,.085,.14,.025,trim);box(p.x,y,z+.016,.058,.11,.012,0x344947);box(p.x,y-.078,z+.027,.115,.025,.07,trim);}};
 const gallery=(y:number,r:number)=>{cyl(0,y,0,r,r,.045,8,0x9b8565);for(let i=0;i<12;i++){const a=i*Math.PI/6,x=Math.cos(a)*r,z=Math.sin(a)*r;box(x,y+.095,z,.018,.19,.018,timber);const b=a+Math.PI/6;beam(new T.Vector3(x,y+.19,z),new T.Vector3(Math.cos(b)*r,y+.19,Math.sin(b)*r),.018,timber);beam(new T.Vector3(x,y-.025,z),new T.Vector3(x*.50,y-.21,z*.50),.022,timber);}};
 const stairs=(y:number,z0:number,z1:number)=>{for(let i=0;i<10;i++){const t=(i+.5)/10;box(.25,y*t,z0+(z1-z0)*t,.18,.025,Math.abs(z1-z0)/10+.01,timber);}for(const x of[.14,.36])beam(new T.Vector3(x,0,z0),new T.Vector3(x,y,z1),.026,timber);};
 const height=1.20+(rng()-.5)*.10,hubY=height+.015;
 cyl(0,.035,0,.38,.40,.07,16,stone);
 if(f===0){
  cyl(0,.25,0,.32,.38,.43,8,stone);cyl(0,(.45+height)/2,0,.19,.32,height-.45,8,timber);gallery(.46,.46);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;beam(new T.Vector3(Math.cos(a)*.31,.48,Math.sin(a)*.31),new T.Vector3(Math.cos(a)*.19,height,Math.sin(a)*.19),.014,0xa79775);}
  cyl(0,height+.055,0,.26,.26,.11,16,roof);const cap=new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2);cap.scale(.28,.18,.24).rotateY(windAngle);add(cap,roof,0,height+.10,0);windows();stairs(.46,-.60,-.35);
 }else if(f===1){
  cyl(0,.13,0,.28,.31,.22,12,stone);box(0,.36,0,.11,.53,.11,0x68513a);
  for(const s of[-1,1]){beam(new T.Vector3(s*.28,.16,0),new T.Vector3(0,.64,0),.06,timber);beam(new T.Vector3(0,.16,s*.25),new T.Vector3(0,.64,0),.06,timber);}
  box(0,(.52+height)/2,0,.55,height-.52,.49,timber);gable(0,height,0,.62,.59,.26,roof);
  for(let j=0;j<10;j++)box(0,.56+j*(height-.55)/10,.25,.55,.012,.022,0x9d8d6d);
  box(0,.77,.255,.14,.17,.023,trim);box(0,.77,.27,.10,.13,.01,0x334843);stairs(.55,-.61,-.27);
  beam(new T.Vector3(0,.68,-.23),new T.Vector3(0,.05,-.59),.04,timber);
 }else if(f===2||f===4){
  cyl(0,height/2,0,f===2?.255:.23,f===2?.32:.34,height,24,f===2?0xe4dcc6:stone);
  add(new T.ConeGeometry(f===2?.33:.36,.30+rng()*.09,20),roof,0,height+.15,0);
  for(let j=0;j<(f===4?5:1);j++)cyl(0,.10+j*.245,0,.337-j*.017,.337-j*.017,.022,24,f===4?0xb2a58b:0x9d7655);
  windows();
  if(f===4){const side=seed%2?1:-1;box(side*.37,.20,-.06,.29,.40,.46,0xd3c2a3);gable(side*.37,.4,-.06,.34,.52,.16,roof);box(side*.37,.13,.18,.10,.26,.02,0x796147);}
 }else if(f===3){
  for(const x of[-.28,.28])for(const z of[-.26,.26]){box(x,.27,z,.055,.5,.055,timber);beam(new T.Vector3(x,.08,z),new T.Vector3(-x,.49,z),.025,timber);}
  box(0,.50,0,.63,.07,.59,0xa08b69);box(0,(.53+height)/2,-.035,.54,height-.53,.46,timber);gable(0,height,-.035,.64,.57,.23,roof);
  for(let j=0;j<8;j++)box(0,.55+j*(height-.53)/8,.205,.54,.012,.018,0x8e8b68);
  for(const x of[-.11,.11]){box(x,.86,.207,.13,.17,.025,trim);box(x,.86,.222,.095,.125,.01,0x344947);}stairs(.50,-.61,-.29);
  for(const x of[-.13,.10]){const log=new T.CylinderGeometry(.045,.06,.54,8);log.rotateX(Math.PI/2);add(log,0x8e7754,x,.18,0);}
 }else{
  box(0,.16,0,.64,.32,.60,stone);cyl(0,(.32+height)/2,0,.18,.35,height-.32,8,0xa28d68);
  for(let j=0;j<12;j++){const t=j/12;cyl(0,.34+t*(height-.34),0,.35-t*.17,.35-t*.17,.012,8,j%3?0x9a8866:0xb3a17c);}
  const cap=new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2);cap.scale(.25,.21,.29).rotateY(windAngle);add(cap,roof,0,height,0);windows();stairs(.33,-.60,-.32);
 }
 // The windshaft is attached to the cap; the rotating sails share this exact axis.
 const shaft=new T.CylinderGeometry(.034,.045,.48,10);shaft.rotateX(Math.PI/2).translate(0,0,.20).rotateY(windAngle);add(shaft,0x796449,0,hubY,0);
 box(0,.15,.34,.14,.30,.024,0x6f5b40);box(0,.012,.40,.23,.025,.14,stone);
 if(seed%3===0&&f!==1&&f!==3){const side=seed%2?1:-1;box(side*.40,.13,-.12,.24,.26,.36,stone);gable(side*.40,.26,-.12,.30,.42,.15,roof);}
 const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();
 return{geometry,hubY:hubY-.5,shaft:.44,sailStyle:f===2?0:f===4?1:2,family:windmillFamilies[f]};
}
