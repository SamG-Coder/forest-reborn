import {BattleDirector} from './battle-director.js';
import {CAMPAIGN_SITE,ASHHOLD,MUSTER_CAMPS} from './battle-sites.js';
import {BattleCinematic} from './battle-cinematic.js';
import {BattleScore} from '../audio/battle-score.js';
import {ZoneStreamer} from './zone-streamer.js';
import {HIGHMERE,WARFRONT,inHighmere} from './region-layout.js';
import {element,action,banner} from '../ui/panel-components.js';
import './journey.css';
import {focusPanel,registerPanel} from '../ui/panel-focus.js';

export function createExpansion(context){
  const {world,population,progress,player,onTravel,message}=context;
  const save=progress.data.realm??={version:1,companions:[],discovered:[]};
  save.companions??=[];save.discovered??=[];
  const director=new BattleDirector({save:save.warfare??={},registry:context.registry,progress,factions:population.simulation.factions,height:world.height,announce:text=>message(text,7)});
  population.battleDirector=director;
  const cinematic=new BattleCinematic({camera:context.camera,scene:context.scene,voices:context.voices,getAudio:context.getAudio,onStart:context.onCinematicStart,onFinish:context.onCinematicEnd});
  const score=new BattleScore(context.getAudio,context.voices);
  const definitions=[HIGHMERE,ASHHOLD,{...CAMPAIGN_SITE,enabled:()=>director.canStage()||director.state(CAMPAIGN_SITE.id)?.status==='resolved'&&director.save.clock-director.state(CAMPAIGN_SITE.id).endedAt<120}];
  const zones=new ZoneStreamer(definitions,async definition=>{
    if(definition.id===HIGHMERE.id){const {createHighmere}=await import('./highmere.js');return createHighmere({...context,save});}
    if(definition.id===ASHHOLD.id){const {createAshhold}=await import('./ashhold.js');return createAshhold(context);}
    const {createBattleEncounter}=await import('./warfront.js');
    return createBattleEncounter({...context,save,site:definition,director});
  });
  let lastAnnouncement='',lastAmbient=0;
  const panel=document.createElement('section');panel.className='world-panel journey-panel';panel.hidden=true;
  const close=element(panel,'button','panel-close','×');close.setAttribute('aria-label','Close journeys');close.onclick=()=>panel.hidden=true;
  element(panel,'h2','','Beyond Mosswake');const body=element(panel,'div','panel-body');document.querySelector('#hud').append(panel);
  const trigger=element(document.querySelector('#hud .top-actions'),'button','','Journey');trigger.id='journey-button';trigger.onclick=()=>panel.hidden?show():hide();
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
    if(!['mosswake','highmere'].includes(destination))return;
    const point=destination==='mosswake'?[0,0,17]:[850,0,-768];
    onTravel(point);save.discovered=[...new Set([...save.discovered,destination==='mosswake'?'mosswake':'highmere'])];
    for(const person of population.residents.filter(p=>p.companion)){
      person.position.copy(player.position);person.position.x+=1.8+person.companionSlot*.8;person.position.z+=1.5;person.pathGoal=null;person.dormant=false;
    }
    zones.update(player.position,0);progress.save();panel.hidden=true;
    message('You arrive at '+(destination==='mosswake'?'Mosswake.':'Highmere’s south gate.'),5);
  }
  function joinCampaign(side){
    if(!context.canTravel()){message('Finish your current action first.',3);return false;}
    if(!progress.data.quests['northern-stand']?.active){message('Speak to Elian in Highmere after restoring the road beacon.',5);return false;}
    director.update(0);
    if(side&&!director.chooseSide(side))return false;
    const camp=MUSTER_CAMPS.find(c=>c.faction===director.save.campaign.chosenSide);
    if(!camp){show();return false;}
    onTravel([camp.x,0,camp.z+3]);panel.hidden=true;
    zones.update(player.position,0);return true;
  }
  function beginCampaign(){
    if(!zones.get(CAMPAIGN_SITE.id)){message('Your companies are still assembling. The world remains playable while they load.',5);return false;}
    if(!director.muster(player.position)){message('Choose your side, then meet your company at its camp.',5);return false;}
    progress.save();panel.hidden=true;return true;
  }
  function show(){
    focusPanel(hide);panel.hidden=false;body.replaceChildren();status.textContent='';
    banner(body,{title:'The northern road',subtitle:'Mosswake is one small stop. Highmere lies beyond the ridge: a walled town, a castle, and work for people who can hold the road.',item:progress.item('sword')});
    const cards=element(body,'div','journey-cards');
    for(const destination of [
      {id:'highmere',title:'Highmere',tag:'WALLED TOWN · 1.2 KM NORTHEAST',text:'Guild records, armourers, a tailor and the Lantern House. Speak to Corin about the other arrivals.',icon:'♜',button:'Take the caravan'},
      {id:'mosswake',title:'Mosswake',tag:'HOME ROAD · LEVELS 1–8',text:'The Wayward Oak, familiar faces, and the work you left unfinished.',icon:'⌂',button:'Return to Mosswake'},
    ]){const card=element(cards,'article','journey-card');element(card,'span','journey-symbol',destination.icon);element(card,'small','eyebrow',destination.tag);element(card,'h3','',destination.title);element(card,'p','',destination.text);action(card,destination.button,()=>travel(destination.id),'primary-action');}
    const campaign=element(body,'article','journey-card');element(campaign,'h3','','The northern crossing');
    const c=director.save.campaign;
    element(campaign,'p','',c.stage==='muster'?'Two camps are waiting at the crossing. Choose who you stand with. The battle starts only when you reach your camp and give the signal.':c.stage==='resolved'?`The crossing is held by ${c.winner==='ash'?'the Ash Company':'Highmere'}. Speak to Elian about what comes next.`:'Continue Corin’s story and accept When the banners move from Elian to unlock the northern muster.');
    if(c.stage==='muster'){
      const sides=element(campaign,'div','journey-cards');
      for(const camp of MUSTER_CAMPS){const card=element(sides,'article','journey-card');element(card,'h3','',camp.name);element(card,'p','',camp.team?'The Ash Company wants control of the crossing and its trade.':'Highmere is defending the road to its northern villages.');action(card,c.chosenSide===camp.faction?'Return to your camp':'Stand with '+(camp.team?'the Ash Company':'Highmere'),()=>joinCampaign(camp.faction),'primary-action');}
      if(c.chosenSide)action(campaign,'Give the signal · 5,000 vs 5,000',beginCampaign,'primary-action');
    }else if(c.stage==='battle')action(campaign,'Return to your company',()=>joinCampaign(),'primary-action');
    const ash=element(body,'article','journey-card');element(ash,'h3','','Ashhold');element(ash,'p','','The Ash Company’s hill fortress lies northeast of the crossing. The red banners belong to Highmere’s rivals. Follow the northern road on the map.');
    const companions=population.residents.filter(p=>p.companion);element(body,'p','',`Party · ${companions.length}/3${companions.length?' · '+companions.map(p=>p.name).join(', '):' · Ask an adventurer to travel with you.'}`);
    element(body,'p','muted','You can also walk the northern road. The map shows the towns, camps and active raiding parties.');
  }
  return {zones,director,cinematic,joinCampaign,beginCampaign,show,close:hide,travel,toggleCompanion,async save(){for(const z of zones.zones)await z.runtime?.save?.();await director.persist();},isCompanion:id=>save.companions.includes(id),
    update(dt,position){
      director.update(cinematic.active?0:dt);zones.update(position,dt);
      const campaign=director.save.campaign,field=zones.get(CAMPAIGN_SITE.id);
      score.update(Boolean(field&&campaign.stage==='battle'&&!cinematic.active),field?.simulation.companies.filter(c=>c.engaged>0).length/(field?.simulation.companies.length||1));
      if(field&&!campaign.introSeen&&campaign.joined&&progress.data.quests['northern-stand']?.active){campaign.introSeen=true;cinematic.start(CAMPAIGN_SITE,field);}
      if(progress.data.worldFlags.northernSupplies&&campaign.stage==='battle'&&!campaign.supplied){campaign.supplied=true;director.contribute('supplies');director.supply('northern-battle');population.simulation.factions.economy.receive(campaign.chosenSide,'bandage',8);}
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
    },stats(){return {zones:zones.stats(),companions:[...save.companions],dormantResidents:population.residents.filter(p=>p.dormant).length};},dispose(){score.dispose();cinematic.dispose();zones.dispose();director.dispose();panel.remove();trigger.remove();}
  };
}
