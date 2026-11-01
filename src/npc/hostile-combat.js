import {Vector3} from 'three';
import {FACTIONS,factionFor} from '../factions/catalog.js';
import {weaponAction} from '../game/weapon-catalog.js';
import {inAttackRange} from '../game/targeting.js';
import {inTown} from '../world/terrain.js';
import {chooseCombatTarget,facePoint} from './motion.js';

/** Monsters use faction hostility and recent aggression, with no player bias. */
export function chooseHostileOpponent(unit,candidates,factions,now){
  const recent=unit.recentAttacker,retaliating=recent&&unit.recentAttackUntil>now;
  const valid=t=>t&&t!==unit&&t.hp>0&&!t.dormant&&Math.hypot(t.position.x-unit.position.x,t.position.z-unit.position.z)<22;
  if(retaliating&&valid(recent))return recent;
  const enemies=FACTIONS[factionFor(unit)]?.enemies??[];
  const hostile=candidates.filter(t=>{
    if(!valid(t))return false;
    if(unit.campRaid){if(t.id==='player')return true;return (t.person?.townId??(t.person?'mosswake':null))===unit.campRaid.town;}
    if(t.id==='player')return !inTown(t.position.x,t.position.z)&&(factions.hostile(unit)||factions.memory.remembers(unit,'player',now));
    return enemies.includes(factionFor(t));
  });
  return chooseCombatTarget(unit,hostile,now)??null;
}

export function updateHostileCombat(unit,dt,{population,factions,world,now=Date.now()}){
  if(!unit.hostile||unit.attackingGate||unit.raidRetreating)return;
  if(now>=(unit.nextThreatScan??0)||unit.combatTarget?.hp<=0){
    const candidates=[...population.residents.filter(p=>!p.cinematic).map(p=>p.target),...population.targets,population.living.player.target];
    const previous=unit.combatTarget,next=chooseHostileOpponent(unit,candidates,factions,now);
    if(next!==previous)unit.windup=0;
    unit.combatTarget=next;
    unit.nextThreatScan=now+450;
  }
  const victim=unit.combatTarget;
  if(!victim||victim.hp<=0||unit.position.distanceTo(victim.position)>24){unit.windup=0;return;}
  unit.engagedUntil=now+1000;
  if(unit.hp<unit.maxHp*.25){
    if(!unit.escapeGoal||Math.hypot(unit.position.x-unit.escapeGoal.x,unit.position.z-unit.escapeGoal.z)<2)unit.escapeGoal=unit.campId?{x:unit.home.x,z:unit.home.z}:population.living.fleeGoal(unit,victim);
    unit.moveSpeed=population.move(unit,new Vector3(unit.escapeGoal.x,0,unit.escapeGoal.z),dt,2.5);unit.moving=unit.moveSpeed>.04;unit.position.y=world.height(unit.position.x,unit.position.z);unit.windup=0;return;
  }
  unit.escapeGoal=null;facePoint(unit,victim.position);if(unit.stagger>0)return;
  const attack=weaponAction(unit.weapon??(unit.kind==='bandit'?'sword':'unarmed'));
  const inRange=inAttackRange(unit.position,victim,attack.reach)&&population.navigation.segmentClear(unit.position,victim.position);
  unit.moving=false;
  if(!unit.windup){
    const goal=population.living.approach.goal(unit,victim,attack.reach,now);
    if(!inRange||unit.position.distanceTo(goal)>.35){unit.moveSpeed=population.move(unit,goal,dt,inRange?1:2.7);unit.moving=unit.moveSpeed>.04;unit.position.y=world.height(unit.position.x,unit.position.z);}
  }
  unit.attackTime=(unit.attackTime??0)-dt;
  if(inRange&&unit.attackTime<=0&&!unit.windup&&!population.living.approach.crowded(unit)){
    unit.attackDuration=attack.duration;unit.windup=attack.duration;unit.attackHit=false;unit.attackCombo=(unit.strikes??0)%2;unit.strikes=(unit.strikes??0)+1;unit.attackTime=attack.interval;
  }
  if(unit.windup>0){
    unit.windup=Math.max(0,unit.windup-dt);
    if(!unit.attackHit&&1-unit.windup/unit.attackDuration>=attack.hit){
      unit.attackHit=true;
      if(inAttackRange(unit.position,victim,attack.reach)&&population.navigation.segmentClear(unit.position,victim.position))population.living.damage(unit,victim,unit.damage??attack.damage,now);
    }
  }
}
