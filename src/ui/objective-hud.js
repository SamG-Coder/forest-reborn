import {QUESTS} from '../progression/quests.js';
import {MAIN_QUESTS,questGuide,trackedQuests} from '../progression/quest-guide.js';
import {element,action} from './panel-components.js';

export function createObjectiveHUD(hud){
  const rail=element(hud,'aside','objective-rail');rail.setAttribute('aria-label','Map and objectives');
  for(const selector of ['.minimap-frame','.quest-tracker','.world-event-box']){
    const node=hud.querySelector(selector);if(node)rail.append(node);
  }
  return rail;
}
export function renderTracker(parent,{progress,population,player,open}){
  parent.replaceChildren();const heading=element(parent,'div','tracker-heading');element(heading,'b','','Journey');action(heading,'Journal · L',()=>open(),'tracker-open');
  const active=trackedQuests(progress);
  if(!active.length){
    const next=MAIN_QUESTS.map(id=>QUESTS.find(q=>q.id===id)).find(q=>progress.state(q)==='available');
    if(next){const g=questGuide(next,progress,population);action(parent,`! ${next.title}`,()=>open(next.id),'tracker-title');element(parent,'p','',`Speak to ${g.giver.name} · ${g.giver.place}`);}
    else element(parent,'p','','Look for ! on the map to find new work.');
    return;
  }
  for(const q of active){
    const g=questGuide(q,progress,population),row=element(parent,'article','tracked-objective');row.dataset.quest=q.id;
    element(row,'small','eyebrow',g.main?'MAIN JOURNEY':q.repeatable?'REPEATABLE':'SIDE QUEST');
    action(row,`${g.state==='ready'?'? ':''}${q.title}`,()=>open(q.id),'tracker-title');
    const count=progress.data.quests[q.id].count;const goal=g.state==='ready'?g.next:`${g.objective}${q.count>1?` · ${count}/${q.count}`:''}`;
    element(row,'p','',goal);const d=g.destination,metres=Math.hypot(player.position.x-d.x,player.position.z-d.z);
    element(row,'small','muted',`${d.place} · ${metres>1000?(metres/1000).toFixed(1)+' km':Math.round(metres)+' m'}`);
  }
}
