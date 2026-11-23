import type {createCloudLayout} from './CloudLayout.ts';
/** Rasterize only the projected footprint of each cloud, rather than testing every cloud at every pixel. */
export function rasterCloudShadows(cells:ReturnType<typeof createCloudLayout>,sun:{x:number;y:number;z:number},data:Uint8Array,accumulation:Float32Array,size=64){
 accumulation.fill(0);const sy=Math.max(.08,sun.y),pixel=22000/(size-1),reach=Math.sqrt(2.5);
 for(const c of cells){
  const px=c.x-sun.x/sy*c.y,pz=c.z-sun.z/sy*c.y,cs=Math.cos(c.rotation),sn=Math.sin(c.rotation),w=c.width*1.1,d=c.depth*1.1;
  const rx=Math.hypot(cs*w,sn*d)*reach,rz=Math.hypot(sn*w,cs*d)*reach;
  const minX=Math.max(0,Math.ceil((px-rx+11000)/pixel)),maxX=Math.min(size-1,Math.floor((px+rx+11000)/pixel)),minZ=Math.max(0,Math.ceil((pz-rz+11000)/pixel)),maxZ=Math.min(size-1,Math.floor((pz+rz+11000)/pixel));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const ox=x*pixel-11000-px,oz=z*pixel-11000-pz,dx=(ox*cs+oz*sn)/w,dz=(-ox*sn+oz*cs)/d,distance=dx*dx+dz*dz;
   if(distance<2.5)accumulation[z*size+x]+=Math.exp(-distance*2)*.65*(c.opacity??1)*(c.layer==='cove-mist'?.20:1);
  }
 }
 for(let i=0;i<size*size;i++){const value=Math.round(Math.min(1,accumulation[i])*255),k=i*4;data[k]=data[k+1]=data[k+2]=value;data[k+3]=255;}
}
