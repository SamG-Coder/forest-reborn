export const CAMP_DEFINITIONS=Object.freeze([
  {id:'briar-camp',name:'Briar grove',town:'mosswake',faction:'briar',kind:'goblin',x:85,z:-85,route:[[53,-70],[14,-63]],gate:[7,-43]},
  {id:'cart-camp',name:'Old cart road',town:'mosswake',faction:'bandits',kind:'bandit',x:-96,z:-110,route:[[-69,-82],[-20,-64]],gate:[-7,-43]},
  {id:'east-road-camp',name:'East-road camp',town:'mosswake',faction:'bandits',kind:'bandit',x:105,z:-16,route:[[76,-6],[55,-2]],gate:[39,-2]},
  {id:'highmere-bandits',name:'South ridge camp',town:'highmere',faction:'bandits',kind:'bandit',x:784,z:-620,route:[[789,-670],[838,-710]],gate:[850,-745]},
  {id:'highmere-goblins',name:'Eastern thicket',town:'highmere',faction:'briar',kind:'goblin',x:1065,z:-940,route:[[1060,-892],[1020,-831]],gate:[963,-831]},
  {id:'ash-road-camp',name:'Ash road camp',town:'highmere',faction:'ash',kind:'ashRaider',x:1210,z:-1025,route:[[1160,-995],[1120,-960],[1050,-870],[1010,-831]],gate:[963,-831]},
  {id:'ash-shield-camp',name:'Ash ridge camp',town:'highmere',faction:'ash',kind:'shieldbreaker',x:1405,z:-970,route:[[1320,-950],[1230,-920],[1140,-885],[1050,-850],[1010,-831]],gate:[963,-831]},
]);

/** Seeded checks, persistent pressure, and one reward per completed defence. */
export class CampDirector {
  constructor(save={},random=null){
    this.save=save;save.clock??=0;save.seed??=913741;save.camps??={};this.random=random??(()=>{save.seed=(Math.imul(save.seed,1664525)+1013904223)>>>0;return save.seed/4294967296;});
    for(const def of CAMP_DEFINITIONS)save.camps[def.id]??={pressure:0,losses:0,raids:0,nextAt:180+this.random()*300,sequence:0,active:null};
  }
  hit(campId,damage,byPlayer=false){const c=this.save.camps[campId];if(!c)return;c.pressure=Math.min(4,c.pressure+damage/600);if(byPlayer&&c.active)c.active.contribution+=Math.max(0,damage);}
  loss(campId){const c=this.save.camps[campId];if(c){c.losses++;c.pressure=Math.min(4,c.pressure+.12);}}
  start(id,{forced=false,strength=6}={}){
    const c=this.save.camps[id];if(!c||c.active||strength<3)return false;
    c.sequence++;c.raids++;c.active={id:id+':'+c.sequence,started:this.save.clock,contribution:0,strength,helped:false};
    c.nextAt=this.save.clock+540+this.random()*540;c.pressure*=.65;return c.active;
  }
  update(dt,{night=false,available=()=>0,demand=()=>1,nearby=()=>true,onStart=()=>{}}={}){
    this.save.clock+=Math.max(0,dt);
    for(const def of CAMP_DEFINITIONS){const c=this.save.camps[def.id];c.pressure=Math.max(0,c.pressure-dt/2400);
      if(c.active||this.save.clock<c.nextAt||!nearby(def))continue;
      c.nextAt=this.save.clock+90+this.random()*90;
      const chance=Math.min(.8,.1+c.pressure*.13+(demand(def.town)-1)*.12+(night?.1:0));
      const strength=available(def.id);if(strength>=3&&this.random()<chance){const raid=this.start(def.id,{strength});onStart(def,raid);}
    }
  }
  finish(id,repelled){
    const c=this.save.camps[id],raid=c?.active;if(!raid)return null;c.active=null;c.lastOutcome=repelled?'repelled':'raided';
    c.nextAt=Math.max(c.nextAt,this.save.clock+360);c.lastRaid=raid;
    if(raid.contribution<1||raid.rewarded)return null;raid.rewarded=true;
    return {id:raid.id,coins:repelled?80:30,xp:repelled?45:15,reputation:repelled?8:3,repelled};
  }
}
