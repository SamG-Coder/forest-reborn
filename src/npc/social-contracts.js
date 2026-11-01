import {QUESTS} from '../progression/quests.js';
import {removeItem} from '../progression/inventory.js';
import {RESOURCE_VALUES} from '../factions/economy.js';
import {localTown} from './directions.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const active=c=>c.status==='active';
const gathering=['herbs','flax','berries','feather'];
const shareable=q=>/^(gather:|craft:|deliver:)/.test(q.kind)||['rabbit','goblin','bandit','ogre','ogreChampion','ashRaider','shieldbreaker','hillGiant'].includes(q.kind);

/** Persistent agreements between the player and an actual adventurer journal.
 * Supply rewards are reserved from a town treasury. Quest rewards still come
 * from each person's own quest giver; an agreement grants no duplicate loot. */
export class SocialContracts {
  constructor(progress,population){
    this.progress=progress;this.population=population;this.sim=population.simulation;
    this.data=progress.data.socialContracts??={sequence:0,agreements:[]};
    this.hits=new WeakMap();this.nextUpdate=0;
  }
  get agreements(){return this.data.agreements;}
  person(id){return this.population.residents.find(p=>p.data?.id===id);}
  journal(id){return this.sim.questAgents?.get(id);}
  activeFor(id){return this.agreements.find(c=>c.partner===id&&active(c));}
  save(){this.progress.save();this.sim.save();}
  refusal(person,now=Date.now()){
    if(!person?.data||!this.journal(person.data.id))return 'I’m not taking on work at the moment.';
    if(person.target.hp<=0||person.threat||person.target.pvp?.enabled)return 'We can talk when it’s safe.';
    if(person.data.journey?.phase!=='quests')return 'Give me a moment to get my bearings first.';
    if(distance(person.position,this.population.living.player.target.position)>3)return 'Come closer so we can talk.';
    if(this.activeFor(person.data.id))return 'Let’s finish the job we already agreed on.';
    if(this.agreements.filter(active).length>=3)return 'You already have three agreements to finish.';
    if(this.agreements.some(c=>c.partner===person.data.id&&c.finishedAt&&now-c.finishedAt<120000))return 'Let me catch my breath before we take another job.';
    return null;
  }
  sharedQuests(person){
    const journal=this.journal(person.data?.id);if(!journal)return [];
    return QUESTS.filter(q=>shareable(q)&&this.progress.state(q)==='active'&&['available','active'].includes(journal.progress.state(q)));
  }
  supplyOffer(person){
    const town=localTown(person);if(!['mosswake','highmere'].includes(town))return null;
    const economy=this.sim.factions.economy,needs=economy.needs(town).filter(n=>gathering.includes(n.item)&&n.count>=3);
    if(needs.length<2)return null;
    const [first,second]=needs,count=3;
    const contribution=need=>({item:need.item,count,pay:Math.max(1,Math.ceil(RESOURCE_VALUES[need.item]*economy.demand(town,need.item)*count*1.1)),delivered:false});
    return {town,player:contribution(first),partner:contribution(second),destination:town==='highmere'?{name:'Highmere market',x:850,z:-850}:{name:'Orin’s market stall',x:10,z:4.2}};
  }
  requestSupply(person,now=Date.now()){
    const reason=this.refusal(person,now);if(reason)return {error:reason};
    if(person.companion)return {error:'Let me leave the travelling party first. I’ll need to fetch my half of the order.'};
    const offer=this.supplyOffer(person);if(!offer)return {error:'The market has enough of what we can gather. Let’s check again later.'};
    const market=this.sim.factions.economy.markets[offer.town],reserve=offer.player.pay+offer.partner.pay;
    if(market.treasury<reserve)return {error:'The market hasn’t set aside enough coin for this order.'};
    market.treasury-=reserve;
    const c={id:`agreement-${++this.data.sequence}`,kind:'supply',partner:person.data.id,name:person.name,status:'active',createdAt:now,expiresAt:now+1200000,town:offer.town,destination:offer.destination,contributions:{player:offer.player,partner:offer.partner}};
    this.agreements.push(c);this.save();return {contract:c};
  }
  requestQuest(person,questId,now=Date.now()){
    const reason=this.refusal(person,now);if(reason)return {error:reason};
    const q=this.sharedQuests(person).find(q=>q.id===questId);if(!q)return {error:'We need to be on the same part of the journey before we can share that quest.'};
    const journal=this.journal(person.data.id),p=journal.progress;
    if(p.state(q)==='available'&&!p.accept(q.id))return {error:'I can’t take that quest yet.'};
    const c={id:`agreement-${++this.data.sequence}`,kind:'quest',partner:person.data.id,name:person.name,questId:q.id,title:q.title,status:'active',createdAt:now,expiresAt:now+1800000,
      baseline:{player:this.progress.data.quests[q.id].count,partner:p.data.quests[q.id].count},helped:{player:false,partner:false}};
    journal.actor.journey.quest=q.id;journal.syncOut();this.agreements.push(c);this.save();return {contract:c};
  }
  deliver(c,side,position,now=Date.now()){
    if(!c||!active(c)||c.kind!=='supply'||now>=c.expiresAt||distance(position,c.destination)>4)return false;
    const contribution=c.contributions[side],journal=this.journal(c.partner),p=side==='player'?this.progress:journal?.progress;
    if(!p||!contribution||contribution.delivered||!p.hasItem(contribution.item,contribution.count))return false;
    p.data.bag=removeItem(p.data.bag,contribution.item,contribution.count);contribution.delivered=true;
    if(side==='partner')journal.syncOut();else p.save();this.finishSupply(c,now);this.save();return true;
  }
  finishSupply(c,now){
    if(!active(c)||!Object.values(c.contributions).every(p=>p.delivered))return;
    const journal=this.journal(c.partner);if(!journal)return;
    for(const [side,contribution]of Object.entries(c.contributions)){
      const p=side==='player'?this.progress:journal.progress;
      p.data.coins+=contribution.pay;p.addSkillXP('trading',contribution.count*2);
      this.sim.factions.economy.receive(c.town,contribution.item,contribution.count);
    }
    journal.syncOut();this.complete(c,14,now);
  }
  complete(c,trust,now){
    c.status='completed';c.finishedAt=now;
    this.sim.society.relationships.improve('player',c.partner,trust);
    const person=this.person(c.partner);if(person)this.sim.record(person.data,'agreement','completed an agreement with you',now);
  }
  cancel(c,now=Date.now(),expired=false){
    if(!c||!active(c))return false;
    if(c.kind==='supply'){
      // Resolve both inventories before refunding either half of the agreement.
      const journal=this.journal(c.partner);
      if(c.contributions.partner.delivered&&!journal)return false;
      for(const [side,part]of Object.entries(c.contributions)){
        if(!part.delivered)continue;
        const p=side==='player'?this.progress:journal.progress;
        if(!p.addItem(part.item,part.count))p.data.overflow.push({id:part.item,count:part.count});
        if(side==='partner')journal.syncOut();
      }
      this.sim.factions.economy.markets[c.town].treasury+=c.contributions.player.pay+c.contributions.partner.pay;
    }
    c.status=expired?'expired':'cancelled';c.finishedAt=now;this.save();return true;
  }
  recordHit(actorId,target){
    if(!this.agreements.some(c=>active(c)&&c.kind==='quest'&&(actorId==='player'||c.partner===actorId)))return;
    let hits=this.hits.get(target);if(!hits)this.hits.set(target,hits=new Map());hits.set(actorId,Date.now());
  }
  recordKill(actorId,target,now=Date.now()){
    const credited=new Set(),hits=this.hits.get(target);this.hits.delete(target);
    for(const c of this.agreements){
      if(!active(c)||c.kind!=='quest'||actorId!=='player'&&actorId!==c.partner)continue;
      const q=QUESTS.find(q=>q.id===c.questId),journal=this.journal(c.partner),person=this.person(c.partner);
      if(!q||q.kind!==target.kind||!journal||!person)continue;
      const other=actorId==='player'?c.partner:'player',p=other==='player'?this.progress:journal.progress;
      const position=other==='player'?this.population.living.player.target.position:person.position;
      // Nearby, active assistance earns objective credit, never duplicate kill loot or XP.
      if(hits?.has(other)&&now-hits.get(other)<15000&&distance(position,target.position)<28&&p.state(q)==='active'){
        p.data.quests[q.id].count=Math.min(q.count,p.data.quests[q.id].count+1);p.save();credited.add(other);
      }
      journal.syncOut();
    }
    return credited;
  }
  task(journal,dt){
    const c=this.activeFor(journal.actor.id);if(!c)return null;
    if(c.kind==='quest'){journal.actor.journey.quest=c.questId;return null;}
    const own=c.contributions.partner;
    if(own.delivered)return null;
    if(!journal.progress.hasItem(own.item,own.count))return journal.obtain(own.item,own.count,dt);
    return journal.workAt(c.destination,dt,'Delivering our shared order',2,'trade',()=>this.deliver(c,'partner',journal.person.position));
  }
  update(now=Date.now()){
    if(now<this.nextUpdate)return;this.nextUpdate=now+1000;
    let changed=false;
    for(const c of this.agreements){
      if(!active(c))continue;
      if(now>=c.expiresAt){this.cancel(c,now,true);continue;}
      if(c.kind==='supply'){this.finishSupply(c,now);continue;}
      const q=QUESTS.find(q=>q.id===c.questId),journal=this.journal(c.partner);if(!q||!journal)continue;
      for(const [side,p]of [['player',this.progress],['partner',journal.progress]]){
        const entry=p.data.quests[q.id];
        const worked=entry?.count>c.baseline[side]||entry?.completed&&entry.acceptedAt>=c.createdAt||q.kind.startsWith('deliver:')&&p.state(q)==='ready';
        if(worked&&!c.helped[side]){c.helped[side]=true;changed=true;}
      }
      if(c.helped.player&&c.helped.partner&&[this.progress,journal.progress].every(p=>['ready','completed'].includes(p.state(q)))){this.complete(c,18,now);changed=true;}
    }
    // Keep recent history for feedback and cooldowns without growing saves forever.
    if(this.agreements.length>60){this.data.agreements=this.agreements.filter(c=>active(c)||now-(c.finishedAt??now)<86400000).slice(-60);changed=true;}
    if(changed)this.save();
  }
}
