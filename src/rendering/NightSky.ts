import * as T from 'three';
import {random} from '../world/WorldConfig.ts';

// Rounded equatorial coordinates (RA hours, declination degrees, visual magnitude).
// Keep the naked-eye landmarks legible rather than filling every patch with glitter.
const stars=[
 [11.06,61.75,1.8],[11.03,56.38,2.4],[11.90,53.69,2.4],[12.26,57.03,3.3],[12.90,55.96,1.8],[13.40,54.93,2.2],[13.79,49.31,1.9],
 [2.53,89.26,2],[14.85,74.16,2.1],[15.35,71.83,3],[.15,59.15,2.3],[.68,56.54,2.2],[.95,60.72,2.5],[1.43,60.24,2.7],[1.91,63.67,3.3],
 [5.92,7.41,.5],[5.42,6.35,1.6],[5.53,-.30,2.2],[5.60,-1.20,1.7],[5.68,-1.94,1.8],[5.80,-9.67,2.1],[5.24,-8.20,.2],
 [18.62,38.78,0],[20.69,45.28,1.3],[19.85,8.87,.8],[20.37,40.26,2.2],[19.51,27.96,3.1],[20.77,33.97,2.5],[19.75,45.13,2.9],
 [6.75,-16.72,-1.46],[7.66,5.23,.4],[5.28,46,.1],[7.58,31.89,1.6],[7.76,28.03,1.2],[4.60,16.51,.9],[14.26,19.18,0],[13.42,-11.16,1],[10.14,11.97,1.4],[11.82,14.57,2.1],[16.49,-26.43,1],[22.96,-29.62,1.2],[23.08,15.21,2.5],[23.06,28.08,2.4],[.14,29.09,2.1],[.22,15.18,2.8]
];
export function createNightStars(){
 const pos=[],mag=[];for(const [ra,dec,m] of stars){const a=ra*Math.PI/12,d=dec*Math.PI/180;pos.push(Math.cos(a)*Math.cos(d),Math.sin(d),Math.sin(a)*Math.cos(d));mag.push(m);}
 const rng=random(1937),pole=new T.Vector3(-.868,.456,-.199).normalize();
 for(let i=0;i<20000;i++){const y=rng()*2-1,a=rng()*Math.PI*2,r=Math.sqrt(1-y*y),v=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);if(i>10000&&Math.abs(v.dot(pole))>.22)continue;pos.push(v.x,v.y,v.z);mag.push(3.7+rng()*3.1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('magnitude',new T.Float32BufferAttribute(mag,1));
 const material=new T.ShaderMaterial({uniforms:{strength:{value:0},sidereal:{value:0},pixelRatio:{value:1},time:{value:0}},transparent:true,depthWrite:false,depthTest:true,
 vertexShader:`attribute float magnitude;uniform float sidereal,pixelRatio;varying float light;
 void main(){float c=cos(sidereal),s=sin(sidereal);float meridian=c*position.x+s*position.z;
 vec3 ray=vec3(-s*position.x+c*position.z,.719*meridian+.695*position.y,.695*meridian-.719*position.y);
 gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*ray*8000.,1.);gl_Position.z=gl_Position.w*.999999;light=smoothstep(.015,.20,ray.y)*clamp(pow(10.,-.085*magnitude),.035,1.);gl_PointSize=pixelRatio*clamp(2.9-.28*magnitude,1.0,3.2);}`,
 fragmentShader:`uniform float strength;varying float light;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(.92,.94,1.,(1.-smoothstep(.04,.5,r))*light*strength*1.3);}`});
 const points=new T.Points(geo,material);points.renderOrder=-99;points.frustumCulled=false;addNightPhenomena(points,material.uniforms);return points;
}

/** A quiet celestial background; the bright catalogue stars retain their constellation patterns. */
function addNightPhenomena(root:T.Object3D,uniforms:Record<string,T.IUniform>){
 const rotation=`vec3 celestial(vec3 p){float c=cos(sidereal),s=sin(sidereal),m=c*p.x+s*p.z;return vec3(-s*p.x+c*p.z,.719*m+.695*p.y,.695*m-.719*p.y);}`;
 // The equatorial-to-horizon basis reverses handedness, so its inward dome uses FrontSide.
 const sky=new T.ShaderMaterial({uniforms,transparent:true,depthTest:true,depthWrite:false,side:T.FrontSide,blending:T.AdditiveBlending,toneMapped:false,
 vertexShader:`uniform float sidereal;varying vec3 ray,skyRay;${rotation}void main(){ray=normalize(position);skyRay=celestial(ray);gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*skyRay*8500.,1.);gl_Position.z=gl_Position.w*.999998;}`,
 fragmentShader:`uniform float strength,time;varying vec3 ray,skyRay;
 float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 void main(){if(strength<.005||skyRay.y<.015)discard;vec3 v=normalize(ray),world=normalize(skyRay);float plane=dot(v,normalize(vec3(-.868,.456,-.199))),band=exp(-plane*plane*85.);vec3 color=vec3(0.);
 if(band>.008){
  float broad=noise(v*7.),medium=noise(v*23.+4.),fine=noise(v*71.+9.);
  float structure=broad*.48+medium*.34+fine*.18;
  float core=pow(max(0.,dot(v,normalize(vec3(.72,-.18,-.66)))),5.);
  float narrow=exp(-plane*plane*420.);
  float rift=smoothstep(.42,.70,noise(v*19.+vec3(4.,1.,7.)))*narrow;
  float filaments=smoothstep(.36,.68,medium+fine*.18);
  vec3 stellarTint=mix(vec3(.72,.77,.84),vec3(.88,.81,.69),core);
  color+=stellarTint*band*(.002+.008*structure+.004*core*filaments)*(1.-rift*.88);
 }

 gl_FragColor=vec4(color*strength*smoothstep(.015,.20,world.y),1.);}`});
 const dome=new T.Mesh(new T.SphereGeometry(1,32,16),sky);dome.name='Night / faint galactic dust band';dome.frustumCulled=false;dome.renderOrder=-99.5;root.add(dome);
 const start:number[]=[],end:number[]=[],u:number[]=[],phase:number[]=[],rng=random(1940);
 for(let i=0;i<7;i++){const a=rng()*Math.PI*2,y=.20+rng()*.65,r=Math.sqrt(1-y*y),p=new T.Vector3(Math.cos(a)*r,y,Math.sin(a)*r),q=p.clone().add(new T.Vector3(.18,-.09,.12)).normalize();for(const k of[0,1]){start.push(...p.toArray());end.push(...q.toArray());u.push(k);phase.push(i*.137);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(start,3));g.setAttribute('destination',new T.Float32BufferAttribute(end,3));g.setAttribute('along',new T.Float32BufferAttribute(u,1));g.setAttribute('phase',new T.Float32BufferAttribute(phase,1));
 const meteors=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
 vertexShader:`attribute vec3 destination;attribute float along,phase;uniform float time,sidereal;varying float fade;${rotation}void main(){float t=fract(time/91.+phase),head=t/.010;vec3 p=celestial(normalize(mix(position,destination,clamp(head-(1.-along)*.16,0.,1.))));fade=step(t,.010)*sin(clamp(head,0.,1.)*3.14159)*mix(.08,1.,along)*smoothstep(.02,.2,p.y);gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*p*8000.,1.);gl_Position.z=gl_Position.w*.999997;}`,
 fragmentShader:'uniform float strength;varying float fade;void main(){gl_FragColor=vec4(vec3(.90,.94,1.),fade*strength*.85);}'});
 const streaks=new T.LineSegments(g,meteors);streaks.name='Night / occasional meteor trails';streaks.frustumCulled=false;streaks.renderOrder=-98;root.add(streaks);
}
