import {isWeapon} from '../game/weapon-catalog.js';
import {GEAR_SLOTS} from '../gear/catalog.js';
import {SKILLS,skillThreshold} from '../progression/skills.js';
import {characterStats} from '../progression/character-stats.js';
import {consumeItem} from '../progression/recipes.js';
import {itemIcon,itemArt} from './item-icons.js';
import {createCharacterPreview} from './character-preview.js';
import {registerPanel,focusPanel} from './panel-focus.js';
import {element,action,itemImage} from './panel-components.js';
import {createBagWindow} from './bag-window.js';
import {itemTooltip} from './inventory-item.js';
import {startItemDrag,readItemDrag,clearItemDrag,allowItemDrop} from './inventory-drag.js';
import {makeGameWindow} from './game-window.js';
import './player-panels.css';

export function createPlayerPanels({avatar,registry,materials,progress,appearance,combat,onEquipmentChange,onAppearance,onSkill,message}){
  const root=element(document.querySelector('#hud'),'section','player-panel inventory-window character-window');root.hidden=true;root.setAttribute('aria-label','Character');
  const header=element(root,'header','window-titlebar'),title=element(header,'h2');action(header,'×',closeMain,'window-close').setAttribute('aria-label','Close character');
  const nav=element(root,'nav','character-tabs'),body=element(root,'div','player-panel-content');
  const preview=createCharacterPreview(avatar,registry,materials,progress,appearance);
  let current=null,signature='',lastTime=0,focused='character';
  const window=makeGameWindow(root,header,()=>{focused='character';});
  const equippedId=slot=>slot==='weapon'?(isWeapon(progress.data.weapon)?progress.data.weapon:null):progress.data.equipped.find(id=>progress.item(id).slot===slot);
  function changed(){onEquipmentChange();signature='';render();bag.refresh();}
  function equip(index){
    const stack=progress.data.bag[index];if(!stack)return false;const item=progress.item(stack.id);
    if(item.type==='Ammunition'){progress.data.arrow=item.id;progress.save();message('Using '+item.name,2);bag.refresh();return true;}
    if(item.type==='Consumable'){const used=consumeItem(progress,index,combat);message(used?'Used '+item.name:progress.lastError,2);bag.refresh();return used;}
    if(progress.equipItem(index)){changed();return true;}
    message(progress.lastError||'This item cannot be equipped.',2);return false;
  }
  function dropEquipment(drag,index){
    if(equippedId(drag.slot)!==drag.id)return;
    const stack=progress.data.bag[index];
    if(stack){if(progress.item(stack.id).slot===drag.slot)equip(index);else message('Drop equipment into an empty bag slot.',2);return;}
    const free=progress.data.bag.findIndex(s=>!s);
    if(!progress.unequip(drag.slot)){message(progress.lastError,2);return;}
    if(free!==index)progress.moveItem(free,index);changed();
  }
  const bag=createBagWindow({progress,equip,onEquipmentDrop:dropEquipment,onFocus:()=>{focused='bag';},message});
  function receiveEquipment(event,slot){
    event.preventDefault();const drag=readItemDrag(event);clearItemDrag();
    if(drag?.source!=='bag'||progress.data.bag[drag.index]?.id!==drag.id)return;
    const item=progress.item(drag.id);
    if(!item.slot||slot&&item.slot!==slot){message(slot?'That item does not fit this slot.':'This item cannot be equipped.',2);return;}
    equip(drag.index);
  }
  function equipmentSlot(parent,slot){
    const id=equippedId(slot),item=id&&progress.item(id),label=GEAR_SLOTS[slot]??'Weapon';
    const tile=action(parent,'',()=>bag.show(),'equipment-slot');tile.dataset.slot=slot;tile.setAttribute('aria-label',`${label}: ${item?.name??'Empty'}`);
    tile.innerHTML=item?itemArt(item):itemIcon(slot.startsWith('ring')?'ring':slot==='weapon'?'sword':slot==='tabard'?'clothes':slot);
    element(tile,'small','slot-label',({head:'Head',clothes:'Clothes',body:'Armour',ringLeft:'Ring',ringRight:'Ring',tabard:'Tabard'})[slot]??label);
    tile.dataset.tooltip=item?itemTooltip(item)+'\nRight-click to remove. Drag into your bag.':label+'\nDrop matching equipment here.';
    if(item){tile.draggable=true;tile.ondragstart=e=>startItemDrag(e,{source:'equipment',slot,id},item);tile.ondragend=clearItemDrag;}
    tile.oncontextmenu=e=>{e.preventDefault();if(id){if(progress.unequip(slot))changed();else message(progress.lastError,2);}};
    tile.ondragover=e=>allowItemDrop(e,tile);tile.ondragleave=()=>tile.classList.remove('drop-hover');tile.ondrop=e=>receiveEquipment(e,slot);
  }
  function character(){
    const name=element(body,'div','character-identity');element(name,'h3','',appearance.name);element(name,'small','',`Level ${progress.data.level} · Warrior`);
    const layout=element(body,'div','character-loadout'),left=element(layout,'div','equipment-slots'),model=element(layout,'div','paper-doll'),right=element(layout,'div','equipment-slots');
    for(const slot of ['head','necklace','clothes','body','tabard'])equipmentSlot(left,slot);
    for(const slot of ['legs','shoes','ringLeft','ringRight','weapon'])equipmentSlot(right,slot);
    model.append(preview.mount);element(model,'small','preview-hint','Drag to rotate · Drop gear to equip');
    model.ondragover=e=>allowItemDrop(e,model);model.ondragleave=()=>model.classList.remove('drop-hover');model.ondrop=e=>receiveEquipment(e);
    preview.prepare().catch(error=>message(error.message,4));
    const stats=characterStats(progress.data,registry),list=element(body,'dl','character-stats');
    for(const [name,value]of [['Health',`${Math.ceil(combat.hp)} / 100`],['Stamina',`${Math.ceil(combat.stamina)} / 100`],['Damage',stats.damage],['Attack speed',stats.interval+' s'],['Range',stats.range+' m'],['Armour',stats.armor],['Reduction',(stats.mitigation*100).toFixed(1)+'%'],['Block',(stats.blockChance*100).toFixed(1)+'%'],['Walk',stats.walkSpeed+' m/s'],['Run',stats.runSpeed+' m/s']]){
      element(list,'dt','',name);element(list,'dd','',String(value)).dataset.stat=name;
    }
    const footer=element(body,'footer','character-footer');action(footer,'Open backpack · B',()=>bag.show());action(footer,'Edit appearance',onAppearance);
  }
  function skills(){
    for(const group of ['Combat','Gathering','Crafting','Town']){
      element(body,'h3','skill-heading',group);const list=element(body,'div','skill-list');
      for(const [id,definition]of Object.entries(SKILLS).filter(([,d])=>d.group===group)){
        const skill=progress.data.skills[id],target=skillThreshold(skill.level),row=action(list,'',()=>onSkill(id),'skill-row');row.dataset.skill=id;row.dataset.tooltip=definition.name+'\n'+definition.description;
        itemImage(row,id==='riding'?{id:'mount',icon:'mount'}:progress.item({archery:'weapon.shortbow',fletching:'arrow.iron',husbandry:'shears',sword:'sword',unarmed:'unarmed',defence:'body.iron-cuirass',herbalism:'herbs',woodcutting:'axe',mining:'iron',trading:'flour',cooking:'broth',alchemy:'healingPotion',smithing:'ironIngot',woodworking:'planks',tailoring:'wovenCloth'}[id]));
        const copy=element(row,'span');element(copy,'b','',definition.name);element(copy,'small','',definition.description);element(row,'strong','',`Lv ${skill.level}`);
        const track=element(row,'div','skill-xp');element(track,'i').style.width=(skill.level===100?100:skill.xp/target*100)+'%';element(row,'em','',skill.level===100?'Mastered':`${skill.xp} / ${target} XP`);
      }
    }
  }
  function render(){if(!current||document.body.dataset.inventoryDragging)return;root.dataset.panel=current;title.textContent=current==='character'?'Character':'Skills';body.replaceChildren();(current==='character'?character:skills)();for(const b of nav.children)b.classList.toggle('active',b.dataset.page===current);}
  function show(page){if(page==='bag'){bag.show();return;}focusPanel(closeMain);current=page;root.hidden=false;signature='';render();window.focus();}
  function closeMain(){const wasOpen=!root.hidden;root.hidden=true;current=null;return wasOpen;}
  function close(){const wasOpen=closeMain();return bag.close()||wasOpen;}
  function closeTop(){return focused==='bag'?(bag.close()||closeMain()):(closeMain()||bag.close());}
  for(const [page,label]of Object.entries({character:'Equipment',skills:'Skills'})){const b=action(nav,label,()=>show(page));b.dataset.page=page;}
  registerPanel(closeMain);
  return {show,close,closeMain,closeTop,toggle(page){if(page==='bag')bag.toggle();else if(current===page)closeMain();else show(page);},get active(){return current??(bag.isOpen?'bag':null);},update(dt,time){
    bag.update();if(root.hidden)return;
    if(current==='character'){
      preview.update(dt);
      for(const [stat,value]of [['Health',combat.hp],['Stamina',combat.stamina]]){const cell=body.querySelector(`[data-stat="${stat}"]`);if(cell)cell.textContent=Math.ceil(value)+' / 100';}
    }
    if(time-lastTime<.2)return;lastTime=time;
    const next=JSON.stringify([progress.data.equipped,progress.data.weapon,progress.data.level,current==='skills'?progress.data.skills:null]);
    if(next!==signature&&!document.body.dataset.inventoryDragging){signature=next;render();}
  }};
}
