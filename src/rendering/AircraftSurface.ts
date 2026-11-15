import * as T from 'three';

/** Upgrade GLTF standard surfaces so metal anisotropy and fabric specular controls really apply. */
export function physicalAircraftMaterial(source:T.Material){
 if(source instanceof T.MeshPhysicalMaterial||!(source instanceof T.MeshStandardMaterial))return source;
 const material=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(material,source);
 material.defines={STANDARD:'',PHYSICAL:''};return material;
}

/** Keep cavity shading in indirect light; sunlight and lacquer highlights stay intact. */
export function prepareAircraftSurface(material:T.MeshPhysicalMaterial,hasAO:boolean) {
 const name=material.name.toLowerCase();
 const propellerMetal=/mc72.*propeller.*alloy/.test(name);
 if(propellerMetal){
  // Satin metal retains directional glints without a mirror-like blade face.
  material.color.setRGB(.46,.48,.47);material.metalness=.8;
  material.roughness=.48;material.clearcoat=0;material.anisotropy=.10;
  material.emissive.setHex(0);material.emissiveIntensity=0;
 }else if(/lacquer|enamel/.test(name)){
  // Pigmented paint stays dielectric. A restrained varnish sits over the worked skin.
  material.metalness=0;material.roughness=material.roughnessMap?.94:.34;
  material.clearcoat=/structural|ivory|white|bottom/.test(name)?.32:.56;
  const skinRoughness=/wing|tailplane/.test(name)?.29:/cowling/.test(name)?.21:.24;
  material.clearcoatRoughness=/structural|bottom/.test(name)?.32:skinRoughness;material.ior=1.48;material.specularIntensity=.92;
  if(material.normalMap)material.normalScale.multiplyScalar(.45);
 }else if(/radiator|散热/.test(name)){
  material.metalness=.79;material.roughness=material.roughnessMap?.90:.40;
  material.anisotropy=.42;material.clearcoat=0;
 }else if(/brass|bronze|polished hub/.test(name)){
  material.roughness=material.roughnessMap?.88:.36;material.metalness=.78;material.clearcoat=0;material.anisotropy=.24;
 }else if(/mahogany|varnished|walnut/.test(name)){
  material.metalness=0;material.roughness=material.roughnessMap?.96:.42;material.clearcoat=.28;material.clearcoatRoughness=.29;material.anisotropy=.16;
 }else if(name.includes('fabric')){
  material.metalness=0;material.roughness=material.roughnessMap?1:.88;material.clearcoat=0;material.specularIntensity=.35;material.sheen=.23;material.sheenColor.setHex(0xe3ddca);material.sheenRoughness=.85;
 }else if(/leather|interior|intake shadow/.test(name)){
  material.metalness=0;material.clearcoat=0;material.roughness=Math.max(.78,material.roughness);material.specularIntensity=.5;
 }else if(/steel|alloy|rigging|tension wire/.test(name)){
  material.metalness=.82;material.roughness=material.roughnessMap?.95:/dark|steel|rigging|wire/.test(name)?.47:.28;material.clearcoat=0;material.anisotropy=.28;
 }
 if(name.includes('glass')){
  material.color.setRGB(.90,.94,.93);material.opacity=.22;material.depthWrite=false;
  material.metalness=0;material.roughness=.13;material.clearcoat=.25;material.clearcoatRoughness=.18;
 }
 material.clearcoatNormalMap=null;
 material.envMapIntensity=propellerMetal?.62:/lacquer|enamel/.test(name)?.96:/alloy|brass|bronze/.test(name)?1:.8;
 if(hasAO)material.vertexColors=false;
 material.onBeforeCompile=shader=>{
  // Preserve a finite base image even at singular thin-metal highlight directions.
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
   if(any(isnan(gl_FragColor.rgb))||any(isinf(gl_FragColor.rgb)))gl_FragColor.rgb=diffuseColor.rgb*.2;
   gl_FragColor.rgb=clamp(gl_FragColor.rgb,vec3(0.),vec3(64.));`);
  if(!hasAO)return;
  shader.vertexShader='attribute vec4 aircraftAO; varying float vAircraftAO;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAircraftAO=aircraftAO.r;');
  shader.fragmentShader='varying float vAircraftAO;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
   float aircraftOcclusion=mix(1.0,clamp(vAircraftAO,0.0,1.0),.94);
   reflectedLight.indirectDiffuse*=aircraftOcclusion;
   reflectedLight.indirectSpecular*=mix(1.0,aircraftOcclusion,.45);`);
 };
 material.customProgramCacheKey=()=> 'aircraft-finite-radiance-v3-'+hasAO;material.needsUpdate=true;
}
