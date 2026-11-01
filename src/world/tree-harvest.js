export const TREE_RESPAWN_MS=180000;

/** Only altered trees are saved; IDs come from deterministic chunk placement. */
export class TreeHarvest {
  constructor(){this.trees=new Map();this.felled=new Map();this.now=Date.now();this.revision=0;}
  register(id,x,z,radius){
    const node={id,kind:'wood',tree:true,x,z,radius,remaining:this.felled.has(id)?0:1};this.trees.set(id,node);return node;
  }
  unregister(id){this.trees.delete(id);}
  update(now){
    this.now=now;
    for(const [id,state]of this.felled)if(now>=state.readyAt){this.felled.delete(id);this.revision++;const node=this.trees.get(id);if(node)node.remaining=1;}
  }
  harvest(id,position,now){
    this.update(now);const node=this.trees.get(id);
    if(!node||node.remaining<=0||Math.hypot(node.x-position.x,node.z-position.z)>2)return null;
    node.remaining=0;this.felled.set(id,{id,felledAt:now,readyAt:now+TREE_RESPAWN_MS});this.revision++;return 'wood';
  }
  snapshot(){return [...this.felled.values()];}
  restore(states=[]){
    this.felled=new Map(states.filter(s=>typeof s.id==='string'&&Number.isFinite(s.felledAt)&&Number.isFinite(s.readyAt)).map(s=>[s.id,s]));
    this.revision++;
    for(const node of this.trees.values())node.remaining=this.felled.has(node.id)?0:1;
  }
}
