import {test} from 'node:test';
import assert from 'node:assert/strict';
import {armState,readArms,matches,nextCommand,roundDuration,GameSession} from './game.js';
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
 let arms={blue:'down',white:'down'};
 for(let i=0;i<100;i++){
  const command=nextCommand(i,previous,arms,()=>.999);
  assert.notEqual(command.text,previous?.text);
  if(i<5)assert.ok(!(command.blue && command.white));
  for(const key of ['blue','white'])if(command[key])arms[key]=command[key];
  previous=command;
 }
 const compound=nextCommand(5,null,{blue:'down',white:'down'},()=>.999);
 assert.ok(compound.blue && compound.white);
});

test('every requested arm must change from its current position, including compound commands',()=>{
 for(const blue of ['up','down'])for(const white of ['up','down']){
  const arms={blue,white};
  for(const round of [0,5,30])for(let choice=0;choice<100;choice++){
   const command=nextCommand(round,null,arms,()=>choice/100);
   assert.ok(command?.text);
   assert.equal(matches(command,arms),false);
   for(const key of ['blue','white']){
    if(command[key])assert.notEqual(command[key],arms[key]);
   }
  }
 }
});

test('next command uses the observed pose after a missed command or movement between rounds',()=>{
 const previous={text:'청기 올려',blue:'up'};
 for(const arms of [{blue:'up',white:'down'},{blue:'down',white:'up'}]){
  for(let choice=0;choice<100;choice++){
   const command=nextCommand(10,previous,arms,()=>choice/100);
   assert.notEqual(command.text,previous.text);
   for(const key of ['blue','white'])if(command[key])assert.notEqual(command[key],arms[key]);
  }
 }
});

test('waits for a definite pose instead of guessing an untracked or moving arm position',()=>{
 for(const state of ['middle','unknown',undefined]){
  assert.equal(nextCommand(5,null,{blue:state,white:'down'}),null);
  assert.equal(nextCommand(5,null,{blue:'up',white:state}),null);
 }
});
test('difficulty reduces time but retains a two second minimum',()=>{
 assert.equal(roundDuration(0),5);assert.equal(roundDuration(5),4.5);assert.equal(roundDuration(100),2);
});

function sessionAtCommand(arms, compound = false) {
 const game = new GameSession(()=>.999);
 game.start(0);
 if(compound)game.round=5;
 game.observe(arms,0);game.observe(arms,200);game.tick(200);
 assert.equal(game.phase,'command');
 return game;
}

test('compound success requires movement of both arms after issuance, not one already lowered arm',()=>{
 const game=sessionAtCommand({blue:'down',white:'up'},true);
 assert.deepEqual(game.command,{text:'청기 올리고, 백기 내려',blue:'up',white:'down'});
 // The left arm reaches its target without any observed movement of the right.
 game.observe({blue:'down',white:'up'},230);
 for(const now of [250,350,500,650,800])game.observe({blue:'down',white:'down'},now);
 assert.equal(game.score,0);assert.equal(game.phase,'command');
 // Even both target values cannot score if one arm was not observed away
 // from its target after the instruction was issued.
 const alreadyHeld=sessionAtCommand({blue:'down',white:'up'},true);
 for(const now of [250,400,550,700])alreadyHeld.observe({blue:'up',white:'down'},now);
 assert.equal(alreadyHeld.score,0);
 for(const now of [850,1000,1150,1200])game.observe({blue:'up',white:'down'},now);
 assert.equal(game.score,100);assert.equal(game.successes,1);
});

test('a cached target pose and elapsed ticks cannot award success without fresh pose frames',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});
 const target={blue:'down',white:'down',...Object.fromEntries(['blue','white'].filter(k=>game.command[k]).map(k=>[k,game.command[k]]))};
 game.observe({blue:'down',white:'down'},230);
 game.observe(target,300);
 game.tick(500);game.tick(700);game.tick(900);
 assert.equal(game.score,0);
 game.observe(target,1000);game.observe(target,1150);game.observe(target,1300);game.observe(target,1500);
 assert.equal(game.score,100);
});

test('score updates, new commands, duplicate starts and tracking loss preserve one 120 second deadline',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});
 const deadline=game.endAt;
 game.observe({blue:'down',white:'down'},230);
 const target={...game.arms};
 for(const key of ['blue','white'])if(game.command[key])target[key]=game.command[key];
 for(const now of [300,450,600,650])game.observe(target,now);
 assert.equal(game.score,100);assert.equal(game.endAt,deadline);
 game.observe(target,1400);game.observe(target,1500);game.observe(target,1600);game.tick(1600);
 assert.equal(game.phase,'command');assert.equal(game.endAt,deadline);
 assert.equal(game.start(2000),false);assert.equal(game.score,100);
 game.observe({blue:'unknown',white:'unknown'},4000);
 game.tick(90000);
 assert.equal(game.remaining(90000),30);assert.equal(game.endAt,deadline);
 game.tick(120000);
 assert.equal(game.phase,'finished');assert.equal(game.remaining(120000),0);
 assert.equal(game.score,100);
});

test('waiting for a stable pose keeps total time running and does not issue a stale command',()=>{
 const game=new GameSession();game.start(0);
 game.observe({blue:'up',white:'down'},10);
 game.tick(1000);
 assert.equal(game.phase,'waiting');assert.equal(game.remaining(1000),119);
 game.observe({blue:'up',white:'down'},1100);game.observe({blue:'up',white:'down'},1300);game.tick(1300);
 assert.equal(game.phase,'command');assert.equal(game.endAt,120000);
});

test('a new two minute session starts only after the previous session has ended',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});
 game.finish(45000);assert.equal(game.remaining(90000),75);
 assert.equal(game.start(90000),true);
 assert.equal(game.remaining(90000),120);assert.equal(game.endAt,210000);
});

test('a full two minute game scores repeated actions without extending the session',()=>{
 const game=new GameSession(()=>.999);
 let arms={blue:'down',white:'down'}, issuedAt=0, lastRound=0;
 game.start(0);
 for(let now=0;now<=120000;now+=50){
  game.tick(now);
  if(game.round!==lastRound){lastRound=game.round;issuedAt=now;}
  if(game.phase==='command' && now-issuedAt>=250){
   for(const key of ['blue','white'])if(game.command[key])arms[key]=game.command[key];
  }
  game.observe(arms,now);
  assert.equal(game.endAt,120000);
 }
 assert.equal(game.phase,'finished');assert.ok(game.successes>20);
 assert.equal(game.remaining(120000),0);assert.equal(game.misses,0);
});

test('holding the same pose for two minutes never skips instructions or earns points',()=>{
 const game=new GameSession(()=>.999);game.start(0);
 for(let now=0;now<=120000;now+=100){
  game.observe({blue:'down',white:'down'},now);game.tick(now);
 }
 assert.equal(game.score,0);assert.equal(game.successes,0);
 assert.ok(game.misses>0);assert.equal(game.phase,'finished');
});

test('custom game duration is validated and cannot change during a running session',()=>{
 const game=new GameSession();
 for(const invalid of [0,9,601,NaN,30.5])assert.throws(()=>game.start(0,invalid));
 game.start(1000,30);assert.equal(game.endAt,31000);assert.equal(game.remaining(1000),30);
 assert.equal(game.start(5000,600),false);assert.equal(game.endAt,31000);
 game.tick(31000);assert.equal(game.phase,'finished');assert.equal(game.remaining(31000),0);
 game.start(40000,60);assert.equal(game.remaining(40000),60);
});

test('a wrong move held for half a second deducts 50 points once and resets the combo',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});
 game.score=100;game.combo=2;
 // The command asks for white up, but the player raises blue instead.
 assert.equal(game.command.white,'up');
 for(const now of [400,500,600,700,800,900,1000,1100,1200,1300,1400])game.observe({blue:'up',white:'down'},now);
 assert.equal(game.score,100);
 game.observe({blue:'up',white:'down'},1500);
 assert.equal(game.score,50);assert.equal(game.wrongMoves,1);assert.equal(game.penaltyPoints,50);
 assert.equal(game.combo,0);assert.equal(game.misses,1);assert.equal(game.lastFailure,'wrong');
 game.observe({blue:'up',white:'down'},1600);game.observe({blue:'up',white:'down'},1700);
 assert.equal(game.score,50);assert.equal(game.misses,1);
});

test('waiting in the initial pose and timeout do not count as a wrong movement',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});game.score=100;
 for(let now=300;now<=5000;now+=100)game.observe({blue:'down',white:'down'},now);
 assert.equal(game.score,100);assert.equal(game.wrongMoves,0);
 game.tick(5200);assert.equal(game.lastFailure,'timeout');assert.equal(game.score,100);
});

test('transitioning or untracked poses do not receive a wrong-move penalty',()=>{
 for(const arms of [{blue:'middle',white:'down'},{blue:'up',white:'unknown'}]){
  const game=sessionAtCommand({blue:'down',white:'down'});game.score=100;
  for(let now=300;now<=2000;now+=100)game.observe(arms,now);
  assert.equal(game.score,100);assert.equal(game.wrongMoves,0);
 }
});

test('a frozen or changed wrong pose cannot accumulate the half-second hold',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});game.score=100;
 for(let now=300;now<=1000;now+=100)game.observe({blue:'up',white:'down'},now);
 game.tick(1600);assert.equal(game.wrongMoves,0);
 game.observe({blue:'up',white:'down'},1700);game.observe({blue:'up',white:'down'},1800);
 game.observe({blue:'middle',white:'down'},1900);
 game.observe({blue:'up',white:'down'},2000);game.observe({blue:'up',white:'down'},2200);
 assert.equal(game.score,100);assert.equal(game.wrongMoves,0);
});

test('wrong movement cannot reduce the score below zero and new games clear penalties',()=>{
 const game=sessionAtCommand({blue:'down',white:'down'});game.score=20;
 for(let now=300;now<=1500;now+=100)game.observe({blue:'up',white:'down'},now);
 assert.equal(game.score,0);assert.equal(game.penaltyPoints,20);assert.equal(game.wrongMoves,1);
 game.finish(1600);game.start(2000);
 assert.equal(game.wrongMoves,0);assert.equal(game.penaltyPoints,0);
});
