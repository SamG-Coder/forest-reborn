import {showSpeech} from './speech-bubbles.js';

/** Nearby guard lines queue rather than interrupting one another mid-word. */
export class GuardSpeech {
  constructor({voices,player,living}){Object.assign(this,{voices,player,living});this.queue=[];}
  update(now=Date.now()){
    for(const event of this.living.speechEvents.splice(0)){
      if(now-event.now>15000||event.person.position.distanceTo(this.player.position)>38)continue;
      showSpeech(event.person,event.text,now);
      if(this.queue.some(e=>e.person===event.person&&e.text===event.text))continue;
      this.queue.push(event);
    }
    this.queue=this.queue.filter(e=>now-e.now<20000&&e.person.target.hp>0&&!e.person.dormant&&e.person.position.distanceTo(this.player.position)<42).slice(-8);
    if(this.voices.muted){this.queue.length=0;return;}
    if(['guard','dialogue','cinematic','preview'].some(channel=>this.voices.busy(channel)))return;
    this.queue.sort((a,b)=>Number(b.subjectId==='player')-Number(a.subjectId==='player')||a.now-b.now);
    const event=this.queue.shift();if(!event)return;
    this.voices.speak(event.person,event.text,{channel:'guard',volume:.9,maxDelay:20000});
  }
}
