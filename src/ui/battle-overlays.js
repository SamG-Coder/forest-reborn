import * as THREE from 'three';
import './battle-overlays.css';

/** Cursor-local company information. Picking and damage share the same radius;
 * neither depends on which geometry LOD is currently drawn. */
export class BattleOverlays {
  constructor({canvas,camera,scene,entities,companies,height,container=document.body}){
    Object.assign(this,{canvas,camera,scene,entities,companies,height});
    this.root=document.createElement('div');this.root.className='battle-overlays';container.append(this.root);
    this.cards=Array.from({length:4},()=>{const el=document.createElement('div');el.className='battle-cluster-card';el.hidden=true;this.root.append(el);return el;});
    this.hint=document.createElement('div');this.hint.className='battle-cluster-hint';this.hint.hidden=true;this.root.append(this.hint);
    this.ray=new THREE.Raycaster();this.pointer=null;this.down=false;this.selected=null;this.groups=[];this.members=new Set();this.radius=0;this.center=new THREE.Vector3();
    this.ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:64},()=>new THREE.Vector3())),new THREE.LineBasicMaterial({color:'#e6dca4',transparent:true,opacity:.65,depthWrite:false}));
    this.ring.visible=false;this.ring.frustumCulled=false;scene.add(this.ring);
    this.move=e=>{this.pointer={x:e.clientX,y:e.clientY};};this.leave=()=>{this.pointer=null;};this.press=()=>{this.down=true;};this.release=()=>{this.down=false;};
    canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerleave',this.leave);canvas.addEventListener('pointerdown',this.press);window.addEventListener('pointerup',this.release);
  }
  select(entity){this.selected=entity;}
  update({enabled=true}={}){
    this.groups=[];this.members.clear();this.cards.forEach(el=>el.hidden=true);this.hint.hidden=true;this.ring.visible=false;
    if(!enabled||this.down)return;
    const rect=this.canvas.getBoundingClientRect(),pointer=this.pointer;
    let hover=false;
    if(pointer){
      this.ray.setFromCamera(new THREE.Vector2((pointer.x-rect.left)/rect.width*2-1,1-(pointer.y-rect.top)/rect.height*2),this.camera);
      // Three cheap height refinements avoid raycasting every soldier/triangle.
      let y=this.height(this.camera.position.x,this.camera.position.z);
      for(let i=0;i<3;i++){
        const distance=(y-this.ray.ray.origin.y)/this.ray.ray.direction.y;
        if(!Number.isFinite(distance)||distance<0||distance>this.camera.far)break;
        this.ray.ray.at(distance,this.center);y=this.height(this.center.x,this.center.z);hover=true;
      }
      this.center.y=y;
      this.radius=THREE.MathUtils.clamp(this.center.distanceTo(this.camera.position)*2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*80/rect.height,3,42);
    }
    const groups=new Map(),r2=this.radius*this.radius;
    for(const a of this.entities){
      if(a.hp<=0||a.hidden)continue;const p=a.position;
      const inside=hover&&(p.x-this.center.x)**2+(p.z-this.center.z)**2<=r2;
      const pinned=a.squad===this.selected?.squad;
      if(!inside&&!pinned)continue;
      if(inside)this.members.add(a.id);
      let group=groups.get(a.squad);
      if(!group){group={company:this.companies[a.squad],position:new THREE.Vector3(),count:0,health:0,maxHealth:0,pinned};groups.set(a.squad,group);}
      group.position.add(p);group.count++;group.health+=a.hp;group.maxHealth+=a.maxHp;
    }
    const projected=new THREE.Vector3();
    for(const group of groups.values()){
      group.position.divideScalar(group.count);group.position.y+=3;
      projected.copy(group.position).project(this.camera);
      group.x=rect.left+(projected.x*.5+.5)*rect.width;group.y=rect.top+(-projected.y*.5+.5)*rect.height;
      if(projected.z>-1&&projected.z<1&&group.x>rect.left&&group.x<rect.right&&group.y>rect.top&&group.y<rect.bottom)this.groups.push(group);
    }
    this.groups.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.count-a.count);this.groups.length=Math.min(4,this.groups.length);
    const placed=[];
    this.groups.forEach((g,i)=>{
      const el=this.cards[i],c=g.company;el.hidden=false;el.dataset.team=c.team;el.classList.toggle('pinned',g.pinned);
      const text=`${g.pinned?'◆ ':''}${c.name}\n${g.count} here · ${c.alive}/${c.initial} standing · ${Math.round(c.morale*100)}% morale`;
      if(el.textContent!==text)el.textContent=text;
      let x=THREE.MathUtils.clamp(g.x,rect.left+125,rect.right-125),y=THREE.MathUtils.clamp(g.y,rect.top+80,rect.bottom-30);
      for(let attempt=0;attempt<6&&placed.some(p=>Math.abs(x-p.x)<260&&Math.abs(y-p.y)<58);attempt++)y-=58;
      y=Math.max(rect.top+80,y);placed.push({x,y});el.style.left=x+'px';el.style.top=y+'px';
    });
    if(hover&&this.members.size){
      this.hint.hidden=false;this.hint.textContent=`${this.members.size} nearby · ${Math.round(this.radius)} m radius`;
      this.hint.style.left=THREE.MathUtils.clamp(pointer.x+18,rect.left+8,rect.right-215)+'px';this.hint.style.top=Math.min(rect.bottom-35,pointer.y+24)+'px';
      const positions=this.ring.geometry.attributes.position;
      for(let i=0;i<64;i++){const a=i/64*Math.PI*2,x=this.center.x+Math.cos(a)*this.radius,z=this.center.z+Math.sin(a)*this.radius;positions.setXYZ(i,x,this.height(x,z)+.07,z);}positions.needsUpdate=true;this.ring.visible=true;
    }
  }
  damageOptions(entity){
    if(!this.members.has(entity.id)&&entity.squad!==this.selected?.squad)return null;
    const group=this.groups.find(g=>g.company.id===entity.squad);if(!group)return null;
    return {group:'company:'+entity.squad,position:group.position,delay:.35,label:'−',team:entity.team};
  }
  pick(x,y){
    const rect=this.canvas.getBoundingClientRect(),p=new THREE.Vector3();let best=25,result=null;
    for(const a of this.entities){if(!this.members.has(a.id)||a.hp<=0)continue;p.copy(a.position);p.y+=1;p.project(this.camera);const d=Math.hypot(rect.left+(p.x*.5+.5)*rect.width-x,rect.top+(-p.y*.5+.5)*rect.height-y);if(p.z>-1&&p.z<1&&d<best){best=d;result=a;}}
    return result;
  }
  dispose(){this.root.remove();this.ring.removeFromParent();this.ring.geometry.dispose();this.ring.material.dispose();this.canvas.removeEventListener('pointermove',this.move);this.canvas.removeEventListener('pointerleave',this.leave);this.canvas.removeEventListener('pointerdown',this.press);window.removeEventListener('pointerup',this.release);}
}
