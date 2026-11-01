import {PEDESTRIAN_SPEED} from '../game/locomotion-speed.js';
import {recordHitImpact} from '../game/hit-impact.js';
import {guardLines} from '../audio/dialogue-lines.js';
import {weaponAction,isWeapon} from '../game/weapon-catalog.js';
import {createArrowShot,arrowHits,selectedArrow,spendArrow} from '../game/archery.js';
import {characterStats} from '../progression/character-stats.js';
import {createGearRegistry} from '../gear/catalog.js';
import {resolveStrike} from '../game/combat-rules.js';
import {Vector3} from 'three';
import {inTown,terrainHeight} from '../world/terrain.js';
import {flagState,updatePvpFlag,requestPvpFlag,shouldFlee,recordPlayerKill} from './society.js';
import {TownLaw,nearestTownExit} from './town-law.js';
import {SWORD_CUT_COUNT} from '../game/sword-motion.js';
import {inAttackRange} from '../game/targeting.js';
import {CombatApproach} from './combat-approach.js';
import {facePoint,chooseCombatTarget} from './motion.js';
import {canGuardPursue,releaseGuard,guardReacquisitionBlocked,isGuard,planarDistance} from './guard-policy.js';

const distance=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.z-b.position.z);
const targetPosition=goal=>new Vector3(goal.x,0,goal.z);
export const RESIDENT_RESPAWN_MS=45000;

/** Combat and safety decisions interrupt jobs; when safe, residents resume their work. */
export class LivingWorld {
  constructor(residents,monsters,simulation,navigation,move){
    Object.assign(this,{residents,monsters,simulation,navigation,move});this.player=null;this.now=Date.now();
    this.gearRegistry=createGearRegistry();this.damageEvents=[];this.speechEvents=[];this.recordDamage=true;
    this.shots=[];this.projectileEvents=[];
    this.law=new TownLaw((text,now,speech)=>{simulation.society.announce(text,now);if(speech)this.guardSays(this.residents.find(p=>p.id===speech.guardId),speech.text,now,speech.subjectId);});
    for(const person of residents){
      person.maxHp=person.type==='guard'?160:100;person.health=person.maxHp;person.pvp=flagState();
      const target={id:person.id,name:person.name,person,kind:'resident',root:person.actor.root,position:person.position,height:1.3,aimHeight:1.15,materials:[person.actor.avatar.materials.skin],flash:0,stagger:0};
      Object.defineProperties(target,{hp:{get:()=>person.data?.health??person.health,set:value=>{if(person.data)person.data.health=value;else person.health=value;}},maxHp:{get:()=>person.maxHp},pvp:{get:()=>person.data?.pvp??person.pvp},level:{get:()=>person.data?simulation.level(person.data):person.type==='guard'?5:1}});
      person.target=target;
    }
    this.units=()=>[...this.residents.filter(p=>!p.dormant&&!p.cinematic&&!p.target.externalSimulation).map(p=>p.target),...this.monsters.filter(t=>!t.dormant&&!t.externalSimulation),...(this.player?.isActive()?[this.player.target]:[])];
    this.approach=new CombatApproach(navigation,this.units);
  }
  bindPlayer({player,combat,progress,isActive,name}){
    progress.data.pvp=flagState(progress.data.pvp);
    const target={id:'player',name,position:player.position,kind:'player',maxHp:100,height:1.3};
    Object.defineProperties(target,{hp:{get:()=>combat.hp,set:v=>combat.hp=v},pvp:{get:()=>progress.data.pvp}});
    target.receive=(damage,attacker,penetration=0)=>player.dodge>0?0:combat.receive(damage,attacker.position,player,penetration);
    this.player={target,progress,isActive};
  }
  guild(unit){return this.simulation.society.guildFor(unit.id==='player'?'player':unit.person?.data?.id)?.id;}
  canPlayerAttack(target){
    if(target?.battleLocked)return false;
    if(target?.externalSimulation)return target.hp>0&&(target.hostile||this.player?.target.pvp.enabled);
    if(!target?.person)return true;
    const player=this.player?.target;if(!player||player.hp<=0||target.hp<=0)return false;
    if(target.person.type==='adventurer')return target.pvp.enabled&&(!this.guild(player)||this.guild(player)!==this.guild(target));
    return player.pvp.enabled||target.person.threat===player;
  }
  autoTargets(){return this.residents.filter(p=>p.target.hp>0&&(p.type==='adventurer'?this.canPlayerAttack(p.target):p.threat===this.player?.target)).map(p=>p.target);}
  guardSays(person,text,now=this.now,subjectId=null){
    if(!person||!this.recordDamage||person.dormant||person.target?.hp<=0)return;
    if(person.lastBark===text&&now-(person.lastBarkAt??0)<15000)return;
    person.lastBark=text;person.lastBarkAt=now;
    this.speechEvents.push({person,text,now,subjectId});if(this.speechEvents.length>16)this.speechEvents.shift();
  }
  aggression(attacker,target,now=this.now){
    if(target.externalSimulation){target.revengeTarget=attacker.id;target.revengeUntil=target.simulation.time+15;target.opponent=attacker.id;target.decideAt=target.simulation.time+1;return;}
    const adventurer=(attacker.id==='player'||attacker.person?.type==='adventurer')&&(target.person||target.id==='player');
    if(attacker.pvp&&adventurer){attacker.pvp.enabled=true;attacker.pvp.clearAt=0;attacker.pvp.combatUntil=now+30000;}
    if(target.person){if(isGuard(target.person)&&target.person.threat!==attacker){const p=target.person;p.attackBark=(p.attackBark??-1)+1;this.guardSays(p,guardLines.attacked[p.attackBark%guardLines.attacked.length],now,attacker.id);}target.person.threat=attacker;target.person.threatUntil=now+20000;}
    if(target.person&&target.person.type!=='adventurer'&&attacker.pvp&&adventurer)attacker.pvp.wantedUntil=now+60000;
    if(target.pvp?.enabled){target.pvp.clearAt=0;target.pvp.combatUntil=now+30000;}
  }
  playerAttacks(target){if(target.person)this.aggression(this.player.target,target);}
  reportDamage(target,before){
    const amount=before-target.hp;
    if(!this.recordDamage||amount<=0)return;
    if(this.damageEvents.length>=128)this.damageEvents.shift();
    this.damageEvents.push({target:{id:target.id,position:target.position.clone(),height:target.height},amount});
  }
  combatSpec(person){
    const weapon=person.data?.weapon??person.weapon??'sword';
    const data={level:person.data?this.simulation.level(person.data):5,weapon,equipped:person.data?.questProgress?.equipped??[...person.actor?.wardrobe?.entries?.values?.()??[]].map(e=>e.definition.id),skills:person.data?.skills};
    return {weapon,action:weaponAction(weapon),stats:characterStats(data,this.gearRegistry)};
  }
  damage(attacker,target,amount,now,penetration=0){
    if(target.hp<=0||target.battleLocked)return;
    const before=target.hp;
    const defender=target.stats??(target.person?this.combatSpec(target.person).stats:null);
    if(defender&&!target.receive){
      const hit=resolveStrike({damage:amount,defender,facing:0,stamina:target.person?.data?.stamina??100,random:Math.random,penetration});
      amount=hit.blocked?0:hit.damage;
    }
    if(target.receive)target.receive(amount,attacker,penetration);else target.hp=Math.max(0,target.hp-amount);
    if(target.hp<before){target.recentAttacker=attacker;target.recentAttackUntil=now+12000;
      const source={...attacker,weapon:attacker.person?.data?.weapon??attacker.person?.weapon??attacker.weapon??(attacker.kind==='bandit'?'sword':'unarmed'),strikes:attacker.person?.strikes??attacker.strikes};
      recordHitImpact(target,source,before-target.hp);this.blood?.hit(target,source,before-target.hp,this.player?.target.position);this.townLife?.recordHit(target,attacker,before-target.hp);
    }
    // Player damage is already reported by CombatController, including blocks.
    if(!target.receive)this.reportDamage(target,before);
    if(before>target.hp&&attacker.person?.data){
      this.simulation.landedHit(attacker.person.data,target);
      this.simulation.society.recordBountyHit(attacker.person.data.id,target);
      this.simulation.factions?.harm(target,{id:attacker.id,factionId:attacker.person.factionId,level:this.simulation.level(attacker.person.data)},now);
      this.simulation.record(attacker.person.data,'fight',`hit ${target.name}`,now);
    }
    target.flash=.16;
    if(target.person){target.person.threat=attacker;target.person.threatUntil=now+20000;}
    if(target.pvp?.enabled)target.pvp.combatUntil=now+30000;
    if(attacker.pvp?.enabled)attacker.pvp.combatUntil=now+30000;
    if(target.hp<=0&&(target.id==='player'||target.person?.type==='adventurer')&&attacker.person?.type==='adventurer')recordPlayerKill(attacker.pvp,now);
    if(target.hp<=0&&attacker.person?.data)this.simulation.defeated(attacker.person.data,target,now);
    if(target.hp<=0&&target.id==='player')return;
    if(target.hp<=0&&(target.externalSimulation||!target.person)){this.defeatTarget?.(target,now,attacker);return;}
    if(target.hp<=0&&target.person){
      this.defeat(target.person,now,attacker);this.simulation.society.contribute(attacker.id==='player'?'player':attacker.person?.data?.id,'pvp',target.position,now);
      this.simulation.society.announce(`${attacker.name} defeated ${target.name}.`,now);
    }
  }
  defeat(person,now=this.now,killer=null){
    person.target.hp=0;person.respawnAt=now+RESIDENT_RESPAWN_MS;this.corpses?.kill(person.target,now,killer);person.attack=null;person.threat=null;person.skillAction?.cancel();person.pathGoal=null;
  }
  fleeGoal(person,threat){
    const dx=person.position.x-threat.position.x,dz=person.position.z-threat.position.z,angle=Math.atan2(dx,dz);
    const candidates=[0,.7,-.7,1.4,-1.4,Math.PI].map(turn=>({x:Math.max(-140,Math.min(140,person.position.x+Math.sin(angle+turn)*15)),z:Math.max(-140,Math.min(140,person.position.z+Math.cos(angle+turn)*15))}));
    return candidates.find(p=>this.navigation.walkable(p.x,p.z))??nearestTownExit(person.position);
  }
  prepare(dt,now){
    this.now=now;
    this.shots=this.shots.filter(({shot,source,target})=>{if(now/1000<shot.end)return true;if(arrowHits(shot,target)&&this.navigation.segmentClear(source.position,target.position,shot.volley))this.damage(source,target,shot.damage,now,shot.penetration);return false;});
    this.approach.update(now);
    for(const person of this.residents){
      if(person.cinematic||person.dormant||person.externalSchedule)continue;
      if(person.target.hp<=0){
        person.respawnAt??=now+RESIDENT_RESPAWN_MS;
        if(now>=person.respawnAt){
          this.corpses?.restore(person.target);this.blood?.clear(person.target);person.sleeping=false;person.actor.root.rotation.x=0;person.target.hp=person.maxHp;person.respawnAt=0;person.threat=null;person.attack=null;person.intent=null;person.pathGoal=null;person.townExit=null;
          person.guardAnchor=null;person.returnPost=null;person.combatTarget=null;person.lawTargetId=null;
          const home=person.data?.homeTown==='highmere'?person.home:person.data?{x:2+(person.data.id%3),z:55}:person.home;person.position.set(home.x,terrainHeight(home.x,home.z),home.z);
          const skullUntil=person.target.pvp.skullUntil;Object.assign(person.target.pvp,flagState(),{skullUntil});if(person.data){person.data.task='rest';person.data.stamina=60;}
        }
      }
      person.intent=null;updatePvpFlag(person.target.pvp,person.position,now);
      if(person.threat&&(person.threat.hp<=0||now>person.threatUntil||distance(person.target,person.threat)>30))person.threat=null;
      if(!person.data&&!person.threat&&person.target.hp>0)person.target.hp=Math.min(person.maxHp,person.target.hp+dt*.8);
    }
    const subjects=this.residents.filter(p=>!p.dormant&&!p.cinematic&&!p.externalSchedule).map(p=>p.target),human=this.player?.isActive()?this.player.target:null;
    if(human){updatePvpFlag(human.pvp,human.position,now);subjects.push(human);}
    const guards=this.residents.filter(p=>!p.dormant&&(p.type==='guard'||p.id==='captain')).map(p=>p.target);
    this.law.update(subjects,guards,now);
    const event=this.simulation.society.event;
    for(const person of this.residents){
      if(person.cinematic||person.dormant||person.externalSchedule||person.companion)continue;
      const unit=person.target;if(unit.hp<=0)continue;
      if(person.deployment){
        const deployment=person.deployment,near=deployment.units.filter(t=>t.hp>0&&t.team!==deployment.team&&distance(unit,t)<22);
        const enemy=person.threat?.hp>0?person.threat:chooseCombatTarget(person,near,now);
        if(enemy){person.intent={type:'fight',target:enemy};continue;}
        if(!deployment.simulation.winner){
          const company=deployment.simulation.companies.find(c=>c.team===deployment.team&&c.alive>0);
          person.intent={type:'rally',goal:{x:deployment.site.x+(company?.cx??-25),z:deployment.site.z+(company?.cz??0)},label:'Joining the defence'};continue;
        }
      }
      if(isGuard(person)){
        if(person.returnPost){
          if(person.threat&&canGuardPursue(person,person.threat,{retaliating:true})){person.returnPost=null;person.guardAnchor=person.position.clone();}
          else if(planarDistance(person.position,person.returnPost)<.8){person.returnPost=null;person.pathGoal=null;}
          else{person.intent={type:'return',goal:person.returnPost,label:'Returning to patrol'};continue;}
        }
        const prior=person.combatTarget??person.threat;
        const retaliating=Boolean(person.threat&&person.threat.id!==person.lawTargetId);
        const continuing=prior&&canGuardPursue(person,prior,{engaged:true,retaliating})&&(retaliating||this.law.hostiles.has(prior.id));
        if(person.guardAnchor&&(!continuing||person.pathFailedFor>3)){
          releaseGuard(person,now);person.intent={type:'return',goal:person.returnPost,label:'Returning to patrol'};continue;
        }
        const candidates=subjects.filter(s=>s!==unit&&this.law.hostiles.has(s.id)&&canGuardPursue(person,s)&&!guardReacquisitionBlocked(person,s,now));
        const criminal=continuing?prior:chooseCombatTarget(person,candidates,now);
        if(criminal){
          person.guardAnchor??=person.position.clone();person.combatTarget=criminal;
          if(!retaliating)person.lawTargetId=criminal.id;
          person.threat=criminal;person.threatUntil=now+3000;person.intent={type:'fight',target:criminal};continue;
        }
        // An expired/out-of-range threat must not fall through to the generic fighter AI.
        person.threat=null;
      }
      // Leaving town is a committed task, not a single frame's response to a
      // warning. Wait outside until safe to return before resuming a town job.
      if(person.data){
        const warning=this.law.warnings.get(unit.id),compliant=person.data.personality.greed+person.data.personality.courage<1.35;
        if((warning&&compliant)||unit.pvp.enabled&&unit.pvp.clearRequested){
          if(!person.townExit){const goal={...nearestTownExit(person.position)},offset=(person.data.id%5-2)*1.35;if(goal.x===0)goal.x+=offset;else goal.z+=offset;person.townExit={goal};}
        }
        if(person.townExit){
          if(!unit.pvp.enabled&&unit.pvp.wantedUntil<=now){person.townExit=null;person.pathGoal=null;}
          else{
            requestPvpFlag(unit.pvp,false,person.position,now);
            if(isGuard(person.threat?.person??{})){person.threat=null;person.threatUntil=0;}
            const goal=person.townExit.goal,arrived=planarDistance(person.position,goal)<1;
            person.intent={type:'leave',goal,label:arrived?'Waiting outside for the PvP flag to clear':'Leaving town after the warning'};continue;
          }
        }
      }
      const courage=person.data?.personality.courage??(person.type==='guard'||person.id==='captain'?.9:.15);
      if(person.threat&&shouldFlee(unit.hp,unit.maxHp,courage)){
        person.escapeGoal??=this.fleeGoal(person,person.threat);if(Math.hypot(person.position.x-person.escapeGoal.x,person.position.z-person.escapeGoal.z)<2)person.escapeGoal=this.fleeGoal(person,person.threat);
        person.intent={type:'flee',goal:person.escapeGoal,label:'Retreating from '+person.threat.name};continue;
      }
      person.escapeGoal=null;
      if(person.threat&&(person.threat.person||person.threat.id==='player')){
        if(person.type==='worker'||person.type==='patron'||person.type==='quest'&&person.id!=='captain')person.intent={type:'flee',goal:this.fleeGoal(person,person.threat),label:'Running for safety'};
        else person.intent={type:'fight',target:person.threat};continue;
      }
      if(person.data){
        const guild=this.simulation.society.guildFor(person.data.id);
        if(event?.type==='roadClaim'&&guild&&guild.ethos!=='trade'&&person.data.health>50){
          unit.pvp.enabled=true;unit.pvp.clearAt=0;unit.pvp.clearRequested=false;
          const rival=chooseCombatTarget(person,subjects.filter(s=>s!==unit&&s.hp>0&&s.pvp?.enabled&&this.guild(s)!==guild.id&&(guild.ethos==='outlaw'||this.simulation.society.guilds.find(g=>g.id===this.guild(s))?.ethos==='outlaw')&&distance(unit,s)<24),now);
          person.intent=rival?{type:'fight',target:rival}:{type:'rally',goal:{x:event.x+(person.data.id%3)*1.5,z:event.z+(guild.ethos==='outlaw'?-3:3)},label:guild.ethos==='outlaw'?'Claiming the north road':'Challenging the road claim'};
        }else if(unit.pvp.enabled&&!inTown(person.position.x,person.position.z)&&person.data.personality.greed<.8&&!unit.pvp.clearAt&&unit.pvp.combatUntil<=now)requestPvpFlag(unit.pvp,false,person.position,now);
      }
    }
  }
  behaviour(person,dt,now){
    const intent=person.intent;if(!intent)return null;
    person.skillAction?.cancel();let speed=0,action=null,armed=false;
    if(intent.type==='fight'){
      const target=intent.target,{weapon,action:spec,stats}=this.combatSpec(person);armed=isWeapon(weapon);person.activity='Fighting '+target.name;
      if(target.hp>0){
        const reach=stats.range,goal=this.approach.goal(person.target,target,reach,now);
        const clear=this.navigation.segmentClear(person.position,target.position),volley=Boolean(person.archer&&!clear&&this.navigation.segmentClear(person.position,target.position,true));
        const inRange=inAttackRange(person.position,target,reach)&&(clear||volley);
        const crowded=!spec.ranged&&this.approach.crowded(person.target),journal=this.simulation.questAgents?.get(person.data?.id),ammo=journal?.progress.data??person.data?.questProgress??(person.ammo??={ammunition:{'arrow.wood':60}});
        if(!inRange||crowded)speed=this.move(person,goal,dt,inRange?1.1:PEDESTRIAN_SPEED.run);
        if(spec.ranged&&distance(person.target,target)<5){const dx=person.position.x-target.position.x,dz=person.position.z-target.position.z,d=Math.hypot(dx,dz)||1;speed=this.move(person,new Vector3(person.position.x+dx/d*8,person.position.y,person.position.z+dz/d*8),dt,2.5);}
        facePoint(person,target.position);
        if(inRange&&!crowded&&(!spec.ranged||selectedArrow(ammo))){
          if(!person.attack&&now>=(person.nextStrikeAt??0)){person.attack={kind:spec.kind,weapon,style:spec.animation??'cut',side:'R',combo:(person.strikes??0)%SWORD_CUT_COUNT,elapsed:0,progress:0,height:target.height,hit:false,target};person.strikes=(person.strikes??0)+1;person.nextStrikeAt=now+spec.interval*1000;}
        }
        if(person.attack?.target!==target)person.attack=null;
        if(person.attack){action=person.attack;action.elapsed+=dt;action.progress=Math.min(1,action.elapsed/spec.duration);
          if(action.progress>=spec.hit&&!action.hit){
            action.hit=true;
            if(inAttackRange(person.position,target,reach)&&(clear||volley)){
              this.aggression(person.target,target,now);
              if(spec.ranged){const arrow=spendArrow(ammo);if(arrow){journal?.syncOut();const shot=createArrowShot(person.target,target,{time:now/1000,speed:spec.projectileSpeed,damage:stats.damage,arrow});if(volley){shot.volley=true;shot.arc=13;shot.end+=.7;}this.shots.push({shot,source:person.target,target});if(this.projectileEvents.length<256)this.projectileEvents.push(shot);}}
              else this.damage(person.target,target,stats.damage,now);
            }
          }
          if(action.progress>=1)person.attack=null;
        }
      }
    }else{
      person.attack=null;person.activity=intent.label;
      if(Math.hypot(person.position.x-intent.goal.x,person.position.z-intent.goal.z)>(intent.type==='return'?.65:1))speed=this.move(person,targetPosition(intent.goal),dt,intent.type==='return'?1.6:intent.type==='rally'?2.8:PEDESTRIAN_SPEED.run);
      if(intent.type==='flee'&&person.threat&&distance(person.target,person.threat)>15){person.threat=null;person.threatUntil=0;}
    }
    if(person.data)person.data.activity=person.activity;
    return {speed,action,armed,weaponId:person.data?.weapon??person.weapon??'sword',activity:'rest',seated:false};
  }
}
