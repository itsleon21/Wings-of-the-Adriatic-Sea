import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {coastalLandmarkSites} from './CoastalLandmarkSites.ts';
import type {CoastalLandmarkSite} from './CoastalLandmarkSites.ts';
import {windmillArchitecture} from './WindmillArchitecture.ts';
import {windmillSailGeometry} from './WindmillSails.ts';
import {islands,terrainHeight} from './WorldConfig.ts';
import {buildHarborBoat} from './VesselModel.ts';

/** Authored maritime landmarks, merged by site; moving sails stay one draw each. */
class Builder{
 private pieces:T.BufferGeometry[]=[];
 append(g:T.BufferGeometry){this.pieces.push(g);}
 add(g:T.BufferGeometry,color:number,x=0,y=0,z=0,rotation?:T.Quaternion){
  if(g.index){const expanded=g.toNonIndexed();g.dispose();g=expanded;}
  for(const key of Object.keys(g.attributes))if(!['position','normal'].includes(key))g.deleteAttribute(key);
  if(rotation)g.applyQuaternion(rotation);g.translate(x,y,z);
  const c=new T.Color(color),n=g.attributes.position.count,colors=new Float32Array(n*3);for(let i=0;i<n;i++)colors.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new T.BufferAttribute(colors,3));this.pieces.push(g);
 }
 box(x:number,y:number,z:number,w:number,h:number,d:number,color:number){this.add(new T.BoxGeometry(w,h,d),color,x,y,z);}
 beam(a:T.Vector3,b:T.Vector3,width:number,depth:number,color:number){const delta=b.clone().sub(a),rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize()),mid=a.clone().add(b).multiplyScalar(.5);this.add(new T.BoxGeometry(width,delta.length(),depth),color,mid.x,mid.y,mid.z,rotation);}
 finish(name:string,material:T.MeshStandardMaterial){const merged=mergeGeometries(this.pieces,false)!;for(const p of this.pieces)p.dispose();merged.computeBoundingSphere();const mesh=new T.Mesh(merged,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh;}
}
const wood=0x7c6247,iron=0x42504c,roof=0x9c5138;
export class CoastalLandmarks{
 private millSails:T.InstancedMesh[]=[];private millSlots:{mesh:T.InstancedMesh;index:number;base:T.Matrix4;phase:number;speed:number}[]=[];private spin=new T.Matrix4();private millTransform=new T.Matrix4();
 readonly root=new T.Group();private rotors:{mesh:T.Mesh;phase:number}[]=[];private groups:T.Group[]=[];private boatMesh?:T.InstancedMesh;private boats:{x:number;z:number;angle:number;scale:number}[]=[];private dummy=new T.Object3D();
 constructor(blockers:T.Box3[]){
  this.root.name='Coastal landmarks / windmills, repair slip and fishing quays';
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.84,side:T.DoubleSide});material.userData.architecture=true;
  for(const site of coastalLandmarkSites){
   const group=new T.Group();group.name=site.id;group.userData.millStyle=site.style??0;group.position.set(site.x,0,site.z);group.rotation.y=site.angle;this.groups.push(group);this.root.add(group);
   const d=islands.find(d=>d.id===site.island)!,localHeight=(x:number,z:number)=>{const c=Math.cos(site.angle),s=Math.sin(site.angle);return terrainHeight(d,site.x+x*c+z*s,site.z-x*s+z*c);};
   const body=new Builder();
   if(site.kind==='windmill')this.windmill(site,group,body,material,localHeight,blockers);
   else if(site.kind==='shipyard')this.shipyard(site,body,localHeight,blockers);
   else this.fishery(site,body,localHeight,blockers);
   const staticMesh=body.finish(site.kind+' / batched masonry, timber and equipment',material);group.add(staticMesh);
  }
  const mills=this.groups.filter(g=>g.children.some(o=>o.name.startsWith('Windmill /'))),towerParts:T.BufferGeometry[]=[];
  if(mills.length){
   for(const style of[0,1,2,3,4,5]){
    const family=mills.filter(g=>g.userData.sailStyle===style);if(!family.length)continue;
    const sail=new T.InstancedMesh(windmillSailGeometry(style),material,family.length);sail.name='Coastal mills / rotating canvas sails / '+style;sail.castShadow=sail.receiveShadow=true;
    family.forEach((g,i)=>{const tower=g.children.find(o=>o.name.startsWith('windmill /')) as T.Mesh,rotor=g.children.find(o=>o.name.startsWith('Windmill /')) as T.Mesh;g.updateMatrix();
     towerParts.push(tower.geometry.clone().applyMatrix4(g.matrix));const base=new T.Matrix4().multiplyMatrices(g.matrix,new T.Matrix4().compose(rotor.position,new T.Quaternion(),rotor.scale));
     this.millSlots.push({mesh:sail,index:i,base,phase:this.millSlots.length*1.7,speed:.14+g.userData.millStyle*.016});sail.setMatrixAt(i,base);g.remove(tower,rotor);tower.geometry.dispose();rotor.geometry.dispose();
    });sail.computeBoundingSphere();this.millSails.push(sail);this.root.add(sail);
   }
   const geometry=mergeGeometries(towerParts,false)!;towerParts.forEach(g=>g.dispose());const towers=new T.Mesh(geometry,material);towers.name='Coastal mills / individually designed western European towers';towers.castShadow=towers.receiveShadow=true;this.root.add(towers);this.rotors=[];
  }
  const source=buildHarborBoat(7);this.boatMesh=new T.InstancedMesh(source.geometry,source.material,this.boats.length);this.boatMesh.name='Fishing quays / moored working boats';this.boatMesh.castShadow=this.boatMesh.receiveShadow=true;this.root.add(this.boatMesh);this.update(0,.25,()=>({height:0,dx:0,dz:0}));this.boatMesh.computeBoundingSphere();this.boatMesh.boundingSphere!.radius+=2;
 }
 private solid(site:CoastalLandmarkSite,blockers:T.Box3[],x:number,y:number,z:number,w:number,h:number,d:number){
  const c=Math.cos(site.angle),s=Math.sin(site.angle),wx=site.x+x*c+z*s,wz=site.z-x*s+z*c,ex=(Math.abs(c)*w+Math.abs(s)*d)/2,ez=(Math.abs(s)*w+Math.abs(c)*d)/2;
  blockers.push(new T.Box3(new T.Vector3(wx-ex,y-h/2,wz-ez),new T.Vector3(wx+ex,y+h/2,wz+ez)));
 }
 private mooredBoat(site:CoastalLandmarkSite,x:number,z:number,scale:number,blockers:T.Box3[]){
  const c=Math.cos(site.angle),s=Math.sin(site.angle);this.boats.push({x:site.x+x*c+z*s,z:site.z-x*s+z*c,angle:site.angle,scale});
  this.solid(site,blockers,x,4,z,6*scale,10,22*scale);
 }
 private windmill(site:CoastalLandmarkSite,group:T.Group,b:Builder,material:T.MeshStandardMaterial,height:(x:number,z:number)=>number,blockers:T.Box3[]){
  if(site.island==='town'){
   const hero=site.id==='town-hill-mill',variant=site.style??0,h=hero?34:[17,14,21,16,18,23][variant],r=hero?15:[10,9,10.5,11,12,10][variant];
   const y=height(0,0),stone=0xd3c29d,plaster=[0xf2e5cb,0xe4d8bc,0xf4ead4][variant%3];
   b.add(new T.CylinderGeometry(r*1.23,r*1.43,6,16),stone,0,y-1,0);
   const timberMill=!hero&&(variant===1||variant===3);
   if(timberMill){
    const sill=y+2+h*.28;
    b.add(new T.CylinderGeometry(r*.76,r*1.08,h*.28,8),stone,0,y+2+h*.14,0);
    b.box(0,sill+h*.36,0,r*1.55,h*.72,r*1.48,variant===1?0x806449:0x6f6951);
    for(const side of [-1,1])b.beam(new T.Vector3(side*r*.7,sill,r*.75),new T.Vector3(-side*r*.7,sill+h*.65,r*.75),.38,.27,wood);
   }else b.add(new T.CylinderGeometry(r*.74,r,h,variant===5?8:20),plaster,0,y+2+h/2,0);
   b.add(new T.CylinderGeometry(r*.79,r*.79,1,20),wood,0,y+h+2,0);
   const capColor=[0x965930,0xa56943,0x834a32][variant%3];
   if(timberMill){
    for(const side of [-1,1]){
     const tile=new T.BoxGeometry(r*1.03,.6,r*1.72).rotateZ(-side*.50);
     b.add(tile,capColor,side*r*.43,y+h+2+r*.22,0);
    }
   }else if(variant===5&&!hero){
    const dome=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2).scale(r*.86,r*.52,r*.86);
    b.add(dome,capColor,0,y+h+2,0);
   }else b.add(new T.ConeGeometry(r*.91,r*(hero?.94:.68),16),capColor,0,y+h+2+r*(hero?.47:.34),0);
   for(let i=0;i<4;i++){const a=i*1.57,ring=r*.835,g=new T.BoxGeometry(r*.24,2.8,.35);g.rotateY(a);b.add(g,0x433d33,Math.sin(a)*ring,y+h*.67,Math.cos(a)*ring);}
   b.box(0,y+3.5,r*.98,2.7,5,.5,wood);
   if(hero||variant%3===0){b.add(new T.CylinderGeometry(r*1.09,r*1.05,1,20),stone,0,y+6,0);}
   const shaft=r*.97,hy=y+h*.91;b.box(0,hy,shaft*.52,1.7,1.7,shaft*1.12,wood);
   const rig=hero?3:timberMill?2:3+variant%3;group.userData.sailStyle=rig;group.userData.millFloor=y;
   const rotor=new T.Mesh(windmillSailGeometry(rig),material);rotor.name='Windmill / working sail axis';rotor.position.set(0,hy,shaft+1);rotor.scale.setScalar(h*.65);group.add(rotor);
   this.solid(site,blockers,0,y+h*.55,0,r*2,h*1.18,r*2);
   // Small vineyard strips, trained on timber uprights on the outer mill terraces.
   if(!hero&&variant%2===0)for(let row=0;row<3;row++){
    const x=14+row*3;for(let j=0;j<7;j++){const z=-9+j*3,ground=height(x,z);
     if(j%3===0)b.box(x,ground+1.1,z,.24,2.2,.24,wood);
     const vine=new T.IcosahedronGeometry(1,0);vine.scale(.88,.86,1.95);
     b.add(vine,[0x728140,0x858d46,0x65763b][(row+j)%3],x,ground+1.45,z);
    }
   }
   if(hero){ // Broken limestone arcade beside the summit mill, following the ground.
    const x=-32,level=Math.max(height(x,-11),height(x,11))+9;
    for(const z of[-11,0,11]){const base=height(x,z)-2;b.box(x,(base+level)/2,z,4,level-base,3,stone);this.solid(site,blockers,x,(base+level)/2,z,4,level-base,3);}
    for(const z of[-5.5,5.5])for(let j=0;j<9;j++){const a=(j+.5)*Math.PI/9,g=new T.BoxGeometry(4,2.15,1.9);g.rotateX(-a);b.add(g,j%2?stone:0xc4b18b,x,level+5.5*Math.sin(a),z+5.5*Math.cos(a));}
   }
   return;
  }
  const floor=Math.max(...[-8,0,8].flatMap(x=>[-8,0,8].map(z=>height(x,z))))+.15,style=site.style??0,scaleY=24+(style%3)*2.8,model=windmillArchitecture(style,site.id.length*127+Math.round(site.x),0);
  model.geometry.scale(19,scaleY,19).translate(0,floor+scaleY/2,0);b.append(model.geometry);group.userData.millFloor=floor;group.userData.sailStyle=model.sailStyle;
  const rotor=new T.Mesh(windmillSailGeometry(model.sailStyle),material);rotor.name='Windmill / working sail axis';rotor.position.set(0,floor+scaleY/2+model.hubY*scaleY,model.shaft*19);rotor.scale.setScalar(14.4+(style%3)*1.0);group.add(rotor);
  this.solid(site,blockers,0,floor+scaleY*.78,0,31,scaleY*1.60,31);
 }
 private shipyard(site:CoastalLandmarkSite,b:Builder,height:(x:number,z:number)=>number,blockers:T.Box3[]){
  const samples=[-12,0,12].flatMap(x=>[-29,-14,1].map(z=>height(x,z))),floor=Math.max(...samples)+.25,bottom=Math.min(...samples)-1;
  b.box(0,(floor+bottom)/2,-14,25,floor-bottom,30,0xaaa088);
  for(const x of[-11,11])for(const z of[-27,-14,-1]){b.box(x,floor+5.5,z,.65,11,.65,wood);b.box(x,floor+.2,z,1.1,.4,1.1,iron);}
  b.box(0,floor+11,-14,24,.65,29,wood);
  for(const x of[-6,6]){const g=new T.BoxGeometry(13.5,.5,31);g.rotateZ(x<0?.38:-.38);b.add(g,roof,x,floor+13.4,-14);}
  b.box(0,floor+15.9,-14,.6,.5,31,0xbd7651);
  for(const z of[-26,-14,-2])for(const side of[-1,1])b.beam(new T.Vector3(side*11,floor+10.7,z),new T.Vector3(0,floor+15.8,z),.25,.3,wood);
  b.box(0,floor+10.2,-14,.4,.4,25,iron);b.box(0,floor+8,-9,.12,4,.12,iron);b.add(new T.TorusGeometry(.55,.12,6,12),iron,0,floor+5.6,-9);
  // The slipway joins the platform and descends continuously below the waterline.
  for(const side of[-1,1])b.beam(new T.Vector3(side*4.1,floor+.15,-1),new T.Vector3(side*4.1,-1,54),.38,.35,iron);
  for(let i=0;i<=27;i++){const t=i/27;b.box(0,T.MathUtils.lerp(floor+.05,-1.1,t),-1+t*55,9,.22,1.6,wood);}
  for(let i=0;i<3;i++){b.box(-7+i*2.4,floor+1,-22,1.8,2,1.7,0x947351);b.box(8,floor+.6,-19+i*2,2,1.2,1.6,0x687b68);}
  for(const x of[-8,8]){b.box(x,floor+.7,-10,2,1.4,6,wood);b.box(x,floor+1.5,-10,3,.35,6,wood);}
  // Exposed timber ribs and keel make the repair shed read as a working boatyard.
  b.beam(new T.Vector3(0,floor+1.9,-24),new T.Vector3(0,floor+1.9,-4),.3,.3,wood);
  for(const z of[-23,-20,-17,-14,-11,-8,-5]){
   const width=3.3*Math.sqrt(Math.max(.05,1-((z+14)/10)**2));
   const rib=[new T.Vector3(-width,floor+4.4,z),new T.Vector3(-width*.75,floor+2.8,z),new T.Vector3(0,floor+2,z),new T.Vector3(width*.75,floor+2.8,z),new T.Vector3(width,floor+4.4,z)];
   for(let i=1;i<rib.length;i++)b.beam(rib[i-1],rib[i],.2,.25,0xa48a64);
  }
  for(const z of[-20,-10])b.box(0,floor+1.2,z,8,1.5,.6,wood);
  this.solid(site,blockers,0,floor+7,-14,25,16,30);
 }
 private fishery(site:CoastalLandmarkSite,b:Builder,height:(x:number,z:number)=>number,blockers:T.Box3[]){
  // Narrow working jetty with a transverse loading head; all pile tops touch its beams.
  b.box(0,2.75,10,8,.7,48,wood);b.box(0,2.75,32,25,.7,8,wood);
  for(let z=-12;z<=34;z+=2)b.box(0,3.14,z,8.1,.09,.14,0xa48a64);
  for(let z=-10;z<=34;z+=7)for(const x of[-3.6,3.6]){const bottom=Math.min(-4,height(x,z)-1),length=3.1-bottom;b.add(new T.CylinderGeometry(.27,.34,length,7),wood,x,bottom+length/2,z);}
  for(const x of[-11,0,11]){const bottom=Math.min(-4,height(x,32)-1);b.add(new T.CylinderGeometry(.30,.38,3.1-bottom,7),wood,x,(bottom+3.1)/2,32);b.add(new T.CylinderGeometry(.24,.28,.65,8),iron,x,3.45,32);}
  for(const x of[-3.5,3.5]){b.box(x,5.4,-4,.18,4.5,.18,wood);b.box(x,7.45,-4,.24,.24,10,wood);}
  b.box(0,7.65,-4,8,.15,10,0xb5bbaa);
  for(let i=0;i<5;i++){b.box(-2+i*.9,3.5,-6, .75,.65,1.15,0x617971);b.box(-2+i*.9,3.86,-6,.78,.08,1.18,wood);}
  for(let i=0;i<3;i++){b.add(new T.TorusGeometry(.65+i*.07,.085,5,14),wood,2,3.28,-1+i*.18,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));}
  for(const x of[-2,2])b.box(x,4.2,30,1.2,2.1,1.2,0x7f9b91);
  this.solid(site,blockers,0,2.75,10,8,.7,48);this.solid(site,blockers,0,2.75,32,25,.7,8);
  this.mooredBoat(site,-12,17,.52,blockers);this.mooredBoat(site,12,18,.46,blockers);
 }
 update(time:number,wind:number,surface:(x:number,z:number)=>{height:number;dx:number;dz:number}){
  for(const slot of this.millSlots){this.spin.makeRotationZ(time*(slot.speed+wind*.10)+slot.phase);slot.mesh.setMatrixAt(slot.index,this.millTransform.multiplyMatrices(slot.base,this.spin));}for(const sails of this.millSails)sails.instanceMatrix.needsUpdate=true;
  for(const rotor of this.rotors)rotor.mesh.rotation.z=time*(.07+wind*.14)+rotor.phase;
  if(this.boatMesh){this.boats.forEach((boat,i)=>{const water=surface(boat.x,boat.z);this.dummy.position.set(boat.x,water.height+.20,boat.z);this.dummy.rotation.set(Math.atan(water.dz)*.5,boat.angle,-Math.atan(water.dx)*.5);this.dummy.scale.setScalar(boat.scale*1.05);this.dummy.updateMatrix();this.boatMesh!.setMatrixAt(i,this.dummy.matrix);});this.boatMesh.instanceMatrix.needsUpdate=true;}
 }
 warmView(){for(const group of this.groups)group.visible=true;}
 updateView(p:T.Vector3){for(const group of this.groups)group.visible=Math.hypot(p.x-group.position.x,p.z-group.position.z)<2600;}
}
