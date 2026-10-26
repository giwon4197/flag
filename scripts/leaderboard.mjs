import {readFile, mkdir, writeFile, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function createLeaderboard(file) {
  let state;
  try { state = JSON.parse(await readFile(file, 'utf8')); }
  catch(error) { if(error.code !== 'ENOENT') throw error; state = {participants:[], scores:[]}; }
  if (!Array.isArray(state.participants) || !Array.isArray(state.scores)) throw new Error('Invalid leaderboard data');
  let pending = Promise.resolve();
  function update(change) {
    const operation = pending.then(async () => {
      const next = structuredClone(state);
      const result = change(next);
      await mkdir(dirname(file), {recursive:true});
      await writeFile(file+'.tmp', JSON.stringify(next), {mode:0o600});
      await rename(file+'.tmp', file);
      state = next;
      return result;
    });
    pending = operation.catch(()=>{});
    return operation;
  }
  return {
    register(input) {
      const name = String(input.name ?? '').trim();
      const studentId = String(input.studentId ?? '').trim();
      const department = String(input.department ?? '').trim();
      const phone = String(input.phone ?? '').replace(/[\s()-]/g,'');
      if (!name || name.length>30 || !/^[a-zA-Z0-9-]{3,30}$/.test(studentId) || !department || department.length>80 || !/^\+?\d{9,15}$/.test(phone)) throw new Error('이름, 학번, 학과, 전화번호를 올바르게 입력해 주세요.');
      return update(next => {
        const participant = {token:randomUUID(),name,studentId,department,phone,createdAt:new Date().toISOString()};
        next.participants.push(participant);
        return {token:participant.token,name,department};
      });
    },
    save(input) {
      if (typeof input.token !== 'string' || typeof input.runId !== 'string' || !/^[\da-f-]{36}$/i.test(input.runId)) throw new Error('참가 정보를 다시 입력해 주세요.');
      const {score, successes, misses} = input;
      const durationSeconds = input.durationSeconds ?? 120;
      if(!Number.isInteger(durationSeconds) || durationSeconds<10 || durationSeconds>600)throw new Error('게임 시간은 10~600초로 설정해 주세요.');
      if (![score,successes,misses].every(Number.isSafeInteger) || Math.min(score,successes,misses)<0 || successes+misses>1000 || score<successes*100 || score>successes*200) throw new Error('올바르지 않은 게임 기록입니다.');
      return update(next => {
        if (!next.participants.some(p=>p.token===input.token)) throw new Error('참가 정보를 다시 입력해 주세요.');
        const previous = next.scores.find(s=>s.runId===input.runId);
        if (previous) {
          if(previous.token!==input.token) throw new Error('올바르지 않은 게임 기록입니다.');
          return {saved:true};
        }
        next.scores.push({token:input.token,runId:input.runId,score,successes,misses,durationSeconds,createdAt:new Date().toISOString()});
        return {saved:true};
      });
    },
    list(durationSeconds = 120) {
      const best = new Map();
      for (const score of state.scores) {
        if((score.durationSeconds ?? 120)!==durationSeconds)continue;
        const p = state.participants.find(p=>p.token===score.token);
        if(!p) continue;
        const completed = score.successes+score.misses;
        const row = {name:p.name,department:p.department,score:score.score,accuracy:completed?Math.round(score.successes/completed*100):0};
        const old = best.get(p.studentId);
        if (!old || row.score>old.score || row.score===old.score && row.accuracy>old.accuracy) best.set(p.studentId,row);
      }
      return [...best.values()].sort((a,b)=>b.score-a.score || b.accuracy-a.accuracy).slice(0,20).map((row,i)=>({rank:i+1,...row}));
    }
  };
}

export async function handleLeaderboardApi(req,res,store) {
  const path = new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/api/')) return false;
  function json(status,data) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data)); }
  try {
    if(req.method==='GET' && path==='/api/leaderboard') {
      const duration=Number(new URL(req.url,'http://localhost').searchParams.get('durationSeconds') ?? 120);
      if(!Number.isInteger(duration)||duration<10||duration>600){json(400,{error:'올바른 게임 시간을 선택해 주세요.'});return true;}
      json(200,{entries:store.list(duration),durationSeconds:duration});return true;
    }
    if(req.method!=='POST' || !['/api/participants','/api/scores'].includes(path)) {json(404,{error:'요청한 기능을 찾을 수 없습니다.'});return true;}
    if(req.headers['sec-fetch-site']==='cross-site' || req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) {json(403,{error:'게임 페이지에서 다시 시도해 주세요.'});return true;}
    if(!req.headers['content-type']?.startsWith('application/json')) {json(415,{error:'잘못된 요청입니다.'});return true;}
    const chunks=[];let length=0;
    for await (const chunk of req) {length+=chunk.length;if(length>4096){json(413,{error:'입력 내용이 너무 깁니다.'});return true;}chunks.push(chunk);}
    let input;
    try {input=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {json(400,{error:'입력 내용을 확인해 주세요.'});return true;}
    if(!input || typeof input!=='object' || Array.isArray(input)) {json(400,{error:'입력 내용을 확인해 주세요.'});return true;}
    try {json(200,await (path==='/api/participants'?store.register(input):store.save(input)));}
    catch(error) {if(error.code){console.error('Leaderboard storage error:',error.code);json(500,{error:'기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'});}else json(400,{error:error.message});}
  } catch(error) {console.error('Leaderboard request error:',error.message);if(!res.headersSent)json(500,{error:'잠시 후 다시 시도해 주세요.'});}
  return true;
}
