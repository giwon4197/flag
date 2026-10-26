import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function gifticonCsv(state) {
  const best=new Map();
  for(const score of state.scores) {
    const p=state.participants.find(p=>p.token===score.token);if(!p)continue;
    const duration=score.durationSeconds ?? 120;
    const accuracy=score.successes+score.misses?Math.round(score.successes/(score.successes+score.misses)*100):0;
    const key=p.studentId+'\0'+duration;
    const old=best.get(key);
    if(!old || score.score>old.score || score.score===old.score && accuracy>old.accuracy) {
      const contact=state.participants.findLast(entry=>entry.studentId===p.studentId) || p;
      best.set(key,{...score,...contact,duration,accuracy});
    }
  }
  function cell(value,asText=false) {
    let text=String(value ?? '');
    if(asText)text='\t'+text;
    else if(/^[\s]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }
  const rows=[['시간별 순위','경기 시간(초)','이름','학번','학과','전화번호','최고 점수','정확도(%)','오동작 횟수','실제 감점']];
  let previousDuration=null,rank=0;
  for(const row of [...best.values()].sort((a,b)=>a.duration-b.duration || b.score-a.score || b.accuracy-a.accuracy)) {
    if(previousDuration!==row.duration){rank=0;previousDuration=row.duration;}
    rows.push([++rank,row.duration,row.name,row.studentId,row.department,row.phone,row.score,row.accuracy,row.wrongMoves ?? 0,row.penaltyPoints ?? 0]);
  }
  return '\uFEFF'+rows.map((row,index)=>row.map((value,col)=>cell(value,index>0 && [3,5].includes(col))).join(',')).join('\r\n')+'\r\n';
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const input=process.env.FLAG_DATA_FILE || resolve(root,'data/leaderboard.json');
  try {
    const state=JSON.parse(await readFile(input,'utf8'));
    const output=resolve(process.argv[2] || resolve(root,'exports',`gifticon-${new Date().toISOString().replace(/[:.]/g,'-')}.csv`));
    await mkdir(dirname(output),{recursive:true});
    await writeFile(output,gifticonCsv(state),{flag:'wx',mode:0o600});
    console.log(`기프티콘 지급용 CSV 저장: ${output}`);
  } catch(error) {console.error(error.code==='ENOENT'?'아직 저장된 참가 기록이 없습니다.':error.message);process.exitCode=1;}
}
