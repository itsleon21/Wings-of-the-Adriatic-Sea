import * as T from 'three';

// Oil lamps, tungsten lamps and softly curtained rooms, from amber to ivory.
const glassTints=[0xffa963,0xffbb79,0xffce99,0xffdeb5,0xffeaca,0xfff1de];
export function roomLight(seed:number){
 const bits=Math.imul(Math.round(seed)^0x53a9,1597334677)>>>0;
 return new T.Color(glassTints[bits%glassTints.length]).multiplyScalar(.69+.29*(bits>>>16)/65535);
}
export function tintGlass(geometry:T.BufferGeometry,seed:number){
 const tint=roomLight(seed),count=geometry.attributes.position.count,colors=new Float32Array(count*3);
 for(let i=0;i<count;i++)tint.toArray(colors,i*3);
 geometry.setAttribute('roomTint',new T.BufferAttribute(colors,3));
}
export function roomGlass(material:T.MeshStandardMaterial){
 material.emissive.setHex(0xffffff);material.emissiveIntensity=0;
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec3 roomTint; varying vec3 vRoomTint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRoomTint=roomTint;');
  shader.fragmentShader='varying vec3 vRoomTint;\n'+shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=vRoomTint;');
 };
 return material;
}
