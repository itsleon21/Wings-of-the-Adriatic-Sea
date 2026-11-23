import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {sampleOceanWaves,oceanWaveGLSL,oceanGridCoordinate} from './OceanWaves.ts';
import {marineWindDirection} from './MarineWind.ts';
import {allLandforms as islands,terrainHeight,terrainRadii,smooth} from './WorldConfig.ts';

const shoreDomains=islands.map(island=>({island,...terrainRadii(island)}));
const shoreGLSL=`uniform sampler2D shoreMap;uniform vec4 islands[${islands.length}];
 float seaBed(vec2 p){float bed=-20.;for(int i=0;i<${islands.length};i++){
 vec2 uv=(p-islands[i].xy)/(islands[i].zw*2.4)+.5;
 if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)bed=max(bed,texture2D(shoreMap,vec2((float(i)+clamp(uv.x,.002,.998))/${islands.length.toFixed(1)},clamp(uv.y,.002,.998))).r*40.-20.);
 }return bed;}`;
/** Height-derived shallows and a low-resolution HDR planar reflection share the world geometry. */
export class Ocean {
 readonly mesh:Reflector;
 private material:T.ShaderMaterial;private noiseMap:T.DataTexture;private shoreMap:T.DataTexture;
 private reflections=true;private reflectionExclusions:T.Object3D[]=[];
 constructor(){
  const pixels=new Uint8Array(128*128);let seed=117;
  for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;pixels[i]=(seed>>>24)&255;}
  this.noiseMap=new T.DataTexture(pixels,128,128,T.RedFormat);this.noiseMap.wrapS=this.noiseMap.wrapT=T.RepeatWrapping;this.noiseMap.magFilter=T.LinearFilter;this.noiseMap.minFilter=T.LinearMipmapLinearFilter;this.noiseMap.generateMipmaps=true;this.noiseMap.needsUpdate=true;
  const resolution=256,shore=new Uint8Array(resolution*resolution*islands.length);
  for(let k=0;k<islands.length;k++){const {island:d,rx,rz}=shoreDomains[k];for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
   const h=terrainHeight(d,d.x+(x/(resolution-1)-.5)*rx*2.4,d.z+(y/(resolution-1)-.5)*rz*2.4);
   shore[y*resolution*islands.length+k*resolution+x]=Math.round(T.MathUtils.clamp((h+20)/40,0,1)*255);
  }}
  this.shoreMap=new T.DataTexture(shore,resolution*islands.length,resolution,T.RedFormat);this.shoreMap.magFilter=this.shoreMap.minFilter=T.LinearFilter;this.shoreMap.needsUpdate=true;
  const seaGeometry=new T.PlaneGeometry(1,1,256,256),vertices=seaGeometry.attributes.position;
  for(let i=0;i<vertices.count;i++){vertices.setXY(i,oceanGridCoordinate(vertices.getX(i)*2),oceanGridCoordinate(vertices.getY(i)*2));}seaGeometry.computeBoundingSphere();
  // The water samples a blurred mip chain, so resolving an MSAA mirror is redundant.
  this.mesh=new Reflector(seaGeometry,{textureWidth:768,textureHeight:768,multisample:0,clipBias:.001,shader:{name:'Adriatic sea',uniforms:T.UniformsUtils.merge([{
   color:{value:new T.Color(0xffffff)},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},
   storm:{value:new T.Vector4(.25,0,3800,16000)},beacon:{value:new T.Vector4()},harborLights:{value:Array.from({length:4},()=>new T.Vector4())},beaconDirection:{value:new T.Vector3(0,-.17,-.98)},dayGain:{value:1},sunStrength:{value:1},time:{value:0},noiseMap:{value:this.noiseMap},shoreMap:{value:this.shoreMap},
   islands:{value:shoreDomains.map(({island,rx,rz})=>new T.Vector4(island.x,island.z,rx,rz))},
   sun:{value:new T.Vector3(-.52,.64,.56).normalize()},moon:{value:new T.Vector3(1,0,0)},moonIllumination:{value:1},sunColor:{value:new T.Color(0xffefd9)},fogColor:{value:new T.Color(0x86aebc)},reflectionEnabled:{value:1},
  }]),vertexShader:`
   #include <common>
   #include <logdepthbuf_pars_vertex>
   varying vec3 vWorld;varying vec4 vMirror;uniform mat4 textureMatrix;uniform float time;uniform vec4 storm;
   ${shoreGLSL}
   ${oceanWaveGLSL}
   void main(){
    vec4 worldPosition=modelMatrix*vec4(position,1.);
    float fade=smoothstep(1.,7.,-seaBed(worldPosition.xz))*(1.-smoothstep(1000.,2800.,distance(cameraPosition.xz,worldPosition.xz)));
    worldPosition.y+=oceanWave(worldPosition.xz,time,storm.x).x*fade;vWorld=worldPosition.xyz;
    vMirror=textureMatrix*vec4(position,1.);
    vec4 mvPosition=viewMatrix*worldPosition;
     gl_Position=projectionMatrix*mvPosition;
    #include <logdepthbuf_vertex>
   }`,fragmentShader:`
   #include <common>
   #include <logdepthbuf_pars_fragment>
   varying vec3 vWorld;varying vec4 vMirror;
   uniform sampler2D cloudShadowMap;uniform vec2 cloudDrift;uniform float cloudCover;uniform vec4 storm;uniform float sunStrength;uniform float dayGain;uniform float moonIllumination;uniform vec4 beacon;uniform vec3 beaconDirection;uniform vec4 harborLights[4];uniform float time;uniform sampler2D noiseMap;uniform sampler2D tDiffuse;
   ${shoreGLSL}
   ${oceanWaveGLSL}
   uniform vec3 sun;uniform vec3 moon;uniform vec3 sunColor;uniform vec3 fogColor;uniform float reflectionEnabled;
   // Bilinear, mip-filtered noise uses the same continuous field at every altitude.
   float valueNoise(vec2 p){return texture2D(noiseMap,(p+.5)/128.).r;}
   float noise(vec2 p){
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    vec3 weights=vec3(.63,.25,.12)*(1.-smoothstep(vec3(.18),vec3(.85),footprint*vec3(1.,2.13,4.37)));
    vec3 samples=vec3(valueNoise(p),valueNoise(mat2(.8,-.6,.6,.8)*p*2.13+47.),valueNoise(p*4.37-19.));
    return .5+dot(weights,samples-.5);
   }
   void main(){
    vec2 p=vWorld.xz;float bed=seaBed(p);
    float shoreNoise=noise(p*.052+vec2(.1*time,0.));
    float shoreAA=max(.04,fwidth(bed)*1.5);
    // Bottom influence decays with water depth. Its colour stays fixed to the seabed.
    float depth=max(0.,-bed);
    float bottomVisibility=exp(-depth*.24)*(1.-smoothstep(12.,20.,depth));
    // Hundreds-of-metres water masses; domain warp breaks the noise lattice.
    vec2 basin=mat2(.84,-.54,.54,.84)*p*.00185;
    vec2 bend=vec2(valueNoise(basin*.72+11.),valueNoise(basin*.93-24.))-.5;
    vec2 currentUV=basin+1.75*bend;
    float current=smoothstep(.24,.76,noise(currentUV));
    current=mix(.5,current,.58+.42*dayGain);
    float seabedTexture=noise(p*.028+17.);
    vec3 deep=mix(vec3(.007,.054,.118),vec3(.021,.153,.196),current);
    vec3 bottom=mix(vec3(.036,.27,.23),vec3(.12,.46,.35),smoothstep(.20,.8,.42*seabedTexture+.58*current));
    vec3 body=mix(deep,bottom,bottomVisibility*.89);
    vec2 reefUV=(p-islands[${islands.findIndex(d=>d.id==='coral')}].xy)/islands[${islands.findIndex(d=>d.id==='coral')}].zw;
    float reefPatch=(1.-smoothstep(1.02,1.17,length(reefUV)))*smoothstep(.48,.68,noise(p*.034))*smoothstep(2.,5.,-bed)*(1.-smoothstep(12.,18.,-bed));
    body=mix(body,vec3(.025,.16,.14),reefPatch*.55);
    vec2 windDrift=vec2(${marineWindDirection.x.toFixed(3)},${marineWindDirection.z.toFixed(3)})*time*(.12+storm.x*.68);
    vec2 ripplePoint=p-windDrift;
    vec2 gust=vec2(valueNoise(ripplePoint*.019),valueNoise(ripplePoint*.011+31.))-.5;
    ripplePoint+=gust*13.;
    float n1=noise(ripplePoint*.10);
    float n2=noise(mat2(.76,-.65,.65,.76)*(ripplePoint+windDrift*.19)*.143+vec2(7.1,19.));
    float n3=noise(p*.023+vec2(-time*.045,time*.025));
    float distanceToCamera=distance(cameraPosition,vWorld),lod=(1.-smoothstep(150.,3400.,distanceToCamera)*.93)*(.65+storm.x*.7);
    float waveFade=smoothstep(1.,7.,-bed)*(1.-smoothstep(1000.,2800.,distance(cameraPosition.xz,p)));
    vec3 wave=oceanWave(p,time,storm.x);
    float nearRipples=1.-smoothstep(55.,520.,distanceToCamera);
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    float middleSwell=(.35+.65*(1.-smoothstep(1200.,6500.,distanceToCamera)))*(1.-.74*smoothstep(3.,34.,footprint));
    float sheltered=1.-smoothstep(.4,.98,waveShelter(p).x);
    float roughWater=clamp(.13+(.64*storm.x+.24*(gust.y+.5))*mix(1.,.52,sheltered)+.24*storm.y,0.,1.);
    // Two independently moving short-wave packets. Their envelopes interrupt the crests
    // across the wave direction; distance and pixel footprint filter them out in flight.
    float detail=nearRipples*(1.-smoothstep(.20,2.8,footprint));
    float mouth=4.*sheltered*(1.-sheltered);
    vec2 rippleDirA=vec2(.89,.456),rippleDirB=vec2(-.58,.815);
    float rippleA=dot(p,rippleDirA)*1.80-time*3.6+13.0*n1+4.0*n3;
    float rippleB=dot(p,rippleDirB)*2.72-time*4.7+15.0*n2-5.0*n3;
    float packetA=smoothstep(.25,.75,n1),packetB=smoothstep(.26,.73,n2);
    vec2 shortSlope=(rippleDirA*cos(rippleA)*packetA*.092+rippleDirB*cos(rippleB)*packetB*(.068+.036*mouth));
    float shortCrest=max(sin(rippleA)*packetA,sin(rippleB)*packetB);
    float shortEnergy=detail*mix(1.,.28,sheltered)*(.47+.78*storm.x);
    vec2 crossRipple=(vec2(n1-.5,n2-.5)*(.012+.060*detail)+shortSlope*shortEnergy)*lod;
    float swellSlope=middleSwell*mix(.52,.83,smoothstep(.26,.75,n3))*(1.-.68*smoothstep(8.,36.,footprint));
    vec3 normal=normalize(vec3(-wave.y*waveFade*swellSlope-crossRipple.x,1.,-wave.z*waveFade*swellSlope-crossRipple.y));
    vec3 view=normalize(cameraPosition-vWorld),reflected=reflect(-view,normal);
    float noV=clamp(dot(view,normal),.001,1.);
    float fresnel=.0204+.9796*pow(1.-noV,5.);
    float solarEnergy=dayGain*smoothstep(-.008,.025,sun.y);
    float lowSun=(1.-smoothstep(.07,.43,sun.y))*solarEnergy;
    float towardSun=smoothstep(.18,.96,dot(reflected,sun));
    vec3 skyReflection=mix(fogColor,vec3(.065,.21,.37)*(.16+.84*dayGain),smoothstep(0.,.75,reflected.y));
    skyReflection+=sunColor*lowSun*towardSun*.22;
    // Distortion fades into the waterline so solid shoreline contacts stay anchored.
    float shoreDistortion=smoothstep(.7,6.,-bed);
    vec2 mirrorUV=vMirror.xy/vMirror.w+normal.xz*mix(.036,.099,roughWater)*shoreDistortion*min(1.,20./max(1.,distanceToCamera*.12));
    vec2 mirrorEdge=smoothstep(vec2(.005),vec2(.045),mirrorUV)*(1.-smoothstep(vec2(.955),vec2(.995),mirrorUV));
    float valid=mirrorEdge.x*mirrorEdge.y*step(0.,vMirror.w)*reflectionEnabled;
    vec3 mirrorColor=texture2D(tDiffuse,clamp(mirrorUV,.015,.985),1.35+roughWater*3.5+smoothstep(160.,1300.,distanceToCamera)).rgb;
    if(any(isnan(mirrorColor))||any(isinf(mirrorColor)))mirrorColor=skyReflection;
    // Keep solid reflections strongest at grazing angles in sheltered water.
    float mirrorMix=valid*(1.-smoothstep(.13,.53,noV))*mix(.34,.63,sheltered)*(1.-roughWater*.74);
    // Let the common atmospheric colour take over from shore reflections offshore after dark.
    mirrorMix*=1.-(1.-smoothstep(.02,.27,dayGain))*smoothstep(1000.,3800.,distanceToCamera);
    vec3 reflection=mix(skyReflection,min(mirrorColor,vec3(1.35)),mirrorMix);
    vec3 halfSum=view+sun;
    vec3 halfDirection=halfSum*inversesqrt(max(dot(halfSum,halfSum),.00001));
    // A dielectric microfacet lobe with a roughness floor set by the screen-space footprint.
    float dotNH=max(dot(normal,halfDirection),0.);
    float noL=max(.001,dot(normal,sun));
    float voH=clamp(dot(view,halfDirection),0.,1.);
    float alphaSquared=clamp(mix(.0018,.017,clamp(storm.x,0.,1.))+fwidth(dotNH)*.36,.0018,.12);
    float denominator=dotNH*dotNH*(alphaSquared-1.)+1.;
    float distribution=alphaSquared/(3.14159*denominator*denominator);
    float visibility=.5/max(.008,noL*sqrt(noV*noV*(1.-alphaSquared)+alphaSquared)+noV*sqrt(noL*noL*(1.-alphaSquared)+alphaSquared));
    float glint=min(2.4,distribution*visibility*(.0204+.9796*pow(1.-voH,5.))*noL);
    // Kilometre-scale currents remain visible from cruise altitude; short ripples resolve near the floats.
    body*=.97+.025*wave.x/(.34+storm.x*.64)*nearRipples;
    body*=.24+.76*dayGain;vec3 color=mix(body*(.78+.30*noL),reflection,fresnel*mix(.36,.62,1.-roughWater));
    // Broad directional sheen and filtered fine glints make a broken solar path, not a mirror.
    float cloudShadow=texture2D(cloudShadowMap,(p-cloudDrift)/22000.+.5).r*min(1.,cloudCover/.38);
    float directVisibility=1.-.70*cloudShadow;
    float solarPath=mix(1.,smoothstep(.956,.998,dot(normalize(vec3(view.x,.0001,view.z)),normalize(vec3(-sun.x,.0001,-sun.z)))),lowSun*.88);
    color+=sunColor*glint*directVisibility*sunStrength*solarEnergy*.59*solarPath*mix(.44,1.,smoothstep(.25,.73,n2));
    float marineGlow=lowSun*pow(max(dot(view,-sun),0.),8.)*(1.-exp(-distanceToCamera/5000.))*.12;
    color=mix(color,sunColor*.42,marineGlow);
    color*=1.+.048*(n3-.5)*nearRipples;
    float crest=smoothstep(.19,.64,wave.x/(.34+storm.x*.64))*(.34+.66*smoothstep(.28,.72,n1));
    color+=vec3(.003,.017,.014)*crest*(.4+.6*sunStrength)*nearRipples;
    // Moonlit local relief keeps the landing surface readable without brightening the sky.
    float nightWater=1.-dayGain;
    float nearWater=1.-smoothstep(180.,1000.,distanceToCamera);
    float moonRelief=max(dot(normal,moon),0.);
    color+=vec3(.002,.005,.008)*nightWater*nearWater*moonRelief;
    vec2 reflectedAzimuth=reflected.xz*inversesqrt(max(.00001,dot(reflected.xz,reflected.xz)));
    vec2 moonAzimuth=moon.xz*inversesqrt(max(.00001,dot(moon.xz,moon.xz)));
    float moonTrack=smoothstep(.9994,.99998,dot(reflectedAzimuth,moonAzimuth));
    float moonGlints=pow(max(0.,dot(reflected,moon)),110.)*moonTrack*smoothstep(-.002,.012,moon.y);
    color+=vec3(.046,.052,.061)*moonGlints*mix(.16,1.,smoothstep(.30,.77,n2))*moonIllumination*nightWater;
    color+=vec3(.004,.009,.013)*nightWater*crest*nearRipples*nearWater;
    // Broken crest highlights provide a moving height cue on final approach.
    float crestFacing=clamp(dot(normal.xz,sun.xz)*2.5+.35,0.,1.);
    float localCrest=nearWater*nearRipples*crest*crestFacing*mix(.44,1.,smoothstep(.26,.75,shortCrest)*detail);
    color+=mix(vec3(.010,.015,.020),sunColor*.064,dayGain)*localCrest;
    // Animated light concentration on submerged sand, visible only in clear shallows.
    float shallowLight=smoothstep(.25,1.2,depth)*(1.-smoothstep(2.,5.5,depth));
    if(shallowLight>.001&&distanceToCamera<165.&&solarEnergy>.001){
     vec2 refractedBed=p-sun.xz*depth/max(.55,sun.y+1.);
     float a=sin(refractedBed.x*1.6+refractedBed.y*.67+time*.76+wave.x*1.8);
     float b=sin(refractedBed.x*.39-refractedBed.y*1.43-time*.69+wave.y*2.);
     float caustic=pow(1.-min(1.,abs(a*b)),7.);
     color+=vec3(.046,.084,.069)*caustic*shallowLight*(1.-fresnel)*directVisibility*solarEnergy*sunStrength*(1.-smoothstep(65.,165.,distanceToCamera));
    }
    float whitecaps=smoothstep(.16,.39,length(wave.yz))*smoothstep(.28,.62,wave.x/(.34+storm.x*.64))*smoothstep(.32,.8,storm.x)*smoothstep(.29,.73,n2);
    color=mix(color,vec3(.48,.65,.65)*(.16+.84*dayGain),whitecaps*.32*(1.-smoothstep(240.,920.,distanceToCamera)));
    // Advancing depth contours break into patches. Filter narrow bands at flight altitude.
    float shoreZone=smoothstep(.10,.85,depth)*(1.-smoothstep(5.,10.,depth));
    float breakerPhase=depth*.78+time*.72+noise(p*.018)*7.2;
    float phaseWidth=max(.035,fwidth(breakerPhase));
    float crestFoam=smoothstep(.72-phaseWidth,.94+phaseWidth,sin(breakerPhase));
    float brokenEdge=smoothstep(.27,.68,shoreNoise+noise(p*.21-vec2(time*.08))*.24);
    float surfDetail=1.-smoothstep(.4,1.8,phaseWidth);
    float breaking=shoreZone*crestFoam*brokenEdge*surfDetail*smoothstep(.25,.61,seabedTexture+.18*n3);
    float wash=(1.-smoothstep(.2-shoreAA,2.8+shoreAA,abs(bed+.4)))*(.20+.42*shoreNoise);
    wash*=.62+.38*sin(time*1.25+noise(p*.012)*5.);
    wash*=smoothstep(.27,.65,seabedTexture);
    float foam=clamp(wash+breaking*.72,0.,.86);
    vec3 foamLight=mix(vec3(.65,.79,.77),sunColor*.87,lowSun*.34)*(.12+.88*dayGain);
    color=mix(color,foamLight,foam*.76);
    vec3 toWater=vWorld-beacon.xyz;float beaconDistance=max(1.,length(toWater));vec3 oppositeBeam=vec3(-beaconDirection.x,beaconDirection.y,-beaconDirection.z);float beamAngle=max(dot(toWater/beaconDistance,beaconDirection),dot(toWater/beaconDistance,oppositeBeam));float beamPool=smoothstep(.996,.9988,beamAngle)*(1.-smoothstep(1100.,1400.,beaconDistance));
    color+=vec3(1.,.77,.38)*beacon.w*(beamPool+smoothstep(.975,.998,beamAngle)*.18)*min(.18,85000./(beaconDistance*beaconDistance));
    for(int i=0;i<4;i++){
     vec2 delta=vWorld.xz-harborLights[i].xy;
     float falloff=exp(-dot(delta,delta)/max(1.,harborLights[i].z*harborLights[i].z));
     float alignment=max(0.,dot(reflected,normalize(vec3(-delta.x,10.,-delta.y))));
     float sheen=pow(alignment,9.)*.035+pow(alignment,24.)*.090;
     color+=vec3(1.,.67,.28)*harborLights[i].w*falloff*(.014+sheen);
    }
    color*=1.-cloudShadow*dayGain*.32;
    color*=1.-storm.y*.12;
    color=mix(color,fogColor,smoothstep(storm.z*mix(.45,1.,dayGain),storm.w*mix(.55,1.,dayGain),distanceToCamera));
    gl_FragColor=vec4(color,1.);
    #include <logdepthbuf_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`}});
  const reflectionTexture=this.mesh.getRenderTarget().texture;reflectionTexture.generateMipmaps=true;reflectionTexture.minFilter=T.LinearMipmapLinearFilter;
  this.material=this.mesh.material as T.ShaderMaterial;this.material.lights=false;
  this.mesh.rotation.x=-Math.PI/2;this.mesh.receiveShadow=false;this.mesh.frustumCulled=false;this.mesh.name='Reflective Adriatic water';
  const capture=this.mesh.onBeforeRender,sourceProjection=new T.Matrix4();
  this.mesh.onBeforeRender=(renderer,scene,camera,geometry,material,group)=>{
   this.mesh.position.x=camera.position.x;this.mesh.position.z=camera.position.z;this.mesh.updateMatrixWorld();
   const visibleReflection=this.reflections&&camera.position.y<=1600;
   this.material.uniforms.reflectionEnabled.value=visibleReflection?1:0;
   if(!visibleReflection)return;
   // Keep the captured view and texture projection aligned with the current camera.
   // Skipping captures while the camera moves makes reflected coastlines jump between old views.
   // Keep aircraft shadow casters active, but omit their near-water planar image.
   const states=new Map<T.Material,{color:boolean;depth:boolean}>();
   const hidden:T.Points[]=[];
   for(const root of this.reflectionExclusions)if(root instanceof T.Points&&root.visible){root.visible=false;hidden.push(root);}
   for(const root of this.reflectionExclusions)root.traverse(object=>{if(object instanceof T.Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])if(!states.has(m)){states.set(m,{color:m.colorWrite,depth:m.depthWrite});m.colorWrite=false;m.depthWrite=false;}});
   const proxies=new Map<T.Mesh,T.BufferGeometry>();
   scene.traverseVisible(object=>{
    if(!(object instanceof T.InstancedMesh)||!object.userData.secondaryGeometry||object.geometry===object.userData.secondaryGeometry)return;
    if(!object.boundingSphere||object.boundingSphere.distanceToPoint(camera.position)<100)return;
    proxies.set(object,object.geometry);
    object.geometry=object.userData.secondaryGeometry;
   });
   // Extend the reflected view beyond the screen to leave room for wave distortion.
   const projection=camera.projectionMatrix;
   sourceProjection.copy(projection);
   projection.elements[0]*=.88;projection.elements[5]*=.88;
   try{capture.call(this.mesh,renderer,scene,camera,geometry,material,group);}
   finally{
    projection.copy(sourceProjection);
    for(const points of hidden)points.visible=true;
    for(const [mesh,geometry] of proxies)mesh.geometry=geometry;
    for(const [m,state] of states){m.colorWrite=state.color;m.depthWrite=state.depth;}
   }
  };
 }
 setHarborLights(lights:T.Vector4[]){this.material.uniforms.harborLights.value=lights;}
 bindCloudShadows(uniforms:Record<string,T.IUniform>){Object.assign(this.material.uniforms,uniforms);}
 excludeFromReflection(object:T.Object3D){this.reflectionExclusions.push(object);}
 get waveUniforms(){return{time:this.material.uniforms.time,storm:this.material.uniforms.storm};}
 surfaceAt(x:number,z:number,time=this.material.uniforms.time.value){
  let bed=-20;
  // The shader samples each shore atlas over this same extent.
  for(const {island,rx,rz} of shoreDomains){
   if(Math.abs(x-island.x)>=rx*1.2||Math.abs(z-island.z)>=rz*1.2)continue;
   bed=Math.max(bed,terrainHeight(island,x,z));
  }
  const fade=smooth(1,7,-bed);
  if(fade===0)return{height:0,dx:0,dz:0,velocity:0};
  const wave=sampleOceanWaves(x,z,time,this.material.uniforms.storm.value.x);
  return{height:wave.height*fade,dx:wave.dx*fade,dz:wave.dz*fade,velocity:wave.velocity*fade};
 }
 heightAt(x:number,z:number){return this.surfaceAt(x,z).height;}
 update(time:number){this.material.uniforms.time.value=time;}
 setWeather(wind:number,rain:number,sun:number,near:number,far:number){this.material.uniforms.storm.value.set(wind,rain,near,far);this.material.uniforms.sunStrength.value=sun/3.1;}
 setQuality(low:boolean){this.reflections=!low;this.material.uniforms.reflectionEnabled.value=low?0:1;}
 setBeacon(position:T.Vector3,direction:T.Vector3,strength:number){this.material.uniforms.beacon.value.set(position.x,position.y,position.z,strength);this.material.uniforms.beaconDirection.value.copy(direction);}
 setLighting(sun:T.Vector3,color:T.Color,fog:T.Color,_focus:T.Vector3,day=1,moon?:readonly [number,number,number],solar?:readonly [number,number,number],moonIllumination=1){this.material.uniforms.dayGain.value=day;this.material.uniforms.moonIllumination.value=moonIllumination;const solarVector=this.material.uniforms.sun.value;if(solar)solarVector.fromArray(solar).normalize();else solarVector.copy(sun);if(moon)this.material.uniforms.moon.value.fromArray(moon).normalize();this.material.uniforms.sunColor.value.copy(color);this.material.uniforms.fogColor.value.copy(fog);}
 dispose(){this.noiseMap.dispose();this.shoreMap.dispose();this.mesh.getRenderTarget().dispose();}
}
