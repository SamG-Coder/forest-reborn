export const SKILLS=Object.freeze({
  riding:{name:'Riding',group:'Combat',description:'A galloping charge can strike an enemy. Spears hit harder and braced enemy spears can stop you.'},
  archery:{name:'Archery',group:'Combat',description:'Land arrows to improve bow damage. Bows consume arrows from your bag.'},
  fletching:{name:'Fletching',group:'Crafting',description:'Shape unstrung bows, twist flax bowstrings and assemble tipped arrows at the loom and carpenter’s bench.'},
  husbandry:{name:'Husbandry',group:'Gathering',description:'Buy shears from Orin. Shear sheep in the southeast pasture; their fleece grows back.'},
  sword:{name:'Swordsmanship',group:'Combat',description:'Earn XP by landing sword attacks on living enemies.'},
  unarmed:{name:'Unarmed',group:'Combat',description:'Earn XP by landing punches on living enemies.'},
  defence:{name:'Defence',group:'Combat',description:'Earn XP when you block an enemy attack.'},
  herbalism:{name:'Herbalism',group:'Gathering',description:'Gather meadow herbs. Stand near a plant and press V.'},
  woodcutting:{name:'Woodcutting',group:'Gathering',description:'Buy an axe from Orin, then chop a standing tree with V.'},
  mining:{name:'Mining',group:'Gathering',description:'Work an ore deposit with V to gather iron or copper.'},
  trading:{name:'Trading',group:'Town',description:'Earn XP by selling gathered materials to Orin.'},
  cooking:{name:'Cooking',group:'Crafting',description:'Prepare food at Tomas’s kitchen with gathered ingredients.'},
  alchemy:{name:'Alchemy',group:'Crafting',description:'Brew healing draughts and tonics at the apothecary table.'},
  smithing:{name:'Smithing',group:'Crafting',description:'Smelt ore at Garrick’s forge.'},
  woodworking:{name:'Woodworking',group:'Crafting',description:'Saw timber into planks at the carpenter’s bench.'},
  tailoring:{name:'Tailoring',group:'Crafting',description:'Sew linen bandages at the weaver’s house.'},
});
export const skillThreshold=level=>Math.round(30*level**1.35);
export function createSkills(saved={}){return Object.fromEntries(Object.keys(SKILLS).map(id=>[id,{level:Math.max(1,Math.min(100,Math.floor(saved[id]?.level)||1)),xp:Math.max(0,Math.floor(saved[id]?.xp)||0),total:Math.max(0,Math.floor(saved[id]?.total)||0)}]));}
export function awardSkill(skills,id,amount){
  const skill=skills[id];if(!skill||!Number.isFinite(amount)||amount<=0)return;
  skill.total+=amount;if(skill.level===100)return;skill.xp+=amount;
  while(skill.level<100&&skill.xp>=skillThreshold(skill.level)){skill.xp-=skillThreshold(skill.level);skill.level++;}
  if(skill.level===100)skill.xp=0;
}
export const GATHERING=Object.freeze({
  flax:{skill:'herbalism',xp:8,duration:3,animation:'gather',yield:3,label:'Pulling flax'},
  feather:{skill:'husbandry',xp:5,duration:2,animation:'gather',yield:3,label:'Collecting fallen feathers'},
  wool:{skill:'husbandry',xp:12,duration:4,animation:'shear',tool:'shears',yield:3,label:'Shearing sheep'},
  coal:{skill:'mining',xp:8,duration:3.5,animation:'mine',label:'Mining coal'},
  berries:{skill:'herbalism',xp:7,duration:2.5,animation:'gather',label:'Picking berries'},
  herbs:{skill:'herbalism',xp:8,duration:2.5,animation:'gather',label:'Gathering herbs'},
  wood:{skill:'woodcutting',xp:12,duration:4.8,animation:'chop',tool:'axe',yield:3,label:'Chopping tree'},
  iron:{skill:'mining',xp:10,duration:3.5,animation:'mine',label:'Mining iron'},
  copper:{skill:'mining',xp:10,duration:3.5,animation:'mine',label:'Mining copper'},
});
