import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const white=new T.Color(0xffffff),beige=new T.Color(0xd3c3a1);
function surfaceKind(name:string){
 if(/terracotta|burnt clay/i.test(name))return 1;
 if(/glass/i.test(name))return 2;
 if(/walnut|joinery|shutters/i.test(name))return 3;
 if(/bronze/i.test(name))return 4;
 if(/limestone/i.test(name))return 5;
 return 0;
}
/** Merge meshes for instancing while carrying UVs and Blender surface classes to the shader. */
export async function loadEnvironmentKit(){
 const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/environment.glb`);return flattenEnvironmentKit(gltf.scene);
}
export function flattenEnvironmentKit(scene:T.Object3D){
 scene.updateMatrixWorld(true);
 const result=new Map<string,T.BufferGeometry>();
 for(const name of ['HouseCream','HouseOchre','HouseFisher','HouseTownhouse','HouseArcade','HouseVilla','HouseWorkshop','HouseTerrace','HouseLoggia','HousePalazzo','HouseBoatyard','HouseMill','HouseMillTall','HouseMillSquare','HouseGranary','HouseMarketHall','Warehouse','Lighthouse','PineCrown','OliveTree','CoastalRock','FishingBoat']){
  const root=scene.getObjectByName(name);if(!root)continue;const inverse=root.matrixWorld.clone().invert(),parts:T.BufferGeometry[]=[];
  root.traverse(object=>{if(!(object instanceof T.Mesh)||/Mill resting sail|Furled linen/.test(object.name))return;let geometry:T.BufferGeometry=object.geometry.clone();if(geometry.index)geometry=geometry.toNonIndexed();geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld));if(!geometry.attributes.normal)geometry.computeVertexNormals();
   const bakedVisibility=geometry.getAttribute('color');
   const count=geometry.attributes.position.count,occlusion=new Float32Array(count),colors=new Float32Array(count*3),surface=new Float32Array(count);
   const materials=Array.isArray(object.material)?object.material:[object.material];
   for(const group of geometry.groups.length?geometry.groups:[{start:0,count,materialIndex:0}]){
    const material=materials[group.materialIndex??0] as T.MeshStandardMaterial;
    const color=/shutter|louvre|joinery/i.test(object.name+' '+material.name)&&!/hull/i.test(object.name)?beige:material.color??white;
    surface.fill(surfaceKind(material.name),group.start,group.start+group.count);
    for(let i=group.start;i<group.start+group.count;i++){occlusion[i]=bakedVisibility?bakedVisibility.getX(i):1;color.toArray(colors,i*3);}
   }
   for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
   if(!geometry.hasAttribute('uv'))geometry.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(count*2),2));
   geometry.setAttribute('millPart',new T.Float32BufferAttribute(new Float32Array(count),1));
   geometry.setAttribute('surfaceAO',new T.BufferAttribute(occlusion,1));
   geometry.setAttribute('buildingSurface',new T.BufferAttribute(surface,1));
   geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.clearGroups();parts.push(geometry);
  });
  const combined=mergeGeometries(parts,false);if(combined){combined.computeBoundingSphere();result.set(name,combined);}for(const part of parts)part.dispose();
 }
 scene.traverse(obj=>{if(obj instanceof T.Mesh){obj.geometry.dispose();for(const m of Array.isArray(obj.material)?obj.material:[obj.material])m.dispose();}});
 if(!['HouseCream','Lighthouse','HouseFisher','HouseTownhouse','HouseArcade','HouseVilla','HouseWorkshop','HouseTerrace'].every(name=>result.has(name)))throw new Error('环境模型缺少必要模块');
 return result;
}
