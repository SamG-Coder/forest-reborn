import {Vector3} from 'three';

const SPACING=.76,SECTORS=16;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

/** Reserve stable places around a moving opponent. The ring is a movement
 * preference, not a hit requirement: combat still checks range at impact. */
export class CombatApproach {
  constructor(navigation,units){this.navigation=navigation;this.units=units;this.reservations=new Map();}
  update(now){for(const [id,slot]of this.reservations)if(slot.until<now)this.reservations.delete(id);}
  goal(unit,target,reach,now){
    const radius=Math.max(.85,reach-.55),previous=this.reservations.get(unit.id);
    const point=angle=>new Vector3(target.position.x+Math.sin(angle)*radius,target.position.y,target.position.z+Math.cos(angle)*radius);
    const slots=[...this.reservations.values()].filter(s=>s.actor!==unit.id&&s.target===target.id&&s.until>=now);
    const peers=this.units().filter(p=>p.id!==unit.id&&p.id!==target.id&&p.hp>0&&distance(p.position,target.position)<reach+2);
    const valid=p=>this.navigation.walkable(p.x,p.z)&&this.navigation.segmentClear(p,target.position);
    if(previous?.target===target.id){
      const p=point(previous.angle);
      if(valid(p)&&slots.every(s=>distance(p,point(s.angle))>.68)&&peers.every(other=>distance(p,other.position)>.6)){
        previous.until=now+1800;return p;
      }
    }
    let best=null,score=Infinity;
    for(let i=0;i<SECTORS;i++){
      const angle=i*Math.PI*2/SECTORS,p=point(angle);if(!valid(p))continue;
      const reservationPenalty=slots.reduce((sum,s)=>sum+Math.max(0,SPACING-distance(p,point(s.angle)))*40,0);
      const bodyPenalty=peers.reduce((sum,other)=>sum+Math.max(0,SPACING-distance(p,other.position))*12,0);
      const keep=previous?.target===target.id&&previous.index===i?-.8:0;
      const cost=distance(p,unit.position)+reservationPenalty+bodyPenalty+keep;
      if(cost<score){score=cost;best={p,angle,index:i};}
    }
    if(!best)return unit.position.clone();
    this.reservations.set(unit.id,{actor:unit.id,target:target.id,angle:best.angle,index:best.index,until:now+1800});
    return best.p;
  }
  crowded(unit){return this.units().some(p=>p.id!==unit.id&&p.hp>0&&distance(p.position,unit.position)<.6);}
}

/** Local separation also works when two actors have exactly the same position.
 * Resolve a small displacement; callers retain navigation collision checks. */
export function separatePosition(unit,position,units,limit=.14){
  const point={x:position.x,z:position.z};let dx=0,dz=0;
  for(const other of units){
    if(other.id===unit.id||other.hp<=0)continue;
    let x=point.x-other.position.x,z=point.z-other.position.z,d=Math.hypot(x,z);
    if(d>=SPACING)continue;
    if(d<.0001){x=String(unit.id)<String(other.id)?-1:1;z=.15;d=Math.hypot(x,z);}
    const force=(SPACING-Math.hypot(point.x-other.position.x,point.z-other.position.z))*.65;
    dx+=x/d*force;dz+=z/d*force;
  }
  const length=Math.hypot(dx,dz),scale=length>limit?limit/length:1;
  point.x+=dx*scale;point.z+=dz*scale;return point;
}
