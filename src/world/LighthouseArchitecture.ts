import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainHeight} from './WorldConfig.ts';
import type {IslandDefinition} from './WorldConfig.ts';

/** Banded masonry and a keeper's cottage, batched by surface to keep coastal flybys cheap. */
export function lighthouseArchitecture(island:IslandDefinition){
 const root=new T.Group();
 root.name='Lighthouse / banded masonry, lantern gallery and keeper cottage';
 const stone=new T.MeshStandardMaterial({color:0xddd3b5,roughness:.88});
 const red=new T.MeshStandardMaterial({color:0xa84532,roughness:.66});
 const iron=new T.MeshStandardMaterial({color:0x3e4a48,metalness:.55,roughness:.46});
 const roof=new T.MeshStandardMaterial({color:0x974832,roughness:.87});
 const glass=new T.MeshStandardMaterial({color:0x70918f,metalness:.16,roughness:.22});
 const parts=new Map<T.Material,T.BufferGeometry[]>();
 const add=(geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{
  geometry.translate(x,y,z);
  const list=parts.get(material)??[];
  list.push(geometry);parts.set(material,list);
 };
 const box=(material:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>add(new T.BoxGeometry(w,h,d),material,x,y,z);
 const cylinder=(material:T.Material,bottom:number,top:number,height:number,y:number)=>add(new T.CylinderGeometry(top,bottom,height,40),material,0,y);
 const base=terrainHeight(island,island.x,island.z);
 root.position.set(island.x,base,island.z);
 cylinder(stone,25,21,24,-8);
 // Adjacent tapered bands share their boundaries without overlapping faces.
 for(let i=0;i<5;i++)cylinder(i%2?red:stone,11-i*.8,11-(i+1)*.8,10,10+i*10);
 cylinder(stone,11,11,2,55);
 cylinder(iron,11.3,11.3,.65,56.3);
 cylinder(glass,6.7,6.2,10,62);
 cylinder(stone,7.2,7.2,.8,57.4);
 cylinder(stone,7,7,.8,67);
 add(new T.ConeGeometry(10,8,40),roof,0,71);
 cylinder(iron,.25,.25,4,77);
 for(const y of [58,60.2]){
  const ring=new T.TorusGeometry(10.7,.13,5,48);ring.rotateX(Math.PI/2);add(ring,iron,0,y);
 }
 for(let i=0;i<20;i++){
  const a=i*Math.PI/10;
  add(new T.CylinderGeometry(.12,.12,4.2,5),iron,10.7*Math.cos(a),58.1,10.7*Math.sin(a));
 }
 for(let i=0;i<10;i++){
  const a=i*Math.PI/5;
  add(new T.CylinderGeometry(.16,.16,9,5),stone,6.5*Math.cos(a),62,6.5*Math.sin(a));
 }
 for(const y of [15,35,48]){
  box(iron,0,y,11-(y-5)*.08,1.8,3.7,.25);
  box(stone,0,y-2,11.3-(y-5)*.08,2.8,.35,.8);
 }
 box(iron,0,10,10.7,3.3,6,.4);
 const cx=44,cz=12;
 const ground=terrainHeight(island,island.x+cx,island.z+cz)-base;
 // A deep plinth grounds the cottage on the sloping island summit.
 box(stone,cx,ground-4,cz,23,10,19);
 box(stone,cx,ground+6,cz,22,12,18);
 for(const side of [-1,1]){
  const slope=new T.BoxGeometry(12.7,.9,20);
  slope.rotateZ(-side*Math.atan2(5,11));
  add(slope,roof,cx+side*5.5,ground+14.5,cz);
 }
 const triangle=new T.Shape();
 triangle.moveTo(-11,0);triangle.lineTo(11,0);triangle.lineTo(0,5);triangle.closePath();
 for(const side of [-1,1]){
  const g=new T.ShapeGeometry(triangle);
  if(side<0)g.rotateY(Math.PI);
  add(g,stone,cx,ground+12,cz+side*9);
 }
 for(const x of [-6,5]){
  box(iron,cx+x,ground+6,cz+9.1,3,4.2,.25);
  for(const side of [-1,1])box(red,cx+x+side*2,ground+6,cz+9.25,.85,4.5,.3);
  box(stone,cx+x,ground+3.7,cz+9.5,4,.45,1);
 }
 box(iron,cx-11.1,ground+4,cz, .25,7,3.5);
 box(stone,cx+6,ground+17,cz-4,2.4,6,2.4);
 for(const [material,geometries] of parts){
  const geometry=mergeGeometries(geometries,false)!;
  geometries.forEach(g=>g.dispose());
  const mesh=new T.Mesh(geometry,material);
  mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
 }
 return root;
}
