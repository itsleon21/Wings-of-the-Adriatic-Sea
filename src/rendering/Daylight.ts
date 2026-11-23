import * as T from 'three';
import {ReflectionBlend,reflectionHours} from './ReflectionBlend.ts';
import {weatherPresets} from './WeatherConfig.ts';
import {daylightAt} from './TimeOfDay.ts';
import type {DaylightValues} from './TimeOfDay.ts';
import type {WeatherValues} from './WeatherConfig.ts';
import {createNightStars} from './NightSky.ts';
import { Sky } from 'three/addons/objects/Sky.js';


import type {createCloudLayout} from './CloudLayout.ts';
import {PackedSunShadows} from './PackedSunShadows.ts';

/** Linear radiance shared by the distant sea, island haze and sky horizon. */
export function horizonRadiance(target:T.Color,w:WeatherValues,clock:DaylightValues,afterSunset:number){
 target.setRGB(w.tint[0],w.tint[1],w.tint[2],T.SRGBColorSpace);
 if(w.fogFar>9000)target.lerp(new T.Color(0xa4c9d8),.60*clock.day);
 target.lerp(
  new T.Color(.98,.65-.25*clock.sunset,.23-.09*clock.sunset),
  Math.min(.76,clock.warm*.87)*(1-afterSunset*.71)*(1-w.rain*.65),
 ).multiplyScalar(.045+clock.day*.955);
 // Once the solar disk is below the horizon, cool the residual aerosol colour
 // continuously into the night palette. Humid air softens the blue without warming it.
 const night=1-T.MathUtils.smoothstep(clock.solarElevation,-.14,-.035);
 const veil=T.MathUtils.clamp(w.rain*.65+(1-T.MathUtils.smoothstep(w.fogFar,2400,14000))*.55,0,1);
 return target.lerp(new T.Color(.004+.0015*veil,.008+.001*veil,.016-.003*veil),night);
}

/** A common HDR sky and sun drive reflections, aerial perspective and stable near/far shadows. */
export class Daylight {
 readonly sunDirection=new T.Vector3(-.52,.64,.56).normalize();
 private readonly twilightFill=new T.Color();
 readonly sunColor=new T.Color(0xffdfae);
 readonly fogColor=new T.Color(0x86aebc);
 private stars=createNightStars();private lunarAge=Math.random();
 private sky=new Sky();private environment:T.WebGLRenderTarget;private shadows=new PackedSunShadows();private sunlight=new T.DirectionalLight(0xffdfae,3.1);
 private probeScene=new T.Scene();
 private probeSky:Sky;
 private probeSea:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>;
 private pmrem:T.PMREMGenerator;
 private reflectionBlend?:ReflectionBlend;private disposed=false;
 private currentWeather:WeatherValues=weatherPresets.sunny;private currentClock=daylightAt(12);
 private lightingHour=12;private lightingCoverage=0;
 private renderer:T.WebGLRenderer;private hemi=new T.HemisphereLight(0xffedcf,0x8a744b,.16);private scene:T.Scene;private time=0;
 constructor(renderer:T.WebGLRenderer,scene:T.Scene,_camera:T.PerspectiveCamera){
  this.scene=scene;this.renderer=renderer;
  this.sky.scale.setScalar(24000);this.sky.renderOrder=-100;this.sky.frustumCulled=false;this.sky.material.depthTest=false;this.sky.material.depthWrite=false;
  const u=this.sky.material.uniforms;
  u.turbidity.value=2.5;u.rayleigh.value=1.75;u.mieCoefficient.value=.003;u.mieDirectionalG.value=.82;
  u.sunPosition.value.copy(this.sunDirection);u.cloudCoverage.value=0;u.cloudDensity.value=.65;u.cloudScale.value=.00075;u.cloudElevation.value=.35;u.cloudSpeed.value=.000012;
  u.solarDirection={value:new T.Vector3()};u.lunarPhase={value:0};u.lunarDirection={value:new T.Vector3()};u.horizonColor={value:this.fogColor.clone()};u.weatherVeil={value:0};u.nightness={value:0};u.dayWarmth={value:0};u.twilightPhase={value:0};u.afterSunset={value:0};u.environmentProbe={value:0};
  this.sky.material.fragmentShader=this.sky.material.fragmentShader.replace('* showSunDisc;','* 0.0;');
  this.sky.material.fragmentShader='uniform vec3 solarDirection;uniform vec3 lunarDirection;uniform float lunarPhase;uniform vec3 horizonColor;uniform float weatherVeil;uniform float nightness;uniform float dayWarmth;uniform float twilightPhase;uniform float afterSunset;uniform float environmentProbe;\n'+this.sky.material.fragmentShader.replace('#include <tonemapping_fragment>',
   'vec3 skyRay=normalize(vWorldPosition-cameraPosition);float horizonBlend=smoothstep(-.018,mix(.070,.024,afterSunset),skyRay.y);float remainingWarmth=1.-afterSunset*(.30+.65*smoothstep(.009,.064,skyRay.y));float solarSide=smoothstep(-.2,.7,dot(skyRay,solarDirection));float skyEnergy=mix(.126,.40,pow(dayWarmth,2.));gl_FragColor.rgb=mix(horizonColor,gl_FragColor.rgb*mix(vec3(skyEnergy),vec3(skyEnergy*.60),weatherVeil),horizonBlend);vec3 twilightScatter=mix(mix(vec3(.32,.22,.045),mix(vec3(.25,.15,.085),vec3(.34,.17,.075),solarSide),twilightPhase),mix(vec3(.10,.22,.42),vec3(.16,.19,.23),twilightPhase),smoothstep(.015,mix(.36,.56,twilightPhase),skyRay.y));gl_FragColor.rgb+=vec3(.082,.098,.11)*exp(-max(0.,skyRay.y)*5.)*horizonBlend*(1.-nightness)*(1.-weatherVeil);gl_FragColor.rgb=max(gl_FragColor.rgb,twilightScatter*dayWarmth*remainingWarmth*solarSide*(1.-weatherVeil*.55));gl_FragColor.rgb=mix(gl_FragColor.rgb,gl_FragColor.rgb/(1.+gl_FragColor.rgb*.5),smoothstep(.1,.5,weatherVeil));gl_FragColor.rgb=mix(gl_FragColor.rgb,horizonColor,weatherVeil);gl_FragColor.rgb*=mix(vec3(1.),mix(vec3(1.24,1.02,.48),vec3(1.20,.86,.60),twilightPhase),dayWarmth*.36*remainingWarmth*(1.-smoothstep(.04,.55,skyRay.y))*mix(.35,1.,solarSide));gl_FragColor.rgb*=mix(vec3(1.),vec3(.86,.98,1.14),(1.-dayWarmth)*(1.-weatherVeil));\n   vec3 nightRay=normalize(vWorldPosition-cameraPosition);vec3 nightSky=mix(horizonColor,vec3(.0025,.0045,.011),smoothstep(-.002,.20,nightRay.y));\n   vec3 axis=normalize(lunarDirection),east=normalize(cross(vec3(0.,1.,0.),axis)),up=cross(axis,east);vec2 p=vec2(dot(nightRay,east),dot(nightRay,up))/.010;float r2=dot(p,p);if(cameraPosition.y>=0. && r2<1.15 && dot(nightRay,axis)>0.){vec3 n=vec3(p,sqrt(max(0.,1.-r2)));float diffuse=max(0.,dot(n,vec3(sin(lunarPhase),0.,-cos(lunarPhase))));float maria=smoothstep(-.4,.65,sin(n.x*8.+n.z*5.)*.58+cos(n.y*12.-n.x*4.)*.34+sin(n.y*19.+n.z*12.)*.18);vec3 rock=mix(vec3(.83,.83,.82),vec3(.53,.53,.53),maria);float edge=1.-smoothstep(.96,1.04,r2);nightSky=mix(nightSky,vec3(.020,.025,.036)+rock*pow(diffuse,.82)*.92,edge*(1.-weatherVeil)*smoothstep(-.004,.002,nightRay.y));}\n   float moonSide=smoothstep(.94,.997,dot(nightRay,axis))*(1.-smoothstep(.018,.13,abs(axis.y)));float twilightLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.95,.98,1.)*twilightLuma,moonSide);gl_FragColor.rgb=mix(gl_FragColor.rgb,nightSky,nightness);\n   vec3 solarRay=normalize(vWorldPosition-cameraPosition);float solarDot=dot(solarRay,solarDirection);float horizonVisibility=smoothstep(-.004,.003,solarRay.y);float sunDisc=smoothstep(.999953,.999980,solarDot);float solarHalo=pow(max(solarDot,0.),2400.);float solarVisibility=horizonVisibility*showSunDisc*(1.-weatherVeil);float outerHalo=(pow(max(solarDot,0.),210.)*.15+pow(max(solarDot,0.),42.)*.045)*dayWarmth;gl_FragColor.rgb+=mix(vec3(1.,.93,.78),mix(vec3(1.,.72,.12),vec3(1.,.24,.035),twilightPhase),dayWarmth)*(solarHalo*.13+outerHalo*.55)*solarVisibility*(1.-sunDisc);vec3 solarSurface=mix(vec3(18.,17.,14.),mix(vec3(4.5,2.6,.26),vec3(4.8,.62,.055),twilightPhase),dayWarmth)*(.78+.22*sqrt(clamp((solarDot-.999953)/.000047,0.,1.)));gl_FragColor.rgb=mix(gl_FragColor.rgb,solarSurface,sunDisc*solarVisibility);\n   if(environmentProbe>.5){float radianceLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));gl_FragColor.rgb=mix(vec3(radianceLuma),gl_FragColor.rgb,.40); }\n#include <tonemapping_fragment>');
  scene.add(this.sky,this.stars);
  // Linear HDR radiance includes broad cloud highlights, without a blazing sun-disc reflection.
  this.probeSky=this.sky.clone();this.probeSky.material=this.sky.material.clone();
  this.probeSky.scale.setScalar(1000);this.probeScene.add(this.probeSky);
  this.probeSea=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.MeshBasicMaterial({color:0x6c7979,side:T.DoubleSide}));
  this.probeSea.rotation.x=-Math.PI/2;this.probeSea.position.y=-12;this.probeScene.add(this.probeSea);
  this.pmrem=new T.PMREMGenerator(renderer);
  this.environment=this.pmrem.fromScene(this.probeScene,.04,.1,16000,{size:64});
  scene.environment=this.environment.texture;
  scene.fog=new T.Fog(this.fogColor,3800,16000);
  scene.add(this.hemi);
  this.sunlight.position.copy(this.sunDirection).multiplyScalar(1800);this.sunlight.castShadow=false;scene.add(this.sunlight,this.sunlight.target);

 }
 get starStrength(){return this.stars.material.uniforms.strength.value as number;}
 get moonIllumination(){return .5-.5*Math.cos(this.lunarAge*Math.PI*2);}
 /** Strength of a visible celestial source, independent of the ambient sky fill. */
 get celestialReflection(){
  const clock=this.currentClock,w=this.currentWeather;
  const transmission=(1-T.MathUtils.smoothstep(w.coverage,.35,.94))*(1-w.rain*.94)*(w.fogFar<3000?.32:1);
  const sun=T.MathUtils.smoothstep(clock.solarElevation,-.005,.085);
  const moon=T.MathUtils.smoothstep(clock.moonDirection[1],-.002,.10)*clock.nightness*Math.sqrt(this.moonIllumination)*.72;
  return Math.max(sun,moon)*transmission;
 }
 get starField(){return this.stars;}
 get seaCloudUniforms(){return this.shadows.seaCloudUniforms;}
 prepare(root:T.Object3D){this.shadows.prepare(root);}
 setAircraft(root:T.Object3D){this.shadows.setAircraft(root);}
 setCloudLayout(cells:ReturnType<typeof createCloudLayout>){this.shadows.setCloudLayout(cells);}
 setShadows(enabled:boolean){this.shadows.enabled=enabled;}

 update(_focus:T.Vector3,camera:T.PerspectiveCamera,flying:boolean,dt=0){
  this.time+=dt;this.lunarAge+=dt/(1200*29.53059);this.sky.material.uniforms.lunarPhase.value=this.lunarAge*Math.PI*2;this.stars.material.uniforms.pixelRatio.value=this.renderer.getPixelRatio();this.stars.material.uniforms.time.value=this.time;this.sky.material.uniforms.time.value=this.time;this.sky.position.copy(camera.position);
  this.reflectionBlend?.update(this.renderer,this.lightingHour,this.lightingCoverage);
  camera.updateMatrixWorld();this.sunlight.position.copy(_focus).addScaledVector(this.sunDirection,1800);this.sunlight.target.position.copy(_focus);this.shadows.update(this.renderer,this.scene,_focus,this.sunDirection,dt,flying);
 }
 private copyProbe(){
  const source=this.sky.material.uniforms,target=this.probeSky.material.uniforms;
  for(const name of Object.keys(source)){
   const value=source[name].value;
   target[name].value=value?.clone?value.clone():value;
  }
  target.environmentProbe.value=1;target.showSunDisc.value=false;
  target.cloudCoverage.value=this.lightingCoverage*.65;target.cloudDensity.value=.55;
  const day=daylightAt(this.lightingHour).day;
  this.probeSea.material.color.setRGB(.10,.14,.15).multiplyScalar(.03+.97*day);
 }
 async warmEnvironment(){
  const maps:T.WebGLRenderTarget[]=[];
  for(const weather of[weatherPresets.sunny,weatherPresets.rain])for(const hour of reflectionHours){
   if(this.disposed){for(const map of maps)map.dispose();return;}
   const previousWeather=this.currentWeather,previousClock=this.currentClock;
   this.setWeather(weather,daylightAt(hour));this.copyProbe();this.setWeather(previousWeather,previousClock);
   maps.push(this.pmrem.fromScene(this.probeScene,.04,.1,16000,{size:64}));
   // Give the loading UI and asset decoding a frame between inexpensive probe bakes.
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  if(this.disposed){for(const map of maps)map.dispose();return;}
  this.reflectionBlend=new ReflectionBlend(maps);
  this.reflectionBlend.update(this.renderer,this.lightingHour,this.lightingCoverage);
  this.scene.environment=this.reflectionBlend.target.texture;this.environment.dispose();
 }

 setWeather(w:WeatherValues,clock:DaylightValues=daylightAt(12)){
  this.currentWeather=w;this.currentClock=clock;this.lightingHour=clock.hour;this.lightingCoverage=w.coverage;
  this.sunDirection.fromArray(clock.direction).normalize();this.sunColor.setRGB(clock.color[0],clock.color[1],clock.color[2]);this.sunColor.lerp(new T.Color(0xd7deeb),1-Math.min(1,clock.day/.18));
  this.shadows.setWeather(w.coverage,w.wind);
  this.shadows.setAtmosphere(this.sunDirection,this.sunColor,clock.warm*clock.day*(1-w.rain*.75));
  this.stars.material.uniforms.sidereal.value=(clock.hour+9)*Math.PI/12;this.stars.material.uniforms.strength.value=clock.nightness*(1-w.coverage*.94);this.stars.visible=clock.nightness>.02;
  const afterSunset=clock.hour>=16?1-T.MathUtils.smoothstep(clock.solarElevation,-.076,.018):0;
  const u=this.sky.material.uniforms;u.afterSunset.value=afterSunset;u.solarDirection.value.fromArray(clock.solarDirection).normalize();u.lunarDirection.value.fromArray(clock.moonDirection).normalize();u.sunPosition.value.copy(u.solarDirection.value);u.showSunDisc.value=clock.day>.08&&clock.solarElevation>-.01;u.nightness.value=clock.nightness;u.dayWarmth.value=clock.warm*.70;u.twilightPhase.value=clock.sunset;u.cloudCoverage.value=0;u.cloudDensity.value=w.density;u.cloudSpeed.value=.000008+w.wind*.000018;u.turbidity.value=w.haze;
  horizonRadiance(this.fogColor,w,clock,afterSunset);u.horizonColor.value.copy(this.fogColor);u.weatherVeil.value=Math.max(Math.max(0,(w.coverage-.58)/.42)*.58,w.fogFar<3000?.38:0);
  const fog=this.scene.fog as T.Fog;fog.color.copy(this.fogColor);fog.near=w.fogNear*(w.fogFar>9000?.65:1)*(1.-clock.warm*.32)*(1.-clock.nightness*.55);fog.far=w.fogFar*(w.fogFar>9000?.90:1)*(1.-clock.nightness*.45)*(1.-clock.warm*.10);
  // Cool skylight keeps shaded plaster distinct from the warm, sunlit facade.
  this.hemi.color.setHex(0xe6ecfa).lerp(this.twilightFill.setRGB(.80+.10*clock.sunset,.85,.98-.12*clock.sunset),clock.warm).lerp(this.twilightFill.setHex(0xa5aaba),clock.nightness);
  this.hemi.groundColor.setRGB(.24+.07*clock.warm,.22+.025*clock.warm,.19+.05*clock.nightness);this.hemi.intensity=.08+.08*clock.nightness+(.16+w.ambient*.47)*clock.day+.06*clock.warm;this.scene.environmentIntensity=.66+w.ambient*.34;this.scene.environmentRotation.set(0,0,0);
  this.sunlight.intensity=w.sun*clock.day*1.18+.28*clock.nightness;this.sunlight.color.copy(this.sunColor).lerp(new T.Color(0xf0eeE7),w.coverage*.28);
 }
 dispose(){this.disposed=true;this.reflectionBlend?.dispose();this.pmrem.dispose();this.probeSky.material.dispose();this.probeSea.geometry.dispose();this.probeSea.material.dispose();this.stars.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.LineSegments){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.shadows.dispose();this.sunlight.dispose();this.environment.dispose();this.sky.material.dispose();this.sky.geometry.dispose();}
}
