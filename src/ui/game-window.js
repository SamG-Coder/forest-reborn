const windows=new WeakMap();
let nextTitleId=0;

/** Close the frontmost window through its own cleanup handler. */
export function closeTopGameWindow(hud){
  const visible=[...hud.querySelectorAll('.mmo-window')].filter(panel=>!panel.hidden);
  const panel=visible.find(panel=>panel.classList.contains('window-focused'))??visible.at(-1);
  const close=panel?.querySelector('.window-close');
  if(!close)return false;
  close.click();return true;
}

/** Drag only the title bar, leaving controls and the 3D preview independent. */
export function makeGameWindow(panel,header,onFocus=()=>{}){
  panel.classList.add('mmo-window');
  let drag=null;
  const focus=()=>{
    document.querySelectorAll('.mmo-window').forEach(window=>window.classList.remove('window-focused'));
    panel.classList.add('window-focused');
    if(panel.style.left){const rect=panel.getBoundingClientRect();place(rect.left,rect.top);}
    onFocus();
  };
  const place=(x,y)=>{
    panel.style.left=Math.max(0,Math.min(innerWidth-panel.offsetWidth,x))+'px';
    panel.style.top=Math.max(0,Math.min(innerHeight-panel.offsetHeight,y))+'px';
    panel.style.right='auto';panel.style.bottom='auto';panel.style.transform='none';
  };
  panel.addEventListener('pointerdown',focus);
  header.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button,a,input,select'))return;
    const rect=panel.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX-rect.left,y:event.clientY-rect.top};
    header.setPointerCapture(event.pointerId);event.preventDefault();
  });
  header.addEventListener('pointermove',event=>{if(drag?.id===event.pointerId)place(event.clientX-drag.x,event.clientY-drag.y);});
  header.addEventListener('lostpointercapture',()=>{drag=null;});
  header.addEventListener('pointerup',event=>{if(header.hasPointerCapture(event.pointerId))header.releasePointerCapture(event.pointerId);});
  window.addEventListener('resize',()=>{if(!panel.hidden&&panel.style.left){const r=panel.getBoundingClientRect();place(r.left,r.top);}});
  const title=header.querySelector('h2');
  if(title){title.id||=`game-window-title-${++nextTitleId}`;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby',title.id);}
  const api={focus};windows.set(panel,api);if(!panel.hidden)focus();return api;
}

/** Adapt existing panels without replacing their content nodes or handlers. */
export function installGameWindows(hud){
  const selector='.world-panel,.player-panel,.camera-settings';
  function upgrade(container=hud){
    const candidates=[...(container.matches(selector)?[container]:[]),...container.querySelectorAll(selector)];
    for(const panel of candidates){
      if(panel.classList.contains('mmo-window'))continue;
      const title=panel.querySelector('h2');if(!title)continue;
      let header=title.parentElement.tagName==='HEADER'?title.parentElement:null;
      const close=panel.querySelector('.panel-close,.close-player-panel,button[aria-label^="Close"]');
      if(!header){header=document.createElement('header');panel.prepend(header);header.append(title);}
      header.classList.add('window-titlebar');if(close){close.classList.add('window-close');header.append(close);}
      const body=document.createElement('div');body.className='game-window-content';
      for(const child of [...panel.children])if(child!==header)body.append(child);panel.append(body);
      makeGameWindow(panel,header);
    }
  }
  upgrade();
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes'){
        if(record.oldValue!==null&&!record.target.hidden)windows.get(record.target)?.focus();
      }else for(const node of record.addedNodes)if(node.nodeType===1)upgrade(node);
    }
  });
  observer.observe(hud,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden'],attributeOldValue:true});
  return ()=>observer.disconnect();
}
