import * as THREE from 'three';
import {createHorse} from './horse-model.js';
import {mountDefinition} from './catalog.js';
import {TOWN_PLOTS} from '../world/layout.js';
import {HIGHMERE_PLOTS,inKeepHall} from '../world/region-layout.js';
import {applyRiderPose} from './rider-pose.js';

export function indoors(position){
  if(inKeepHall(position.x,position.z))return true;
  return [...TOWN_PLOTS,...HIGHMERE_PLOTS].some(p=>{
    const a=p.angle??0,dx=position.x-p.x,dz=position.z-p.z;
    return Math.abs(dx*Math.cos(a)-dz*Math.sin(a))<p.w/2+.6&&Math.abs(dx*Math.sin(a)+dz*Math.cos(a))<p.d/2+.6;
  });
}
export function dismountPoint(position,yaw,navigation,height){
  for(const [x,z]of [[1.25,0],[-1.25,0],[0,-1.5],[1.2,-1.3],[-1.2,-1.3]]){
    const point=new THREE.Vector3(position.x+x*Math.cos(yaw)+z*Math.sin(yaw),0,position.z-x*Math.sin(yaw)+z*Math.cos(yaw));
    point.y=height(point.x,point.z);
    if(Math.abs(point.y-position.y)<.7&&navigation.walkable(point.x,point.z,.32)&&navigation.segmentClear(position,point))return point;
  }
  return null;
}

export class MountController {
  constructor({scene,player,progress,avatar,world,navigation,canMount,message,onChange}){
    Object.assign(this,{scene,player,progress,avatar,world,navigation,canMount,message,onChange});this.mounted=false;this.horse=null;this.distance=0;
  }
  toggle(){return this.mounted?this.dismount():this.mount();}
  mount(){
    const id=this.progress.data.activeMount;
    if(!id||!this.progress.data.mounts.includes(id)){this.message('Nell sells horses at the southwest stables. Help Alden to earn your first.',5);return false;}
    if(!this.canMount()||!this.player.grounded||this.player.speed>.4){this.message('Stand still and finish your current action before mounting.',3);return false;}
    if(indoors(this.player.position)||!this.navigation.walkable(this.player.position.x,this.player.position.z,.85)){this.message('Find an open space outside to mount.',3);return false;}
    if(this.horse?.definition.id!==id){this.horse?.dispose();this.horse=createHorse({id});this.scene.add(this.horse.root);}
    this.mounted=true;this.player.mountOffset=this.horse.seatHeight-.94*this.avatar.root.scale.y;
    this.horse.root.visible=true;this.onChange?.(true);this.message(`${mountDefinition(id).name} · Shift to canter · H to dismount`,4);return true;
  }
  dismount(){
    if(!this.player.grounded){this.message('Wait until you land to dismount.',2);return false;}
    const point=dismountPoint(this.player.position,this.player.yaw,this.navigation,this.world.height);
    if(!point){this.message('There is no room to dismount here. Move into the open.',3);return false;}
    this.player.position.copy(point);this.reset();return true;
  }
  reset(){
    this.mounted=false;this.player.mountOffset=0;this.player.speed=0;this.player.velocity.set(0,0,0);
    if(this.horse)this.horse.root.visible=false;this.onChange?.(false);
  }
  canMoveTo(point){
    if(indoors(point))return false;
    // Test both ends of the barrel so the mount cannot push its body through a wall.
    for(const offset of [-.65,.75]){
      const x=point.x+Math.sin(this.player.yaw)*offset,z=point.z+Math.cos(this.player.yaw)*offset;
      if(!this.navigation.walkable(x,z,.42))return false;
      if(this.world.colliders.some(c=>(x-c.x)**2+(z-c.z)**2<(c.r+.42)**2))return false;
    }
    return true;
  }
  update(dt,state={}){
    if(!this.mounted)return;
    const {horse,player,avatar}=this;horse.root.position.copy(player.position);horse.root.rotation.y=player.yaw;
    horse.update(player.grounded?dt:0,player.speed);this.distance+=player.speed*dt;
    const offset=horse.seatHeight-.94*avatar.root.scale.y;
    player.mountOffset=offset;avatar.root.position.y+=offset+horse.body.position.y*.65;
    applyRiderPose(avatar,state);
  }
}
