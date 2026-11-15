import * as T from 'three';
import type {NavigationTarget} from '../ui/NavigationReadout.ts';

/** Brass-edged winged chevron inspired by period aeroclub badges. One active destination. */
export class NavigationBeacon {
 readonly root = new T.Group();
 private badge = new T.Group();
 private core = new T.MeshBasicMaterial({color:0xffe6a0,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false});
 private halo = new T.ShaderMaterial({
  transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
  uniforms:{strength:{value:1}},
  vertexShader:`#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,
  fragmentShader:`#include <logdepthbuf_pars_fragment>
varying vec2 vUv;uniform float strength;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p);
float light=exp(-r*r*5.)*(1.-smoothstep(.6,1.,r));
gl_FragColor=vec4(1.,.66,.22,light*.28*strength);
#include <logdepthbuf_fragment>
#include <colorspace_fragment>
}`
 });
 constructor(){
  this.root.name='Navigation / winged amber beacon';
  const chevron=new T.Shape();
  chevron.moveTo(0,-6);chevron.lineTo(-7,3);chevron.lineTo(-3,2);
  chevron.lineTo(0,-1);chevron.lineTo(3,2);chevron.lineTo(7,3);chevron.closePath();
  this.badge.add(new T.Mesh(new T.ShapeGeometry(chevron),this.core));
  const frame=new T.Mesh(new T.RingGeometry(8.3,8.6,4),this.core);
  frame.rotation.z=Math.PI/4;this.badge.add(frame);
  const halo=new T.Mesh(new T.PlaneGeometry(36,36),this.halo);
  halo.position.z=-.15;this.badge.add(halo);
  this.root.add(this.badge);this.root.visible=false;
 }
 update(target:NavigationTarget|undefined,camera:T.Camera,time:number){
  this.root.visible=!!target;
  if(!target)return;
  const {x,y,z}=target.position;
  this.root.position.set(x,y,z);
  this.badge.quaternion.copy(camera.quaternion);
  // The bottom of the badge points to the actual check-in position.
  const distance=camera.position.distanceTo(this.root.position);
  if(distance<85){this.root.visible=false;return;}
  const nearFade=T.MathUtils.smoothstep(distance,85,150);
  this.badge.scale.setScalar(T.MathUtils.clamp(distance/500,.65,22)*2/3);
  this.badge.position.y=(8+Math.sin(time*2.5)*1.2)*this.badge.scale.x;
  const pulse=.5+.5*Math.sin(time*5.4);
  this.core.opacity=(.6+.4*pulse)*nearFade;
  this.halo.uniforms.strength.value=(.65+.75*pulse)*nearFade;
 }
 dispose(){
  this.root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});
  this.core.dispose();this.halo.dispose();
 }
}
