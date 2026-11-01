import {roadEdgeDistance} from './layout.js';

const DIRECTIONS=[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]];
function intersects(x,z,tx,tz,box,radius=.3){
  let enter=0,leave=1;
  for(const [origin,delta,min,max] of [[x,tx-x,box.minX-radius,box.maxX+radius],[z,tz-z,box.minZ-radius,box.maxZ+radius]]){
    if(Math.abs(delta)<1e-9){if(origin<min||origin>max)return false;}
    else{let a=(min-origin)/delta,b=(max-origin)/delta;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);leave=Math.min(leave,b);if(enter>leave)return false;}
  }return true;
}

class MinHeap {
  constructor(){this.items=[];}
  push(value){let i=this.items.length;this.items.push(value);while(i>0){const p=(i-1)>>1;if(this.items[p].score<=value.score)break;this.items[i]=this.items[p];i=p;}this.items[i]=value;}
  pop(){const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.items[c+1].score<this.items[c].score)c++;if(this.items[c].score>=last.score)break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}
}
/** Weighted A*: doors and furniture block movement; roads cost less than lawns. */
export class TownNavigation {
  constructor(obstacles,extent=150,{deferGrid=false}={}){
    this.obstacles=obstacles;
    this.extent=extent;this.width=extent*2+1;
    if(!deferGrid)this.buildGrid();
  }
  buildGrid(){
    if(this.blocked)return;
    const {obstacles,extent}=this;this.blocked=new Uint8Array(this.width*this.width);
    this.edges=new Uint8Array(this.blocked.length);
    for(const box of obstacles)for(let z=Math.ceil(box.minZ-.3);z<=Math.floor(box.maxZ+.3);z++)for(let x=Math.ceil(box.minX-.3);x<=Math.floor(box.maxX+.3);x++){
      if(Math.abs(x)<=extent&&Math.abs(z)<=extent)this.blocked[this.index(x,z)]=1;
    }
    // Thin walls can fall entirely between grid centres. Block the crossing edges too.
    for(const box of obstacles)for(let z=Math.floor(box.minZ)-2;z<=Math.ceil(box.maxZ)+2;z++)for(let x=Math.floor(box.minX)-2;x<=Math.ceil(box.maxX)+2;x++){
      if(Math.abs(x)>extent||Math.abs(z)>extent)continue;
      DIRECTIONS.forEach(([dx,dz],bit)=>{if(intersects(x,z,x+dx,z+dz,box))this.edges[this.index(x,z)]|=1<<bit;});
    }
    this.cost=new Float32Array(this.blocked.length);
    for(let i=0;i<this.cost.length;i++){const {x,z}=this.point(i);this.cost[i]=1+Math.min(1,Math.max(0,roadEdgeDistance(x,z))/4)*1.6;}
  }
  index(x,z){return (z+this.extent)*this.width+x+this.extent;}
  point(index){return {x:index%this.width-this.extent,z:Math.floor(index/this.width)-this.extent};}
  walkable(x,z,radius=.26){return !this.obstacles.some(b=>x>b.minX-radius&&x<b.maxX+radius&&z>b.minZ-radius&&z<b.maxZ+radius);}
  segmentClear(a,b,ignoreGates=false){return !this.obstacles.some(box=>!(ignoreGates&&box.gateId)&&intersects(a.x,a.z,b.x,b.z,box,.28));}
  anchor(point){
    const x=Math.round(point.x),z=Math.round(point.z),candidates=[];
    for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
      const p={x:x+dx,z:z+dz};if(Math.abs(p.x)>this.extent||Math.abs(p.z)>this.extent)continue;
      if(!this.blocked[this.index(p.x,p.z)]&&this.segmentClear(point,p))candidates.push(p);
    }
    return candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.z-point.z)-Math.hypot(b.x-point.x,b.z-point.z))[0];
  }
  route(start,goal){
    this.buildGrid();
    const first=this.anchor(start),last=this.anchor(goal);if(!first||!last)return [];
    const from=this.index(first.x,first.z),to=this.index(last.x,last.z);
    if(this.blocked[to])return [];
    const parent=new Int32Array(this.blocked.length).fill(-2),distance=new Float64Array(parent.length).fill(Infinity),closed=new Uint8Array(parent.length),queue=new MinHeap();
    const goalX=to%this.width,goalZ=Math.floor(to/this.width);
    queue.push({index:from,score:0});parent[from]=-1;distance[from]=0;
    while(queue.items.length){
      const current=queue.pop().index;if(closed[current])continue;closed[current]=1;if(current===to)break;
      const x=current%this.width,z=Math.floor(current/this.width);
      for(let direction=0;direction<DIRECTIONS.length;direction++){
        const [dx,dz]=DIRECTIONS[direction];if(this.edges[current]&(1<<direction))continue;
        const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=this.width||nz>=this.width)continue;
        const next=nz*this.width+nx;if(closed[next]||this.blocked[next])continue;
        if(dx&&dz&&(this.blocked[z*this.width+nx]||this.blocked[nz*this.width+x]))continue;
        const cost=distance[current]+(dx&&dz?Math.SQRT2:1)*(this.cost[current]+this.cost[next])*.5;
        if(cost>=distance[next])continue;
        parent[next]=current;distance[next]=cost;queue.push({index:next,score:cost+Math.hypot(nx-goalX,nz-goalZ)});
      }
    }
    if(parent[to]===-2)return [];
    const path=[{x:goal.x,z:goal.z}];for(let i=to;i>=0;i=parent[i]){path.push(this.point(i));if(i===from)break;}path.reverse();
    // Remove collinear grid steps, retaining every obstacle-avoiding turn.
    return path.filter((point,i)=>i===0||i===path.length-1||(point.x-path[i-1].x)!==(path[i+1].x-point.x)||(point.z-path[i-1].z)!==(path[i+1].z-point.z));
  }
}
