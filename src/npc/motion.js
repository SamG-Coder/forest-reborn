const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));

export function facePoint(unit,point){
  const dx=point.x-unit.position.x,dz=point.z-unit.position.z;
  if(Math.hypot(dx,dz)>.08)unit.desiredYaw=Math.atan2(dx,dz);
}

/** One facing update per frame. Keep the chosen turn side around 180 degrees. */
export function updateFacing(unit,dt){
  const root=unit.actor?.root??unit.root;
  if(!root||!Number.isFinite(unit.desiredYaw)||dt<=0)return;
  let delta=wrap(unit.desiredYaw-root.rotation.y);
  if(Math.abs(delta)>2.6&&unit.turnSide)delta=unit.turnSide*Math.abs(delta);
  else if(Math.abs(delta)>.03)unit.turnSide=Math.sign(delta);
  const step=Math.min(Math.abs(delta)*(1-Math.exp(-8*dt)),3.6*dt);
  root.rotation.y=wrap(root.rotation.y+Math.sign(delta)*step);
}

/** Separate enter/leave distances prevent a crowd nudging a job on/off each frame. */
export function arrivedAt(unit,key,distance,enter,leave=enter+.3){
  if(unit.arrivalKey!==key){unit.arrivalKey=key;unit.arrived=false;}
  unit.arrived=distance<=(unit.arrived?leave:enter);
  return unit.arrived;
}

export function chooseCombatTarget(unit,candidates,now){
  const distance=target=>Math.hypot(unit.position.x-target.position.x,unit.position.z-target.position.z);
  const closest=[...candidates].sort((a,b)=>distance(a)-distance(b))[0];
  const current=candidates.find(t=>t===unit.combatTarget);
  if(current&&(unit.attack||now<unit.focusUntil||!closest||distance(closest)>distance(current)-3))return current;
  if(closest!==unit.combatTarget){unit.combatTarget=closest;unit.focusUntil=now+1500;}
  return closest;
}
