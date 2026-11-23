import * as T from 'three';
import {random} from './WorldConfig.ts';

/** Small opaque leaf/twig cutouts; no blended transparency, no per-leaf objects. */
function leafTexture(){
 // Three twig profiles share one atlas and one near-canopy draw.
 const size=128,width=size*3,data=new Uint8Array(width*size*4);
 for(let kind=0;kind<3;kind++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size*2-1,v=(y+.5)/size*2-1;
  const stemAt=(h:number)=>.085*Math.sin(h*2.6+kind);
  let coverage=Math.abs(v)<.88?1-Math.abs(u-stemAt(v))/.018:0,shade=126;
  const rows=kind===2?16:kind===1?7:5;
  for(let row=0;row<rows;row++)for(const side of[-1,1]){
   const h=-.82+row*(1.45/rows)+side*.028;
   const dx=(u-stemAt(h))*side,dy=v-h;
   const len=(kind===2?.70:kind===1?.54:.62)*(1.-.40*row/rows);
   const t=(dx*.87+dy*.49)/len;
   if(t<=0||t>=1)continue;
   const across=dy*.87-dx*.49;
   const half=(kind===2?.021:kind===1?.066:.115)*Math.sin(Math.PI*t);
   const edge=(half-Math.abs(across))*size;
   if(edge>coverage){coverage=edge;shade=198+24*(1-t)+17*Math.max(0,1-Math.abs(across)/.017);}
  }
  const i=(y*width+kind*size+x)*4;
  data.set([shade,shade,shade,Math.round(T.MathUtils.clamp(coverage,0,1)*255)],i);
 }
 const tex=new T.DataTexture(data,width,size);tex.colorSpace=T.SRGBColorSpace;tex.generateMipmaps=true;tex.minFilter=T.LinearMipmapLinearFilter;tex.magFilter=T.LinearFilter;tex.needsUpdate=true;return tex;
}

export function leafClusterGeometry(){
 const rng=random(7301),p:number[]=[],n:number[]=[],uv:number[]=[],colors:number[]=[],index:number[]=[];
 const q=new T.Quaternion(),point=new T.Vector3(),normal=new T.Vector3(),up=new T.Vector3(0,0,1);
 for(let i=0;i<42;i++){
  const az=rng()*Math.PI*2,cy=rng()*1.8-.9,r=Math.sqrt(Math.max(0,1-cy*cy))*(.5+rng()*.45),center=new T.Vector3(Math.cos(az)*r,cy,Math.sin(az)*r);
  normal.set((rng()-.5)*2,.25+rng(),(rng()-.5)*2).normalize();q.setFromUnitVectors(up,normal);
  const width=.30+rng()*.25,height=.42+rng()*.32;
  for(const [x,y,u,v] of[[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]]){
   point.set(x*width,y*height,0).applyQuaternion(q).add(center);p.push(point.x,point.y,point.z);n.push(normal.x,normal.y,normal.z);uv.push(u,v);
   const shade=.68+.32*T.MathUtils.clamp((point.y+1)*.5,0,1);colors.push(shade,shade,shade);
  }
  const k=i*4;index.push(k,k+1,k+2,k,k+2,k+3);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(n,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(index);return g;
}

/** Both LODs share instance centres and a stable distance threshold. */
function canopyLOD(material:T.MeshStandardMaterial,near:boolean){
 material.onBeforeCompile=shader=>{
  shader.vertexShader='varying float vCanopyRange;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
   vec3 canopyCenter=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
   float canopyDistance=distance(cameraPosition,canopyCenter);
   float canopySwitch=220.+35.*sin(dot(canopyCenter.xz,vec2(.13,.17)));
   vCanopyRange=${near?'(1.-smoothstep(canopySwitch-25.,canopySwitch+25.,canopyDistance))':'smoothstep(canopySwitch-25.,canopySwitch+25.,canopyDistance)'};
   if(vCanopyRange<.001)gl_Position=vec4(2.,2.,2.,1.);`);
  if(near)shader.vertexShader='attribute float twigProfile;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv.x=(vMapUv.x+twigProfile)/3.;');
  shader.fragmentShader='varying float vCanopyRange;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
   // Ordered coverage gives a short stable crossfade without translucent sorting.
   float canopyCoverage=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));
   if(vCanopyRange<canopyCoverage)discard;`);
  if(near)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   // Thin leaf transmission adds a restrained warm fill, keeping branch interiors dark.
   reflectedLight.indirectDiffuse+=diffuseColor.rgb*.026;`);
 };
 material.customProgramCacheKey=()=>`coastal-canopy-lod-${near?'leaves':'crown'}-v1`;
}

export function addCanopyDetails(root:T.Group,crowns:T.InstancedMesh[]){
 const count=crowns.reduce((sum,mesh)=>sum+mesh.count,0);if(!count)return;
 const material=new T.MeshStandardMaterial({color:0xffffff,map:leafTexture(),alphaTest:.40,side:T.DoubleSide,roughness:.86,vertexColors:true});canopyLOD(material,true);
 const near=new T.InstancedMesh(leafClusterGeometry(),material,count);
 const profiles=new T.InstancedBufferAttribute(new Float32Array(count),1).setUsage(T.DynamicDrawUsage);
 near.geometry.setAttribute('twigProfile',profiles);
 const cellSize=96,cutoff=280,margin=24,anchor=new T.Vector3(Infinity,0,0);
 const cells=new Map<string,{matrix:T.Matrix4;color:T.Color;profile:number}[]>();
 const distancePoint=new T.Vector3();
 for(const far of crowns){
  const farMaterial=(far.material as T.MeshStandardMaterial).clone();canopyLOD(farMaterial,false);far.material=farMaterial;
  const profile=/pine/.test(far.name)?2:/olive|tamarisk/.test(far.name)?1:0;
  for(let i=0;i<far.count;i++){
   const matrix=new T.Matrix4(),color=new T.Color();
   far.getMatrixAt(i,matrix);far.getColorAt(i,color);
   const key=`${Math.floor(matrix.elements[12]/cellSize)},${Math.floor(matrix.elements[14]/cellSize)}`;
   const cell=cells.get(key);
   if(cell)cell.push({matrix,color,profile});else cells.set(key,[{matrix,color,profile}]);
  }
 }
 near.name='Mediterranean vegetation / nearby leaf cards';
 near.receiveShadow=true;near.castShadow=false;near.frustumCulled=false;near.count=0;near.instanceMatrix.setUsage(T.DynamicDrawUsage);
 near.setColorAt(0,new T.Color(0xffffff));near.instanceColor!.setUsage(T.DynamicDrawUsage);
 root.add(near);
 // Only neighbourhoods close enough to enter the shader's crossfade are submitted.
 // The margin lets the camera move between buffer updates without losing a crown.
 return (position:T.Vector3)=>{
  if(anchor.distanceToSquared(position)<margin*margin)return;
  anchor.copy(position);
  const radius=cutoff+margin;
  let visible=0;
  for(let z=Math.floor((position.z-radius)/cellSize);z<=Math.floor((position.z+radius)/cellSize);z++){
   for(let x=Math.floor((position.x-radius)/cellSize);x<=Math.floor((position.x+radius)/cellSize);x++){
    const cell=cells.get(`${x},${z}`);
    if(!cell)continue;
    for(const instance of cell){
     distancePoint.setFromMatrixPosition(instance.matrix);
     if(distancePoint.distanceToSquared(position)>radius*radius)continue;
     profiles.setX(visible,instance.profile);near.setMatrixAt(visible,instance.matrix);near.setColorAt(visible++,instance.color);
    }
   }
  }
  near.count=visible;
  if(visible===0)return;
  profiles.clearUpdateRanges();profiles.addUpdateRange(0,visible);profiles.needsUpdate=true;
  near.instanceMatrix.clearUpdateRanges();near.instanceMatrix.addUpdateRange(0,visible*16);
  near.instanceColor!.clearUpdateRanges();near.instanceColor!.addUpdateRange(0,visible*3);
  near.instanceMatrix.needsUpdate=true;near.instanceColor!.needsUpdate=true;
 };
}
