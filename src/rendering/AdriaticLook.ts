import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
/** Finishing grade shares the existing antialiasing pass: no extra render target or draw. */
export function adriaticFXAA(){return{
 ...FXAAShader,uniforms:{...FXAAShader.uniforms,adriaticDay:{value:1},stormFlash:{value:0},flightMotion:{value:0},filmTime:{value:0}},
 fragmentShader:'uniform float flightMotion;uniform float stormFlash;uniform float adriaticDay;uniform float filmTime;\n'+FXAAShader.fragmentShader.replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',`gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
 // Screen-space shutter blur grows radially from a completely clear central window.
 // The clear oval follows the viewport so all four edges respond on wide displays.
 vec2 radial=vUv-vec2(.5);
 float radius=length(radial);
 float edge=smoothstep(.205,.53,radius);
 float strength=flightMotion*edge;
 if(strength>.012){
  vec2 offset=radial*strength*.082;
  vec3 streak=gl_FragColor.rgb*.18;
  for(int i=1;i<=8;i++){
   float t=float(i)/8.;
   vec2 sampleUV=clamp(vUv-offset*t,vec2(0.),vec2(1.));
   streak+=texture2D(tDiffuse,sampleUV).rgb*.1025;
  }
  gl_FragColor.rgb=mix(gl_FragColor.rgb,streak,smoothstep(.0,.65,strength));
 }
 vec3 c=gl_FragColor.rgb;float luma=dot(c,vec3(.2126,.7152,.0722));
 // Tiny pigment separation and warm highlights; white remains white and night stays legible.
 vec3 graded=mix(vec3(luma),c,1.01);
 graded+=(graded-.5)*.015*(1.-abs(luma*2.-1.));
 graded+=vec3(.010,.004,-.006)*smoothstep(.35,.85,luma)*(1.-smoothstep(.92,1.,luma));
 gl_FragColor.rgb=mix(c,clamp(graded,0.,1.),clamp(adriaticDay,0.,1.));
 vec2 grainPixel=floor(gl_FragCoord.xy)+floor(filmTime*12.)*vec2(19.,37.);
 float grain=fract(52.9829189*fract(dot(grainPixel,vec2(.06711056,.00583715))))-.5;
 float edgeFalloff=dot(radial*vec2(1.,.8),radial*vec2(1.,.8));
 gl_FragColor.rgb=clamp(gl_FragColor.rgb*(1.-edgeFalloff*.055)+grain*.011*smoothstep(.028,.19,luma)*(1.-smoothstep(.64,1.,luma)),0.,1.);
 // Volumetric cloud integration handles obscuration; no flat screen-wide mist overlay.
 gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.78,.85,1.),stormFlash*.18);`),
};}
