import * as T from 'three';
import {allLandforms,terrainHeight} from '../world/WorldConfig.ts';
import {buildHarborBoat} from '../world/VesselModel.ts';
/** Fixed open-water location near the lighthouse, clear of all island collision terrain. */
export function rescueBoatPosition(){
 const d=allLandforms.find(i=>i.id==='lighthouse')!;
 for(let r=1.4;r<=2.5;r+=.2)for(let i=0;i<16;i++){
  const a=i*Math.PI/8,x=d.x+Math.cos(a)*(d.rx*r+90),z=d.z+Math.sin(a)*(d.rz*r+90);
  if(allLandforms.every(land=>[-55,0,55].every(dx=>[-55,0,55].every(dz=>terrainHeight(land,x+dx,z+dz)<=0))))return new T.Vector3(x,0,z);
 }
 throw new Error('No safe rescue boat position near lighthouse');
}
export class RescueBoat{
 readonly root=new T.Group();readonly boat=buildHarborBoat(2);
 readonly marker:T.Mesh<T.ShapeGeometry,T.MeshBasicMaterial>;
 private time=0;
 constructor(){
  this.root.name='Lighthouse rescue / persistent vessel';this.root.position.copy(rescueBoatPosition());
  this.boat.scale.setScalar(1.6*1.05);this.root.add(this.boat);
  const shape=new T.Shape();shape.moveTo(0,-4);shape.lineTo(3,2);shape.lineTo(-3,2);shape.closePath();
  this.marker=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshBasicMaterial({color:0xffdb38,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide,toneMapped:false}));
  this.marker.name='Rescue / flashing triangle';this.marker.position.y=15;this.marker.visible=false;this.root.add(this.marker);
 }
 update(dt:number,searching:boolean,camera:T.Camera){this.time+=dt;this.boat.position.y=.22*Math.sin(this.time*1.3);this.boat.rotation.z=.035*Math.sin(this.time);
  this.marker.visible=searching;this.marker.position.y=15+Math.sin(this.time*2.7)*1.3;this.marker.quaternion.copy(camera.quaternion);this.marker.material.opacity=.35+.65*(.5+.5*Math.sin(this.time*6));
 }
}
