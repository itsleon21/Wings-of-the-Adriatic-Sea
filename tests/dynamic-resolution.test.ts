import {test} from 'node:test';import assert from 'node:assert/strict';import {DynamicResolution} from '../src/rendering/DynamicResolution.ts';
test('dynamic resolution responds to sustained load, stays bounded and restores quality slowly',()=>{
 const d=new DynamicResolution();let changes=0;
 for(let i=0;i<2400;i++)if(d.update(.1,33,150)!==undefined)changes++;
 assert.equal(d.scale,.55);assert.ok(changes>0&&changes<10);
 for(let i=0;i<6000;i++)d.update(.1,16,150);assert.equal(d.scale,1);
 d.reset();for(let i=0;i<100;i++)d.update(.1,33,0);assert.equal(d.scale,.85);
 d.update(NaN,33,150);d.update(.1,NaN,150);assert.equal(d.scale,.85);
});
test('steady target frame times do not oscillate or resize during a pause',()=>{
 const d=new DynamicResolution();for(let i=0;i<3000;i++)d.update(.1,18,150);assert.equal(d.scale,.85);
 for(let i=0;i<100;i++)d.update(0,33,150);assert.equal(d.scale,.85);
});
