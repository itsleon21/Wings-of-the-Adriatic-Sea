import * as T from 'three';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {islands,townYaw} from './WorldConfig.ts';import {breakwaterLayout} from './IslandDetails.ts';
/** Two small lighthouses per bay, with selective real illumination and soft lens halos. */
export class TownHarborLights{
 readonly root=new T.Group();readonly bounds:T.Box3[]=[];readonly waterLights:T.Vector4[]=[];
 private lenses:T.MeshBasicMaterial[]=[];private halos:T.SpriteMaterial[]=[];private sites:T.Vector3[]=[];private lights=[0,1].map(()=>new T.PointLight(0xffd08c,0,150,2));private active=[false,false];private strength=0;
 constructor(){
  this.root.name='Harbour entrances / four illuminated small lighthouses';
  const parts=new Map<T.Material,T.BufferGeometry[]>(),plaster=new T.MeshStandardMaterial({color:0xe3d8bf,roughness:.82}),iron=new T.MeshStandardMaterial({color:0x46524b,roughness:.62,metalness:.4}),wood=new T.MeshStandardMaterial({color:0x674e39,roughness:.9});
  const size=32,pixels=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x+.5)/size-.5,(y+.5)/size-.5)*2,a=Math.max(0,Math.exp(-r*r*5)-Math.exp(-5));const k=(y*size+x)*4;pixels[k]=pixels[k+1]=pixels[k+2]=255;pixels[k+3]=Math.round(a*255);}
  const glow=new T.DataTexture(pixels,size,size);glow.needsUpdate=true;glow.magFilter=glow.minFilter=T.LinearFilter;
  const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number)=>{g.translate(x,y,z);const a=parts.get(m)??[];a.push(g);parts.set(m,a);};
  for(const d of islands.filter(d=>d.id==='harbor'||d.id==='town')){
   const yaw=d.id==='town'?townYaw:-Math.PI/2;
   for(const [i,arm] of breakwaterLayout(d).entries()){
    const {x,z}=arm.tip,h=arm.deckY,accent=new T.MeshStandardMaterial({color:i===0?0x9f4f38:0x3d6a5c,roughness:.65});
    add(new T.CylinderGeometry(2.5,2.7,.6,16),plaster,x,h+.3,z);add(new T.CylinderGeometry(1.65,2.1,7.3,16),plaster,x,h+4.1,z);add(new T.CylinderGeometry(1.84,1.91,1,16),accent,x,h+3.5,z);
    add(new T.BoxGeometry(.95,2.5,.18).rotateY(yaw),wood,x+Math.sin(yaw)*1.95,h+1.85,z+Math.cos(yaw)*1.95);add(new T.CylinderGeometry(2.1,2.1,.35,16),iron,x,h+7.9,z);
    const lens=new T.MeshBasicMaterial({color:i===0?0xffb09a:0xa1ead5,toneMapped:false});this.lenses.push(lens);add(new T.CylinderGeometry(1.55,1.55,1.45,12),lens,x,h+8.8,z);
    for(let j=0;j<6;j++){const a=j*Math.PI/3;add(new T.CylinderGeometry(.09,.09,1.7,5),iron,x+Math.cos(a)*1.65,h+8.8,z+Math.sin(a)*1.65);}
    add(new T.ConeGeometry(2.3,1.5,12),accent,x,h+10.15,z);add(new T.SphereGeometry(.18,6,4),iron,x,h+11,z);
    const haloMaterial=new T.SpriteMaterial({map:glow,color:0xffd19b,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});this.halos.push(haloMaterial);const halo=new T.Sprite(haloMaterial);halo.position.set(x,h+8.8,z);halo.scale.set(17,17,1);halo.name=d.id+' / beacon lens scatter';this.root.add(halo);
    this.sites.push(new T.Vector3(x,h+8.8,z));this.waterLights.push(new T.Vector4(x,z,85,0));this.bounds.push(new T.Box3(new T.Vector3(x-2.7,h,z-2.7),new T.Vector3(x+2.7,h+11.2,z+2.7)));
   }
  }
  for(const [material,geometries] of parts){const geometry=mergeGeometries(geometries,false)!;geometries.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,material);mesh.name='Small harbour lighthouses / batched structure';mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);}
  this.root.add(...this.lights);this.setNightness(0);
 }
 setNightness(n:number){this.strength=T.MathUtils.smoothstep(n,.18,.78);this.lenses.forEach((m,i)=>m.color.setHex(i%2===0?0xffb09a:0xa1ead5).multiplyScalar(.25+this.strength*5));for(const m of this.halos)m.opacity=this.strength*.35;for(const v of this.waterLights)v.w=this.strength;this.applyLights();}
 private applyLights(){this.lights.forEach((light,i)=>light.intensity=this.active[i]?this.strength*470:0);}
 updateView(p:T.Vector3){const near=this.sites.slice().sort((a,b)=>a.distanceToSquared(p)-b.distanceToSquared(p));this.lights.forEach((light,i)=>{this.active[i]=!!near[i]&&near[i].distanceToSquared(p)<800*800;if(near[i])light.position.copy(near[i]);});this.applyLights();}
}
