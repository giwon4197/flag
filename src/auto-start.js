export class AutoStartGesture {
  constructor() {this.locked=false;this.reset();}
  reset() {this.since=null;this.lastFrame=null;}
  lock() {this.locked=true;this.reset();}
  arm() {this.locked=false;this.reset();}
  update(arms,now,eligible) {
    if(!eligible) {this.reset();return null;}
    if(this.locked) {
      if(arms.blue==='down' && arms.white==='down')this.locked=false;
      this.reset();return null;
    }
    if(arms.blue!=='up' || arms.white!=='up') {this.reset();return null;}
    if(this.since===null || this.lastFrame===null || now-this.lastFrame>=300)this.since=now;
    this.lastFrame=now;
    const remaining=Math.max(0,Math.ceil((3000-(now-this.since))/1000));
    if(remaining===0)this.lock();
    return remaining;
  }
}
