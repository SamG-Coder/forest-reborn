import {QUESTS} from './quests.js';
import {createGearRegistry} from '../gear/catalog.js';
import {ITEMS,itemDefinition,BAG_SIZE} from './items.js';
import {emptyBag,insertItem,removeItem,moveStack,splitStack,itemCount} from './inventory.js';
import {createSkills,awardSkill} from './skills.js';
import {grantMount,mountDefinition} from '../mounts/catalog.js';
import {isWeapon} from '../game/weapon-catalog.js';
import {questBlockReason} from './quest-types.js';
import {changeStanding} from '../factions/catalog.js';

const KEY='forest-reborn-progress-v2';
export const STARTING_EQUIPMENT=Object.freeze(['legs.starter']);
export const STARTING_COINS=50000; // 5 gold, stored as copper.
export const KILL_REWARDS=Object.freeze({ashRaider:{xp:34,coins:12,item:'steelScrap'},shieldbreaker:{xp:65,coins:20,item:'steelScrap'},hillGiant:{xp:250,coins:75,item:'giantRune'},rabbit:{xp:4,coins:1,item:'rabbitHide'},goblin:{xp:10,coins:3,item:'goblinScrap'},bandit:{xp:16,coins:5,item:'linen'},ogre:{xp:60,coins:20,item:'ogreTooth'},ogreChampion:{xp:120,coins:40,item:'ogreTooth'}});
export const levelThreshold=level=>Math.round(80*level**1.45);

export class PlayerProgress {
  constructor(storage,registry=createGearRegistry()){
    this.storage=storage;this.registry=registry;this.lastError='';
    this.data={version:3,xp:0,level:1,coins:STARTING_COINS,quests:{},owned:[...STARTING_EQUIPMENT],equipped:[...STARTING_EQUIPMENT],weapons:[],weapon:'unarmed',kills:{},position:[0,0,17],bag:emptyBag(),overflow:[],skills:createSkills()};
    try{
      const saved=JSON.parse(storage.getItem(KEY));
      if([2,3].includes(saved?.version)&&Array.isArray(saved.owned)&&Array.isArray(saved.equipped)&&saved.quests&&typeof saved.quests==='object'){
        this.data={...this.data,...saved,version:3,skills:createSkills(saved.skills)};
        for(const key of ['xp','level','coins'])if(!Number.isFinite(this.data[key])||this.data[key]<0)this.data[key]=key==='level'?1:0;
        this.data.level=Math.max(1,Math.floor(this.data.level));this.data.coins=Math.floor(this.data.coins);
        this.data.equipped=this.data.equipped.filter(id=>saved.owned.includes(id));
        this.data.weapons=Array.isArray(saved.weapons)?saved.weapons.filter(isWeapon):[];
        if(!this.data.weapons.includes(saved.weapon))this.data.weapon='unarmed';
        this.data.overflow=Array.isArray(saved.overflow)?saved.overflow:[];
        if(saved.version===3&&Array.isArray(saved.bag)){
          this.data.bag=emptyBag();
          saved.bag.slice(0,BAG_SIZE).forEach((stack,i)=>{
            if(stack&&typeof stack.id==='string'&&Number.isInteger(stack.count)&&stack.count>0){
              const limit=this.item(stack.id).stack;this.data.bag[i]={id:stack.id,count:Math.min(stack.count,limit)};
              if(stack.count>limit)this.data.overflow.push({id:stack.id,count:stack.count-limit});
            }
          });
        }else{
          this.data.bag=emptyBag();
          const recovered=[...Object.entries(saved.inventory??{}).map(([id,count])=>({id,count})),
            ...saved.owned.filter(id=>!this.data.equipped.includes(id)).map(id=>({id,count:1})),
            ...this.data.weapons.filter(id=>id!==this.data.weapon).map(id=>({id,count:1}))];
          for(const stack of recovered){const next=insertItem(this.data.bag,stack.id,stack.count,this.item(stack.id).stack);if(next)this.data.bag=next;else this.data.overflow.push(stack);}
        }
      }
    }catch{}
    this.data.mounts=Array.isArray(this.data.mounts)?[...new Set(this.data.mounts.filter(mountDefinition))]:[];
    if(!this.data.mounts.includes(this.data.activeMount))this.data.activeMount=this.data.mounts[0]??null;
    this.data.reputation??={};this.data.worldFlags??={};
    this.refreshOwnership();
  }
  item(id){return itemDefinition(id,this.registry);}
  refreshOwnership(){
    const ids=this.data.bag.filter(Boolean).map(s=>s.id);
    this.data.owned=[...new Set([...this.data.equipped,...ids.filter(id=>this.item(id).type==='Equipment')])];
    this.data.weapons=[...new Set([...ids.filter(id=>this.item(id).type==='Weapon'),...(isWeapon(this.data.weapon)?[this.data.weapon]:[])])];
    this.data.inventory={};
    for(const stack of this.data.bag)if(stack&&this.item(stack.id).type==='Material')this.data.inventory[stack.id]=(this.data.inventory[stack.id]??0)+stack.count;
  }
  save(){this.refreshOwnership();this.storage.setItem(KEY,JSON.stringify(this.data));}
  hasItem(id,count=1){return itemCount(this.data.bag,id)>=count;}
  canAddItem(id,count=1){return Boolean(insertItem(this.data.bag,id,count,this.item(id).stack));}
  addItem(id,count=1){const next=insertItem(this.data.bag,id,count,this.item(id).stack);if(!next){this.lastError='Your bag is full.';return false;}this.data.bag=next;this.save();return true;}
  moveItem(from,to){const source=this.data.bag[from];if(!source)return false;const next=moveStack(this.data.bag,from,to,this.item(source.id).stack);if(!next)return false;this.data.bag=next;this.save();return true;}
  splitItem(index){const next=splitStack(this.data.bag,index);if(!next)return false;this.data.bag=next;this.save();return true;}
  sortBag(){let next=emptyBag();for(const stack of this.data.bag.filter(Boolean).sort((a,b)=>this.item(a.id).name.localeCompare(this.item(b.id).name)))next=insertItem(next,stack.id,stack.count,this.item(stack.id).stack);this.data.bag=next;this.save();}
  equipItem(index){
    const stack=this.data.bag[index],item=stack&&this.item(stack.id);if(!item?.slot)return false;
    if(this.data.level<(item.level??1)){this.lastError=`Requires level ${item.level}.`;return false;}
    const old=item.slot==='weapon'?(isWeapon(this.data.weapon)?this.data.weapon:null):this.data.equipped.find(id=>this.item(id).slot===item.slot);
    let bag=removeItem(this.data.bag,stack.id,1);if(old)bag=insertItem(bag,old,1,1);if(!bag)return false;
    this.data.bag=bag;
    if(item.slot==='weapon')this.data.weapon=stack.id;
    else this.data.equipped=[...this.data.equipped.filter(id=>this.item(id).slot!==item.slot),stack.id];
    this.save();return true;
  }
  unequip(slot){
    const old=slot==='weapon'?(isWeapon(this.data.weapon)?this.data.weapon:null):this.data.equipped.find(id=>this.item(id).slot===slot);
    if(!old)return true;const bag=insertItem(this.data.bag,old,1,1);if(!bag){this.lastError='Make room in your bag first.';return false;}
    this.data.bag=bag;if(slot==='weapon')this.data.weapon='unarmed';else this.data.equipped=this.data.equipped.filter(id=>id!==old);
    this.save();return true;
  }
  recoverItem(index){const stack=this.data.overflow[index];if(!stack||!this.addItem(stack.id,stack.count))return false;this.data.overflow.splice(index,1);this.save();return true;}
  sellMaterials(stock){
    let coins=0,count=0;
    this.data.bag=this.data.bag.map(stack=>{if(!stack||this.item(stack.id).type!=='Material')return stack;const paid=this.factions?.economy.sellTo('trader',stack.id,stack.count,this.item(stack.id).value)??this.item(stack.id).value*stack.count;if(!paid)return stack;coins+=paid;count+=stack.count;stock[stack.id]=(stock[stack.id]??0)+stack.count;return null;});
    this.data.coins+=coins;if(count)this.addSkillXP('trading',count*2);this.save();return coins;
  }
  addSkillXP(id,amount){awardSkill(this.data.skills,id,amount);}
  addXP(amount){this.data.xp+=amount;while(this.data.xp>=levelThreshold(this.data.level)){this.data.xp-=levelThreshold(this.data.level);this.data.level++;}}
  state(quest){
    const entry=this.data.quests[quest.id];if(entry?.completed&&!quest.repeatable)return 'completed';
    if(questBlockReason(quest,this.data))return 'locked';
    if(entry?.active){const count=quest.kind.startsWith('deliver:')?itemCount(this.data.bag,quest.kind.slice(8)):entry.count;return count>=quest.count?'ready':'active';}
    return 'available';
  }
  accept(id){const quest=QUESTS.find(q=>q.id===id);if(!quest||this.state(quest)!=='available')return false;this.data.quests[id]={...this.data.quests[id],active:true,count:0,acceptedAt:Date.now()};this.save();return true;}
  recordKill(kind){const reward=KILL_REWARDS[kind];if(!reward)return null;this.addXP(reward.xp);this.data.kills[kind]=(this.data.kills[kind]??0)+1;this.recordObjective(kind);this.save();return {...reward,coins:0};}
  recordObjective(kind,amount=1){let changed=false;for(const quest of QUESTS)if(quest.kind===kind&&this.data.quests[quest.id]?.active){this.data.quests[quest.id].count=Math.min(quest.count,this.data.quests[quest.id].count+amount);changed=true;}if(changed)this.save();return changed;}
  claim(id){
    const quest=QUESTS.find(q=>q.id===id);if(!quest||this.state(quest)!=='ready')return null;
    let bag=this.data.bag;if(id==='errand'&&this.hasItem('flour'))bag=removeItem(bag,'flour');
    if(quest.kind.startsWith('deliver:')){bag=removeItem(bag,quest.kind.slice(8),quest.count);if(!bag)return null;}
    const rewardId=quest.reward.item??quest.reward.weapon;
    if(rewardId){bag=insertItem(bag,rewardId,quest.reward.count??1,this.item(rewardId).stack);if(!bag){this.lastError='Make room in your bag for the reward.';return null;}}
    this.data.bag=bag;const entry=this.data.quests[id];entry.active=false;entry.completed=true;entry.turnIns=(entry.turnIns??0)+1;
    this.addXP(quest.reward.xp);this.data.coins+=quest.reward.coins;
    if(quest.reward.mount)grantMount(this.data,quest.reward.mount);
    if(quest.kind.startsWith('deliver:'))this.factions?.economy.receive(quest.faction,quest.kind.slice(8),quest.count);
    if(this.factions)this.factions.applyQuest(quest);else{
      for(const [id,amount]of Object.entries(quest.reputation??{}))changeStanding(this.data.reputation,id,amount);
      Object.assign(this.data.worldFlags,quest.worldChanges??{});
    }
    this.save();return quest.reward;
  }
}

