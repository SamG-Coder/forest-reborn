import {inTown,TOWN_BOUNDS} from '../world/terrain.js';
import {TOWN_EXIT_MARGIN} from './town-law.js';

export const GUARD_SIGHT=24;
export const GUARD_LEASH=38;
export const planarDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const isGuard=person=>person.type==='guard'||person.id==='captain';

export function canGuardPursue(guard,target,{engaged=false,retaliating=false}={}){
  if(!target||target.hp<=0)return false;
  const p=target.position,anchor=guard.guardAnchor??guard.position;
  if(planarDistance(guard.position,p)>(engaged?GUARD_LEASH:GUARD_SIGHT))return false;
  if(planarDistance(anchor,p)>GUARD_LEASH)return false;
  if(!retaliating)return inTown(p.x,p.z,engaged?TOWN_EXIT_MARGIN:0);
  // A directly attacked guard may defend the gate, but cannot be dragged into the woods.
  return p.x>TOWN_BOUNDS.minX-8&&p.x<TOWN_BOUNDS.maxX+8&&p.z>TOWN_BOUNDS.minZ-8&&p.z<TOWN_BOUNDS.maxZ+8;
}

export function guardReacquisitionBlocked(guard,target,now){
  const released=guard.releasedTargets?.get(target.id);
  if(!released)return false;
  if(now<released||!inTown(target.position.x,target.position.z,-4))return true;
  guard.releasedTargets.delete(target.id);return false;
}

export function releaseGuard(guard,now=Date.now()){
  const target=guard.combatTarget??guard.threat;
  if(target){guard.releasedTargets??=new Map();guard.releasedTargets.set(target.id,now+8000);}
  guard.returnPost=guard.guardAnchor?.clone()??guard.home.clone();
  guard.guardAnchor=null;guard.lawTargetId=null;guard.combatTarget=null;
  guard.threat=null;guard.threatUntil=0;guard.attack=null;guard.pathGoal=null;guard.path=[];
  guard.pathFailedFor=0;
}
