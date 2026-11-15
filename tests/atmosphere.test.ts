import {test} from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {PackedSunShadows} from '../src/rendering/PackedSunShadows.ts';
import {createCloudLayout,cloudImmersionAt} from '../src/rendering/CloudLayout.ts';
import {CloudVolumes} from '../src/rendering/CloudVolumes.ts';
import {CloudPass} from '../src/rendering/CloudPass.ts';
import {cloudShapes,createCloudField} from '../src/rendering/CloudShapes.ts';
import {weatherIds} from '../src/rendering/WeatherConfig.ts';
test('sun shadows use packed RGBA depth, preserve surface hooks, and shade direct illumination',()=>{
 const shadows=new PackedSunShadows(),root=new T.Group(),material=new T.MeshPhysicalMaterial();let hooked=false;material.onBeforeCompile=()=>{hooked=true;};const mesh=new T.Mesh(new T.BoxGeometry(),material);mesh.receiveShadow=true;root.add(mesh);shadows.prepare(root);
 const shader={vertexShader:T.ShaderLib.physical.vertexShader,fragmentShader:T.ShaderLib.physical.fragmentShader,uniforms:{}};material.onBeforeCompile(shader as never,{} as T.WebGLRenderer);assert.equal(hooked,true);
 assert.ok(shader.fragmentShader.includes('reflectedLight.directSpecular*=packedVisibility'));assert.ok(!shader.fragmentShader.includes('interleavedGradientNoise'));assert.ok(shader.fragmentShader.includes('packedSunNear'));assert.ok(shader.fragmentShader.includes('cloudShadowMap'));
 assert.equal(shadows.uniforms.packedSunNear.value.type,T.UnsignedByteType);assert.equal(shadows.uniforms.packedSunNear.value.format,T.RGBAFormat);shadows.dispose();mesh.geometry.dispose();material.dispose();
});


test('all weather modes use filtered 3D density, retain their layout and reuse GPU resources',()=>{
 const scene=new T.Scene(),clouds=new CloudVolumes(scene,713),material=clouds.mesh.material as T.ShaderMaterial,texture=material.uniforms.densityMap.value as T.Data3DTexture,geometry=clouds.mesh.geometry;
 assert.ok(texture.isData3DTexture);assert.equal(texture.image.depth,480);assert.ok((texture.image.data as Uint8Array).some(v=>v>0&&v<255));
 for(const weather of weatherIds){clouds.update(0,weather==='rain'?1:0,.4,weather);assert.equal(clouds.mesh.count,createCloudLayout(713,weather).length);assert.equal(clouds.mesh.geometry,geometry);assert.equal(material.uniforms.densityMap.value,texture);assert.ok(clouds.mesh.count<=80);}
 assert.ok(createCloudLayout(713,'sunny').length<=9);
 const position=clouds.mesh.position.clone();clouds.update(0,0,.9,'fog');assert.deepEqual(clouds.mesh.position,position);
 for(const [scale,steps] of [[.45,40],[.3,32],[.2,24]]){clouds.setDetail(scale);assert.equal(material.uniforms.viewSteps.value,steps);}
 const pass=new CloudPass(scene,new T.PerspectiveCamera(),clouds);pass.setResolution(.3);pass.setSize(1920,1080);assert.equal(pass.enabled,true);pass.dispose();clouds.dispose();assert.equal(scene.children.length,0);
});

test('volumetric bounds stay aligned with rotated cloud layouts and cull without changing source data',()=>{
 const scene=new T.Scene(),clouds=new CloudVolumes(scene,713),camera=new T.PerspectiveCamera(55,1,.4,26000);clouds.update(0,0,.4,'cloudy');
 const layout=clouds.layout,matrix=new T.Matrix4(),center=new T.Vector3();clouds.mesh.getMatrixAt(0,matrix);center.setFromMatrixPosition(matrix);assert.ok(Math.abs(center.y-layout[0].y-layout[0].height*.4)<.01);
 const local=new T.Vector3(1,0,0).applyMatrix4(matrix).sub(center).normalize();assert.ok(Math.abs(local.x-Math.cos(layout[0].rotation))<.001);assert.ok(Math.abs(local.z-Math.sin(layout[0].rotation))<.001);
 camera.position.set(0,800,3000);camera.lookAt(0,800,-3000);clouds.setView(camera);assert.ok(clouds.mesh.count>0&&clouds.mesh.count<layout.length);assert.equal(clouds.layout,layout);clouds.dispose();
});

test('cloud field changes by visit and varies silhouettes, heights, orientation and island cover',()=>{
 const a=createCloudLayout(713),b=createCloudLayout(819);
 assert.deepEqual(a,createCloudLayout(713));assert.notDeepEqual(a,b);
 assert.equal(a.filter(c=>!c.island).length,44);
 assert.equal(new Set(a.map(c=>c.shape)).size,6);
 assert.ok(Math.max(...a.map(c=>c.y))-Math.min(...a.map(c=>c.y))>1800);
 assert.ok(new Set(a.map(c=>Math.round(c.width))).size>30);
 assert.ok(a.every(c=>c.y-c.height*1.1>0));
 const counts=Array.from({length:20},(_,i)=>createCloudLayout(i+1).filter(c=>c.island).length);assert.ok(new Set(counts).size>3);
});

test('cloud shape fields have continuous density boundaries and distinct vertical profiles',()=>{
 const samples=[];
 for(const shape of cloudShapes){const field=createCloudField(shape,57);assert.ok(field(5,5,5)>0);let inside=0;for(let y=-1;y<=1.8;y+=.05){const d=field(0,y,0);assert.ok(Number.isFinite(d));if(d<0)inside++;}samples.push(inside);}
 assert.ok(new Set(samples).size>=4);
});

test('marine cloud layers provide low fly-through wisps, island fragments, cruising towers and high banks',()=>{
 const cells=createCloudLayout(713);
 for(const layer of ['sea','island','cruising','upper','high'])assert.ok(cells.some(c=>c.layer===layer));
 for(const c of cells.filter(c=>c.layer==='sea')){assert.ok(c.y<200);assert.ok(c.y-c.height*1.1>=17);assert.ok(c.width<300);}
 assert.ok(cells.some(c=>c.layer==='upper'&&c.width>800));assert.ok(cells.some(c=>c.layer==='high'&&c.y>3500));
 for(const c of cells.filter(c=>c.layer==='cruising'))assert.ok(c.y<1100);
});

test('cloud immersion follows actual shape boundaries, clears outside, and tracks wind drift',()=>{
 const cell=createCloudLayout(713).find(c=>c.shape==='cumulus')!,cells=[cell];
 const core=new T.Vector3(cell.x,cell.y+.1*cell.height,cell.z),drift=new T.Vector3(75,0,-40);
 assert.ok(cloudImmersionAt(core,cells)>.9);
 assert.equal(cloudImmersionAt(core.clone().add(new T.Vector3(5000,0,0)),cells),0);
 assert.ok(Math.abs(cloudImmersionAt(core,cells)-cloudImmersionAt(core.clone().add(drift),cells,drift))<1e-8);
 let prev=0;for(let x=-cell.width*2;x<=cell.width*2;x+=4){const amount=cloudImmersionAt(core.clone().add(new T.Vector3(x,0,0)),cells);assert.ok(amount>=0&&amount<=1);assert.ok(Math.abs(amount-prev)<.2);prev=amount;}
});

test('cloud illumination distinguishes golden dawn and orange dusk and remains continuous through noon',async()=>{
 const {cloudPalette}=await import('../src/rendering/CloudLighting.ts'),{daylightAt}=await import('../src/rendering/TimeOfDay.ts');
 const dawn=cloudPalette(daylightAt(6.12)),dusk=cloudPalette(daylightAt(17.88)),noon=cloudPalette(daylightAt(12)),night=cloudPalette(daylightAt(23));
 assert.ok(dawn.top[1]-dusk.top[1]>.07);assert.ok(dawn.top[2]-dusk.top[2]>.015);
 assert.ok(dusk.top[0]>dusk.top[1]&&dusk.top[1]>dusk.top[2]);assert.ok(dusk.bottom[0]>dawn.bottom[0]);assert.ok(dusk.bottom[1]<dawn.bottom[1]);assert.ok(dawn.mist[1]>dusk.mist[1]);
 assert.ok(noon.top[2]>dusk.top[2]);assert.ok(night.mist.every(v=>v<.12));
 for(const hour of [6,12,18]){const a=cloudPalette(daylightAt(hour-.001)),b=cloudPalette(daylightAt(hour+.001));for(const key of ['top','bottom','aerial','mist'] as const)for(let i=0;i<3;i++)assert.ok(Math.abs(a[key][i]-b[key][i])<.003);}
 const scene=new T.Scene(),clouds=new CloudVolumes(scene,713),color=new T.Color(1,.7,.3),direction=new T.Vector3(1,.02,0).normalize(),uniforms=(clouds.mesh.material as T.ShaderMaterial).uniforms;
 for(const hour of [6.12,17.88,12]){const clock=daylightAt(hour),palette=cloudPalette(clock);clouds.setLighting(direction,color,clock.day,.6,clock);assert.deepEqual((uniforms.ambientHigh.value as T.Color).toArray(),palette.top);assert.deepEqual((uniforms.ambientLow.value as T.Color).toArray(),palette.bottom);assert.deepEqual((uniforms.aerialTint.value as T.Color).toArray(),palette.aerial);}
 clouds.dispose();
});

