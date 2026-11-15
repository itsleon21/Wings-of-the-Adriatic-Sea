import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
/** Finishing grade shares the existing antialiasing pass: no extra render target or draw. */
export function adriaticFXAA(){return{
 ...FXAAShader,uniforms:{...FXAAShader.uniforms,adriaticDay:{value:1},stormFlash:{value:0},raceMotion:{value:0}},
 fragmentShader:'uniform float raceMotion;uniform float stormFlash;uniform float adriaticDay;\n'+FXAAShader.fragmentShader.replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',`gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
 // Screen-space shutter blur grows radially from a completely clear central window.
 // Work in pixels so the clear area remains circular at any aspect ratio.
 vec2 radial=vUv-vec2(.5);
 float radius=length(radial*vec2(resolution.y/resolution.x,1.));
 float edge=smoothstep(.18,.65,radius);
 float strength=raceMotion*edge;
 if(strength>.001){
  vec2 offset=radial*strength*.095;
  vec3 streak=gl_FragColor.rgb*.18;
  for(int i=1;i<=8;i++){
   float t=float(i)/8.;
   vec2 sampleUV=clamp(vUv-offset*t,vec2(0.),vec2(1.));
   streak+=texture2D(tDiffuse,sampleUV).rgb*.1025;
  }
  gl_FragColor.rgb=mix(gl_FragColor.rgb,streak,strength);
 }
 vec3 c=gl_FragColor.rgb;float luma=dot(c,vec3(.2126,.7152,.0722));
 // Tiny pigment separation and warm highlights; white remains white and night stays legible.
 vec3 graded=mix(vec3(luma),c,1.01);
 graded+=(graded-.5)*.015*(1.-abs(luma*2.-1.));
 graded+=vec3(.010,.004,-.006)*smoothstep(.35,.85,luma)*(1.-smoothstep(.92,1.,luma));
 gl_FragColor.rgb=mix(c,clamp(graded,0.,1.),clamp(adriaticDay,0.,1.));
 // Volumetric cloud integration handles obscuration; no flat screen-wide mist overlay.
 gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.78,.85,1.),stormFlash*.18);`),
};}
