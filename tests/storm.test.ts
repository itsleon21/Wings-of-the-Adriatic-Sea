import {test} from 'node:test';import assert from 'node:assert/strict';import {StormState} from '../src/rendering/NightStorm.ts';
test('night rain produces intermittent lightning and bounded gusts, stops while paused and clears outside rain',()=>{
 const s=new StormState();let strikes=0,maximum=0;for(let i=0;i<60*65;i++){s.update(1/60,1,1);if(s.strike)strikes++;maximum=Math.max(maximum,s.gust);assert.ok(s.flash>=0&&s.flash<1.01);assert.ok(s.gust>=0&&s.gust<=1);}assert.ok(strikes>=2&&strikes<=5);assert.ok(maximum>.8);const before=[s.flash,s.gust];s.update(0,1,1);assert.deepEqual([s.flash,s.gust],before);s.update(.1,0,1);assert.equal(s.flash,0);assert.equal(s.gust,0);s.update(.1,1,0);assert.equal(s.flash,0);
});
