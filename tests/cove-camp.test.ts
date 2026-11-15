import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {CoveCamp} from '../src/world/CoveCamp.ts';import {islands,terrainHeight} from '../src/world/WorldConfig.ts';
test('secret cove camp is on a low dry beach and its fire lights only at night, freezing on pause',()=>{
 const camp=new CoveCamp(),d=islands.find(d=>d.id==='cove')!,h=terrainHeight(d,camp.root.position.x,camp.root.position.z);assert.ok(h>=2&&h<=6);assert.ok(Math.abs(camp.root.position.y-h-.12)<1e-6);
 const light=camp.root.children.find(o=>o instanceof T.PointLight) as T.PointLight;assert.equal(light.intensity,0);assert.ok(camp.root.getObjectByName('Canvas ridge tent'));camp.setNightness(1,1);assert.ok(light.intensity>0);const strength=light.intensity;camp.setNightness(1,0);assert.equal(light.intensity,strength);camp.setNightness(0,0);assert.equal(light.intensity,0);
});
