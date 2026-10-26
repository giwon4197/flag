import test from 'node:test';
import assert from 'node:assert/strict';
import {AutoStartGesture} from './auto-start.js';
const up={blue:'up',white:'up'}, down={blue:'down',white:'down'};
test('raising both arms starts exactly once after three seconds of fresh frames',()=>{
 const gesture=new AutoStartGesture();
 for(let now=0;now<3000;now+=100)assert.equal(gesture.update(up,now,true),Math.ceil((3000-now)/1000));
 assert.equal(gesture.update(up,3000,true),0);
 assert.equal(gesture.update(up,3100,true),null);
});
test('lowering one arm or losing recognition cancels the countdown',()=>{
 for(const arms of [{blue:'down',white:'up'},{blue:'up',white:'unknown'}]){
  const gesture=new AutoStartGesture();
  for(let now=0;now<=2000;now+=100)gesture.update(up,now,true);
  assert.equal(gesture.update(arms,2100,true),null);
  assert.equal(gesture.update(up,2200,true),3);
 }
});
test('a stalled camera cannot complete a countdown',()=>{
 const gesture=new AutoStartGesture();gesture.update(up,0,true);
 assert.equal(gesture.update(up,5000,true),3);
});
test('unregistered, hidden, playing, dialog and saving states cannot start the game',()=>{
 const gesture=new AutoStartGesture();
 for(let now=0;now<=4000;now+=100)assert.equal(gesture.update(up,now,false),null);
 assert.equal(gesture.update(up,4100,true),3);
 gesture.update(up,4200,false);
 assert.equal(gesture.update(up,4300,true),3);
});
test('after a game, both arms must be lowered before another hands-free countdown',()=>{
 const gesture=new AutoStartGesture();gesture.lock();
 for(let now=0;now<=4000;now+=100)assert.equal(gesture.update(up,now,true),null);
 gesture.update(down,4100,true);
 assert.equal(gesture.update(up,4200,true),3);
});
