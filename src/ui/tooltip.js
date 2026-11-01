/** One tooltip for mouse and keyboard focus, including dynamically created controls. */
export function installTooltips(){
  const tip=document.createElement('div');tip.className='game-tooltip';tip.id='game-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
  let active=null;
  function hide(){if(active)active.removeAttribute('aria-describedby');active=null;tip.hidden=true;}
  function show(element,x,y){
    const content=element.dataset.tooltip??element.getAttribute('aria-label')??element.textContent.trim();if(!content)return;
    active=element;tip.replaceChildren();content.split('\n').forEach((line,i)=>{const p=document.createElement(i?'p':'b');p.textContent=line;tip.append(p);});
    element.setAttribute('aria-describedby',tip.id);tip.hidden=false;
    tip.style.left=`${Math.max(8,Math.min(innerWidth-tip.offsetWidth-10,x+16))}px`;
    tip.style.top=`${Math.max(8,Math.min(innerHeight-tip.offsetHeight-10,y+18))}px`;
  }
  document.addEventListener('pointerover',event=>{const element=event.target.closest('button,[data-tooltip]');if(element)show(element,event.clientX,event.clientY);});
  document.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>{const element=event.target.closest('button,[data-tooltip]');if(element){const r=element.getBoundingClientRect();show(element,r.left,r.bottom);}});
  document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);window.addEventListener('blur',hide);
  return {hide};
}
