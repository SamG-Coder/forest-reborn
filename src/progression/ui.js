import {createInteractiveMap} from '../ui/world-map.js';
import {speechVisible} from '../audio/speech-bubbles.js';
import {renderCrafting} from '../ui/crafting-panel.js';
import {renderShop} from '../ui/shop-panel.js';
import {renderQuestJournal,questCard} from '../ui/quest-panel.js';
import {element,banner,itemImage,meter} from '../ui/panel-components.js';
import {renderAdventurerSocial} from '../ui/adventurer-social.js';
import {QUESTS} from './quests.js';
import {questMarkerFor} from './quest-markers.js';
import {TASK_LABELS} from '../npc/simulation.js';
import {terrainHeight} from '../world/terrain.js';
import {inKeepHall} from '../world/region-layout.js';
import {formatMoney} from './currency.js';
import {SHOP_OFFERS} from './shop.js';
import {registerPanel,focusPanel} from '../ui/panel-focus.js';
import {createPvpBadge,updatePvpBadge} from '../ui/pvp-status.js';
import {renderTracker} from '../ui/objective-hud.js';
import {renderMountShop} from '../ui/mount-panel.js';

export function createWorldUI({population,resources,workstations,progress,registry,player,camera,onEquipmentChange,onWeaponChange,playerPanels,onGather,onTrade,onCraft,message,onSpeak,voices,expansion,dialogue,mounts}){
  const root=document.createElement('div');root.id='world-ui';root.innerHTML=`
    <div class="world-buttons"><button data-panel="character">Character</button><button data-panel="bag">Bag</button><button data-panel="skills">Skills</button><button data-panel="quests">Quests</button><button data-panel="friends">Friends</button><button data-panel="map">Map</button><button data-panel="activity">Activity</button></div>
    <div class="quest-tracker"></div><div class="talk-prompt"></div><div class="resident-labels"></div>
    <section class="world-panel" hidden><button class="panel-close" aria-label="Close">×</button><h2></h2><div class="panel-body"></div></section>`;
  document.querySelector('#hud').append(root);
  const panel=root.querySelector('.world-panel'),body=panel.querySelector('.panel-body'),title=panel.querySelector('h2'),tracker=root.querySelector('.quest-tracker');
  let open=null,nearest=null,nearResource=null,nearStation=null,lastRefresh=0,dialoguePerson=null,activeMap=null;
  const createLabel=person=>{
    const label=document.createElement('div'),isPlayer=person.type==='adventurer';label.className='resident-label '+(isPlayer?'adventurer':'townsperson');
    const badge=document.createElement('span');badge.className='unit-badge';badge.textContent=isPlayer?'PLAYER':'NPC';label.append(badge);
    const name=document.createElement('b');name.textContent=person.name;label.append(name);const role=document.createElement('small');role.textContent=person.role;label.append(role);
    const marker=document.createElement('span');marker.className='quest-nameplate-marker';label.prepend(marker);label.dataset.person=person.id;
    const pvp=createPvpBadge(label),speech=document.createElement('div');speech.className='speech-bubble';speech.hidden=true;label.append(speech);root.querySelector('.resident-labels').append(label);return {person,label,role,marker,pvp,speech};
  };
  const labels=[];
  function syncLabels(){for(const person of population.residents)if(!labels.some(entry=>entry.person===person))labels.push(createLabel(person));for(let i=labels.length-1;i>=0;i--)if(!population.residents.includes(labels[i].person)){labels[i].label.remove();labels.splice(i,1);}}
  syncLabels();
  const self=document.createElement('div');self.className='self-nameplate';self.dataset.person='player';
  const selfName=document.createElement('b');self.append(selfName);const selfPvp=createPvpBadge(self);root.append(self);
  const button=(text,callback)=>{const b=document.createElement('button');b.textContent=text;b.onclick=()=>{if(dialoguePerson&&dialoguePerson.position.distanceTo(player.position)>=3){message('Move closer to speak to '+dialoguePerson.name+'.',3);return;}callback();};body.append(b);return b;};
  const text=(value,tag='p')=>{const p=document.createElement(tag);p.textContent=value;body.append(p);return p;};
  function show(name){focusPanel(close);activeMap?.dispose();activeMap=null;playerPanels?.close();dialoguePerson=null;open=name;panel.hidden=false;body.replaceChildren();title.textContent=name;panel.dataset.kind='';panel.dataset.label='';panel.scrollTop=0;}
  function quests(selectedId){show('Quest journal');panel.dataset.kind='quests';renderQuestJournal({body,progress,population,selectedId,onMap:map});}
  function workstation(station){
    if(!station.canUse(player.position)||!population.navigation.segmentClear(player.position,station.position)){message('Move beside '+station.name.toLowerCase()+'.',3);return;}
    show(station.name);panel.dataset.kind='workshop';panel.dataset.label='WORKSHOP · '+station.building.toUpperCase();
    renderCrafting({body,station,progress,onCraft:(recipe,station)=>{if(onCraft?.(recipe,station))close();}});
  }
  function bag(){panel.hidden=true;open=null;playerPanels.show('bag');}
  function friends(){
    show('Friends');banner(body,{title:'People you know',subtitle:'Your contacts keep their own plans. Meet up, help them out, and build trust over time.',item:progress.item('sword')});
    const grid=element(body,'div','card-grid'),sim=population.simulation;
    const ids=[...sim.friends];if(!ids.length)text('Talk to an adventurer with V to add them.');
    for(const id of ids){const actor=sim.actors[id],card=element(grid,'article','social-card'),head=element(card,'div','item-card-heading');itemImage(head,progress.item({miner:'iron',woodcutter:'axe',herbalist:'herbs',trader:'flour'}[actor.personality.role]??'sword'));const copy=element(head);element(copy,'small','eyebrow',`LEVEL ${sim.level(actor)} · ${actor.personality.role}`);element(copy,'h3','',actor.name);element(card,'p','',TASK_LABELS[sim.task(actor)]);meter(card,sim.society.relationships.trust('player',id),100,sim.society.relationships.label('player',id));if(actor.position)element(card,'small','muted',`Last seen at ${Math.round(actor.position[0])}, ${Math.round(actor.position[2])}`);const remove=button('Remove friend',()=>{sim.toggleFriend(id);friends();});card.append(remove);}
  }
  function activity(){show('Around Mosswake');const verbs={kill:'defeated',gather:'gathered from',sell:'sold goods for',meal:'',train:''};
    const feed=element(body,'div','notice-feed');for(const event of population.simulation.events.slice(-20).reverse())element(feed,'p','',`${event.name} ${verbs[event.type]??''} ${event.detail}.`);
    if(!population.simulation.events.length)text('The morning is getting started.');
  }
  function map(destination){
    show('World map');panel.dataset.kind='map';
    activeMap=createInteractiveMap({container:body,player,population,progress,workstations});
    if(destination){activeMap.setDestination(destination);}
  }
  function talk(person,tab='quests'){
    if(mounts?.mounted){message('Dismount with H to speak to them.',3);return;}
    if(person.target.hp<=0){message('They will return soon.',3);return;}
    if(person.type!=='adventurer'&&population.living.player?.target.pvp.enabled){message('The watch wants you outside town. Return after your PvP flag is down.',4);return;}
    const firstGreeting=dialoguePerson!==person||panel.hidden;
    progress.recordObjective('talk:'+person.id);
    const greeting=dialogue?.select(person)??{text:person.greeting??'Hello. Did you need something?',speak:true};
    show(person.name);dialoguePerson=person;person.talkingUntil=Date.now()+30000;text(person.role);
    if(firstGreeting&&greeting.speak)onSpeak?.(person,greeting.text);
    panel.dataset.kind=person.type==='adventurer'?'player':'npc';panel.dataset.label=person.type==='adventurer'?'PLAYER · ADVENTURER':'NPC · '+person.role.toUpperCase();
    const workshopArt={smith:1,herbalist:2,innkeeper:3}[person.id];
    banner(body,{title:person.name,subtitle:greeting.text,art:workshopArt,item:person.id==='stablemaster'?{id:'mount',icon:'mount'}:progress.item(person.type==='adventurer'?'sword':'flour')});
    if(person.id==='stablemaster')renderMountShop({body,progress,mounts,person,player,message,refresh:()=>talk(person)});
    if(SHOP_OFFERS[person.id]){
      const nav=element(body,'nav','dialogue-tabs');
      for(const [id,label]of Object.entries({quests:'Conversation & quests',buy:'Buy',sell:'Sell'})){const b=element(nav,'button','',label);b.dataset.tab=id;b.classList.toggle('active',tab===id);b.onclick=()=>talk(person,id);}
      if(tab==='buy'||tab==='sell'){
        renderShop({body,person,progress,simulation:population.simulation,mode:tab,canTrade:()=>person.position.distanceTo(player.position)<3,onTrade,message,refresh:()=>talk(person,tab)});return;
      }
    }
    if(person.routine&&person.activity)text(person.activity,'small');
    if(person.id==='trader'&&progress.state(QUESTS.find(q=>q.id==='errand'))==='active'){
      text('Tomas’s flour? It’s under the counter. Mind the tie on that sack.');
      button('Pick up Tomas’s flour',()=>{if(!progress.hasItem('flour')&&!progress.addItem('flour')){message(progress.lastError,3);return;}progress.recordObjective('parcel');message('Flour collected. Take it back to Tomas.',4);talk(person);});
    }
    if(person.id==='trader'){
      if(Object.values(progress.data.inventory).some(n=>n>0))button('Sell gathered materials',()=>{const coins=progress.sellMaterials(population.simulation.stock);population.simulation.save();onTrade?.();message(`Sold for ${formatMoney(coins)}.`,3);talk(person);});
      const stock=Object.entries(population.simulation.stock).map(([kind,count])=>`${count} ${kind}`).join(', ');if(stock)text('Bought from local adventurers: '+stock);
    }
    if(person.type==='adventurer'){
      const sim=population.simulation;text(`Level ${sim.level(person.data)} · ${TASK_LABELS[sim.task(person.data)]}`);
      button(sim.friends.has(person.data.id)?'Remove friend':'Add friend',()=>{sim.toggleFriend(person.data.id);talk(person);});
      if(expansion){const member=expansion.isCompanion(person.id);button(member?'Leave party':'Travel with me',()=>{const result=expansion.toggleCompanion(person);onSpeak?.(person,result?'All right. I will come with you.':'I will head back. Find me in town.');talk(person);});}
      renderAdventurerSocial({person,sim,progress,body,text,button,refresh:()=>talk(person),message});return;
    }
    const jobs=element(body,'div','npc-quests');
    for(const quest of QUESTS.filter(q=>progress.state(q)==='ready'?(q.returnTo??q.giver)===person.id:q.giver===person.id)){
      const state=progress.state(quest);if(state==='locked'||state==='completed')continue;
      questCard(jobs,quest,progress,{
        population,
        read:q=>onSpeak?.(person,progress.state(q)==='ready'?q.complete:q.offer),
        accept:q=>{if(person.position.distanceTo(player.position)>=3)return;progress.accept(q.id);progress.data.trackedQuest=q.id;progress.save();talk(person);onSpeak?.(person,q.active);message('Quest accepted: '+q.title,3);},
        claim:q=>{if(person.position.distanceTo(player.position)>=3)return;if(!progress.claim(q.id)){message(progress.lastError,3);return;}talk(person);onSpeak?.(person,q.complete);message('Quest complete: '+q.title+(q.reward.mount?' · Horse unlocked. Press H outside to ride.':(q.reward.item||q.reward.weapon)?' · Your reward is in your bag.':''),5);},
      });
    }
  }

  function close(){activeMap?.dispose();activeMap=null;const visible=!panel.hidden;panel.hidden=true;open=null;dialoguePerson=null;voices?.stop('dialogue');return visible;}
  registerPanel(close);root.querySelector('.panel-close').onclick=close;
  const openPlayer=page=>{close();playerPanels.show(page);};
  const pages={quests,bag,friends,map,activity,character:()=>openPlayer('character'),skills:()=>openPlayer('skills')};for(const b of root.querySelectorAll('[data-panel]'))b.onclick=()=>pages[b.dataset.panel]();
  window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
    if(!document.querySelector('#hud').hidden&&!e.repeat){if(e.code==='KeyB')bag();if(e.code==='KeyL')quests();if(e.code==='KeyO')friends();if(e.code==='KeyC')openPlayer('character');if(e.code==='KeyK')openPlayer('skills');}
    if(e.code==='KeyV'&&!e.repeat&&!document.querySelector('#hud').hidden){e.preventDefault();
      if(nearStation){workstation(nearStation);}
      else if(nearResource){onGather(nearResource);}
      else if(nearest)talk(nearest);
    }
    if(e.code==='KeyM'&&!document.querySelector('#hud').hidden){if(e.repeat)return;if(open==='World map')close();else map();}
  });
  return {talk,workstation,quests,bag,friends,map,close,update(time){
    syncLabels();nearest=population.nearest(player.position);nearResource=resources.nearest(player.position);nearStation=workstations.nearest(player.position);if(nearStation&&!population.navigation.segmentClear(player.position,nearStation.position))nearStation=null;root.querySelector('.talk-prompt').textContent=nearStation?`V · Use ${nearStation.name}`:nearResource?nearResource.tree?'V · Chop tree (axe required)':nearResource.kind==='wool'?'V · Shear sheep (shears required)':`V · Gather ${nearResource.kind} (${nearResource.remaining} left)`:nearest?`V · Talk to ${nearest.name}`:'';
    const own=player.position.clone();own.y+=2.05+(player.mountOffset??0);own.project(camera);selfName.textContent=document.querySelector('#player-name').textContent;
    updatePvpBadge(selfPvp,progress.data.pvp);self.hidden=own.z>1||Math.abs(own.x)>1.2;self.style.left=`${(own.x*.5+.5)*innerWidth}px`;self.style.top=`${(-own.y*.5+.5)*innerHeight}px`;
    for(const {person,label,role,marker,pvp,speech}of labels){const distance=person.position.distanceTo(player.position),p=person.position.clone();p.y=terrainHeight(p.x,p.z)+(person.seated?1.4:2);p.project(camera);
      const speaking=speechVisible(person.speech);speech.hidden=!speaking;if(speaking&&speech.textContent!==person.speech.text)speech.textContent=person.speech.text;
      updatePvpBadge(pvp,person.target.pvp);
      const symbol=questMarkerFor(person.id,progress);marker.textContent=symbol;marker.hidden=!symbol;marker.setAttribute('aria-label',symbol==='?'?'Quest ready to turn in':'New quest available');
      role.textContent=person.type==='adventurer'?`Lv ${population.simulation.level(person.data)} · ${person.activity??TASK_LABELS[person.data.task]}`:person.household?`${person.role} · ${person.activity}`:person.role;
      const guild=person.data&&population.simulation.society.guildFor(person.data.id);if(guild)role.textContent+=' · '+guild.name;label.dataset.pvp=String(person.target.pvp.enabled);
      const roomHidden=person.room==='highmere-hall'&&!inKeepHall(player.position.x,player.position.z);
      label.hidden=person.target.hp<=0||roomHidden||distance>(speaking?42:24)||p.z>1||Math.abs(p.x)>1.2;label.style.left=`${(p.x*.5+.5)*innerWidth}px`;label.style.top=`${(-p.y*.5+.5)*innerHeight}px`;}
    if(time-lastRefresh<.4)return;lastRefresh=time;if(!panel.hidden)activeMap?.update(time);
    renderTracker(tracker,{progress,population,player,open:quests});
  }};
}

