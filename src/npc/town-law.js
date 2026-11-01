import {inTown} from '../world/terrain.js';
import {guardLines} from '../audio/dialogue-lines.js';

export const GUARD_WARNING_MS=10000;
export const TOWN_EXIT_MARGIN=6;
export class TownLaw {
  constructor(announce){this.announce=announce;this.warnings=new Map();this.recentWarnings=new Map();this.hostiles=new Set();this.warningNumber=0;this.escalationNumber=0;}
  update(subjects,guards,now){
    this.hostiles.clear();const present=new Set();
    for(const [id,warning]of this.recentWarnings)if(warning.expires<=now)this.recentWarnings.delete(id);
    for(const unit of subjects){
      const flag=unit.pvp;
      if(unit.hp<=0||!flag?.enabled&&!(flag?.wantedUntil>now)){this.recentWarnings.delete(unit.id);continue;}
      const inside=inTown(unit.position.x,unit.position.z);present.add(unit.id);
      // Finish an existing encounter beyond the gate. A few centimetres across
      // the town line must not repeatedly end and restart the same encounter.
      const atGate=this.warnings.has(unit.id)&&inTown(unit.position.x,unit.position.z,TOWN_EXIT_MARGIN);
      if(!inside&&!atGate){const old=this.warnings.get(unit.id);if(old)this.recentWarnings.set(unit.id,{...old,expires:now+30000});this.warnings.delete(unit.id);continue;}
      const guard=guards.filter(g=>g.hp>0&&Math.hypot(g.position.x-unit.position.x,g.position.z-unit.position.z)<30).sort((a,b)=>Math.hypot(a.position.x-unit.position.x,a.position.z-unit.position.z)-Math.hypot(b.position.x-unit.position.x,b.position.z-unit.position.z))[0];
      let warning=this.warnings.get(unit.id);
      // Crossing the boundary by a few centimetres must not restart warnings
      // every frame or grant another ten seconds to someone chasing a target.
      if(!warning&&this.recentWarnings.has(unit.id)){warning={...this.recentWarnings.get(unit.id)};this.warnings.set(unit.id,warning);}
      if(!warning&&guard){
        warning={id:unit.id,guardId:guard.id,deadline:now+GUARD_WARNING_MS};this.warnings.set(unit.id,warning);
        const text=guardLines.warning[this.warningNumber++%guardLines.warning.length](unit.name);
        this.announce(`${guard.name}: ${text}`,now,{guardId:guard.id,subjectId:unit.id,text});
      }
      if(warning&&(now>=warning.deadline||flag.wantedUntil>now)){
        this.hostiles.add(unit.id);
        if(!warning.escalated){warning.escalated=true;this.announce(`The watch is moving to remove ${unit.name} from town.`,now,{guardId:warning.guardId,subjectId:unit.id,text:guardLines.escalate[this.escalationNumber++%guardLines.escalate.length]});}
      }
    }
    for(const id of this.warnings.keys())if(!present.has(id))this.warnings.delete(id);
  }
}

export function nearestTownExit(position){
  return [{x:0,z:55},{x:0,z:-61},{x:59,z:0},{x:-59,z:0}].sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0];
}
