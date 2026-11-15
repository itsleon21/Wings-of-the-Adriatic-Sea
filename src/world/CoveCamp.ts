import * as T from 'three';
import {islands,terrainHeight} from './WorldConfig.ts';
export const coveCampSite=(()=>{
 const d=islands.find(d=>d.id==='cove')!;let best=Infinity,x=d.x-200,z=d.z,y=3;
  for(let lx=-245;lx<-155;lx+=3)for(let lz=-90;lz<100;lz+=3){const xx=d.x+lx,zz=d.z+lz,h=terrainHeight(d,xx,zz);if(h<2||h>6)continue;const relief=Math.max(...[[7,0],[-7,0],[0,7],[0,-7]].map(([a,b])=>Math.abs(terrainHeight(d,xx+a,zz+b)-h)));const score=relief*5+Math.abs(h-3);if(score<best){best=score;x=xx;z=zz;y=h;}}
 return{x,y,z};
})();
/** An unbuilt beach with one small traveller's camp. */
export class CoveCamp{
 readonly root=new T.Group();private flame:T.Mesh;private light=new T.PointLight(0xffa34c,0,42,2);private time=0;
 constructor(){
  const {x,z,y}=coveCampSite;
  this.root.name='隐秘海湾 / beach tent, table and night campfire';this.root.position.set(x,y+.12,z);
  const canvas=new T.MeshStandardMaterial({color:0xc7ad76,roughness:1,side:T.DoubleSide}),wood=new T.MeshStandardMaterial({color:0x68513b,roughness:1});
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);return mesh;};
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-4,0,-4,0,4,-4,-4,0,4,0,4,-4,0,4,4,-4,0,4,0,4,-4,4,0,-4,0,4,4,4,0,-4,4,0,4,0,4,4],3));g.computeVertexNormals();add(g,canvas,-5,0,0).name='Canvas ridge tent';
  const end=new T.BufferGeometry();end.setAttribute('position',new T.Float32BufferAttribute([-4,0,0,4,0,0,0,4,0],3));end.computeVertexNormals();add(end,canvas,-5,0,-4);

  add(new T.BoxGeometry(3,.25,2),wood,5,2,-3);for(const dx of [-1,1])for(const dz of [-.7,.7])add(new T.BoxGeometry(.22,2,.22),wood,5+dx,1,-3+dz);
  const logbook=add(new T.BoxGeometry(.85,.12,.65),new T.MeshStandardMaterial({color:0x65766b,roughness:.9}),5,2.20,-3);logbook.name='Camp table / weathered navigation logbook';
  for(let i=0;i<10;i++){const a=i*Math.PI/5;add(new T.DodecahedronGeometry(.65,0),new T.MeshStandardMaterial({color:0x8d8573,roughness:1}),4+Math.cos(a)*2,.25,5+Math.sin(a)*2);}
  for(const angle of [-.6,.6]){const log=add(new T.CylinderGeometry(.4,.5,3.5,7),wood,4,.5,5);log.rotation.set(Math.PI/2,angle,0);}
  this.flame=add(new T.ConeGeometry(1,2.8,7),new T.MeshBasicMaterial({color:0xffa238,transparent:true,opacity:0,depthWrite:false,toneMapped:false}),4,1.5,5);this.flame.castShadow=false;
  this.light.position.set(4,2.4,5);this.root.add(this.light);this.setNightness(0,0);
 }
 setNightness(n:number,dt:number){this.time+=dt;const strength=T.MathUtils.smoothstep(n,.3,.8),flicker=.86+.10*Math.sin(this.time*8)+.04*Math.sin(this.time*17);this.flame.visible=strength>.01;(this.flame.material as T.MeshBasicMaterial).opacity=strength*.88;this.flame.scale.set(.9+flicker*.1,.8+flicker*.25,1);this.light.intensity=strength*170*flicker;}
}
