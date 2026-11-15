import * as T from 'three';
import {createCloudLayout,cloudImmersionAt} from './CloudLayout.ts';
import {cloudShapes,createCloudField} from './CloudShapes.ts';
import {cloudPalette} from './CloudLighting.ts';
import type {DaylightValues} from './TimeOfDay.ts';
import type {WeatherId} from './WeatherConfig.ts';
const atlasSize=40,atlasKinds=cloudShapes.length*2;
let atlasData:Uint8Array|undefined;
/** Bake twelve eroded density fields once; one filtered 3D lookup replaces per-step shape/noise stacks. */
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
 private texture:T.Data3DTexture;private elapsed=0;private weather?:WeatherId;private reveal=1;private seed:number;
 private dummy=new T.Object3D();private frustum=new T.Frustum();private viewMatrix=new T.Matrix4();private bound=new T.Sphere();
 constructor(scene:T.Scene,seed=Math.floor(Math.random()*1000000)){
  this.seed=seed;this.texture=new T.Data3DTexture(densityAtlas(),atlasSize,atlasSize,atlasSize*atlasKinds);this.texture.format=T.RedFormat;this.texture.minFilter=this.texture.magFilter=T.LinearFilter;this.texture.unpackAlignment=1;this.texture.needsUpdate=true;
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.BackSide,toneMapped:false,uniforms:{densityMap:{value:this.texture},viewSteps:{value:24},cloudResolution:{value:new T.Vector2(1,1)},sceneDepth:{value:null},cameraFar:{value:26000},useSceneDepth:{value:0},sunDirection:{value:new T.Vector3(-.52,.64,.56).normalize()},lightTint:{value:new T.Color(1,.91,.76)},dayGain:{value:1},sunStrength:{value:1},ambientHigh:{value:new T.Color(.84,.87,.89)},ambientLow:{value:new T.Color(.30,.37,.49)},aerialTint:{value:new T.Color(.39,.54,.69)},rain:{value:0},visibility:{value:16000},probeNeutralness:{value:0},reveal:{value:1}},
  vertexShader:`varying vec3 vEye;varying vec3 vLocal;varying vec3 vSize;varying vec2 vTurn;varying float vKind;
attribute float cloudKind;attribute vec2 cloudTurn;
void main(){vec3 center=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vSize=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));vTurn=cloudTurn;vec3 eye=cameraPosition-center;vEye=vec3(eye.x*vTurn.x+eye.z*vTurn.y,eye.y,-eye.x*vTurn.y+eye.z*vTurn.x)/vSize;vLocal=position;vKind=cloudKind;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
  fragmentShader:`precision highp sampler3D;
uniform sampler3D densityMap;uniform sampler2D sceneDepth;uniform float viewSteps;uniform vec2 cloudResolution;uniform float cameraFar;uniform float useSceneDepth;uniform vec3 sunDirection;uniform vec3 lightTint;uniform vec3 ambientHigh;uniform vec3 ambientLow;uniform vec3 aerialTint;uniform float dayGain;uniform float sunStrength;uniform float rain;uniform float visibility;uniform float probeNeutralness;uniform float reveal;
varying vec3 vEye;varying vec3 vLocal;varying vec3 vSize;varying vec2 vTurn;varying float vKind;
vec3 toWorld(vec3 p){return vec3(p.x*vTurn.x-p.z*vTurn.y,p.y,p.x*vTurn.y+p.z*vTurn.x);}
float density(vec3 p){
 if(any(greaterThan(abs(p),vec3(1.))))return 0.;
 vec3 uv=(p*.5+.5)*${(atlasSize-1)/atlasSize}+.5/${atlasSize}.;
 uv.z=(vKind+uv.z)/${atlasKinds}.;
 // Wispy lower skirt becomes denser upwards, leaving sea and low coasts readable.
 return textureLod(densityMap,uv,0.).r*reveal*mix(.32,1.,smoothstep(-.80,.38,p.y));
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
  float shade=density(p+sunLocal*.23)*.75+density(p+sunLocal*.53)*.6;
  float sunlight=exp(-shade*1.8),altitude=smoothstep(-.6,.7,p.y);
  vec3 ambient=mix(ambientLow,ambientHigh,altitude)*mix(1.,.66,rain);
  float powder=1.-exp(-d*3.5),rim=pow(max(mu,0.),8.)*sunlight*(1.-d*.7);
  vec3 light=ambient*(.06+.94*dayGain)+lightTint*dayGain*sunStrength*(sunlight*(.40+.60*powder)*1.5+forward*sunlight*(.55+.28*sunsetEdge)+rim*(.42+.78*sunsetEdge*(1.-smoothstep(.12,.65,d))));
  light=mix(light,vec3(dot(light,vec3(.2126,.7152,.0722))),probeNeutralness*.94);
  float opacity=1.-exp(-d*worldStep*mix(.0048,.0075,rain));sum+=trans*opacity*light;trans*=1.-opacity;
 }
 float alpha=1.-trans;if(alpha<.001)discard;
 vec3 radiance=sum/max(.001,alpha);float aerial=1.-exp(-distanceToCloud/23000.);
 radiance=mix(radiance,aerialTint*(.06+.94*dayGain),aerial*.32);
 alpha*=1.-smoothstep(visibility*.65,visibility*1.25,distanceToCloud);
 gl_FragColor=vec4(radiance,alpha);
}`});
  const geometry=new T.BoxGeometry(2,2,2);geometry.setAttribute('cloudKind',new T.InstancedBufferAttribute(new Float32Array(80),1));geometry.setAttribute('cloudTurn',new T.InstancedBufferAttribute(new Float32Array(160),2));
  this.mesh=new T.InstancedMesh(geometry,material,80);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;this.mesh.name='Weather / layered volumetric maritime clouds';scene.add(this.mesh);this.setWeather('sunny',true);this.writeInstances(this.layout);
 }
 setWeather(weather:WeatherId,immediate=false){if(weather===this.weather)return;this.reveal=this.weather===undefined||immediate?1:0;this.weather=weather;this.layout=createCloudLayout(this.seed,weather);}
 private writeInstances(cells:ReturnType<typeof createCloudLayout>){
  const kinds=this.mesh.geometry.getAttribute('cloudKind') as T.InstancedBufferAttribute,turns=this.mesh.geometry.getAttribute('cloudTurn') as T.InstancedBufferAttribute;
  cells.forEach((c,i)=>{this.dummy.position.set(c.x,c.y+c.height*.4,c.z);this.dummy.scale.set(c.width*1.8,c.height*1.5,c.depth*1.3);this.dummy.rotation.set(0,-c.rotation,0);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);kinds.setX(i,cloudShapes.indexOf(c.shape)*2+c.variant);turns.setXY(i,Math.cos(c.rotation),Math.sin(c.rotation));});
  this.mesh.count=cells.length;this.mesh.instanceMatrix.needsUpdate=true;kinds.needsUpdate=turns.needsUpdate=true;
 }
 setView(camera:T.Camera){
  camera.updateMatrixWorld();this.viewMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.viewMatrix);
  const visible=this.layout.filter(c=>{this.bound.center.set(c.x+this.mesh.position.x,c.y+c.height*.4,c.z+this.mesh.position.z);this.bound.radius=Math.hypot(c.width*1.8,c.height*1.5,c.depth*1.3);return this.frustum.intersectsSphere(this.bound);});
  visible.sort((a,b)=>(b.x+this.mesh.position.x-camera.position.x)**2+(b.y-camera.position.y)**2+(b.z+this.mesh.position.z-camera.position.z)**2-((a.x+this.mesh.position.x-camera.position.x)**2+(a.y-camera.position.y)**2+(a.z+this.mesh.position.z-camera.position.z)**2));this.writeInstances(visible);
 }
 update(dt:number,rain:number,wind:number,weather:WeatherId='cloudy',visibility=16000){this.setWeather(weather,dt===0);this.elapsed+=dt*(.3+wind);this.reveal=Math.min(1,this.reveal+dt/2);const u=(this.mesh.material as T.ShaderMaterial).uniforms;u.rain.value=rain;u.visibility.value=visibility;u.reveal.value=T.MathUtils.smoothstep(this.reveal,0,1);this.mesh.position.set(Math.sin(this.elapsed*.0003)*300,0,Math.sin(this.elapsed*.0002)*180);this.writeInstances(this.layout);}
 immersion(point:T.Vector3){return cloudImmersionAt(point,this.layout,this.mesh.position)*this.reveal;}
 setDetail(scale:number){(this.mesh.material as T.ShaderMaterial).uniforms.viewSteps.value=scale>=.42?40:scale>=.25?32:24;}
 setProbeNeutralness(value:number){(this.mesh.material as T.ShaderMaterial).uniforms.probeNeutralness.value=value;}
 setLighting(direction:T.Vector3,color:T.Color,day:number,sunStrength=1,clock?:Pick<DaylightValues,'day'|'warm'|'sunset'>){const u=(this.mesh.material as T.ShaderMaterial).uniforms;u.sunDirection.value.copy(direction);u.lightTint.value.copy(color);u.dayGain.value=day;u.sunStrength.value=sunStrength;const palette=cloudPalette(clock??{day,warm:0,sunset:0});u.ambientHigh.value.fromArray(palette.top);u.ambientLow.value.fromArray(palette.bottom);u.aerialTint.value.fromArray(palette.aerial);}
 setSceneDepth(texture:T.DepthTexture|null,width:number,height:number,far:number){const u=(this.mesh.material as T.ShaderMaterial).uniforms;u.sceneDepth.value=texture;u.cloudResolution.value.set(width,height);u.cameraFar.value=far;u.useSceneDepth.value=texture?1:0;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();(this.mesh.material as T.Material).dispose();this.texture.dispose();}
}
