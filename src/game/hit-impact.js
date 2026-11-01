/** Contact zones for the distance-based combat resolver, in the shared bind pose.
 * Thrusts target the torso; cutting and overhead attacks can sever on a lethal hit. */
export const BODY_PARTS=Object.freeze({
  head:{code:1,point:[0,1.55,0],normal:[0,1,0],bone:'neck',radius:.066},
  armL:{code:2,point:[.31,1.44,0],normal:[1,0,0],bone:'upperArmL',radius:.075},
  armR:{code:3,point:[-.31,1.44,0],normal:[-1,0,0],bone:'upperArmR',radius:.075},
  legL:{code:4,point:[.11,.78,0],normal:[0,-1,0],bone:'thighL',radius:.09},
  legR:{code:5,point:[-.11,.78,0],normal:[0,-1,0],bone:'thighR',radius:.09},
});

export function recordHitImpact(target,attacker,damage){
  const strike=attacker?.strikes??attacker?.combo??0,seed=(Number(attacker?.id)||17)*37+strike*53;
  let style=attacker?.attack?.animation??attacker?.action?.style??'cut';
  if(style==='overhead'&&(attacker?.action?.combo??Math.max(0,strike-1))%2)style='cut';
  const weapon=attacker?.weapon??'unarmed',sharp=weapon!=='unarmed'&&!weapon.includes('spear')&&style!=='thrust';
  const zones=style==='overhead'?['head','armL','armR']:['armL','armR','legL','legR','head'];
  const part=zones[Math.abs(seed)%zones.length];
  const from=attacker?.position??attacker,targetPosition=target.position??target;
  const dx=(targetPosition.x??0)-(from?.x??0),dz=(targetPosition.z??0)-(from?.z??-1),length=Math.hypot(dx,dz)||1;
  const impact={zone:sharp?part:'torso',direction:{x:dx/length,z:dz/length},strength:damage};
  target.hitDirection=impact.direction;target.lastImpact=impact;
  if(target.hp<=0&&sharp&&damage>=18&&Math.abs(seed*7)%10<3)target.severedPart=part;
  return impact;
}
