import {renderGuildContent} from './guild-content.js';
import {registerPanel,focusPanel} from './panel-focus.js';
import {requestPvpFlag} from '../npc/society.js';
import './society-panel.css';

export function createSocietyPanel({simulation,population,progress,player,message}){
  const society=simulation.society,hud=document.querySelector('#hud');
  const panel=document.createElement('section');panel.className='world-panel society-panel';panel.hidden=true;
  panel.innerHTML='<button class="panel-close" aria-label="Close guilds and events">×</button><h2>Guilds & world events</h2><div class="society-content"></div>';
  hud.append(panel);const content=panel.querySelector('.society-content');
  const button=(parent,label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;parent.append(b);return b;};
  const save=()=>{simulation.save();progress.save();render();};
  function close(){const visible=!panel.hidden;panel.hidden=true;return visible;}
  registerPanel(close);panel.querySelector('.panel-close').onclick=close;
  let section='guilds';
  function render(){
    if(panel.contains(document.activeElement)&&/INPUT|SELECT/.test(document.activeElement.tagName))return;
    content.replaceChildren();renderGuildContent({content,section,setSection:id=>{section=id;render();},simulation,progress,message,save});
  }
  function show(){focusPanel(close);panel.hidden=false;section=society.guildFor('player')?'bounties':'guilds';render();}
  const open=button(document.querySelector('#hotbar'),'Guilds',()=>panel.hidden?show():close());open.className='utility-action';open.dataset.tooltip='Guilds & world events · G\nForm or join a guild, invite adventurers and follow events.';
  window.addEventListener('keydown',event=>{if(event.code==='KeyG'&&!event.repeat&&!/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)&&!hud.hidden){if(panel.hidden)show();else close();}});
  const pvp=button(document.querySelector('.top-actions'),'PvP: Off',()=>{message(requestPvpFlag(progress.data.pvp,!progress.data.pvp.enabled,player.position,Date.now()),5);progress.save();});
  pvp.id='pvp-toggle';pvp.dataset.tooltip='PvP flag\nFlag to fight other flagged adventurers or attack NPCs. Town guards give ten seconds to leave. Lowering the flag takes thirty seconds outside town and out of combat.';
  const warning=document.createElement('div');warning.className='law-warning';warning.hidden=true;hud.append(warning);
  const eventBox=document.createElement('div');eventBox.className='world-event-box';eventBox.hidden=true;hud.append(eventBox);
  let last=-1;
  return {show,close,update(time){
    const flag=progress.data.pvp;pvp.textContent=flag.clearAt?`PvP: ${Math.max(0,Math.ceil((flag.clearAt-Date.now())/1000))}s`:flag.clearRequested?`PvP: ${flag.clearReason||'Waiting'}`:flag.enabled?'PvP: On':'PvP: Off';pvp.dataset.active=String(flag.enabled);
    const notice=population.living.law.warnings.get('player');warning.hidden=!notice;
    if(notice)warning.textContent=notice.escalated?'The watch is attacking. Leave town or fight back.':`Town watch: Leave town with that PvP flag. ${Math.max(0,Math.ceil((notice.deadline-Date.now())/1000))}s`;
    const event=society.event;eventBox.hidden=!event;
    if(event)eventBox.textContent=`${event.title}\n${event.progress} / ${event.goal} · ${Math.max(0,Math.ceil((event.endsAt-Date.now())/1000))}s\nG · Guilds & events`;
    if(time-last>2){last=time;if(!panel.hidden)render();}
  }};
}
