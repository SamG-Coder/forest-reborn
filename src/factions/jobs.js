import {factionFor,standing,FACTIONS} from './catalog.js';
import {RESOURCE_VALUES} from './economy.js';
import {removeItem} from '../progression/inventory.js';

/** A job is an escrowed order for a current shortage, not a free repeat reward. */
export class JobBoard {
  constructor(economy,saved={}){this.economy=economy;this.orders=saved.orders??[];this.sequence=saved.sequence??0;}
  forPerson(person,now=Date.now(),owner='player'){
    this.expire(now);const faction=factionFor(person);
    if(person.type==='adventurer'||faction==='woodland')return [];
    if(!this.orders.some(j=>j.giver===person.id&&j.status!=='completed'&&j.status!=='expired')){
      const need=this.economy.needs(faction).find(n=>n.count>=4);
      if(need){const count=Math.min(8,need.count),pay=Math.ceil(RESOURCE_VALUES[need.item]*this.economy.demand(faction,need.item)*count*1.05);
        this.orders.push({id:`job-${++this.sequence}`,giver:person.id,name:person.name,faction,item:need.item,count,pay,status:'available',expiresAt:now+600000});}
    }
    return this.orders.filter(j=>j.giver===person.id&&!['completed','expired'].includes(j.status)&&(j.status==='available'||(j.owner??'player')===owner));
  }
  accept(id,progress,now=Date.now()){
    this.expire(now);const j=this.orders.find(j=>j.id===id);if(!j||j.status!=='available'||standing(progress.data.reputation,j.faction)<=-30)return false;
    const m=this.economy.markets[j.faction];if(m.treasury<j.pay)return false;
    m.treasury-=j.pay;j.status='active';j.owner=progress.ownerId??'player';j.expiresAt=now+1800000;return true;
  }
  complete(id,progress,now=Date.now()){
    this.expire(now);const j=this.orders.find(j=>j.id===id);if(!j||j.status!=='active'||(j.owner??'player')!==(progress.ownerId??'player')||!progress.hasItem(j.item,j.count))return false;
    progress.data.bag=removeItem(progress.data.bag,j.item,j.count);progress.data.coins+=j.pay;progress.addXP(8+j.count);progress.addSkillXP('trading',j.count*2);
    this.economy.receive(j.faction,j.item,j.count);j.status='completed';progress.save();return true;
  }
  expire(now){for(const j of this.orders)if(!['completed','expired'].includes(j.status)&&now>=j.expiresAt){if(j.status==='active')this.economy.markets[j.faction].treasury+=j.pay;j.status='expired';}this.orders=this.orders.filter(j=>!['completed','expired'].includes(j.status)||now-j.expiresAt<600000).slice(-180);}
  describe(job){return `${job.name} needs ${job.count} ${job.item} for ${FACTIONS[job.faction].name}. Deliver them before the order expires.`;}
  snapshot(){return {orders:this.orders,sequence:this.sequence};}
}
