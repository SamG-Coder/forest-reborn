/** Persistent gate policy and supplies; rendering never owns gate health. */
export class TownDefence {
  constructor(save,economy){this.save=save;this.economy=economy;save.towns??={};}
  town(id){return this.save.towns[id]??={raids:[],gates:{},alerts:0};}
  gate(town,id){return this.town(town).gates[id]??={hp:1800,maxHp:1800,closed:false,repairAt:0,passUntil:0};}
  raid(id,now){const town=this.town(id);town.raids=town.raids.filter(t=>now-t<3600);town.raids.push(now);town.alerts++;}
  update(id,gates,{now,night,underAttack}){
    const town=this.town(id);town.raids=town.raids.filter(t=>now-t<3600);
    for(const key of gates){const gate=this.gate(id,key);
      gate.closed=gate.hp>0&&(underAttack||night&&town.raids.length>=2)&&now>=gate.passUntil;
      if(!underAttack&&gate.hp<gate.maxHp&&now>=gate.repairAt){
        gate.repairAt=now+10;
        if(this.economy.consume(id,{wood:2,iron:1}))gate.hp=Math.min(gate.maxHp,gate.hp+100);
      }
    }
    this.economy.markets[id].defenceDemand=underAttack?3:night&&town.raids.length>=2?2:1;
  }
  damage(town,id,amount){const gate=this.gate(town,id);if(!gate.closed)return false;gate.hp=Math.max(0,gate.hp-Math.max(0,amount));if(!gate.hp)gate.closed=false;return true;}
  passage(town,id,now,enemyNear){const gate=this.gate(town,id);if(enemyNear)return false;gate.passUntil=now+9;gate.closed=false;return true;}
}
