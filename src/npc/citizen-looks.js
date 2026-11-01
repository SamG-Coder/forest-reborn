import {Color} from 'three';
import {CLOTH_DYES,encodeVariant,variantItemIds} from '../gear/variants.js';

const DYES=['blue','rust','ivory','green','violet','ochre','slate','teal','red','indigo','rose','black'];
export function citizenLook(index){
  const gender=index%3===0?'female':'male',dye=DYES[index%DYES.length],pants=DYES[(index*5+3)%DYES.length];
  const skin=['#e7bc98','#b68566','#d5a077','#f0c9a5','#9c7057'][index%5];
  const hairColor=['#2d2523','#6c442f','#b49461','#8c766c','#4a3330','#c7bca0'][index%6];
  const hair=gender==='female'?['bob','ponytail','braid','long'][Math.floor(index/3)%4]:['short','swept','shaggy','parted','spiky','undercut'][index%6];
  const common={outer:index%5===0?'leather':'none',leather:index%2?'brown':'tan',states:{frontPanel:index%4===1,backPanel:index%4===1,helmet:false,necklace:index%7===0,ringLeft:false,ringRight:false,trim:index%3===0,belt:true,shoulderLeft:false,shoulderRight:false}};
  const outfit=variantItemIds(encodeVariant({...common,dye}));
  const legId=variantItemIds(encodeVariant({...common,dye:pants})).find(id=>id.endsWith('/legs'));
  outfit.splice(outfit.findIndex(id=>id.endsWith('/legs')),1,legId);
  return {gender,skin,hairColor,hair,outfit,face:index%5,height:.94+(index%5)*.025,
    clothColor:new Color(CLOTH_DYES.find(c=>c.id===dye).color),pantsColor:new Color(CLOTH_DYES.find(c=>c.id===pants).color),skinColor:new Color(skin),hairTint:new Color(hairColor)};
}
