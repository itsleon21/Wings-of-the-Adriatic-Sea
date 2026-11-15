import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import type {Part} from './Workshop';
/** Reference-informed display geometry; engineering drawings are still needed for dimensional certification. */
export function partModel(part:Part){
 const root=new T.Group(),moving:T.Object3D[]=[];
 const metal=new T.MeshStandardMaterial({color:0xb5bbb8,metalness:.85,roughness:.28}),black=new T.MeshStandardMaterial({color:0x252c2b,metalness:.7,roughness:.38}),brass=new T.MeshStandardMaterial({color:0xa67535,metalness:.8,roughness:.32}),wood=new T.MeshPhysicalMaterial({color:0x784020,roughness:.35,clearcoat:.6}),red=new T.MeshPhysicalMaterial({color:0xa5221a,roughness:.28,metalness:.2,clearcoat:.8});
 const mesh=(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,parent:T.Object3D=root)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o;};
 const box=(w:number,h:number,d:number,m:T.Material,x=0,y=0,z=0)=>mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.12),m,x,y,z);
 const rod=(a:T.Vector3,b:T.Vector3,r:number,m:T.Material)=>{const o=mesh(new T.CylinderGeometry(r,r,a.distanceTo(b),12),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return o;};
 const bolts=(z:number,y:number)=>{for(const x of [-.2,.2])mesh(new T.SphereGeometry(.025,8,6),metal,x,y,z);};
 const prop=(z:number,reverse=false)=>{const p=new T.Group();p.position.z=z;root.add(p);moving.push(p);p.userData.sign=reverse?-1:1;mesh(new T.CylinderGeometry(.16,.16,.23,24),metal,0,0,0,p).rotation.x=Math.PI/2;for(const sign of [-1,1]){const shape=new T.Shape();shape.moveTo(0,.10);shape.bezierCurveTo(.13,.25,.25,.7,.12,1.35);shape.bezierCurveTo(.02,1.48,-.12,1.35,-.14,1.1);shape.lineTo(-.07,.14);shape.closePath();const blade=mesh(new T.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:3,steps:1,curveSegments:24}),part.aircraft==='mc72'?metal:wood,0,0,0,p);const positions=blade.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const y=positions.getY(i),x=positions.getX(i),z=positions.getZ(i)-.0175,twist=.38-.24*Math.min(1,y/1.4);positions.setXYZ(i,x*Math.cos(twist)-z*Math.sin(twist),y,x*Math.sin(twist)+z*Math.cos(twist));}blade.geometry.computeVertexNormals();blade.rotation.z=sign<0?Math.PI:0;}return p;};
 if(part.kind==='engine'){
  const mc=part.aircraft==='mc72',n=mc?12:6,spacing=mc?.22:.32,len=n*spacing;
  box(.52,.32,len+.24,metal,0,-.28);box(.39,.14,len+.16,black,0,-.49);box(.57,.035,len+.27,metal,0,-.39);
  for(let i=0;i<n+1;i++){const z=(i/n-.5)*len;for(const side of [-1,1]){mesh(new T.CylinderGeometry(.023,.023,.025,6),metal,side*.245,-.395,z);box(.035,.25,.04,metal,side*.26,-.25,z);}}
  const gear=mesh(new T.CylinderGeometry(.28,.24,.18,32),metal,0,-.24,-len/2-.15);gear.rotation.x=Math.PI/2;
  for(let i=0;i<10;i++){const a=i*Math.PI/5;const bolt=mesh(new T.CylinderGeometry(.024,.024,.03,6),black,Math.cos(a)*.22,-.24+Math.sin(a)*.22,-len/2-.25);bolt.rotation.x=Math.PI/2;}
  for(const side of [-1,1])for(const z of [-len*.37,len*.37]){box(.22,.05,.16,metal,side*.34,-.37,z);mesh(new T.CylinderGeometry(.03,.03,.06,6),black,side*.40,-.33,z);}
const rows=mc?[-1,1]:[0];
  for(const side of rows)for(let i=0;i<n;i++){const z=(i-(n-1)/2)*spacing,g=new T.Group();root.add(g);g.position.set(side*.14,-.08,z);g.rotation.z=-side*.48;
   mesh(new T.CylinderGeometry(.105,.115,.5,20),black,0,.25,0,g);mesh(new T.CylinderGeometry(.12,.12,.09,20),metal,0,.54,0,g);
   const piston=mesh(new T.CylinderGeometry(.055,.055,.12,12),brass,0,.65,0,g);moving.push(piston);piston.userData.piston=i*.85;
   for(const x of [-.065,.065]){const helix=[];for(let k=0;k<=80;k++){const a=k/80*Math.PI*12;helix.push(new T.Vector3(x+Math.cos(a)*.025,.58+k/80*.11,Math.sin(a)*.025));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(helix),80,.006,5,false),black,0,0,0,g);mesh(new T.BoxGeometry(.18,.022,.045),metal,0,.72,0,g);}
   const wire=new T.CatmullRomCurve3([new T.Vector3(0,.58,.10),new T.Vector3(.15,.65,.12),new T.Vector3(.23,.35,.10),new T.Vector3(.26,.05,.08)]);mesh(new T.TubeGeometry(wire,16,.008,6,false),black,0,0,0,g);

   for(const x of [-.07,.07])mesh(new T.CylinderGeometry(.012,.012,.5,8),metal,x,.28,.09,g);
   rod(new T.Vector3(side*.18,.38,z),new T.Vector3(side===0?.42:side*.48,.4,z+.06),.035,brass);bolts(z,-.42);
  }
  for(const side of rows){box(.18,.1,len,metal,side*.43,.53);rod(new T.Vector3(side===0?.35:side*.57,.26,-len/2),new T.Vector3(side===0?.35:side*.57,.26,len/2),.055,black);}
  for(let i=0;i<(mc?2:1);i++){const hub=mesh(new T.CylinderGeometry(.17-i*.05,.17-i*.05,.35,24),metal,0,-.2,-len/2-.25-i*.25);hub.rotation.x=Math.PI/2;moving.push(hub);hub.userData.sign=i?-1:1;hub.userData.shaft=true;mesh(new T.BoxGeometry(.05,.25,.04),brass,.1,-.2,-len/2-.44-i*.25);}
 }else if(part.kind==='propeller'){prop(0);if(part.aircraft==='mc72')prop(-.35,true).userData.phase=Math.PI/2;}
 else if(part.kind==='radiator'){
  const surface=part.aircraft==='mc72',width=surface?2.4:1.2,height=surface?.65:1.1;
  box(width+.10,height+.10,.15,metal);box(width,height,.18,black);
  for(let i=0;i<55;i++)box(.012,height,.20,brass,(i/54-.5)*width);
  if(!surface)for(let i=0;i<24;i++)box(width,.01,.22,brass,0,(i/23-.5)*height);
  for(const y of [-height/2-.045,height/2+.045]){box(width+.14,.08,.22,brass,0,y);for(let i=0;i<9;i++){const bolt=mesh(new T.CylinderGeometry(.018,.018,.02,6),metal,(i/8-.5)*width,y,.13);bolt.rotation.x=Math.PI/2;}}
  for(const side of [-1,1]){const curve=new T.CatmullRomCurve3([new T.Vector3(side*width*.35,height/2,0),new T.Vector3(side*width*.35,height/2+.2,0),new T.Vector3(side*width*.48,height/2+.24,-.18)]);mesh(new T.TubeGeometry(curve,20,.045,12,false),brass);}

 }else if(part.kind==='frame'){
  const len=part.aircraft==='mc72'?3.6:2.8;for(let i=0;i<7;i++){const z=(i/6-.5)*len,r=.4*(1-i*.07);for(let j=0;j<4;j++){const a=j*Math.PI/2+Math.PI/4,b=(j+1)*Math.PI/2+Math.PI/4;rod(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z),new T.Vector3(Math.cos(b)*r,Math.sin(b)*r,z),.022,part.aircraft==='m5'?wood:metal);if(i<6){const r2=.4*(1-(i+1)*.07);rod(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z),new T.Vector3(Math.cos(a)*r2,Math.sin(a)*r2,z+len/6),.025,wood);rod(new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,z),new T.Vector3(Math.cos(b)*r2,Math.sin(b)*r2,z+len/6),.009,metal);}}}
 }else{
  const twin=part.aircraft!=='redwing',stable=part.id.endsWith('-5'),boat=part.aircraft==='redwing',length=boat?3.3:part.aircraft==='mc72'?3.1:2.1,width=(stable?.33:.27)*(boat?1.6:1);
  for(const side of twin?[-1,1]:[0]){const vertices:number[]=[],indices:number[]=[],count=40,ring=16;
   for(let i=0;i<=count;i++){const t=i/count,z=(t-.5)*length,beam=Math.pow(Math.sin(Math.PI*t),.55)*width;
    for(let j=0;j<ring;j++){const angle=j/ring*Math.PI*2,x=Math.cos(angle)*beam;let y=Math.sin(angle)*beam*(Math.sin(angle)<0?.85:.5);if(Math.sin(angle)<0&&t>.53)y+=.10*Math.sin(Math.PI*t);vertices.push(side*.66+x,y,z);}
   }
   for(let i=0;i<count;i++)for(let j=0;j<ring;j++){const a=i*ring+j,b=i*ring+(j+1)%ring,c=a+ring,d=b+ring;indices.push(a,b,c,b,d,c);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(geometry,part.aircraft==='m5'?wood:red);
   for(let i=1;i<8;i++){const t=i/8,beam=Math.pow(Math.sin(Math.PI*t),.55)*width,pts=[];for(let j=0;j<=ring;j++){const a=j/ring*Math.PI*2;pts.push(new T.Vector3(side*.66+Math.cos(a)*beam*1.005,Math.sin(a)*beam*(Math.sin(a)<0?.85:.5)+(Math.sin(a)<0&&t>.53?.10*Math.sin(Math.PI*t):0),(t-.5)*length));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),48,.004,5,false),metal);}
   for(const z of [-.45,.45]){box(width*.8,.025,.13,metal,side*.66,width*.46,z);for(const x of [-.08,.08])mesh(new T.CylinderGeometry(.017,.017,.02,6),black,side*.66+x,width*.5,z);}
   if(part.aircraft==='mc72')for(let i=0;i<8;i++)box(.014,.01,.8,brass,side*.66+(i-3.5)*.03,width*.5+.012,-.55);
  }

 }
 return {root,moving};
}
export class PartViewer{
 private renderer:T.WebGLRenderer;private scene=new T.Scene();private camera=new T.PerspectiveCamera(38,1,.01,100);private controls:OrbitControls;private observer:ResizeObserver;private frame=0;private model:ReturnType<typeof partModel>;private env:T.WebGLRenderTarget;private floor?:T.Mesh;private elapsed=0;private previous=performance.now();running=true;
 constructor(host:HTMLElement,part:Part){this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0x172b34);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;host.append(this.renderer.domElement);const pm=new T.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.env=pm.fromScene(room);room.dispose();pm.dispose();this.scene.environment=this.env.texture;this.scene.add(new T.HemisphereLight(0xffffff,0x655743,.8));const light=new T.DirectionalLight(0xffe8c1,2);light.position.set(3,5,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;light.shadow.camera.near=.1;light.shadow.camera.far=20;light.shadow.normalBias=.025;this.scene.add(light);this.model=partModel(part);this.scene.add(this.model.root);this.model.root.rotation.y=-.25;this.model.root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});const bounds=new T.Box3().setFromObject(this.model.root);this.floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:0x1d3037,roughness:.8}));this.floor.rotation.x=-Math.PI/2;this.floor.position.y=bounds.min.y-.10;this.floor.receiveShadow=true;this.scene.add(this.floor);this.camera.position.set(3,2.2,4);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=.8;this.controls.maxDistance=10;this.observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();});this.observer.observe(host);this.tick();}
 reset(){this.camera.position.set(3,2.2,4);this.controls.target.set(0,0,0);this.controls.update();}
 private tick=()=>{this.frame=requestAnimationFrame(this.tick);const now=performance.now(),dt=Math.min(.05,(now-this.previous)/1000);this.previous=now;if(this.running&&!document.hidden){this.elapsed+=dt;const t=this.elapsed;for(const o of this.model.moving){if(o.userData.piston!==undefined)o.position.y=.65+Math.sin(t*5+o.userData.piston)*.035;else if(o.userData.shaft){o.rotation.set(Math.PI/2,0,0);o.rotateOnWorldAxis(new T.Vector3(0,0,1),t*2*(o.userData.sign??1));}else o.rotation.z=t*2*(o.userData.sign??1)+(o.userData.phase??0);}}this.controls.update();if(!document.hidden)this.renderer.render(this.scene,this.camera);};
 dispose(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.controls.dispose();this.model.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.floor?.geometry.dispose();if(this.floor)(this.floor.material as T.Material).dispose();this.scene.traverse(o=>{if(o instanceof T.DirectionalLight)o.shadow.dispose();});this.env.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
