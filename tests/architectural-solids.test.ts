import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {flattenEnvironmentKit} from '../src/world/EnvironmentKit.ts';
const bytes=readFileSync(new URL('../public/models/environment.glb',import.meta.url));
const model=await new Promise<{scene:T.Group}>((resolve,reject)=>new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',resolve,reject));
model.scene.updateMatrixWorld(true);
test('exported fisherman window opens through the actual masonry front, rather than covering it with dark paint',()=>{
 const house=model.scene.getObjectByName('HouseFisher')!;let host:T.Mesh|undefined;
 house.traverse(o=>{if(o instanceof T.Mesh&&/Plastered.masonry/.test(o.name))host=o;});assert.ok(host);
 const ray=new T.Raycaster(new T.Vector3(-.27,-.035,.48).applyMatrix4(house.matrixWorld),new T.Vector3(0,0,-1));
 const hit=ray.intersectObject(host,true)[0];assert.ok(hit&&hit.distance>.14&&hit.distance<.19,'ray enters the recess before hitting its back');
 ray.set(new T.Vector3(-.04,-.035,.48).applyMatrix4(house.matrixWorld),new T.Vector3(0,0,-1));assert.ok(ray.intersectObject(host,true)[0].distance<.09,'neighboring plaster remains solid');
});
test('exported pitched roofs have closed end faces, underside and consistently joined edges',()=>{
 let roofs=0;
 model.scene.traverse(o=>{
  if(!(o instanceof T.Mesh)||!o.name.startsWith('Solid_clay_roof_and_eave_returns'))return;roofs++;
  const g=o.geometry,p=g.attributes.position,edges=new Map<string,number>();
  const key=(i:number)=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join(',');
  const vertex=(i:number)=>g.index?g.index.getX(i):i;
  for(let i=0;i<(g.index?.count??p.count);i+=3)for(let k=0;k<3;k++){const a=key(vertex(i+k)),b=key(vertex(i+(k+1)%3)),e=[a,b].sort().join('/');edges.set(e,(edges.get(e)??0)+1);}
  assert.ok([...edges.values()].every(count=>count===2),o.name+' has an open or overlapping edge');
 });assert.ok(roofs>=8);
});

test('building instances retain usable UVs and distinct glass, joinery, stone and roof surfaces',()=>{
 const geometry=flattenEnvironmentKit(model.scene).get('HouseArcade')!;
 const uv=geometry.getAttribute('uv'),surface=geometry.getAttribute('buildingSurface');
 assert.equal(uv.count,geometry.getAttribute('position').count);
 assert.equal(surface.count,uv.count);
 assert.ok(Array.from(uv.array).some(value=>value!==0));
 const classes=new Set(surface.array);
 for(const kind of [0,1,2,3,5])assert.ok(classes.has(kind),`missing surface class ${kind}`);
});
