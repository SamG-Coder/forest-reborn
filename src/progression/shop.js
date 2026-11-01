import {insertItem} from './inventory.js';

export const SHOP_OFFERS=Object.freeze({
  'highmere-smith':[['body.highmere-mail',480,6],['body.highmere-plate',850,4],['head.highmere-helm',300,6],['coal',3,99]],
  'highmere-tailor':[['clothes.guild-coat',260,6],['linen',4,99],['bandage',6,40]],
  'highmere-cook':[['bread',5,99],['broth',10,50],['healingPotion',15,40]],
  trader:[['shears',18,20],['axe',15,20],['sword',45,5],['linen',4,99],['coal',3,99],['clothes.traveller-blue',35,6],['clothes.traveller-red',35,6],['legs.traveller',28,6],['shoes.traveller',55,6],['head.cloth-cap',20,6]],
  smith:[['body.leather-vest',120,4],['body.riveted-mail',280,3],['body.iron-cuirass',500,2],['head.iron-open',160,4]],
  innkeeper:[['bread',5,99],['broth',10,30]],
  herbalist:[['healingPotion',15,30],['staminaPotion',14,30]],
  vendor:[['berries',3,99]],
});
export function shopStock(ledger,vendor,offer){const key=`${vendor}:${offer[0]}`;ledger[key]??=offer[2];return ledger[key];}
export function buyAxeForActor(actor,ledger){
  const offer=SHOP_OFFERS.trader.find(item=>item[0]==='axe');
  if(actor.tools.axe||actor.coins<offer[1]||shopStock(ledger,'trader',offer)<1)return false;
  actor.coins-=offer[1];actor.tools.axe=true;ledger['trader:axe']--;return true;
}
export function buyItem(progress,ledger,vendor,id){
  const offer=SHOP_OFFERS[vendor]?.find(offer=>offer[0]===id);if(!offer)return false;
  if(shopStock(ledger,vendor,offer)<1){progress.lastError='Sold out.';return false;}
  if(progress.data.coins<offer[1]){progress.lastError='You do not have enough money.';return false;}
  if(!progress.canAddItem(id)){progress.lastError='Your bag is full.';return false;}
  progress.data.bag=insertItem(progress.data.bag,id,1,progress.item(id).stack);progress.data.coins-=offer[1];ledger[`${vendor}:${id}`]--;progress.save();return true;
}
export function sellStack(progress,index,stock){
  const stack=progress.data.bag[index];if(!stack)return 0;const item=progress.item(stack.id);if(item.value<=0)return 0;
  const coins=item.value*stack.count;stock[stack.id]=(stock[stack.id]??0)+stack.count;progress.data.bag[index]=null;progress.data.coins+=coins;progress.addSkillXP('trading',stack.count*2);progress.save();return coins;
}
