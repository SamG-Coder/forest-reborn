import './item-art.css';
import {publicUrl} from '../assets/public-url.js';
const paths={
  unstrungBow:'M10 5C44 13 44 41 10 49M26 21l5 11M8 4l4 3M8 50l4-3',
  mount:'M12 45V29L8 22l4-11 9 5 10-9 4 4 2 13 8 8-5 7-10-4-3 10ZM21 16l7 6M14 25l6 3M30 35l-6-9',
  sword:'M12 40 39 9 42 6 42 13 17 44ZM8 32 23 45M8 47 15 39',
  clothes:'m17 8 7 4 7-4 13 11-8 8-5-5v24H17V22l-5 5-8-8Z',
  body:'m13 9 10 4 12-4 8 15-7 6-3 17H15l-3-17-8-6ZM15 29h20',
  legs:'M13 8h24l-2 39H25l-1-23-2 23H11ZM13 15h24',
  shoes:'M18 7h18v28l8 6v6H12V36l6-6ZM18 13h18',
  head:'M8 33V23a16 16 0 0 1 32 0v10l-9 6v-9H17v9ZM8 25h32',
  ring:'M14 16 24 6l10 10-10 10ZM17 23a13 13 0 1 0 14 0',
  necklace:'M11 8v16a13 13 0 0 0 26 0V8M24 37l-6 5 6 7 6-7Z',
  herbs:'M24 46V14M24 35C7 35 7 24 7 22c13 0 17 6 17 13Zm0-11c14 0 17-8 17-12-13 0-17 4-17 12Z',
  wood:'m8 34 24-21 10 11-24 21Zm4-18 6-6 25 28-6 6ZM8 34l10 11M32 13l10 11',
  ore:'m8 36 5-18 13-8 12 10 4 16-12 10-17-3ZM13 18l13 6 12-4M26 24l4 22',
  hide:'M14 8 9 16l5 7-6 15 11 7 6-8 6 8 11-7-6-15 5-7-5-8-11 7Z',
  parcel:'M14 8h22l-4 9 10 22c1 7-5 9-17 9S6 46 8 39l10-22ZM17 17h16M14 22h22',
};
export function itemIcon(name){return `<svg viewBox="0 0 50 54" aria-hidden="true"><path d="${paths[name]??paths.parcel}" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;}

const iconCells={sword:0,legs:1,clothes:2,shoes:3,head:4,body:5,chainmail:6,'plate-cuirass':7,herbs:8,wood:9,ore:10,copper:11,parcel:12,hide:13,necklace:14,ring:15};
/** One generated atlas serves every filled slot. Empty slots retain their outline. */
export function itemArt(item){
  const archery={'weapon.shortbow':0,'weapon.longbow':1,'arrow.wood':2,'arrow.iron':3,ironArrowhead:3,'arrow.bodkin':4,bodkinTip:4,flax:5,bowstring:6,flaxFibre:6,feather:7,arrowShaft:8}[item.id];
  if(archery!==undefined)return `<span class="item-art" aria-hidden="true" style="background-image:url('${publicUrl('/assets/ui/archery-items.png')}');background-size:300% 300%;background-position:${archery%3*50}% ${Math.floor(archery/3)*50}%"></span>`;
  const menu={unarmed:0,character:1,bag:2,skills:3,quests:4,map:5,friends:6,activity:7,guilds:8}[item.id];
  if(menu!==undefined)return `<span class="item-art" aria-hidden="true" style="background-image:url('${publicUrl('/assets/ui/menu-icons.png')}');background-size:300% 300%;background-position:${menu%3*50}% ${Math.floor(menu/3)*50}%"></span>`;
  const craft={shears:0,wool:1,yarn:2,wovenCloth:3,ogreTooth:4,bounty:5}[item.id];
  if(craft!==undefined)return `<span class="item-art" aria-hidden="true" style="background-image:url('${publicUrl('/assets/ui/crafting-items.png')}');background-size:300% 200%;background-position:${(craft%3)*50}% ${Math.floor(craft/3)*100}%"></span>`;
  const extra={healingPotion:0,staminaPotion:1,bread:2,berries:3,planks:4,ironIngot:5,coal:6,linen:7,bandage:7,leather:8,broth:9}[item.id];
  if(extra!==undefined)return `<span class="item-art" aria-hidden="true" style="background-image:url('${publicUrl('/assets/ui/expansion-items.png')}');background-position:${(extra%4)*100/3}% ${Math.floor(extra/4)*100/3}%"></span>`;
  const separate={axe:'woodcutting-axe','head.cloth-cap':'cloth-cap','clothes.traveller-red':'red-tunic'}[item.id];
  if(separate)return `<span class="item-art item-art-single" aria-hidden="true" style="background-image:url('${publicUrl(`/assets/ui/${separate}.png`)}')"></span>`;
  const cell=iconCells[item.gear?.base.id]??iconCells[item.id]??iconCells[item.icon];
  if(cell===undefined)return itemIcon(item.icon);
  return `<span class="item-art" aria-hidden="true" style="background-position:${(cell%4)*100/3}% ${Math.floor(cell/4)*100/3}%"></span>`;
}

