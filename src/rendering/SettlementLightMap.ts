import * as T from 'three';import {islands} from '../world/WorldConfig.ts';
/** A compact static light bake for warm street bounce; real nearby lamps add moving specular light. */
export function createSettlementLightMap(lamps:readonly {x:number;y:number;z:number}[]){
 const towns=islands.filter(d=>d.id==='harbor'||d.id==='town'),size=256,width=size*towns.length,data=new Uint8Array(width*size*4),areas=towns.map(d=>new T.Vector4(d.x,d.z,d.rx*2.25,d.rz*2.25));
 for(const [tile,d] of towns.entries())for(const p of lamps){
  const area=areas[tile],cx=(p.x-d.x)/area.z*size+size/2,cz=(p.z-d.z)/area.w*size+size/2,rx=50/area.z*size,rz=50/area.w*size;
  if(cx< -rx||cx>size+rx||cz< -rz||cz>size+rz)continue;
  for(let z=Math.max(0,Math.floor(cz-rz));z<=Math.min(size-1,Math.ceil(cz+rz));z++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(size-1,Math.ceil(cx+rx));x++){
   const dx=(x+.5-cx)*area.z/size,dz=(z+.5-cz)*area.w/size,value=Math.round(Math.exp(-(dx*dx+dz*dz)/(2*17*17))*255),k=(z*width+tile*size+x)*4;
   if(value>data[k]){data[k]=value;data[k+1]=Math.round(T.MathUtils.clamp((p.y-4.8)/300,0,1)*255);}data[k+3]=255;
  }
 }
 const texture=new T.DataTexture(data,width,size);texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;texture.name='Two harbour districts / baked warm street bounce';return{texture,areas};
}
