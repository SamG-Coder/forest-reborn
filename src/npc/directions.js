import {WORKSTATIONS,HIGHMERE_WORKSTATIONS} from '../world/workstations.js';
import {questContact} from '../progression/quest-guide.js';

const stops={
  mosswake:[
    ['innkeeper','Tavern & cooking','inn food bed tomas','Tomas runs the Wayward Oak on the northwest side of the square.'],
    ['trader','Market & supplies','shop arrows axe orin buy sell','Look for Orin’s stall on the east side of the square.'],
    ['stablemaster','Stables & horses','mount nell riding','Nell’s paddock is southwest of the square. Use the gate at the front.'],
    ['captain','Town watch','guard quest alden','Captain Alden keeps watch by the north gate.'],
    ['herbalist','Apothecary','herbs healing potion ivo','Ivo’s apothecary is southwest of the square, before the stables.'],
  ],
  highmere:[
    ['highmere-lord','Castle & great hall','lord edric duke main quest','Follow the uphill road behind the square. The great hall is through the keep’s front door.'],
    ['highmere-scribe','Records & Charts','corin archive library map','Corin keeps the records on the northeast side of the square.'],
    ['highmere-guild','Guild hall','mira bounty faction','Mira’s guild hall is west of the square.'],
    ['highmere-marshal','East gate & muster','captain elian battle guard','Captain Elian is by the east gate. Ask him before heading to the field.'],
    ['highmere-smith','Forge & repairs','doran smith armour iron','Doran’s forge is southwest of the square.'],
  ],
};

export function localTown(person){
  const p=person.position??person;
  if(person.id?.startsWith('ashhold-')||Math.hypot(p.x-1710,p.z+1640)<180)return 'ashhold';
  if(person.id?.startsWith('highmere-')||Math.hypot(p.x-850,p.z+850)<190)return 'highmere';
  if(Math.hypot(p.x,p.z)<170)return 'mosswake';
  return null;
}

/** A resident knows local services, not every unexplored marker in the world. */
export function localDirections(person,population,query=''){
  const town=localTown(person),name={mosswake:'Mosswake',highmere:'Highmere',ashhold:'Ashhold'}[town];
  const contacts=(stops[town]??[]).map(([id,title,keywords,hint])=>({...questContact(id,population),title,keywords,hint}));
  const stations=town==='mosswake'?WORKSTATIONS:town==='highmere'?HIGHMERE_WORKSTATIONS:[];
  const entries=[...contacts,...stations.map(s=>({id:`${town}-${s.id}-directions`,name:s.name,title:s.name,place:s.building,x:s.x,z:s.z,
    keywords:`${s.skill} ${s.id} ${s.id==='carpenter'?'bow arrows fletching wood':s.id==='weaver'?'flax fibre bowstring cloth':''}`,hint:`Use the ${s.name.toLowerCase()} in ${s.building.replace('Highmere · ','')}. ${s.description}`}))];
  if(town==='mosswake')entries.push({id:'flax-meadow',name:'Flax meadow',title:'Flax & feathers',place:'Southeast meadow',x:48,z:70,keywords:'bowstring arrows fletching field',hint:'Blue flax grows in the southeast meadow. Look for fallen feathers along the edge.'});
  if(town==='ashhold')for(const p of population.residents.filter(p=>p.id.startsWith('ashhold-')).slice(0,3))entries.push({id:p.id,name:p.name,title:p.name,place:name,x:p.position.x,z:p.position.z,keywords:p.role,hint:`${p.name} is in the courtyard, ${p.activity?.toLowerCase()??'on duty'}.`});
  const terms=query.toLowerCase().trim().split(/\s+/).filter(t=>!['where','is','the','a','can','i','find'].includes(t));
  return entries.filter(e=>terms.every(t=>`${e.title} ${e.name} ${e.place} ${e.keywords}`.toLowerCase().includes(t)));
}

export function directionReply(person,destination){
  const dx=destination.x-person.position.x,dz=destination.z-person.position.z,distance=Math.hypot(dx,dz);
  const bearing=['north','northeast','east','southeast','south','southwest','west','northwest'][(Math.round(Math.atan2(dx,-dz)/(Math.PI/4))+8)%8];
  return `${destination.hint} ${distance<8?'You’re almost there.':`It’s about ${Math.max(10,Math.round(distance/10)*10)} metres ${bearing} of here.`} I’ll mark it on your map.`;
}

export function setMapDestination(progress,point){
  progress.data.mapPin=point&&Number.isFinite(point.x)&&Number.isFinite(point.z)?{id:point.id,name:point.name,place:point.place??'',x:point.x,z:point.z}:null;
  progress.save();return progress.data.mapPin;
}
