import {Society,personality,flagState} from './society.js';
import {random} from '../world/terrain.js';
import {sellInventory} from '../world/resources.js';
import {createSkills,awardSkill,GATHERING} from '../progression/skills.js';

const KEY='forest-reborn-adventurers-v1';
export const SIM_STEP_MS=15000;
const MAX_ABSENCE=8*60*60*1000;
const first=['Ewan','Soren','Niko','Darin','Keir','Alric','Finn','Owen','Luca','Bram','Ronan','Jules','Cai','Tarin','Ellis','Marek'];
export const TASK_LABELS=Object.freeze({hunt:'Hunting mobs',sell:'Selling supplies',travel:'On the road',train:'Practising swordwork',gather:'Gathering supplies',tavern:'At the Wayward Oak',rest:'Taking a break',buyTool:'Buying an axe',explore:'Exploring the roads'});

/** Progress is a ledger of completed world actions, never a reward for elapsed time. */
export class AdventurerSimulation {
  constructor(storage,now=Date.now(),count=12){
    this.storage=storage;const rng=random(3411);
    this.actors=Array.from({length:count},(_,id)=>({id,name:`${first[id%first.length]} ${['Reed','Vale','Ash','Rowan'][Math.floor(id/first.length)%4]}`,xp:Math.floor(rng()*50),kills:0,skill:0,skills:createSkills(),coins:8,inventory:{},health:100,stamina:80,hunger:10,task:id%3===1?'gather':'hunt'}));
    let socialSaved={};this.friends=new Set();this.updatedAt=now;this.savedWorld=null;this.events=[];this.stock={};this.shopStock={};
    try{
      const saved=JSON.parse(storage.getItem(KEY));
      if(saved?.actors?.length>=count&&[1,2,3].includes(saved.version)){
        socialSaved=saved.society??{};this.actors=saved.actors.slice(0,count).map((actor,id)=>({...this.actors[id],...actor,id,skills:createSkills(actor.skills),task:actor.task==='train'?'hunt':actor.task}));
        this.friends=new Set((saved.friends??[]).filter(id=>Number.isInteger(id)&&id>=0&&id<count));
        this.updatedAt=Math.min(now,saved.updatedAt??now);this.savedWorld=saved.world??null;this.stock=saved.stock??{};this.shopStock=saved.shopStock??{};
      }
    }catch{}
    for(const actor of this.actors){actor.personality??=personality(actor.id);actor.tools??={};actor.pvp=flagState(actor.pvp);}
    this.society=new Society(this.actors,socialSaved,now);
    this.offline={seconds:Math.min(MAX_ABSENCE,Math.max(0,(now-this.updatedAt)))/1000,kills:0,training:0};
  }
  advanceTo(now){this.updatedAt=Math.max(this.updatedAt,now);return {seconds:0,kills:0,training:0};}
  record(actor,type,detail,now=Date.now()){
    this.events.push({actor:actor.id,name:actor.name,type,detail,time:now});if(this.events.length>60)this.events.shift();
  }
  defeated(actor,target,now){
    this.society.recordBountyKill(actor.id,target,now);actor.kills++;actor.xp+=target.kind==='rabbit'?4:10;actor.coins+=target.kind==='rabbit'?1:3;
    const item=target.kind==='rabbit'?'rabbitHide':'goblinScrap';actor.inventory[item]=(actor.inventory[item]??0)+1;
    actor.coins+=this.society.contribute(actor.id,'kill',target.position??{x:0,z:0},now);
    this.record(actor,'kill',target.name,now);
  }
  gathered(actor,kind,nodeId,now,position={x:0,z:0}){actor.inventory[kind]=(actor.inventory[kind]??0)+(kind==='wood'?3:1);actor.coins+=this.society.contribute(actor.id,'gather',position,now);actor.xp+=2;const skill=GATHERING[kind];if(skill)awardSkill(actor.skills,skill.skill,skill.xp);this.record(actor,'gather',nodeId,now);}
  landedHit(actor){actor.skill++;awardSkill(actor.skills,'sword',3);}
  sell(actor,now){
    const count=Object.values(actor.inventory).reduce((sum,n)=>sum+n,0),coins=sellInventory(actor,this.stock);if(coins){awardSkill(actor.skills,'trading',count*2);this.record(actor,'sell',`${coins} copper at Orin’s stall`,now);}return coins;
  }
  meal(actor,now){if(actor.coins<2)return false;actor.coins-=2;actor.hunger=0;actor.health=100;actor.stamina=100;this.record(actor,'meal','paid Tomas for food',now);return true;}
  task(actor){return actor.task;}
  level(actor){return 1+Math.floor(Math.sqrt(actor.xp/120));}
  toggleFriend(id){if(!this.actors[id])return false;if(this.friends.has(id))this.friends.delete(id);else this.friends.add(id);this.save();return this.friends.has(id);}
  save(now=Date.now()){
    this.updatedAt=now;this.storage.setItem(KEY,JSON.stringify({version:3,society:this.society.snapshot(),actors:this.actors,friends:[...this.friends],updatedAt:now,stock:this.stock,shopStock:this.shopStock,world:this.snapshot?.()??this.savedWorld}));
  }
}
