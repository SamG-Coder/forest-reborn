import {inAttackRange} from './targeting.js';
import {SWORD_CUT_COUNT,SWORD_DURATION,SWORD_IMPACT} from './sword-motion.js';
export const ACTIONS=Object.freeze({punch:{duration:.48,hit:.38,reach:1.65,damage:12,cost:9,interval:1.05},sword:{duration:SWORD_DURATION,hit:SWORD_IMPACT,reach:2.4,damage:24,cost:18,interval:1.5}});
export function attackCost(kind,power=0){return ACTIONS[kind].cost*(power>0?1.8:1);}
export function wrapAngle(angle){return Math.atan2(Math.sin(angle),Math.cos(angle));}
export class CombatController {
  constructor({random=Math.random}={}){this.random=random;this.weapon='unarmed';this.target=null;this.action=null;this.stamina=100;this.hp=100;this.combo=0;this.nextSide='L';this.queued=null;this.lastEnd=-10;this.time=0;this.block=false;this.blockTime=0;this.events=[];}
  setTarget(target){if(target===this.target)return;this.target=target;this.action=null;this.queued=null;}
  request(kind=this.weapon==='sword'?'sword':'punch',side=null,speed=0,style='cut',power=0){
    power=Math.max(0,Math.min(1,Number(power)||0));
    if(this.action){if(this.action.progress>.16)this.queued={kind,side,speed,style,power};return false;}
    if(this.block||this.stamina<attackCost(kind,power))return false;
    if(this.time-this.lastEnd>1)this.combo=0;
    this.stamina-=attackCost(kind,power);
    this.action={kind,style,power,damage:Math.round((ACTIONS[kind].damage+(this.stats?.[kind==='sword'?'swordBonus':'punchBonus']??0))*(power>0?1.6+power*.8:1)),side:side??(power>0?'R':this.nextSide),combo:this.combo%SWORD_CUT_COUNT,elapsed:0,progress:0,hit:false,height:1.3,duration:power>0?(kind==='sword'?1.05:.80):ACTIONS[kind].duration*(speed>2?.9:1),target:null};
    this.action.target=this.target;
    this.nextSide=this.action.side==='L'?'R':'L';this.combo++;this.events.push({type:'swing',kind});return true;
  }
  update(dt,player,targets){
    this.time+=dt;this.blockTime=Math.max(0,this.blockTime-dt);this.block=this.blockTime>0;
    this.stamina=Math.min(100,this.stamina+dt*(this.block?-3:this.action?4:21));
    if(!this.action)return;
    const a=this.action;a.elapsed+=dt;a.progress=Math.min(1,a.elapsed/a.duration);
    if(a.target?.hp>0){
      a.height=(a.target.aimHeight??a.target.height*.75)+a.target.position.y-player.position.y;
      const wanted=Math.atan2(a.target.position.x-player.position.x,a.target.position.z-player.position.z);
      player.yaw+=wrapAngle(wanted-player.yaw)*(1-Math.exp(-dt*22));
    }
    const definition=ACTIONS[a.kind];
    if(!a.hit&&a.progress>=definition.hit){
      a.hit=true;
      const target=a.target;
      if(inAttackRange(player.position,target,definition.reach)&&(!this.canDamage||this.canDamage(target))){const damage=Math.min(target.hp,a.damage);target.hp-=damage;target.flash=.16;target.stagger=.22;this.events.push({type:'hit',target,damage,power:a.power,dead:target.hp===0,kind:a.kind});}
      else if(target)this.events.push({type:'miss',reason:target.hp<=0?'Target defeated':'Out of range'});
    }
    if(this.queued&&a.progress>=(a.kind==='sword'?.70:.76)){
      const queued=this.queued;this.queued=null;
      if(this.stamina>=attackCost(queued.kind,queued.power)){
        this.action=null;this.lastEnd=this.time;
        this.request(queued.kind,queued.side,queued.speed,queued.style,queued.power);
        this.action.chained=true;
        return;
      }
    }
    if(a.progress>=1){this.action=null;this.lastEnd=this.time;if(this.queued){const q=this.queued;this.queued=null;this.request(q.kind,q.side,q.speed,q.style,q.power);}}
  }
  receive(damage,attacker,player){
    const angle=Math.abs(wrapAngle(Math.atan2(attacker.x-player.position.x,attacker.z-player.position.z)-player.yaw));
    const chance=(this.weapon==='sword'?.22:.10)+(this.stats?.blockBonus??0);
    if(angle<1.2&&this.stamina>=8&&this.random()<chance){
      this.stamina-=8;this.blockTime=.42;this.block=true;this.action=null;this.queued=null;
      this.events.push({type:'blocked'});return 0;
    }
    damage=Math.min(this.hp,Math.max(1,Math.round(damage*(1-(this.stats?.mitigation??0)))));this.hp-=damage;if(damage>0)this.events.push({type:'hurt',damage});return damage;
  }
  reset(){this.hp=100;this.stamina=100;this.action=null;this.queued=null;this.block=false;this.blockTime=0;}
}
