import {inAttackRange} from './targeting.js';
import {SWORD_CUT_COUNT,SWORD_DURATION,SWORD_IMPACT} from './sword-motion.js';
import {isWeapon,weaponAction} from './weapon-catalog.js';
import {resolveStrike} from './combat-rules.js';
import {mountedAttack,chargeContact} from '../mounts/combat.js';
import {createArrowShot,arrowHits} from './archery.js';
export const ACTIONS=Object.freeze({punch:{duration:.48,hit:.38,reach:1.65,damage:12,cost:9,interval:1.05},sword:{duration:SWORD_DURATION,hit:SWORD_IMPACT,reach:2.4,damage:24,cost:18,interval:1.5}});
export function attackCost(kind,power=0,weapon='sword'){return (kind==='sword'?weaponAction(weapon).cost:ACTIONS[kind].cost)*(power>0?1.8:1);}
export function wrapAngle(angle){return Math.atan2(Math.sin(angle),Math.cos(angle));}
export class CombatController {
  constructor({random=Math.random}={}){this.random=random;this.weapon='unarmed';this.target=null;this.action=null;this.stamina=100;this.hp=100;this.combo=0;this.nextSide='L';this.queued=null;this.lastEnd=-10;this.time=0;this.block=false;this.blockTime=0;this.events=[];this.shots=[];this.chargeReadyAt=0;}
  setTarget(target){if(target===this.target)return;this.target=target;this.action=null;this.queued=null;}
  request(kind=isWeapon(this.weapon)?'sword':'punch',side=null,speed=0,style='cut',power=0){
    power=Math.max(0,Math.min(1,Number(power)||0));
    if(weaponAction(this.weapon).ranged&&!this.hasArrow?.())return false;
    if(this.action){if(this.action.progress>.16)this.queued={kind,side,speed,style,power};return false;}
    if(this.block||this.stamina<attackCost(kind,power,this.weapon))return false;
    if(this.time-this.lastEnd>1)this.combo=0;
    this.stamina-=attackCost(kind,power,this.weapon);
    this.action={kind,style,power,damage:Math.round((ACTIONS[kind].damage+(this.stats?.[kind==='sword'?'swordBonus':'punchBonus']??0))*(power>0?1.6+power*.8:1)),side:side??(power>0?'R':this.nextSide),combo:this.combo%SWORD_CUT_COUNT,elapsed:0,progress:0,hit:false,height:1.3,duration:power>0?(kind==='sword'?1.05:.80):ACTIONS[kind].duration*(speed>2?.9:1),target:null};
    if(kind==='sword'){
      const w=mountedAttack(this.weapon==='sword'||!isWeapon(this.weapon)?ACTIONS.sword:weaponAction(this.weapon),{mounted:this.mounted,speed});this.action.damage=Math.round((w.damage+(this.stats?.swordBonus??0))*(power>0?1.6+power*.8:1));
      this.action.duration=w.duration*(power>0?1.3:1);this.action.definition=w;
      this.action.weapon=this.weapon;this.action.style=w.animation??style;
      this.action.mounted=Boolean(this.mounted);
    }
    this.action.target=this.target;
    this.nextSide=this.action.side==='L'?'R':'L';this.combo++;this.events.push({type:'swing',kind});return true;
  }
  update(dt,player,targets){
    this.time+=dt;this.blockTime=Math.max(0,this.blockTime-dt);this.block=this.blockTime>0;
    this.stamina=Math.min(100,this.stamina+dt*(this.block?-3:this.action?4:21));
    this.shots=this.shots.filter(({shot,target,action})=>{if(this.time<shot.end)return true;if(arrowHits(shot,target)&&(!this.canDamage||this.canDamage(target)))this.hitTarget(player,target,shot.damage,action,shot.penetration);else this.events.push({type:'miss',reason:'Arrow missed'});return false;});
    if(!this.action)return;
    const a=this.action;a.elapsed+=dt;a.progress=Math.min(1,a.elapsed/a.duration);
    if(a.target?.hp>0){
      a.height=(a.target.aimHeight??a.target.height*.75)+a.target.position.y-player.position.y;
      const wanted=Math.atan2(a.target.position.x-player.position.x,a.target.position.z-player.position.z);
      a.aimSide=Math.sin(wanted-player.yaw)>.1?1:-1;
      // A passing strike turns the rider's arm, not the moving horse underneath.
      if(!a.mounted||player.speed<.3)player.yaw+=wrapAngle(wanted-player.yaw)*(1-Math.exp(-dt*22));
    }
    const definition=a.definition??ACTIONS[a.kind];
    if(!a.hit&&a.progress>=definition.hit){
      a.hit=true;
      const target=a.target;
      if(inAttackRange(player.position,target,definition.reach)&&(!this.canDamage||this.canDamage(target))){
        if(definition.ranged){
          const arrow=this.consumeArrow?.();
          if(arrow){const shot=createArrowShot({...player,id:'player',aimHeight:this.mounted?2.05:1.4},target,{time:this.time,speed:definition.projectileSpeed,damage:a.damage,arrow});this.shots.push({shot,target,action:{...a,skill:'archery'}});this.events.push({type:'arrow',shot});}
        }else this.hitTarget(player,target,a.damage,a);
      }
      else if(target)this.events.push({type:'miss',reason:target.hp<=0?'Target defeated':'Out of range'});
    }
    if(this.queued&&a.progress>=(a.kind==='sword'?.70:.76)){
      const queued=this.queued;this.queued=null;
      if(this.stamina>=attackCost(queued.kind,queued.power,this.weapon)){
        this.action=null;this.lastEnd=this.time;
        this.request(queued.kind,queued.side,queued.speed,queued.style,queued.power);
        this.action.chained=true;
        return;
      }
    }
    if(a.progress>=1){this.action=null;this.lastEnd=this.time;if(this.queued){const q=this.queued;this.queued=null;this.request(q.kind,q.side,q.speed,q.style,q.power);}}
  }
  hitTarget(player,target,damage,action={},penetration=0){
    const facing=wrapAngle(Math.atan2(player.position.x-target.position.x,player.position.z-target.position.z)-(target.root?.rotation.y??0));
    const hit=resolveStrike({damage,defender:target.stats,facing,stamina:target.stamina??100,random:this.random,penetration});
    if(hit.blocked){target.stamina=Math.max(0,(target.stamina??100)-hit.staminaCost);target.blockUntil=this.time+.42;this.events.push({type:'target-blocked',target});}
    else {const dealt=Math.min(target.hp,hit.damage);target.hp-=dealt;target.flash=.16;target.stagger=.22;this.events.push({type:'hit',target,damage:dealt,power:action.power??0,dead:target.hp===0,kind:action.kind??'sword',skill:action.skill,effect:action.definition?.effect});}
  }
  charge(player,previous,targets){
    if(!this.mounted||this.time<this.chargeReadyAt||player.speed<3.5)return;
    for(const target of targets){
      if(target.hp<=0||this.canDamage&&!this.canDamage(target))continue;
      const contact=chargeContact(previous,player.position,target.position,{speed:player.speed,weapon:weaponAction(this.weapon),targetWeapon:target.attack??weaponAction(target.weapon),targetSpeed:target.speed??0,targetYaw:target.yaw??target.root?.rotation.y??0});
      if(!contact)continue;
      this.chargeReadyAt=this.time+1.4;this.hitTarget(player,target,contact.damage,{kind:'sword',skill:'riding'});
      if(contact.counter)this.receive(contact.counter,target.position,player);
      return;
    }
  }
  receive(damage,attacker,player,penetration=0){
    const angle=Math.abs(wrapAngle(Math.atan2(attacker.x-player.position.x,attacker.z-player.position.z)-player.yaw));
    const chance=this.stats?.blockChance??((weaponAction(this.weapon).blockChance??(isWeapon(this.weapon)?.22:.10))+(this.stats?.blockBonus??0));
    const strike=resolveStrike({damage,defender:{...this.stats,blockChance:chance},facing:angle,stamina:this.stamina,random:this.random,penetration});
    if(strike.blocked){
      this.stamina-=8;this.blockTime=.42;this.block=true;this.action=null;this.queued=null;
      this.events.push({type:'blocked'});return 0;
    }
    damage=Math.min(this.hp,strike.damage);this.hp-=damage;if(damage>0)this.events.push({type:'hurt',damage});return damage;
  }
  reset(){this.hp=100;this.stamina=100;this.action=null;this.queued=null;this.block=false;this.blockTime=0;this.shots=[];this.chargeReadyAt=0;}
}
