export const TOTAL_SECONDS = 120;
export function armState(shoulder, elbow, wrist) {
  if (![shoulder, elbow, wrist].every(p => p && (p.visibility ?? 0) >= .6)) return 'unknown';
  if (wrist.y < shoulder.y - .08) return 'up';
  if (wrist.y > shoulder.y + .12) return 'down';
  return 'middle';
}
export function readArms(points) {
  return { blue: armState(points?.[12], points?.[14], points?.[16]), white: armState(points?.[11], points?.[13], points?.[15]) };
}
export function matches(command, arms) {
  return !!command && ['blue', 'white'].every(k => arms[k] !== 'unknown' && (command[k] == null || arms[k] === command[k]));
}
const simple = [
  {text:'청기 올려',blue:'up'}, {text:'청기 내려',blue:'down'},
  {text:'백기 올려',white:'up'}, {text:'백기 내려',white:'down'}
];
const complex = [
  {text:'둘 다 올려',blue:'up',white:'up'}, {text:'둘 다 내려',blue:'down',white:'down'},
  {text:'청기 올리고, 백기 내려',blue:'up',white:'down'},
  {text:'백기 올리고, 청기 내려',blue:'down',white:'up'}
];
export function nextCommand(round, previous, arms, random = Math.random) {
  if (!['blue', 'white'].every(k => ['up', 'down'].includes(arms?.[k]))) return null;
  const pool = (round < 5 ? simple : [...simple,...complex]).filter(c =>
    c.text !== previous?.text &&
    ['blue', 'white'].every(k => c[k] == null || c[k] !== arms[k])
  );
  return {...pool[Math.floor(random()*pool.length)]};
}
export function roundDuration(round) { return Math.max(2, 5 - Math.floor(round / 5) * .5); }

export class GameSession {
  constructor(random = Math.random) {
    this.random = random;
    this.durationSeconds = TOTAL_SECONDS;
    this.playing = false;
    this.phase = 'ready';
    this.round = this.score = this.combo = this.successes = this.misses = 0;
    this.arms = {blue:'unknown',white:'unknown'};
    this.lastPoseAt = -Infinity;
    this.stableSince = null;
  }
  start(now, durationSeconds = TOTAL_SECONDS) {
    if (this.playing) return false;
    if (!Number.isInteger(durationSeconds) || durationSeconds < 10 || durationSeconds > 600) throw new Error('게임 시간은 10~600초로 설정해 주세요.');
    this.durationSeconds = durationSeconds;
    this.playing = true;
    this.phase = 'waiting';
    this.round = this.score = this.combo = this.successes = this.misses = 0;
    this.command = null;
    // The session deadline is set only here, never when a command or record changes.
    this.endAt = now + this.durationSeconds * 1000;
    this.nextAt = now;
    this.holdSince = null;
    this.tick(now);
    return true;
  }
  observe(arms, now) {
    const fresh = now - this.lastPoseAt < 300;
    const definite = ['blue','white'].every(k => ['up','down'].includes(arms[k]));
    if (!definite) this.stableSince = null;
    else if (!fresh || this.stableSince == null || ['blue','white'].some(k => arms[k] !== this.arms[k])) this.stableSince = now;
    this.arms = {...arms};
    this.lastPoseAt = now;
    if (!this.playing) return;
    if (now >= this.endAt) { this.finish(now); return; }
    if (this.phase !== 'command') return;
    if (now >= this.roundEnd) { this.settle(false, now); return; }
    // Observe every instructed arm away from its target after the instruction,
    // then at the target. An already held pose or a cached frame cannot score.
    for (const key of ['blue','white']) {
      if (!this.command[key]) continue;
      if (['up','down'].includes(arms[key]) && arms[key] !== this.command[key]) this.away[key] = true;
      if (this.away[key] && arms[key] === this.command[key]) this.moved[key] = true;
    }
    const moved = ['blue','white'].every(k => !this.command[k] || this.moved[k]);
    if (!fresh || !moved || !matches(this.command, arms)) this.holdSince = null;
    else if (this.holdSince == null) this.holdSince = now;
    else if (now - this.holdSince >= 350) this.settle(true, now);
  }
  tick(now) {
    if (!this.playing) return;
    if (now >= this.endAt) { this.finish(now); return; }
    if (this.phase === 'command') {
      if (now - this.lastPoseAt >= 300) this.holdSince = null;
      if (now >= this.roundEnd) this.settle(false, now);
      return;
    }
    if (now < this.nextAt) return;
    this.phase = 'waiting';
    if (now - this.lastPoseAt >= 300 || this.stableSince == null || now - this.stableSince < 200) return;
    const command = nextCommand(this.round, this.command, this.arms, this.random);
    if (!command) return;
    this.command = command;
    this.roundEnd = now + roundDuration(this.round) * 1000;
    this.round++;
    this.phase = 'command';
    this.away = {blue:false,white:false};
    this.moved = {blue:false,white:false};
    this.holdSince = null;
  }
  settle(success, now) {
    if (!this.playing || this.phase !== 'command') return;
    if (success) {
      this.successes++;
      this.combo++;
      this.score += 100 + Math.min(this.combo - 1, 10) * 10;
    } else { this.misses++; this.combo = 0; }
    this.lastSuccess = success;
    this.phase = 'feedback';
    this.nextAt = now + 850;
    this.holdSince = null;
  }
  finish(now) {
    if (!this.playing) return;
    this.playing = false;
    this.finishedAt = now;
    this.phase = 'finished';
  }
  remaining(now) {
    if (this.endAt == null) return TOTAL_SECONDS;
    return Math.max(0, Math.ceil((this.endAt - (this.playing ? now : this.finishedAt)) / 1000));
  }
}
