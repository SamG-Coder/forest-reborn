import {ZoneStreamer} from './zone-streamer.js';
import {HIGHMERE,WARFRONT,inHighmere} from './region-layout.js';
import {element,action,banner} from '../ui/panel-components.js';
import './journey.css';
import {focusPanel,registerPanel} from '../ui/panel-focus.js';

export function createExpansion(context){
  const {world,population,progress,player,onTravel,message}=context;
  const save=progress.data.realm??={version:1,companions:[],discovered:[]};
  save.companions??=[];save.discovered??=[];
  const zones=new ZoneStreamer([HIGHMERE,WARFRONT],async definition=>{
    if(definition.id===HIGHMERE.id){const {createHighmere}=await import('./highmere.js');return createHighmere({...context,save});}
    const {createWarfront}=await import('./warfront.js');return createWarfront({...context,save});
  });
  let lastAnnouncement='',lastAmbient=0;
  const panel=document.createElement('section');panel.className='world-panel journey-panel';panel.hidden=true;
  const close=element(panel,'button','panel-close','×');close.setAttribute('aria-label','Close journeys');close.onclick=()=>panel.hidden=true;
  element(panel,'h2','','Beyond Mosswake');const body=element(panel,'div','panel-body');document.querySelector('#hud').append(panel);
  const trigger=element(document.querySelector('#hud .top-actions'),'button','','Journey');trigger.id='journey-button';trigger.onclick=()=>show();
  const status=element(panel,'p','journey-status');status.setAttribute('role','status');
  const hide=()=>{const wasOpen=!panel.hidden;panel.hidden=true;return wasOpen;};registerPanel(hide);
  function applyCompanions(){population.residents.forEach(p=>{p.companion=save.companions.includes(p.id);p.companionSlot=save.companions.indexOf(p.id);});}
  applyCompanions();
  function toggleCompanion(person){
    const at=save.companions.indexOf(person.id);
    if(at>=0){save.companions.splice(at,1);person.position.copy(person.home);person.pathGoal=null;}
    else {if(save.companions.length>=3){message('Your party has room for three companions.',3);return false;}save.companions.push(person.id);}
    applyCompanions();progress.save();return at<0;
  }
  function travel(destination){
    if(!context.canTravel()){status.textContent='Finish your fight before travelling.';return;}
    const atMosswake=Math.hypot(player.position.x,player.position.z)<85,atHighmere=inHighmere(player.position.x,player.position.z,30);
    if(!atMosswake&&!atHighmere){status.textContent='Caravans leave from town. Follow the road back to a gate first.';return;}
    if(destination==='field'&&!atHighmere){status.textContent='The muster is beyond Highmere’s east gate. Take the northern road first.';return;}
    const point=destination==='mosswake'?[0,0,17]:destination==='field'?[WARFRONT.x-105,0,WARFRONT.z+60]:[850,0,-768];
    onTravel(point);save.discovered=[...new Set([...save.discovered,destination==='mosswake'?'mosswake':'highmere'])];
    for(const person of population.residents.filter(p=>p.companion)){
      person.position.copy(player.position);person.position.x+=1.8+person.companionSlot*.8;person.position.z+=1.5;person.pathGoal=null;person.dormant=false;
    }
    zones.update(player.position,0);progress.save();panel.hidden=true;
    message(destination==='field'?'The east-field muster. Stay near the blue banners.':'You arrive at '+(destination==='mosswake'?'Mosswake.':'Highmere’s south gate.'),5);
  }
  function show(){
    focusPanel(hide);panel.hidden=false;body.replaceChildren();status.textContent='';
    banner(body,{title:'The northern road',subtitle:'Mosswake is one small stop. Highmere lies beyond the ridge: a walled town, a castle, and work for people who can hold the road.',item:progress.item('sword')});
    const cards=element(body,'div','journey-cards');
    for(const destination of [
      {id:'highmere',title:'Highmere',tag:'WALLED TOWN · 1.2 KM NORTHEAST',text:'Guild records, armourers, a tailor and the Lantern House. Speak to Corin about the other arrivals.',icon:'♜',button:'Take the caravan'},
      {id:'field',title:'The east-field muster',tag:'GROUP CONTENT · LEVELS 9–13',text:'Blue companies hold the line against the Ash Company. Nine enemy leaders can be targeted and looted among the larger battle.',icon:'⚔',button:'Go to the east field'},
      {id:'mosswake',title:'Mosswake',tag:'HOME ROAD · LEVELS 1–8',text:'The Wayward Oak, familiar faces, and the work you left unfinished.',icon:'⌂',button:'Return to Mosswake'},
    ]){const card=element(cards,'article','journey-card');element(card,'span','journey-symbol',destination.icon);element(card,'small','eyebrow',destination.tag);element(card,'h3','',destination.title);element(card,'p','',destination.text);action(card,destination.button,()=>travel(destination.id),'primary-action');}
    const companions=population.residents.filter(p=>p.companion);element(body,'p','',`Party · ${companions.length}/3${companions.length?' · '+companions.map(p=>p.name).join(', '):' · Ask an adventurer to travel with you.'}`);
    element(body,'p','muted','You can also walk the northern road. The map shows both towns and the east field.');
  }
  return {zones,show,close:hide,travel,toggleCompanion,isCompanion:id=>save.companions.includes(id),
    update(dt,position){
      zones.update(position,dt);
      const active=zones.zones.find(z=>z.status==='active'&&z.definition.id===HIGHMERE.id);
      if(active&&!save.discovered.includes('highmere')){save.discovered.push('highmere');progress.recordObjective('discover:highmere');progress.save();}
      if(active&&progress.data.quests['north-road']?.active&&progress.data.quests['north-road'].count<1)progress.recordObjective('discover:highmere');
      if(progress.data.quests['unlisted-arrival']?.active&&progress.data.quests['unlisted-arrival'].count<1&&Math.hypot(position.x-885,position.z+893)<6)progress.recordObjective('discover:archive');
      if(inHighmere(position.x,position.z)&&lastAnnouncement!=='highmere'){lastAnnouncement='highmere';message('Highmere · The castle above the northern road.',4);}
      if(!inHighmere(position.x,position.z))lastAnnouncement='';
      const now=performance.now();
      if(context.voices&&!['dialogue','cinematic','guard','ambient'].some(c=>context.voices.busy(c))&&now-lastAmbient>24000){
        for(const person of population.residents.filter(p=>!p.dormant&&!p.cinematic&&p.target.hp>0&&p.position.distanceTo(position)<5&&population.navigation.segmentClear(p.position,position))){
          const line=context.dialogue?.select(person,{channel:'ambient'});
          if(line){lastAmbient=now;context.voices.speak(person,line.text,{channel:'ambient',volume:.32,maxDelay:10000});break;}
        }
      }
    },stats(){return {zones:zones.stats(),companions:[...save.companions],dormantResidents:population.residents.filter(p=>p.dormant).length};},dispose(){zones.dispose();panel.remove();trigger.remove();}
  };
}
