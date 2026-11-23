import * as T from 'three';
import {createCloudLayout,cloudImmersionAt} from './CloudLayout.ts';
import {cloudShapes,createCloudField} from './CloudShapes.ts';
import {cloudPalette} from './CloudLighting.ts';
import type {DaylightValues} from './TimeOfDay.ts';
import {weatherIds,type WeatherId} from './WeatherConfig.ts';
const atlasSize=40,atlasKinds=cloudShapes.length*2;
const layoutCapacity=80;
type CloudLayout=ReturnType<typeof createCloudLayout>;
function cloudyLife(time:number,seed:number){
 const phase=(time/(175+seed%110)+(seed%100)/100)%1;
 return T.MathUtils.smoothstep(phase,.03,.19)*(1-T.MathUtils.smoothstep(phase,.80,.98));
}
let atlasData:Uint8Array|undefined;
/** Bake the eroded density fields once; one filtered 3D lookup replaces per-step shape/noise stacks. */
function densityAtlas(){
 if(atlasData)return atlasData;
 const data=new Uint8Array(atlasSize**3*atlasKinds);
 for(let kind=0;kind<atlasKinds;kind++){
  const field=createCloudField(cloudShapes[Math.floor(kind/2)],57+(kind%2)*83);
  for(let z=0;z<atlasSize;z++)for(let y=0;y<atlasSize;y++)for(let x=0;x<atlasSize;x++){
   const px=(x/(atlasSize-1)*2-1)*1.8,py=(y/(atlasSize-1)*2-1)*1.5+.4,pz=(z/(atlasSize-1)*2-1)*1.3;
   const erosion=Math.sin(px*9+kind)*Math.sin(py*11+pz*4)*Math.sin(pz*10-px*3)*.032;
   const d=T.MathUtils.smoothstep(.065-field(px,py,pz)+erosion,0,.19);
   data[((kind*atlasSize+z)*atlasSize+y)*atlasSize+x]=Math.round(d*255);
  }
 }
 atlasData=data;return data;
}
/** Depth-clipped, front-to-back ray integration inside independently positioned 3D clouds. */
export class CloudVolumes{
 readonly mesh:T.InstancedMesh;layout:ReturnType<typeof createCloudLayout>=[];
 private texture:T.Data3DTexture;private elapsed=0;private cloudTime=0;private weather?:WeatherId;private seed:number;
 private weatherFields=new Map<WeatherId,{clouds:CloudLayout;mist:CloudLayout;weight:number}>();
 private shadowCountdown=0;shadowLayout:CloudLayout=[];
 private drift=new T.Vector3();private dummy=new T.Object3D();private frustum=new T.Frustum();private viewMatrix=new T.Matrix4();private bound=new T.Sphere();
 constructor(scene:T.Scene,seed=Math.floor(Math.random()*1000000)){
  this.seed=seed;this.texture=new T.Data3DTexture(densityAtlas(),atlasSize,atlasSize,atlasSize*atlasKinds);this.texture.format=T.RedFormat;this.texture.minFilter=this.texture.magFilter=T.LinearFilter;this.texture.unpackAlignment=1;this.texture.needsUpdate=true;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.BackSide,toneMapped:false,uniforms:{densityMap:{value:this.texture},viewSteps:{value:24},cloudResolution:{value:new T.Vector2(1,1)},sceneDepth:{value:null},cameraFar:{value:26000},useSceneDepth:{value:0},sunDirection:{value:new T.Vector3(-.52,.64,.56).normalize()},lightTint:{value:new T.Color(1,.91,.76)},dayGain:{value:1},sunStrength:{value:1},ambientHigh:{value:new T.Color(.84,.87,.89)},ambientLow:{value:new T.Color(.30,.37,.49)},aerialTint:{value:new T.Color(.39,.54,.69)},rain:{value:0},visibility:{value:16000},probeNeutralness:{value:0}},
  vertexShader:`varying vec3 vEye;varying vec3 vLocal;varying vec3 vSize;varying vec2 vTurn;varying float vKind;varying float vDensity;
attribute float cloudKind;attribute float cloudDensity;attribute vec2 cloudTurn;
void main(){vec3 center=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vSize=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));vTurn=cloudTurn;vec3 eye=cameraPosition-center;vEye=vec3(eye.x*vTurn.x+eye.z*vTurn.y,eye.y,-eye.x*vTurn.y+eye.z*vTurn.x)/vSize;vLocal=position;vKind=cloudKind;vDensity=cloudDensity;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp sampler3D;
uniform sampler3D densityMap;uniform sampler2D sceneDepth;uniform float viewSteps;uniform vec2 cloudResolution;uniform float cameraFar;uniform float useSceneDepth;uniform vec3 sunDirection;uniform vec3 lightTint;uniform vec3 ambientHigh;uniform vec3 ambientLow;uniform vec3 aerialTint;uniform float dayGain;uniform float sunStrength;uniform float rain;uniform float visibility;uniform float probeNeutralness;
varying vec3 vEye;varying vec3 vLocal;varying vec3 vSize;varying vec2 vTurn;varying float vKind;varying float vDensity;
vec3 toWorld(vec3 p){return vec3(p.x*vTurn.x-p.z*vTurn.y,p.y,p.x*vTurn.y+p.z*vTurn.x);}
float density(vec3 p){
 if(any(greaterThan(abs(p),vec3(1.))))return 0.;
 vec3 uv=(p*.5+.5)*${(atlasSize-1)/atlasSize}+.5/${atlasSize}.;
 uv.z=(vKind+uv.z)/${atlasKinds}.;
 // Wispy lower skirt becomes denser upwards, leaving sea and low coasts readable.
 return textureLod(densityMap,uv,0.).r*vDensity*mix(.32,1.,smoothstep(-.80,.38,p.y));
}
void main(){
 vec3 rd=normalize(vLocal-vEye),safeRay=mix(vec3(-1.),vec3(1.),step(vec3(0.),rd))*max(abs(rd),vec3(.00001));
 vec3 a=(-1.-vEye)/safeRay,b=(1.-vEye)/safeRay,lo=min(a,b),hi=max(a,b);
 float entry=max(0.,max(lo.x,max(lo.y,lo.z))),exit=min(hi.x,min(hi.y,hi.z));if(exit<=entry)discard;
 float distanceToCloud=length(toWorld(rd*vSize))*entry;
 if(distanceToCloud>visibility*1.25)discard;
 float sceneDistance=useSceneDepth>.5?exp2(texture2D(sceneDepth,gl_FragCoord.xy/cloudResolution).r*log2(cameraFar+1.))-1.:1.e8;
 // Clip the complete integration interval before sampling: geometry no longer removes whole depth slices.
 float viewDepthPerUnit=-(viewMatrix*vec4(toWorld(rd*vSize),0.)).z;
 if(useSceneDepth>.5&&viewDepthPerUnit>.00001)exit=min(exit,sceneDistance/viewDepthPerUnit);
 if(exit<=entry)discard;
 float inside=1.-smoothstep(0.,.08,entry);
 float steps=ceil(mix(mix(viewSteps,20.,smoothstep(6000.,15000.,distanceToCloud)),48.,inside)),stepSize=(exit-entry)/steps;
 vec3 sunLocal=normalize(vec3(sunDirection.x*vTurn.x+sunDirection.z*vTurn.y,sunDirection.y,-sunDirection.x*vTurn.y+sunDirection.z*vTurn.x)/vSize);
 vec3 worldRay=normalize(toWorld(rd*vSize));float mu=dot(worldRay,sunDirection),forward=.12/(pow(max(.08,1.36-1.2*mu),1.5));
 float sunsetEdge=(1.-smoothstep(.08,.45,sunDirection.y))*smoothstep(.65,.99,mu)*(1.-rain);
 float trans=1.,worldStep=length(rd*vSize)*stepSize,previousDensity=density(vEye+rd*entry);vec3 sum=vec3(0.);
 for(int i=0;i<64;i++){
  if(float(i)>=steps||trans<.02)break;
  vec3 p=vEye+rd*(entry+(float(i)+.5)*stepSize);
  float nextDensity=density(vEye+rd*(entry+(float(i)+1.)*stepSize));
  float d=(previousDensity+nextDensity)*.5;previousDensity=nextDensity;if(d<.004)continue;
  // Near and far samples approximate the optical thickness toward the sun.
  float shade=density(p+sunLocal*.18)*.63+density(p+sunLocal*.59)*.80;
  float sunlight=exp(-shade*1.8),altitude=smoothstep(-.6,.7,p.y);
  vec3 ambient=mix(ambientLow,ambientHigh,altitude)*mix(1.,.66,rain);
  float powder=1.-exp(-d*3.5);
  // The outline glows where the ray looks toward the sun and the edge is thin.
  float rim=pow(max(mu,0.),7.)*sunlight*(1.-d*.72);
  float thinEdge=smoothstep(.008,.055,d)*(1.-smoothstep(.10,.54,d));
  vec3 light=ambient*(.06+.94*dayGain)+lightTint*dayGain*sunStrength*(sunlight*(.40+.60*powder)*1.5+forward*sunlight*(.55+.28*sunsetEdge)+rim*(.42+.78*sunsetEdge*(1.-smoothstep(.12,.65,d))));
  light+=mix(lightTint,vec3(1.,.93,.84),.33)*dayGain*sunStrength*rim*thinEdge*(.68+1.22*sunsetEdge)*(1.-rain);
  light+=lightTint*ambient*dayGain*sunStrength*(1.-sunlight)*powder*.19;
  light=mix(light,vec3(dot(light,vec3(.2126,.7152,.0722))),probeNeutralness*.94);
  float opacity=1.-exp(-d*worldStep*mix(.0048,.0075,rain));sum+=trans*opacity*light;trans*=1.-opacity;
 }
 float alpha=1.-trans;if(alpha<.001)discard;
 vec3 radiance=sum/max(.001,alpha);float aerial=1.-exp(-distanceToCloud/23000.);
 radiance=mix(radiance,aerialTint*(.06+.94*dayGain),aerial*.32);
 alpha*=1.-smoothstep(visibility*.65,visibility*1.25,distanceToCloud);
 gl_FragColor=vec4(radiance,alpha);
}`});
  const capacity=layoutCapacity*weatherIds.length;
  const geometry=new T.BoxGeometry(2,2,2);geometry.setAttribute('cloudKind',new T.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('cloudDensity',new T.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('cloudTurn',new T.InstancedBufferAttribute(new Float32Array(capacity*2),2));
  this.mesh=new T.InstancedMesh(geometry,material,capacity);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.name='Weather / layered volumetric maritime clouds';scene.add(this.mesh);this.setWeather('sunny',true);this.writeInstances(this.layout);
 }
 setWeather(weather:WeatherId,immediate=false){
  if(weather===this.weather)return;
  this.weather=weather;
  if(immediate)this.weatherFields.clear();
  if(!this.weatherFields.has(weather)){
   const layout=createCloudLayout(this.seed,weather);
   this.weatherFields.set(weather,{
    clouds:layout.filter(c=>c.layer!=='cove-mist'),mist:layout.filter(c=>c.layer==='cove-mist'),weight:immediate?1:0,
   });
  }
  this.composeLayout();
 }
 private composeLayout(){
  const clouds:CloudLayout=[],live=this.weatherFields.get(this.weather!)!;
  let mistDensity=0,totalWeight=0;
  for(const [weather,field] of this.weatherFields){
   const weight=T.MathUtils.smoothstep(field.weight,0,1);
   totalWeight+=weight;mistDensity+=(field.mist[0].density??1)*weight;
   for(const cloud of field.clouds){
    const life=weather==='cloudy'?cloudyLife(this.cloudTime,cloud.seed):1;
    cloud.opacity=weight*life;
    clouds.push(cloud);
   }
  }
  for(const mist of live.mist)clouds.push({...mist,density:mistDensity/Math.max(totalWeight,.001)});
  this.layout=clouds;
 }
 private writeInstances(cells:ReturnType<typeof createCloudLayout>){
  const densities=this.mesh.geometry.getAttribute('cloudDensity') as T.InstancedBufferAttribute,kinds=this.mesh.geometry.getAttribute('cloudKind') as T.InstancedBufferAttribute,turns=this.mesh.geometry.getAttribute('cloudTurn') as T.InstancedBufferAttribute;
  cells.forEach((c,i)=>{const fixed=c.layer==='cove-mist';this.dummy.position.set(c.x+(fixed?0:this.drift.x),c.y+c.height*.4,c.z+(fixed?0:this.drift.z));densities.setX(i,(c.density??1)*(c.opacity??1));this.dummy.scale.set(c.width*1.8,c.height*1.5,c.depth*1.3);this.dummy.rotation.set(0,-c.rotation,0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);kinds.setX(i,cloudShapes.indexOf(c.shape)*2+c.variant);turns.setXY(i,Math.cos(c.rotation),Math.sin(c.rotation));});
  this.mesh.count=cells.length;this.mesh.instanceMatrix.needsUpdate=true;kinds.needsUpdate=turns.needsUpdate=densities.needsUpdate=true;
 }
 setView(camera:T.Camera){
  camera.updateMatrixWorld();this.viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.viewMatrix);
  const visible=this.layout.filter(c=>{if((c.opacity??1)<.006)return false;this.bound.center.set(c.x+(c.layer==='cove-mist'?0:this.drift.x),c.y+c.height*.4,c.z+(c.layer==='cove-mist'?0:this.drift.z));this.bound.radius=Math.hypot(c.width*1.8,c.height*1.5,c.depth*1.3);return this.frustum.intersectsSphere(this.bound);});
  const distance=(c:typeof visible[number])=>{const fixed=c.layer==='cove-mist';return (c.x+(fixed?0:this.drift.x)-camera.position.x)**2+(c.y-camera.position.y)**2+(c.z+(fixed?0:this.drift.z)-camera.position.z)**2;};
  visible.sort((a,b)=>distance(b)-distance(a));this.writeInstances(visible);
 }
 update(dt:number,rain:number,wind:number,weather:WeatherId='cloudy',visibility=16000){
  this.setWeather(weather,dt===0);
  this.elapsed+=dt*(.3+wind);this.cloudTime+=dt;
  if(dt>0){
   for(const [id,field] of this.weatherFields){
    field.weight=T.MathUtils.clamp(field.weight+dt*(id===weather?1:-1)/9,0,1);
    if(id!==weather&&field.weight===0)this.weatherFields.delete(id);
   }
   this.composeLayout();
  }
  this.shadowCountdown-=dt;
  if(this.shadowCountdown<=0||dt===0){this.shadowLayout=this.layout.slice();this.shadowCountdown=.4;}
  const u=(this.mesh.material as T.ShaderMaterial).uniforms;u.rain.value=rain;u.visibility.value=visibility;
  this.drift.set(Math.sin(this.elapsed*.0003)*300,0,Math.sin(this.elapsed*.0002)*180);
  this.writeInstances(this.layout);
 }
 immersion(point:T.Vector3){return cloudImmersionAt(point,this.layout,this.drift);}
 setDetail(scale:number){(this.mesh.material as T.ShaderMaterial).uniforms.viewSteps.value=scale>=.42?40:scale>=.25?32:24;}
 setProbeNeutralness(value:number){(this.mesh.material as T.ShaderMaterial).uniforms.probeNeutralness.value=value;}
 setLighting(direction:T.Vector3,color:T.Color,day:number,sunStrength=1,clock?:Pick<DaylightValues,'day'|'warm'|'sunset'>){const u=(this.mesh.material as T.ShaderMaterial).uniforms;u.sunDirection.value.copy(direction);u.lightTint.value.copy(color);u.dayGain.value=day;u.sunStrength.value=sunStrength;const palette=cloudPalette(clock??{day,warm:0,sunset:0});u.ambientHigh.value.fromArray(palette.top);u.ambientLow.value.fromArray(palette.bottom);u.aerialTint.value.fromArray(palette.aerial);}
 setSceneDepth(texture:T.DepthTexture|null,width:number,height:number,far:number){const u=(this.mesh.material as T.ShaderMaterial).uniforms;u.sceneDepth.value=texture;u.cloudResolution.value.set(width,height);u.cameraFar.value=far;u.useSceneDepth.value=texture?1:0;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.texture.dispose();}
}
