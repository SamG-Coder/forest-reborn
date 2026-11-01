import {weaponAction} from '../game/weapon-catalog.js';
import {Society,personality,flagState} from './society.js';
import {random} from '../world/terrain.js';
import {sellInventory} from '../world/resources.js';
import {createSkills,awardSkill,GATHERING} from '../progression/skills.js';
import {FactionWorld} from '../factions/world.js';
import {RESOURCE_VALUES} from '../factions/economy.js';
import {veteranBackground} from './regional-adventurers.js';

const KEY='forest-reborn-adventurers-v1';
export const SIM_STEP_MS=15000;
const MAX_ABSENCE=8*60*60*1000;
const first=['Ewan','Soren','Niko','Darin','Keir','Alric','Finn','Owen','Luca','Bram','Ronan','Jules','Cai','Tarin','Ellis','Marek'];
export const TASK_LABELS=Object.freeze({hunt:'Hunting mobs',sell:'Selling supplies',travel:'On the road',train:'Practising swordwork',gather:'Gathering supplies',tavern:'At the Wayward Oak',rest:'Taking a break',buyTool:'Buying an axe',explore:'Exploring the roads'});

/** Progress is a ledger of completed world actions, never a reward for elapsed time. */
export class AdventurerSimulation {
  constructor(storage,now=Date.now(),count=20){
    this.storage=storage;const rng=random(3411);
    this.actors=Array.from({length:count},(_,id)=>({id,name:`${first[id%first.length]} ${['Reed','Vale','Ash','Rowan'][Math.floor(id/first.length)%4]}`,xp:Math.floor(rng()*50),kills:0,skill:0,skills:createSkills(),coins:8,inventory:{},health:100,stamina:80,hunger:10,task:id%3===1?'gather':'hunt',...veteranBackground(id)}));
    let socialSaved={},factionSaved={};this.friends=new Set();this.updatedAt=now;this.savedWorld=null;this.events=[];this.stock={};this.shopStock={};
    try{
      const saved=JSON.parse(storage.getItem(KEY));
      if(Array.isArray(saved?.actors)&&[1,2,3].includes(saved.version)){
        factionSaved=saved.factions??{};socialSaved=saved.society??{};this.actors=this.actors.map((base,id)=>{const actor=saved.actors.find(a=>a.id===id);return actor?{...base,...actor,id,skills:createSkills(actor.skills),task:actor.task==='train'?'hunt':actor.task}:base;});
        this.friends=new Set((saved.friends??[]).filter(id=>Number.isInteger(id)&&id>=0&&id<count));
        this.updatedAt=Math.min(now,saved.updatedAt??now);this.savedWorld=saved.world??null;this.stock=saved.stock??{};this.shopStock=saved.shopStock??{};
      }
    }catch{}
    for(const actor of this.actors){actor.personality??=personality(actor.id);actor.tools??={};actor.pvp=flagState(actor.pvp);}
    this.society=new Society(this.actors,socialSaved,now);
    this.factions=new FactionWorld(factionSaved,now);
    this.offline={seconds:Math.min(MAX_ABSENCE,Math.max(0,(now-this.updatedAt)))/1000,kills:0,training:0};
  }
  advanceTo(now){this.updatedAt=Math.max(this.updatedAt,now);return {seconds:0,kills:0,training:0};}
  record(actor,type,detail,now=Date.now()){
    this.events.push({actor:actor.id,name:actor.name,type,detail,time:now});if(this.events.length>60)this.events.shift();
  }
  defeated(actor,target,now){
    this.questAgents?.get(actor.id)?.defeated(target);
    const shared=this.contracts?.recordKill(actor.id,target,now);
    for(const id of actor.journey?.party??[])if(id!==actor.id&&!shared?.has(id)){const ally=this.questAgents?.get(id);if(ally&&ally.person.position.distanceTo(target.position)<18)ally.record(target.kind);}
    this.society.recordBountyKill(actor.id,target,now);actor.kills++;actor.xp+=target.kind==='rabbit'?4:target.kind.startsWith('ogre')?60:10;
    actor.coins+=this.society.contribute(actor.id,'kill',target.position??{x:0,z:0},now);
    this.record(actor,'kill',target.name,now);
  }
  gathered(actor,kind,nodeId,now,position={x:0,z:0}){const amount=GATHERING[kind]?.yield??(kind==='wood'?3:1);this.questAgents?.get(actor.id)?.record('gather:'+kind,amount);actor.inventory[kind]=(actor.inventory[kind]??0)+amount;actor.coins+=this.society.contribute(actor.id,'gather',position,now);actor.xp+=2;const skill=GATHERING[kind];if(skill)awardSkill(actor.skills,skill.skill,skill.xp);this.record(actor,'gather',nodeId,now);}
  landedHit(actor,target){if(target)this.contracts?.recordHit(actor.id,target);actor.skill++;awardSkill(actor.skills,weaponAction(actor.weapon).ranged?'archery':'sword',3);}
  sell(actor,now){
    let coins=0,count=0;const vendor=actor.buyerId??'trader';
    for(const [id,n]of Object.entries(actor.inventory))if(n>0){const paid=this.factions.economy.sellTo(vendor,id,n,RESOURCE_VALUES[id]??2);if(paid){coins+=paid;count+=n;this.stock[id]=(this.stock[id]??0)+n;delete actor.inventory[id];}}
    actor.coins+=coins;if(coins){awardSkill(actor.skills,'trading',count*2);this.record(actor,'sell',`${coins} copper at ${actor.buyerName??'Orin'}’s counter`,now);}actor.buyerId=null;return coins;
  }
  meal(actor,now){if(actor.coins<2)return false;actor.coins-=2;actor.hunger=0;actor.health=100;actor.stamina=100;this.record(actor,'meal','paid Tomas for food',now);return true;}
  task(actor){return actor.task;}
  level(actor){return Math.max(actor.questProgress?.level??1,1+Math.floor(Math.sqrt(actor.xp/120)));}
  toggleFriend(id){if(!this.actors[id])return false;if(this.friends.has(id))this.friends.delete(id);else this.friends.add(id);this.save();return this.friends.has(id);}
  save(now=Date.now()){
    this.updatedAt=now;this.storage.setItem(KEY,JSON.stringify({version:3,factions:this.factions.snapshot(),society:this.society.snapshot(),actors:this.actors,friends:[...this.friends],updatedAt:now,stock:this.stock,shopStock:this.shopStock,world:this.snapshot?.()??this.savedWorld}));
  }
}
