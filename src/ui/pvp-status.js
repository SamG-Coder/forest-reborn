import './pvp-status.css';

export function formatStatusTime(milliseconds){const seconds=Math.max(0,Math.ceil(milliseconds/1000));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
export function createPvpBadge(parent){
  const badge=document.createElement('span');badge.className='pvp-status';badge.hidden=true;parent.prepend(badge);return badge;
}
export function updatePvpBadge(badge,flag,now=Date.now()){
  const parts=[];
  if(flag?.enabled)parts.push(flag.clearAt?`⚔ ${Math.max(0,Math.ceil((flag.clearAt-now)/1000))}s`:flag.clearRequested?`⚔ ${flag.clearReason||'Waiting'}`:'⚔ PvP');
  if(flag?.skullUntil>now)parts.push(`☠ ${formatStatusTime(flag.skullUntil-now)}`);
  badge.textContent=parts.join('  ');badge.hidden=!parts.length;
  badge.dataset.skull=String(flag?.skullUntil>now);badge.dataset.lowering=String(Boolean(flag?.clearAt));
  badge.title=(flag?.enabled?'PvP flagged. ':'')+(flag?.clearRequested?(flag.clearAt?'Countdown ends outside town and out of combat. ':flag.clearReason+'. '):'')+(flag?.skullUntil>now?'Player killer: skull expires in '+formatStatusTime(flag.skullUntil-now)+'.':'');
  badge.setAttribute('aria-label',badge.title);
}
