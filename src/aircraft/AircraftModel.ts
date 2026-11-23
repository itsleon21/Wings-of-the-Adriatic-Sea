import {PropellerDynamics} from './PropellerDynamics.ts';
import {repairAircraftTangents} from '../rendering/AircraftGeometry.ts';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAircraft } from './AircraftCatalog.ts';
import type { AircraftId } from './FlightConfig.ts';
import {prepareAircraftSurface,physicalAircraftMaterial,setAircraftSkySpecular} from '../rendering/AircraftSurface.ts';
import {CockpitInstruments} from './CockpitInstruments.ts';

// Seat the fasteners in the exported ellipsoid at the blade roots. Both MC.72
// hubs own their hardware, so the two sets follow their opposing rotations.
function hubFasteners(id:AircraftId,pivot:T.Object3D){
 const name=id==='redwing'?'Ivory_streamlined_spinner':id==='m5'?'Pusher_hub':
  id==='mc72'?(pivot.name.endsWith('Rear')?'Rear_propeller_hub':'Front_propeller_hub'):undefined;
 const hub=pivot.children.find(node=>node.name.replace(/ /g,'_')===name);
 if(!hub)return;
 const bolts=new T.InstancedMesh(new T.CylinderGeometry(.006,.008,.005,6),
  new T.MeshStandardMaterial({color:0x887f71,metalness:.72,roughness:.45}),6);
 const pose=new T.Object3D(),axis=new T.Vector3(),up=new T.Vector3(0,1,0);
 const z=(id==='m5'?1:-1)*.45,r=Math.sqrt(1-z*z);
 for(let i=0;i<6;i++){
  const angle=(i+.5)*Math.PI/3,x=r*Math.cos(angle),y=r*Math.sin(angle);
  pose.position.set(x*hub.scale.x,y*hub.scale.y,z*hub.scale.z).add(hub.position);
  axis.set(x/hub.scale.x,y/hub.scale.y,z/hub.scale.z).normalize();
  pose.quaternion.setFromUnitVectors(up,axis);pose.updateMatrix();bolts.setMatrixAt(i,pose.matrix);
 }
 bolts.name='Propeller hub fasteners';pivot.add(bolts);
}

function disposeTree(root:T.Object3D) {
  const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
  root.traverse(object=>{if(object instanceof T.Mesh){geometries.add(object.geometry);for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});
  for(const material of materials){for(const value of Object.values(material))if(value instanceof T.Texture)textures.add(value);material.dispose();}
  for(const texture of textures)texture.dispose();for(const geometry of geometries)geometry.dispose();
}
export class AircraftModel {
  readonly root=new T.Group();readonly rotor=new PropellerDynamics();
  private propeller=new T.Group();private propellers:T.Object3D[]=[];private ailerons:T.Object3D[]=[];private elevator?:T.Object3D;private rudder?:T.Object3D;
  private blurs:T.Mesh<T.RingGeometry,T.MeshBasicMaterial>[]=[];private request=0;
  private instruments?:CockpitInstruments;
  isLoading=false;assetStatus='程序外形';
  aircraftId:AircraftId;
  constructor(aircraftId:AircraftId='redwing'){this.aircraftId=aircraftId;this.root.add(this.fallback());this.cacheNightMaterials();}
  private fallback(){
    this.propeller=new T.Group();this.propellers=[this.propeller];const plane=getAircraft(this.aircraftId),m5=this.aircraftId==='m5',group=new T.Group();
    const paint=new T.MeshPhysicalMaterial({color:plane.color,roughness:.34,clearcoat:.48,clearcoatRoughness:.19}),hullPaint=new T.MeshPhysicalMaterial({color:m5?0x713b24:0xb93424,roughness:m5?.42:.34,clearcoat:m5?.32:.48,clearcoatRoughness:.20}),cream=new T.MeshStandardMaterial({color:m5?0xe5e2d2:0xd2bd77,roughness:.6}),dark=new T.MeshStandardMaterial({color:0x493a2b,roughness:.7});
    const make=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;};
    if(['mc72','s6','gloster6','m67'].includes(this.aircraftId)){
      const body=make(new T.SphereGeometry(1,24,12),paint,0,.15,0);body.scale.set(.47,.55,3.95);
      make(new T.BoxGeometry(9.48,.13,1.6),paint,0,-.14,0);
      for(const side of[-1,1]){const f=make(new T.SphereGeometry(1,20,10),cream,side*1.18,-1.44,-.2);f.scale.set(.34,.38,3.25);make(new T.BoxGeometry(.05,1.25,.05),dark,side*1.18,-.7,-1);}
      make(new T.BoxGeometry(2.6,.08,.9),paint,0,.22,3.25);make(new T.BoxGeometry(.08,1.05,.85),paint,0,.65,3.45);
      this.propeller.position.set(0,.22,-4.04);this.propeller.userData.rotation_direction=1;const rear=new T.Group();rear.position.set(0,.22,-3.87);rear.userData.rotation_direction=-1;rear.rotation.z=Math.PI/2;this.propellers=[this.propeller,rear];for(const p of this.propellers){p.add(new T.Mesh(new T.BoxGeometry(.15,2.5,.045),dark));group.add(p);}return group;
    }
    make(new T.SphereGeometry(1,24,12),hullPaint,0,-.12,0).scale.set(.63,.57,plane.length/2);
    make(new T.SphereGeometry(1,20,10),cream,0,-.49,0).scale.set(.60,.48,3.8);
    make(new T.BoxGeometry(plane.span,.13,m5?1.7:2.3),paint,0,m5?1.85:1.26,-.65);
    if(m5)make(new T.BoxGeometry(8.8,.10,1.5),paint,0,.48,-.55);
    make(new T.BoxGeometry(3.1,.1,1.15),paint,0,.5,3.5);make(new T.BoxGeometry(.10,1.35,1.4),paint,0,1.0,3.65);
    for(const side of [-1,1]){const f=make(new T.SphereGeometry(1,16,8),cream,side*4,-.28,-.7);f.scale.set(.28,.30,1.15);make(new T.BoxGeometry(.055,m5?1.9:.8,.055),dark,side*4,m5?.75:.15,-.7);}
    this.propeller.position.set(0,m5?1.25:2.10,m5?.65:-2.49);group.add(this.propeller);this.propeller.add(new T.Mesh(new T.BoxGeometry(2,.15,.1),dark));
    make(new T.SphereGeometry(.45,16,8),dark,0,.28,m5?-1.4:.8).scale.set(.8,.25,1.2);return group;
  }
  async load(renderer?:T.WebGLRenderer,id:AircraftId=this.aircraftId):Promise<boolean>{
    this.rotor.reset();
    const request=++this.request;this.aircraftId=id;const plane=getAircraft(id);this.isLoading=true;this.assetStatus=`${plane.name} 模型加载中`;
    disposeTree(this.root);this.root.clear();this.instruments=undefined;this.ailerons=[];this.elevator=this.rudder=undefined;this.blurs=[];this.root.add(this.fallback());this.cacheNightMaterials();
    try{
      const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${plane.modelFile}`);
      if(request!==this.request){disposeTree(gltf.scene);return false;}
      disposeTree(this.root);this.root.clear();this.root.add(gltf.scene);
      this.propeller=gltf.scene.getObjectByName('PropellerPivot') as T.Group||new T.Group();this.propellers=[];gltf.scene.traverse(o=>{if(o.name.startsWith('PropellerPivot'))this.propellers.push(o);});
      this.ailerons=['LeftAileron','RightAileron'].map(name=>gltf.scene.getObjectByName(name)).filter((o):o is T.Object3D=>!!o);
      this.elevator=gltf.scene.getObjectByName('Elevator');this.rudder=gltf.scene.getObjectByName('Rudder');
      const prepared=new Set<T.Material>(),upgraded=new Map<T.Material,T.Material>();
      gltf.scene.traverse(object=>{if(object instanceof T.Mesh){const originals=Array.isArray(object.material)?object.material:[object.material];const materials=originals.map(source=>{if(!upgraded.has(source))upgraded.set(source,physicalAircraftMaterial(source));return upgraded.get(source)!;});object.material=Array.isArray(object.material)?materials:materials[0];object.castShadow=!materials.every(m=>m.transparent);object.receiveShadow=true;
        repairAircraftTangents(object.geometry);
        const ao=object.geometry.getAttribute('color');if(ao){object.geometry.setAttribute('aircraftAO',ao);object.geometry.deleteAttribute('color');}
        for(const material of materials){const m=material as T.MeshPhysicalMaterial;if(!prepared.has(m)){prepareAircraftSurface(m,!!ao);prepared.add(m);}if(m.transparent)m.depthWrite=false;for(const texture of [m.map,m.normalMap,m.roughnessMap,m.metalnessMap])if(texture){texture.anisotropy=Math.min(8,renderer?.capabilities.getMaxAnisotropy()??4);texture.needsUpdate=true;}}
      }});
      for(const [source,material] of upgraded)if(source!==material)source.dispose();
      if(id==='redwing'&&typeof document!=='undefined'){this.instruments=new CockpitInstruments();gltf.scene.add(this.instruments.root);}
      for(const pivot of this.propellers){hubFasteners(id,pivot);const blur=new T.Mesh(new T.RingGeometry(.16,plane.propellerRadius,64),new T.MeshBasicMaterial({color:0xc6b487,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));blur.position.z=-.025*plane.propellerDirection;pivot.add(blur);this.blurs.push(blur);}
      this.cacheNightMaterials();this.isLoading=false;this.assetStatus=`${plane.name} / GLB`;return true;
    }catch{if(request===this.request){this.isLoading=false;this.assetStatus=`${plane.name} 程序外形（模型未加载）`;}return false;}
  }
  private nightMaterials = new Set<T.MeshStandardMaterial>();
  private lastNightness = NaN;
  private lastSpecular = NaN;
  private readonly nightTint = new T.Color();

  private cacheNightMaterials(){
    this.lastNightness = NaN;
    this.nightMaterials.clear();
    this.root.traverse(object=>{
      if(!(object instanceof T.Mesh)) return;
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!(material instanceof T.MeshStandardMaterial)||this.nightMaterials.has(material)) continue;
        this.nightMaterials.add(material);
        material.userData.nightBaseEmission = material.emissive.clone();
        material.userData.nightBaseIntensity = material.emissiveIntensity;
        if(material instanceof T.MeshPhysicalMaterial){
          material.userData.baseSpecular=material.specularIntensity;
          material.userData.baseCoatRoughness=material.clearcoatRoughness;
        }
      }
    });
  }

  setNightness(n:number,visibleLight=1,rain=0){
    // A dim sky still lights the airframe. Distinct highlights need an exposed source.
    const specular=T.MathUtils.lerp(.28,1,visibleLight)*(1-.64*n*rain);
    if(n===this.lastNightness&&specular===this.lastSpecular)return;
    this.lastNightness=n;this.lastSpecular=specular;
    for(const m of this.nightMaterials){
      setAircraftSkySpecular(m,specular);
      if(m instanceof T.MeshPhysicalMaterial){
        m.specularIntensity=m.userData.baseSpecular*T.MathUtils.lerp(.40,1,specular);
        m.clearcoatRoughness=T.MathUtils.lerp(m.userData.baseCoatRoughness,.78,1-specular);
      }
      m.emissive.copy(m.userData.nightBaseEmission);
      m.emissiveIntensity=m.userData.nightBaseIntensity;
      if(n>0&&!m.transparent){
        m.emissive.add(this.nightTint.copy(m.color).multiplyScalar(.010*n));
        m.emissiveIntensity=Math.max(1,m.emissiveIntensity);
      }
    }
    this.instruments?.setNightness(n);
  }
  update(dt:number,throttle:number,roll:number,pitch:number,yaw:number,airspeed=0,airborne=false,stopped=false){
    const rotationSpeed=this.rotor.update(dt,throttle,airspeed,airborne,stopped,this.aircraftId);
    for(const pivot of this.propellers)pivot.rotation.z+=dt*rotationSpeed*(typeof pivot.userData.rotation_direction==='number'?pivot.userData.rotation_direction:getAircraft(this.aircraftId).propellerDirection);
    for(const blur of this.blurs){const amount=Math.max(0,Math.min(1,(rotationSpeed-45)/130));blur.material.opacity=amount*.08;blur.visible=amount>0;}
    this.ailerons.forEach((object,i)=>object.rotation.x=(i===0?1:-1)*roll*.25);
    if(this.elevator)this.elevator.rotation.x=-pitch*.25;if(this.rudder)this.rudder.rotation.y=-yaw*.25;
  }
  updateInstruments(dt:number,airspeed:number,altitude:number,visible=true){if(this.instruments){this.instruments.root.visible=visible;this.instruments.update(dt,airspeed,altitude,this.rotor.angularSpeed*60/(Math.PI*2));}}
  dispose(){this.nightMaterials.clear();this.request++;disposeTree(this.root);this.root.clear();this.isLoading=false;}
}
