import {test} from 'node:test';import assert from 'node:assert/strict';import {english} from '../src/ui/Language.ts';
test('English flight controls retain shortcut keys, numbers and navigation units',()=>{
 assert.equal(english('开始飞行'),'Start flying');assert.equal(english('空速'),'Airspeed');
 assert.equal(english('W S 俯仰　A D 转弯'),'W S Pitch　A D Turn');
 assert.equal(english('港湾出口 · 707 m'),'Harbor exit · 707 m');assert.equal(english('迅捷 · 灵活 · 特技飞行'),'Fast · Agile · Aerobatic');
 assert.equal(english('00:18.5 / 306 km/h'),'00:18.5 / 306 km/h');
 assert.ok(!/[\u3400-\u9fff]/.test(english('展开 / 收起着水指导')));
});
