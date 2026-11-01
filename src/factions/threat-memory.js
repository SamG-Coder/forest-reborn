/** Bounded persistent memory; victim identity survives respawns and saving. */
export class ThreatMemory {
  constructor(saved={}){this.units=saved.units??{};this.factions=saved.factions??{};}
  harm(target,attacker,now){
    const m=this.units[target.id]??={kills:0,overlevelKills:0,bonus:0,grudges:{}};
    m.grudges[attacker.id]={at:now,faction:attacker.factionId??'mosswake',level:attacker.level??1};
    const recent=Object.entries(m.grudges).sort((a,b)=>b[1].at-a[1].at).slice(0,4);m.grudges=Object.fromEntries(recent);
    const group=this.factions[target.factionId]??={};group[attacker.factionId??'mosswake']=Math.min(100,(group[attacker.factionId??'mosswake']??0)+1);
  }
  killed(target,attacker,now){this.harm(target,attacker,now);const m=this.units[target.id];m.kills++;if((attacker.level??1)>=(target.baseLevel??target.level)+5)m.overlevelKills++;}
  respawn(target,random=Math.random){
    const m=this.units[target.id];if(!m)return false;
    const grew=m.overlevelKills>=2&&m.bonus<4&&random()<Math.min(.45,.12+m.overlevelKills*.04);
    if(grew){m.bonus++;m.overlevelKills=0;}
    target.baseLevel??=target.level;target.baseMaxHp??=target.maxHp;target.baseDamage??=target.damage??14;
    target.level=target.baseLevel+m.bonus;target.maxHp=Math.round(target.baseMaxHp*(1+m.bonus*.18));target.damage=Math.round(target.baseDamage*(1+m.bonus*.1));
    return grew;
  }
  remembers(target,id,now){const grudge=this.units[target.id]?.grudges[id];return Boolean(grudge&&now-grudge.at<86400000);}
  snapshot(){return {units:this.units,factions:this.factions};}
}
