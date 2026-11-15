import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {GardenHotel} from '../src/world/GardenHotel.ts';
import {hotelIsland,hotelScale,hotelOutline,insideHotel,terrainHeight} from '../src/world/WorldConfig.ts';

test('hotel tower physically passes through the roof and reaches the terrace',()=>{
 const hotel=new GardenHotel([]);hotel.root.updateMatrixWorld(true);
 const shaft=hotel.root.getObjectByName('Hotel continuous tower shaft')!;
 const roof=hotel.root.getObjectByName('Hotel pitched roof 0/75/104')!;
 assert.ok(shaft&&roof);
 const bounds=new T.Box3().setFromObject(shaft);
 assert.ok(Math.abs(bounds.min.y-21*hotelScale)<.001);
 const ray=new T.Raycaster(new T.Vector3(hotelIsland.x,200,hotelIsland.z+119*hotelScale),new T.Vector3(0,-1,0));
 const hit=ray.intersectObject(roof)[0];assert.ok(hit,'pitched roof must be directly below the tower');
 assert.ok(hit.point.y>bounds.min.y&&hit.point.y<bounds.max.y,'tower must penetrate roof, with no air gap');
 const light=hotel.root.getObjectByName('Lighthouse / rotating beacon')!;
 const pos=light.getWorldPosition(new T.Vector3());assert.ok(pos.y>bounds.max.y);
 hotel.setNightness(1,1);assert.ok(light.rotation.y>0);
});

test('hotel terrain follows the rebuilt stepped shoreline',()=>{
 for(const [x,z] of [[0,0],[0,-170],[115,-55],[124,-130]]){
  assert.equal(terrainHeight(hotelIsland,hotelIsland.x+x*hotelScale,hotelIsland.z+z*hotelScale)>0,insideHotel(x,z));
 }
 assert.ok(hotelOutline.length>8);
});

test('hotel stairs provide continuous rising treads and tender stays clear of the aircraft berth',async()=>{
 const {hotelWidthScale,hotelElevation}=await import('../src/world/WorldConfig.ts');
 const {mooringSites}=await import('../src/world/Moorings.ts');
 const hotel=new GardenHotel([]);hotel.root.updateMatrixWorld(true);
 const solid:T.Object3D[]=[];hotel.root.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&!o.material.transparent)solid.push(o);});
 for(let i=0;i<48;i++){
  const z=194.5-(i+.5)*1.6,expected=hotelElevation(5.95+i*(21.05/47))*hotelScale;
  const origin=new T.Vector3(hotelIsland.x+129*hotelWidthScale*hotelScale,100,hotelIsland.z+z*hotelScale);
  const hits=new T.Raycaster(origin,new T.Vector3(0,-1,0)).intersectObjects(solid,false);
  assert.ok(hits.some(h=>Math.abs(h.point.y-expected)<.01),`missing connected tread ${i}`);
 }
 const boat=hotel.root.getObjectByName('Hotel jetty / moored tender');assert.ok(boat);
 const bounds=new T.Box3().setFromObject(boat),berth=mooringSites.find(s=>s.id==='hotel')!.berth;
 assert.ok(bounds.distanceToPoint(berth)>15);
});
