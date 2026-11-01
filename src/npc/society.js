import {BOUNTIES,bountyDefinition} from '../progression/bounties.js';
import {Relationships} from './relationships.js';
import {inTown} from '../world/terrain.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function personality(id){
  const roles=['hunter','miner','woodcutter','trader','explorer','herbalist'];
  return {role:roles[id%roles.length],greed:[.2,.85,.4,.95,.15,.75][id%6],courage:[.8,.55,.25,.85,.65,.35][id%6],sociability:[.8,.5,.9,.65,.4,.7][id%6]};
}
export const PLAYER_KILL_SKULL_MS=60*60*1000;
export function flagState(saved={}){return {enabled:false,clearAt:0,combatUntil:0,wantedUntil:0,skullUntil:0,clearReason:'',...saved,clearRequested:Boolean(saved.clearRequested||saved.clearAt)};}
export function recordPlayerKill(flag,now=Date.now()){flag.skullUntil=now+PLAYER_KILL_SKULL_MS;}
function clearBlock(flag,position,now){return inTown(position.x,position.z)?'Leave town':now<flag.wantedUntil?'Wanted by the watch':now<flag.combatUntil?'In combat':'';}
export function requestPvpFlag(flag,enabled,position,now){
  if(enabled){flag.enabled=true;flag.clearAt=0;flag.clearRequested=false;flag.clearReason='';return 'PvP enabled. Other flagged adventurers can attack you.';}
  flag.clearRequested=true;updatePvpFlag(flag,position,now);
  if(flag.clearReason)return `${flag.clearReason}. The 30-second countdown will start once it is safe.`;
  return `PvP will turn off in ${Math.max(0,Math.ceil((flag.clearAt-now)/1000))} seconds. Clicking again will not restart it.`;
}
export function updatePvpFlag(flag,position,now){
  if(!flag.enabled){flag.clearAt=0;flag.clearRequested=false;flag.clearReason='';return;}
  if(!flag.clearRequested&&!flag.clearAt)return;
  flag.clearReason=clearBlock(flag,position,now);
  if(flag.clearReason){flag.clearAt=0;return;}
  if(!flag.clearAt)flag.clearAt=now+30000;
  if(now>=flag.clearAt){flag.enabled=false;flag.clearAt=0;flag.clearRequested=false;flag.clearReason='';}
}

const EVENT_TYPES={
  herbBloom:{title:'Rain in the meadows',description:'Fresh herbs and berries have sprung up around the south meadow. Gatherers are making the most of it.',x:43,z:48,duration:150000,goal:16,kind:'gather'},
  richSeam:{title:'A rich seam',description:'Fresh ore has been found east of town. Miners are heading out to work it.',x:60,z:-48,duration:150000,goal:12,kind:'gather'},
  roadClaim:{title:'The north road dispute',description:'A greedy faction is claiming the north road. Rival guilds are gathering outside the gate.',x:4,z:-65,duration:180000,goal:6,kind:'pvp'},
  hunt:{title:'Briar grove bounty',description:'The watch is paying extra for goblins near the grove. Guild hunting parties are on their way.',x:84,z:-83,duration:180000,goal:10,kind:'kill'},
};

/** Persistent organisations and events. Rewards require a completed world action. */
export class Society {
  constructor(actors,saved={},now=Date.now()){
    this.relationships=new Relationships(saved.relationships);this.actors=actors;this.guilds=saved.guilds??[];this.nextId=saved.nextId??1;this.event=saved.event??null;
    this.eventSeed=saved.eventSeed??3491;this.lastEventType=saved.lastEventType??null;this.sequence=saved.sequence??0;this.nextEventAt=saved.nextEventAt??now+60000;this.nextGuildAt=saved.nextGuildAt??now+20000;
    this.notices=saved.notices??[];this.playerGuild=saved.playerGuild??null;
  }
  announce(text,now){this.notices.push({text,time:now});this.notices=this.notices.slice(-40);}
  guildFor(id){return this.guilds.find(g=>g.members.includes(id))??null;}
  createGuild(name,leader,ethos='adventure',now=Date.now()){
    name=String(name).trim().slice(0,28);
    if(!name||this.guildFor(leader)||this.guilds.some(g=>g.name.toLowerCase()===name.toLowerCase()))return null;
    const guild={id:`guild-${this.nextId++}`,name,ethos:['adventure','trade','outlaw'].includes(ethos)?ethos:'adventure',leader,members:[leader],treasury:0,foundedAt:now};
    this.guilds.push(guild);if(leader==='player')this.playerGuild=guild.id;
    this.announce(`${name} has formed${guild.ethos==='outlaw'?' as an outlaw faction':''}.`,now);return guild;
  }
  join(id,guildId,now=Date.now()){
    const guild=this.guilds.find(g=>g.id===guildId);if(!guild||this.guildFor(id))return false;
    guild.members.push(id);if(id==='player')this.playerGuild=guild.id;
    this.announce(`${id==='player'?'You':this.actors[id]?.name??id} joined ${guild.name}.`,now);return true;
  }
  leave(id,now=Date.now()){
    const guild=this.guildFor(id);if(!guild)return false;
    guild.members=guild.members.filter(member=>member!==id);if(guild.leader===id)guild.leader=guild.members[0];
    if(!guild.members.length)this.guilds=this.guilds.filter(g=>g!==guild);if(id==='player')this.playerGuild=null;
    this.announce(`${id==='player'?'You':this.actors[id]?.name} left ${guild.name}.`,now);return true;
  }
  recruitReason(actorId,ethos,progress){
    const actor=this.actors[actorId];if(!actor)return 'That adventurer is unavailable.';
    if(this.guildFor(actorId))return 'They already belong to a guild.';
    if(ethos==='outlaw'&&actor.personality.greed<.55)return 'I’m not looking for trouble with the watch.';
    if(this.relationships.trust('player',actorId)<26)return 'Let’s get to know each other first. Help me with something, then ask again.';
    const fee=actor.personality.greed>.8?25:0;
    if(fee&&(progress?.data.coins??0)<fee)return 'I want 25 copper toward supplies before I sign on.';
    return '';
  }
  invite(actorId,now=Date.now(),progress){
    const guild=this.guildFor('player'),actor=this.actors[actorId];
    if(!guild)return 'Form a guild first, then ask them to join.';
    const reason=this.recruitReason(actorId,guild.ethos,progress);if(reason)return `${actor.name}: “${reason}”`;
    if(actor.personality.greed>.8){progress.data.coins-=25;actor.coins+=25;progress.save();}
    this.join(actorId,guild.id,now);return `${actor.name}: “All right. Let’s see how we get on.”`;
  }
  requestJoin(guildId,progress,now=Date.now()){
    const guild=this.guilds.find(g=>g.id===guildId);if(!guild)return 'That guild has disbanded.';
    if(this.relationships.trust('player',guild.leader)<26)return 'Get to know the guild leader first. A favour and a conversation are a good start.';
    return this.join('player',guildId,now)?`You joined ${guild.name}.`:'You already belong to a guild.';
  }
  acceptBounty(guildId,bountyId,level,now=Date.now()){
    const guild=this.guilds.find(g=>g.id===guildId),spec=bountyDefinition(bountyId);
    if(!guild||!spec||guild.members.length<2||level<spec.minLevel||guild.bounty&&guild.bounty.progress<guild.bounty.count)return false;
    if(guild.bounty&&!guild.bounty.claimed?.includes('player')&&guild.members.includes('player')&&guild.bounty.contributors.player)return false;
    if((guild.bountyCooldowns?.[bountyId]??0)>now)return false;
    guild.bounty={...spec,progress:0,startedAt:now,contributors:{},claimed:[]};
    for(const id of guild.members)if(id!=='player'&&this.actors[id]){this.actors[id].task='hunt';this.actors[id].nextDecisionAt=0;}
    return true;
  }
  recordBountyHit(id,target){const guild=this.guildFor(id),b=guild?.bounty;if(b&&b.progress<b.count&&b.kind===target.kind)b.contributors[id]=true;}
  recordBountyKill(id,target,now=Date.now()){
    const guild=this.guildFor(id),b=guild?.bounty;if(!b||b.progress>=b.count||b.kind!==target.kind)return;
    b.progress++;b.contributors[id]=true;
    if(b.progress===b.count){guild.bountyCooldowns??={};guild.bountyCooldowns[b.id]=now+300000;this.announce(`${guild.name} completed ${b.name}.`,now);}
  }
  claimBounty(id,progress){
    const guild=this.guildFor(id),b=guild?.bounty;if(!b||b.progress<b.count||!b.contributors[id]||b.claimed.includes(id))return false;
    if(id==='player'){progress.addXP(b.xp);progress.data.coins+=b.coins;progress.save();}
    else{const actor=this.actors[id];actor.xp+=b.xp;actor.coins+=b.coins;}
    b.claimed.push(id);return true;
  }
  startEvent(type,now=Date.now()){
    const spec=EVENT_TYPES[type];if(!spec)return null;
    this.lastEventType=type;this.event={...spec,id:`event-${++this.sequence}`,type,startsAt:now,endsAt:now+spec.duration,progress:0,contributors:{}};
    this.announce(spec.title+': '+spec.description,now);return this.event;
  }
  tick(now){
    this.relationships.socialise(this.actors,now);
    for(const guild of this.guilds)if(!guild.members.includes('player')&&guild.members.length>=2){
      for(const id of guild.members)this.claimBounty(id);
      if(!guild.bounty||guild.bounty.progress>=guild.bounty.count){
        const level=Math.max(...guild.members.map(id=>1+Math.floor(Math.sqrt((this.actors[id]?.xp??0)/120))));
        const spec=[...BOUNTIES].reverse().find(b=>level>=b.minLevel&&(guild.bountyCooldowns?.[b.id]??0)<=now);
        if(spec)this.acceptBounty(guild.id,spec.id,level,now);
      }
    }
    if(now>=this.nextGuildAt){
      const free=this.actors.filter(a=>!this.guildFor(a.id));
      if(free.length>=2&&this.guilds.filter(g=>g.leader!=='player').length<3){
        const cohorts=(!this.guilds.some(g=>g.ethos==='outlaw')?[true,false]:[false,true]).map(outlaw=>({outlaw,eligible:free.filter(a=>outlaw?a.personality.greed>=.7:a.personality.greed<.7).sort((a,b)=>b.personality.sociability-a.personality.sociability)}));
        const cohort=cohorts.find(c=>c.eligible.some(a=>c.eligible.some(b=>b!==a&&this.relationships.trust(a.id,b.id)>=12)))??cohorts[0];
        const {outlaw,eligible}=cohort,leader=eligible.find(a=>eligible.some(b=>b!==a&&this.relationships.trust(a.id,b.id)>=12));
        const companions=leader?eligible.filter(a=>a!==leader&&this.relationships.trust(leader.id,a.id)>=12):[];
        if(leader&&companions.length){
          const names=outlaw?['Blackbriar Company','Iron Toll']:['Lantern Road','Wayfarers’ Accord','Oakbound'];
          const name=names.find(name=>!this.guilds.some(g=>g.name===name));
          const guild=name&&this.createGuild(name,leader.id,outlaw?'outlaw':this.guilds.some(g=>g.ethos==='adventure')?'trade':'adventure',now);
          if(guild)for(const actor of companions.slice(0,2))this.join(actor.id,guild.id,now);
        }
      }
      this.nextGuildAt=now+45000;
    }
    if(this.event&&(now>=this.event.endsAt||this.event.progress>=this.event.goal)){
      this.announce(`${this.event.title} has ended${this.event.progress>=this.event.goal?' — the work is done':'. The crowd is moving on'}.`,now);
      this.event=null;this.nextEventAt=now+45000;
    }
    if(!this.event&&now>=this.nextEventAt){this.eventSeed=(Math.imul(this.eventSeed,1664525)+1013904223)>>>0;const options=Object.keys(EVENT_TYPES).filter(type=>type!==this.lastEventType);this.startEvent(options[this.eventSeed%options.length],now);}
  }
  contribute(id,kind,position,now){
    const event=this.event;if(!event||event.kind!==kind||Math.hypot(position.x-event.x,position.z-event.z)>45)return 0;
    event.progress++;event.contributors[id]=(event.contributors[id]??0)+1;
    const guild=this.guildFor(id);if(guild)guild.treasury+=2;
    return kind==='kill'?4:kind==='gather'?2:0;
  }
  snapshot(){return {eventSeed:this.eventSeed,lastEventType:this.lastEventType,relationships:this.relationships.snapshot(),guilds:this.guilds,nextId:this.nextId,event:this.event,sequence:this.sequence,nextEventAt:this.nextEventAt,nextGuildAt:this.nextGuildAt,notices:this.notices,playerGuild:this.playerGuild};}
}

/** Needs override personal preference; otherwise vary decisions without rerolling every frame. */
export function chooseActivity(actor,society,now,force=false){
  const load=Object.values(actor.inventory).reduce((a,b)=>a+b,0),p=actor.personality;
  if(load>=4)return 'sell';
  if(actor.health<50||actor.stamina<22||actor.hunger>75)return actor.coins>=2?'tavern':'rest';
  if(!force&&actor.nextDecisionAt>now&&actor.task)return actor.task;
  // Give a chosen job time to include the journey across town. Needs and a
  // completed job can interrupt; a short timer must not turn every walk around.
  actor.decisions=(actor.decisions??0)+1;actor.nextDecisionAt=now+120000+(actor.id%5)*12000;
  if(society.guildFor(actor.id)?.bounty?.progress<society.guildFor(actor.id)?.bounty?.count)return 'hunt';
  if(p.role==='woodcutter'&&!actor.tools.axe&&actor.coins>=15)return 'buyTool';
  const event=society.event,guild=society.guildFor(actor.id);
  if(event?.type==='richSeam'&&(p.greed>.6||p.role==='miner'))return 'gather';
  if(event?.type==='hunt'&&guild?.ethos==='adventure')return 'hunt';
  const cycle=(actor.decisions*7+actor.id*3)%10;
  if(cycle===0)return 'tavern';if(cycle===1)return 'explore';
  const preference=['miner','herbalist','woodcutter','trader'].includes(p.role)?'gather':'hunt';
  return cycle<7?preference:preference==='hunt'?'gather':'hunt';
}

export function shouldFlee(health,maxHp,courage=.5){return health/maxHp<clamp(.5-courage*.32,.17,.45);}
