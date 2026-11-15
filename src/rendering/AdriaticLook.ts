import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
/** Finishing grade shares the existing antialiasing pass: no extra render target or draw. */
export function adriaticFXAA(){return{
 ...FXAAShader,uniforms:{...FXAAShader.uniforms,adriaticDay:{value:1},stormFlash:{value:0}},
 fragmentShader:'uniform float stormFlash;uniform float adriaticDay;\n'+FXAAShader.fragmentShader.replace('gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );',`gl_FragColor = ApplyFXAA( tDiffuse, resolution.xy, vUv );
 vec3 c=gl_FragColor.rgb;float luma=dot(c,vec3(.2126,.7152,.0722));
 // Tiny pigment separation and warm highlights; white remains white and night stays legible.
 vec3 graded=mix(vec3(luma),c,1.01);
 graded+=(graded-.5)*.015*(1.-abs(luma*2.-1.));
 graded+=vec3(.010,.004,-.006)*smoothstep(.35,.85,luma)*(1.-smoothstep(.92,1.,luma));
 gl_FragColor.rgb=mix(c,clamp(graded,0.,1.),clamp(adriaticDay,0.,1.));
 // Volumetric cloud integration handles obscuration; no flat screen-wide mist overlay.
 gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.78,.85,1.),stormFlash*.18);`),
};}
