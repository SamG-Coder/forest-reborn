/** A mounted pass adds reach and a capped momentum bonus, not a faster cooldown. */
export function mountedAttack(definition,{mounted=false,speed=0}={}){
  if(!mounted||definition.ranged)return definition;
  const spear=definition.grip==='spear';
  return {...definition,reach:definition.reach+(spear?.9:.45),damage:Math.round(definition.damage*(1+Math.min(spear?.85:.25,Math.max(0,speed-3)*(spear?.12:.045)))),mounted:true};
}

/** Swept contact prevents galloping through a target between simulation ticks.
 * Walking/pushing in place never counts. A braced, facing spear checks cavalry. */
export function chargeContact(from,to,target,{speed,weapon,targetWeapon,targetSpeed=0,targetYaw=0}={}){
  if(speed<3.5)return null;
  const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);if(length<.01)return null;
  const tx=target.x-from.x,tz=target.z-from.z,forward=(tx*dx+tz*dz)/length;
  if(forward<0)return null;
  const t=Math.max(0,Math.min(1,(tx*dx+tz*dz)/(length*length)));
  if(Math.hypot(target.x-from.x-dx*t,target.z-from.z-dz*t)>1.15)return null;
  const spear=weapon?.grip==='spear',approach=Math.atan2(-dx,-dz),facing=Math.abs(Math.atan2(Math.sin(approach-targetYaw),Math.cos(approach-targetYaw)));
  const braced=targetWeapon?.grip==='spear'&&targetSpeed<1.5&&facing<1.05;
  return {damage:Math.round((spear?24:12)*(1+Math.min(9,speed)*.08)*(braced?.3:1)),counter:braced?Math.round(targetWeapon.damage*1.7):0,braced};
}
