import {FACTIONS,FACTION_IDS,VENDORS} from './catalog.js';

export const RESOURCE_VALUES=Object.freeze({flax:2,flaxFibre:3,feather:1,bowstring:8,arrowShaft:1,'arrow.wood':1,'arrow.iron':3,'arrow.bodkin':6,wood:2,iron:5,herbs:3,bread:3,linen:3,coal:2,berries:2,wool:2,wovenCloth:12,leather:5,rabbitHide:2,goblinScrap:4,steelScrap:12,steelIngot:35});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class FactionEconomy {
  constructor(saved={}){
    this.markets={};this.elapsed=saved.elapsed??0;
    this.clock=saved.clock??0;this.nextTrade=saved.nextTrade??60;this.shipments=saved.shipments??[];this.deliveries=saved.deliveries??0;
    for(const [index,id]of FACTION_IDS.entries()){
      const old=saved.markets?.[id];
      const stock=Object.fromEntries(Object.keys(RESOURCE_VALUES).map((resource,i)=>[resource,resource===FACTIONS[id].resource?8:18+(i*7+index*11)%42]));
      this.markets[id]={treasury:25000,training:0,supplyTrips:0,...old,stock:{...stock,...old?.stock}};
    }
  }
  target(id,item){const base=item===FACTIONS[id].resource?80:40;return item.startsWith('arrow.')||item==='wood'||item==='iron'?base*(this.markets[id]?.defenceDemand??1):base;}
  demand(id,item){const market=this.markets[id];return clamp(1+(this.target(id,item)-(market.stock[item]??20))/this.target(id,item),.55,2.5);}
  needs(id){return Object.keys(RESOURCE_VALUES).map(item=>({item,count:Math.max(0,Math.ceil(this.target(id,item)-(this.markets[id].stock[item]??0))),pressure:this.demand(id,item)})).filter(n=>n.count>0).sort((a,b)=>b.pressure-a.pressure);}
  quote(vendor,item,base,side='buy'){
    const spec=VENDORS[vendor]??{faction:'mosswake',wants:[]},demand=this.demand(spec.faction,item);
    const specialty=spec.wants.includes(item)?1.18:1;
    // Both sides use the same resource valuation and spread. Selling a purchase
    // straight back can never create money, even when that trade changes stock.
    const value=RESOURCE_VALUES[item]??base;
    return Math.max(1,Math.round(value*demand*specialty*(side==='buy'?1.85:.68)));
  }
  receive(id,item,count){const m=this.markets[id];m.stock[item]=Math.max(0,(m.stock[item]??0)+count);}
  consume(id,recipe){const m=this.markets[id];if(!m||Object.entries(recipe).some(([item,count])=>(m.stock[item]??0)<count))return false;for(const [item,count]of Object.entries(recipe))m.stock[item]-=count;return true;}
  craftArrows(id){if(!this.consume(id,{wood:1,feather:2}))return false;this.receive(id,'arrow.wood',6);return true;}
  sellTo(vendor,item,count,base){
    const id=VENDORS[vendor]?.faction??'mosswake',m=this.markets[id],coins=this.quote(vendor,item,base,'sell')*count;
    if(m.treasury<coins)return 0;
    m.treasury-=coins;this.receive(id,item,count);return coins;
  }
  purchase(vendor,item,count,base){const id=VENDORS[vendor]?.faction??'mosswake',coins=this.quote(vendor,item,base,'buy')*count;this.receive(id,item,-count);this.markets[id].treasury+=coins;return coins;}
  bestBuyer(item,base,position={x:0,z:0},nearOnly=true){
    return Object.entries(VENDORS).filter(([,v])=>!nearOnly||v.faction==='mosswake').map(([id,v])=>({id,...v,price:this.quote(id,item,base,'sell'),score:this.quote(id,item,base,'sell')-Math.hypot(v.x-position.x,v.z-position.z)*.012})).sort((a,b)=>b.score-a.score)[0];
  }
  update(seconds,flags={}){
    this.clock+=Math.max(0,seconds);
    for(const shipment of this.shipments)if(!shipment.arrived&&shipment.due<=this.clock){this.receive(shipment.to,shipment.item,shipment.count);shipment.arrived=true;this.deliveries++;}
    this.shipments=this.shipments.filter(s=>!s.arrived);
    if(this.clock>=this.nextTrade){this.nextTrade=this.clock+60;
      for(const [a,b]of [['mosswake','highmere'],['bandits','ash']])for(const [from,to]of [[a,b],[b,a]]){
        if(this.shipments.some(s=>s.from===from&&s.to===to)||flags.northernOutcome==='ash'&&a==='mosswake'&&!flags.northRoadRecovered)continue;
        const need=this.needs(to).find(n=>this.markets[from].stock[n.item]>this.target(from,n.item)*.75&&this.demand(to,n.item)>this.demand(from,n.item)+.15);
        if(!need)continue;const count=Math.min(12,need.count,Math.floor(this.markets[from].stock[need.item]-this.target(from,need.item)*.65)),cost=Math.ceil(count*RESOURCE_VALUES[need.item]*this.demand(from,need.item));
        if(count<=0||this.markets[to].treasury<cost)continue;
        this.receive(from,need.item,-count);this.markets[to].treasury-=cost;this.markets[from].treasury+=cost;
        const distance=Math.hypot(FACTIONS[from].home[0]-FACTIONS[to].home[0],FACTIONS[from].home[1]-FACTIONS[to].home[1]);
        this.shipments.push({from,to,item:need.item,count,cost,departed:this.clock,due:this.clock+distance/6});
      }
    }
    this.elapsed+=Math.max(0,seconds);
    while(this.elapsed>=30){
      this.elapsed-=30;
      for(const id of FACTION_IDS){
        const m=this.markets[id];
        // Work consumes real stock. Shortages halt training; time alone cannot
        // create equipment or gold. Resource production represents local labour.
        const food=id==='woodland'?'berries':'bread';
        if((m.stock[food]??0)>0)m.stock[food]--;
        const product=id==='woodland'?'berries':id==='quarry'?'iron':id==='briar'?'wood':'linen';
        if((m.stock[product]??0)<120)this.receive(id,product,2);
        if(['mosswake','highmere','bandits','ash','briar'].includes(id)&&m.stock['arrow.wood']<this.target(id,'arrow.wood'))this.craftArrows(id);
        if(id!=='woodland'&&m.stock.iron>=2&&m.stock.bread>=1){m.stock.iron-=2;m.stock.bread--;m.training=Math.min(100,m.training+.25);}
      }
      if(flags.northernOutcome==='ash'&&!flags.northRoadRecovered){this.receive('highmere','bread',-2);this.receive('ash','bread',2);}
      if(flags.caravanOpen&&!(flags.northernOutcome==='ash'&&!flags.northRoadRecovered)){
        const from=this.markets.highmere,to=this.markets.mosswake;
        if(from.stock.iron>8&&to.stock.wood>8){from.stock.iron-=2;to.stock.iron+=2;to.stock.wood-=2;from.stock.wood+=2;to.supplyTrips++;}
      }
    }
  }
  snapshot(){return {elapsed:this.elapsed,markets:this.markets,clock:this.clock,nextTrade:this.nextTrade,shipments:this.shipments,deliveries:this.deliveries};}
}
