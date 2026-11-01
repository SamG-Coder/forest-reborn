import {FACTIONS} from '../factions/catalog.js';
import {mountedAttack} from '../mounts/combat.js';
import {createGearRegistry} from '../gear/catalog.js';
import {characterStats} from '../progression/character-stats.js';
import {weaponAction} from '../game/weapon-catalog.js';
import {finishJob} from '../world/async-jobs.js';

const companies=[
  ['Left watch','line',-32,22],['West watch','line',-16,22],['Centre watch','line',0,22],['East watch','line',16,22],['Archers','archer',32,49],
  ['Left outriders','flank',-52,30],['Right outriders','flank',52,30],
  ['First reserve','reserve',-23,43],['Second reserve','reserve',0,43],['Household guard','reserve',23,43],
];

/** Real item IDs, shared masks, skill levels and combat formulas. A render LOD
 * never owns a second set of equipment or statistics. */
export function createBattleProfiles(training=[0,0],registry=createGearRegistry(),{factions=['highmere','ash']}={}){
  const profiles=[];
  for(let team=0;team<2;team++)for(const role of ['line','flank','reserve','archer'])for(let variant=0;variant<2;variant++){
    const factionId=factions[team],goblin=factionId==='briar',local=['briar','bandits','mosswake'].includes(factionId);
    const veteran=role==='reserve',level=local?(goblin?3:4):veteran?10:role==='flank'?5:7;
    const weapon=role==='archer'?(variant?'weapon.longbow':'weapon.shortbow'):veteran?(variant?'weapon.greatsword':'weapon.longsword'):role==='flank'?(variant?'weapon.sabre':'weapon.spear'):(variant?'weapon.spear':'weapon.shortshield');
    const shirt=variant?(team?'clothes.ash-ochre':'clothes.watch-olive'):(team?'clothes.traveller-red':'clothes.traveller-blue');
    const equipped=[shirt,variant?'legs.traveller':'legs.guard','shoes.guard',
      ['flank','archer'].includes(role)?'body.leather-vest':veteran?'body.highmere-plate':'body.riveted-mail',
      ['flank','archer'].includes(role)?'head.cloth-cap':veteran?'head.highmere-helm':'head.iron-open',factionId==='highmere'?'tabard.highmere':factionId==='mosswake'?'tabard.mosswake':'tabard.ash'];
    if(goblin||factionId==='bandits')equipped.splice(3,3,...(goblin?['body.leather-vest']:['body.riveted-mail']));
    const skill=level+Math.floor((training[team]??0)/5),data={level,weapon,equipped,skills:{sword:{level:skill},archery:{level:skill},unarmed:{level},defence:{level:skill}}};
    profiles.push({id:`${team}:${role}:${variant}`,team,role,variant,level,weapon,equipped,data,stats:characterStats(data,registry),attack:weaponAction(weapon),factionId,kind:goblin?'goblin':'human',skin:goblin?'#7d985f':['#e0ba95','#95694d','#c8a384','#ddba99'][team*2+variant],face:(team*3+variant)%5,bodyType:variant&&role!=='reserve'?'female':'male',hair:variant&&role!=='reserve'?'braid':role==='flank'?'swept':'short',hairColor:variant?'#865b37':team?'#52362c':'#342c29'});
  }
  return profiles;
}

export function createBattleRoster(count=1000,profiles=createBattleProfiles(),{cavalry=true,idPrefix=''}={}){
  const job=battleRosterJob(count,profiles,{cavalry,idPrefix});let result;
  while(!(result=job.next()).done){}return result.value;
}

export function createBattleRosterAsync(count,profiles,options){return finishJob(battleRosterJob(count,profiles,options));}

function* battleRosterJob(count=1000,profiles=createBattleProfiles(),{cavalry=true,idPrefix=''}={}){
  const perSide=Math.floor(count/2),units=[],formations=[];
  for(let team=0;team<2;team++){
    const side=team?1:-1,companyCount=Math.ceil(perSide/50);let remaining=perSide;
    for(let c=0;c<companyCount;c++){
      const [label,role,localZ,localX]=companies[c%companies.length],size=Math.min(50,remaining),columns=Math.min(10,size),battalion=Math.floor(c/10),bands=Math.min(3,Math.ceil(companyCount/10));
      const z=localZ+(battalion%bands-(bands-1)/2)*140,x=localX+Math.floor(battalion/bands)*60;
      const factionId=profiles.find(p=>p.team===team).factionId,mounted=cavalry&&c%10===5&&factionId!=='briar';
      const formation={mounted,id:formations.length,team,side,role,flankSide:Math.sign(localZ),bandZ:z-localZ,battalion,name:FACTIONS[factionId].name+' '+label.toLowerCase()+(companyCount>10?' · '+(battalion+1):''),members:[],initial:size,x:side*x,z,homeX:side*x,homeZ:z,yaw:-side*Math.PI/2,order:role==='reserve'?'reserve':role==='flank'?'flank':'advance',morale:1,enemy:-1,rallies:0,engaged:0,alive:size};
      for(let i=0;i<size;i++){
        const profile=profiles.find(p=>p.team===team&&p.role===role&&p.variant===i%2);
        const rank=Math.floor(i/columns),column=i%columns,ux=formation.x+side*(rank-2)*(mounted?2.4:1.28),uz=z+(column-(columns-1)/2)*(mounted?1.8:1.28),index=units.length,id=idPrefix?idPrefix+index:index;
        const unit={id,index,mounted,mountId:mounted?['bay','grey','chestnut'][index%3]:null,npcId:`soldier-${id}`,name:`${FACTIONS[factionId].name} ${role==='reserve'?'household guard':role==='flank'?'outrider':'watchman'} ${c*50+i+1}`,side,team,squad:formation.id,profile:profile.id,scale:profile.kind==='goblin'?.68:.94+(index%9)*.015,face:profile.face,bodyType:profile.bodyType,factionId:profile.factionId,level:profile.level,weapon:profile.weapon,equipped:[...profile.equipped],stats:{...profile.stats},attack:{...profile.attack},
          x:ux,z:uz,homeX:ux,homeZ:uz,slot:i,hp:profile.stats.maxHealth,maxHp:profile.stats.maxHealth,stamina:100,opponent:-1,readyAt:(i%13)*.1,decideAt:(index%10)*.05,deadAt:0,respawnAt:0,
          clip:role==='reserve'?0:1,phase:(i*.618+team*.31)%1,yaw:formation.yaw,speed:0,vx:0,vz:0,attackAt:-10,strike:null,strikes:0,blockAt:-10,morale:1,reach:mountedAttack({...profile.attack,reach:profile.stats.range},{mounted}).reach,damage:profile.stats.damage,externalSimulation:true,chargeReadyAt:0,ammunition:role==='archer'?{[localArrow(profile)]:60}:null};
        units.push(unit);formation.members.push(index);
      }
      formations.push(formation);remaining-=size;yield units.length;
    }
  }
  return {units,formations,profiles};
}

function localArrow(profile){return profile.level>=7?'arrow.iron':'arrow.wood';}
