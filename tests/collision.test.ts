import {test} from 'node:test';import assert from 'node:assert/strict';import {Vector3} from 'three';import {World} from '../src/world/World.ts';import {islands,terrainHeight,covePoint} from '../src/world/WorldConfig.ts';
const world=new World();
test('sea cave opening is clear and arch stone blocks flight',()=>{
 const d=islands[3],z=d.z-55;
 const at=(x:number,y:number,z:number)=>{const p=covePoint(d,d.x+x,z);return new Vector3(p.x,y,p.z);};
 assert.equal(world.collides(at(140,24,z),at(460,24,z)),false);
 assert.equal(world.collides(at(140,67,z),at(460,67,z)),true);
 assert.equal(world.collides(at(140,24,z+48),at(460,24,z+48)),true);
});
test('swept collision catches a lighthouse even when one frame spans the tower',()=>{
 const d=islands[2],y=terrainHeight(d,d.x,d.z)+63;
 assert.equal(world.collides(new Vector3(d.x,y,d.z-90),new Vector3(d.x,y,d.z+90)),true);
 assert.equal(world.collides(new Vector3(d.x,500,d.z-90),new Vector3(d.x,500,d.z+90)),false);
});
