const weapon=(name,damage,interval,reach,level,profile,effect=null)=>({name,damage,interval,reach,level,profile,effect});
export const WEAPONS=Object.freeze({
  'weapon.shortbow':{...weapon('Ash shortbow',23,2.15,24,1,'bow'),grip:'bow',animation:'draw',ranged:true,projectileSpeed:34,blockChance:.04},
  'weapon.longbow':{...weapon('Yew warbow',38,2.8,38,5,'warbow'),grip:'bow',animation:'draw',ranged:true,projectileSpeed:44,blockChance:.04},
  sword:weapon('Worn arming sword',24,1.5,2.4,1,'arming'),
  'weapon.dagger':weapon('Iron rondel dagger',16,.88,1.65,2,'dagger',{type:'bleed',duration:4,power:2}),
  'weapon.broadsword':weapon('Watch broadsword',32,1.6,2.4,3,'broad'),
  'weapon.sabre':weapon('Road sabre',27,1.15,2.35,4,'sabre',{type:'bleed',duration:4,power:2}),
  'weapon.longsword':weapon('Highmere longsword',45,1.9,2.75,6,'long'),
  'weapon.frost':weapon('Rime-edged sword',39,1.5,2.5,8,'rune',{type:'slow',duration:3,power:.35}),
  'weapon.ember':weapon('Embersteel blade',46,1.65,2.5,10,'rune',{type:'burn',duration:3,power:4}),
  'weapon.warden':weapon('Warden’s great blade',64,2.3,2.85,12,'great'),
  'weapon.spear':{...weapon('Watch ash spear',33,1.85,3.6,4,'spear'),grip:'spear',animation:'thrust'},
  'weapon.greatsword':{...weapon('Two-handed field sword',55,2.25,2.95,8,'great'),grip:'two-hand',animation:'overhead'},
  'weapon.shortshield':{...weapon('Short sword and round shield',23,1.25,2.05,3,'short'),grip:'shield',shieldArmor:12,blockChance:.44,animation:'cut'},
});
export const isWeapon=id=>Object.hasOwn(WEAPONS,id);
export const weaponDefinition=id=>WEAPONS[id]??null;
export function weaponAction(id){const w=WEAPONS[id];return w?{...w,grip:w.grip??(w.profile==='great'?'two-hand':'one-hand'),kind:'sword',duration:w.ranged?1.6:Math.min(w.interval*.78,w.profile==='great'?1.45:1.12),hit:w.ranged?.64:.46,cost:Math.round(12+w.damage*.2)}:{kind:'punch',grip:'unarmed',damage:12,interval:1.05,reach:1.65,duration:.48,hit:.38,cost:9};}
