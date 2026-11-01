import {element,action} from './panel-components.js';
import {itemArt} from './item-icons.js';
import {itemTooltip,showCurrency} from './inventory-item.js';
import {startItemDrag,readItemDrag,clearItemDrag,allowItemDrop} from './inventory-drag.js';
import {makeGameWindow} from './game-window.js';
import {registerPanel} from './panel-focus.js';

export function createBagWindow({progress,equip,onEquipmentDrop,onFocus=()=>{},message}){
  const root=element(document.querySelector('#hud'),'section','player-panel bag-window inventory-window');
  root.hidden=true;root.dataset.panel='bag';root.setAttribute('aria-label','Backpack');
  const header=element(root,'header','window-titlebar');element(header,'h2','','Backpack');
  const closeButton=action(header,'×',close,'window-close');closeButton.setAttribute('aria-label','Close backpack');
  const body=element(root,'div','bag-content');let selected=-1,signature='';
  const window=makeGameWindow(root,header,onFocus);registerPanel(close,{persistent:true});
  function close(){const wasOpen=!root.hidden;root.hidden=true;return wasOpen;}
  function refresh(){signature='';render();}
  function render(){
    if(root.hidden||document.body.dataset.inventoryDragging)return;
    signature=JSON.stringify([progress.data.bag,progress.data.coins,progress.data.arrow,progress.data.overflow]);body.replaceChildren();
    const bar=element(body,'div','bag-toolbar');element(bar,'small','',`${progress.data.bag.filter(Boolean).length} / ${progress.data.bag.length} slots`);
    action(bar,'Sort',()=>{progress.sortBag();selected=-1;refresh();}).dataset.tooltip='Combine stacks and sort by name.';
    const grid=element(body,'div','bag-grid');let inspector;
    function inspect(){
      inspector.replaceChildren();const stack=progress.data.bag[selected];
      if(!stack){element(inspector,'small','muted','Drag to move · Right-click to use or equip');return;}
      const item=progress.item(stack.id),copy=element(inspector,'div','selected-item');element(copy,'b','',item.name);copy.dataset.tooltip=itemTooltip(item,stack.count);
      const actions=element(inspector,'div','item-actions');
      if(item.slot||['Ammunition','Consumable'].includes(item.type))action(actions,item.slot?'Equip':item.type==='Ammunition'?'Select arrows':'Use',()=>{equip(selected);refresh();});
      if(stack.count>1)action(actions,'Split',()=>{if(!progress.splitItem(selected))message('You need an empty slot to split this stack.',2);refresh();});
    }
    progress.data.bag.forEach((stack,index)=>{
      const tile=action(grid,'',()=>{selected=index;grid.querySelectorAll('.inventory-slot').forEach((node,i)=>node.classList.toggle('selected',i===index));inspect();},'inventory-slot');
      tile.dataset.index=index;tile.classList.toggle('selected',selected===index);
      tile.setAttribute('aria-label',stack?`${progress.item(stack.id).name}, ${stack.count}, slot ${index+1}`:`Empty bag slot ${index+1}`);
      tile.dataset.tooltip=stack?itemTooltip(progress.item(stack.id),stack.count):`Empty slot ${index+1}`;
      if(stack){
        const item=progress.item(stack.id);tile.innerHTML=itemArt(item);element(tile,'span','stack-count',stack.count>1?stack.count:'');tile.draggable=true;
        tile.ondragstart=event=>startItemDrag(event,{source:'bag',index,id:stack.id},item);
        tile.ondragend=()=>{clearItemDrag();refresh();};tile.ondblclick=()=>{equip(index);refresh();};tile.oncontextmenu=event=>{event.preventDefault();equip(index);refresh();};
      }
      tile.ondragover=event=>allowItemDrop(event,tile);tile.ondragleave=()=>tile.classList.remove('drop-hover');
      tile.ondrop=event=>{
        event.preventDefault();const drag=readItemDrag(event);clearItemDrag();if(!drag)return;
        if(drag.source==='bag'&&progress.data.bag[drag.index]?.id===drag.id)progress.moveItem(drag.index,index);
        else if(drag.source==='equipment')onEquipmentDrop(drag,index);
        selected=index;refresh();
      };
    });
    inspector=element(body,'div','item-inspector');inspect();const footer=element(body,'footer','bag-footer');showCurrency(footer,progress.data.coins);
    if(progress.data.overflow.length){
      const overflow=element(body,'details','bag-overflow');element(overflow,'summary','',`Unclaimed items (${progress.data.overflow.length})`);
      progress.data.overflow.forEach((stack,i)=>action(overflow,`${progress.item(stack.id).name} × ${stack.count}`,()=>{if(!progress.recoverItem(i))message('Make room in your bag first.',2);refresh();}));
    }
  }
  return {root,close,refresh,get isOpen(){return !root.hidden;},show(){root.hidden=false;render();window.focus();},toggle(){if(!close())this.show();},update(){if(!root.hidden&&signature!==JSON.stringify([progress.data.bag,progress.data.coins,progress.data.arrow,progress.data.overflow]))render();}};
}
