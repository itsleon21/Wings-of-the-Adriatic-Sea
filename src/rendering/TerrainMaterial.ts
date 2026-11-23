import * as T from 'three';

/** Shared scans: two textures, not a texture set per island/biome. */
export class TerrainMaterial {
 readonly uniforms={coastAlbedo:{value:new T.Texture()},coastData:{value:new T.Texture()},coastScansReady:{value:0}};
 readonly ready:Promise<void>;private disposed=false;
 constructor(){
  if(typeof document==='undefined'){this.ready=Promise.resolve();return;}
  const loader=new T.TextureLoader(),url=import.meta.env.BASE_URL+'textures/terrain/';
  this.ready=Promise.allSettled([loader.loadAsync(url+'coast-albedo.jpg'),loader.loadAsync(url+'coast-normal-rh.png')]).then(results=>{
   if(this.disposed||results.some(result=>result.status==='rejected')){for(const result of results)if(result.status==='fulfilled')result.value.dispose();return;}
   const [color,data]=results.map(result=>(result as PromiseFulfilledResult<T.Texture>).value);
   this.uniforms.coastAlbedo.value.dispose();this.uniforms.coastData.value.dispose();
   color.colorSpace=T.SRGBColorSpace;
   for(const t of[color,data]){t.anisotropy=4;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;}
   this.uniforms.coastAlbedo.value=color;this.uniforms.coastData.value=data;this.uniforms.coastScansReady.value=1;
  }).catch(()=>{/* The existing biome material remains a complete offline fallback. */});
 }
 dispose(){this.disposed=true;this.uniforms.coastAlbedo.value.dispose();this.uniforms.coastData.value.dispose();}
}

export const terrainScanFunctions=/* glsl */`
uniform sampler2D coastAlbedo;uniform sampler2D coastData;uniform float coastScansReady;
vec4 coastSample(sampler2D atlas,vec2 uv,vec2 cell){
 // Preserve derivatives across wrap boundaries. A 16px gutter isolates mip levels.
 vec2 dx=dFdx(uv)*.46875,dy=dFdy(uv)*.46875;
 return textureGrad(atlas,(vec2(cell.x,1.-cell.y)+.03125+fract(uv)*.9375)*.5,dx,dy);
}
vec2 coastRelief(vec2 uv,vec2 travel,vec2 dx,vec2 dy){
 vec2 stride=travel*.2,cursor=uv;
 float layer=0.,previous=1.,difference=0.;
 for(int i=0;i<5;i++){
  float h=1.-textureGrad(coastData,vec2(.015625,.515625)+fract(cursor)*.46875,dx,dy).a;
  difference=h-layer;
  if(difference<=0.)return cursor+stride*clamp(-difference/max(.001,previous-difference),0.,1.);
  previous=difference;cursor-=stride;layer+=.2;
 }
 return cursor;
}
vec3 coastNormal(vec3 n,vec2 uv,vec2 xy){
 vec3 dp1=dFdx(-vViewPosition),dp2=dFdy(-vViewPosition);
 vec2 duv1=dFdx(uv),duv2=dFdy(uv);
 vec3 p2=cross(dp2,n),p1=cross(n,dp1);
 vec3 t=p2*duv1.x+p1*duv2.x,b=p2*duv1.y+p1*duv2.y;
 float scale=inversesqrt(max(max(dot(t,t),dot(b,b)),1e-12));
 return normalize(t*scale*xy.x+b*scale*xy.y+n*sqrt(max(.08,1.-dot(xy,xy))));
}
`;

/** Broad biome colors remain readable from the air; scans take over smoothly near land. */
export const terrainScanColor=/* glsl */`
 float scanDistance=distance(cameraPosition,vIslandSurface);
 float scanDetail=(1.-smoothstep(180.,1100.,scanDistance))*coastScansReady;
 // Horizontal ground and vertical cliff projections use metres, not stretched mesh UVs.
 vec2 groundUV=vIslandSurface.xz/1.;
 vec2 stoneUV=(abs(surfaceNormal.x)>abs(surfaceNormal.z)?vIslandSurface.zy:vIslandSurface.xy)/1.5;
 vec2 sandUV=vIslandSurface.xz/3.5;
 vec4 meadowScan=coastSample(coastData,groundUV,vec2(1.,0.));
 vec4 stoneScan=coastSample(coastData,stoneUV,vec2(0.,0.));
 vec4 sandScan=coastSample(coastData,sandUV,vec2(0.,1.));
 float scanBeach=1.-smoothstep(2.5,11.,vIslandSurface.y+(meadowScan.a-sandScan.a)*2.4);
 float scanCliff=smoothstep(.14,.47,1.-surfaceNormal.y+(stoneScan.a-.5)*.065);
 vec3 meadowColor=coastSample(coastAlbedo,groundUV,vec2(1.,0.)).rgb;
 vec3 stoneColor=coastSample(coastAlbedo,stoneUV,vec2(0.,0.)).rgb;
 vec3 sandColor=coastSample(coastAlbedo,sandUV,vec2(0.,1.)).rgb;
 vec3 scanColor=mix(mix(meadowColor,sandColor,scanBeach),stoneColor,scanCliff);
 // Atlases store neutral de-lit detail. Keep the island's large-scale color composition.
 diffuseColor.rgb*=mix(vec3(1.),clamp(scanColor/.216,vec3(.50),vec3(1.65)),scanDetail*.82);
 vec3 regionDetail=coastSample(coastAlbedo,vIslandSurface.xz/90.,vec2(1.,1.)).rgb;
 diffuseColor.rgb*=mix(vec3(1.),clamp(regionDetail/.216,vec3(.75),vec3(1.3)),coastScansReady*.30*(1.-scanBeach));
 float scanWet=clamp(islandWetness*.65+(1.-smoothstep(.25,2.4,vIslandSurface.y))*.85,0.,1.);
 diffuseColor.rgb*=mix(1.,.72,scanWet*coastScansReady);
`;

export const terrainScanNormal=/* glsl */`
 vec3 groundScanNormal=coastNormal(normal,groundUV,(meadowScan.rg*2.-1.)*scanDetail*.52);
 vec3 sandScanNormal=coastNormal(normal,sandUV,(sandScan.rg*2.-1.)*scanDetail*.33);
 vec3 cliffScanNormal=coastNormal(normal,stoneUV,(stoneScan.rg*2.-1.)*scanDetail*.85);
 normal=normalize(mix(mix(groundScanNormal,sandScanNormal,scanBeach),cliffScanNormal,scanCliff));
`;

export const terrainScanRoughness=/* glsl */`
 float scannedRough=mix(mix(meadowScan.b,sandScan.b,scanBeach),stoneScan.b,scanCliff);
 roughnessFactor=mix(roughnessFactor,clamp(scannedRough,.68,.99),scanDetail);
 roughnessFactor=mix(roughnessFactor,.31,scanWet*coastScansReady);
`;

export const rockScanColor=/* glsl */`
 float rockScanDetail=(1.-smoothstep(150.,850.,distance(cameraPosition,vIslandSurface)))*coastScansReady;
 vec2 rockScanUV=(abs(surfaceNormal.y)>.72?vIslandSurface.xz:abs(surfaceNormal.x)>abs(surfaceNormal.z)?vIslandSurface.zy:vIslandSurface.xy)/1.5;
 float reliefFade=coastScansReady*(1.-smoothstep(17.,35.,distance(cameraPosition,vIslandSurface)));
 vec2 reliefDx=dFdx(rockScanUV)*.46875,reliefDy=dFdy(rockScanUV)*.46875;
 if(reliefFade>.002){
  vec3 eye=normalize(cameraPosition-vIslandSurface);
  vec2 tangent=abs(surfaceNormal.y)>.72?eye.xz:abs(surfaceNormal.x)>abs(surfaceNormal.z)?eye.zy:eye.xy;
  rockScanUV=coastRelief(rockScanUV,tangent*.033*reliefFade/max(.27,dot(eye,surfaceNormal)),reliefDx,reliefDy);
 }
 vec4 rockScanData=coastSample(coastData,rockScanUV,vec2(0.,0.));
 vec3 rockScanAlbedo=coastSample(coastAlbedo,rockScanUV,vec2(0.,0.)).rgb;
 diffuseColor.rgb*=mix(vec3(1.),clamp(rockScanAlbedo/.216,vec3(.55),vec3(1.6)),rockScanDetail*.85);
`;
export const rockScanNormal=/* glsl */`
 normal=coastNormal(normal,rockScanUV,(rockScanData.rg*2.-1.)*rockScanDetail*.85);
`;
export const rockScanRoughness=/* glsl */`
 roughnessFactor=mix(roughnessFactor,clamp(rockScanData.b,.65,.99),rockScanDetail);
 roughnessFactor=mix(roughnessFactor,.32,max(islandWetness*.6,1.-smoothstep(.3,2.5,vIslandSurface.y))*coastScansReady);
`;
