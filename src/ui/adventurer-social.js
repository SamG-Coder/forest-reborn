import {element,itemImage,meter} from './panel-components.js';
export function renderAdventurerSocial({person,sim,progress,body,text,button,refresh,message}){
  const actor=person.data,society=sim.society,relations=society.relationships;
  const card=element(body,'section','social-card');
  const originalButton=button,appendButton=(label,callback)=>{const node=originalButton(label,callback);card.append(node);return node;};
  text=appendTextProxy(text);button=appendButton;
  function appendTextProxy(original){return (value,tag='p')=>{const node=original(value,tag);card.append(node);return node;};}
  itemImage(card,progress.item({miner:'iron',woodcutter:'axe',herbalist:'herbs',trader:'flour'}[actor.personality.role]??'sword'));
  meter(card,relations.trust('player',actor.id),100,`${relations.label('player',actor.id)} · Trust ${relations.trust('player',actor.id)} / 100`);
  text('The friends list keeps their contact. Trust comes from time together and keeping your word.');
  const action=callback=>()=>{callback();sim.save();refresh();};
  button('Talk for a moment',action(()=>message(`${actor.name}: “${relations.chat(actor,Date.now())}”`,6)));
  const favour=relations.favours[actor.id];
  if(!favour){text(relations.offer(actor).offer);button('Offer to help',action(()=>relations.accept(actor)));}
  else if(favour.status==='active'){
    text(favour.offer);text(favour.kind==='item'?`Needed: ${progress.item(favour.target).name} × ${favour.count}`:`Progress: ${favour.progress} / ${favour.count}`);
    button('Finish the favour',action(()=>message(relations.complete(actor,progress)?`${actor.name}: “Thanks. I won’t forget that.”`:'You still need to finish what you promised.',4)));
  }
  const own=society.guildFor('player'),theirs=society.guildFor(actor.id);
  if(own&&!theirs)button('Invite to '+own.name,action(()=>message(society.invite(actor.id,Date.now(),progress),5)));
  else if(!own&&theirs)button('Ask to join '+theirs.name,action(()=>message(society.requestJoin(theirs.id,progress),5)));
  else if(!own&&!theirs){
    text('Form a guild together','h3');
    const name=document.createElement('input');name.placeholder='Guild name';name.maxLength=28;name.setAttribute('aria-label','Guild name');card.append(name);
    button('Ask to form a guild',()=>{
      const reason=society.recruitReason(actor.id,'adventure',progress);if(reason){message(`${actor.name}: “${reason}”`,5);return;}
      if(!society.createGuild(name.value,'player','adventure')){message('Choose an unused guild name.',3);return;}
      message(society.invite(actor.id,Date.now(),progress),5);sim.save();refresh();
    });
  }
}
