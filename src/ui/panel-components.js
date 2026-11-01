import {itemArt} from './item-icons.js';

export function element(parent,tag='div',className='',text){
  const node=document.createElement(tag);node.className=className;if(text!==undefined)node.textContent=text;parent?.append(node);return node;
}
export function action(parent,label,callback,className=''){
  const button=element(parent,'button',className,label);button.type='button';button.onclick=callback;return button;
}
export function itemImage(parent,item,className=''){
  const image=element(parent,'div','item-picture '+className);image.innerHTML=itemArt(item);image.setAttribute('aria-hidden','true');return image;
}
export function workshopImage(parent,cell){
  const image=element(parent,'div','workshop-picture');image.style.backgroundPosition=`${cell%3*50}% ${Math.floor(cell/3)*100}%`;image.setAttribute('aria-hidden','true');return image;
}
export function banner(parent,{title,subtitle,art,item}){
  const header=element(parent,'div','illustrated-header');if(art!==undefined)workshopImage(header,art);else if(item)itemImage(header,item);
  const text=element(header,'div','header-copy');element(text,'h3','',title);if(subtitle)element(text,'p','muted',subtitle);return header;
}
export function meter(parent,value,total,label=''){
  const wrap=element(parent,'div','progress-meter'),bar=element(wrap,'div','meter-track');element(bar,'i').style.width=`${Math.min(100,value/Math.max(1,total)*100)}%`;
  if(label)element(wrap,'small','',label);return wrap;
}
export function tabs(parent,entries,selected,onSelect){
  const nav=element(parent,'nav','section-tabs');nav.setAttribute('aria-label','Sections');
  for(const [id,label]of entries){const button=action(nav,label,()=>onSelect(id));button.classList.toggle('active',id===selected);button.setAttribute('aria-pressed',String(id===selected));button.dataset.tab=id;}
  return nav;
}
export function emptyState(parent,title,description){const box=element(parent,'div','empty-state');element(box,'h3','',title);element(box,'p','muted',description);return box;}
