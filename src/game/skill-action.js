import {GATHERING} from '../progression/skills.js';

/** Shared timed interaction. Movement, an exhausted node, or combat cancels it. */
export class SkillAction {
  constructor(){this.current=null;this.lastReason='';}
  start(node,position){
    const definition=GATHERING[node?.kind];
    if(!definition||node.remaining<=0||Math.hypot(position.x-node.x,position.z-node.z)>2)return false;
    this.current={node,definition,elapsed:0,start:{x:position.x,z:position.z}};this.lastReason='';return true;
  }
  cancel(reason='Interrupted'){this.current=null;this.lastReason=reason;}
  startRecipe(recipe,station,position){
    if(Math.hypot(station.position.x-position.x,station.position.z-position.z)>3)return false;
    const point=station.root?.position??station.position;
    const node={x:point.x,z:point.z,remaining:1};
    this.current={node,definition:{...recipe,label:recipe.name},recipe,elapsed:0,start:{x:position.x,z:position.z}};this.lastReason='';return true;
  }
  update(dt,position,interrupted,onComplete){
    const action=this.current;if(!action)return;
    if(interrupted||action.node.remaining<=0||Math.hypot(position.x-action.start.x,position.z-action.start.z)>.25||Math.hypot(position.x-action.node.x,position.z-action.node.z)>(action.recipe?3:2)){this.cancel('Interrupted');return;}
    action.elapsed+=Math.max(0,dt);
    if(action.elapsed>=action.definition.duration){this.current=null;onComplete(action);}
  }
}
