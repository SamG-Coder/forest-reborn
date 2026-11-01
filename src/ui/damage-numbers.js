import {Vector3} from 'three';
import './damage-numbers.css';

/** Shared combat text for player and world combat. Store impact positions so
 * numbers stay at the hit when an actor moves, dies, or respawns. */
export class DamageNumbers {
  constructor(container,camera,observer){
    Object.assign(this,{container,camera,observer});this.active=[];this.serial=0;
  }
  show(target,value,kind='outgoing'){
    if(typeof value==='number'&&(!Number.isFinite(value)||value<=0))return;
    if(target.position.distanceTo(this.observer)>45)return;
    const position=target.position.clone().add(new Vector3(0,(target.height??1.3)+.2,0));
    const projected=position.clone().project(this.camera);
    if(projected.z<-1||projected.z>1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1)return;
    if(this.active.length>=80)this.active.shift().element.remove();
    const element=document.createElement('div');
    element.className=`combat-text ${kind}`;
    element.dataset.kind=kind;element.dataset.target=target.id??'player';
    element.textContent=typeof value==='number'?String(Math.ceil(value)):value;
    this.container.append(element);
    this.active.push({element,position,life:1.15,offset:(this.serial++%3-1)*18});
  }
  update(dt,width,height){
    for(let i=this.active.length-1;i>=0;i--){
      const number=this.active[i];number.life-=dt;number.position.y+=dt*.48;
      if(number.life<=0){number.element.remove();this.active.splice(i,1);continue;}
      const p=number.position.clone().project(this.camera);
      number.element.hidden=p.z<-1||p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1;
      number.element.style.left=`${(p.x*.5+.5)*width+number.offset}px`;
      number.element.style.top=`${(-p.y*.5+.5)*height}px`;
      number.element.style.opacity=Math.min(1,number.life*3);
    }
  }
}
