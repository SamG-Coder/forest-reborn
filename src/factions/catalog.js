/** Factions own resources and intentions. Guilds remain player organisations. */
export const FACTIONS=Object.freeze({
  mosswake:{name:'Mosswake',color:'#b7cd83',goal:'Keep the roads open and the workshops supplied',home:[0,0],resource:'wood',allies:['highmere'],enemies:['bandits'],starting:15},
  highmere:{name:'Highmere',color:'#84b9e4',goal:'Supply the watch and hold the east field',home:[850,-830],resource:'iron',allies:['mosswake'],enemies:['ash'],starting:0},
  briar:{name:'Briar goblins',color:'#98bc66',goal:'Gather food, forge equipment and train stronger fighters',home:[82,-82],resource:'iron',allies:[],enemies:['bandits'],starting:0},
  bandits:{name:'Road bandits',color:'#d5a278',goal:'Stock the camps and take control of the cart road',home:[-93,-108],resource:'bread',allies:['ash'],enemies:['mosswake','briar'],starting:-15},
  ash:{name:'Ash Company',color:'#cf7871',goal:'Train companies and break the Highmere supply line',home:[1710,-1640],resource:'iron',allies:['bandits'],enemies:['highmere'],starting:-20},
  quarry:{name:'Quarry clan',color:'#b8a18c',goal:'Defend the quarry and feed the ridge warden',home:[116,-100],resource:'bread',allies:[],enemies:['highmere'],starting:-10},
  woodland:{name:'Woodland herds',color:'#cfbd8b',goal:'Forage, recover and avoid hunters',home:[68,70],resource:'berries',allies:[],enemies:[],starting:0},
});
export const FACTION_IDS=Object.freeze(Object.keys(FACTIONS));
export function factionFor(unit){
  if(unit.factionId)return unit.factionId;
  if(unit.person)return factionFor(unit.person);
  if(unit.type==='adventurer')return unit.data?.factionId??'mosswake';
  if(String(unit.id??'').startsWith('highmere-'))return 'highmere';
  return ({goblin:'briar',bandit:'bandits',ashRaider:'ash',shieldbreaker:'ash',hillGiant:'quarry',ogre:'quarry',ogreChampion:'quarry',rabbit:'woodland'})[unit.kind]??'mosswake';
}
export const standing=(reputation,id)=>reputation?.[id]??FACTIONS[id]?.starting??0;
export const attitude=value=>value<=-30?'Hostile':value<0?'Wary':value<20?'Neutral':value<50?'Friendly':'Trusted';
export function changeStanding(reputation,id,amount){reputation[id]=Math.max(-100,Math.min(100,standing(reputation,id)+amount));}
export const VENDORS=Object.freeze({
  trader:{faction:'mosswake',name:'Orin',x:10,z:4.2,wants:['linen','wood','rabbitHide']},
  smith:{faction:'mosswake',name:'Garrick',x:23,z:25.1,wants:['iron','coal','goblinScrap','leather']},
  herbalist:{faction:'mosswake',name:'Ivo',x:-22,z:24.1,wants:['herbs','berries']},
  innkeeper:{faction:'mosswake',name:'Tomas',x:-19,z:-24,wants:['berries','bread']},
  vendor:{faction:'mosswake',name:'Perrin',x:-10,z:5,wants:['berries','wool']},
  'highmere-smith':{faction:'highmere',name:'Doran',x:818,z:-805,wants:['iron','steelScrap','coal','arrow.iron']},
  'highmere-market-supplies':{faction:'highmere',name:'Oswin',x:869,z:-781,wants:['arrow.wood','arrow.iron','feather','wood']},
  'highmere-market-bread':{faction:'highmere',name:'Fen',x:872,z:-836.25,wants:['bread','berries']},
  'highmere-market-produce':{faction:'highmere',name:'Ada',x:832,z:-819.25,wants:['berries','herbs']},
  'highmere-market-cloth':{faction:'highmere',name:'Tessa',x:832,z:-874.25,wants:['linen','wool','wovenCloth']},
  'highmere-tailor':{faction:'highmere',name:'Tailor',x:885,z:-852,wants:['linen','wool','wovenCloth']},
  'highmere-cook':{faction:'highmere',name:'Cook',x:883,z:-805,wants:['bread','berries','herbs']},
  'briar-envoy':{faction:'briar',name:'Tikka',x:61,z:-65,wants:['iron','herbs','bread']},
  'bandit-envoy':{faction:'bandits',name:'Rusk',x:-69,z:-91,wants:['linen','bread','leather']},
});
