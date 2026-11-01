import {weaponAction} from '../game/weapon-catalog.js';
import {inTown} from '../world/terrain.js';
import {inHighmere} from '../world/region-layout.js';
import {horseStride,horseHoofContacts} from '../mounts/gait.js';

export const JOB_SOUNDS=Object.freeze({chop:['chop',1.2,.70],hammer:['metal',Math.PI*2/4.1,.72],mine:['mine',Math.PI*2/4.1,.72],saw:['saw',Math.PI/4,.25],sew:['sew',Math.PI*2/7,.4],shear:['shear',Math.PI/5,.4],gather:['gather',Math.PI*2/3,.4],collect:['gather',Math.PI*2/3,.4],cook:['cook',1.6,.3],brew:['brew',1.8,.3],trade:['trade',2.6,.3],wipe:['wipe',2.6,.4],read:['read',4,.5],sort:['gather',2.2,.5]});
export function swingSound(weapon){const spec=weaponAction(weapon);return spec.ranged?'bow':spec.grip==='unarmed'?'punchSwing':spec.grip==='two-hand'?'greatsword':spec.grip==='spear'?'spear':'sword';}
export function stepSound(position,mounted){const stone=inTown(position.x,position.z)||inHighmere(position.x,position.z);return mounted?(stone?'hoof':'hoofGrass'):(stone?'stepStone':'stepGrass');}

/** Samples only nearby actors, using their actual gait and job/attack state. */
export class WorldSounds {
  constructor(mixer,population){this.mixer=mixer;this.population=population;this.states=new Map();this.nearby=[];this.clock=0;this.refreshAt=0;}
  actor(id,position,state,dt,priority=false){
    const previous=this.states.get(id)??{step:Math.floor((state.phase??0)*2),attack:null,progress:0,job:null,jobTime:0,grounded:true};
    const moving=state.speed>.2&&state.grounded!==false,foot=Math.floor((state.phase??0)*2);
    if(state.mounted){
      const advance=moving?state.speed*dt/horseStride(state.speed):0;
      const phase=state.mountPhase??(previous.mountPhase??0)+advance,start=previous.mounted?previous.mountPhase:phase;
      if(moving)for(const contact of horseHoofContacts(state.speed)){
        if(Math.floor(phase-contact.phase)>Math.floor(start-contact.phase))this.mixer.play(stepSound(position,true),position,{id:id+':hoof:'+contact.leg,volume:contact.weight*(priority?.6:.45),priority});
      }
      previous.mountPhase=phase;
    }else if(moving&&foot!==previous.step)this.mixer.play(stepSound(position,false),position,{id,volume:priority?.6:.45,priority});
    previous.mounted=Boolean(state.mounted);
    previous.step=foot;
    if(!previous.grounded&&state.grounded)this.mixer.play('land',position,{id,priority});previous.grounded=state.grounded!==false;
    const attack=state.action,progress=attack?.progress??0;
    if(previous.attack!==attack||progress<previous.progress)previous.progress=0;
    const cue=weaponAction(state.weapon).ranged?.64:.28;
    if(attack&&progress>=cue&&previous.progress<cue)this.mixer.play(swingSound(state.weapon),position,{id,priority});
    previous.attack=attack;previous.progress=progress;
    const job=state.speed<.12&&!attack?state.activity:null,definition=JOB_SOUNDS[job];
    if(previous.job!==job){previous.jobTime=state.jobTime??0;previous.job=job;}
    if(definition){const [sound,period,phase]=definition,t0=previous.jobTime,t1=state.jobTime??previous.jobTime+dt;
      if(Math.floor(t1/period-phase)>Math.floor(t0/period-phase))this.mixer.play(sound,position,{id,priority});previous.jobTime=t1;}
    this.states.set(id,previous);
  }
  update(dt,player,playerState){
    this.clock+=dt;this.actor('player',player.position,playerState,dt,true);
    if(this.clock>=this.refreshAt){
      this.refreshAt=this.clock+.2;
      this.nearby=this.population.residents.filter(p=>!p.dormant&&p.target.hp>0&&p.position.distanceToSquared(player.position)<38*38).sort((a,b)=>a.position.distanceToSquared(player.position)-b.position.distanceToSquared(player.position)).slice(0,24);
      const keep=new Set(['player',...this.nearby.map(p=>p.id)]);for(const id of this.states.keys())if(!keep.has(id))this.states.delete(id);
    }
    for(const person of this.nearby){
      if(person.dormant||person.target.hp<=0)continue;const unit=person.target,external=unit.externalSimulation;
      const action=external&&unit.strike?{...unit.strike,progress:(unit.simulation.time-unit.attackAt)/unit.attack.duration}:person.audioState?.action;
      // Keep a stable attack identity for the instanced representation as well.
      if(external&&action){person.audioAttack??={};Object.assign(person.audioAttack,action);}
      this.actor(person.id,person.position,external?{speed:unit.speed,phase:unit.phase,action:action?person.audioAttack:null,weapon:unit.weapon,mounted:unit.mounted}:({...person.audioState,phase:person.actor.animator?.phase}),dt);
    }
  }
}
