import {element,itemImage} from './panel-components.js';
import {localDirections,directionReply,setMapDestination,localTown} from '../npc/directions.js';

export function renderDirections({body,person,population,progress,onSpeak,onMap}){
  element(body,'h3','section-heading','Where can I find…');
  const input=element(body,'input','direction-search');input.type='search';input.placeholder='Try smith, horses, flax or bowstring';input.setAttribute('aria-label','Find a local place');
  const reply=element(body,'p','direction-reply');reply.setAttribute('aria-live','polite');
  const cards=element(body,'div','card-grid');
  function draw(){
    cards.replaceChildren();
    const destinations=localDirections(person,population,input.value);
    if(!destinations.length)element(cards,'p','muted',localTown(person)?'I don’t know that place. Try a local trade or a person’s name.':'I don’t know this area well. Ask someone in town.');
    for(const d of destinations){
      const card=element(cards,'article','social-card'),head=element(card,'div','item-card-heading');
      itemImage(head,{id:'map',icon:'map',name:d.title});element(head,'h3','',d.title);element(card,'p','muted',d.place);
      const ask=element(card,'button','','Ask & mark map');ask.onclick=()=>{if(person.position.distanceTo(population.living.player.target.position)>3)return;setMapDestination(progress,d);reply.textContent=directionReply(person,d);onSpeak?.(person,reply.textContent);};
    }
  }
  input.addEventListener('input',draw);draw();
  const open=element(body,'button','','Open map');open.onclick=()=>onMap(progress.data.mapPin);
}
