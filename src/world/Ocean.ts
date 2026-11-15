import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {sampleOceanWaves,oceanWaveGLSL,oceanGridCoordinate} from './OceanWaves.ts';
import {allLandforms as islands,terrainHeight,smooth} from './WorldConfig.ts';

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
  for(let k=0;k<islands.length;k++){const d=islands[k];for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
   const h=terrainHeight(d,d.x+(x/(resolution-1)-.5)*d.rx*2.4,d.z+(y/(resolution-1)-.5)*d.rz*2.4);
   shore[y*resolution*islands.length+k*resolution+x]=Math.round(T.MathUtils.clamp((h+20)/40,0,1)*255);
  }}
  this.shoreMap=new T.DataTexture(shore,resolution*islands.length,resolution,T.RedFormat);this.shoreMap.magFilter=this.shoreMap.minFilter=T.LinearFilter;this.shoreMap.needsUpdate=true;
  const seaGeometry=new T.PlaneGeometry(1,1,256,256),vertices=seaGeometry.attributes.position;
  for(let i=0;i<vertices.count;i++){vertices.setXY(i,oceanGridCoordinate(vertices.getX(i)*2),oceanGridCoordinate(vertices.getY(i)*2));}seaGeometry.computeBoundingSphere();
  this.mesh=new Reflector(seaGeometry,{textureWidth:768,textureHeight:768,multisample:2,clipBias:.001,shader:{name:'Adriatic sea',uniforms:T.UniformsUtils.merge([{
   color:{value:new T.Color(0xffffff)},tDiffuse:{value:null},textureMatrix:{value:new T.Matrix4()},
   storm:{value:new T.Vector4(.25,0,3800,16000)},beacon:{value:new T.Vector4()},harborLights:{value:Array.from({length:4},()=>new T.Vector4())},beaconDirection:{value:new T.Vector3(0,-.17,-.98)},dayGain:{value:1},sunStrength:{value:1},time:{value:0},noiseMap:{value:this.noiseMap},shoreMap:{value:this.shoreMap},
   islands:{value:islands.map(d=>new T.Vector4(d.x,d.z,d.rx,d.rz))},
   sun:{value:new T.Vector3(-.52,.64,.56).normalize()},sunColor:{value:new T.Color(0xffefd9)},fogColor:{value:new T.Color(0x86aebc)},reflectionEnabled:{value:1},
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
   uniform sampler2D cloudShadowMap;uniform vec2 cloudDrift;uniform float cloudCover;uniform vec4 storm;uniform float sunStrength;uniform float dayGain;uniform vec4 beacon;uniform vec3 beaconDirection;uniform vec4 harborLights[4];uniform float time;uniform sampler2D noiseMap;uniform sampler2D tDiffuse;
   ${shoreGLSL}
   ${oceanWaveGLSL}
   uniform vec3 sun;uniform vec3 sunColor;uniform vec3 fogColor;uniform float reflectionEnabled;
   vec2 seaHash(vec2 cell){vec3 q=fract(vec3(cell.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
   float valueNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(seaHash(i).x,seaHash(i+vec2(1.,0.)).x,f.x),mix(seaHash(i+vec2(0.,1.)).x,seaHash(i+1.).x,f.x),f.y);}
   float noise(vec2 p){return valueNoise(p)*.63+valueNoise(mat2(.8,-.6,.6,.8)*p*2.13+47.)*.25+valueNoise(p*4.37-19.)*.12;}
   // A non-tiling cellular pigment field, blended across irregular cell edges.
   float pigment(vec2 p){vec2 cell=floor(p),local=fract(p);float first=99.,second=99.,a=0.,b=0.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 offset=vec2(float(x),float(y)),id=cell+offset;vec2 delta=offset+.15+.70*seaHash(id)-local;float d=dot(delta,delta),v=seaHash(id+91.7).x;
     if(d<first){second=first;b=a;first=d;a=v;}else if(d<second){second=d;b=v;}}
    float edge=1.-smoothstep(0.,.23,sqrt(second)-sqrt(first));return mix(a,b,edge*.5);
   }
   void main(){
    vec2 p=vWorld.xz;float bed=seaBed(p);
    float shoreNoise=noise(p*.052+vec2(.1*time,0.));
    float shoreAA=max(.04,fwidth(bed)*1.5);
    float shallow=(1.-smoothstep(1.-shoreAA,16.+shoreAA,-bed));
    vec3 sand=vec3(.025,.49,.38),deep=vec3(.008,.070,.145);
    vec2 flow=p+vec2(time*.035,-time*.021);
    vec2 warp=vec2(valueNoise(flow/1400.),valueNoise(flow.yx/1700.+27.))-.5;
    float broad=pigment((flow+warp*650.)/620.),detail=pigment((mat2(.93,-.36,.36,.93)*flow+warp*120.)/145.);
    float patches=clamp(broad*.78+detail*.22,0.,1.);
    vec3 deepPigment=mix(vec3(.007,.052,.115),vec3(.016,.135,.205),smoothstep(.08,.92,patches));
    deepPigment=mix(deepPigment,vec3(.014,.145,.160),smoothstep(.72,.98,broad)*.32);
    vec3 shallowPigment=mix(sand*.88,vec3(.035,.56,.46),patches);
    float shoal=(1.-smoothstep(1.5,7.,-bed))*smoothstep(-.5,1.,-bed);
    shallowPigment=mix(shallowPigment,vec3(.075,.43,.36),shoal*.36);
    vec3 body=mix(deep*.15+deepPigment*.85,shallowPigment,shallow*.88);
    vec2 reefUV=(p-islands[${islands.findIndex(d=>d.id==='coral')}].xy)/islands[${islands.findIndex(d=>d.id==='coral')}].zw;
    float reefPatch=(1.-smoothstep(1.02,1.17,length(reefUV)))*smoothstep(.48,.68,noise(p*.034))*smoothstep(2.,5.,-bed)*(1.-smoothstep(12.,18.,-bed));
    body=mix(body,vec3(.025,.16,.14),reefPatch*.55);
    float n1=noise(p*.10+vec2(time*(.10+storm.x*.22),time*.07));
    float n2=noise(p*.143+vec2(7.1,-time*.13));
    float n3=noise(p*.023+vec2(-time*.045,time*.025));
    float distanceToCamera=distance(cameraPosition,vWorld),lod=(1.-smoothstep(150.,3400.,distanceToCamera)*.93)*(.65+storm.x*.7);
    float waveFade=smoothstep(1.,7.,-bed)*(1.-smoothstep(1000.,2800.,distance(cameraPosition.xz,p)));
    vec2 swellWarp=vec2(valueNoise(p/180.+11.),valueNoise(p.yx/210.-7.))-.5;
    vec3 wave=oceanWave(p+swellWarp*24.,time,storm.x);
    float nearRipples=1.-smoothstep(70.,1100.,distanceToCamera);
    float middleSwell=.35+.65*(1.-smoothstep(1200.,6500.,distanceToCamera));
    vec2 crossRipple=vec2(n1-.5,n2-.5)*(.025+.055*nearRipples)*lod;
    vec3 normal=normalize(vec3(-wave.y*waveFade*middleSwell+crossRipple.x,1.,-wave.z*waveFade*middleSwell+crossRipple.y));
    vec3 view=normalize(cameraPosition-vWorld),reflected=reflect(-view,normal);
    float fresnel=.0204+.9796*pow(1.-max(dot(view,normal),0.),5.);
    float lowSun=(1.-smoothstep(.07,.43,sun.y))*dayGain;
    float towardSun=smoothstep(.18,.96,dot(reflected,sun));
    vec3 skyReflection=mix(fogColor,vec3(.065,.21,.37)*(.16+.84*dayGain),smoothstep(0.,.75,reflected.y));
    skyReflection+=sunColor*lowSun*towardSun*.22;
    // Distortion fades into the waterline so solid shoreline contacts stay anchored.
    float shoreDistortion=smoothstep(.7,6.,-bed);
    vec2 mirrorUV=vMirror.xy/vMirror.w+normal.xz*.065*shoreDistortion*min(1.,20./max(1.,distanceToCamera*.12));
    vec2 mirrorEdge=smoothstep(vec2(.002),vec2(.012),mirrorUV)*(1.-smoothstep(vec2(.988),vec2(.998),mirrorUV));
    float valid=mirrorEdge.x*mirrorEdge.y*step(0.,vMirror.w)*reflectionEnabled;
    vec3 mirrorColor=texture2D(tDiffuse,clamp(mirrorUV,.015,.985),3.+storm.x*1.5).rgb;
    if(any(isnan(mirrorColor))||any(isinf(mirrorColor)))mirrorColor=skyReflection;
    mirrorColor=mirrorColor/(1.+mirrorColor);
    vec3 reflection=mix(skyReflection,mirrorColor,valid);
    vec3 halfDirection=normalize(view+sun);
    // Filter the narrow lobe over a pixel footprint instead of letting subpixel glints blink.
    float dotNH=max(dot(normal,halfDirection),0.);
    float specularFootprint=max(.00001,fwidth(dotNH));
    float roughExponent=mix(210.,105.,storm.x);
    float filteredExponent=roughExponent/(1.+roughExponent*specularFootprint*6.);
    float glint=pow(dotNH,filteredExponent)*(filteredExponent/160.);
    // Kilometre-scale currents remain visible from cruise altitude; short ripples resolve near the floats.
    float current=valueNoise(p*.0019+vec2(n3*.24,-n3*.16));
    body*=mix(vec3(.84,.91,.98),vec3(1.06,1.105,1.035),smoothstep(.16,.84,current));
    body*=.97+.025*wave.x/(.34+storm.x*.64)*nearRipples;
    body*=.24+.76*dayGain;vec3 color=mix(body*(.78+.30*max(dot(normal,sun),0.)),reflection,.02+.18*smoothstep(.02,.98,fresnel));
    // Broad directional sheen and filtered fine glints make a broken solar path, not a mirror.
    float cloudShadow=texture2D(cloudShadowMap,(p-cloudDrift)/22000.+.5).r*min(1.,cloudCover/.38);
    float sunPath=lowSun*towardSun;
    float swellBands=smoothstep(.18,.82,.64*current+.36*n3);
    float broadGlint=pow(dotNH,mix(26.,21.,sunPath))*.055;
    broadGlint*=mix(1.,mix(.70,1.20,swellBands),sunPath);
    float directVisibility=1.-.76*sunPath*cloudShadow;
    glint*=1.-.20*sunPath*(1.-nearRipples);
    color+=sunColor*(glint*.60+broadGlint)*directVisibility*sunStrength*mix(.72,1.12,mix(n3,n1,nearRipples));
    float marineGlow=lowSun*pow(max(dot(view,-sun),0.),8.)*(1.-exp(-distanceToCamera/5000.))*.12;
    color=mix(color,sunColor*.42,marineGlow);
    color*=.96+.08*n3;
    float crest=smoothstep(.38,.88,wave.x/(.34+storm.x*.64))*(.4+.6*n1);
    color+=vec3(.003,.017,.014)*crest*(.4+.6*sunStrength)*nearRipples;
    // Moonlit local relief keeps the landing surface readable without brightening the sky.
    float nightWater=1.-dayGain;
    float nearWater=1.-smoothstep(180.,1000.,distanceToCamera);
    float moonRelief=max(dot(normal,sun),0.);
    color+=vec3(.002,.005,.008)*nightWater*nearWater*moonRelief;
    float lunarSheen=pow(dotNH,32.)*mix(.45,1.,n2);
    color+=vec3(.15,.19,.24)*nightWater*lunarSheen;
    color+=vec3(.004,.009,.013)*nightWater*crest*nearRipples*nearWater;
    // Broken crest highlights provide a moving height cue on final approach.
    float crestFacing=clamp(dot(normal.xz,sun.xz)*2.5+.35,0.,1.);
    float localCrest=nearWater*nearRipples*crest*crestFacing*smoothstep(.24,.67,n2);
    color+=mix(vec3(.010,.015,.020),sunColor*.064,dayGain)*localCrest;
    float whitecaps=smoothstep(.48,.74,length(wave.yz))*smoothstep(.3,.8,storm.x)*(0.4+.6*n2);
    color=mix(color,vec3(.48,.65,.65)*(.16+.84*dayGain),whitecaps*.4);
    // Advancing depth contours break into patches. Filter narrow bands at flight altitude.
    float depth=max(0.,-bed);
    float shoreZone=smoothstep(.10,.85,depth)*(1.-smoothstep(5.,10.,depth));
    float breakerPhase=depth*.78+time*.72+noise(p*.018)*2.3;
    float phaseWidth=max(.035,fwidth(breakerPhase));
    float crestFoam=smoothstep(.72-phaseWidth,.94+phaseWidth,sin(breakerPhase));
    float brokenEdge=smoothstep(.27,.68,shoreNoise+noise(p*.21-vec2(time*.08))*.24);
    float surfDetail=1.-smoothstep(.4,1.8,phaseWidth);
    float breaking=shoreZone*crestFoam*brokenEdge*surfDetail;
    float wash=(1.-smoothstep(.2-shoreAA,2.8+shoreAA,abs(bed+.4)))*(.20+.42*shoreNoise);
    wash*=.62+.38*sin(time*1.25+noise(p*.012)*5.);
    float foam=clamp(wash+breaking*.72,0.,.86);
    vec3 foamLight=mix(vec3(.65,.79,.77),sunColor*.87,lowSun*.34)*(.12+.88*dayGain);
    color=mix(color,foamLight,foam*.76);
    vec3 toWater=vWorld-beacon.xyz;float beaconDistance=max(1.,length(toWater));vec3 oppositeBeam=vec3(-beaconDirection.x,beaconDirection.y,-beaconDirection.z);float beamAngle=max(dot(toWater/beaconDistance,beaconDirection),dot(toWater/beaconDistance,oppositeBeam));float beamPool=smoothstep(.996,.9988,beamAngle)*(1.-smoothstep(1100.,1400.,beaconDistance));
    color+=vec3(1.,.77,.38)*beacon.w*(beamPool+smoothstep(.975,.998,beamAngle)*.18)*min(.18,85000./(beaconDistance*beaconDistance));
    for(int i=0;i<4;i++){vec2 delta=vWorld.xz-harborLights[i].xy;float falloff=exp(-dot(delta,delta)/max(1.,harborLights[i].z*harborLights[i].z));color+=vec3(1.,.67,.28)*harborLights[i].w*falloff*(.035+.10*pow(max(0.,dot(reflect(-view,normal),normalize(vec3(-delta.x,10.,-delta.y)))),16.));}
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
  const capture=this.mesh.onBeforeRender;
  this.mesh.onBeforeRender=(renderer,scene,camera,geometry,material,group)=>{
   this.mesh.position.x=camera.position.x;this.mesh.position.z=camera.position.z;this.mesh.updateMatrixWorld();
   const visibleReflection=this.reflections&&camera.position.y<=1600;
   this.material.uniforms.reflectionEnabled.value=visibleReflection?1:0;
   if(!visibleReflection)return;
   // Keep the captured view and texture projection aligned with the current camera.
   // Skipping captures while the camera moves makes reflected coastlines jump between old views.
   // Keep aircraft shadow casters active, but omit their near-water planar image.
   const states=new Map<T.Material,{color:boolean;depth:boolean}>();
   for(const root of this.reflectionExclusions)root.traverse(object=>{if(object instanceof T.Mesh)for(const m of Array.isArray(object.material)?object.material:[object.material])if(!states.has(m)){states.set(m,{color:m.colorWrite,depth:m.depthWrite});m.colorWrite=false;m.depthWrite=false;}});
   try{capture.call(this.mesh,renderer,scene,camera,geometry,material,group);}finally{for(const [m,state] of states){m.colorWrite=state.color;m.depthWrite=state.depth;}}
  };
 }
 setHarborLights(lights:T.Vector4[]){this.material.uniforms.harborLights.value=lights;}
 bindCloudShadows(uniforms:Record<string,T.IUniform>){Object.assign(this.material.uniforms,uniforms);}
 excludeFromReflection(object:T.Object3D){this.reflectionExclusions.push(object);}
 get waveUniforms(){return{time:this.material.uniforms.time,storm:this.material.uniforms.storm};}
 surfaceAt(x:number,z:number,time=this.material.uniforms.time.value){let bed=-20;for(const d of islands)bed=Math.max(bed,terrainHeight(d,x,z));const w=sampleOceanWaves(x,z,time,this.material.uniforms.storm.value.x),fade=smooth(1,7,-bed);return{height:fade?w.height*fade:0,dx:w.dx*fade,dz:w.dz*fade,velocity:w.velocity*fade};}
 heightAt(x:number,z:number){return this.surfaceAt(x,z).height;}
 update(time:number){this.material.uniforms.time.value=time;}
 setWeather(wind:number,rain:number,sun:number,near:number,far:number){this.material.uniforms.storm.value.set(wind,rain,near,far);this.material.uniforms.sunStrength.value=sun/3.1;}
 setQuality(low:boolean){this.reflections=!low;this.material.uniforms.reflectionEnabled.value=low?0:1;}
 setBeacon(position:T.Vector3,direction:T.Vector3,strength:number){this.material.uniforms.beacon.value.set(position.x,position.y,position.z,strength);this.material.uniforms.beaconDirection.value.copy(direction);}
 setLighting(sun:T.Vector3,color:T.Color,fog:T.Color,_focus:T.Vector3,day=1){this.material.uniforms.dayGain.value=day;this.material.uniforms.sun.value.copy(sun);this.material.uniforms.sunColor.value.copy(color);this.material.uniforms.fogColor.value.copy(fog);}
 dispose(){this.noiseMap.dispose();this.shoreMap.dispose();this.mesh.getRenderTarget().dispose();}
}
