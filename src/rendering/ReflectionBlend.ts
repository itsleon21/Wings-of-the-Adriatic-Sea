import * as T from 'three';
/** Prefiltered sky radiance is baked during loading, never regenerated on the flight path. */
export const reflectionHours=[0,4.5,6,7.5,12,16.5,18,19.5,22] as const;
export function reflectionInterval(hour:number){
 const h=((hour%24)+24)%24;let a=reflectionHours.length-1;
 for(let i=0;i<reflectionHours.length-1;i++)if(h>=reflectionHours[i]&&h<reflectionHours[i+1]){a=i;break;}
 const b=(a+1)%reflectionHours.length,end=b===0?24:reflectionHours[b];
 return {a,b,t:(h-reflectionHours[a])/(end-reflectionHours[a])};
}
/** Mixing already-filtered linear HDR radiance costs a single small full-screen draw. */
export class ReflectionBlend{
 readonly target:T.WebGLRenderTarget;private scene=new T.Scene();private camera=new T.Camera();private quad:T.Mesh;private material:T.ShaderMaterial;
 private maps:T.WebGLRenderTarget[];
 constructor(maps:T.WebGLRenderTarget[]){
  this.maps=maps;
  const first=maps[0];this.target=first.clone();this.target.depthBuffer=false;this.target.texture.name='Interpolated Adriatic sky radiance';
  this.material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{clearA:{value:first.texture},clearB:{value:first.texture},cloudA:{value:first.texture},cloudB:{value:first.texture},hourMix:{value:0},cloudMix:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D clearA,clearB,cloudA,cloudB;uniform float hourMix,cloudMix;void main(){vec3 clear=mix(texture2D(clearA,vUv).rgb,texture2D(clearB,vUv).rgb,hourMix);vec3 cloud=mix(texture2D(cloudA,vUv).rgb,texture2D(cloudB,vUv).rgb,hourMix);gl_FragColor=vec4(mix(clear,cloud,cloudMix),1.);}'});
  this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.material);this.quad.frustumCulled=false;this.scene.add(this.quad);
 }
 update(renderer:T.WebGLRenderer,hour:number,coverage:number){
  const {a,b,t}=reflectionInterval(hour),u=this.material.uniforms,n=reflectionHours.length;
  u.clearA.value=this.maps[a].texture;u.clearB.value=this.maps[b].texture;u.cloudA.value=this.maps[n+a].texture;u.cloudB.value=this.maps[n+b].texture;u.hourMix.value=t;u.cloudMix.value=T.MathUtils.clamp((coverage-.055)/.94,0,1);
  const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),level=renderer.getActiveMipmapLevel(),auto=renderer.autoClear;
  try{renderer.autoClear=true;renderer.setRenderTarget(this.target);renderer.render(this.scene,this.camera);}finally{renderer.setRenderTarget(previous,face,level);renderer.autoClear=auto;}
 }
 dispose(){for(const m of this.maps)m.dispose();this.target.dispose();this.quad.geometry.dispose();this.material.dispose();}
}
