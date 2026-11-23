import {Vector2} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Low-resolution HDR highlight diffusion, evaluated before exposure and output conversion. */
export class SunGlarePass extends UnrealBloomPass{
 constructor(){
  super(new Vector2(320,180),.12,.55,1.4);
  // Invalid HDR samples must never spread through every mip of the bloom pyramid.
  this.materialHighPassFilter.fragmentShader=this.materialHighPassFilter.fragmentShader.replace(
   'float v = luminance( texel.xyz );',
   'if(any(isnan(texel))||any(isinf(texel)))texel=vec4(0.);\ntexel.rgb=clamp(texel.rgb,vec3(0.),vec3(32.));\nfloat v = luminance( texel.xyz );'
  );
 }
 setAtmosphere(warm:number,night:number,rain:number,celestialLight:number){
  const clear=1-Math.max(0,Math.min(1,rain))*.65;
  const halo=warm*celestialLight;
  const lit=Math.pow(celestialLight,2)*(1.-night);
  this.strength=(.096+.069*lit+.105*halo)*(1.-night*.53)*clear;
  this.radius=.46+.09*lit+.15*halo;
  this.threshold=1.60-.39*lit+.45*rain+.24*night;
 }
 override setSize(width:number,height:number){super.setSize(Math.max(32,Math.round(width*.35)),Math.max(32,Math.round(height*.35)));}
}
