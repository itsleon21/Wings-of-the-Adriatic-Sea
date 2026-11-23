import * as T from 'three';
import {allLandforms,covePoint} from '../world/WorldConfig.ts';
import {coralFireSite} from '../world/CoralBonfire.ts';
import {buildVessel} from '../world/VesselModel.ts';

const cove=allLandforms.find(d=>d.id==='cove')!;
const wreck=covePoint(cove,cove.x+430,cove.z-55);
export const pirateWreck=new T.Vector3(wreck.x,0,wreck.z);
export const pirateBoatPosition=coralFireSite.clone().add(new T.Vector3(-80,0,465)).setY(0);
export const pirateBoatStop=pirateBoatPosition.clone().add(new T.Vector3(42,0,0));
export const pirateDeparture=pirateBoatStop.clone().add(new T.Vector3(0,75,820));

export function canTalkToPirateCrew(position:{x:number;z:number},onWater:boolean,speedKmh:number){
 return onWater&&speedKmh<=5&&Math.hypot(position.x-pirateBoatStop.x,position.z-pirateBoatStop.z)<=22;
}

export class AirPirateScene {
 readonly root=new T.Group();
 readonly hull=new T.Box3();
 private readonly boat: T.Group;
 private readonly wreck=new T.Group();
 private readonly lamps=new T.MeshBasicMaterial({color:0xffcc83,toneMapped:false});
 constructor(){
  this.root.name='The vanished air pirate';
  this.boat=buildVessel('sailing',0,this.lamps);
  this.boat.name='Blue sail / rendezvous vessel';
  this.boat.traverse(object=>{
   if(object instanceof T.Mesh&&object.name==='Coloured canvas sail') (object.material as T.MeshStandardMaterial).color.setHex(0x376d9b);
  });
  const glass=new T.SphereGeometry(.28,8,6);
  for(const x of [-1.25,1.25]){
   const lamp=new T.Mesh(glass,this.lamps);lamp.position.set(x,2.75,5.8);this.boat.add(lamp);
  }
  this.boat.scale.setScalar(1.48);this.boat.position.copy(pirateBoatPosition);
  this.hull.setFromObject(this.boat);
  const float=new T.Mesh(new T.CapsuleGeometry(.48,5.8,3,8),new T.MeshStandardMaterial({color:0x936d4c,roughness:.87,metalness:.35}));
  float.rotation.set(0,0,Math.PI*.46);
  const rib=new T.Mesh(new T.BoxGeometry(2.1,.13,.7),new T.MeshStandardMaterial({color:0x574537,roughness:.97}));
  rib.position.set(-1.2,.25,0);this.wreck.add(float,rib);
  this.wreck.position.copy(pirateWreck);this.wreck.name='Air pirate / broken float outside the sea arch';
  this.root.add(this.boat,this.wreck);this.update(0,false,false,0,0);
 }
 update(time:number,boatVisible:boolean,wreckVisible:boolean,waterHeight:number,night:number){
  this.boat.visible=boatVisible;this.wreck.visible=wreckVisible;
  this.boat.position.y=waterHeight;this.boat.rotation.z=.025*Math.sin(time*1.5);
  this.lamps.color.setHex(0xffcc83).multiplyScalar(.6+night*2.7);
  this.wreck.position.y=.17+.18*Math.sin(time*.46);
 }
 blocks(a:T.Vector3,b:T.Vector3){
  if(!this.boat.visible)return false;
  if(this.hull.containsPoint(a)||this.hull.containsPoint(b))return true;
  const delta=b.clone().sub(a),length=delta.length();
  if(length<.001)return false;
  const hit=new T.Ray(a,delta.divideScalar(length)).intersectBox(this.hull,new T.Vector3());
  return !!hit&&hit.distanceTo(a)<=length;
 }
 clear(x:number,z:number){
  return !this.boat.visible||Math.hypot(x-pirateBoatPosition.x,z-pirateBoatPosition.z)>23;
 }
}
