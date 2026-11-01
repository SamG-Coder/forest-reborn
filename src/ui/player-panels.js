import {GEAR_SLOTS} from '../gear/catalog.js';
import {denominations,formatMoney} from '../progression/currency.js';
import {SKILLS,skillThreshold} from '../progression/skills.js';
import {characterStats} from '../progression/character-stats.js';
import {itemIcon,itemArt} from './item-icons.js';
import {createCharacterPreview} from './character-preview.js';
import {registerPanel,focusPanel} from './panel-focus.js';
import './player-panels.css';
import {consumeItem} from '../progression/recipes.js';
import {itemImage} from './panel-components.js';

export function createPlayerPanels({avatar,registry,materials,progress,appearance,combat,onEquipmentChange,onAppearance,onSkill,message}){
  const root=document.createElement('section');root.className='player-panel';root.hidden=true;root.setAttribute('aria-label','Character menus');
  root.innerHTML='<header><div><small>FOREST REBORN</small><h2></h2></div><button class="close-player-panel" aria-label="Close panel">×</button></header><nav></nav><div class="player-panel-content"></div>';
  document.querySelector('#hud').append(root);const body=root.querySelector('.player-panel-content'),title=root.querySelector('h2');
  const preview=createCharacterPreview(avatar,registry,materials,progress,appearance);
  let current=null,selected=-1,signature='',lastTime=0;
  const button=(parent,label,click,tooltip)=>{const b=document.createElement('button');b.textContent=label;b.onclick=click;if(tooltip)b.dataset.tooltip=tooltip;parent.append(b);return b;};
  const paragraph=(parent,content,tag='p')=>{const p=document.createElement(tag);p.textContent=content;parent.append(p);return p;};
  const currency=parent=>{const row=document.createElement('div');row.className='currency';row.dataset.tooltip='Money\n100 copper = 1 silver\n100 silver = 1 gold';for(const [kind,value]of Object.entries(denominations(progress.data.coins))){const span=document.createElement('span');span.className=kind;span.textContent=value;span.setAttribute('aria-label',`${value} ${kind}`);row.append(span);}parent.append(row);};
  function itemTooltip(item,count=1){return `${item.name}${count>1?' × '+count:''}\n${item.type}${item.slot?' · '+(GEAR_SLOTS[item.slot]??'Weapon'):''}\n${item.description}\n${item.value?'Value: '+formatMoney(item.value)+' each':'Not for sale'}${item.slot?'\nDouble-click or right-click to equip.':''}`;}
  function equip(index){const item=progress.item(progress.data.bag[index]?.id);if(item.type==='Consumable'){if(consumeItem(progress,index,combat)){message('Used '+item.name,2);signature='';render();}else message(progress.lastError,2);return;}if(progress.equipItem(index)){onEquipmentChange();signature='';render();}else message(progress.lastError||'This item cannot be equipped.',2);}
  function bag(){
    const toolbar=document.createElement('div');toolbar.className='bag-toolbar';body.append(toolbar);currency(toolbar);
    const used=progress.data.bag.filter(Boolean).length;paragraph(toolbar,`${used} / ${progress.data.bag.length} slots`,'small');
    button(toolbar,'Sort',()=>{progress.sortBag();selected=-1;render();},'Sort bag\nCombine stacks and sort items by name.');
    const grid=document.createElement('div');grid.className='bag-grid';body.append(grid);
    let inspect;
    const inspectItem=()=>{
      inspect.replaceChildren();const stack=progress.data.bag[selected];
      if(stack){const item=progress.item(stack.id);paragraph(inspect,item.name,'h3');paragraph(inspect,item.description);if(item.slot)button(inspect,'Equip',()=>equip(selected));if(item.type==='Consumable')button(inspect,'Use',()=>equip(selected));if(stack.count>1)button(inspect,'Split stack',()=>{progress.splitItem(selected);render();},'Split stack\nMove half into an empty bag slot.');}
      else paragraph(inspect,'Select an item to inspect it. Drag to move; double-click equipment to wear it.');
    };
    progress.data.bag.forEach((stack,index)=>{
      const tile=button(grid,'',()=>{selected=index;grid.querySelectorAll('.inventory-slot').forEach((node,i)=>node.classList.toggle('selected',i===selected));inspectItem();});tile.className='inventory-slot'+(index===selected?' selected':'');tile.dataset.index=index;
      tile.dataset.tooltip=stack?itemTooltip(progress.item(stack.id),stack.count):`Empty slot ${index+1}\nDrag an item here to move it.`;
      tile.setAttribute('aria-label',stack?`${progress.item(stack.id).name}, ${stack.count}, slot ${index+1}`:`Empty bag slot ${index+1}`);
      if(stack){tile.innerHTML=itemArt(progress.item(stack.id))+`<span class="stack-count">${stack.count>1?stack.count:''}</span>`;tile.draggable=true;
        tile.ondragstart=e=>e.dataTransfer.setData('text/plain',String(index));tile.ondblclick=()=>equip(index);tile.oncontextmenu=e=>{e.preventDefault();equip(index);};}
      tile.ondragover=e=>e.preventDefault();tile.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(from)&&progress.moveItem(from,index)){selected=index;render();}};
    });
    inspect=document.createElement('div');inspect.className='item-inspector';body.append(inspect);inspectItem();
    if(progress.data.overflow.length){paragraph(body,'Unclaimed items','h3');progress.data.overflow.forEach((stack,i)=>button(body,`${progress.item(stack.id).name} × ${stack.count}`,()=>{if(!progress.recoverItem(i))message('Make room in your bag first.',2);render();},'Recover item\nMoves this saved item into your bag when there is room.'));}
  }
  function character(){
    const stats=characterStats(progress.data,registry),layout=document.createElement('div');layout.className='character-layout';body.append(layout);
    const slots=document.createElement('div');slots.className='equipment-slots';layout.append(slots);
    for(const [slot,label]of Object.entries({...GEAR_SLOTS,weapon:'Weapon'})){
      const id=slot==='weapon'?(progress.data.weapon==='sword'?'sword':null):progress.data.equipped.find(id=>progress.item(id).slot===slot),item=id&&progress.item(id);
      const tile=button(slots,'',()=>{if(id){if(!progress.unequip(slot))message(progress.lastError,2);else onEquipmentChange();render();}else show('bag');});tile.className='equipment-slot';tile.dataset.slot=slot;
      tile.innerHTML=(item?itemArt(item):itemIcon(slot.startsWith('ring')?'ring':slot==='weapon'?'sword':slot))+`<span>${label}</span><small></small>`;tile.querySelector('small').textContent=item?.name??'Empty';
      tile.dataset.tooltip=item?`${itemTooltip(item)}\nClick to remove into your bag.`:`${label}\nEmpty. Click to open your bag.`;
    }
    const model=document.createElement('div');model.className='paper-doll';layout.append(model);model.append(preview.mount);paragraph(model,`${appearance.name} · Level ${progress.data.level} Warrior`,'h3');button(model,'Edit appearance',onAppearance,'Edit appearance\nReturn to the character creator. Equipment and progress are kept.');preview.prepare().catch(error=>message(error.message,4));
    const list=document.createElement('dl');list.className='character-stats';layout.append(list);
    const entries=[['Health',`${Math.ceil(combat.hp)} / 100`],['Stamina',`${Math.ceil(combat.stamina)} / 100`],['Attack damage',stats.damage],['Attack interval',stats.interval+' s'],['Attack range',stats.range+' m'],['Armour',stats.armor],['Damage reduction',(stats.mitigation*100).toFixed(1)+'%'],['Block chance',(stats.blockChance*100).toFixed(1)+'%'],['Walk speed',stats.walkSpeed+' m/s'],['Run speed',stats.runSpeed+' m/s']];
    for(const [name,value] of entries){paragraph(list,name,'dt');paragraph(list,String(value),'dd');}currency(body);
  }
  function skills(){
    paragraph(body,'Skills improve when you use them. Moving interrupts gathering.');
    for(const group of ['Combat','Gathering','Crafting','Town']){
      paragraph(body,group,'h3');const list=document.createElement('div');list.className='skill-list';body.append(list);
      for(const [id,definition]of Object.entries(SKILLS).filter(([,d])=>d.group===group)){
        const skill=progress.data.skills[id],target=skillThreshold(skill.level),row=button(list,'',()=>onSkill(id));row.className='skill-row';row.dataset.skill=id;row.dataset.tooltip=definition.name+'\n'+definition.description;
        itemImage(row,progress.item({husbandry:'shears',sword:'sword',unarmed:'unarmed',defence:'body.iron-cuirass',herbalism:'herbs',woodcutting:'axe',mining:'iron',trading:'flour',cooking:'broth',alchemy:'healingPotion',smithing:'ironIngot',woodworking:'planks',tailoring:'wovenCloth'}[id]));
        row.insertAdjacentHTML('beforeend','<span><b></b><small></small></span><strong></strong><div class="skill-xp"><i></i></div><em></em>');
        row.querySelector('b').textContent=definition.name;row.querySelector('small').textContent=definition.description;row.querySelector('strong').textContent='Lv '+skill.level;
        row.querySelector('i').style.width=(skill.level===100?100:skill.xp/target*100)+'%';row.querySelector('em').textContent=skill.level===100?'Mastered':`${skill.xp} / ${target} XP`;
      }
    }
  }
  function render(){if(!current)return;root.dataset.panel=current;title.textContent={bag:'Backpack',character:'Character',skills:'Skills'}[current];body.replaceChildren();({bag,character,skills})[current]();for(const b of root.querySelectorAll('nav button'))b.classList.toggle('active',b.dataset.page===current);}
  function show(page){focusPanel(close);current=page;root.hidden=false;selected=-1;signature='';render();}
  function close(){const wasOpen=!root.hidden;root.hidden=true;current=null;return wasOpen;}
  for(const [page,label]of Object.entries({character:'Character',bag:'Backpack',skills:'Skills'})){const b=button(root.querySelector('nav'),label,()=>show(page));b.dataset.page=page;}
  root.querySelector('.close-player-panel').onclick=close;
  registerPanel(close);
  return {show,close,get active(){return current;},update(dt,time){
    if(root.hidden)return;if(current==='character')preview.update(dt);
    if(time-lastTime<.2)return;lastTime=time;const next=JSON.stringify([progress.data.bag,progress.data.equipped,progress.data.weapon,progress.data.coins,progress.data.skills,Math.ceil(combat.hp),Math.ceil(combat.stamina)]);
    if(next!==signature){signature=next;render();}
  }};
}
