import {element,action,itemImage} from './panel-components.js';
import {formatMoney} from '../progression/currency.js';
import {itemTooltip} from './inventory-item.js';
import {focusPanel,registerPanel} from './panel-focus.js';
import {makeGameWindow} from './game-window.js';

export function createLootPanel({corpses,progress,player,message}){
  const panel=element(document.querySelector('#hud'),'section','world-panel loot-panel');panel.hidden=true;panel.setAttribute('aria-label','Loot');
  let record=null,signature='';
  const close=()=>{const open=!panel.hidden;panel.hidden=true;record=null;return open;};registerPanel(close);
  const header=element(panel,'header','window-titlebar');element(header,'h2','','Loot');
  action(header,'×',close,'window-close').setAttribute('aria-label','Close loot');
  const heading=element(panel,'div','loot-source'),body=element(panel,'div','loot-content');
  const window=makeGameWindow(panel,header),empty=()=>!record?.loot.coins&&!record?.loot.items.length;
  function render(){
    if(empty()){close();return;}
    signature=JSON.stringify(record.loot);body.replaceChildren();heading.textContent=record.target.name;
    const list=element(body,'div','loot-items');
    if(record.loot.coins){const row=action(list,'',()=>take('coins'),'loot-row');element(row,'span','loot-coins','●');element(row,'strong','',formatMoney(record.loot.coins));row.dataset.tooltip='Click to collect coins.';}
    for(const stack of record.loot.items){
      const item=progress.item(stack.id),row=action(list,'',()=>take(stack.id),'loot-row');row.dataset.item=stack.id;
      itemImage(row,item);element(row,'strong','',item.name);element(row,'span','loot-quantity',stack.count>1?'×'+stack.count:'');row.dataset.tooltip=itemTooltip(item,stack.count)+'\nClick to loot.';
    }
    const footer=element(body,'footer','loot-footer');element(footer,'small','muted','Click an item to take it');action(footer,'Loot all',()=>take(),'primary-action');
  }
  function take(id=null){
    if(!record)return;
    if(!corpses.take(record,progress,player.position,id))message(player.position.distanceTo(record.position)>3?'Move closer to loot.':'Your bag is full.',3);
    render();
  }
  return {close,show(r){
    if(!r?.bag||player.position.distanceTo(r.bag.position)>3){message('Move closer to the loot bag.',3);return;}
    if(!r.loot.items.length&&!r.loot.coins)return;
    focusPanel(close);record=r;panel.hidden=false;render();window.focus();
  },update(){
    if(!record||panel.hidden)return;
    if(empty()||!corpses.records.has(record.id)||player.position.distanceTo(record.bag.position)>3.5){close();return;}
    if(signature!==JSON.stringify(record.loot))render();
  }};
}
