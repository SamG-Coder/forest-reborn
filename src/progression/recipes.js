import {insertItem,removeItem} from './inventory.js';
import {ARCHERY_RECIPES} from './archery-recipes.js';

export const RECIPES=Object.freeze([
  ...ARCHERY_RECIPES,
  ...[['scout',2],['guard',4],['veteran',7]].flatMap(([tier,level])=>['head','body','clothes','legs','shoes','necklace','ringLeft','ringRight'].map(slot=>({id:`make-${slot}-${tier}`,name:`Make ${tier} ${slot}`,station:['clothes','legs','shoes'].includes(slot)?'weaver':'forge',skill:['clothes','legs','shoes'].includes(slot)?'tailoring':'smithing',minLevel:level,ingredients:['clothes','legs','shoes'].includes(slot)?{wovenCloth:level,leather:2}:{[tier==='veteran'?'steelIngot':'ironIngot']:level+1,leather:2},output:`${slot}.${tier}`,count:1,xp:level*18,duration:5+level*.5,animation:['clothes','legs','shoes'].includes(slot)?'sew':'hammer'}))),
  ...[['dagger',1,2],['broadsword',2,4],['sabre',3,4],['spear',3,3],['shortshield',3,4],['longsword',5,6],['greatsword',6,8],['frost',7,7],['ember',8,8],['warden',9,10]].map(([id,level,bars])=>({id:`forge-${id}`,name:`Forge ${id==='shortshield'?'short sword and shield':id}`,station:'forge',skill:'smithing',minLevel:level,ingredients:{[level>4?'steelIngot':'ironIngot']:bars,leather:2,...(['spear','shortshield'].includes(id)?{planks:3}:{}),...(id==='frost'||id==='ember'?{giantRune:1}:{})},output:`weapon.${id}`,count:1,xp:level*20,duration:5+level*.5,animation:'hammer'})),
  ...['highmere','mosswake','ash','guild'].map(id=>({id:`sew-tabard-${id}`,name:`Sew ${id} tabard`,station:'weaver',skill:'tailoring',minLevel:3,ingredients:{wovenCloth:3,yarn:2},output:`tabard.${id}`,count:1,xp:40,duration:6,animation:'sew'})),
  {id:'steel',name:'Rework tempered steel',station:'forge',skill:'smithing',minLevel:5,ingredients:{steelScrap:3,coal:1},output:'steelIngot',count:1,xp:30,duration:6,animation:'hammer'},
  {id:'field-mail',name:'Rivet Highmere field mail',station:'forge',skill:'smithing',minLevel:7,ingredients:{steelIngot:6,leather:3},output:'body.highmere-mail',count:1,xp:130,duration:9,animation:'hammer'},
  {id:'field-plate',name:'Forge Highmere cuirass',station:'forge',skill:'smithing',minLevel:9,ingredients:{steelIngot:9,leather:3,wovenCloth:3},output:'body.highmere-plate',count:1,xp:180,duration:10,animation:'hammer'},
  {id:'guild-coat',name:'Sew guild travelling coat',station:'weaver',skill:'tailoring',minLevel:6,ingredients:{wovenCloth:6,yarn:4,linen:2},output:'clothes.guild-coat',count:1,xp:110,duration:8,animation:'sew'},
  {id:'yarn',name:'Spin wool yarn',station:'weaver',skill:'tailoring',ingredients:{wool:3},output:'yarn',count:2,xp:12,duration:4,animation:'sew'},
  {id:'cloth',name:'Weave wool cloth',station:'weaver',skill:'tailoring',ingredients:{yarn:2},output:'wovenCloth',count:1,xp:16,duration:5,animation:'sew'},
  {id:'sewn-cap',name:'Sew travelling cap',station:'weaver',skill:'tailoring',minLevel:2,ingredients:{wovenCloth:2,yarn:1},output:'head.cloth-cap',count:1,xp:22,duration:5,animation:'sew'},
  {id:'sewn-tunic',name:'Sew traveller tunic',station:'weaver',skill:'tailoring',minLevel:3,ingredients:{wovenCloth:3,yarn:2},output:'clothes.traveller-blue',count:1,xp:32,duration:6,animation:'sew'},
  {id:'sewn-trousers',name:'Sew traveller trousers',station:'weaver',skill:'tailoring',minLevel:3,ingredients:{wovenCloth:3,yarn:1},output:'legs.traveller',count:1,xp:28,duration:6,animation:'sew'},
  {id:'leather-boots',name:'Make leather boots',station:'leatherworker',skill:'tailoring',minLevel:3,ingredients:{leather:3,yarn:2},output:'shoes.traveller',count:1,xp:32,duration:6,animation:'sew'},
  {id:'leather-vest',name:'Make leather vest',station:'leatherworker',skill:'tailoring',minLevel:4,ingredients:{leather:5,wovenCloth:2},output:'body.leather-vest',count:1,xp:45,duration:7,animation:'sew'},
  {id:'iron-helmet',name:'Forge open helmet',station:'forge',skill:'smithing',minLevel:2,ingredients:{ironIngot:3,leather:1},output:'head.iron-open',count:1,xp:40,duration:6,animation:'hammer'},
  {id:'iron-mail',name:'Rivet iron mail',station:'forge',skill:'smithing',minLevel:4,ingredients:{ironIngot:6,leather:2},output:'body.riveted-mail',count:1,xp:65,duration:8,animation:'hammer'},
  {id:'iron-cuirass',name:'Forge iron cuirass',station:'forge',skill:'smithing',minLevel:6,ingredients:{ironIngot:9,leather:3,wovenCloth:2},output:'body.iron-cuirass',count:1,xp:100,duration:10,animation:'hammer'},
  {id:'broth',name:'Woodland broth',station:'kitchen',skill:'cooking',ingredients:{berries:3,herbs:1},output:'broth',count:1,xp:12,duration:4,animation:'cook'},
  {id:'healing',name:'Herbal healing draught',station:'alchemy',skill:'alchemy',ingredients:{herbs:3,berries:2},output:'healingPotion',count:1,xp:14,duration:4,animation:'brew'},
  {id:'tonic',name:'Clearwater tonic',station:'alchemy',skill:'alchemy',ingredients:{herbs:2,berries:3},output:'staminaPotion',count:1,xp:14,duration:4,animation:'brew'},
  {id:'planks',name:'Saw planks',station:'carpenter',skill:'woodworking',ingredients:{wood:3},output:'planks',count:2,xp:12,duration:4,animation:'saw'},
  {id:'ingot',name:'Smelt iron',station:'forge',skill:'smithing',ingredients:{iron:3,coal:1},output:'ironIngot',count:1,xp:16,duration:5,animation:'hammer'},
  {id:'leather',name:'Prepare leather',station:'leatherworker',skill:'tailoring',ingredients:{rabbitHide:2},output:'leather',count:1,xp:12,duration:4,animation:'sew'},
  {id:'bandage',name:'Sew bandage',station:'weaver',skill:'tailoring',ingredients:{linen:2},output:'bandage',count:1,xp:10,duration:3,animation:'sew'},
]);

export function craftedBag(progress,recipe){
  if(!recipe||(progress.data.skills[recipe.skill]?.level??1)<(recipe.minLevel??1)||!Object.entries(recipe.ingredients).every(([id,count])=>progress.hasItem(id,count)))return null;
  let bag=progress.data.bag;
  for(const [id,count]of Object.entries(recipe.ingredients))bag=removeItem(bag,id,count);
  return insertItem(bag,recipe.output,recipe.count,progress.item(recipe.output).stack);
}
export function craftItem(progress,recipe){
  const bag=craftedBag(progress,recipe);if(!bag){progress.lastError='Check your ingredients and bag space.';return false;}
  progress.data.bag=bag;progress.addSkillXP(recipe.skill,recipe.xp);progress.recordObjective('craft:'+recipe.output,recipe.count);progress.save();return true;
}

export function consumeItem(progress,index,combat,now=Date.now()){
  const stack=progress.data.bag[index],item=stack&&progress.item(stack.id);
  if(item?.type!=='Consumable')return false;
  if((progress.data.consumableReadyAt??0)>now){progress.lastError=`Recovering: ${Math.ceil((progress.data.consumableReadyAt-now)/1000)}s`;return false;}
  if(combat.hp<=0){progress.lastError='You cannot use that while defeated.';return false;}
  if((!item.heal||combat.hp>=100)&&(!item.stamina||combat.stamina>=100)){progress.lastError='You do not need that yet.';return false;}
  combat.hp=Math.min(100,combat.hp+(item.heal??0));combat.stamina=Math.min(100,combat.stamina+(item.stamina??0));
  progress.data.bag=removeItem(progress.data.bag,item.id,1);progress.data.consumableReadyAt=now+15000;progress.save();return true;
}
