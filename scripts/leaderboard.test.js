import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {createLeaderboard,handleLeaderboardApi} from './leaderboard.mjs';
import {gifticonCsv} from './export-gifticon.mjs';

const person={name:'테스트 참가자',studentId:'TEST-001',department:'테스트학과',phone:'000-0000-0000'};
const run='00000000-0000-4000-8000-000000000001';
test('gifticon CSV includes private contact fields, preserves leading zeroes and escapes formulas',()=>{
 const csv=gifticonCsv({participants:[{...person,name:'=TEST',token:'demo',phone:'00000000000'}],scores:[{token:'demo',score:100,successes:1,misses:0}]});
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('전화번호'));
 assert.ok(csv.includes('"\t00000000000"'));assert.ok(csv.includes("'=TEST"));
 assert.ok(csv.includes('"\tTEST-001"'));assert.ok(!csv.includes('demo'));
});
test('leaderboards separate different game durations and retain legacy 120 second scores',async t=>{
 const {store}=await fixture(t);const p=await store.register(person);
 await store.save({token:p.token,runId:run,score:100,successes:1,misses:0});
 await store.save({token:p.token,runId:run.replace(/1$/,'2'),score:210,successes:2,misses:0,durationSeconds:30});
 assert.equal(store.list()[0].score,100);assert.equal(store.list(30)[0].score,210);
 assert.equal(store.list(60).length,0);
});
async function fixture(t) {
  const dir=await mkdtemp(join(tmpdir(),'flag-leaderboard-test-'));
  const file=join(dir,'records.json');
  t.after(async()=>{for(const path of [file,file+'.tmp'])await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(dir);});
  return {file,store:await createLeaderboard(file)};
}
test('registration validates required fields and does not return student ID or phone',async t=>{
  const {store}=await fixture(t);
  assert.throws(()=>store.register({...person,phone:'wrong'}));
  assert.throws(()=>store.register({...person,name:' '}));
  assert.throws(()=>store.register({...person,studentId:''}));
  const p=await store.register(person);
  assert.deepEqual(Object.keys(p).sort(),['department','name','token']);
});
test('leaderboard persists privately, deduplicates by student ID and preserves the best run',async t=>{
  const {store,file}=await fixture(t);
  const p=await store.register(person);
  await store.save({token:p.token,runId:run,score:210,successes:2,misses:1});
  await store.save({token:p.token,runId:run,score:210,successes:2,misses:1});
  const p2=await store.register({...person,name:'새 테스트 이름'});
  await store.save({token:p2.token,runId:run.replace(/1$/,'2'),score:100,successes:1,misses:0});
  const fresh=await createLeaderboard(file);
  assert.deepEqual(fresh.list(),[{rank:1,name:person.name,department:person.department,score:210,accuracy:67}]);
  assert.equal(JSON.parse(await readFile(file,'utf8')).scores.length,2);
  const publicJson=JSON.stringify(fresh.list());
  for(const privateValue of [person.studentId,'00000000000',p.token])assert.ok(!publicJson.includes(privateValue));
});
test('score writes reject unknown participants, impossible scores and duplicate IDs from other participants',async t=>{
  const {store}=await fixture(t);
  const p=await store.register(person);
  assert.throws(()=>store.save({token:p.token,runId:run,score:10000,successes:1,misses:0}));
  await assert.rejects(store.save({token:'missing',runId:run,score:100,successes:1,misses:0}));
  await store.save({token:p.token,runId:run,score:100,successes:1,misses:0});
  const other=await store.register({...person,studentId:'TEST-002'});
  await assert.rejects(store.save({token:other.token,runId:run,score:100,successes:1,misses:0}));
});
test('simultaneous writes are retained and ties sort by accuracy',async t=>{
  const {store}=await fixture(t);
  const people=await Promise.all([0,1,2].map(i=>store.register({...person,studentId:'TEST-00'+i})));
  await Promise.all(people.map((p,i)=>store.save({token:p.token,runId:run.replace(/1$/,String(i+1)),score:100,successes:1,misses:i})));
  assert.deepEqual(store.list().map(x=>x.accuracy),[100,50,33]);
});
test('HTTP registration and ranking keep private fields off public endpoints and block cross-site writes',async t=>{
  const {store}=await fixture(t);
  const server=createServer(async(req,res)=>{if(!await handleLeaderboardApi(req,res,store)){res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(path,data,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
  const denied=await post('/api/participants',person,{Origin:'https://other.example'});assert.equal(denied.status,403);
  const register=await post('/api/participants',person);assert.equal(register.status,200);
  const p=await register.json();
  assert.equal((await post('/api/scores',{token:p.token,runId:run,score:100,successes:1,misses:0})).status,200);
  const response=await fetch(base+'/api/leaderboard');const data=await response.json();
  assert.equal(data.entries.length,1);assert.deepEqual(Object.keys(data.entries[0]).sort(),['accuracy','department','name','rank','score']);
  assert.equal((await fetch(base+'/api/participants')).status,404);
});
