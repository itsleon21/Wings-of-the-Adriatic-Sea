import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {NavigationBeacon} from '../src/missions/NavigationBeacon.ts';
test('beacon follows only the current target, animates, pauses exactly and clears after completion',()=>{
 const v=new NavigationBeacon(),camera=new T.PerspectiveCamera();camera.position.set(500,180,0);
 for(const kind of ['mission','race','commission'] as const){const t={name:kind,position:{x:100,y:130,z:400},kind};v.update(t,camera,1);assert(v.root.visible);assert(v.root.position.equals(new T.Vector3(100,130,400)));const b=v.root.children[0],y=b.position.y;v.update(t,camera,1);assert.equal(b.position.y,y);v.update(t,camera,1.4);assert.notEqual(b.position.y,y);}
 v.update(undefined,camera,2);assert(!v.root.visible);v.dispose();
});

test('near-player check-in symbols stay hidden while distant targets remain visible',()=>{const v=new NavigationBeacon(),camera=new T.PerspectiveCamera();camera.position.set(0,3,20);v.update({name:'Cast off',position:{x:0,y:0,z:0},kind:'commission'},camera,1);assert.equal(v.root.visible,false);v.update({name:'Island',position:{x:0,y:0,z:-300},kind:'commission'},camera,1);assert.equal(v.root.visible,true);v.dispose();});
