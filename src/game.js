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
  return ['blue', 'white'].every(k => arms[k] !== 'unknown' && (command[k] == null || arms[k] === command[k]));
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
export function nextCommand(round, previous, random = Math.random) {
  const pool = (round < 5 ? simple : [...simple,...complex]).filter(c=>c.text !== previous?.text);
  return {...pool[Math.floor(random()*pool.length)]};
}
export function roundDuration(round) { return Math.max(2, 5 - Math.floor(round / 5) * .5); }
