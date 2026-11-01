import {GEAR_SLOTS} from '../gear/catalog.js';
import {WEAPONS} from '../game/weapon-catalog.js';
import {ARROWS} from '../game/arrow-catalog.js';

export const BAG_SIZE=24;
export const ITEMS=Object.freeze({
  bowStave:{name:'Shaped bow stave',type:'Material',stack:20,value:7,icon:'wood',description:'Seasoned timber with a continuous grain. Carve and tiller this into an unstrung bow.'},
  unstrungShortbow:{name:'Unstrung ash shortbow',type:'Material',stack:1,value:20,icon:'unstrungBow',description:'Carved and tillered, but cannot shoot. Add a linen bowstring at the carpenter’s bench.'},
  unstrungLongbow:{name:'Unstrung yew warbow',type:'Material',stack:1,value:65,icon:'unstrungBow',description:'A powerful unstrung bow. Fit a linen bowstring with level 5 Fletching before equipping.'},
  flax:{name:'Fresh flax',type:'Material',stack:40,value:2,icon:'flax',description:'Blue-flowered flax from the meadow. Dress the stems into fibre at a loom.'},
  flaxFibre:{name:'Dressed flax fibre',type:'Material',stack:40,value:3,icon:'yarn',description:'Twist into bowstrings, bind arrows or weave linen.'},
  bowstring:{name:'Linen bowstring',type:'Material',stack:20,value:8,icon:'yarn',description:'Waxed flax cord for bows. Made at the loom using Fletching.'},
  arrowShaft:{name:'Arrow shaft',type:'Material',stack:120,value:1,icon:'arrow',description:'Straight, shaved timber. Add flights and a tip at the carpenter’s bench.'},
  feather:{name:'Flight feather',type:'Material',stack:60,value:1,icon:'feather',description:'Gather fallen feathers near the meadow, or buy them from Orin. Used to fletch arrows.'},
  ironArrowhead:{name:'Iron broadhead',type:'Material',stack:120,value:2,icon:'arrow',description:'A wide iron cutting point. Fit to a shaft using Fletching.'},
  bodkinTip:{name:'Steel bodkin tip',type:'Material',stack:120,value:4,icon:'arrow',description:'A narrow hardened point for piercing armour.'},
  ...Object.fromEntries(Object.entries(ARROWS).map(([id,a])=>[id,{name:a.name,type:'Ammunition',stack:120,value:a.value,icon:'arrow',description:`Consumed when a bow is released. +${a.damage} damage; ignores ${Math.round(a.penetration*100)}% of armour. Equip from your bag to prefer this arrow.`}])),
  steelScrap:{name:'Tempered steel scrap',type:'Material',stack:20,value:12,icon:'ore',description:'Salvaged from the Ash Company. Rework it into steel ingots.'},
  steelIngot:{name:'Steel ingot',type:'Material',stack:20,value:35,icon:'ore',description:'Used for Highmere field armour. Smelt tempered scrap with coal.'},
  giantRune:{name:'Weathered giant rune',type:'Material',stack:20,value:60,icon:'ore',description:'A carved stone carried by a hillborn giant. The Highmere archivist studies these.'},
  ogreTooth:{name:'Ogre tooth',type:'Material',stack:20,value:25,icon:'hide',description:'A trophy from the quarry ogres. Proof of a difficult hunt.'},
  shears:{name:'Sheep shears',type:'Tool',stack:1,value:10,icon:'shears',description:'Keep these in your bag. Stand beside a sheep in the southeast pasture and press V.'},
  wool:{name:'Raw wool',type:'Material',stack:20,value:2,icon:'wool',description:'A sheep’s fleece. Spin it into yarn at the weaver’s house.'},
  yarn:{name:'Wool yarn',type:'Material',stack:20,value:5,icon:'yarn',description:'Spun wool for weaving warm cloth.'},
  wovenCloth:{name:'Woven wool cloth',type:'Material',stack:20,value:12,icon:'cloth',description:'Ready for sewing tunics, trousers and travelling caps.'},
  healingPotion:{name:'Herbal healing draught',type:'Consumable',stack:10,value:9,heal:40,icon:'potion',description:'Restores 40 health. Shares a 15-second recovery with other consumables.'},
  staminaPotion:{name:'Clearwater tonic',type:'Consumable',stack:10,value:8,stamina:45,icon:'potion',description:'Restores 45 stamina. Shares a 15-second recovery with other consumables.'},
  bread:{name:'Fresh bread',type:'Consumable',stack:10,value:3,heal:18,stamina:12,icon:'food',description:'Restores 18 health and 12 stamina.'},
  broth:{name:'Woodland broth',type:'Consumable',stack:10,value:6,heal:30,stamina:25,icon:'food',description:'Restores 30 health and 25 stamina.'},
  bandage:{name:'Linen bandage',type:'Consumable',stack:10,value:4,heal:25,icon:'linen',description:'Restores 25 health. Shares the recovery timer with food and draughts.'},
  berries:{name:'Forest berries',type:'Material',stack:20,value:2,icon:'berries',description:'Gathered from berry bushes. Used in food and herbal draughts.'},
  planks:{name:'Sawn planks',type:'Material',stack:20,value:5,icon:'wood',description:'Prepared at Garrick’s bench from three lengths of timber.'},
  ironIngot:{name:'Iron ingot',type:'Material',stack:20,value:16,icon:'ore',description:'Smelted from iron ore and coal at the smithy.'},
  coal:{name:'Coal',type:'Material',stack:20,value:2,icon:'ore',description:'Fuel for smelting. Orin keeps sacks under his stall.'},
  linen:{name:'Linen cloth',type:'Material',stack:20,value:3,icon:'linen',description:'Plain woven cloth for sewing and bandages.'},
  leather:{name:'Cured leather',type:'Material',stack:20,value:5,icon:'hide',description:'Tough hide prepared at the smith’s workbench.'},
  herbs:{name:'Meadow herbs',type:'Material',stack:20,value:3,icon:'herbs',description:'Fresh stems from the meadow. Orin buys them at the market.'},
  wood:{name:'Cut timber',type:'Material',stack:20,value:2,icon:'wood',description:'Wood cut from a forest tree. Used by the town’s craftspeople.'},
  iron:{name:'Iron ore',type:'Material',stack:20,value:5,icon:'ore',description:'Dark iron-bearing stone. A useful starting metal.'},
  copper:{name:'Copper ore',type:'Material',stack:20,value:4,icon:'ore',description:'Copper-bearing stone with warm, red seams.'},
  rabbitHide:{name:'Rabbit hide',type:'Material',stack:20,value:2,icon:'hide',description:'A small hide. Traders buy these in bundles.'},
  goblinScrap:{name:'Goblin scrap',type:'Material',stack:20,value:4,icon:'ore',description:'Salvaged metal and fastenings from goblin equipment.'},
  sword:{name:'Practice sword',type:'Weapon',slot:'weapon',stack:1,value:20,icon:'sword',description:'A sound edge and a worn grip. Equip it to use sword attacks.'},
  axe:{name:'Woodcutting axe',type:'Tool',stack:1,value:8,icon:'axe',description:'Keep this in your bag to chop standing trees. Stand near a trunk and press V.'},
  flour:{name:'Tomas’s flour',type:'Quest item',stack:1,value:0,icon:'parcel',description:'Return this sack to Tomas at the Wayward Oak. Cannot be sold.'},
});
const ARMOUR={cap:1,'open-helmet':8,'closed-helmet':10,tunic:2,trousers:1,'tall-boots':3,'leather-armour':12,chainmail:24,'plate-cuirass':38};
export function itemDefinition(id,registry){
  if(WEAPONS[id]){const w=WEAPONS[id];return {id,...w,type:'Weapon',slot:'weapon',stack:1,value:id==='sword'?20:Math.round(w.damage*w.level*1.8),icon:w.ranged?'bow':'sword',description:`${w.damage} damage · ${w.interval}s attack · ${w.reach}m reach.${w.ranged?' Requires arrows in your bag. Trains Archery.':''}${w.effect?' '+w.effect.type+' for '+w.effect.duration+'s.':''} Requires level ${w.level}.`};}
  if(ITEMS[id])return {id,...ITEMS[id]};
  try{
    const gear=registry.get(id),armor=gear.armor??Math.round((ARMOUR[gear.base.id]??0)*(gear.resource==='steel'?1.25:1));
    return {id,name:gear.name,type:'Equipment',slot:gear.slot,stack:1,value:Math.max(5,armor*4),armor,
      level:gear.level??1,icon:gear.slot.startsWith('ring')?'ring':gear.slot,description:`${GEAR_SLOTS[gear.slot]}. ${armor} armour. ${gear.material} construction. Requires level ${gear.level??1}.`,gear};
  }catch{return {id,name:id,type:'Recovered item',stack:1,value:0,icon:'parcel',description:'An item from an older save.'};}
}
