import {test} from 'node:test';
import assert from 'node:assert/strict';
import {armState,readArms,matches,nextCommand,roundDuration} from './game.js';
const point=(y,visibility=.99)=>({x:.5,y,visibility});
test('shoulder-relative wrist classification rejects low visibility and ambiguous poses',()=>{
 assert.equal(armState(point(.5),point(.4),point(.2)),'up');
 assert.equal(armState(point(.5),point(.6),point(.8)),'down');
 assert.equal(armState(point(.5),point(.5),point(.5)),'middle');
 assert.equal(armState(point(.5),point(.4,.2),point(.2)),'unknown');
 assert.equal(armState(undefined,undefined,undefined),'unknown');
});
test('anatomical right arm is blue, left arm is white',()=>{
 const points=[];points[12]=point(.5);points[14]=point(.4);points[16]=point(.2);
 points[11]=point(.5);points[13]=point(.6);points[15]=point(.8);
 assert.deepEqual(readArms(points),{blue:'up',white:'down'});
});
test('both arms must be visible; only specified arms are constrained',()=>{
 assert.equal(matches({blue:'up'},{blue:'up',white:'down'}),true);
 assert.equal(matches({blue:'up'},{blue:'up',white:'unknown'}),false);
 assert.equal(matches({blue:'up',white:'down'},{blue:'up',white:'up'}),false);
 assert.equal(matches({blue:'up',white:'down'},{blue:'up',white:'down'}),true);
});
test('commands do not repeat and compound commands appear only after warmup',()=>{
 let previous;
 for(let i=0;i<100;i++){
  const command=nextCommand(i,previous,()=>.999);
  assert.notEqual(command.text,previous?.text);
  if(i<5)assert.ok(!(command.blue && command.white));
  previous=command;
 }
 assert.ok(nextCommand(5,null,()=>.999).blue && nextCommand(5,null,()=>.999).white);
});
test('difficulty reduces time but retains a two second minimum',()=>{
 assert.equal(roundDuration(0),5);assert.equal(roundDuration(5),4.5);assert.equal(roundDuration(100),2);
});
