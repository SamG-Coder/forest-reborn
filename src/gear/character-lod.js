/** Promote nearby crowd members to complete characters. The proxy stays visible
 * until loading finishes; hysteresis prevents flicker at the boundary. */
export class CharacterLOD {
  constructor({actors,create,enter=22,leave=29,maxCached=48}){
    Object.assign(this,{actors,create,enter,leave,maxCached});this.records=new Map();this.pending=false;this.disposed=false;this.promotions=0;this.demotions=0;
  }
  update(position,dt){
    if(this.disposed)return;
    for(const [actor,record]of this.records){
      const distance=actor.position.distanceTo(position),visible=distance<(actor.promoted?this.leave:this.enter)&&!actor.hidden;
      if(actor.promoted&&!visible)this.demotions++;
      if(!actor.promoted&&visible)this.promotions++;
      actor.promoted=visible;record.model.root.visible=visible;
      if(!visible)continue;
      record.used=performance.now();record.model.root.position.copy(actor.position);record.model.root.rotation.y=actor.yaw??0;record.model.root.rotation.z=actor.fallAngle??0;
      record.elapsed+=dt;
      if(record.elapsed>=(distance<12?1/45:1/24)){
        record.model.update(Math.min(record.elapsed,.1),actor.pose??{speed:actor.stationary?0:actor.moveSpeed??1.3,activity:actor.job===6?'carry':'rest',armed:false});record.elapsed=0;
      }
    }
    if(!this.pending){
      const next=this.actors.filter(a=>!a.hidden&&!a.hiddenDetailFailed&&!this.records.has(a)&&a.position.distanceTo(position)<this.enter).sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position))[0];
      if(next){this.pending=true;this.create(next).then(model=>{
        this.pending=false;if(this.disposed){model.dispose();return;}
        model.root.visible=false;this.records.set(next,{model,elapsed:1,used:performance.now()});
      }).catch(error=>{this.pending=false;this.lastError=error.message;next.hiddenDetailFailed=true;});}
    }
    if(this.records.size>this.maxCached){
      const stale=[...this.records].filter(([a])=>!a.promoted).sort((a,b)=>a[1].used-b[1].used);
      while(this.records.size>this.maxCached&&stale.length){const [actor,record]=stale.shift();record.model.dispose();this.records.delete(actor);}
    }
  }
  stats(){return {fullCharacters:[...this.records.keys()].filter(a=>a.promoted).length,cachedCharacters:this.records.size,promotions:this.promotions,demotions:this.demotions,loading:this.pending,error:this.lastError};}
  dispose(){this.disposed=true;for(const [actor,record]of this.records){actor.promoted=false;record.model.dispose();}this.records.clear();}
}
