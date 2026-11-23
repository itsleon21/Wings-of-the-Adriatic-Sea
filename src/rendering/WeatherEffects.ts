import * as T from 'three';
import {CloudVolumes} from './CloudVolumes.ts';
import {CloudPass} from './CloudPass.ts';
import type {DaylightValues} from './TimeOfDay.ts';
import type {WeatherId} from './WeatherConfig.ts';
import {random} from '../world/WorldConfig.ts';
import {marineWindDirection,marineWindSpeed} from '../world/MarineWind.ts';
/** Camera-local rain streaks: deterministic motion, no per-frame geometry rebuild or intersecting sheets. */
export class WeatherEffects{
 private clouds:CloudVolumes;private cloudScene=new T.Scene();
 immersion=0;readonly rain:T.LineSegments;private opacity={value:0};private time={value:0};private wind={value:.2};private rainVelocity={value:new T.Vector3(0,-32,0)};private rainTravel={value:new T.Vector3()};
 constructor(scene:T.Scene){this.clouds=new CloudVolumes(this.cloudScene);this.rain=createRainStreaks(this.opacity,this.time,this.wind,this.rainVelocity,this.rainTravel);scene.add(this.rain);}
 createCloudPass(camera:T.PerspectiveCamera){return new CloudPass(this.cloudScene,camera,this.clouds);}
 cloudImmersionAt(position:T.Vector3){return this.clouds.immersion(position);}
 get cloudLayout(){return this.clouds.shadowLayout;}
 setLighting(_direction:T.Vector3,_color:T.Color,day:number,sunStrength=1,clock?:DaylightValues){this.clouds.setLighting(_direction,_color,day,sunStrength,clock);}
 update(dt:number,camera:T.Camera,rain:number,wind:number,weather:WeatherId='sunny',visibility=16000,velocity?:T.Vector3,overhead=false,gust=0){this.clouds.update(dt,rain,wind+gust*.6,weather,visibility);const target=this.clouds.immersion(camera.position);this.immersion+=(target-this.immersion)*(dt===0?1:1-Math.exp(-dt*4));this.time.value+=dt;this.opacity.value=rain;this.wind.value=wind;this.rainVelocity.value.copy(relativeRainVelocity(wind,velocity,overhead,gust));this.rainTravel.value.addScaledVector(this.rainVelocity.value,dt);this.rainTravel.value.set(T.MathUtils.euclideanModulo(this.rainTravel.value.x,110),T.MathUtils.euclideanModulo(this.rainTravel.value.y,65),T.MathUtils.euclideanModulo(this.rainTravel.value.z,110));this.rain.position.copy(camera.position);this.rain.visible=rain>.005;}
 dispose(){this.clouds.dispose();this.rain.removeFromParent();this.rain.geometry.dispose();(this.rain.material as T.Material).dispose();}
}

export function relativeRainVelocity(wind:number,velocity=new T.Vector3(),overhead=false,gust=0){
 const drift=marineWindSpeed(wind,gust);
 const relative=new T.Vector3(marineWindDirection.x*drift,-32,marineWindDirection.z*drift);
 if(!overhead)relative.sub(velocity);
 relative.x=T.MathUtils.clamp(relative.x,-155,155);relative.y=T.MathUtils.clamp(relative.y,-65,-5);relative.z=T.MathUtils.clamp(relative.z,-155,155);return relative;
}
export function createRainStreaks(opacity={value:0},time={value:0},wind={value:.2},rainVelocity={value:new T.Vector3(10,-32,5)},rainTravel={value:new T.Vector3()}){
  const rng=random(713),positions:number[]=[],tips:number[]=[];
  for(let i=0;i<1400;i++){const x=(rng()-.5)*110,y=rng()*65,z=(rng()-.5)*110;for(const tip of[0,1]){positions.push(x,y+tip*1.7,z);tips.push(tip);}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('tip',new T.Float32BufferAttribute(tips,1));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),rainOpacity:opacity,rainTime:time,windStrength:wind,rainVelocity,rainTravel},
   vertexShader:`#include <common>
   #include <fog_pars_vertex>
   #include <logdepthbuf_pars_vertex>
   attribute float tip;uniform float rainTime;uniform float windStrength;uniform vec3 rainVelocity;uniform vec3 rainTravel;varying float vFade;
   void main(){vec3 base=position-vec3(0.,tip*1.7,0.);
    vec3 p=mod(base+rainTravel+vec3(55.,32.5,55.),vec3(110.,65.,110.))-vec3(55.,20.,55.);
    p+=rainVelocity*tip*.055;vFade=1.-smoothstep(22.,55.,length(p.xz));vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
   #include <logdepthbuf_vertex>
   #include <fog_vertex>
   }`,fragmentShader:`#include <fog_pars_fragment>
   #include <logdepthbuf_pars_fragment>
   uniform float rainOpacity;varying float vFade;
   void main(){gl_FragColor=vec4(.65,.74,.79,rainOpacity*vFade*.34);
   #include <logdepthbuf_fragment>
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   #include <fog_fragment>
   }`,fog:true});
  const rain=new T.LineSegments(geo,material);rain.name='Weather / rain streaks';rain.frustumCulled=false;rain.visible=false;return rain;
}
