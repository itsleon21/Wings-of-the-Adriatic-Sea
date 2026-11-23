import * as T from 'three';
import {random} from './WorldConfig.ts';

/** Layered, asymmetric coastal limestone. Undercut lower beds and offset joints
 * change the silhouette; surface normals are not a substitute for this volume. */
export function limestoneGeometry(seed=9107){
 const rng=random(seed),sides=13,rows=9,positions:number[]=[],indices:number[]=[];
 const angles=Array.from({length:sides},(_,i)=>i/sides*Math.PI*2+(rng()-.5)*.12);
 const profile=[.45,.80,.94,1.03,.95,1.05,.89,.70,.25];
 const lobes=Array.from({length:sides},()=>.84+rng()*.26);
 for(let row=0;row<rows;row++){
  const y=-1+row*2/(rows-1),shiftX=Math.sin(row*.9+seed)*.10,shiftZ=Math.cos(row*.7)*.13;
  for(let side=0;side<sides;side++){
   const a=angles[side],r=profile[row]*lobes[side]*(1+(rng()-.5)*.13);
   positions.push(Math.cos(a)*r+shiftX,y+(row===0||row===rows-1?0:(rng()-.5)*.10),Math.sin(a)*r+shiftZ);
  }
 }
 for(let row=0;row<rows-1;row++)for(let side=0;side<sides;side++){
  const a=row*sides+side,b=row*sides+(side+1)%sides,c=a+sides,d=b+sides;
  indices.push(a,c,b,b,c,d);
 }
 for(let i=1;i<sides-1;i++){indices.push(0,i,i+1);const last=(rows-1)*sides;indices.push(last,last+i+1,last+i);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();
 return g;
}
