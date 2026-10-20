import './style.css';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { TOTAL_SECONDS, readArms, matches, nextCommand, roundDuration } from './game.js';
const flag = (color) => `<span class="flag ${color}"><i></i></span>`;
document.querySelector('#app').innerHTML = `
<header><a class="brand" href="/">${flag('blue')} 청기백기<span>AI MOTION PLAY</span></a><span class="event"><b></b> OPEN LAB · AI 체험 부스</span></header>
<main><section class="intro"><div class="eyebrow">MOVE YOUR ARMS, MEET AI</div><h1>두 팔로 즐기는,<br><span>청기백기 챌린지.</span></h1><p>화면의 지시에 맞춰 팔을 움직여 보세요.<br>AI가 당신의 움직임을 읽고, 함께 플레이합니다.</p></section>
<div class="play-layout"><section class="camera-card"><div class="card-top"><span><b class="live-dot"></b> LIVE CAMERA</span><button id="skeleton" class="text-button" aria-pressed="true">관절 표시 ON</button></div><div class="camera-view"><video autoplay playsinline muted></video><canvas></canvas><div id="camera-placeholder"><div class="camera-icon">◎</div><h2>카메라 앞에 서 주세요</h2><p>머리부터 양손까지 화면에 나오도록<br>카메라와 조금 떨어져 서 주세요.</p><button id="connect" class="primary">카메라 연결하기 <span>↗</span></button><small>카메라 사용 권한을 허용해 주세요</small></div><div id="camera-status" role="status">카메라 연결 대기 중</div><div class="arm-label left">${flag('blue')} 오른팔 · 청기</div><div class="arm-label right">${flag('white')} 왼팔 · 백기</div></div><div class="arm-states"><div><span class="blue-dot"></span> 청기 <strong id="blue-state">인식 대기</strong></div><div><span class="white-dot"></span> 백기 <strong id="white-state">인식 대기</strong></div></div><p class="privacy">♧ 영상은 브라우저 안에서만 처리되며 저장·전송되지 않습니다.</p></section>
<aside><section class="game-card"><div class="section-label">YOUR CHALLENGE <span id="level">READY</span></div><div id="command-panel"><div class="mini-flags">${flag('blue')}${flag('white')}</div><h2 id="command">준비되셨나요?</h2><p id="hint">카메라를 연결하고 양팔 인식을 확인해 주세요.</p></div><div class="progress"><div id="round-progress"></div></div><div class="stats"><div><span>점수</span><strong id="score">0<small>점</small></strong></div><div><span>남은 시간</span><strong id="time">2:00</strong></div><div><span>연속 성공</span><strong id="combo">0<small>회</small></strong></div></div><button id="start" class="primary" disabled>게임 시작 <span>→</span></button><button id="stop" class="text-button" hidden>게임 종료</button><p class="game-note">2분 도전 · 뒤로 갈수록 더 빠르게!</p><div id="feedback" aria-live="polite"></div></section><section class="how-card"><div class="section-label">HOW TO PLAY</div><ol><li><b>01</b><div><strong>양팔이 깃발이 됩니다</strong><p>오른팔은 청기, 왼팔은 백기예요.</p></div></li><li><b>02</b><div><strong>지시대로 올리고, 내리고</strong><p>손목을 어깨 위로 올리거나 아래로 내려요.</p></div></li><li><b>03</b><div><strong>정확하게, 빠르게 도전!</strong><p>자세를 잠깐 유지하면 성공. 연속 성공은 보너스!</p></div></li></ol></section></aside></div>
<section class="bottom-note"><span>✦</span><div><strong>AI는 어떻게 움직임을 알아볼까요?</strong><p>어깨·팔꿈치·손목의 위치를 찾아, 손목이 어깨보다 위에 있는지 아래에 있는지 비교해요.</p></div><span class="tech">POSE ESTIMATION</span></section></main><footer><span>OPEN LAB <b>×</b> AI EXPERIENCE</span><span>작은 움직임으로 만나는 인공지능</span><button id="disconnect" class="text-button" hidden>카메라 끄기</button></footer>
<dialog id="result"><div class="eyebrow">CHALLENGE COMPLETE</div><h2>멋진 움직임이었어요!</h2><p>당신의 청기백기 도전 결과</p><strong id="final-score"></strong><div id="final-detail"></div><p>AI는 관절의 좌표를 비교해서<br>당신의 팔 동작을 게임 입력으로 바꿨어요.</p><button id="again" class="primary">다시 도전하기 →</button></dialog>`;
const $ = s => document.querySelector(s);
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');
let detector, stream, frameId, lastVideoTime = -1, detecting = false, showSkeleton = true;
let arms = {blue:'unknown',white:'unknown'}, visible = false, playing = false;
let command, round = 0, score = 0, combo = 0, successes = 0, misses = 0;
let gameEnd = 0, roundEnd = 0, holdSince = 0, nextAt = 0, lastPose = 0, tickId;
const stateNames = {up:'올림 ↑',down:'내림 ↓',middle:'움직이는 중',unknown:'인식 대기'};
function setStatus(text) { $('#camera-status').textContent = text; }
async function connect() {
  $('#connect').disabled = true;
  $('#connect').textContent = '카메라와 AI 준비 중…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('HTTPS 또는 localhost에서 카메라를 사용할 수 있습니다.');
    stream = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'},audio:false});
    video.srcObject = stream;
    await video.play();
    if (!detector) {
      setStatus('AI 자세 인식 모델을 불러오는 중…');
      const vision = await FilesetResolver.forVisionTasks('/wasm');
      // A downloaded local model can be configured with VITE_POSE_MODEL_URL.
      detector = await PoseLandmarker.createFromOptions(vision, {
        baseOptions:{modelAssetPath:import.meta.env.VITE_POSE_MODEL_URL || 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',delegate:'CPU'},
        runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,minTrackingConfidence:.6
      });
    }
    $('#camera-placeholder').hidden = true;
    $('#disconnect').hidden = false;
    stream.getVideoTracks()[0].addEventListener('ended', disconnect, {once:true});
    detecting = true; lastVideoTime = -1; detect();
  } catch(error) {
    disconnect();
    const messages = {NotAllowedError:'카메라 권한이 필요합니다. 브라우저 주소창에서 카메라를 허용한 뒤 다시 연결해 주세요.',NotFoundError:'연결된 카메라가 없습니다. 웹캠을 연결해 주세요.',NotReadableError:'카메라를 사용할 수 없습니다. 다른 앱의 카메라 사용을 종료해 주세요.'};
    setStatus(messages[error.name] || `연결 실패: ${error.message}. 네트워크와 모델 파일 접근을 확인해 주세요.`);
  } finally { $('#connect').disabled = false; $('#connect').innerHTML = '카메라 연결하기 <span>↗</span>'; }
}
function disconnect() {
  detecting = false; cancelAnimationFrame(frameId);
  if (playing) finish();
  const old = stream; stream = null;
  old?.getTracks().forEach(t=>t.stop()); video.srcObject = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  visible = false; arms = {blue:'unknown',white:'unknown'}; updateArms();
  $('#camera-placeholder').hidden = false; $('#disconnect').hidden = true;
  $('#start').disabled = true; setStatus('카메라 연결 대기 중');
}
function updateArms() { for (const key of ['blue','white']) $(`#${key}-state`).textContent = stateNames[arms[key]]; }
function detect() {
  if (!detecting) return;
  try {
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = detector.detectForVideo(video, performance.now());
      const points = result.landmarks[0];
      arms = readArms(points); lastPose = performance.now();
      visible = arms.blue !== 'unknown' && arms.white !== 'unknown';
      updateArms(); $('#start').disabled = playing || !visible;
      setStatus(visible ? '인식 중 · 양팔이 잘 보여요' : '양쪽 어깨와 손목이 보이도록 위치를 조정해 주세요');
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
function newRound(now) {
  command = nextCommand(round,command); round++;
  roundEnd = now + roundDuration(round-1)*1000; nextAt=0;holdSince=0;
  $('#command').textContent=command.text;
  $('#hint').textContent='지시한 자세를 0.35초 동안 유지해 주세요';
  $('#level').textContent=`LEVEL ${Math.floor((round-1)/5)+1}`;
  $('#feedback').textContent='';
  $('#command-panel').className='';
}
function start() {
  if (!visible || !stream || document.hidden) return;
  $('#result').close(); playing=true;round=score=combo=successes=misses=0;command=null;
  gameEnd=performance.now()+TOTAL_SECONDS*1000;
  $('#start').hidden=true;$('#stop').hidden=false;
  newRound(performance.now()); updateStats(); tickId=setInterval(tick,30);
}
function updateStats() {
  $('#score').innerHTML=`${score}<small>점</small>`;
  $('#combo').innerHTML=`${combo}<small>회</small>`;
}
function settle(success,now) {
  if(success){successes++;combo++;score+=100+Math.min(combo-1,10)*10;}else{misses++;combo=0;}
  updateStats();nextAt=now+850;holdSince=0;
  $('#feedback').textContent=success?'✓ 성공! 잘했어요':'시간 초과 · 다음 지시에 도전해요';
  $('#command-panel').className=success?'success':'miss';
}
function tick() {
  if (!playing) return;
  const now=performance.now(), remaining=Math.max(0,Math.ceil((gameEnd-now)/1000));
  $('#time').textContent=`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  if(now>=gameEnd){finish();return;}
  if(nextAt){if(now>=nextAt)newRound(now);return;}
  $('#round-progress').style.width=`${Math.max(0,(roundEnd-now)/(roundDuration(round-1)*1000)*100)}%`;
  if(now>=roundEnd){settle(false,now);return;}
  if(visible && now-lastPose<300 && matches(command,arms)) {
    if(!holdSince)holdSince=now;
    if(now-holdSince>=350)settle(true,now);
  }else holdSince=0;
}
function finish() {
  playing=false;clearInterval(tickId);$('#start').hidden=false;$('#start').disabled=!visible;$('#stop').hidden=true;
  $('#command').textContent='한 번 더 도전할까요?';$('#hint').textContent='준비되면 게임 시작을 눌러 주세요.';$('#level').textContent='FINISHED';
  $('#final-score').textContent=`${score.toLocaleString()}점`;
  $('#final-detail').textContent=`성공 ${successes}회 · 시간 초과 ${misses}회 · 정확도 ${successes+misses ? Math.round(successes/(successes+misses)*100) : 0}%`;
  $('#result').showModal();
}
$('#connect').onclick=connect;$('#start').onclick=start;$('#stop').onclick=finish;
$('#disconnect').onclick=disconnect;
$('#again').onclick=()=>{$('#result').close();if(visible)start();};
$('#skeleton').onclick=()=>{showSkeleton=!showSkeleton;$('#skeleton').textContent=`관절 표시 ${showSkeleton?'ON':'OFF'}`;$('#skeleton').setAttribute('aria-pressed',String(showSkeleton));};
document.addEventListener('visibilitychange',()=>{if(document.hidden && playing)finish();});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());});
