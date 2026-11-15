import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
test('exported aircraft GLB has valid container and independent animated nodes',()=>{
 const data=readFileSync(new URL('../public/models/aircraft.glb',import.meta.url));assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 const length=data.readUInt32LE(12);const gltf=JSON.parse(data.toString('utf8',20,20+length));const names=gltf.nodes.map((node:{name:string})=>node.name);
 for(const name of ['AircraftRoot','AircraftBody','PropellerPivot','LeftAileron','RightAileron','Elevator','Rudder'])assert.ok(names.includes(name),name);
 assert.ok(gltf.meshes.length>0);assert.ok(gltf.materials.length>=6);assert.ok(gltf.images.length>=3,'PBR paint textures are embedded');for(const image of gltf.images)assert.ok(Number.isInteger(image.bufferView)&&!image.uri,'all textures are embedded in the GLB');assert.ok(gltf.materials.some((m:{normalTexture?:unknown})=>m.normalTexture),'surface normal detail');
 for(const name of ['top','front','side'])assert.ok(existsSync(new URL(`../art/aircraft_views/${name}.png`,import.meta.url)));
});
test('environment kit includes the required original modules',()=>{
 const data=readFileSync(new URL('../public/models/environment.glb',import.meta.url)),length=data.readUInt32LE(12),gltf=JSON.parse(data.toString('utf8',20,20+length));
 const names=gltf.nodes.map((node:{name:string})=>node.name);for(const name of ['HouseCream','HouseOchre','Warehouse','Lighthouse','PineCrown','OliveTree','CoastalRock','FishingBoat'])assert.ok(names.includes(name),name);assert.equal(data.readUInt32LE(8),data.length);
});

test('exported coastal buildings retain nonuniform baked visibility for indirect lighting',()=>{
 const data=readFileSync(new URL('../public/models/environment.glb',import.meta.url));
 const jsonLength=data.readUInt32LE(12),gltf=JSON.parse(data.toString('utf8',20,20+jsonLength));
 const binaryStart=20+jsonLength+8;
 for(const name of ['HouseFisher','HouseTownhouse','HouseArcade','HouseVilla','HouseWorkshop','HouseTerrace','HouseLoggia','HousePalazzo','HouseBoatyard','HouseMill','HouseMillTall','HouseMillSquare','HouseGranary','HouseMarketHall']){
  const root=gltf.nodes.findIndex((n:{name?:string})=>n.name===name);
  const values:number[]=[];
  const walk=(i:number)=>{
   const node=gltf.nodes[i];
   if(node.mesh!==undefined)for(const p of gltf.meshes[node.mesh].primitives){
    assert.notEqual(p.attributes.COLOR_0,undefined,name+' lacks baked visibility');
    const accessor=gltf.accessors[p.attributes.COLOR_0],view=gltf.bufferViews[accessor.bufferView];
    assert.ok([5121,5123].includes(accessor.componentType));
    assert.equal(accessor.normalized,true);
    const offset=binaryStart+(view.byteOffset??0)+(accessor.byteOffset??0);
    const bytes=accessor.componentType===5123?2:1;
    for(let vertex=0;vertex<accessor.count;vertex++){const at=offset+vertex*(view.byteStride??4*bytes);values.push(bytes===2?data.readUInt16LE(at)/65535:data[at]/255);}
   }
   for(const child of node.children??[])walk(child);
  };
  walk(root);
  assert.ok(values.length>0);
  assert.ok(values.some(v=>v<.9),name+' cavities must occlude some skylight');
  assert.ok(values.some(v=>v>.98),name+' open surfaces must retain skylight');
  assert.ok(values.every(v=>v>=.34&&v<=1),name+' visibility must remain bounded');
 }
});
