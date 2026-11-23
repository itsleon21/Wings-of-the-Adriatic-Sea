import * as T from 'three';
import {harbor,terrainHeight} from './WorldConfig.ts';
import {waterfrontPoint} from './IslandDetails.ts';
import {marineWindDirection,marineWindSpeed} from './MarineWind.ts';

/** A fabric windsock on the quay, with a rigid hoop and a tapered open mouth. */
export class HarborWindsock{
 readonly root=new T.Group();
 private cloth:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
 private time=0;
 constructor(blockers:T.Box3[]){
  const shore=waterfrontPoint(harbor,-1.02,8);
  const ground=terrainHeight(harbor,shore.x,shore.z);
  this.root.position.set(shore.x,ground,shore.z);
  this.root.name='Harbor / water runway windsock';
  const iron=new T.MeshStandardMaterial({color:0x53574d,roughness:.78,metalness:.45});
  const pole=new T.Mesh(new T.CylinderGeometry(.065,.14,7.5,10),iron);
  pole.position.y=3.75;pole.castShadow=true;this.root.add(pole);
  const footing=new T.Mesh(new T.CylinderGeometry(.32,.42,.30,10),new T.MeshStandardMaterial({color:0xaca08a,roughness:.95}));
  footing.position.y=.12;this.root.add(footing);
  const geometry=new T.BufferGeometry(),indices:number[]=[],colors:number[]=[];
  const rings=10,sides=12;
  geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(rings*sides*4*3),3).setUsage(T.DynamicDrawUsage));
  for(let ring=0;ring<rings;ring++)for(let side=0;side<sides;side++){
   const base=(ring*sides+side)*4;
   indices.push(base,base+1,base+2,base,base+2,base+3);
   const color=new T.Color(ring%4<2?0xbe4a26:0xe8d8aa);
   for(let i=0;i<4;i++)colors.push(color.r,color.g,color.b);
  }
  geometry.setIndex(indices);geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  this.cloth=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.86,side:T.DoubleSide}));
  this.cloth.position.y=7.2;this.cloth.rotation.y=Math.atan2(-marineWindDirection.z,marineWindDirection.x);
  const hoop=new T.Mesh(new T.TorusGeometry(.45,.028,6,20),iron);
  hoop.position.x=.05;hoop.rotation.y=Math.PI/2;this.cloth.add(hoop);
  this.root.add(this.cloth);this.update(0,marineWindSpeed(.25));
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.set(new T.Vector3(1.45,-.8,0),2.5);
  blockers.push(new T.Box3(new T.Vector3(shore.x-.36,ground,shore.z-.36),new T.Vector3(shore.x+.36,ground+7.6,shore.z+.36)));
 }
 update(dt:number,speed:number){
  this.time+=dt;
  const taut=T.MathUtils.smoothstep(speed,0,10),position=this.cloth.geometry.getAttribute('position');
  for(let ring=0;ring<10;ring++)for(let side=0;side<12;side++){
   const i=(ring*12+side)*4;
   for(let corner=0;corner<4;corner++){
    const t=(ring+(corner===1||corner===2?1:0))/10;
    const angle=(side+(corner>=2?1:0))*Math.PI/6;
    const sway=Math.sin(this.time*(2+taut*4)-t*8)*t*t;
    const radius=(.45-.29*t)*(1+.12*sway),droop=(1-taut)*1.7*t*t;
    position.setXYZ(i+corner,.05+t*(1.6+1.55*taut),Math.cos(angle)*radius-droop+.11*sway,Math.sin(angle)*radius+.18*sway);
   }
  }
  position.needsUpdate=true;this.cloth.geometry.computeVertexNormals();
 }
}
