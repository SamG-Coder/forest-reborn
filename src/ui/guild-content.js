import {BOUNTIES} from '../progression/bounties.js';
import {formatMoney} from '../progression/currency.js';
import {element,action,itemImage,banner,meter,tabs,emptyState} from './panel-components.js';

export function renderGuildContent({content,section,setSection,simulation,progress,message,save}){
  const society=simulation.society,own=society.guildFor('player');
  banner(content,{title:own?.name??'Find your people',subtitle:own?`${own.ethos==='outlaw'?'Outlaw faction':own.ethos==='trade'?'Trade guild':'Adventuring guild'} · ${own.members.length} members · Treasury ${formatMoney(own.treasury)}`:'Travel together, earn trust, and take on work too big for one person.',item:{id:'bounty'}});
  tabs(content,[['guilds','Guilds'],['bounties','Bounty board'],['companions','Companions'],['events','World events']],section,setSection);
  if(section==='guilds'){
    if(!own){
      const form=element(content,'form','guild-form'),input=element(form,'input');input.placeholder='Guild name';input.maxLength=28;input.required=true;input.setAttribute('aria-label','Guild name');
      const ethos=element(form,'select');ethos.setAttribute('aria-label','Guild purpose');for(const [id,name]of [['adventure','Adventuring'],['trade','Trading'],['outlaw','Outlaw faction']])ethos.add(new Option(name,id));
      const create=action(form,'Form guild',()=>{});create.type='submit';form.onsubmit=e=>{e.preventDefault();if(society.createGuild(input.value,'player',ethos.value)){input.blur();save();}else message('Choose an unused guild name.',3);};
    }
    const grid=element(content,'div','card-grid');
    for(const guild of society.guilds){
      const card=element(grid,'article','guild-card');element(card,'small','eyebrow',`${guild.ethos} · ${guild.members.length} members`);element(card,'h3','',guild.name);
      const members=element(card,'div','member-tags');for(const id of guild.members)element(members,'span','member-tag',id==='player'?'You':simulation.actors[id]?.name);
      const footer=element(card,'div','card-footer');element(footer,'span','coin-label',formatMoney(guild.treasury));
      if(guild===own)action(footer,'Leave guild',()=>{society.leave('player');save();});
      else if(!own)action(footer,'Join '+guild.name,()=>{message(society.requestJoin(guild.id,progress),5);save();});
    }
    if(!society.guilds.length)emptyState(grid,'A fresh start','Start a guild here, then earn the trust of people you meet in town.');
  }else if(section==='bounties'){
    if(!own){emptyState(content,'Bring a companion','Join or form a guild to accept these hunts. Each member must take part to claim a reward.');return;}
    const active=own.bounty;
    if(active){
      const card=element(content,'article','quest-card');element(card,'small','eyebrow','YOUR GUILD’S HUNT');element(card,'h3','',active.name);element(card,'p','',active.description);meter(card,active.progress,active.count,`${active.progress} / ${active.count}`);
      if(active.progress>=active.count&&!active.claimed.includes('player')){const claim=action(card,'Claim bounty reward',()=>{if(society.claimBounty('player',progress)){message('Guild bounty completed.',4);save();}},'primary-action');claim.disabled=!active.contributors.player;if(claim.disabled)element(card,'p','muted','You need to take part in the hunt to claim a reward.');}
    }
    element(content,'h3','section-heading','Available contracts');const grid=element(content,'div','bounty-grid');
    for(const bounty of BOUNTIES){
      const card=element(grid,'article','bounty-card');itemImage(card,progress.item(bounty.kind.startsWith('ogre')?'ogreTooth':'goblinScrap'));element(card,'small','eyebrow',`LEVEL ${bounty.minLevel} · GUILD HUNT`);element(card,'h3','',bounty.name);element(card,'p','muted',bounty.description);element(card,'b','coin-label',`${bounty.xp} XP · ${formatMoney(bounty.coins)}`);
      const accept=action(card,'Accept '+bounty.name,()=>{if(society.acceptBounty(own.id,bounty.id,progress.data.level))save();else message('Finish and claim the current bounty, or wait for the board to refresh.',4);});accept.disabled=own.members.length<2||progress.data.level<bounty.minLevel||Boolean(active&&active.progress<active.count);
    }
    if(own.members.length<2)element(content,'p','muted','Recruit at least one companion before taking a guild bounty.');
  }else if(section==='companions'){
    element(content,'p','muted','A name on your friends list is a start. Conversations and keeping promises earn trust.');
    const grid=element(content,'div','card-grid');
    for(const actor of simulation.actors.filter(a=>!society.guildFor(a.id))){
      const card=element(grid,'article','social-card'),head=element(card,'div','item-card-heading');itemImage(head,progress.item({miner:'iron',woodcutter:'axe',herbalist:'herbs',trader:'flour'}[actor.personality.role]??'sword'));
      const copy=element(head);element(copy,'small','eyebrow',actor.personality.role);element(copy,'h3','',actor.name);const trust=society.relationships.trust('player',actor.id);meter(card,trust,100,`${society.relationships.label('player',actor.id)} · Trust ${trust}/100`);
      if(own){const invite=action(card,'Invite '+actor.name,()=>{message(society.invite(actor.id,Date.now(),progress),5);save();});invite.dataset.tooltip=`${actor.name}\n${actor.personality.role}. ${trust<26?'Earn their trust before inviting them.':'Ready to discuss joining.'}`;}
    }
    if(!grid.children.length)emptyState(grid,'Everyone has company','Meet other adventurers as they come through town.');
  }else{
    const event=society.event;
    if(event){const card=element(content,'article','quest-card');const head=element(card,'div','item-card-heading');itemImage(head,progress.item(event.type==='richSeam'?'iron':event.type==='herbBloom'?'berries':'sword'));const copy=element(head);element(copy,'small','eyebrow',`${Math.ceil((event.endsAt-Date.now())/1000)} SECONDS LEFT`);element(copy,'h3','',event.title);element(card,'p','',event.description);meter(card,event.progress,event.goal,`${event.progress} / ${event.goal} · marked on the map`);}
    else emptyState(content,'A quiet moment','No world event is active. People are going about their day.');
    element(content,'h3','section-heading','Town notices');const feed=element(content,'div','notice-feed');for(const note of society.notices.slice(-8).reverse())element(feed,'p','',note.text);
  }
}
