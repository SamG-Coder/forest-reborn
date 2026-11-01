/** Independent chances, no guaranteed armour shower. Quest credit is separate. */
export const LOOT_TABLES=Object.freeze({
  rabbit:{coins:[0,2],items:[['rabbitHide',1,1,2],['berries',.2,1,2]]},
  goblin:{coins:[2,7],items:[['goblinScrap',1,1,3],['iron',.3,1,2],['weapon.dagger',.06,1,1],['head.scout',.04,1,1]]},
  bandit:{coins:[4,15],items:[['linen',.85,1,3],['bread',.3,1,2],['weapon.sabre',.05,1,1],['body.scout',.04,1,1]]},
  ogre:{coins:[12,32],items:[['ogreTooth',1,1,2],['iron',.65,2,4],['weapon.longsword',.08,1,1],['legs.guard',.06,1,1]]},
  ogreChampion:{coins:[30,65],items:[['ogreTooth',1,2,3],['weapon.frost',.1,1,1],['body.guard',.12,1,1]]},
  ashRaider:{coins:[10,24],items:[['steelScrap',1,1,3],['bandage',.4,1,2],['weapon.longsword',.06,1,1],['shoes.veteran',.06,1,1]]},
  shieldbreaker:{coins:[18,40],items:[['steelScrap',1,2,4],['weapon.ember',.07,1,1],['head.veteran',.08,1,1]]},
  hillGiant:{coins:[45,100],items:[['giantRune',1,1,1],['steelIngot',.7,1,3],['weapon.warden',.12,1,1],['body.veteran',.12,1,1]]},
  resident:{coins:[1,8],items:[['linen',.5,1,2]]},
});
export const CORPSE_SECONDS=25;
export function rollLoot(kind,random=Math.random){
  const table=LOOT_TABLES[kind]??LOOT_TABLES.resident,integer=(a,b)=>a+Math.floor(Math.min(.999999,random())*(b-a+1));
  return {coins:integer(...table.coins),items:table.items.flatMap(([id,chance,min,max])=>random()<chance?[{id,count:integer(min,max)}]:[])};
}
export function takeLoot(loot,progress,id=null){
  let taken=0;
  if((id===null||id==='coins')&&loot.coins){progress.data.coins+=loot.coins;loot.coins=0;taken++;}
  for(const stack of loot.items){if(stack.count>0&&(id===null||id===stack.id)&&progress.addItem(stack.id,stack.count)){stack.count=0;taken++;}}
  loot.items=loot.items.filter(s=>s.count>0);progress.save();return taken;
}
