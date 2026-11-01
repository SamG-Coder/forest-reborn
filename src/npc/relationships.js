import {removeItem} from '../progression/inventory.js';

const keyFor=(a,b)=>[String(a),String(b)].sort().join('|');
const FAVOURS={
  hunter:{kind:'kill',target:'goblin',count:3,offer:'Three goblins have been hanging around the grove. Help clear them and I’ll know I can count on you.'},
  explorer:{kind:'kill',target:'bandit',count:2,offer:'I need the eastern road clear. Deal with two bandits and we can talk about travelling together.'},
  miner:{kind:'item',target:'iron',count:3,offer:'I’m short three pieces of iron ore. Bring them over and I’ll owe you one.'},
  woodcutter:{kind:'item',target:'wood',count:3,offer:'Could use three lengths of timber for a repair. Bring those and I’ll help you out sometime.'},
  trader:{kind:'item',target:'wovenCloth',count:1,offer:'I need a piece of wool cloth, properly woven. Do that for me and we’ll have made a start.'},
  herbalist:{kind:'item',target:'herbs',count:4,offer:'Four bundles of herbs would save me a trip. Fresh ones, if you can find them.'},
};

/** Contacts are separate from this persistent, mutual relationship ledger. */
export class Relationships{
  constructor(saved={}){this.bonds=saved.bonds??{};this.favours=saved.favours??{};this.nextSocialAt=saved.nextSocialAt??0;}
  bond(a,b){return this.bonds[keyFor(a,b)]??={trust:0,lastChatAt:0,lastTradeAt:0};}
  trust(a,b){return this.bond(a,b).trust;}
  improve(a,b,amount){const bond=this.bond(a,b);bond.trust=Math.min(100,Math.max(0,bond.trust+amount));return bond.trust;}
  label(a,b){const score=this.trust(a,b);return score>=60?'Close friend':score>=26?'Trusted companion':score>=12?'Acquaintance':'Just met';}
  chat(actor,now){
    const bond=this.bond('player',actor.id);
    if(bond.lastChatAt&&now-bond.lastChatAt<60000)return 'Give me a bit. We were just talking.';
    bond.lastChatAt=now;this.improve('player',actor.id,4);
    return {hunter:'I like the quiet before a hunt. The bit after depends on how it went.',miner:'You can hear a bad seam before you see it. Took me a while to learn that.',woodcutter:'A sharp axe does half the work. I wish someone had told me that sooner.',trader:'I remember who pays fairly. Makes the next deal easier.',explorer:'There’s a road past the ridge I haven’t tried yet. One of these mornings.',herbalist:'Most people step right over what they’re looking for.'}[actor.personality.role];
  }
  offer(actor){return FAVOURS[actor.personality.role]??FAVOURS.herbalist;}
  accept(actor){
    if(this.favours[actor.id])return false;
    this.favours[actor.id]={...this.offer(actor),progress:0,status:'active'};return true;
  }
  recordKill(kind){for(const favour of Object.values(this.favours))if(favour.status==='active'&&favour.kind==='kill'&&favour.target===kind)favour.progress=Math.min(favour.count,favour.progress+1);}
  complete(actor,progress){
    const favour=this.favours[actor.id];if(!favour||favour.status!=='active')return false;
    if(favour.kind==='item'){
      if(!progress.hasItem(favour.target,favour.count))return false;
      progress.data.bag=removeItem(progress.data.bag,favour.target,favour.count);
      actor.inventory[favour.target]=(actor.inventory[favour.target]??0)+favour.count;
    }else if(favour.progress<favour.count)return false;
    favour.status='completed';this.improve('player',actor.id,24);progress.save();return true;
  }
  socialise(actors,now){
    if(now<this.nextSocialAt)return;this.nextSocialAt=now+12000;
    for(let i=0;i<actors.length;i++)for(let j=0;j<i;j++){
      const a=actors[i],b=actors[j];if(!a.position||!b.position||a.health<=0||b.health<=0||a.pvp?.enabled||b.pvp?.enabled)continue;
      if(Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])>5)continue;
      if(!/rest|tavern|sell|gather/.test(a.task)||!/rest|tavern|sell|gather/.test(b.task))continue;
      this.improve(a.id,b.id,3);
      const bond=this.bond(a.id,b.id),wanted=this.offer(a).target;
      if(now-bond.lastTradeAt>60000&&(b.inventory[wanted]??0)>3){
        b.inventory[wanted]--;a.inventory[wanted]=(a.inventory[wanted]??0)+1;bond.lastTradeAt=now;this.improve(a.id,b.id,5);
      }
    }
  }
  snapshot(){return {bonds:this.bonds,favours:this.favours,nextSocialAt:this.nextSocialAt};}
}
