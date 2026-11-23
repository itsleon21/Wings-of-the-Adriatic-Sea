import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Small asymmetric canopy for instancing. Rounded lobes have distinct
 * openings and tapered edges instead of the outline of a scaled sphere. */
export function foliateCrown(style:number,resolution=10){
 const pieces:T.BufferGeometry[]=[];
 const lobes=3+style%3;
 for(let k=0;k<=lobes;k++){
  const crown=new T.SphereGeometry(1,Math.max(5,resolution-4),3),points=crown.attributes.position;
  const angle=k*2.39996+style*.91,outer=k>0;
  const radius=outer?.46+.10*Math.cos(angle):.64;
  const reach=outer?.47+.13*Math.sin(k*1.9+style):0;
  const lift=outer?.27*Math.sin(angle*1.6):.12;
  for(let i=0;i<points.count;i++){
   const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
   const tip=1+.17*Math.sin(x*4+y*3+angle)*Math.cos(z*4-y*2);
   points.setXYZ(i,reach*Math.cos(angle)+x*radius*tip+.10*y,
    lift+y*radius*(style===3?.75:1.08)*tip,reach*Math.sin(angle)+z*radius*tip);
  }
  crown.computeVertexNormals();pieces.push(crown);
 }
 const geometry=mergeGeometries(pieces,false)!;pieces.forEach(piece=>piece.dispose());
 return geometry;
}

/** Rooted at y=0; longitudinal sprays taper into one slightly leaning leader. */
export function cypressCrown(){
 const profile=[[0,0],[.43,.035],[.76,.12],[.94,.25],[1,.38],[.90,.50],[.81,.63],[.67,.75],[.48,.85],[.32,.92],[.12,.98],[0,1]];
 const g=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),14),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x);
  const fold=1+.17*Math.sin(a*5+y*8)+.09*Math.cos(a*3-y*15);
  p.setXYZ(i,x*fold+.14*y*y,y,z*fold-.05*y);
 }
 g.computeVertexNormals();return g;
}
