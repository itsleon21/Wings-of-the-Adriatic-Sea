import * as T from 'three';

export function instrumentAngle(value:number,maximum:number){
 const reading=Number.isFinite(value)?T.MathUtils.clamp(value,0,maximum):0;
 // A 270-degree sweep, clockwise from the lower left, viewed from the pilot's seat.
 return (225-reading/maximum*270)*Math.PI/180;
}
interface Dial {maximum:number;label:string;unit:string;x:number;y:number;radius:number;divisions:number}
const redwingDials:Dial[]=[
 {maximum:300,label:'AIR SPEED',unit:'km/h',x:-.17,y:.09,radius:.062,divisions:30},
 {maximum:2000,label:'ALTITUDE',unit:'m',x:0,y:.11,radius:.078,divisions:40},
 {maximum:2000,label:'PROPELLER',unit:'r/min',x:.18,y:.09,radius:.057,divisions:40},
];

function dialTexture(d:Dial){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const c=canvas.getContext('2d')!;c.translate(256,256);c.fillStyle='#121c20';c.fillRect(-256,-256,512,512);
 const ring=c.createRadialGradient(-70,-90,15,0,0,254);ring.addColorStop(0,'#253134');ring.addColorStop(1,'#10191c');c.fillStyle=ring;c.beginPath();c.arc(0,0,254,0,Math.PI*2);c.fill();
 c.strokeStyle='#9caa9f';c.lineWidth=2;c.beginPath();c.arc(0,0,237,0,Math.PI*2);c.stroke();
 for(let i=0;i<=d.divisions;i++){
  const a=instrumentAngle(i/d.divisions*d.maximum,d.maximum),major=i%5===0,inner=major?185:204;
  c.strokeStyle=major?'#eee8d2':'#a8afa0';c.lineWidth=major?5:2;
  c.beginPath();c.moveTo(Math.cos(a)*inner,-Math.sin(a)*inner);c.lineTo(Math.cos(a)*222,-Math.sin(a)*222);c.stroke();
  if(major){const value=Math.round(i/d.divisions*d.maximum);c.fillStyle='#eee8d2';c.font='27px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(String(d.maximum>1000?value/100:value),Math.cos(a)*159,-Math.sin(a)*159);}
 }
 c.textAlign='center';c.fillStyle='#c6c7b3';c.font='19px Georgia';c.fillText(d.label,0,-38);c.font='22px Georgia';c.fillText(d.maximum>1000?'×100 '+d.unit:d.unit,0,64);
 // Countersunk face screws and restrained perimeter glazing, not a flat HUD overlay.
 for(const x of[-168,168]){c.fillStyle='#65706b';c.beginPath();c.arc(x,152,7,0,Math.PI*2);c.fill();c.strokeStyle='#182023';c.lineWidth=2;c.beginPath();c.moveTo(x-4,148);c.lineTo(x+4,156);c.stroke();}
 const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}

/** Mounted on the actual existing Redwing panel. Face overlays cover the old
 * baked needles; new pointers have their pivot at the centre of each instrument. */
export class CockpitInstruments {
 readonly root=new T.Group();private pointers:T.Group[]=[];private readings=[0,0,0];
 private faces:T.MeshPhysicalMaterial[]=[];private needleMaterial:T.MeshStandardMaterial;
 constructor(){
  this.root.name='Redwing / working cockpit instruments';
  const needleMaterial=this.needleMaterial=new T.MeshStandardMaterial({color:0xf0e6c4,roughness:.52});
  const hubMaterial=new T.MeshStandardMaterial({color:0x494b43,metalness:.65,roughness:.38});
  redwingDials.forEach(d=>{
   const r=d.radius*.84,dial=new T.Group();dial.position.set(d.x,d.y,.334);this.root.add(dial);
   const texture=dialTexture(d),material=new T.MeshPhysicalMaterial({map:texture,emissiveMap:texture,roughness:.77,clearcoat:.18,clearcoatRoughness:.25});this.faces.push(material);
   const face=new T.Mesh(new T.CircleGeometry(r,48),material);dial.add(face);
   const pointer=new T.Group();pointer.position.z=.0018;dial.add(pointer);this.pointers.push(pointer);
   const shape=new T.Shape();shape.moveTo(-r*.18,-r*.055);shape.lineTo(r*.79,0);shape.lineTo(-r*.18,r*.055);shape.closePath();
   const needle=new T.Mesh(new T.ShapeGeometry(shape),needleMaterial);pointer.add(needle);
   const hub=new T.Mesh(new T.SphereGeometry(r*.075,12,8),hubMaterial);hub.scale.z=.35;hub.position.z=.0006;pointer.add(hub);
   pointer.rotation.z=instrumentAngle(0,d.maximum);
  });
 }
 update(dt:number,airspeed:number,altitude:number,rpm:number){
  const values=[airspeed*3.6,altitude,rpm],blend=1-Math.exp(-Math.max(0,dt)*9);
  for(let i=0;i<3;i++){this.readings[i]+=(Math.max(0,values[i])-this.readings[i])*blend;this.pointers[i].rotation.z=instrumentAngle(this.readings[i],redwingDials[i].maximum);}
 }
 setNightness(n:number){for(const m of this.faces){m.emissive.setRGB(.12*n,.15*n,.10*n);m.emissiveIntensity=1;}this.needleMaterial.emissive.setRGB(.05*n,.06*n,.035*n);}
}
