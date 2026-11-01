import {createSkills} from '../progression/skills.js';

// These are established residents of the world, with personal inventories and
// journals. Their background never completes quests in the player's save.
export function veteranBackground(id){
  if(id<12)return null;
  const index=id-12,level=7+index%8;
  const skills=createSkills();
  for(const skill of ['sword','defence','smithing','tailoring','fletching','woodworking','archery'])skills[skill].level=Math.max(3,level-2);
  return {homeTown:'highmere',factionId:'highmere',level,xp:120*(level-1)**2,skills,coins:450+index*85,
    weapon:['weapon.broadsword','weapon.spear','weapon.longbow','weapon.shortshield','weapon.greatsword','weapon.sabre','weapon.warden','weapon.ember'][index%8],
    inventory:{steelScrap:18,coal:8,wood:12,feather:18,linen:12,'arrow.wood':36},tools:{axe:true,shears:true},
    journey:{phase:'quests',age:0,completed:6,quest:index%3===0?'ash-company':index%3===1?'steel-work':null},
    position:[832+(index%4)*9,0,-817-Math.floor(index/4)*26]};
}

export function seedVeteranJournal(data,progress,equipment){
  const background=veteranBackground(data.id);if(!background||data.questProgress)return false;
  const p=progress.data;p.level=background.level;p.skills=data.skills;p.weapon=data.weapon;
  p.equipped=[...equipment];p.owned=[...equipment];p.weapons=[data.weapon];
  for(const id of ['errand','supper','briar','cargo','saddle-earned','north-road'])p.quests[id]={completed:true,active:false,count:1,turnIns:1};
  p.reputation={highmere:18,mosswake:8};progress.save();return true;
}
