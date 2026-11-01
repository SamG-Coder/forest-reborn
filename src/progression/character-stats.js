import {PEDESTRIAN_SPEED} from '../game/locomotion-speed.js';
import {itemDefinition} from './items.js';
import {isWeapon,weaponAction} from '../game/weapon-catalog.js';

export function characterStats(data,registry){
  const action=weaponAction(data.weapon);
  const armor=data.equipped.reduce((total,id)=>total+(itemDefinition(id,registry).armor??0),0)+(action.shieldArmor??0);
  const swordBonus=Math.floor(((data.skills?.[action.ranged?'archery':'sword']?.level??1)-1)*.5),punchBonus=Math.floor(((data.skills?.unarmed?.level??1)-1)*.5);
  const blockBonus=Math.min(.15,((data.skills?.defence?.level??1)-1)*.002);
  const sword=isWeapon(data.weapon);
  return {armor,mitigation:armor/(100+armor),swordBonus,punchBonus,blockBonus,maxHealth:100,maxStamina:100,
    damage:action.damage+(sword?swordBonus:punchBonus),range:action.reach,interval:action.interval,blockChance:(action.blockChance??(sword?.22:.10))+blockBonus,walkSpeed:PEDESTRIAN_SPEED.walk,runSpeed:PEDESTRIAN_SPEED.run};
}
