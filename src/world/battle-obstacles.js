import {treePlacements} from './vegetation-placement.js';
import {CHUNK_SIZE} from './terrain.js';
import {yieldJob} from './async-jobs.js';
import {MUSTER_CAMPS} from './battle-sites.js';

export async function battleObstacles(site){
  const cells=new Map(),size=4,radius=site.radius+100;
  for(let z=Math.floor((site.z-radius)/CHUNK_SIZE);z<=Math.floor((site.z+radius)/CHUNK_SIZE);z++){
    for(let x=Math.floor((site.x-radius)/CHUNK_SIZE);x<=Math.floor((site.x+radius)/CHUNK_SIZE);x++){
      for(const t of treePlacements(x,z)){const key=Math.floor(t.x/size)+','+Math.floor(t.z/size);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);}
      await yieldJob();
    }
  }
  return (x,z)=>{x+=site.x;z+=site.z;const cx=Math.floor(x/size),cz=Math.floor(z/size);
    for(const camp of MUSTER_CAMPS)if(Math.abs(x-camp.x)<16&&Math.abs(z-camp.z)<11){
      for(let i=0;i<8;i++)if(Math.abs(x-(camp.x+(i%4-1.5)*7))<2.5&&Math.abs(z-(camp.z+(i<4?-7:7)))<2.5)return false;
    }
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const t of cells.get((cx+dx)+','+(cz+dz))??[])if((x-t.x)**2+(z-t.z)**2<(.32*t.s+.32)**2)return false;
    return true;
  };
}

/** Formation slots are suggestions: a trunk must never trap a newly loaded unit. */
export async function settleBattleSpawns(actors,walkable){
  for(let i=0;i<actors.length;i++){
    const actor=actors[i];
    if(actor.hp>0&&!walkable(actor.x,actor.z)){
      for(let j=1;j<=96;j++){
        const radius=.55*Math.sqrt(j),angle=j*2.399963+ i;
        const x=actor.x+Math.cos(angle)*radius,z=actor.z+Math.sin(angle)*radius;
        if(walkable(x,z)){actor.x=x;actor.z=z;actor.homeX=x;actor.homeZ=z;break;}
      }
    }
    if(i%64===0)await yieldJob();
  }
}
