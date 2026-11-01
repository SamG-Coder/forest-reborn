import {Vector3} from 'three';
import './damage-numbers.css';

/** Frame-rate impact text. Distant formations combine short bursts of hits. */
export class DamageNumbers {
  constructor(container,camera,observer,{maxDistance=45}={}){
    Object.assign(this,{container,camera,observer,maxDistance});
    container.classList.add('damage-number-layer');this.active=[];this.pending=new Map();this.serial=0;this.projected=new Vector3();
  }
  show(target,value,kind='outgoing',{group=null,position=null,delay=.16,label='',team=null}={}){
    if(typeof value==='number'&&(!Number.isFinite(value)||value<=0))return;
    if(target.position.distanceTo(this.observer)>this.maxDistance)return;
    const anchor=position?.clone()??target.position.clone().add(new Vector3(0,(target.height??1.3)+.2,0));
    if(group!==null&&typeof value==='number'){
      const key=kind+':'+group,entry=this.pending.get(key);
      if(entry){entry.value+=value;entry.position.lerp(anchor,1/++entry.hits);}
      else this.pending.set(key,{target,kind,value,position:anchor,hits:1,delay,label,team});
      return;
    }
    this.spawn(target,value,kind,anchor,{label,team});
  }
  spawn(target,value,kind,position,{label='',team=null}={}){
    const projected=this.projected.copy(position).project(this.camera);
    if(projected.z<-1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1)return;
    if(this.active.length>=80)this.active.shift().element.remove();
    const element=document.createElement('div');
    element.className=`combat-text ${kind}`;
    element.dataset.kind=kind;element.dataset.target=target.npcId??target.id??'player';
    element.textContent=typeof value==='number'?label+Math.ceil(value):value;
    if(team!==null)element.dataset.team=team;
    element.style.opacity='0';this.container.append(element);
    this.active.push({element,position,age:0,duration:1.25,offset:(this.serial++%3-1)*14,opacity:kind==='world'?.82:1});
  }
  update(dt,width,height){
    for(const [key,pending]of this.pending){pending.delay-=dt;if(pending.delay<=0){this.spawn(pending.target,pending.value,pending.kind,pending.position,pending);this.pending.delete(key);}}
    for(let i=this.active.length-1;i>=0;i--){
      const number=this.active[i];number.age+=dt;
      if(number.age>=number.duration){number.element.remove();this.active.splice(i,1);continue;}
      const p=this.projected.copy(number.position).project(this.camera),life=number.age/number.duration;
      number.element.hidden=p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
      number.element.style.left=`${(p.x*.5+.5)*width+number.offset}px`;
      number.element.style.top=`${(-p.y*.5+.5)*height-12-36*life}px`;
      number.element.style.opacity=number.opacity*Math.min(1,number.age/.06)*Math.min(1,(1-life)/.65);
    }
  }
  clear(){for(const n of this.active)n.element.remove();this.active.length=0;this.pending.clear();}
}
