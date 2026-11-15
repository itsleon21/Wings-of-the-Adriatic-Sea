import * as T from 'three';
import {islands,random,terrainHeight} from './WorldConfig.ts';
import {terrainSurfaceHeight} from './TerrainSurface.ts';
import {inTakeoffChannel} from './IslandDetails.ts';
export type PlantSpecies='cypress'|'olive'|'holm-oak'|'tamarisk'|'juniper'|'lavender'|'reed'|'stone-pine'|'aleppo-pine'|'carob'|'fig'|'oleander'|'rosemary';
export const plantSpecies:PlantSpecies[]=['cypress','olive','holm-oak','tamarisk','juniper','lavender','reed','stone-pine','aleppo-pine','carob','fig','oleander','rosemary'];
interface PlantInstance {x:number;y:number;z:number;sx:number;sy:number;sz:number;angle:number;color:number}
/** Adriatic evergreen woodland, silver olive groves, salt-tolerant scrub and flowering verges. */
export function addMediterraneanPlants(root:T.Group,occupied:(x:number,z:number,padding?:number)=>boolean){
 const batches=new Map<PlantSpecies|'trunk',PlantInstance[]>();for(const id of[...plantSpecies,'trunk'] as const)batches.set(id,[]);
 const counts:Record<string,Partial<Record<PlantSpecies,number>>>={};
 for(const d of islands){
  const rng=random(d.seed+1701);counts[d.id]={};
  for(const species of plantSpecies){
   const coral=d.id==='coral',forest=d.id==='pine',settled=d.id==='harbor'||d.id==='town';
   const targets:Record<PlantSpecies,number>={cypress:settled?42:forest?10:24,olive:settled?48:16,'holm-oak':settled?28:22,tamarisk:18,juniper:40,lavender:settled?65:35,reed:28,'stone-pine':settled?32:forest?20:8,'aleppo-pine':settled?30:forest?28:10,carob:settled?24:0,fig:settled?20:0,oleander:settled?48:8,rosemary:settled?60:18};
   const target=coral?(species==='tamarisk'?24:species==='juniper'?32:species==='reed'?32:0):Math.round(targets[species]*(settled?1.55:1));
   let placed=0;
   for(let attempt=0;placed<target&&attempt<target*80;attempt++){
    const x=d.x+(rng()-.5)*d.rx*2.03,z=d.z+(rng()-.5)*d.rz*2.03,h=terrainHeight(d,x,z);
    const tree=['cypress','olive','holm-oak','tamarisk','stone-pine','aleppo-pine','carob','fig'].includes(species),slope=Math.hypot(terrainHeight(d,x+3,z)-terrainHeight(d,x-3,z),terrainHeight(d,x,z+3)-terrainHeight(d,x,z-3))/6;
    if(h<(species==='reed'?.15:1.8)||h>(species==='reed'?2.2:species==='tamarisk'?25:d.height*.92)||slope>.65||inTakeoffChannel(d,x,z,30)||occupied(x,z,tree?11:3))continue;
    // Groves follow different terrain pockets instead of mixing every species uniformly.
    const pocket=Math.sin((x-d.x)*.017+species.length)*Math.cos((z-d.z)*.014+d.seed);
    if(settled&&tree&&pocket<-.25)continue;
    const y=terrainSurfaceHeight(d,x,z),angle=rng()*Math.PI*2,batch=batches.get(species)!;
    if(species==='cypress'){
     const height=13+rng()*12,radius=1.5+rng()*1.2;
     batch.push({x,y:y+height*.13,z,sx:radius,sy:height*.87,sz:radius,angle,color:0x34513c});
     batches.get('trunk')!.push({x,y:y+height*.19,z,sx:.32,sy:height*.38,sz:.32,angle,color:0x77674f});
    }else if(tree){
     const olive=species==='olive',salt=species==='tamarisk',umbrella=species==='stone-pine',aleppo=species==='aleppo-pine',fig=species==='fig',carob=species==='carob',height=salt?5+rng()*4:olive||fig?7+rng()*5:umbrella||aleppo?14+rng()*9:10+rng()*7,radius=salt?3+rng()*2:olive?3.5+rng()*2:umbrella?7+rng()*4:carob?5+rng()*3:4+rng()*2.6;
     batches.get('trunk')!.push({x,y:y+height*.3,z,sx:olive?.5:.36,sy:height*.6,sz:olive?.5:.36,angle,color:olive?0x766e59:0x75634b});
     for(let lobe=0;lobe<(aleppo?6:4);lobe++){const a=lobe*(aleppo?Math.PI/3:Math.PI*.5)+angle;batch.push({x:x+Math.cos(a)*radius*.45,y:y+height*(umbrella?.88:aleppo?.67+lobe*.035:.72)+(rng()-.5)*height*.16,z:z+Math.sin(a)*radius*.45,sx:radius*(aleppo?.64:.72),sy:height*(umbrella?.115:aleppo?.16:fig?.21:olive?.25:.32),sz:radius*.69,angle,color:salt?0x698061:olive?0x78856a:umbrella?0x4c6943:aleppo?0x66805a:carob?0x365b3c:fig?0x60814a:0x405b37});}
    }else if(species==='juniper'){
     const size=1.5+rng()*2.5;batch.push({x,y:y+size*.35,z,sx:size,sy:size*.55,sz:size*.8,angle,color:0x5b7547});
    }else if(species==='oleander'){
     const size=1.6+rng()*1.7;batch.push({x,y:y+size*.65,z,sx:size,sy:size*.9,sz:size*.75,angle,color:0x506c3e});for(let lobe=0;lobe<3;lobe++)batch.push({x:x+(rng()-.5)*size,y:y+size*1.36,z:z+(rng()-.5)*size,sx:size*.36,sy:size*.21,sz:size*.32,angle,color:placed%3===0?0xe4d6c2:placed%3===1?0xc58491:0xb56b81});
    }else if(species==='rosemary'){
     const size=1+rng()*1.6;batch.push({x,y:y+.6,z,sx:size,sy:.65,sz:size*.7,angle,color:placed%5?0x6c8063:0x8b8aa3});
    }else if(species==='lavender'){
     for(let lobe=0;lobe<3;lobe++)batch.push({x:x+(rng()-.5)*2,y:y+.6+rng()*.25,z:z+(rng()-.5)*2,sx:.65,sy:.6,sz:.65,angle,color:lobe%2?0x8c799c:0xa191ad});
    }else{
     for(let stem=0;stem<4;stem++)batch.push({x:x+(rng()-.5)*1.6,y,z:z+(rng()-.5)*1.6,sx:.12,sy:1.5+rng()*1.6,sz:.12,angle,color:0x7c9053});
    }
    placed++;
   }counts[d.id][species]=placed;
  }
 }
 const dummy=new T.Object3D(),tint=new T.Color();
 for(const [species,instances] of batches){
  if(!instances.length)continue;
  let geo:T.BufferGeometry;
  if(species==='trunk')geo=new T.CylinderGeometry(.7,1,1,6);
  else if(species==='cypress'){geo=new T.LatheGeometry([[0,0],[.45,.05],[.85,.18],[1,.36],[.86,.61],[.52,.85],[.08,1],[0,1.04]].map(([x,y])=>new T.Vector2(x,y)),10);}
  else if(species==='reed'){geo=new T.ConeGeometry(1,1,4);geo.translate(0,.5,0);}
  else {
   geo=new T.SphereGeometry(1,12,8);
   if(['olive','holm-oak','tamarisk','juniper','stone-pine','aleppo-pine','carob','fig','oleander','rosemary'].includes(species)){
    const vertices=geo.attributes.position;
    for(let i=0;i<vertices.count;i++){
     const x=vertices.getX(i),y=vertices.getY(i),z=vertices.getZ(i);
     const shape=1+.075*Math.sin(x*5.1+y*2.3)*Math.cos(z*4.2-y*1.7);
     vertices.setXYZ(i,x*shape,y*shape,z*shape);
    }
    geo.computeVertexNormals();
   }
  }
  if(species!=='trunk'&&species!=='reed'){
   const vertices=geo.attributes.position,shades=new Float32Array(vertices.count*3);
   geo.computeBoundingBox();const bounds=geo.boundingBox!;
   for(let i=0;i<vertices.count;i++){
    const height=(vertices.getY(i)-bounds.min.y)/Math.max(.001,bounds.max.y-bounds.min.y);
    const shade=.70+.30*Math.sqrt(height);
    shades.set([shade,shade,shade],i*3);
   }
   geo.setAttribute('color',new T.BufferAttribute(shades,3));
  }
  const mesh=new T.InstancedMesh(geo,new T.MeshStandardMaterial({color:0xffffff,roughness:1,vertexColors:!!geo.getAttribute('color')}),instances.length);
  instances.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(0,v.angle,0);dummy.scale.set(v.sx,v.sy,v.sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);tint.setHex(v.color).multiplyScalar(.93+(i%9)*.018);mesh.setColorAt(i,tint);});
  mesh.name=`Mediterranean vegetation / ${species}`;mesh.castShadow=species!=='lavender'&&species!=='reed';mesh.receiveShadow=true;mesh.computeBoundingSphere();root.add(mesh);
 }
 return counts;
}
