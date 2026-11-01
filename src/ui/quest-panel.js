import {QUESTS} from '../progression/quests.js';
import {currentChapter} from '../progression/story.js';
import {formatMoney} from '../progression/currency.js';
import {element,action,itemImage,banner,meter,tabs,emptyState} from './panel-components.js';
import {MAIN_QUESTS,questGuide} from '../progression/quest-guide.js';
import {mountDefinition} from '../mounts/catalog.js';

const labels={available:'Available',active:'In progress',ready:'Return for reward',completed:'Completed'};
export function questItem(quest,progress){
  if(quest.reward.mount)return {id:'mount',name:'Riding horse',icon:'mount'};
  if(quest.kind.startsWith('talk:'))return {id:'quests',name:'Letter',icon:'parcel'};
  const id=quest.kind.includes(':')?quest.kind.slice(quest.kind.indexOf(':')+1):({rabbit:'rabbitHide',goblin:'goblinScrap',bandit:'sword',ogre:'ogreTooth',ogreChampion:'ogreTooth',parcel:'flour'}[quest.kind]??'flour');
  return progress.item(id);
}
export function questRewards(parent,quest,progress){
  const rewards=element(parent,'div','quest-rewards');element(rewards,'span','stat-chip',`+${quest.reward.xp} XP`);element(rewards,'span','stat-chip coin-label',formatMoney(quest.reward.coins));
  const id=quest.reward.item??quest.reward.weapon;if(id){const item=progress.item(id),reward=element(rewards,'div','reward-item');itemImage(reward,item);element(reward,'span','',`${item.name}${quest.reward.count>1?' × '+quest.reward.count:''}`);}
  if(quest.reward.mount){const horse=mountDefinition(quest.reward.mount),reward=element(rewards,'div','reward-item');itemImage(reward,{id:'mount',icon:'mount'});element(reward,'b','',`${horse.name} · Riding horse, saddle included`);}
  return rewards;
}
export function questCard(parent,quest,progress,callbacks={}){
  const state=progress.state(quest),card=element(parent,'article','quest-card'),heading=element(card,'div','item-card-heading');card.dataset.quest=quest.id;
  itemImage(heading,questItem(quest,progress));const copy=element(heading);element(copy,'small','eyebrow',labels[state]+(quest.repeatable?' · Repeatable':''));element(copy,'h3','',quest.title);
  const guide=questGuide(quest,progress,callbacks.population);
  element(card,'p','',state==='available'?quest.offer:state==='ready'?quest.complete:quest.active);
  const objective=element(card,'div','quest-objective');element(objective,'small','eyebrow',state==='ready'?'READY TO HAND IN':'YOUR NEXT STEP');
  element(objective,'h4','',guide.next);element(objective,'p','muted',guide.destination.place);
  if(state==='active'&&quest.count>1)meter(objective,progress.data.quests[quest.id].count,quest.count,`${progress.data.quests[quest.id].count} / ${quest.count}`);
  const route=element(card,'div','quest-route');
  for(const [label,p]of [['Given by',guide.giver],['Hand in to',guide.turnIn]]){const box=element(route);element(box,'small','',label);element(box,'strong','',p.name);element(box,'small','',p.place);}
  questRewards(card,quest,progress);
  if(callbacks.read)action(card,'Hear the details',()=>callbacks.read(quest),'quiet');
  if(state==='available'&&callbacks.accept)action(card,'Take the job',()=>callbacks.accept(quest),'primary-action');
  if(state==='ready'&&callbacks.claim)action(card,'Collect reward',()=>callbacks.claim(quest),'primary-action');
  return card;
}
export function renderQuestJournal({body,progress,population,selectedId=null,onMap}){
  const chapter=currentChapter(progress);banner(body,{title:chapter.title,subtitle:`Levels ${chapter.levels} · ${chapter.text}`,item:{id:'quests',name:'Journey',icon:'parcel'}});
  const stages=element(body,'div','journey-steps');
  for(const [id,label]of [['errand','Find your feet'],['briar','Help Mosswake'],['saddle-earned','Earn a horse'],['north-road','Meet the lord'],['unlisted-arrival','Find answers']]){
    const q=QUESTS.find(q=>q.id===id),state=progress.state(q);element(stages,'span',state==='completed'?'done':state!=='locked'?'current':'',`${state==='completed'?'✓ ':''}${label}`);
  }
  const holder=element(body),content=element(body);let selected=QUESTS.find(q=>q.id===selectedId)??null,section=selected?(['active','ready'].includes(progress.state(selected))?'active':progress.state(selected)):QUESTS.some(q=>['active','ready'].includes(progress.state(q)))?'active':'available';
  function render(){
    holder.replaceChildren();content.replaceChildren();
    const matches=q=>section==='active'?['active','ready'].includes(progress.state(q)):progress.state(q)===section;
    tabs(holder,[['active','In progress'],['available','Available'],['completed','Completed']],section,id=>{section=id;selected=null;render();});
    const quests=QUESTS.filter(matches).sort((a,b)=>Number(MAIN_QUESTS.includes(b.id))-Number(MAIN_QUESTS.includes(a.id)));if(!quests.length){emptyState(content,'No quests here','Speak to someone marked with ! to find your next job.');return;}
    selected??=quests[0];const layout=element(content,'div','journal-layout'),list=element(layout,'div','journal-list'),detail=element(layout,'div','journal-detail');
    for(const quest of quests){const button=action(list,'',()=>{selected=quest;render();},'journal-choice');button.classList.toggle('active',selected===quest);itemImage(button,questItem(quest,progress));const copy=element(button);element(copy,'b','',quest.title);element(copy,'small','',`${MAIN_QUESTS.includes(quest.id)?'Main journey':'Side quest'} · ${labels[progress.state(quest)]}`);}
    questCard(detail,selected,progress,{population});
    if(['active','ready'].includes(progress.state(selected)))action(detail,progress.data.trackedQuest===selected.id?'Tracking this quest':'Track this quest',()=>{progress.data.trackedQuest=selected.id;progress.save();render();},'primary-action');
    if(onMap){const guide=questGuide(selected,progress,population);action(detail,'Show destination on map',()=>onMap(guide.state==='available'?guide.giver:guide.destination));}
  }
  render();
  const favours=Object.entries(population.simulation.society.relationships.favours).filter(([,f])=>f.status==='active');
  if(favours.length){element(body,'h3','section-heading','Promises to friends');const grid=element(body,'div','card-grid');for(const [id,favour]of favours){const card=element(grid,'article','quest-card');element(card,'h3','','A favour for '+population.simulation.actors[id].name);element(card,'p','',favour.offer);if(favour.kind==='item'){itemImage(card,progress.item(favour.target));element(card,'p','muted',`${progress.item(favour.target).name} × ${favour.count}`);}else meter(card,favour.progress,favour.count,`${favour.progress} / ${favour.count}`);}}
}
