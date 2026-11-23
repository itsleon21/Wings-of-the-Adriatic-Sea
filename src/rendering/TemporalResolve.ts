import * as T from 'three';
import {FullScreenQuad,Pass} from 'three/addons/postprocessing/Pass.js';

const vertexShader='varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const samples=[[-.25,.167],[.25,-.389],[-.375,-.056],[.125,.278],[-.125,-.278],[.375,.056],[-.4375,.389],[.0625,-.463]];

/** Reproject scene depth and clip history to current colours. Cuts, resizes
 * and disocclusion use the current HDR frame. */
export class TemporalResolve extends Pass {
 private targets=[0,1].map(()=>new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false,minFilter:T.LinearFilter,magFilter:T.LinearFilter}));
 private inputWidth=1;private inputHeight=1;
 private frame=0;private valid=false;
 private previousPosition=new T.Vector3();private previousRotation=new T.Quaternion();
 private readonly originalProjection=new T.Matrix4();
 private readonly viewProjection=new T.Matrix4();
 private resolve=new T.ShaderMaterial({vertexShader,depthTest:false,depthWrite:false,uniforms:{
  currentFrame:{value:null},history:{value:null},sceneDepth:{value:null},inverseProjection:{value:new T.Matrix4()},
  worldFromView:{value:new T.Matrix4()},previousVP:{value:new T.Matrix4()},texel:{value:new T.Vector2()},logFar:{value:1},validHistory:{value:0},
 },fragmentShader:`
 varying vec2 vUv;
 uniform sampler2D currentFrame,history,sceneDepth;
 uniform mat4 inverseProjection,worldFromView,previousVP;
 uniform vec2 texel;uniform float logFar,validHistory;
 void main(){
  vec3 now=texture2D(currentFrame,vUv).rgb;
  float depth=texture2D(sceneDepth,vUv).r;
  gl_FragColor=vec4(now,depth);
  if(validHistory<.5||depth>.9999)return;
  vec4 ray=inverseProjection*vec4(vUv*2.-1.,1.,1.);
  vec3 viewPoint=ray.xyz/max(.00001,-ray.z)*(exp2(depth*logFar)-1.);
  vec4 old=previousVP*worldFromView*vec4(viewPoint,1.);
  vec2 uv=old.xy/max(.00001,old.w)*.5+.5;
  if(old.w<=0.||any(lessThan(uv,texel))||any(greaterThan(uv,1.-texel)))return;
  vec4 oldSample=texture2D(history,uv);
  float previousDepth=log2(1.+old.w)/logFar;
  if(abs(oldSample.a-previousDepth)>.003)return;
  vec3 a=texture2D(currentFrame,vUv+vec2(texel.x,0.)).rgb,b=texture2D(currentFrame,vUv-vec2(texel.x,0.)).rgb;
  vec3 c=texture2D(currentFrame,vUv+vec2(0.,texel.y)).rgb,d=texture2D(currentFrame,vUv-vec2(0.,texel.y)).rgb;
  vec3 low=min(now,min(min(a,b),min(c,d))),high=max(now,max(max(a,b),max(c,d)));
  float motion=length((uv-vUv)/texel);
  gl_FragColor.rgb=mix(now,clamp(oldSample.rgb,low,high),mix(.63,.20,smoothstep(1.,14.,motion)));
 }`});
 private copy=new T.ShaderMaterial({vertexShader,depthTest:false,depthWrite:false,uniforms:{frame:{value:null}},fragmentShader:'uniform sampler2D frame; varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(frame,vUv).rgb,1.);}'});
 private quad=new FullScreenQuad(this.resolve);
 constructor(private camera:T.PerspectiveCamera,private depth:()=>T.DepthTexture|null,private upsample=false){super();}
 withJitter(render:()=>void){
  const [x,y]=samples[this.frame%samples.length],p=this.camera.projectionMatrix;
  this.originalProjection.copy(p);
  p.elements[8]+=x*2/this.inputWidth;p.elements[9]+=y*2/this.inputHeight;
  this.camera.projectionMatrixInverse.copy(p).invert();
  try{render();}
  finally{p.copy(this.originalProjection);this.camera.projectionMatrixInverse.copy(p).invert();}
 }
 override setSize(width:number,height:number){
  this.inputWidth=Math.max(1,width);this.inputHeight=Math.max(1,height);
  this.resolve.uniforms.texel.value.set(1/this.inputWidth,1/this.inputHeight);this.valid=false;
  if(!this.upsample)this.resizeHistory(this.inputWidth,this.inputHeight);
 }
 setOutputSize(width:number,height:number){if(this.upsample)this.resizeHistory(width,height);}
 private resizeHistory(width:number,height:number){
  for(const target of this.targets)target.setSize(width,height);
  this.valid=false;
 }
 override render(renderer:T.WebGLRenderer,write:T.WebGLRenderTarget,read:T.WebGLRenderTarget){
  const camera=this.camera,old=this.targets[this.frame%2],next=this.targets[(this.frame+1)%2],u=this.resolve.uniforms;
  u.currentFrame.value=read.texture;u.history.value=old.texture;u.sceneDepth.value=this.depth();
  u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.worldFromView.value.copy(camera.matrixWorld);
  u.validHistory.value=this.valid&&u.sceneDepth.value&&this.previousPosition.distanceToSquared(camera.position)<256&&this.previousRotation.angleTo(camera.quaternion)<.14?1:0;
  u.logFar.value=Math.log2(camera.far+1);
  this.quad.material=this.resolve;renderer.setRenderTarget(next);this.quad.render(renderer);
  this.copy.uniforms.frame.value=next.texture;
  this.quad.material=this.copy;renderer.setRenderTarget(this.renderToScreen?null:write);this.quad.render(renderer);
  u.previousVP.value.copy(this.viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  this.previousPosition.copy(camera.position);this.previousRotation.copy(camera.quaternion);this.frame++;this.valid=true;
 }
 override dispose(){this.targets.forEach(target=>target.dispose());this.resolve.dispose();this.copy.dispose();this.quad.dispose();}
}
