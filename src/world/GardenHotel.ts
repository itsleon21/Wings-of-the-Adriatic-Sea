import {buildHarborBoat} from './VesselModel.ts';
import {LighthouseBeacon} from './LighthouseBeacon.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {hotelIsland,hotelScale,hotelWidthScale,hotelArchitectureWidth,hotelElevation,hotelOutline,insideHotel,random} from './WorldConfig.ts';
/** Original Hotel Adriano, authored from the supplied five-view reference in metre units. */
export class GardenHotel{
 private beacon=new LighthouseBeacon();
 private lanterns=new T.MeshStandardMaterial({color:0xffe3b3,emissive:0xffb65e,emissiveIntensity:0});
 private lightPools=new T.MeshBasicMaterial({color:0xffb560,transparent:true,opacity:0,depthWrite:false});
 readonly root=new T.Group();private windows=new T.MeshStandardMaterial({color:0x54706c,roughness:.28,metalness:.12,emissive:0xffc57c});
 constructor(blockers:T.Box3[]){
  const d=hotelIsland,rng=random(d.seed),batches=new Map<T.Material,T.BufferGeometry[]>();this.root.name='Garden Hotel / villa, sea walls and flowering garden';this.root.position.set(d.x,0,d.z);this.root.scale.setScalar(hotelScale);
  const mat=(color:number,roughness=.88)=>new T.MeshStandardMaterial({color,roughness});
  const stone=mat(0xc5b798),trim=mat(0xe5dbc1),plaster=mat(0xe6d9b9),roof=mat(0xa95130),wood=mat(0x8c724f),iron=mat(0x46574d,.55),lawn=mat(0x879363),copper=mat(0x6f8865,.56),shadow=mat(0x354b45),water=mat(0x669c91,.25);
  stone.color.setHex(0xf2e6cc);stone.map=stoneTexture();roof.map=roofTexture();roof.bumpMap=roof.map;roof.bumpScale=.15;roof.color.setHex(0xffffff);roof.userData.architecture=true;plaster.userData.architecture=true;
  const shutters=mat(0x426e63);
  const foliage=[0x3e5931,0x516c36,0x667b3e,0x7f8a47,0x4b6a48,0x8b9858].map(c=>mat(c));
  const flowers=[0xe6c6d5,0xd0b3dc,0xf1e4c0,0xd7bc69,0xe2a6ae,0xadbbd3].map(c=>mat(c));

  let architecture=false;
  const add=(geo:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,r=new T.Euler())=>{
   geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(r),new T.Vector3(1,1,1)));
   const positions=geo.getAttribute('position');
   for(let i=0;i<positions.count;i++)positions.setXYZ(i,positions.getX(i)*(architecture?hotelArchitectureWidth:hotelWidthScale),hotelElevation(positions.getY(i)),positions.getZ(i));
   geo.computeVertexNormals();
   if(geo.index){const name=geo.name,g=geo.toNonIndexed();g.name=name;geo.dispose();geo=g;}
   const p=geo.attributes.position,n=geo.attributes.normal,uv=new Float32Array(p.count*2);
   for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));uv[i*2]=(nx>nz?p.getZ(i):p.getX(i))*.05;uv[i*2+1]=(ny>.7?p.getZ(i):p.getY(i))*.05;}
   geo.setAttribute('uv',new T.BufferAttribute(uv,2));if(geo.name){const mesh=new T.Mesh(geo,m);mesh.name=geo.name;mesh.castShadow=mesh.receiveShadow=true;this.root.add(mesh);return;}const parts=batches.get(m)??[];parts.push(geo);batches.set(m,parts);
  };
  const box=(m:T.Material,x:number,y:number,z:number,w:number,h:number,l:number,rot=0)=>add(new T.BoxGeometry(w,h,l),m,x,y,z,new T.Euler(0,rot,0));
  const cyl=(m:T.Material,x:number,y:number,z:number,r:number,h:number,r2=r,n=12)=>add(new T.CylinderGeometry(r,r2,h,n),m,x,y,z);
  const arch=(m:T.Material,x:number,y:number,z:number,w:number,h:number,rot=0)=>{const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.lineTo(-w/2,0);add(new T.ExtrudeGeometry(s,{depth:.3,bevelEnabled:false,curveSegments:16}),m,x,y,z,new T.Euler(0,rot,0));};
  const hip=(x:number,y:number,z:number,w:number,l:number,h:number)=>{const v=[-w/2,0,-l/2,w/2,0,-l/2,w/2,0,l/2,-w/2,0,l/2,0,h,-l*.28,0,h,l*.28],ids=[0,4,1,1,4,5,1,5,2,2,5,3,3,5,4,3,4,0];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ids.flatMap(i=>v.slice(i*3,i*3+3)),3));g.computeVertexNormals();g.name=`Hotel pitched roof ${x}/${y}/${z}`;add(g,roof,x,y,z);};
  const balustrade=(x:number,z:number,length:number,alongX=true,y=29)=>{box(trim,x,y+1.7,z,alongX?length:1.2,.65,alongX?1.2:length);box(trim,x,y-1.5,z,alongX?length:1.4,.6,alongX?1.4:length);for(let i=0;i<=length/2.6;i++){const t=-length/2+i*2.6;const xx=x+(alongX?t:0),zz=z+(alongX?0:t);cyl(trim,xx,y,zz,.32,2.7,.44,7);cyl(trim,xx,y+.8,zz,.48,.5,.36,7);}};
  // Narrow frontage, long garden plot. Retaining walls follow an asymmetric, stepped garden perimeter.
  const outline=hotelOutline.map(([x,z])=>[x/hotelWidthScale,z]);
  const shape=new T.Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();const podium=new T.ExtrudeGeometry(shape,{depth:33,bevelEnabled:false});podium.rotateX(-Math.PI/2);add(podium,stone,0,-6,0);
  const deck=new T.ShapeGeometry(shape);deck.rotateX(-Math.PI/2);add(deck,trim,0,27.04,0);
  // Seaward retaining wall has a moulded cornice, corner piers, grilles and hanging ivy.
  for(let i=0;i<outline.length;i++){
   const [ax,az]=outline[i], [bx,bz]=outline[(i+1)%outline.length];
   const length=Math.hypot(bx-ax,bz-az),angle=-Math.atan2(bz-az,bx-ax);
   box(trim,(ax+bx)/2,26.4,(az+bz)/2,length,1.3,2,angle);
   box(trim,(ax+bx)/2,29.4,(az+bz)/2,length,.65,1.2,angle);
   for(let j=0;j<=length/3;j++){
    const t=j/Math.ceil(length/3);cyl(trim,ax+(bx-ax)*t,28,(az+(bz-az)*t),.3,2.5,.4,7);
   }
   box(stone,ax,11,az,4,32,4);box(trim,ax,29.5,az,5,1.2,5);
  }
  arch(trim,45,-1,190.65,17,12);arch(iron,45,-.5,191.02,14,10.5);for(let x=39;x<=51;x+=1.4)box(iron,x,4,191.5,.22,9,.25);
  // Close-fitting timber boardwalk; one side staircase climbs all the way from the sea.
  box(wood,0,5.67,198,268,.65,9);box(wood,129,5.67,78,9,.65,231);box(wood,-110,5.67,218.75,9,.65,32.5);
  for(let x=-130;x<134;x+=4){box(wood,x,6.05,198,.12,.12,9);for(const z of[194.8,201.2])cyl(wood,x,.35,z,.25,10.6,.3,7);}
  for(let z=-36;z<193.5;z+=4){box(wood,129,6.05,z,9,.12,.12);cyl(wood,131,.35,z,.25,10.6,.3,7);}
  for(let z=205;z<=234;z+=4)for(const x of[-113,-107])cyl(wood,x,.35,z,.25,10.6,.3,7);
  // A single watertight stair body, not disconnected floating tread boxes.
  const stairProfile=new T.Shape();stairProfile.moveTo(-194.5,5.1);stairProfile.lineTo(-194.5,5.95);
  for(let i=0;i<48;i++){
   const z=194.5-(i+1)*1.6;stairProfile.lineTo(-z,5.95+i*(21.05/47));
   if(i<47)stairProfile.lineTo(-z,5.95+(i+1)*(21.05/47));
  }
  stairProfile.lineTo(-(194.5-48*1.6),5.1);stairProfile.closePath();
  const stairBody=new T.ExtrudeGeometry(stairProfile,{depth:6,bevelEnabled:false});stairBody.rotateY(Math.PI/2);
  add(stairBody,stone,126,0,0);
  box(trim,126,27,115,12,.7,8);
  for(const side of [-1,1]){
   const x=129+side*2.8;
   for(let i=0;i<=48;i+=4)cyl(trim,x,7.15+i*(21.05/48),194.5-i*1.6,.3,2.4);
   const delta=new T.Vector3(0,21.05,-48*1.6),rail=new T.BoxGeometry(.65,.65,delta.length());
   const rotation=new T.Euler(Math.atan2(21.05,48*1.6),0,0);add(rail,trim,x,17.675,194.5-24*1.6,rotation);
  }
  const tender=buildHarborBoat(3);tender.name='Hotel jetty / moored tender';
  tender.scale.setScalar(1.35*1.05);tender.position.set(-92*hotelWidthScale,.35,220);this.root.add(tender);this.root.updateMatrixWorld(true);blockers.push(new T.Box3().setFromObject(tender));
  // Two visible mooring ropes attach the boat to the timber jetty.
  for(const z of [214,226]){
   const start=new T.Vector3(-106*hotelWidthScale,hotelElevation(3),z),end=new T.Vector3(-95*hotelWidthScale,2,z);
   const rope=new T.Mesh(new T.TubeGeometry(new T.LineCurve3(start,end),1,.11,4,false),wood);this.root.add(rope);
  }
  architecture=true;
  // One connected villa at the seaward end; every elevation uses the same coordinates.
  // Storeys 27–43–59–75, roof ridge 95; the tower shaft starts at the foundation.
  box(plaster,0,51,104,114,48,84);box(trim,0,28,104,118,2,88);
  hip(0,75,104,122,92,32);
  // Rear cross-wing touches the main block, rather than a collection of detached roofs.
  box(plaster,12,47,42,90,40,48);hip(12,67,42,98,56,24);
  box(plaster,-35,37,46,35,20,50);hip(-35,47,46,41,56,10);
  // Entrance porch on the garden side, grounded on the same terrace.
  box(plaster,12,34,13,23,14,15);hip(12,41,13,29,21,9);
  for(const y of [28,43,59,75]){
   box(trim,0,y,146.3,115,.7,1.4);
   for(const side of [-1,1])box(trim,side*57.3,y,104,1.4,.7,84);
  }
  for(const x of [-55,55])for(let y=30;y<75;y+=3)box(stone,x,y,146.8,3,1.35,1.5);
  const frontWindow=(x:number,y:number,w=7,h=10)=>{
   arch(trim,x,y,146.8,w+1.7,h+1.1);arch(this.windows,x,y+.7,147.15,w,h);
   box(trim,x,y+.2,147.6,w+2,.6,1.8);
   box(trim,x,y+h*.5,147.55,.3,h-.5,.25);box(trim,x,y+h*.62,147.55,w,.25,.25);
   for(const side of [-1,1])box(shutters,x+side*(w/2+1.8),y+h*.47,147.3,2,h-.2,.45);
  };
  for(const x of [-43,-27,27,43])for(const y of [30,46,62])frontWindow(x,y);
  for(const side of [-1,1])for(const z of [76,96,118,136])for(const y of [30,46,62]){
   arch(trim,side*57.3,y,z,8.4,11.1,side*Math.PI/2);
   arch(this.windows,side*57.65,y+.7,z,6.8,9.8,side*Math.PI/2);
   box(trim,side*58.2,y+.3,z,1.9,.65,9.6);
   box(wood,side*58.1,y+5.3,z,.35,8.4,.38);
   box(wood,side*58.1,y+6.6,z,.35,.38,6.6);
  }
  for(const x of [-20,0,22,44])for(const y of [30,46]){
   arch(trim,x,y,17.7,8,11,Math.PI);arch(this.windows,x,y+.6,17.3,6.5,9.5,Math.PI);
  }
  for(const side of [-1,1])for(const z of [29,49])for(const y of [30,46]){
   const x=side<0?-52.6:57.3;
   arch(trim,x,y,z,8,11,side*Math.PI/2);arch(this.windows,x+side*.35,y+.6,z,6.4,9.5,side*Math.PI/2);
  }
  arch(trim,0,27.3,147,16,20);arch(wood,0,28,147.4,13.6,18.4);
  arch(shadow,0,30,147.8,10,14);box(trim,0,37,148,.4,16,.3);
  frontWindow(0,48,12,19);frontWindow(0,77,6,10);
  // Central curved gable is tied to the facade and supported by the main wall.
  const gable=new T.Shape();gable.moveTo(-14,0);gable.lineTo(14,0);
  gable.bezierCurveTo(12,8,7,8,7,15);gable.bezierCurveTo(7,22,4,26,0,27);
  gable.bezierCurveTo(-4,26,-7,22,-7,15);gable.bezierCurveTo(-7,8,-12,8,-14,0);
  add(new T.ExtrudeGeometry(gable,{depth:2,bevelEnabled:true,bevelSegments:2,bevelSize:.35,bevelThickness:.2,curveSegments:20}),trim,0,72,145.9);
  arch(this.windows,0,78,148.25,6,9);
  for(const y of [47,75]){
   box(trim,0,y,150.5,17,1.2,8);balustrade(0,154,17,true,y+2.7);
   for(const x of [-6,6])box(stone,x,y-1.8,149.5,1.4,3.4,3);
  }
  // Dormer boxes intersect the sloping roof, avoiding buried or floating ornaments.
  for(const x of [-34,34]){
   box(plaster,x,90,138,10,14,11);hip(x,97,138,13,14,5);
   arch(trim,x,87,143.7,6.4,8.2);arch(this.windows,x,87.6,144.1,5,7);
  }
  for(const [x,z] of [[-39,93],[39,93],[-20,39],[44,39]]){
   box(stone,x,84,z,2.7,17,3);box(trim,x,92.7,z,3.8,.8,4);
  }
  // Structural tower: a continuous shaft from terrace to belfry, penetrating the roof.
  const towerX=0,towerZ=119;
  const shaft=new T.BoxGeometry(13,95,13).toNonIndexed();shaft.name='Hotel continuous tower shaft';add(shaft,plaster,towerX,74.5,towerZ);
  for(const y of [106,110,122])box(trim,towerX,y,towerZ,15,1,15);
  for(let side=0;side<4;side++){
   const angle=side*Math.PI/2,face=new T.Group();face.name='Hotel clock face';
   face.add(new T.Mesh(new T.CircleGeometry(3.5,32),trim));
   face.add(new T.Mesh(new T.TorusGeometry(3.7,.25,8,32),stone));
   for(let hour=0;hour<12;hour++){
    const a=hour*Math.PI/6,mark=new T.Mesh(new T.BoxGeometry(.22,.6,.16),iron);
    mark.position.set(Math.sin(a)*2.9,Math.cos(a)*2.9,.18);mark.rotation.z=-a;face.add(mark);
   }
   for(const [length,turn] of [[2.5,-Math.PI/3],[1.7,Math.PI/6]]){
    const hand=new T.Mesh(new T.BoxGeometry(.23,length,.2),iron);
    hand.position.set(-Math.sin(turn)*length/2,Math.cos(turn)*length/2,.35);hand.rotation.z=turn;face.add(hand);
   }
   face.position.set((towerX+Math.sin(angle)*6.6)*hotelArchitectureWidth,hotelElevation(116),towerZ+Math.cos(angle)*6.6);face.rotation.y=angle;this.root.add(face);
  }
  cyl(trim,0,123,119,7.7,1.4,7.7,16);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(trim,Math.cos(a)*5.3,127.5,119+Math.sin(a)*5.3,.55,8);}
  cyl(trim,0,131.5,119,7.7,1,7.7,16);
  add(new T.SphereGeometry(7.3,24,16,0,Math.PI*2,0,Math.PI/2),copper,0,132,119);
  cyl(iron,0,141,119,.18,5);add(new T.SphereGeometry(.6,12,8),trim,0,143.7,119);
  this.beacon.root.position.set(0,hotelElevation(127.5),119);this.beacon.root.scale.setScalar(.30);this.root.add(this.beacon.root);

  architecture=false;
  // Front terrace is intimate: two striped parasols, cafe tables, lawns and climbing vines.
  const awnings=[mat(0xce6845),mat(0x76a8ab)],ivory=mat(0xf0e6c7);
  for(const [x,z,k]of[[-20,172,0],[30,174,1]]){cyl(wood,x,29.5,z,.4,4);cyl(trim,x,30,z,3,.5);cyl(wood,x,33,z,.12,9);for(let j=0;j<12;j++){const g=new T.ConeGeometry(6,2.4,1,1,true,j/12*Math.PI*2,Math.PI/6);add(g,j%2?ivory:awnings[k],x,37.3,z);}for(const side of[-1,1])box(wood,x+side*4.7,29,z,1.8,2.5,1.8);}
  box(lawn,-64,27.3,141,35,.5,48);box(lawn,64,27.3,144,32,.5,45);
  // Rear garden is a dense, irregular botanical composition, with linked paths and planted edges.
  box(lawn,0,27.25,-104,194,.4,146);
  const pathSamples:T.Vector3[]=[];
  const gardenPath=(points:number[][],width=5)=>{
   const curve=new T.CatmullRomCurve3(points.map(([x,z])=>new T.Vector3(x,27.6,z)));
   pathSamples.push(...curve.getPoints(64));
   const verts:number[]=[];
   for(let i=0;i<64;i++){
    const a=curve.getPoint(i/64),b=curve.getPoint((i+1)/64),n=new T.Vector3(b.z-a.z,0,a.x-b.x).normalize().multiplyScalar(width/2);
    const corners=[a.clone().add(n),a.clone().sub(n),b.clone().add(n),b.clone().sub(n)];
    for(const k of [0,1,2,1,3,2])verts.push(...corners[k].toArray());
   }
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.computeVertexNormals();add(geo,trim);
  };
  gardenPath([[12,3],[0,-24],[-28,-59],[8,-94],[32,-132],[8,-175]],6);
  gardenPath([[-92,-150],[-55,-135],[0,-118],[55,-104],[94,-125]]);
  gardenPath([[-28,-59],[-73,-76],[-75,-125],[-55,-163]]);
  gardenPath([[0,-24],[59,-54],[74,-77],[55,-104]]);

  const bush=(x:number,z:number,r:number,m:T.Material,y=28)=>{const g=new T.IcosahedronGeometry(1,0);g.scale(r,1.1+r*.45,r*.85);add(g,m,x,y,z);};
  for(let i=0;i<360;i++){
   const x=(rng()-.5)*190,z=-177+rng()*121;if(pathSamples.some(p=>Math.hypot(p.x-x,p.z-z)<7))continue;
   const edge=Math.abs(x)>77||z< -148||z> -77;const r=2.3+rng()*3.6;bush(x,z,r,foliage[i%foliage.length],28+r*.2);
   if(edge||i%3===0)for(let j=0;j<3;j++)bush(x+(rng()-.5)*r*1.7,z+(rng()-.5)*r*1.7,1.9+rng()*1.8,flowers[(Math.floor((z+180)/29)+Math.floor((x+110)/43)+j%2)%flowers.length],30+r*.5+rng());
  }
  // Natural flowering trees: uneven crowns and a shaded rear grove, no evenly spaced orchard rows.
  const tree=(x:number,z:number,h:number,bloom=false)=>{cyl(wood,x,27+h*.30,z,.5,h*.6,.85,7);for(let j=0;j<10;j++){const a=rng()*6.28,r=rng()*6;const g=new T.IcosahedronGeometry(1,1);g.scale(3+rng()*3.7,2.5+rng()*3.5,3+rng()*3.7);add(g,bloom&&j%3===0?flowers[j%flowers.length]:foliage[Math.floor(rng()*foliage.length)],x+Math.cos(a)*r,27+h-4+rng()*5,z+Math.sin(a)*r);}};
  for(const [cx,cz] of [[-62,-145],[55,-90],[70,-154],[-78,-66]]){
   for(let j=0;j<10;j++){
    const angle=rng()*Math.PI*2, radius=Math.sqrt(rng())*28;
    const x=cx+Math.cos(angle)*radius,z=cz+Math.sin(angle)*radius;
    if(!pathSamples.some(p=>Math.hypot(p.x-x,p.z-z)<9)) tree(x,z,12+rng()*15,j%4===0);
   }
  }
  const sites=[[-88,-155],[-59,-162],[-29,-152],[22,-162],[68,-151],[94,-131],[-91,-111],[-72,-81],[-101,-40],[91,-70],[-96,35],[91,40],[-86,114],[82,115],[-85,158],[75,163]];
  sites.forEach(([x,z],i)=>tree(x+(rng()-.5)*8,z+(rng()-.5)*8,13+rng()*13,i%4===0));
  // Tall cypresses frame the roof and extend through the side garden, like the reference silhouette.
  for(const [x,z,h]of[[-70,82,95],[-83,58,69],[70,67,83],[83,21,66],[-53,-48,47],[61,-97,52],[-80,-136,39]]){
   // Position at the edge of the narrowed strip, clear of the unscaled facade.
   const px=z>0?Math.sign(x)*Math.max(Math.abs(x),92):x;
   cyl(wood,px,27+h*.075,z,.45,h*.15,.75,7);
   const crown=new T.ConeGeometry(7.0,h*.93,18,16);
   const vertices=crown.getAttribute('position');
   for(let k=0;k<vertices.count;k++){
    const f=(vertices.getY(k)+h*.465)/(h*.93),a=Math.atan2(vertices.getZ(k),vertices.getX(k));
    const ripple=1+.045*Math.sin(a*5+f*11)+.025*Math.sin(a*9-f*15);
    vertices.setX(k,vertices.getX(k)*ripple);vertices.setZ(k,vertices.getZ(k)*ripple);
   }
   crown.computeVertexNormals();add(crown,foliage[0],px,27+h*.53,z);

  }
  // Side borders, ivy spilling over wall copings and a private garden pavilion.
  for(let i=0;i<140;i++){const side=i%2?1:-1,z=-171+rng()*340,x=side*(z< -45?94+rng()*5:108+rng()*7);bush(x,z,2+rng()*3,foliage[i%foliage.length],28);if(i%2===0)bush(x,z,1+rng(),flowers[i%flowers.length],31);}
  for(let i=0;i<210;i++){const front=i%3===0,side=i%2?1:-1,x=front?-98+rng()*196:side*124,z=front?190.9:5+rng()*155,hang=rng()*17;if(front&&((x>13&&x<52)||Math.abs(x+3)<4))continue;const g=new T.IcosahedronGeometry(1,0);g.scale(front?1.2+rng()*2:.5,1.5+rng()*2.8,front?.5:1.2+rng()*2);add(g,foliage[i%foliage.length],x,26-hang,z);if(front){for(let k=0;k<4;k++){const bloom=new T.IcosahedronGeometry(1,0);bloom.scale(.85,.72,.42);add(bloom,flowers[(i+Math.floor(k/3))%flowers.length],x+(k%2-.5)*1.4,26-hang+Math.floor(k/2)*1.15,z+.65);}}}
  architecture=true;
  for(let i=0;i<38;i++){const x=(rng()-.5)*108,y=31+rng()*42;if(Math.abs(x)<10||Math.abs((x+5)%13)<4)continue;const g=new T.IcosahedronGeometry(1,0);g.scale(1+rng(),1.6+rng()*2,.35);add(g,foliage[i%foliage.length],x,y,147.95);}
  architecture=false;
  cyl(trim,-65,28,-114,9,1.4,9,8);for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(trim,-65+Math.cos(a)*7,33,-114+Math.sin(a)*7,.35,9);}add(new T.ConeGeometry(11,8,8),roof,-65,40,-114);
  cyl(stone,0,28,-118,8,1.2);cyl(water,0,28.7,-118,7,.2);cyl(trim,0,30,-118,.7,2.6);cyl(trim,0,31.5,-118,3,.5);
  // Baked radial falloff lights the paving without a real-time light per lantern.
  const size=64, texels=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=(y*size+x)*4, radius=Math.hypot((x+.5)/32-1,(y+.5)/32-1);
   texels.set([255,255,255,Math.round(255*Math.max(0,1-radius)**2)],i);
  }
  const glow=new T.DataTexture(texels,size,size);glow.magFilter=T.LinearFilter;glow.needsUpdate=true;this.lightPools.map=glow;
  for(const [x,z] of [[-4,-162],[4,-138],[-4,-98],[4,-74],[-75,-114],[-38,-122],[40,-114],[76,-122],[-18,168],[25,168],[-94,135],[94,135],[-94,84],[94,84],[-94,28],[94,28],[-38,-8],[38,-8]]){
   cyl(iron,x,30,z,.28,5);cyl(this.lanterns,x,33,z,.85,1.7,.65,8);
   add(new T.ConeGeometry(1.15,.8,8),iron,x,34.3,z);
   const pool=new T.Mesh(new T.PlaneGeometry(22,22),this.lightPools);pool.rotation.x=-Math.PI/2;pool.position.set(x*hotelWidthScale,hotelElevation(27.8),z);this.root.add(pool);
  }
  // Italian seafront details use the same terrace coordinates, elevation and material batches.
  const terracotta=mat(0xad5e3c),potRim=mat(0xc57b4f),soil=mat(0x51412c),lemon=mat(0xe6be44,.52),vineLeaf=mat(0x55713a),bougainvillea=mat(0xba6887),ceramic=mat(0x71999a,.58);
  for(const [x,z] of [[-78,168],[78,168],[-78,184],[78,184],[30,-22],[61,-70]]){
   cyl(terracotta,x,28.5,z,2.4,2.9,1.7,12);cyl(potRim,x,29.8,z,2.55,.45,2.55,12);cyl(soil,x,29.95,z,2.20,.12,2.20,12);
   cyl(wood,x,32.2,z,.26,4.6,.42,7);
   const crown=new T.IcosahedronGeometry(1,1);crown.scale(3.4,3.8,3);add(crown,vineLeaf,x,35,z);
   for(let j=0;j<8;j++){const a=j*Math.PI/4;const fruit=new T.SphereGeometry(.48,7,5);fruit.scale(.72,1.1,.72);add(fruit,lemon,x+Math.cos(a)*2.8,34.8+Math.sin(a*2)*1.2,z+Math.sin(a)*2.5);}
  }
  for(const [x,z] of [[-61,180],[62,180]]){
   cyl(iron,x,28.6,z,.22,3.0,.30,8);cyl(trim,x,30.25,z,2.7,.35,2.7,20);cyl(ceramic,x,30.46,z,2.4,.08,2.4,20);
   for(const angle of[0,Math.PI*.66,Math.PI*1.33]){const xx=x+Math.cos(angle)*4.2,zz=z+Math.sin(angle)*4.2;cyl(wood,xx,28.1,zz,1.15,.25,1.15,12);for(const dx of[-.70,.70])box(iron,xx+dx,27.65,zz,.12,1.3,.12);box(iron,xx,29.2,zz+1,2.2,2.2,.13);}
   for(const dx of[-.8,.8]){cyl(trim,x+dx,30.65,z,.28,.34,.28,10);cyl(wood,x+dx,30.84,z,.20,.04,.20,10);}
  }
  // A vine-covered pergola straddles the existing garden walk behind the cross-wing.
  const px=46,pz=-49;
  for(const x of[px-9,px+9])for(const z of[pz-13,pz+13]){cyl(trim,x,27.4,z,1.0,.6,1.1,10);box(wood,x,30.8,z,.55,7.5,.55);cyl(terracotta,x,28.1,z,1.45,1.6,1.15,10);}
  for(const x of[px-9,px+9])box(wood,x,34.7,pz,.7,.65,29);
  for(let i=0;i<12;i++)box(wood,px,35,pz-14+i*2.55,21,.35,.3);
  for(let i=0;i<20;i++){const x=px+(rng()-.5)*19,z=pz+(rng()-.5)*27,g=new T.IcosahedronGeometry(1,0);g.scale(2.1,.55,2.6);add(g,vineLeaf,x,35.5,z);if(i%3===0){const flower=new T.IcosahedronGeometry(1,0);flower.scale(1.4,.55,1.1);add(flower,bougainvillea,x,35.9,z);}}
  for(const z of[pz-7,pz+7]){box(wood,px,28.6,z,10,.4,2.2);for(const x of[px-4,px+4])box(iron,x,27.85,z,.25,1.5,1.5);}
  for(let i=0;i<9;i++){const z=pz-12+i*3;add(new T.SphereGeometry(.26,7,5),this.lanterns,px,34.15-Math.sin(i/8*Math.PI)*.8,z);}
  // A modest tricolour at the working jetty, with a softly curved cloth silhouette.
  cyl(iron,-128,14.95,198,.18,18,.28,8);add(new T.SphereGeometry(.32,8,6),trim,-128,24.1,198);
  const flagPositions:number[]=[],flagColors:number[]=[],flagPalette=[new T.Color(0x347953),new T.Color(0xece6d5),new T.Color(0xba4e40)];
  for(let stripe=0;stripe<3;stripe++)for(let j=0;j<6;j++){
   const x0=-128+stripe*4+j*4/6,x1=x0+4/6,cloth=(x:number,y:number)=>[x,y,198+Math.sin((x+128)*.45)*.7];
   for(const [x,y] of[[x0,23],[x0,15.6],[x1,23],[x1,23],[x0,15.6],[x1,15.6]]){flagPositions.push(...cloth(x,y));flagColors.push(...flagPalette[stripe].toArray());}
  }
  const flag=new T.BufferGeometry();flag.setAttribute('position',new T.Float32BufferAttribute(flagPositions,3));flag.setAttribute('color',new T.Float32BufferAttribute(flagColors,3));flag.computeVertexNormals();flag.name='Hotel / Italian tricolour at jetty';add(flag,new T.MeshStandardMaterial({vertexColors:true,roughness:.9,side:T.DoubleSide}));
  const paving=new T.BoxGeometry(22,.35,30);paving.name='Hotel / vine pergola garden paving';add(paving,trim,px,27.35,pz);
  // Brass wall lantern brackets and a discreet ceramic sign frame the entrance.
  for(const x of[-11,11]){box(iron,x,35,148.8,.35,.35,3.5);cyl(this.lanterns,x,34.4,150.1,.7,1.9,.65,8);add(new T.ConeGeometry(1.0,.8,8),copper,x,35.75,150.1);}
  box(wood,-46,29.3,184,4.3,4.2,.3);box(trim,-46,29.3,184.2,3.8,3.7,.12);
  // Cream oval hotel plaque on the sea wall; no reference imagery is embedded in the asset.
  const oval=new T.CircleGeometry(1,40);oval.scale(15,6,1);add(oval,trim,32,18,191.1);
  for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false)!;parts.forEach(g=>g.dispose());const mesh=new T.Mesh(geometry,material);mesh.castShadow=!flowers.includes(material as T.MeshStandardMaterial);mesh.receiveShadow=true;this.root.add(mesh);}
  if(typeof document!=='undefined'){
   const cafe=document.createElement('canvas');cafe.width=384;cafe.height=320;const cc=cafe.getContext('2d')!;cc.fillStyle='#eee3c8';cc.fillRect(0,0,384,320);cc.fillStyle='#46564c';cc.textAlign='center';cc.font='italic 46px Georgia';cc.fillText('Caffè',192,110);cc.fillText('Adriano',192,173);cc.font='23px Georgia';cc.fillText('espresso · limonata',192,246);const cafeTexture=new T.CanvasTexture(cafe);cafeTexture.colorSpace=T.SRGBColorSpace;const cafeSign=new T.Mesh(new T.PlaneGeometry(3.65*hotelWidthScale,3.55*1.2),new T.MeshStandardMaterial({map:cafeTexture,roughness:.85}));cafeSign.name='Hotel / Caffè Adriano terrace menu';cafeSign.position.set(-46*hotelWidthScale,hotelElevation(29.3),184.31);this.root.add(cafeSign);
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=192;const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,512,192);ctx.fillStyle='#594732';ctx.font='italic 58px Georgia';ctx.textAlign='center';ctx.fillText('Hotel',256,79);ctx.fillText('Adriano',256,141);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(28*hotelWidthScale,10.5*21/27),new T.MeshStandardMaterial({map:texture,transparent:true,depthWrite:false,roughness:.85}));sign.position.set(32*hotelWidthScale,hotelElevation(18),191.16);this.root.add(sign);
  }
  const bounds=(x:number,y:number,z:number,w:number,h:number,l:number)=>blockers.push(new T.Box3(new T.Vector3(d.x+(x-w/2)*hotelScale,hotelElevation(y-h/2)*hotelScale,d.z+(z-l/2)*hotelScale),new T.Vector3(d.x+(x+w/2)*hotelScale,hotelElevation(y+h/2)*hotelScale,d.z+(z+l/2)*hotelScale)));
  for(let z=-187;z<190;z+=6){let min=125,max=-125;for(let x=-125;x<=125;x++)if(insideHotel(x*hotelWidthScale,z)){min=Math.min(min,x);max=Math.max(max,x);}if(max>min)bounds((min+max)/2*hotelWidthScale,10,z,(max-min)*hotelWidthScale,34,6);}bounds(0,67,104,122*hotelArchitectureWidth,80,92);bounds(12*hotelArchitectureWidth,59,42,98*hotelArchitectureWidth,64,56);bounds(0,85,119,15*hotelArchitectureWidth,118,15);bounds(129*hotelWidthScale,16,156,6*hotelWidthScale,23,78);bounds(46*hotelWidthScale,31,-49,22*hotelWidthScale,8,30);bounds(-128*hotelWidthScale,14.95,198,.6*hotelWidthScale,18,.6);
 }
 setNightness(n:number,dt=0){this.beacon.update(dt,n);const dusk=T.MathUtils.smoothstep(n,.15,.8);this.windows.emissiveIntensity=dusk*1.25;this.lanterns.emissiveIntensity=dusk*3;this.lightPools.opacity=dusk*.64;}
}
/** Warm uneven limestone blocks, filtered with mipmaps to avoid subpixel masonry shimmer. */
function stoneTexture(){const size=512,pixels=new Uint8Array(size*size*4),rng=random(1903),blocks=Array.from({length:128},()=>rng());for(let y=0;y<size;y++)for(let x=0;x<size;x++){const row=Math.floor(y/32),xx=(x+(row%2)*32)%size,col=Math.floor(xx/64),mortar=xx%64<2||y%32<2;const grain=(rng()-.5)*.045,shade=(blocks[(row*8+col)%128]-.5)*.16+grain+.035*Math.sin(x*.025+y*.014),i=(y*size+x)*4;const base=mortar?[.58,.55,.47]:[.83+shade,.78+shade,.66+shade];for(let k=0;k<3;k++)pixels[i+k]=Math.round(T.MathUtils.clamp(base[k],0,1)*255);pixels[i+3]=255;}const t=new T.DataTexture(pixels,size,size,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;}

function roofTexture(){
 const size=512,pixels=new Uint8Array(size*size*4),rng=random(81);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const row=Math.floor(y/32),col=Math.floor((x+(row%2)*8)/16),seam=y%32<2;
  const wave=Math.sin(((x+(row%2)*8)%16)/16*Math.PI),variation=Math.sin(col*9.7+row*3.1)*.06;
  const shade=(seam?-.15:wave*.1)+variation+(rng()-.5)*.035,i=(y*size+x)*4;
  pixels[i]=Math.max(0,Math.min(255,(.65+shade)*255));pixels[i+1]=Math.max(0,(.30+shade*.7)*255);pixels[i+2]=Math.max(0,(.16+shade*.45)*255);pixels[i+3]=255;
 }
 const texture=new T.DataTexture(pixels,size,size);texture.colorSpace=T.SRGBColorSpace;
 texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;
}
