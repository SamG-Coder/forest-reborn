import {characterStats} from '../progression/character-stats.js';
import {weaponAction} from '../game/weapon-catalog.js';

export const FIELD_ENEMIES=Object.freeze([
  {kind:'ashRaider',weapon:'sword',name:'Ash-company raider',level:9,hp:140,damage:16,scale:1,skin:'#c8a07f',outfit:['clothes.traveller-red','legs.traveller','shoes.traveller','body.leather-vest']},
  {kind:'shieldbreaker',weapon:'weapon.greatsword',name:'Ash-company shieldbreaker',level:11,hp:240,damage:22,scale:1.08,skin:'#b99676',outfit:['clothes.traveller-red','legs.traveller','shoes.traveller','body.riveted-mail','head.iron-open','tabard.ash']},
  {kind:'hillGiant',weapon:'unarmed',name:'Hillborn giant',level:13,hp:950,damage:34,scale:2,skin:'#aaa187',outfit:['legs.starter']},
]);

/** These quest enemies are members of the army, with the same targeting,
 * damage, death and respawn logic as every other soldier. */
export function configureFieldRoster(simulation,registry){
  const enemies=simulation.actors.filter(a=>a.team===1);
  for(const spec of FIELD_ENEMIES.slice(1)){
    const id='field:'+spec.kind,data={level:spec.level,weapon:spec.weapon,equipped:spec.outfit,skills:{sword:{level:spec.level},unarmed:{level:spec.level},defence:{level:spec.level}}};
    const stats={...characterStats(data,registry),maxHealth:spec.hp,damage:spec.damage,range:spec.kind==='hillGiant'?3.3:2.95};
    const profile={id,team:1,role:'reserve',variant:0,level:spec.level,weapon:spec.weapon,equipped:spec.outfit,data,stats,attack:weaponAction(spec.weapon),kind:spec.kind==='hillGiant'?'ogre':'human',skin:spec.skin,face:3,bodyType:'male',hair:spec.kind==='hillGiant'?'none':'short'};
    simulation.profiles.push(profile);
    const members=spec.kind==='hillGiant'?enemies.slice(-1):enemies.filter(a=>!a.mounted).slice(-25,-5);
    for(const a of members){
      const health=a.maxHp?Math.min(1,a.hp/a.maxHp):1;
      Object.assign(a,{profile:id,kind:spec.kind,name:spec.name,scale:spec.scale,level:spec.level,weapon:spec.weapon,equipped:[...spec.outfit],stats:{...stats},attack:{...profile.attack},maxHp:spec.hp,hp:Math.round(health*spec.hp),damage:stats.damage,reach:stats.range,mounted:false,mountId:null});
    }
  }
}
