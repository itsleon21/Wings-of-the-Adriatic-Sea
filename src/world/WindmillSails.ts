import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Three western European rigs: open lattice, Berton sliding boards and common canvas sails. */
export function windmillSailGeometry(style:number){
 const parts:T.BufferGeometry[]=[];
 const part=(g:T.BufferGeometry,color:number)=>{const c=new T.Color(color),geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();for(const k of Object.keys(geo.attributes))if(!['position','normal'].includes(k))geo.deleteAttribute(k);geo.setAttribute('color',new T.Float32BufferAttribute(Array.from({length:geo.attributes.position.count},()=>c.toArray()).flat(),3));parts.push(geo);};
 const count=style>=3?[6,10,8][style-3]:4;
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2;
  const beam=new T.BoxGeometry(.052,.99,.045);beam.translate(0,.48,0).rotateZ(a);part(beam,0x796345);
  if(style>=3){
   const cloth=new T.BufferGeometry(),w=style===4?.26:.41;
   cloth.setAttribute('position',new T.Float32BufferAttribute([0,.18,.018, -w,.78,.025, -.10,.71,.068, 0,.18,.018,-.10,.71,.068,0,.97,.022, -.10,.71,.068,-w,.78,.025,0,.97,.022],3));cloth.computeVertexNormals();cloth.rotateZ(a);part(cloth,i%3===0?0xf4e8c7:0xe4d5ae);
   const rope=new T.BoxGeometry(.011,.43,.011);rope.rotateZ(-.78).translate(-w*.5,.86,.025).rotateZ(a);part(rope,0x796345);
  }else if(style===1){for(let j=0;j<7;j++){const board=new T.BoxGeometry(.034,.68,.014);board.translate(-.24+j*.034,.61,.035+j*.001).rotateZ(a);part(board,j%2?0xcbbba0:0xd9cbae);}for(const y of[.33,.88]){const brace=new T.BoxGeometry(.28,.026,.025);brace.translate(-.12,y,.054).rotateZ(a);part(brace,0x877153);}}
  else{
   if(style===2){const cloth=new T.PlaneGeometry(.24,.65,2,3);cloth.translate(-.115,.61,.036);const p=cloth.attributes.position;for(let j=0;j<p.count;j++)p.setZ(j,.036+Math.sin((p.getX(j)+.24)/.24*Math.PI)*.035);cloth.computeVertexNormals();cloth.rotateZ(a);part(cloth,0xe6d6b4);}
   for(let j=0;j<6;j++){const cross=new T.BoxGeometry(.27,.015,.028);cross.translate(-.10,.28+j*.12,.042).rotateZ(a);part(cross,style===0?0xb6a184:0x826a4d);}
   for(const x of[-.24,-.12]){const frame=new T.BoxGeometry(.018,.68,.029);frame.translate(x,.59,.043).rotateZ(a);part(frame,0x8d7757);}
  }
 }
 const hub=new T.CylinderGeometry(.10,.12,.30,12);hub.rotateX(Math.PI/2);part(hub,0x70634b);
 const result=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());result.computeBoundingSphere();return result;
}
