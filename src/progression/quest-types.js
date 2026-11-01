import {standing,FACTIONS} from '../factions/catalog.js';
export const QUEST_TYPES=Object.freeze({main:'Main quest',faction:'Faction quest',side:'Side quest',job:'Job'});
export const MAIN_IDS=['northern-stand','after-the-banners','recover-north-road','errand','supper','briar','cargo','saddle-earned','north-road','unlisted-arrival','road-beacon','briar-truce'];
const factionIds=new Set(['patrol','outlaw-watch','ash-company','break-the-line','field-patrol','briar-supplies','bandit-supplies','guard-kit']);
const changes={errand:{mosswakeWelcome:true},supper:{tavernSupplied:true},briar:{roadWatch:true},cargo:{caravanOpen:true},'saddle-earned':{watchCourier:true},'north-road':{lordAudience:true},'unlisted-arrival':{archiveOpen:true},'road-beacon':{beaconLit:true},'briar-truce':{briarTruce:true}};
const summaries={errand:'Tomas is baking again. The town knows your name.',supper:'The Wayward Oak has meals ready for travellers.',briar:'The watch has established a post outside the north gate.',cargo:'Mosswake and Highmere are exchanging timber and iron again. Local prices will respond.', 'saddle-earned':'You are now a mounted courier for the watch.','north-road':'Edric has opened the great hall to you.','unlisted-arrival':'The archive is open. Corin has marked an old road beacon on your map.','road-beacon':'The road beacon is burning again. The watch can hold the north approach.','briar-truce':'Briar fighters will leave you alone while you honour Tikka’s truce.'};
export function classifyQuest(q){
  const type=q.type??(MAIN_IDS.includes(q.id)?'main':factionIds.has(q.id)?'faction':q.repeatable?'job':'side');
  const faction=q.faction??(q.giver==='briar-envoy'?'briar':q.giver==='bandit-envoy'?'bandits':q.giver.startsWith('highmere-')?'highmere':'mosswake');
  return Object.freeze({...q,type,faction,worldChanges:q.worldChanges??changes[q.id],worldSummary:q.worldSummary??summaries[q.id],reputation:q.reputation??(type==='faction'?{[faction]:8}:{}),minStanding:q.minStanding??(type==='faction'?-20:undefined)});
}
export function questBlockReason(q,data){
  if(data.level<(q.minLevel??1))return `Requires level ${q.minLevel}.`;
  if(q.requires&&!data.quests[q.requires]?.completed)return `Finish the preceding quest first.`;
  if(q.exclusiveWith?.some(id=>data.quests[id]?.active||data.quests[id]?.completed))return 'You are already following another path through this story.';
  if(q.minStanding!==undefined&&standing(data.reputation,q.faction)<q.minStanding)return `${FACTIONS[q.faction].name} standing ${q.minStanding} required; yours is ${standing(data.reputation,q.faction)}.`;
  if(q.unavailableAfter&&data.worldFlags?.[q.unavailableAfter]&&!data.quests[q.id]?.active)return 'The battle is over. Ask about the survivors.';
  if(q.worldAbsent&&data.worldFlags?.[q.worldAbsent])return 'This opportunity has passed.';
  if(q.worldEquals&&Object.entries(q.worldEquals).some(([k,v])=>data.worldFlags?.[k]!==v))return 'This path depends on what happens at the crossing.';
  if(q.worldRequired&&!data.worldFlags?.[q.worldRequired])return 'Continue the main story to unlock this quest.';
  return '';
}
