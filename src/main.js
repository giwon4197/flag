import './style.css';
import {FilesetResolver, PoseLandmarker} from '@mediapipe/tasks-vision';
import {GameSession, readArms, roundDuration} from './game.js';
import {openCamera} from './camera.js';
import {AutoStartGesture} from './auto-start.js';

const flag = color => `<span class="flag ${color}" aria-hidden="true"><i></i></span>`;
document.querySelector('#app').innerHTML = `
<main class="arena">
  <div class="camera-view" aria-label="실시간 카메라"><video autoplay playsinline muted></video><canvas></canvas></div>
  <div class="camera-shade"></div>
  <header class="top-bar">
    <div class="brand">${flag('blue')}<div>청기백기<small>AI MOTION PLAY</small></div></div>
    <section class="scoreboard" aria-label="게임 기록">
      <div class="stat"><span>점수</span><strong id="score">0점</strong></div>
      <div class="stat timer"><span id="timer-label">남은 시간 · 120초 도전</span><strong id="time" role="timer">2:00</strong></div>
      <div class="stat"><span>연속 성공</span><strong id="combo">0회</strong></div>
    </section>
    <div class="record"><span>BEST SCORE</span><strong id="best-score">0</strong><small id="record-note">현장 최고 기록</small></div>
  </header>
  <div class="session-track" aria-hidden="true"><div id="session-progress"></div></div>
  <section class="center-stage">
    <div id="camera-placeholder" class="welcome-panel">
      <div class="eyebrow">MOVE YOUR ARMS, MEET AI</div>
      <div class="welcome-flags">${flag('white')}${flag('blue')}</div>
      <h1>온몸으로 즐기는<br><em>청기백기 챌린지</em></h1>
      <p>머리부터 양손까지 화면에 나오도록 서 주세요.<br>카메라를 연결하면 내 움직임이 게임이 됩니다.</p>
      <button id="register" class="primary">참가 정보 입력 <span>→</span></button>
      <p id="participant-status" hidden></p>
      <button id="connect" class="primary" hidden>카메라 연결하기 <span>↗</span></button>
      <small>카메라 영상은 이 브라우저 안에서만 처리됩니다.</small>
    </div>
    <section id="command-panel" class="command-panel" hidden>
      <div id="level" class="eyebrow">READY TO PLAY</div>
      <h2 id="command">양팔을 올리면 시작해요</h2>
      <p id="hint">양팔을 올리고 3초 동안 유지해 주세요.</p>
      <div id="auto-countdown" role="status" aria-live="polite" hidden></div>
      <div class="round-track"><div id="round-progress"></div></div>
      <div id="feedback" role="status" aria-live="polite"></div>
      <button id="start" class="primary" disabled>버튼으로 바로 시작 <span>→</span></button>
      <p id="start-note" class="start-note">2분 동안 도전 · 점수가 올라가도 시간은 그대로</p>
    </section>
  </section>
  <div class="arm-label arm-white">${flag('white')}<div><span>왼팔 · 백기</span><strong id="white-state">인식 대기</strong></div></div>
  <div class="arm-label arm-blue">${flag('blue')}<div><span>오른팔 · 청기</span><strong id="blue-state">인식 대기</strong></div></div>
  <footer class="bottom-bar">
    <div id="camera-status" role="status">카메라 연결 대기 중</div>
    <div class="controls">
      <label class="duration-control">게임 시간 <input id="duration-seconds" type="number" min="10" max="600" step="1" value="120" aria-label="게임 시간(초)"> 초</label>
      <button id="open-leaderboard" class="text-button">리더보드</button>
      <button id="change-participant" class="text-button">참가자 변경</button>
      <button id="skeleton" class="text-button" aria-pressed="true">관절 표시 ON</button>
      <button id="disconnect" class="text-button" hidden>카메라 끄기</button>
      <button id="stop" class="text-button stop-button" hidden>게임 종료</button>
    </div>
  </footer>
</main>
<dialog id="result"><div class="eyebrow">CHALLENGE COMPLETE</div><h2>멋진 움직임이었어요!</h2><p>당신의 청기백기 도전 결과</p><strong id="final-score"></strong><div id="final-detail"></div><p id="final-record"></p><p id="save-status" role="status"></p><button id="retry-save" class="text-button" hidden>기록 저장 재시도</button><button id="result-leaderboard" class="text-button">리더보드 보기</button><button id="again" class="primary">같은 참가자 다시 도전 →</button><button id="next-participant" class="text-button">다음 참가자</button><button id="close-result" class="text-button">결과 닫기</button></dialog>
<dialog id="registration" class="registration-dialog">
 <div class="eyebrow">PLAYER REGISTRATION</div><h2>참가 정보를 입력해 주세요</h2>
 <form id="participant-form" autocomplete="off">
  <label>이름<input name="name" autocomplete="off" required maxlength="30" placeholder="이름"></label>
  <label>학번<input name="studentId" autocomplete="off" required minlength="3" maxlength="30" pattern="[A-Za-z0-9-]{3,30}" placeholder="학번" inputmode="numeric"></label>
  <label>학과<input name="department" autocomplete="off" required maxlength="80" placeholder="학과"></label>
  <label>전화번호<input name="phone" autocomplete="off" type="tel" required maxlength="22" placeholder="010-0000-0000"></label>
  <p class="data-note">입력한 정보와 게임 기록은 게임 참가·기록 관리 및 기프티콘 지급을 위해 이 PC에 저장합니다. 리더보드에는 이름·학과·점수·정확도만 표시합니다.</p>
  <p id="registration-error" role="alert"></p>
  <button id="submit-participant" class="primary" type="submit">입력 완료</button>
  <button id="cancel-registration" class="text-button" type="button">닫기</button>
 </form>
</dialog>
<dialog id="leaderboard" class="leaderboard-dialog">
 <div class="eyebrow">LEADERBOARD</div><h2>청기백기 리더보드</h2><p>학번별 최고 점수 TOP 20 · 동점이면 정확도 순</p>
 <p id="leaderboard-status" role="status"></p>
 <div class="ranking-scroll"><table class="ranking-table"><thead><tr><th>순위</th><th>이름</th><th>학과</th><th>점수</th><th>정확도</th></tr></thead><tbody id="leaderboard-rows"></tbody></table></div>
 <button id="refresh-leaderboard" class="text-button">새로고침</button><button id="close-leaderboard" class="text-button">닫기</button>
</dialog>`;

const $ = s => document.querySelector(s);
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');
const game = new GameSession();
const autoStart = new AutoStartGesture();
let countdown=null, lastGestureAt=-Infinity;
let detector, stream, frameId, lastVideoTime = -1, detecting = false, showSkeleton = true, tickId;
let arms = {blue:'unknown',white:'unknown'}, visible = false;
let bestScore = 0, startingBest = 0;
let participant = null, pendingStart = false, pendingScore = null, savingScore = false;
let currentRunId = null;
let selectedDuration = 120;
let previewTime = true;
try {const saved=Number(localStorage.getItem('flag-duration-seconds'));if(Number.isInteger(saved)&&saved>=10&&saved<=600)selectedDuration=saved;}catch{}
$('#duration-seconds').value=String(selectedDuration);
const stateNames = {up:'올림 ↑',down:'내림 ↓',middle:'움직이는 중',unknown:'인식 대기'};
function setStatus(text) { $('#camera-status').textContent = text; }
function setText(selector, text) { const el = $(selector); if (el.textContent !== text) el.textContent = text; }

async function connect() {
  $('#connect').disabled = true;
  $('#connect').textContent = '카메라와 AI 준비 중…';
  let stage = 'camera';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS 또는 localhost에서 카메라를 사용할 수 있습니다.');
    stream = await openCamera(navigator.mediaDevices);
    video.srcObject = stream;
    await video.play();
    stage = 'model';
    if (!detector) {
      setStatus('AI 자세 인식 모델을 불러오는 중…');
      const vision = await FilesetResolver.forVisionTasks('/wasm');
      detector = await PoseLandmarker.createFromOptions(vision, {
        baseOptions:{modelAssetPath:import.meta.env.VITE_POSE_MODEL_URL || 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},
        runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6
      });
    }
    $('#camera-placeholder').hidden = true;
    $('#command-panel').hidden = false;
    $('#disconnect').hidden = false;
    stream.getVideoTracks()[0].addEventListener('ended', disconnect, {once:true});
    detecting = true; lastVideoTime = -1; detect();
  } catch(error) {
    console.error(`Camera connection failed (${stage}):`, error.name, error.message);
    disconnect();
    const messages = {NotAllowedError:'브라우저 또는 Windows에서 카메라 접근이 차단되었습니다. 권한을 이미 허용했다면 Chrome이나 Edge에서 이 주소를 열어 주세요.',NotFoundError:'연결된 카메라가 없습니다. 웹캠을 연결해 주세요.',NotReadableError:'카메라 영상을 열지 못했습니다. 다른 카메라 사용 창을 닫고 재시도하거나 Chrome / Edge에서 열어 주세요.'};
    setStatus(stage === 'camera' && messages[error.name] || `연결 실패: ${error.message}`);
  } finally { $('#connect').disabled = false; $('#connect').innerHTML = '카메라 연결하기 <span>↗</span>'; }
}
function disconnect() {
  cancelAutoStart();
  detecting = false; cancelAnimationFrame(frameId);
  const old = stream; stream = null;
  old?.getTracks().forEach(t=>t.stop()); video.srcObject = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  visible = false; arms = {blue:'unknown',white:'unknown'};
  game.observe(arms, performance.now()); updateArms();
  $('#camera-placeholder').hidden = false; $('#command-panel').hidden = true; $('#disconnect').hidden = true;
  setStatus(game.playing ? '카메라 연결 끊김 · 타이머는 계속 진행됩니다' : '카메라 연결 대기 중');
  renderGame();
}
function updateArms() {
  for (const key of ['blue','white']) setText(`#${key}-state`, stateNames[arms[key]]);
  $('#start').disabled = !visible || !['up','down'].includes(arms.blue) || !['up','down'].includes(arms.white);
}
function detect() {
  if (!detecting) return;
  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = detector.detectForVideo(video, performance.now());
      const points = result.landmarks[0];
      arms = readArms(points);
      visible = arms.blue !== 'unknown' && arms.white !== 'unknown';
      game.observe(arms, performance.now()); updateArms();
      updateAutoStart(performance.now());
      setStatus(visible ? 'LIVE · 양팔 인식 중' : '양쪽 어깨와 손목이 보이도록 위치를 조정해 주세요');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      if (showSkeleton && points) drawPose(points);
    }
  } catch (error) { disconnect(); setStatus(`동작 인식 오류: ${error.message}. 카메라를 다시 연결해 주세요.`); return; }
  frameId = requestAnimationFrame(detect);
}
function drawPose(points) {
  for (const [indexes,color] of [[[12,14,16],'#659aff'],[[11,13,15],'#ffffff']]) {
    const pts=indexes.map(i=>points[i]);
    if (!pts.every(p=>p.visibility >= .6)) continue;
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=7;ctx.lineCap='round';
    ctx.beginPath(); pts.forEach((p,i)=>i ? ctx.lineTo(p.x*canvas.width,p.y*canvas.height) : ctx.moveTo(p.x*canvas.width,p.y*canvas.height));ctx.stroke();
    pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,9,0,2*Math.PI);ctx.fill();});
  }
}
function renderGame(now = performance.now()) {
  const remaining = previewTime ? selectedDuration : game.remaining(now);
  setText('#timer-label',`남은 시간 · ${game.playing ? game.durationSeconds : selectedDuration}초 도전`);
  $('#duration-seconds').disabled=game.playing;
  setText('#start-note',`${selectedDuration}초 동안 도전 · 점수가 올라가도 시간은 그대로`);
  setText('#time', `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`);
  setText('#score', `${game.score}점`);
  setText('#combo', `${game.combo}회`);
  if (game.durationSeconds === selectedDuration && game.score > bestScore) {
    bestScore = game.score;
  }
  setText('#best-score', bestScore.toLocaleString());
  setText('#record-note', bestScore > startingBest && game.score === bestScore ? '최고 기록 갱신!' : '현장 최고 기록');
  $('#start').hidden = game.playing;
  $('#start-note').hidden = game.playing;
  $('#stop').hidden = !game.playing;
  $('#change-participant').disabled = game.playing || !!pendingScore;
  $('.timer').classList.toggle('urgent', remaining <= 15);
  $('#session-progress').style.width = `${remaining/(previewTime?selectedDuration:game.durationSeconds)*100}%`;
  $('.arena').classList.toggle('playing', game.playing);
  $('#command-panel').classList.toggle('success', game.phase === 'feedback' && game.lastSuccess);
  $('#command-panel').classList.toggle('miss', game.phase === 'feedback' && !game.lastSuccess);
  const active = ['command','feedback'].includes(game.phase);
  setText('#level', game.playing ? `LEVEL ${Math.floor(Math.max(0,game.round-1)/5)+1} · ${game.round}번째 지시` : 'READY TO PLAY');
  setText('#command', active ? game.command.text : game.playing ? '양팔 위치를 확인하고 있어요' : countdown!==null ? '양팔을 올린 채 유지하세요' : '양팔을 올리면 시작해요');
  setText('#hint', active ? '지시가 나온 뒤 팔을 움직이고, 0.35초 유지하세요' : game.playing ? '양팔을 올리거나 내린 자세로 잠깐 유지해 주세요' : autoStart.locked ? '양팔을 한번 내린 뒤 다시 올리면 3초 후 시작합니다' : '양팔을 올리고 3초 유지하면 자동으로 시작합니다');
  $('#auto-countdown').hidden=countdown===null || game.playing;
  setText('#auto-countdown',countdown===null?'':String(countdown));
  setText('#feedback', game.phase === 'feedback' ? game.lastSuccess ? '✓ 성공! 잘했어요' : '시간 초과 · 다음 동작에 도전해요' : '');
  $('#round-progress').style.width = `${game.phase === 'command' ? Math.max(0,(game.roundEnd-now)/(roundDuration(game.round-1)*1000)*100) : 0}%`;
}
function cancelAutoStart() {autoStart.reset();countdown=null;}
function updateAutoStart(now) {
  lastGestureAt=now;
  const eligible=!!participant && !!stream && !game.playing && !pendingScore && !document.hidden && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input,select,textarea');
  const next=autoStart.update(arms,now,eligible);
  if(next===0){countdown=null;start();return;}
  if(next!==countdown){countdown=next;renderGame(now);}
}
function start() {
  if (!participant) { openRegistration(true); return; }
  if (pendingScore) { $('#result').showModal(); return; }
  if (!stream || !visible || $('#start').disabled || document.hidden) return;
  if (game.playing) return;
  startingBest = bestScore;
  if (!game.start(performance.now(),selectedDuration)) return;
  autoStart.lock();countdown=null;
  previewTime=false;
  currentRunId = crypto.randomUUID();
  $('#result').close();
  clearInterval(tickId); tickId = setInterval(tick,30); renderGame();
}
function tick() {
  game.tick(performance.now()); renderGame();
  if (game.phase === 'finished') showResults();
}
function finish() {
  if (!game.playing) return;
  game.finish(performance.now()); renderGame(); showResults();
}
function showResults() {
  autoStart.lock();countdown=null;
  clearInterval(tickId);
  setText('#final-score', `${game.score.toLocaleString()}점`);
  setText('#final-detail', `성공 ${game.successes}회 · 시간 초과 ${game.misses}회 · 정확도 ${game.successes+game.misses ? Math.round(game.successes/(game.successes+game.misses)*100) : 0}%`);
  setText('#final-record', game.score > startingBest ? '새로운 최고 기록을 세웠어요!' : `최고 기록 ${bestScore.toLocaleString()}점`);
  if (!$('#result').open) $('#result').showModal();
  if(currentRunId && participant && !pendingScore) {
    pendingScore = {token:participant.token,runId:currentRunId,score:game.score,successes:game.successes,misses:game.misses,durationSeconds:game.durationSeconds};
    currentRunId = null;
    void saveScore();
  }
}
async function api(path, data) {
  const response = await fetch(path, {method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
  let body;
  try {body = await response.json();} catch {throw new Error('기록 서버에 연결할 수 없습니다. 게임 실행 파일로 서버를 다시 열어 주세요.');}
  if(!response.ok)throw new Error(body.error || '요청을 처리하지 못했습니다.');
  return body;
}
function openRegistration(startAfter = false) {
  if(game.playing || pendingScore)return;
  pendingStart = startAfter;
  cancelAutoStart();
  $('#participant-form').reset();
  setText('#registration-error','');
  $('#registration').showModal();
}
async function registerParticipant(event) {
  event.preventDefault();
  const form = $('#participant-form');
  if(!form.reportValidity())return;
  $('#submit-participant').disabled=true;
  setText('#registration-error','');
  try {
    participant = await api('/api/participants',Object.fromEntries(new FormData(form)));
    form.reset();$('#registration').close();
    $('#register').hidden=true;$('#connect').hidden=false;$('#participant-status').hidden=false;
    setText('#participant-status',`${participant.name}님 · ${participant.department}`);
    if(pendingStart)start();
  } catch(error) {setText('#registration-error',error.message);}
  finally {$('#submit-participant').disabled=false;pendingStart=false;}
}
async function saveScore() {
  if(!pendingScore || savingScore)return;
  savingScore=true;
  $('#retry-save').hidden=true;
  $('#again').disabled=true;$('#next-participant').disabled=true;
  setText('#save-status','리더보드에 기록을 저장하고 있어요…');
  try {
    await api('/api/scores',pendingScore);
    pendingScore=null;
    setText('#save-status','리더보드에 기록을 저장했습니다.');
  } catch(error) {setText('#save-status',`기록 저장 실패: ${error.message}`);$('#retry-save').hidden=false;}
  finally {savingScore=false;$('#again').disabled=!!pendingScore;$('#next-participant').disabled=!!pendingScore;}
}
async function loadLeaderboard() {
  setText('#leaderboard-status','기록을 불러오는 중…');
  $('#leaderboard-rows').replaceChildren();
  try {
    const {entries} = await api(`/api/leaderboard?durationSeconds=${selectedDuration}`);
    bestScore=Math.max(bestScore,entries[0]?.score || 0);renderGame();
    for(const row of entries) {
      const tr=document.createElement('tr');
      for(const value of [row.rank,row.name,row.department,`${row.score.toLocaleString()}점`,`${row.accuracy}%`]) {const td=document.createElement('td');td.textContent=String(value);tr.append(td);}
      $('#leaderboard-rows').append(tr);
    }
    setText('#leaderboard-status',entries.length?'':'아직 등록된 기록이 없습니다. 첫 기록에 도전해 보세요!');
  } catch(error) {setText('#leaderboard-status',error.message);}
}
function openLeaderboard() {cancelAutoStart();$('#leaderboard').showModal();$('#leaderboard>p').textContent=`${selectedDuration}초 경기 · 학번별 최고 점수 TOP 20 · 동점이면 정확도 순`;void loadLeaderboard();}
function nextParticipant() {
  if(game.playing || pendingScore)return;
  participant=null;
  autoStart.arm();cancelAutoStart();
  previewTime=true;
  $('#result').close();
  $('#register').hidden=false;$('#connect').hidden=true;$('#participant-status').hidden=true;
  openRegistration();
}
$('#connect').onclick=connect; $('#start').onclick=start; $('#stop').onclick=finish;
$('#register').onclick=()=>openRegistration();
$('#participant-form').onsubmit=registerParticipant;
$('#cancel-registration').onclick=()=>$('#registration').close();
$('#change-participant').onclick=nextParticipant;$('#next-participant').onclick=nextParticipant;
$('#retry-save').onclick=()=>void saveScore();
$('#open-leaderboard').onclick=openLeaderboard;$('#result-leaderboard').onclick=openLeaderboard;
$('#refresh-leaderboard').onclick=()=>void loadLeaderboard();
$('#close-leaderboard').onclick=()=>$('#leaderboard').close();
$('#disconnect').onclick=disconnect;
$('#again').onclick=()=>{ $('#result').close(); start(); };
$('#close-result').onclick=()=>$('#result').close();
$('#skeleton').onclick=()=>{showSkeleton=!showSkeleton;setText('#skeleton',`관절 표시 ${showSkeleton?'ON':'OFF'}`);$('#skeleton').setAttribute('aria-pressed',String(showSkeleton));if(!showSkeleton)ctx.clearRect(0,0,canvas.width,canvas.height);};
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAutoStart();renderGame();}else if(game.playing)tick();});
setInterval(()=>{if(countdown!==null && performance.now()-lastGestureAt>=300){cancelAutoStart();renderGame();}},100);
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());});
renderGame();
async function refreshBest() {
  const duration=selectedDuration;
  try {const {entries}=await api(`/api/leaderboard?durationSeconds=${duration}`);if(duration===selectedDuration){bestScore=Math.max(game.playing?game.score:0,entries[0]?.score || 0);renderGame();}}catch{}
}
$('#duration-seconds').onchange=()=>{
  const input=$('#duration-seconds');if(game.playing || !input.reportValidity()) {input.value=String(selectedDuration);return;}
  selectedDuration=Number(input.value);bestScore=0;startingBest=0;previewTime=true;
  cancelAutoStart();
  try{localStorage.setItem('flag-duration-seconds',String(selectedDuration));}catch{}
  renderGame();void refreshBest();
};
void refreshBest();
