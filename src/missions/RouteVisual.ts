import * as T from 'three';
import {route} from './MissionManager.ts';
import type {MissionManager} from './MissionManager.ts';
/** Compact yellow survey arrows. Only the next island is marked. */
export class RouteVisual {
 readonly root=new T.Group();private arrows:T.Group[]=[];
 constructor(){this.root.name='Mission / yellow proximity arrows';
  const shape=new T.Shape();shape.moveTo(0,-9);shape.lineTo(7,6);shape.lineTo(0,3);shape.lineTo(-7,6);shape.closePath();
  const geometry=new T.ShapeGeometry(shape);
  route.forEach(p=>{const g=new T.Group();g.position.copy(p.position);g.name='Tour arrow / '+p.name;const m=new T.MeshBasicMaterial({color:0xffdc39,side:T.DoubleSide,transparent:true,depthWrite:false,toneMapped:false});const mesh=new T.Mesh(geometry,m);g.add(mesh);g.rotation.y=Math.atan2(p.normal.x,p.normal.z);this.arrows.push(g);this.root.add(g);g.visible=false;});
 }
 pass(_index:number){}
 reset(){this.arrows.forEach(g=>g.visible=false);}
 update(mission:MissionManager,time:number){this.arrows.forEach((g,i)=>{g.visible=!!mission.current&&i===mission.index;if(!g.visible)return;g.position.y=route[i].position.y+Math.sin(time*2.4)*3;g.rotation.z=Math.sin(time*2)*.12;(g.children[0] as T.Mesh<T.ShapeGeometry,T.MeshBasicMaterial>).material.opacity=.55+.45*(.5+.5*Math.sin(time*6));});}
}
