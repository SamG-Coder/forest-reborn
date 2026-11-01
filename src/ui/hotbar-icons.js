import {isWeapon,weaponDefinition} from '../game/weapon-catalog.js';
import {itemArt} from './item-icons.js';

export function decorateHotbar(){
  const keys={character:'C',bag:'B',skills:'K',quests:'L',friends:'O',map:'M',guilds:'G'};
  for(const button of document.querySelectorAll('#hotbar .utility-action')){
    const id=button.dataset.panel??'guilds',label=button.textContent;
    button.innerHTML=itemArt({id});const name=document.createElement('span');name.className='action-name';name.textContent=label;button.append(name);
    if(keys[id]){const key=document.createElement('kbd');key.textContent=keys[id];button.append(key);}
  }
  const attack=document.querySelector('#attack'),icon=document.createElement('span');icon.className='attack-icon';attack.prepend(icon);
  let previous=null;
  return weapon=>{if(weapon===previous)return;previous=weapon;icon.innerHTML=itemArt({id:isWeapon(weapon)?weapon:'unarmed',icon:'sword'});};
}
