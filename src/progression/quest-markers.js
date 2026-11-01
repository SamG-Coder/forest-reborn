import {QUESTS} from './quests.js';

/** Turn-ins take priority when a giver also has another available quest. */
export function questMarkerFor(giverId,progress){
  if(QUESTS.some(q=>(q.returnTo??q.giver)===giverId&&progress.state(q)==='ready'))return '?';
  return QUESTS.some(q=>q.giver===giverId&&progress.state(q)==='available')?'!':'';
}

export function questLocations(residents,progress){
  return residents.filter(person=>!person.target||person.target.hp>0).flatMap(person=>{
    const symbol=questMarkerFor(person.id,progress);
    return symbol?[{id:person.id,name:person.name,symbol,x:person.position.x,z:person.position.z}]:[];
  });
}

export function questMarkerLabel(marker){
  return `${marker.name}: ${marker.symbol==='?'?'quest ready to turn in':'new quest available'}`;
}

export function drawQuestMarker(context,x,y,symbol,size=19){
  context.save();context.font=`bold ${size}px system-ui`;context.textAlign='center';context.textBaseline='middle';
  context.lineJoin='round';context.lineWidth=4;context.strokeStyle='#162b22';context.fillStyle='#ffde77';
  context.strokeText(symbol,x,y);context.fillText(symbol,x,y);context.restore();
}
