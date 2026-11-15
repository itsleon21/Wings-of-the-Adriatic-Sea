import * as T from 'three';
import type {Part} from './Workshop';
export function installedAppearance(root:T.Object3D,parts:Part[]){
 root.traverse(o=>{
  if(!o.userData.workshopScale)o.userData.workshopScale=o.scale.clone();o.scale.copy(o.userData.workshopScale);
  if(parts.some(p=>p.kind==='propeller')&&o.name.startsWith('PropellerPivot')){o.scale.x*=1.06;o.scale.y*=1.06;}
  if(/stepped racing float/i.test(o.name)){if(parts.some(p=>p.id.endsWith('-4')))o.scale.x*=.93;if(parts.some(p=>p.id.endsWith('-5')))o.scale.x*=1.08;}
  if(o instanceof T.Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(!(material instanceof T.MeshStandardMaterial))continue;
   if(!material.userData.workshopBase)material.userData.workshopBase={color:material.color.getHex(),roughness:material.roughness,metalness:material.metalness};const base=material.userData.workshopBase;material.color.setHex(base.color);material.roughness=base.roughness;material.metalness=base.metalness;
   if(parts.some(p=>p.kind==='radiator')&&/radiator|engine alloy|M5 brushed alloy/i.test(material.name)){material.color.setHex(0xa77c42);material.metalness=.82;material.roughness=.28;}
   if(parts.some(p=>p.kind==='engine')&&/engine steel|Cylinder dark steel/i.test(material.name)){material.color.setHex(0x303637);material.metalness=.8;material.roughness=.30;}
   if(parts.some(p=>p.kind==='frame')&&/structural enamel|struts|bracing/i.test(material.name)){material.color.setHex(0x9b9d8e);material.metalness=.55;material.roughness=.36;}
  }}
 });
}
