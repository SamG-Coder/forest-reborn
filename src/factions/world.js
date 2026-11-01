import {FACTIONS,FACTION_IDS,factionFor,standing,changeStanding} from './catalog.js';
import {FactionEconomy} from './economy.js';
import {ThreatMemory} from './threat-memory.js';
import {JobBoard} from './jobs.js';
import {QUESTS} from '../progression/quests.js';

export class FactionWorld {
  constructor(saved={},now=Date.now()){
    this.economy=new FactionEconomy(saved.economy);this.memory=new ThreatMemory(saved.memory);this.jobs=new JobBoard(this.economy,saved.jobs);
    this.flags=saved.flags??{};this.events=saved.events??[];this.updatedAt=Math.min(now,saved.updatedAt??now);this.parties=saved.parties??[];
  }
  bind(progress){this.progress=progress;progress.factions=this;progress.data.reputation??={};this.flags={...this.flags,...progress.data.worldFlags};
    for(const q of QUESTS)if(progress.data.quests[q.id]?.completed)for(const [key,value]of Object.entries(q.worldChanges??{}))if(!(key in this.flags))this.flags[key]=value;
    progress.data.worldFlags=this.flags;
  }
  announce(text,now=Date.now()){this.events.push({text,time:now});this.events=this.events.slice(-40);}
  update(now=Date.now()){
    const dt=Math.min(8*3600,Math.max(0,(now-this.updatedAt)/1000));this.updatedAt=now;this.economy.update(dt,this.flags);this.jobs.expire(now);
  }
  goal(id){const m=this.economy.markets[id],need=this.economy.needs(id)[0];return need?.pressure>1.7?`Gathering ${need.item} for the camp`:id==='woodland'?'Foraging away from hunters':m.training<20?'Training and repairing equipment':FACTIONS[id].goal;}
  assign(target){target.factionId??=factionFor(target);target.baseLevel??=target.level;target.baseMaxHp??=target.maxHp;return target;}
  hostile(target){const id=target.factionId??factionFor(target);if(id==='woodland')return false;if(id==='briar'&&this.flags.briarTruce)return standing(this.progress?.data.reputation,id)<0;return standing(this.progress?.data.reputation,id)<20;}
  harm(target,attacker,now=Date.now()){this.assign(target);this.memory.harm(target,attacker,now);}
  killed(target,attacker,now=Date.now()){
    this.assign(target);this.memory.killed(target,attacker,now);
    if(attacker.id==='player'&&target.factionId!=='woodland'){
      const reputation=this.progress.data.reputation;changeStanding(reputation,target.factionId,-3);
      if(target.factionId==='briar'&&this.flags.briarTruce){this.flags.briarTruce=false;this.announce('The Briar truce has broken. Tikka wants an explanation.',now);}
    }
  }
  applyQuest(quest){
    for(const [id,amount]of Object.entries(quest.reputation??{}))changeStanding(this.progress.data.reputation,id,amount);
    for(const [flag,value]of Object.entries(quest.worldChanges??{}))if(this.flags[flag]!==value){this.flags[flag]=value;this.announce(quest.worldSummary??`${quest.title}: the world has changed.`);}
  }
  organise(actors,now){
    // Small committed companies share a hunt; membership does not reroll every frame.
    this.parties=this.parties.filter(p=>p.until>now);
    const busy=new Set(this.parties.flatMap(p=>p.members)),ready=actors.filter(a=>!busy.has(a.id)&&a.health>65&&a.stamina>40&&a.xp>=240);
    while(ready.length>=3){const members=ready.splice(0,3).map(a=>a.id);this.parties.push({id:`company-${now}-${members[0]}`,members,kind:'ogre',goal:'Clear the quarry together',until:now+300000});}
    for(const actor of actors)actor.company=this.parties.find(p=>p.members.includes(actor.id))?.id??null;
  }
  snapshot(){return {economy:this.economy.snapshot(),memory:this.memory.snapshot(),jobs:this.jobs.snapshot(),flags:this.flags,events:this.events,updatedAt:this.updatedAt,parties:this.parties};}
}
