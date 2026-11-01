/** Bounded, paired skirmishes. Hits require range and a cooldown, including offscreen. */
export class BattleSimulation {
  constructor(count=600) {
    this.time=0;this.hits=0;this.defeats=0;this.actors=[];
    const pairs=Math.floor(count/2),columns=Math.ceil(Math.sqrt(pairs));
    for(let pair=0;pair<pairs;pair++)for(const side of [-1,1]){
      const x=(pair%columns-(columns-1)/2)*8.5+side*3,z=(Math.floor(pair/columns)-(columns-1)/2)*8.5;
      this.actors.push({id:this.actors.length,opponent:this.actors.length+(side<0?1:-1),side,x,z,homeX:x,homeZ:z,hp:100,readyAt:(pair%11)*.13,respawnAt:0,clip:2,phase:(pair*.618)%1});
    }
  }
  update(dt,onHit=()=>{}) {
    this.time+=dt;
    for(const actor of this.actors){
      if(actor.hp<=0){if(this.time>=actor.respawnAt){actor.hp=100;actor.x=actor.homeX;actor.z=actor.homeZ;actor.readyAt=this.time+1;}else continue;}
      const target=this.actors[actor.opponent];
      if(target.hp<=0){actor.clip=0;continue;}
      const dx=target.x-actor.x,dz=target.z-actor.z,distance=Math.hypot(dx,dz);
      actor.yaw=Math.atan2(dx,dz);
      if(distance>2.1){const step=Math.min(distance-2.1,2.6*dt);actor.x+=dx/distance*step;actor.z+=dz/distance*step;actor.clip=2;}
      else {actor.clip=3;if(this.time>=actor.readyAt){actor.readyAt=this.time+1.6;const damage=9+(actor.id%5);target.hp=Math.max(0,target.hp-damage);this.hits++;onHit(target,damage);if(!target.hp){target.respawnAt=this.time+18;this.defeats++;}}}
    }
  }
}
