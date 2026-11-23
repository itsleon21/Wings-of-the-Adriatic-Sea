import * as T from 'three';
import {islands} from '../world/WorldConfig.ts';
import type {HousePlot} from '../world/SettlementLayout.ts';

/** Static, metre-scale sky occlusion around the real rotated building footprints.
 * Baked once on load; it adds no geometry pass or per-frame house queries. */
export function createSettlementOcclusion(plots:readonly HousePlot[]){
 const size=512,width=size*2,data=new Uint8Array(width*size*4);
 const areas=islands.filter(d=>d.id==='harbor'||d.id==='town').map(d=>new T.Vector4(d.x,d.z,d.rx*2.25,d.rz*2.25));
 for(let tile=0;tile<areas.length;tile++){
  const a=areas[tile];
  for(const p of plots){
   const cx=(p.x-a.x)/a.z*size+size/2,cz=(p.z-a.y)/a.w*size+size/2;
   const radius=Math.hypot(p.width,p.depth)*.5+7,rx=radius/a.z*size,rz=radius/a.w*size;
   if(cx< -rx||cz< -rz||cx>size+rx||cz>size+rz)continue;
   const c=Math.cos(p.angle),s=Math.sin(p.angle),encoded=Math.round(T.MathUtils.clamp((p.ground+20)/400,0,1)*65535);
   for(let z=Math.max(0,Math.floor(cz-rz));z<=Math.min(size-1,Math.ceil(cz+rz));z++)for(let x=Math.max(0,Math.floor(cx-rx));x<=Math.min(size-1,Math.ceil(cx+rx));x++){
    const dx=(x+.5-cx)*a.z/size,dz=(z+.5-cz)*a.w/size;
    const edgeX=Math.abs(dx*c-dz*s)-p.width*.5,edgeZ=Math.abs(dx*s+dz*c)-p.depth*.5;
    const distance=Math.hypot(Math.max(0,edgeX),Math.max(0,edgeZ));
    const weight=Math.round(Math.exp(-distance/1.9)*150),k=(z*width+tile*size+x)*4;
    if(weight>data[k]){data[k]=weight;data[k+1]=encoded>>8;data[k+2]=encoded&255;}
    data[k+3]=Math.max(data[k+3],Math.round(210*Math.exp(-distance/3.4)*(1-Math.exp(-distance/.9))));
   }
  }
 }
 const texture=new T.DataTexture(data,width,size);texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;texture.name='Harbour building foot / indirect contact occlusion';return{texture,areas};
}

export const settlementContactAO=/* glsl */`
 float contactOcclusion=0.,wallBounce=0.;
 for(int i=0;i<2;i++){
  vec2 uv=(vIslandSurface.xz-districtAreas[i].xy)/districtAreas[i].zw+.5;
  if(all(greaterThan(uv,vec2(.002)))&&all(lessThan(uv,vec2(.998)))){
   uv.x=(uv.x+float(i))*.5;vec4 contact=texture2D(settlementOcclusion,uv);
   float contactHeight=(contact.g*65280.+contact.b*255.)/65535.*400.-20.;
   float heightFade=exp(-abs(vIslandSurface.y-contactHeight)/2.4);
   contactOcclusion=max(contactOcclusion,contact.r*heightFade);
   wallBounce=max(wallBounce,contact.a*heightFade);
  }
 }
 reflectedLight.indirectDiffuse*=1.-contactOcclusion*.70;
 reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.12,.091,.055)*wallBounce*(1.-districtNight);
 reflectedLight.indirectSpecular*=1.-contactOcclusion*.28;
`;
