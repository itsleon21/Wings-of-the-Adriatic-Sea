import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harborRelief} from '../src/world/HarborRelief.ts';

test('headland erosion preserves the central terrace access and low shoreline',()=>{
 for(let z=-450;z<500;z+=11){assert.equal(harborRelief(0,z,90,.8),0);assert.equal(harborRelief(250,z,10,.8),0);}
 for(let x=-500;x<=500;x+=13)assert.equal(harborRelief(x,250,90,.8),0);
});
test('outer headland gains bounded nonuniform relief without changing the outer water footprint',()=>{
 const cuts:number[]=[];
 for(let x=-450;x<=450;x+=7)for(let z=-350;z<=-150;z+=11){const delta=harborRelief(x,z,70,.8);assert.ok(Number.isFinite(delta)&&delta>=-15&&delta<=4);cuts.push(delta);}
 assert.ok(Math.min(...cuts)<-6);assert.ok(Math.max(...cuts)>1);
 assert.equal(harborRelief(200,-250,70,1.05),0);
});
