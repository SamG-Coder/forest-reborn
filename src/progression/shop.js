import {insertItem} from './inventory.js';
import {VENDORS,standing} from '../factions/catalog.js';
import {RESOURCE_VALUES} from '../factions/economy.js';

export const SHOP_OFFERS=Object.freeze({
  'highmere-market-supplies':[['arrow.wood',1,240],['arrow.iron',3,180],['wood',2,99],['feather',1,99],['flax',2,99],['axe',15,12],['shears',18,12]],
  'highmere-market-bread':[['bread',5,99],['broth',10,40]],
  'highmere-market-produce':[['berries',3,99],['herbs',4,99]],
  'highmere-market-cloth':[['linen',4,99],['wovenCloth',18,30],['wool',3,99]],
  'briar-envoy':[['weapon.dagger',70,4],['iron',7,40],['herbs',4,30]],
  'bandit-envoy':[['weapon.sabre',240,3],['linen',4,30]],
  'highmere-smith':[['weapon.longbow',320,6],['arrow.iron',3,240],['arrow.bodkin',6,120],['weapon.spear',250,5],['weapon.shortshield',280,5],['weapon.greatsword',650,3],['body.highmere-mail',480,6],['body.highmere-plate',850,4],['head.highmere-helm',300,6],['coal',3,99]],
  'highmere-tailor':[['tabard.highmere',100,20],['tabard.guild',100,20],['clothes.guild-coat',260,6],['linen',4,99],['bandage',6,40]],
  'highmere-cook':[['bread',5,99],['broth',10,50],['healingPotion',15,40]],
  trader:[['weapon.shortbow',65,8],['arrow.wood',1,240],['feather',1,240],['bowstring',8,30],['shears',18,20],['axe',15,20],['sword',45,5],['linen',4,99],['coal',3,99],['clothes.traveller-blue',35,6],['clothes.traveller-red',35,6],['legs.traveller',28,6],['shoes.traveller',55,6],['head.cloth-cap',20,6]],
  smith:[['weapon.dagger',70,6],['weapon.broadsword',170,5],['weapon.sabre',240,3],['body.scout',160,5],['head.scout',70,5],['legs.scout',55,5],['shoes.scout',50,5],['body.leather-vest',120,4],['body.riveted-mail',280,3],['body.iron-cuirass',500,2],['head.iron-open',160,4]],
  innkeeper:[['bread',5,99],['broth',10,30]],
  herbalist:[['healingPotion',15,30],['staminaPotion',14,30]],
  vendor:[['berries',3,99]],
});
export function shopStock(ledger,vendor,offer,economy){const key=`${vendor}:${offer[0]}`;ledger[key]??=offer[2];return economy&&RESOURCE_VALUES[offer[0]]?Math.min(ledger[key],Math.floor(economy.markets[VENDORS[vendor]?.faction??'mosswake'].stock[offer[0]]??0)):ledger[key];}
export function buyAxeForActor(actor,ledger){
  const offer=SHOP_OFFERS.trader.find(item=>item[0]==='axe');
  if(actor.tools.axe||actor.coins<offer[1]||shopStock(ledger,'trader',offer)<1)return false;
  actor.coins-=offer[1];actor.tools.axe=true;ledger['trader:axe']--;return true;
}
export function buyItem(progress,ledger,vendor,id){
  const offer=SHOP_OFFERS[vendor]?.find(offer=>offer[0]===id);if(!offer)return false;
  const economy=progress.factions?.economy,price=economy?.quote(vendor,id,offer[1])??offer[1];
  if(standing(progress.data.reputation,VENDORS[vendor]?.faction??'mosswake')<=-30){progress.lastError='This faction will not trade with you.';return false;}
  if(shopStock(ledger,vendor,offer,economy)<1){progress.lastError='Sold out.';return false;}
  if(progress.data.coins<price){progress.lastError='You do not have enough money.';return false;}
  if(!progress.canAddItem(id)){progress.lastError='Your bag is full.';return false;}
  progress.data.bag=insertItem(progress.data.bag,id,1,progress.item(id).stack);progress.data.coins-=price;economy?.purchase(vendor,id,1,offer[1]);ledger[`${vendor}:${id}`]--;progress.save();return true;
}
export function sellStack(progress,index,stock,vendor='trader'){
  const stack=progress.data.bag[index];if(!stack)return 0;const item=progress.item(stack.id);if(item.value<=0)return 0;
  if(standing(progress.data.reputation,VENDORS[vendor]?.faction??'mosswake')<=-30)return 0;
  const coins=progress.factions?.economy.sellTo(vendor,stack.id,stack.count,item.value)??item.value*stack.count;if(!coins){progress.lastError='They cannot afford that stack.';return 0;}
  stock[stack.id]=(stock[stack.id]??0)+stack.count;progress.data.bag[index]=null;progress.data.coins+=coins;progress.addSkillXP('trading',stack.count*2);progress.save();return coins;
}
