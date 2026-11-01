import {terrainSampler} from './terrain-sampler.js';
import {BattleSimulation} from './battle-simulation.js';
import {CAMPAIGN_SITE,MUSTER_CAMPS} from './battle-sites.js';
import {BattleStorage,packBattle,unpackBattle} from './battle-storage.js';
export {packBattle,unpackBattle};

/** Local encounters belong to real camps. Only the quest owns a staged army. */
export class BattleDirector {
  constructor({save={},registry,progress,factions,height=()=>0,announce=()=>{}}){
    Object.assign(this,{save,registry,progress,factions,height,announce});
    save.clock??=0;save.events??={};save.campaign??={stage:'dormant'};
    this.records=new Map();this.loading=new Map();this.attached=new Set();this.storage=new BattleStorage();
    // Retire old fixed-site raids without touching camp inhabitants or their saves.
    for(const id of ['cart-road-raid','briar-raid'])delete save.events[id];
    if(save.campaign.stage!=='resolved'&&!save.campaign.chosenSide){
      save.campaign.stage='dormant';delete save.events[CAMPAIGN_SITE.id];
    }
    delete save.campaign.deadline;
  }
  state(id){return this.save.events[id];}
  isActive(id){return this.state(id)?.status==='active';}
  hasQuest(){return Boolean(this.progress.data.quests['northern-stand']?.active&&this.progress.data.worldFlags.beaconLit);}
  canStage(){return this.hasQuest()&&['muster','battle'].includes(this.save.campaign.stage);}
  chooseSide(faction){
    if(!this.hasQuest()||this.save.campaign.stage!=='muster'||!MUSTER_CAMPS.some(c=>c.faction===faction))return false;
    this.save.campaign.chosenSide=faction;this.progress.save();return true;
  }
  begin(id){
    const c=this.save.campaign;
    if(id!==CAMPAIGN_SITE.id||!this.hasQuest()||c.stage!=='muster'||!c.chosenSide)return false;
    const event=this.state(id)??{iteration:1};Object.assign(event,{status:'active',startedAt:this.save.clock,offscreenTime:0});this.save.events[id]=event;
    c.stage='battle';c.joined=true;this.announce('The signal is up. Both armies are advancing.');return true;
  }
  muster(position){
    const camp=MUSTER_CAMPS.find(c=>c.faction===this.save.campaign.chosenSide);
    if(!camp||!position||Math.hypot(position.x-camp.x,position.z-camp.z)>45)return false;
    return this.begin(CAMPAIGN_SITE.id);
  }
  simulation(id){return this.records.get(id)??null;}
  async loadSimulation(id){
    if(this.records.has(id))return this.records.get(id);
    if(id!==CAMPAIGN_SITE.id||!this.canStage()&&this.state(id)?.status!=='resolved')return null;
    if(this.loading.has(id))return this.loading.get(id);
    const job=(async()=>{
      const site=CAMPAIGN_SITE,state=this.save.events[id]??={status:'staged',iteration:1};
      const simulation=await BattleSimulation.create(site.count,{registry:this.registry,factions:site.factions,cavalry:site.cavalry,training:site.factions.map(f=>this.factions?.economy.markets[f]?.training??0),idPrefix:id+':'+state.iteration+':',height:terrainSampler((x,z)=>this.height(site.x+x,site.z+z))});
      if(state.packed)simulation.restore(await this.storage.unpack(state.packed));
      else{
        // The separated companies advance only after an explicit departure signal.
        for(const c of simulation.companies){const shift=c.side*125;c.x+=shift;c.homeX+=shift;c.goalX=c.x;}
        for(const a of simulation.actors){const shift=a.side*125;a.x+=shift;a.homeX+=shift;a.clip=0;a.speed=0;}
      }
      this.records.set(id,simulation);return simulation;
    })();
    this.loading.set(id,job);try{return await job;}finally{this.loading.delete(id);}
  }
  supply(id){
    const state=this.state(id),simulation=this.records.get(id);if(!state||!simulation||state.suppliesApplied)return false;
    if(!this.save.campaign.chosenSide||!this.isActive(id))return false;
    const team=this.save.campaign.chosenSide==='ash'?1:0;
    for(const unit of simulation.actors)if(unit.team===team&&unit.hp>0){unit.hp+=15;unit.maxHp+=15;unit.stats.maxHealth+=15;}
    state.suppliesApplied=true;return true;
  }
  contribute(kind,amount=1,siteId=CAMPAIGN_SITE.id){
    if(siteId!==CAMPAIGN_SITE.id||!this.isActive(siteId))return;
    const c=this.save.campaign;c.contributions??={};c.contributions[kind]=(c.contributions[kind]??0)+amount;
  }
  resolve(site,simulation){
    const state=this.state(site.id);if(state?.status!=='active'||!simulation.winner)return;
    state.status='resolved';state.winner=simulation.winner<0?0:1;state.endedAt=this.save.clock;
    const winner=site.factions[state.winner],loser=site.factions[1-state.winner];
    this.factions?.economy.receive(loser,'iron',-20);this.factions?.economy.receive(winner,'bread',10);
    const c=this.save.campaign;c.stage='resolved';c.winner=winner;
    Object.assign(this.progress.data.worldFlags,{northernOutcome:winner,northernBattleOver:true,campaignSide:c.chosenSide,campaignRole:c.contributions?.kills>=5?'vanguard':'support'});
    this.progress.recordObjective('battle:northern-battle');this.progress.save();
    this.announce(winner==='highmere'?'Highmere holds the crossing. The survivors are gathering at camp.':'The Ash Company holds the crossing. The survivors are gathering at camp.');
  }
  update(dt){
    this.save.clock+=dt;
    if(this.save.campaign.stage==='dormant'&&this.hasQuest()){
      this.save.campaign.stage='muster';this.announce('Both camps are mustering at the northern crossing. Choose a side, then signal when you are ready.');
    }
    if(this.save.campaign.stage==='battle'&&this.progress.data.worldFlags.northernSupplies)this.supply(CAMPAIGN_SITE.id);
    // Unloaded quest armies resume their surviving records on the next visit.
  }
  async persist(){
    if(this.saving)return this.saving;
    this.saving=(async()=>{for(const [id,sim]of this.records)this.state(id).packed=await this.storage.pack(await sim.snapshotAsync());return this.save;})();
    try{return await this.saving;}finally{this.saving=null;}
  }
  dispose(){this.storage.dispose();}
}
