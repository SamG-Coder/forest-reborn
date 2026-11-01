import {metalResource} from './resources.js';
import {resolveVariantItem} from './variants.js';

/** Gameplay slots are separate from render layers and material families. */
export const GEAR_SLOTS=Object.freeze({head:'Head / helmet',clothes:'Clothes',body:'Body',legs:'Legs',shoes:'Shoes',ringLeft:'Left ring',ringRight:'Right ring',necklace:'Necklace',tabard:'Faction / guild tabard'});
export const LAYERS=Object.freeze({underwear:0,clothes:10,jewellery:20,padding:30,mail:40,armour:50});
export const MATERIAL_FAMILIES=Object.freeze({
  cloth:{map:'cloth',roughness:.93,metalness:0,compliance:2e-8,damping:.985},
  silk:{map:'cloth',roughness:.45,metalness:0,compliance:8e-6,damping:.98},
  wool:{map:'cloth',roughness:1,metalness:0,compliance:1e-6,damping:.97},
  leather:{map:'leather',roughness:.73,metalness:0,compliance:2e-8,damping:.94},
  padded:{map:'cloth',roughness:.96,metalness:0,compliance:1e-8,damping:.92},
  mail:{map:'mail',roughness:.48,metalness:.8,compliance:1e-9,damping:.92},
  iron:{map:'iron',roughness:.52,metalness:.95,compliance:0,damping:0},
});

// One inherited coverage profile for every colour/material variant of a base.
const families=[
  ['cap','head','cloth','scalp','headwear'],['hood','head','cloth','scalp','hood'],['hat','head','cloth','scalp','headwear'],['circlet','head','iron','none','circlet'],
  ['padded-coif','head','padded','scalp','hood'],['mail-coif','head','mail','scalp','hood'],['open-helmet','head','iron','scalp','helmet'],['closed-helmet','head','iron','head','helmet'],
  ['shirt','clothes','cloth','upper','shirt'],['tunic','clothes','cloth','upper','tunic'],['robe','clothes','cloth','upper','robe'],['coat','clothes','wool','upper','coat'],['dress','clothes','cloth','upper','robe'],['tabard','tabard','cloth','none','tabard'],['padded-outfit','clothes','padded','upper','tunic'],
  ['cloth-outerwear','body','wool','vest','vest'],['leather-armour','body','leather','vest','vest'],['gambeson','body','padded','upper','shirt'],['chainmail','body','mail','vest','vest'],['scale-armour','body','iron','vest','articulated'],['lamellar','body','iron','vest','articulated'],['brigandine','body','leather','vest','articulated'],['plate-cuirass','body','iron','vest','cuirass'],
  ['trousers','legs','cloth','legs','trousers'],['leggings','legs','cloth','legs','trousers'],['loose-trousers','legs','cloth','legs','trousers'],['skirt','legs','cloth','pelvis','skirt'],['padded-leggings','legs','padded','legs','trousers'],['mail-leggings','legs','mail','legs','trousers'],['plate-legs','legs','iron','legs','articulated-legs'],
  ['jeans','legs','cloth','legs','jeans'],
  ['slippers','shoes','cloth','feet','shoes'],['shoes','shoes','leather','feet','shoes'],['sandals','shoes','leather','none','sandals'],['ankle-boots','shoes','leather','feet','boots'],['tall-boots','shoes','leather','lower-legs','boots'],['armoured-boots','shoes','iron','feet','sabatons'],
  ['sneakers','shoes','cloth','feet','shoes'],
  ['ring','ringLeft','iron','none','ring'],['necklace','necklace','iron','none','necklace'],['pendant','necklace','iron','none','necklace'],
];
export const GEAR_BASES=Object.freeze(Object.fromEntries(families.map(([id,slot,material,mask,pattern])=>[id,Object.freeze({id,slot,material,mask,pattern,
  layer:slot==='tabard'?60:id==='sneakers'?4:slot==='legs'&&material==='cloth'?5:slot==='clothes'?LAYERS.clothes:slot.startsWith('ring')||slot==='necklace'?LAYERS.jewellery:material==='iron'?LAYERS.armour:material==='mail'?LAYERS.mail:LAYERS.padding,
  motion:material==='iron'?'rigid/articulated':material==='mail'?'weighted-skinned':material==='leather'||material==='padded'?'stiff-skinned':'skinned + free-panel cloth',
})])));

/** Items contain art choices, never copies of mask or rigging definitions. */
export class GearRegistry {
  constructor(){this.items=new Map();}
  register(item){
    if(!item.id||this.items.has(item.id))throw new Error(`Duplicate or missing gear ID: ${item.id}`);
    this.items.set(item.id,this.resolve(item));return this;
  }
  resolve(item){
    const base=GEAR_BASES[item.base];if(!base)throw new Error(`Unknown gear base: ${item.base}`);
    if('mask' in item||'layer' in item||'rig' in item)throw new Error('Coverage, layers and rig come from the base');
    if(item.slot&&!(base.id==='ring'&&['ringLeft','ringRight'].includes(item.slot)))throw new Error('Invalid slot override');
    const material=item.material??base.material;if(!MATERIAL_FAMILIES[material])throw new Error(`Unknown material: ${material}`);
    if(material!==base.material)throw new Error('A different movement material requires its own base');
    if(item.resource){metalResource(item.resource);if(!['mail','iron'].includes(material))throw new Error('Metal resources require a metal base');}
    if(item.trimResource)metalResource(item.trimResource);
    return Object.freeze({...item,base,slot:item.slot??base.slot,material,mask:base.mask,layer:base.layer});
  }
  get(id){const item=this.items.get(id);if(item)return item;const variant=resolveVariantItem(id);if(variant)return this.resolve(variant);throw new Error(`Unknown gear: ${id}`);}
  list(slot){return [...this.items.values()].filter(i=>!slot||i.slot===slot);}
}
export function createGearRegistry(){
  const registry=new GearRegistry();
  // Three complete progression tiers reuse the accepted masks and skin weights.
  for(const [tier,level,scale,color,resource]of [['scout',2,.65,'#7b6848','iron'],['guard',5,1,'#56707b','iron'],['veteran',9,1.45,'#788395','steel']]){
    for(const [slot,base,armor]of [['head','open-helmet',8],['body','chainmail',24],['clothes','tunic',3],['legs','trousers',6],['shoes','tall-boots',5],['necklace','pendant',2],['ringLeft','ring',1],['ringRight','ring',1]]){
      registry.register({id:`${slot}.${tier}`,base,name:`${tier[0].toUpperCase()+tier.slice(1)} ${slot==='ringLeft'?'left ring':slot==='ringRight'?'right ring':slot==='body'?'mail vest':slot==='clothes'?'tunic':slot==='legs'?'trousers':slot==='head'?'helm':slot==='shoes'?'boots':'pendant'}`,level,armor:Math.round(armor*scale),color,...(['head','body','necklace','ringLeft','ringRight'].includes(slot)?{resource}:{}),...(slot==='ringRight'?{slot}:{})});
    }
  }
  for(const item of [
    {id:'tabard.highmere',base:'tabard',name:'Highmere watch tabard',faction:'highmere',emblem:'shield',color:'#315e85'},
    {id:'tabard.ash',base:'tabard',name:'Ash Company tabard',faction:'ash',emblem:'flame',color:'#883c32'},
    {id:'tabard.mosswake',base:'tabard',name:'Mosswake tabard',faction:'mosswake',emblem:'tree',color:'#47704b'},
    {id:'tabard.guild',base:'tabard',name:'Guild company tabard',guild:'player',emblem:'shield',color:'#735485'},
    {id:'body.highmere-mail',base:'chainmail',resource:'steel',name:'Highmere steel mail',color:'#aebdca'},
    {id:'body.highmere-plate',base:'plate-cuirass',resource:'steel',name:'Highmere field cuirass',color:'#acbbc7'},
    {id:'head.highmere-helm',base:'open-helmet',resource:'steel',name:'Highmere field helm',color:'#b9c8d1'},
    {id:'clothes.guild-coat',base:'coat',name:'Guild travelling coat',color:'#244e68',trimResource:'bronze'},
    {id:'modern.tshirt',base:'shirt',name:'White cotton T-shirt',color:'#ffffff',finish:'white-cotton',era:'modern'},
    {id:'modern.jeans',base:'jeans',name:'Casual blue jeans',color:'#ffffff',finish:'casual-denim',era:'modern'},
    {id:'modern.sneakers',base:'sneakers',name:'Canvas sneakers',color:'#303a43',finish:'white-cotton',era:'modern'},
    {id:'legs.starter',base:'trousers',name:'Plain linen trousers',color:'#84735f'},
    {id:'clothes.watch-olive',base:'tunic',name:'Watch tunic / olive',color:'#596552'},
    {id:'clothes.ash-ochre',base:'tunic',name:'Ash-company tunic / ochre',color:'#846338'},
    {id:'clothes.traveller-blue',base:'tunic',name:'Traveller tunic / blue',color:'#376785'},
    {id:'clothes.traveller-red',base:'tunic',name:'Traveller tunic / red',color:'#874839'},
    {id:'body.leather-vest',base:'leather-armour',name:'Leather vest',color:'#78543a'},
    {id:'body.riveted-mail',base:'chainmail',name:'Iron mail vest',color:'#899397'},
    {id:'body.iron-cuirass',base:'plate-cuirass',name:'Iron cuirass',color:'#a2adb0'},
    {id:'legs.traveller',base:'trousers',name:'Traveller trousers',color:'#434950'},
    {id:'shoes.traveller',base:'tall-boots',name:'Leather tall boots',color:'#554336'},
    {id:'head.iron-open',base:'open-helmet',name:'Open iron helmet',color:'#a2adb0'},
    {id:'head.cloth-cap',base:'cap',name:'Cloth travelling cap',color:'#645d78'},
    {id:'jewellery.pendant',base:'pendant',name:'Copper pendant',color:'#cea56a'},
    {id:'jewellery.ring-left',base:'ring',name:'Left copper ring',color:'#cea56a'},
    {id:'jewellery.ring-right',base:'ring',slot:'ringRight',name:'Right copper ring',color:'#cea56a'},
  ])registry.register(item);
  return registry;
}
export const STARTER_GEAR=['clothes.traveller-blue','legs.traveller','shoes.traveller','jewellery.pendant'];
