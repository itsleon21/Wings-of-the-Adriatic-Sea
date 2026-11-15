import {test} from 'node:test';import assert from 'node:assert/strict';import {daylightAt,timePresets} from '../src/rendering/TimeOfDay.ts';import {SettlementLights} from '../src/world/SettlementLights.ts';import {buildSettlementLayout} from '../src/world/SettlementLayout.ts';import {islands} from '../src/world/WorldConfig.ts';import * as T from 'three';
test('morning and dusk place the sun at opposite sea horizons, while noon remains high',()=>{const a=daylightAt(timePresets.morning.hour),b=daylightAt(timePresets.dusk.hour);assert.ok(a.direction[0]>.9&&b.direction[0]<-.9);for(const s of[a,b])assert.ok(s.solarElevation>0&&s.solarElevation<.04);assert.ok(daylightAt(12).solarElevation>.99);assert.equal(daylightAt(23).nightness,1);});
test('settlement panes and street lamps fade on at night with a bounded number of actual lights',()=>{const d=islands[0],lights=new SettlementLights(d,buildSettlementLayout(d));const panes=lights.root.getObjectByName('Warm inhabited window panes') as T.InstancedMesh;assert.ok(panes.count>50);const material=panes.material as T.MeshBasicMaterial;lights.setNightness(0);const day=material.color.r;lights.setNightness(1);lights.updateView(new T.Vector3(d.x,10,d.z));assert.ok(material.color.r>day*10);let count=0;lights.root.traverse(o=>{if(o instanceof T.PointLight){count++;assert.ok(o.intensity>0);assert.equal(o.castShadow,false);}});assert.equal(count,2);lights.updateView(new T.Vector3(100000,0,100000));lights.root.traverse(o=>{if(o instanceof T.PointLight)assert.equal(o.intensity,0);assert.equal(o.visible,true);});});

test('moon rises from the sea at dusk, crosses the night sky and sets at dawn',()=>{
 const rise=daylightAt(18).moonDirection,high=daylightAt(0).moonDirection,set=daylightAt(6).moonDirection;
 assert.ok(Math.abs(rise[1])<1e-10&&Math.abs(set[1])<1e-10);
 assert.ok(rise[0]>.99&&set[0]<-.99&&high[1]>.99);
 assert.ok(daylightAt(19).moonDirection[1]>rise[1]);
 assert.ok(daylightAt(5).moonDirection[1]>set[1]);
 assert.ok(daylightAt(12).moonDirection[1]<0);
});
