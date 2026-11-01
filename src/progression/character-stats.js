import {itemDefinition} from './items.js';
import {ACTIONS} from '../game/combat.js';

export function characterStats(data,registry){
  const armor=data.equipped.reduce((total,id)=>total+(itemDefinition(id,registry).armor??0),0);
  const swordBonus=Math.floor(((data.skills?.sword.level??1)-1)*.5),punchBonus=Math.floor(((data.skills?.unarmed.level??1)-1)*.5);
  const blockBonus=Math.min(.15,((data.skills?.defence.level??1)-1)*.002);
  const sword=data.weapon==='sword',action=ACTIONS[sword?'sword':'punch'];
  return {armor,mitigation:armor/(100+armor),swordBonus,punchBonus,blockBonus,maxHealth:100,maxStamina:100,
    damage:action.damage+(sword?swordBonus:punchBonus),range:action.reach,interval:action.interval,blockChance:(sword?.22:.10)+blockBonus,walkSpeed:1.45,runSpeed:3.9};
}
