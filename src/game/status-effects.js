export function addStatus(target,effect,time){
  if(!effect||target.hp<=0)return;
  target.statusEffects??=[];let state=target.statusEffects.find(s=>s.type===effect.type);
  if(!state){state={...effect,next:time+1};target.statusEffects.push(state);}
  state.until=time+effect.duration;state.power=effect.power;
}
export function tickStatuses(target,time,onDamage){
  target.slowFactor=1;
  for(const effect of target.statusEffects??[]){
    if(effect.type==='slow'&&effect.until>time)target.slowFactor=1-effect.power;
    if(effect.type!=='slow'&&effect.next<=time&&effect.next<=effect.until&&target.hp>0){
      effect.next++;const damage=Math.min(target.hp,effect.power);target.hp-=damage;onDamage(damage,effect.type);
    }
  }
  target.statusEffects=(target.statusEffects??[]).filter(e=>e.until>time||e.type!=='slow'&&e.next<=e.until);
}
