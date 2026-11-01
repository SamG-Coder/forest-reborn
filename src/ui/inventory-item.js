import {GEAR_SLOTS} from '../gear/catalog.js';
import {denominations,formatMoney} from '../progression/currency.js';
import {element} from './panel-components.js';

export function itemTooltip(item,count=1){
  return `${item.name}${count>1?' × '+count:''}\n${item.type}${item.slot?' · '+(GEAR_SLOTS[item.slot]??'Weapon'):''}${item.level>1?' · Requires level '+item.level:''}\n${item.description}\n${item.value?'Value: '+formatMoney(item.value)+' each':'Not for sale'}${item.slot?'\nDrag onto your character to equip. Right-click to equip.':''}`;
}
export function showCurrency(parent,coins){
  const row=element(parent,'div','currency');row.dataset.tooltip='100 copper = 1 silver\n100 silver = 1 gold';
  for(const [kind,value]of Object.entries(denominations(coins))){const coin=element(row,'span',kind,String(value));coin.setAttribute('aria-label',`${value} ${kind}`);}
  return row;
}
