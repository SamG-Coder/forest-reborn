/** One tooltip for mouse and keyboard focus, including dynamically created controls. */
export function installTooltips(){
  const tip=document.createElement('div');tip.className='game-tooltip';tip.id='game-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);
  let active=null,contentKey='',pointer=null,frame=0;
  function hide(){if(active)active.removeAttribute('aria-describedby');active=null;pointer=null;tip.hidden=true;}
  function place(x,y){
    tip.style.left=`${Math.max(8,Math.min(innerWidth-tip.offsetWidth-10,x+16))}px`;
    tip.style.top=`${Math.max(8,Math.min(innerHeight-tip.offsetHeight-10,y+18))}px`;
  }
  function show(element,x,y){
    const content=element.dataset.tooltip??element.getAttribute('aria-label')??element.textContent.trim();if(!content)return;
    if(active!==element){active?.removeAttribute('aria-describedby');active=element;}
    if(content!==contentKey){contentKey=content;tip.replaceChildren();content.split('\n').forEach((line,i)=>{const p=document.createElement(i?'p':'b');p.textContent=line;tip.append(p);});}
    element.setAttribute('aria-describedby',tip.id);tip.hidden=false;
    place(x,y);
  }
  document.addEventListener('pointermove',event=>{
    if(!active||tip.hidden)return;pointer={x:event.clientX,y:event.clientY};
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(active?.isConnected&&pointer)place(pointer.x,pointer.y);else hide();});
  },{passive:true});
  document.addEventListener('pointerover',event=>{const element=event.target.closest('button,[data-tooltip]');if(element)show(element,event.clientX,event.clientY);});
  document.addEventListener('pointerout',event=>{if(active&&!active.contains(event.relatedTarget))hide();});
  document.addEventListener('focusin',event=>{const element=event.target.closest('button,[data-tooltip]');if(element){const r=element.getBoundingClientRect();show(element,r.left,r.bottom);}});
  document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);window.addEventListener('blur',hide);
  return {hide};
}
