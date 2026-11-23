import {createSettlementOcclusion,settlementContactAO} from './SettlementOcclusion.ts';
import type {HousePlot} from '../world/SettlementLayout.ts';
import {createSettlementLightMap} from './SettlementLightMap.ts';
import * as T from 'three';
import {TerrainMaterial,terrainScanFunctions,terrainScanColor,terrainScanNormal,terrainScanRoughness,rockScanColor,rockScanNormal,rockScanRoughness} from './TerrainMaterial.ts';

/** World-space grain works across terrain, rotated houses and reusable rock instances. */
export class IslandSurface {
 private contact=createSettlementOcclusion([]);private scans=new TerrainMaterial();readonly ready=this.scans.ready;
 private night={value:0};private district=createSettlementLightMap([]);
 private wetness={value:0};private texture:T.DataTexture;private prepared=new WeakSet<T.Material>();
 constructor(){
  const size=128,data=new Uint8Array(size*size);let seed=71;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[y*size+x]=Math.round(110+((seed>>>24)/255)*36+Math.sin(x*.29+Math.sin(y*.17))*16+Math.sin(y*.12+x*.05)*12);}
  this.texture=new T.DataTexture(data,size,size,T.RedFormat);this.texture.wrapS=this.texture.wrapT=T.RepeatWrapping;this.texture.magFilter=T.LinearFilter;this.texture.minFilter=T.LinearMipmapLinearFilter;this.texture.generateMipmaps=true;this.texture.needsUpdate=true;
 }
 prepare(root:T.Object3D){root.traverse(object=>{if(!(object instanceof T.Mesh))return;for(const material of Array.isArray(object.material)?object.material:[object.material]){
  if(!(material instanceof T.MeshStandardMaterial)||this.prepared.has(material))continue;this.prepared.add(material);
  const previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{previousCompile.call(material,shader,renderer);
   shader.uniforms.islandGrain={value:this.texture};shader.uniforms.islandWetness=this.wetness;shader.uniforms.districtNight=this.night;shader.uniforms.districtMap={value:this.district.texture};shader.uniforms.districtAreas={value:this.district.areas};
   const architecture=Boolean(material.userData.architecture);
   const classified=Boolean(material.userData.buildingSurface);
   const bakedAO=Boolean(material.userData.architectureAO);
   if(bakedAO){
    shader.vertexShader='attribute float surfaceAO; varying float vSurfaceAO;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceAO=surfaceAO;');
    shader.fragmentShader='varying float vSurfaceAO;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
     float localVisibility=clamp(vSurfaceAO,.36,1.);
     reflectedLight.indirectDiffuse*=localVisibility;
     reflectedLight.indirectSpecular*=mix(1.,localVisibility,.45);`);
   }
   if(classified){
    shader.vertexShader='attribute float buildingSurface; flat varying float vBuildingSurface; varying vec2 vBuildingUV;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBuildingSurface=buildingSurface; vBuildingUV=uv;');
    shader.fragmentShader='flat varying float vBuildingSurface; varying vec2 vBuildingUV;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor = vBuildingSurface == 4. ? .55 : 0.;');
   }
   shader.fragmentShader='uniform float districtNight;uniform sampler2D districtMap;uniform vec4 districtAreas[2];\n'+shader.fragmentShader;
   const rockAsset=Boolean(material.userData.coastalRock);
   const terrain=Boolean(material.userData.terrainBiome),sand=material.userData.terrainBiome==='sand';
   const harbor=material.userData.terrainBiome==='harbor',northCoast=material.userData.terrainBiome==='north-coast';
   if(harbor){
    shader.vertexShader='attribute vec3 groundCover; varying vec3 vGroundCover;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundCover=groundCover;');
    shader.fragmentShader='varying vec3 vGroundCover;\n'+shader.fragmentShader;
   }
   if(terrain||architecture){shader.uniforms.settlementOcclusion={value:this.contact.texture};shader.fragmentShader='uniform sampler2D settlementOcclusion;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\n'+settlementContactAO);}
   if(terrain||rockAsset){Object.assign(shader.uniforms,this.scans.uniforms);shader.fragmentShader=shader.fragmentShader.replace('void main() {',terrainScanFunctions+'\nvoid main() {');}
   shader.vertexShader=(architecture?'varying vec3 vBuildingPoint;varying vec3 vBuildingNormal;\n':'')+'varying vec3 vIslandSurface;varying vec3 vIslandNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvIslandNormal=inverseTransformDirection(normalize(transformedNormal),viewMatrix);');
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vec4 islandSurface=vec4(transformed,1.);
    #ifdef USE_INSTANCING
     islandSurface=instanceMatrix*islandSurface;
    #endif
    vIslandSurface=(modelMatrix*islandSurface).xyz;
    ${architecture?`vec3 buildingScale=vec3(1.);
    #ifdef USE_INSTANCING
    buildingScale=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
    #endif
    vBuildingPoint=transformed*buildingScale;vBuildingNormal=normal;`:''}`);
   shader.fragmentShader=(architecture?'varying vec3 vBuildingPoint;varying vec3 vBuildingNormal;\n':'')+'varying vec3 vIslandSurface;varying vec3 vIslandNormal;uniform sampler2D islandGrain;uniform float islandWetness;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec3 surfaceNormal=normalize(vIslandNormal);vec3 islandNormal=abs(surfaceNormal);
    islandNormal=pow(islandNormal,vec3(4.));islandNormal/=max(.001,islandNormal.x+islandNormal.y+islandNormal.z);
    float grain=dot(vec3(texture2D(islandGrain,vIslandSurface.yz*.07).r,texture2D(islandGrain,vIslandSurface.xz*.07).r,texture2D(islandGrain,vIslandSurface.xy*.07).r),islandNormal);
    float mottling=texture2D(islandGrain,vIslandSurface.xz*.0031).r;
    ${terrain?`float cliff=smoothstep(.12,.48,1.-surfaceNormal.y);
    vec3 rock=mix(vec3(.43,.40,.32),vec3(.70,.65,.53),mottling);
    float strataPhase=vIslandSurface.y*.16+mottling*7.+grain*.45;
    float strataAA=max(.03,fwidth(strataPhase));
    float strata=sin(strataPhase)/(1.+strataAA*strataAA*4.);
    vec2 cliffUV=vec2(dot(vIslandSurface.xz,normalize(vec2(.61,.79)))*.11,vIslandSurface.y*.022);
    float weathering=texture2D(islandGrain,cliffUV).r;
    rock*=.91+.045*strata+.19*weathering;
    float waterline=1.-smoothstep(.3,4.2,vIslandSurface.y+grain*.7);
    rock*=mix(vec3(1.),vec3(.57,.62,.60),waterline);
    rock=mix(rock,rock*vec3(.76,.79,.74),smoothstep(.57,.68,weathering)*.45);
    vec3 grass=mix(vec3(.13,.25,.065),vec3(.27,.36,.105),mottling);
    vec3 beach=mix(vec3(.49,.45,.34),vec3(.83,.74,.56),smoothstep(.6,3.8,vIslandSurface.y+grain*.8));
    float grassBreak=texture2D(islandGrain,vIslandSurface.xz*.018).r;
    float exposed=smoothstep(.57,.7,grassBreak)*smoothstep(10.,35.,vIslandSurface.y)*.34;
    ${harbor?`grass=mix(grass*.83,grass*vec3(.53,.60,.59),vGroundCover.x*.86);
    grass=mix(grass,vec3(.29,.31,.13),vGroundCover.z*.54);
    rock*=mix(.78,1.,vGroundCover.y);
    float ledge=smoothstep(.13,.40,1.-surfaceNormal.y)*vGroundCover.y;
    exposed=max(exposed,ledge*.95);`:''}
    ${northCoast?`float scrub=1.-smoothstep(.028,.19,1.-surfaceNormal.y);
    scrub*=1.-.58*smoothstep(27.,71.,vIslandSurface.y);
    grass=mix(vec3(.11,.17,.065),vec3(.29,.32,.15),scrub);
    rock=mix(rock,vec3(.70,.68,.59),.59);
    exposed=max(exposed,(1.-scrub)*smoothstep(12.,64.,vIslandSurface.y)*.72);
    beach=mix(vec3(.44,.43,.39),vec3(.76,.74,.65),smoothstep(.23,.78,grain+weathering*.18));`:''}
    vec3 inland=mix(grass,rock,max(cliff,exposed));
    diffuseColor.rgb=mix(beach,inland,smoothstep(${sand?'4.,18.':'3.,12.'},vIslandSurface.y));
    ${harbor?`float bareCoast=vGroundCover.y*smoothstep(.07,.29,1.-surfaceNormal.y);
    diffuseColor.rgb=mix(diffuseColor.rgb,rock,bareCoast*.96);`:''}`:''}
    ${rockAsset?`vec3 mineral=mix(vec3(.72,.70,.63),vec3(1.06,1.02,.91),smoothstep(.30,.72,mottling));
    diffuseColor.rgb*=mineral;
    float tideLine=1.-smoothstep(.5,3.5,vIslandSurface.y+grain*.5);
    diffuseColor.rgb*=mix(vec3(1.),vec3(.49,.56,.54),tideLine);`:''}
    ${architecture?`// Tile seams are filtered over the pixel footprint and fade before becoming subpixel.
    float roof=${classified?'(vBuildingSurface == 1. ? 1. : 0.)':'step(diffuseColor.g*1.7,diffuseColor.r)*step(diffuseColor.b*2.,diffuseColor.r)'}*smoothstep(.03,.25,surfaceNormal.y);
    float limewash=(mottling-.5)*.22+(grain-.5)*.10;
    float wallDetail=1.-smoothstep(100.,320.,distance(cameraPosition,vIslandSurface));
    float verticalGrain=texture2D(islandGrain,vec2((vBuildingPoint.x+vBuildingPoint.z)*.23,vBuildingPoint.y*.012)).r;
    float rainStain=smoothstep(.52,.72,verticalGrain)*(.40+.60*grain);
    float paleWall=smoothstep(.12,.32,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)))*(1.-roof)*(1.-abs(surfaceNormal.y));
    ${classified?`float joinery=vBuildingSurface==3.?1.:0.;
    float nearGrain=texture2D(islandGrain,vBuildingUV*vec2(.9,.36)).r;
    diffuseColor.rgb*=1.+(nearGrain-.5)*.20*joinery*wallDetail;
    float stone=vBuildingSurface==5.?1.:0.;
    vec2 masonry=vec2((vBuildingPoint.x+vBuildingPoint.z)/.68,vBuildingPoint.y/.31);
    masonry.x+=mod(floor(masonry.y),2.)*.5+(grain-.5)*.12;
    vec2 mortarEdge=min(fract(masonry),1.-fract(masonry));
    float joint=(1.-smoothstep(.025,.12,min(mortarEdge.x,mortarEdge.y)))*(1.-smoothstep(.25,.85,max(fwidth(masonry.x),fwidth(masonry.y))));
    diffuseColor.rgb*=1.+stone*wallDetail*((mottling-.5)*.18-joint*.22);
    diffuseColor.rgb*=1.-stone*.23*(1.-smoothstep(.6,3.1,vIslandSurface.y));`:''}
    diffuseColor.rgb*=mix(vec3(1.),vec3(.88,.89,.85),rainStain*paleWall*wallDetail);
    diffuseColor.rgb*=mix(vec3(1.+limewash,1.+limewash*.87,1.+limewash*.68),vec3(1.),roof);
    vec3 roofNormal=normalize(vBuildingNormal);
    vec2 across=normalize(vec2(roofNormal.z,-roofNormal.x)+vec2(.0001));
    float ridgeAxis=dot(vBuildingPoint.xz,across);
    vec2 tile=vec2(ridgeAxis/.34,vBuildingPoint.y/.21);
    vec2 aa=max(fwidth(tile),vec2(.025)),edge=min(fract(tile),1.-fract(tile));
    float seam=1.-smoothstep(.035,.035+aa.x,edge.x)*smoothstep(.05,.05+aa.y,edge.y);
    float cell=fract(sin(dot(floor(tile),vec2(12.9898,78.233)))*43758.5453);
    float tileDetail=(1.-smoothstep(.5,1.6,max(aa.x,aa.y)))*(1.-smoothstep(150.,280.,distance(cameraPosition,vIslandSurface)));
    diffuseColor.rgb*=mix(1.,mix(.94,1.08,cell)*(1.-seam*.18),roof*tileDetail);
    // Rounded pantiles catch the sun on alternate shoulders as the light moves.
    float tileRelief=.018*cos(6.283185*tile.x)*roof*tileDetail+(grain-.5)*.022*paleWall*wallDetail;`:''}
    diffuseColor.rgb*=mix(.92,1.06,grain)*mix(.96,1.03,mottling);
    diffuseColor.rgb*=1.-islandWetness*.13;
    diffuseColor.rgb*=mix(.83,1.,smoothstep(-.5,6.,vIslandSurface.y));
    ${terrain?(northCoast?terrainScanColor.replace('coastScansReady*.30*(1.-scanBeach)','coastScansReady*.08*scanDetail*(1.-scanBeach)'):terrainScanColor):rockAsset?rockScanColor:''}`);
   if(architecture)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec3 tileDx=dFdx(-vViewPosition),tileDy=dFdy(-vViewPosition);
    vec3 tileU=cross(tileDy,normal),tileV=cross(normal,tileDx);
    float tileDet=dot(tileDx,tileU);
    vec3 tileGrad=dFdx(tileRelief)*tileU+dFdy(tileRelief)*tileV;
    if(abs(tileDet)>1e-8)normal=normalize(abs(tileDet)*normal-sign(tileDet)*tileGrad);`);
   if(architecture||terrain)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    if(districtNight>.001){float districtGlow=0.;for(int i=0;i<2;i++){vec2 uv=(vIslandSurface.xz-districtAreas[i].xy)/districtAreas[i].zw+.5;if(all(greaterThan(uv,vec2(.002)))&&all(lessThan(uv,vec2(.998)))){uv.x=(uv.x+float(i))*.5;vec4 bounce=texture2D(districtMap,uv);districtGlow=max(districtGlow,bounce.r*exp(-abs(vIslandSurface.y-bounce.g*300.)/14.));}}
    totalEmissiveRadiance+=diffuseColor.rgb*vec3(.40,.20,.075)*districtGlow*districtNight*${architecture?'1.':'.30'};}`);
   if(architecture)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    // Fired terracotta has broad, restrained sun reflections; plaster stays matte.
    float tileRoughness=mix(.54,.36,islandWetness)+(grain-.5)*.11*tileDetail;
    roughnessFactor=mix(roughnessFactor,tileRoughness,roof);
    ${classified?`if(vBuildingSurface==2.)roughnessFactor=.19;
    if(vBuildingSurface==3.)roughnessFactor=mix(.68,.50,islandWetness);
    if(vBuildingSurface==4.)roughnessFactor=.47;
    if(vBuildingSurface==5.)roughnessFactor=mix(.89,.60,islandWetness);`:''}
   `);
   // An extra shallow veil gives distant headlands soft bases while ridges stay legible.
   shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#include <fog_fragment>
    #ifdef USE_FOG
     float marineDistance=length(cameraPosition.xz-vIslandSurface.xz);
     float marineLayer=1.-smoothstep(12.,170.,vIslandSurface.y);
     float marineVeil=smoothstep(700.,4400.,marineDistance)*mix(.49,.16,districtNight)*marineLayer;
     gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,marineVeil);
    #endif`);
   if(rockAsset)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float wetStone=1.-smoothstep(.4,3.2,vIslandSurface.y);
    roughnessFactor=mix(roughnessFactor,.48,wetStone*.8);`);
   if(rockAsset){shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+rockScanNormal);shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+rockScanRoughness);}
   if(terrain){
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+terrainScanNormal);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+terrainScanRoughness);
   }
  };
  material.customProgramCacheKey=()=> `island-scanned-v14-${previousKey}-${material.userData.terrainBiome??'asset'}-${Boolean(material.userData.architecture)}-${Boolean(material.userData.coastalRock)}-${Boolean(material.userData.architectureAO)}-${Boolean(material.userData.buildingSurface)}`;material.needsUpdate=true;
 }});}
 setContactOccluders(plots:readonly HousePlot[]){this.contact.texture.dispose();this.contact=createSettlementOcclusion(plots);}
 setNightLightSources(sites:readonly {x:number;y:number;z:number}[]){this.district.texture.dispose();this.district=createSettlementLightMap(sites);}
 setNightness(value:number){this.night.value=T.MathUtils.clamp(value,0,1);}
 setWetness(value:number){this.wetness.value=T.MathUtils.clamp(value,0,1);}
 dispose(){this.contact.texture.dispose();this.scans.dispose();this.district.texture.dispose();this.texture.dispose();}
}
