import {QUESTS} from './quests.js';
import {RECIPES} from './recipes.js';
import {WORKSTATIONS,HIGHMERE_WORKSTATIONS} from '../world/workstations.js';
import {RESOURCE_SITES} from '../world/resources.js';

export const MAIN_QUESTS=['errand','supper','briar','cargo','saddle-earned','north-road','unlisted-arrival'];
const people={innkeeper:['Tomas','The Wayward Oak',-19,-24],captain:['Captain Alden','North gate',-5,-39],trader:['Orin','Market square',10,4.2],stablemaster:['Nell','Southwest stables',-29,28],
  smith:['Garrick','Smith’s yard',23,25.1],herbalist:['Ivo','Apothecary',-22,24.1],vendor:['Perrin','Market square',-10,5],courier:['Seth','Market square',4,0],
  'highmere-lord':['Lord Edric','Highmere · great hall',838,-938.6],'highmere-scribe':['Corin','Highmere · Records & Charts',885,-893],
  'highmere-guild':['Mira','Highmere · guild hall',819,-850],'highmere-marshal':['Captain Elian','Highmere · east gate',858,-795],'highmere-smith':['Doran','Highmere · forge',818,-805]};
const objectives={
  errand:['Collect Tomas’s flour from Orin','Market square',10,4.2],supper:['Hunt meadow rabbits','South meadow',68,70],briar:['Defeat Briar goblins','Briar grove · northeast',82,-82],cargo:['Defeat road bandits','Old cart road · northwest',-93,-108],
  'saddle-earned':['Speak to Nell about Alden’s horse','Southwest stables',-29,28],
  'north-road':['Deliver Alden’s letter to Lord Edric','Highmere · great hall',838,-938.6],
  'unlisted-arrival':['Ask Corin for the old arrival account','Highmere · Records & Charts',885,-893],
  'east-road':['Defeat east-road bandits','East-road camp',105,-16],
};
const sites={rabbit:['South meadow',68,70],goblin:['Briar grove',82,-82],bandit:['Old cart road',-93,-108],ogre:['Quarry',116,-92],ogreChampion:['North ridge',118,-126],ashRaider:['East field',1260,-831],shieldbreaker:['East field',1260,-831],hillGiant:['East field',1260,-831],wood:['Trees outside Mosswake',52,40]};
const resourcePlaces={wool:'Sheep pasture',herbs:'South meadow',berries:'South-road bushes',iron:'Eastern deposits',copper:'Eastern deposits',coal:'Eastern deposits'};
export function questContact(id,population){
  const live=population?.residents.find(p=>p.id===id);
  const [name,place,x,z]=people[id]??[live?.name??id,live?.role??'Mosswake',0,0];
  return {id,name,place,x:live?.position.x??x,z:live?.position.z??z};
}
export function questGuide(quest,progress,population){
  const state=progress.state(quest),turnIn=questContact(quest.returnTo??quest.giver,population),giver=questContact(quest.giver,population);
  const kind=quest.kind.split(':').at(-1),site=sites[kind];
  let detail=objectives[quest.id];
  if(!detail){
    if(quest.kind.startsWith('craft:')){
      const recipe=RECIPES.find(r=>r.output===kind);
      const stations=quest.giver.startsWith('highmere-')?HIGHMERE_WORKSTATIONS:WORKSTATIONS;
      const station=stations.find(s=>s.id===recipe?.station)??WORKSTATIONS.find(s=>s.id===recipe?.station);
      detail=[`Craft ${progress.item(kind).name}`,station?`${station.building} · ${station.name}`:giver.place,station?.x??giver.x,station?.z??giver.z];
    }else if(quest.kind.startsWith('gather:')){
      const resource=RESOURCE_SITES.find(s=>s.kind===kind);
      detail=[`Gather ${progress.item(kind).name}`,...(resource?[resourcePlaces[kind],resource.x,resource.z]:site??[giver.place,giver.x,giver.z])];
    }
    else detail=[`Defeat ${kind.replace(/([A-Z])/g,' $1').toLowerCase()}`,...(site??['Follow the directions below',giver.x,giver.z])];
  }
  const [objective,place,x,z]=detail;
  return {state,main:MAIN_QUESTS.includes(quest.id),giver,turnIn,objective,place,x,z,
    next:state==='ready'?`Return to ${turnIn.name}`:objective,
    destination:state==='ready'?turnIn:{name:objective,place,x,z}};
}
export function trackedQuests(progress){
  const active=QUESTS.filter(q=>['active','ready'].includes(progress.state(q)));
  return active.sort((a,b)=>Number(b.id===progress.data.trackedQuest)-Number(a.id===progress.data.trackedQuest)||Number(MAIN_QUESTS.includes(b.id))-Number(MAIN_QUESTS.includes(a.id))).slice(0,3);
}
