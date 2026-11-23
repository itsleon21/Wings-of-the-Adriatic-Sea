import * as T from 'three';
import {northCoast,northTerrainSeam,northCoastHeight,northShoreOffset,terrainSegments,random} from './WorldConfig.ts';
import {terrainSurfaceHeight} from './TerrainSurface.ts';

/** Continuous rendered hinterland starts at the final row of the playable terrain. */
export function addNorthernHinterland(root:T.Group){
 const back=-16400,depth=northTerrainSeam-back;
 const geo=new T.PlaneGeometry(northCoast.rx*2.25,depth,terrainSegments(northCoast),100).rotateX(-Math.PI/2);
 const pos=geo.attributes.position,center=(northTerrainSeam+back)/2;
 for(let i=0;i<pos.count;i++)pos.setY(i,northCoastHeight(northCoast.x+pos.getX(i),center+pos.getZ(i)));
 geo.computeVertexNormals();
 const material=new T.MeshStandardMaterial({roughness:1});
 material.userData.terrainBiome='north-coast';
 const mesh=new T.Mesh(geo,material);
 mesh.position.set(northCoast.x,0,center);mesh.receiveShadow=true;
 mesh.name='North coast / continuous continental hinterland';root.add(mesh);
}

export function addNorthCoastDetails(root:T.Group){
 const rng=random(northCoast.seed+54),ground=(x:number,z:number)=>terrainSurfaceHeight(northCoast,x,z);
 const groves=[
  [-4650,430,480,125,72],[-3450,580,440,165,86],[-2320,450,320,140,58],
  [-710,500,420,175,82],[600,390,290,125,64],[1480,560,430,155,86],
  [2580,570,480,175,94],[3680,390,375,120,68],[4920,530,470,160,86],
  [5760,440,320,120,54],
 ];
 const scattered=32,capacity=groves.reduce((total,grove)=>total+grove[4],scattered);
 const foliage=new T.MeshStandardMaterial({roughness:1});
 const pine=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),foliage,capacity);
 const cypress=new T.InstancedMesh(new T.LatheGeometry([
  new T.Vector2(0,0),new T.Vector2(.74,.12),new T.Vector2(1,.32),new T.Vector2(.65,.67),new T.Vector2(0,1),
 ],7),foliage,capacity);
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.22,.39,1,5),new T.MeshStandardMaterial({color:0x665443,roughness:1}),capacity);
 const pose=new T.Object3D(),color=new T.Color(),planted:{x:number;z:number}[]=[];
 let pines=0,cypresses=0;
 function plant(x:number,z:number,minHeight:number){
  const h=ground(x,z);
  if(h<minHeight||Math.abs(ground(x+7,z-7)-ground(x-7,z+7))>6)return false;
  if(planted.some(p=>(p.x-x)**2+(p.z-z)**2<11**2))return false;
  const tall=rng()<.23,size=5+rng()*6,stem=size*(tall?.15:.48);
  pose.position.set(x,h+stem*.5-.16,z);pose.rotation.set(0,rng()*Math.PI*2,0);pose.scale.set(1,stem+.32,1);
  pose.updateMatrix();trunks.setMatrixAt(planted.length,pose.matrix);
  pose.position.y=h+stem+(tall?-.15:size*.12);
  pose.scale.set(size*(tall?.23:.53),size*(tall?1:.32),size*(tall?.22:.47));
  pose.updateMatrix();
  const crown=tall?cypress:pine,index=tall?cypresses++:pines++;
  crown.setMatrixAt(index,pose.matrix);
  crown.setColorAt(index,color.setHSL(.20+rng()*.11,.25+rng()*.17,.19+rng()*.16));
  planted.push({x,z});
  return true;
 }
 for(const [centerX,depth,width,length,count] of groves){
  const centerZ=northCoast.z+northShoreOffset(centerX)-depth;
  const tilt=(rng()-.5)*.45;
  for(let attempt=0,placed=0;attempt<count*4&&placed<count;attempt++){
   const a=rng()*Math.PI*2,r=Math.sqrt(rng()),edge=1+.16*Math.sin(3*a)+.11*Math.cos(5*a);
   const dx=Math.cos(a)*width*r*edge;
   const x=centerX+dx,z=centerZ+Math.sin(a)*length*r*edge+dx*tilt;
   if(plant(x,z,13))placed++;
  }
 }
 for(let attempt=0,placed=0;attempt<scattered*8&&placed<scattered;attempt++){
  const x=(rng()-.5)*12200,z=northCoast.z+northShoreOffset(x)-65-rng()*170;
  if(plant(x,z,5))placed++;
 }
 pine.count=pines;cypress.count=cypresses;trunks.count=planted.length;
 pine.name='North coast / pine woodland';cypress.name='North coast / cypress woodland';trunks.name='North coast / tree trunks';
 for(const mesh of [pine,cypress,trunks]){
  mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
 }
}
