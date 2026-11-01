import * as THREE from 'three';
import {rollLoot,CORPSE_SECONDS,takeLoot} from '../progression/loot.js';
import {RagdollPose} from './ragdoll.js';
import {SeveredParts,severShader} from '../effects/severed-parts.js';
import {BODY_PARTS} from '../game/hit-impact.js';

const ease=t=>t*t*(3-2*t);
/** One death transition, one loot owner and one respawn deadline per life. */
export class CorpseSystem {
  constructor(scene,{random=Math.random,height=()=>0}={}){this.scene=scene;this.random=random;this.height=height;this.records=new Map();this.fragments=new SeveredParts(scene,height);this.updatedAt=Date.now();}
  kill(target,now=Date.now(),killer=null){
    if(this.records.has(target.id))return this.records.get(target.id);
    target.hp=0;target.windup=0;if(!target.externalSimulation)target.attack=null;
    const root=target.root,record={id:target.id,target,killedAt:now,endsAt:now+CORPSE_SECONDS*1000,loot:target.lootOverride??rollLoot(target.kind,this.random),owner:target.lootClaim==='player'&&target.claimUntil>now?'player':killer?.id??null,killer,position:target.position.clone(),rotation:root.rotation.clone()};
    const actor=target.controller??target.person?.actor,rig=actor?.avatar?.rig;
    if(rig&&!target.externalSimulation){
      root.updateMatrixWorld(true);rig.skeleton.update();record.rig=rig;record.initialPose=rig.skeleton.bones.map(b=>({position:b.position.clone(),quaternion:b.quaternion.clone()}));
      record.ragdoll=new RagdollPose({matrices:rig.skeleton.boneMatrices,origin:target.position.clone(),transform:root.matrixWorld,yaw:root.rotation.y,scale:root.scale.y,height:this.height,impulse:new THREE.Vector3(target.hitDirection?.x??0,.3,target.hitDirection?.z??-1).multiplyScalar(2.1)});
      if(target.severedPart){
        actor.severState??={value:0};const sources=[];root.traverseVisible(o=>{if(o.isSkinnedMesh){sources.push(o);if(!o.material.userData.sever){severShader(o.material,{state:actor.severState});o.material.userData.sever=true;}}});actor.severState.value=BODY_PARTS[target.severedPart].code;
        this.fragments.spawn(target.id,target.severedPart,sources,rig.skeleton.boneMatrices,root.matrixWorld,target.hitDirection);
      }
    }
    if(record.owner==='player')this.ensureBag(record);
    this.records.set(target.id,record);target.corpse=record;return record;
  }
  ensureBag(record){
    if(record.bag)return record.bag;
    // Army casualties keep lightweight loot records. Only player-owned drops
    // need a scene object, and all sacks share the same GPU resources.
    this.bagAssets??={cloth:new THREE.MeshStandardMaterial({color:'#79583b',roughness:1}),tie:new THREE.MeshStandardMaterial({color:'#c4a26b',roughness:.8}),sack:new THREE.SphereGeometry(.15,10,8),cord:new THREE.TorusGeometry(.065,.008,5,12)};
    const a=this.bagAssets,bag=new THREE.Group();bag.name='Loot · '+record.target.name;
    const sack=new THREE.Mesh(a.sack,a.cloth);sack.scale.set(1,1.2,.8);sack.position.y=.15;bag.add(sack);
    const cord=new THREE.Mesh(a.cord,a.tie);cord.rotation.x=Math.PI/2;cord.position.y=.29;bag.add(cord);
    bag.position.copy(record.position);bag.position.x+=.45;bag.visible=false;this.scene.add(bag);record.bag=bag;return bag;
  }
  picks(player){return [...this.records.values()].filter(r=>r.owner==='player'&&r.bag?.visible&&(r.loot.coins||r.loot.items.length)&&r.bag.position.distanceTo(player)<25).map(r=>({id:'loot:'+r.id,kind:'loot',name:r.target.name+' loot',loot:r,root:r.bag,position:r.bag.position,hp:1,pickHeight:.8,pickRadius:.5}));}
  nearest(player){return this.picks(player).filter(r=>r.position.distanceTo(player)<3).sort((a,b)=>a.position.distanceToSquared(player)-b.position.distanceToSquared(player))[0]?.loot??null;}
  take(record,progress,player,id=null){if(!this.records.has(record.id)||record.owner!=='player'||player.distanceTo(record.bag.position)>3)return false;return takeLoot(record.loot,progress,id)>0;}
  restore(target){
    const r=this.records.get(target.id);if(!r)return;
    target.root.rotation.copy(r.rotation);target.position.copy(r.position);target.corpse=null;
    if(r.rig)r.rig.skeleton.bones.forEach((bone,i)=>{bone.position.copy(r.initialPose[i].position);bone.quaternion.copy(r.initialPose[i].quaternion);});
    const actor=target.controller??target.person?.actor;if(actor?.severState)actor.severState.value=0;target.severedPart=null;this.fragments.remove(target.id);r.ragdoll?.rig.skeleton.dispose();
    r.bag?.removeFromParent();this.records.delete(target.id);
  }
  update(now,observer){
    const dt=Math.max(0,Math.min(.1,(now-this.updatedAt)/1000));this.updatedAt=now;this.fragments.update(dt);
    for(const r of this.records.values()){
      const {target}=r,t=THREE.MathUtils.clamp((now-r.killedAt)/950,0,1),height=target.kind==='rabbit'?.18:.18;
      if(target.hp>0){this.restore(target);continue;}
      // Settle the whole skinned pose onto the ground. No animation writer runs
      // on a corpse; the head, clothes and held equipment stay together.
      if(r.ragdoll){
        if(now-r.killedAt>5000&&!r.ragdoll.settled)for(let i=0;i<46;i++)r.ragdoll.update(.1);
        if(!r.poseFrozen){r.ragdoll.update(dt);r.ragdoll.copyTo(r.rig);r.poseFrozen=r.ragdoll.settled;}
        if(r.bag){const hips=r.ragdoll.points.get('hips').position;r.bag.position.set(hips.x+.35,this.height(hips.x+.35,hips.z),hips.z);}
        this.fragments.updateStump(target.id,r.rig.skeleton.boneMatrices,r.rig,target.root.matrixWorld);
      }else if(!target.externalSimulation){target.root.rotation.z=r.rotation.z+ease(t)*1.47;
      target.root.rotation.x=r.rotation.x-.12*ease(t);
      target.position.y=r.position.y+Math.sin(t*Math.PI)*.10+height*ease(t);}
      const close=r.position.distanceTo(observer)<170;
      target.root.visible=close&&now<r.endsAt;
      if(r.bag)r.bag.visible=close&&t>=1&&r.owner==='player'&&Boolean(r.loot.coins||r.loot.items.length);
      if(r.owner!=='player'&&r.killer?.person?.data&&now-r.killedAt>1400){
        const actor=r.killer.person.data;
        if(r.killer.position.distanceTo(r.position)<3){actor.coins+=r.loot.coins;r.loot.coins=0;for(const s of r.loot.items)actor.inventory[s.id]=(actor.inventory[s.id]??0)+s.count;r.loot.items=[];}
      }
      if(target.dispose&&now>=r.endsAt&&!r.loot.coins&&!r.loot.items.length){this.restore(target);target.dispose();}
    }
  }
  snapshot(){return [...this.records.values()].map(r=>({id:r.id,killedAt:r.killedAt,endsAt:r.endsAt,loot:r.loot,owner:r.owner,position:r.position.toArray(),rotation:r.rotation.toArray()}));}
  load(saved,targets,now=Date.now()){
    const byId=new Map(targets.map(t=>[t.id,t]));
    for(const entry of saved??[]){const target=byId.get(entry.id),respawn=target?.person?.respawnAt??target?.readyAt;if(!target||target.hp>0||!target.externalSimulation&&respawn<=now)continue;const r=this.kill(target,entry.killedAt);r.endsAt=entry.endsAt;r.loot=entry.loot;r.owner=entry.owner;r.position.fromArray(entry.position);r.rotation.fromArray(entry.rotation);if(r.owner==='player')this.ensureBag(r);}
  }
  dispose(){for(const r of [...this.records.values()])this.restore(r.target);this.fragments.dispose();for(const asset of Object.values(this.bagAssets??{}))asset.dispose();}
}
