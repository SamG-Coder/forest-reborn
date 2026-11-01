import {createInteractiveMap} from '../ui/world-map.js';
import {WARFRONT,inHighmere} from '../world/region-layout.js';
import {TASK_LABELS} from '../npc/simulation.js';
import {levelThreshold} from '../progression/save.js';

export function createMMOHud({player,combat,state,progress,population,worldUI,world}){
  const hud=document.querySelector('#hud'),playerCard=hud.querySelector('.player-card'),target=hud.querySelector('#target-card');
  playerCard.innerHTML='<span class="unit-emblem">Ⅰ<span id="level">01</span></span><div class="unit-details"><small class="unit-kind">YOU · WARRIOR</small><b id="player-name">Ren</b><small id="weapon-label">Unarmed</small><div class="bar health"><i id="health-bar"></i><span id="health-value"></span></div><div class="bar stamina"><i id="stamina-bar"></i></div></div>';
  target.innerHTML='<small id="target-kind" class="unit-kind">HOSTILE</small><b id="target-name"></b><div class="bar health"><i id="target-health"></i></div><small id="target-status"></small><button id="unit-interact" hidden></button>';
  const map=document.createElement('section');map.className='minimap-frame';map.innerHTML='<div class="minimap-title">Mosswake</div>';hud.append(map);
  const minimap=createInteractiveMap({container:map,player,population,progress,workstations:world?.workstations,compact:true});
  const feed=document.createElement('section');feed.className='local-feed';feed.innerHTML='<span>LOCAL ACTIVITY</span><div></div>';hud.append(feed);
  const xp=document.createElement('div');xp.id='experience-label';hud.append(xp);
  const hotbar=hud.querySelector('#hotbar');
  for(const button of hud.querySelectorAll('.world-buttons button')){button.className='utility-action';hotbar.append(button);}
  hud.querySelector('.world-buttons').remove();
  let selected=null,lastEvent=null;
  hud.querySelector('#unit-interact').onclick=()=>{
    if(!selected)return;
    if(selected.type==='adventurer')population.simulation.toggleFriend(selected.data.id);
    else if(selected.position.distanceTo(player.position)<3)worldUI.talk(selected);
  };
  return {update(time){
    hud.querySelector('#weapon-label').textContent=combat.weapon==='sword'?'Practice sword':'Unarmed';
    hud.querySelector('#health-value').textContent=`${Math.ceil(combat.hp)} / 100`;
    xp.textContent=`LEVEL ${progress.data.level} · ${progress.data.xp} / ${levelThreshold(progress.data.level)} XP`;
    if(state.lock){target.dataset.kind='enemy';hud.querySelector('#target-kind').textContent=state.lock.person?(state.lock.person.type==='adventurer'?'PLAYER · PVP':'NPC · HOSTILE'):'ENEMY';hud.querySelector('#unit-interact').hidden=true;}
    selected=state.friendly;
    if(selected){
      target.hidden=false;const isPlayer=selected.type==='adventurer';target.dataset.kind=isPlayer?'player':'npc';
      hud.querySelector('#target-kind').textContent=isPlayer?'PLAYER · ADVENTURER':'NPC · '+selected.role.toUpperCase();
      hud.querySelector('#target-name').textContent=selected.name+(isPlayer?' · Lv '+population.simulation.level(selected.data):'');
      hud.querySelector('#target-health').style.width=`${selected.data?.health??100}%`;
      const distance=selected.position.distanceTo(player.position);
      hud.querySelector('#target-status').textContent=`${selected.activity??(isPlayer?TASK_LABELS[selected.data.task]:selected.role)} · ${distance.toFixed(0)} m`;
      const button=hud.querySelector('#unit-interact');button.hidden=false;
      button.textContent=isPlayer?(population.simulation.friends.has(selected.data.id)?'Remove friend':'Add friend'):'Talk';button.disabled=!isPlayer&&distance>=3;
    }
    const event=population.simulation.events.at(-1);
    if(event!==lastEvent){lastEvent=event;const rows=feed.querySelector('div');rows.replaceChildren();
      const verbs={kill:'defeated',gather:'gathered at',sell:'sold supplies:',meal:'',train:''};
      for(const e of population.simulation.events.slice(-4)){const p=document.createElement('p');p.textContent=`${e.name}: ${verbs[e.type]??''} ${e.detail}`;rows.append(p);}
    }
    map.querySelector('.minimap-title').textContent=inHighmere(player.position.x,player.position.z,30)?'Highmere':Math.hypot(player.position.x-WARFRONT.x,player.position.z-WARFRONT.z)<200?'Highmere east field':Math.hypot(player.position.x,player.position.z)<180?'Mosswake':'North road';
    minimap.update(time);
  }};
}
