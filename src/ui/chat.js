import {makeGameWindow} from './game-window.js';
import {createInteractiveMap} from './world-map.js';
import './chat.css';

const element=(tag,parent,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;parent?.append(node);return node;};

export function parseChatCommand(text){
  const [name,...args]=text.trim().split(/\s+/);return {name:name.toLowerCase(),args};
}

/** Local chat and developer tools operate on the same saved world as gameplay. */
export function createChat({hud,player,population,progress,world,input,state,appearance,dev,voices}){
  const root=element('section',hud,undefined,'game-chat'),bar=element('div',root,undefined,'chat-tabs');
  element('strong',bar,'Local');element('span',bar,'Town & party');
  const log=element('div',root,undefined,'chat-log');log.setAttribute('role','log');log.setAttribute('aria-label','Local chat');
  const form=element('form',root),field=element('input',form);field.placeholder='Enter to chat · /help';field.maxLength=240;field.setAttribute('aria-label','Chat message');field.autocomplete='off';
  const history=[];let historyIndex=0,lastReply=0,lastNotice=null;
  function add(name,text,kind='local'){
    const row=element('div',log,undefined,'chat-line '+kind);element('b',row,name?name+': ':'');element('span',row,text);
    while(log.children.length>70)log.firstChild.remove();log.scrollTop=log.scrollHeight;
  }
  const panel=element('section',hud,undefined,'world-panel developer-panel');panel.hidden=true;
  const header=element('header',panel,undefined,'window-titlebar');element('h2',header,'World tools');
  const close=element('button',header,'×','window-close');close.setAttribute('aria-label','Close world tools');close.onclick=()=>panel.hidden=true;
  const body=element('div',panel,undefined,'game-window-content');element('p',body,'Changes apply to this save. Click a location on the map to travel there.');
  const controls=element('div',body,undefined,'dev-controls');
  const number=(label,value,min,max)=>{const wrap=element('label',controls,label),control=element('input',wrap);control.type='number';control.min=min;control.max=max;control.value=value;return control;};
  const level=number('Character level',progress.data.level,1,100),levelButton=element('button',controls,'Set level');levelButton.onclick=()=>dev.level(Number(level.value));
  const hour=number('Hour of day',8,0,23.99),timeButton=element('button',controls,'Set time');timeButton.onclick=()=>dev.time(Number(hour.value));
  const fly=element('button',controls,'Enable flight');fly.onclick=()=>{dev.fly(!state.fly);fly.textContent=state.fly?'Disable flight':'Enable flight';};
  const heal=element('button',controls,'Restore health');heal.onclick=()=>dev.heal();
  const gold=element('button',controls,'Add 5 gold');gold.onclick=()=>dev.gold(5);
  const raid=element('button',controls,'Test nearby raid');raid.onclick=()=>dev.raid();
  element('p',body,'Flight: W/S move · Q/E strafe · Space up · Ctrl down · Shift fast.');
  const mapHost=element('div',body,undefined,'dev-map');
  const map=createInteractiveMap({container:mapHost,player,population,progress,workstations:world.workstations});
  let pointer=null;
  map.canvas.addEventListener('pointerdown',e=>pointer={x:e.clientX,y:e.clientY});
  map.canvas.addEventListener('pointerup',e=>{if(!pointer||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)return;const r=map.canvas.getBoundingClientRect(),p=map.view.unproject((e.clientX-r.left)*map.view.size/r.width,(e.clientY-r.top)*map.view.size/r.height);dev.teleport(p.x,p.z);add('World tools',`Travelled to ${Math.round(p.x)}, ${Math.round(p.z)}.`,'system');});
  const windowAPI=makeGameWindow(panel,header);
  function toggle(){panel.hidden=!panel.hidden;if(!panel.hidden){level.value=progress.data.level;hour.value=world.dayNight.clock.hour.toFixed(1);map.view.range=650;map.draw();windowAPI.focus();}input.clear();}
  function command(text){
    const {name,args}=parseChatCommand(text),n=i=>args[i]===undefined?NaN:Number(args[i]);let ok=true;
    if(name==='/devui')toggle();
    else if(name==='/level')ok=dev.level(n(0));
    else if(name==='/time')ok=dev.time(n(0));
    else if(name==='/tp')ok=dev.teleport(n(0),n(1));
    else if(name==='/fly')dev.fly(args[0]==='off'?false:args[0]==='on'?true:!state.fly);
    else if(name==='/raid')ok=dev.raid();
    else if(name==='/help')add('Commands','/devui · /level 10 · /tp 850 -780 · /time 22 · /fly · /raid · /say message','system');
    else if(name==='/say')say(args.join(' '));
    else{ok=false;}
    if(ok===false)add('World tools','Invalid command or value. Use /help. Level: 1–100. Map: −1950 to 1950. Hour: 0–24.','system');
  }
  function say(text){
    if(!text)return;add(appearance.name,text);
    const person=population.nearest(player.position,7);
    if(!person||person.sleeping||Date.now()-lastReply<8000)return;lastReply=Date.now();
    const reply=/help|raid|attack/i.test(text)?'If the bell rings, stay near the watch. We will hold the road.':/hello|hey|hi\b/i.test(text)?'Hello there. Settling in?':person.greeting??`I am ${person.name}. You will usually find me around here.`;
    add(person.name,reply,'npc');population.living.guardSays(person,reply);person.talkingUntil=Date.now()+7000;
  }
  form.onsubmit=e=>{e.preventDefault();const text=field.value.trim();if(!text)return;history.push(text);historyIndex=history.length;field.value='';field.blur();input.clear();if(text.startsWith('/'))command(text);else say(text);};
  field.addEventListener('focus',()=>input.clear());
  window.addEventListener('keydown',e=>{
    if(state.mode!=='play'||state.paused)return;
    if(e.target===field){
      e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();field.value='';field.blur();input.clear();}
      if(e.code==='ArrowUp'||e.code==='ArrowDown'){e.preventDefault();historyIndex=Math.max(0,Math.min(history.length,historyIndex+(e.code==='ArrowUp'?-1:1)));field.value=history[historyIndex]??'';}
      return;
    }
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(e.code==='Enter'||e.key==='/'){e.preventDefault();e.stopImmediatePropagation();input.clear();field.focus();field.value=e.key==='/'?'/':'';}
  },true);
  add('Local','Enter to speak. Use /devui for world tools.','system');
  return {root,panel,add,toggle,command,update(time){
    if(!panel.hidden)map.update(time);
    const notice=population.simulation.society.notices?.at(-1);
    if(notice&&notice!==lastNotice){lastNotice=notice;add('Town',notice.text??String(notice),'system');}
  },close(){panel.hidden=true;field.blur();},dispose(){map.dispose();root.remove();panel.remove();}};
}
