/** Shared by the player, individual NPCs and the company simulation. */
export function resolveStrike({damage,defender={},facing=0,stamina=100,random=Math.random,penetration=0}){
  const blocked=Math.abs(facing)<1.2&&stamina>=8&&random()<(defender.blockChance??0);
  const armor=(defender.armor??0)*(1-penetration),mitigation=penetration>0?armor/(100+armor):(defender.mitigation??0);
  return {blocked,damage:blocked?0:Math.max(1,Math.round(damage*(1-mitigation))),staminaCost:blocked?8:0};
}
