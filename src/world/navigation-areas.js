import {TownNavigation} from './navigation.js';

/** Small grids per inhabited area; never allocate a 4 km square path grid. */
export class NavigationAreas {
  constructor(obstacles,{worker=typeof Worker!=='undefined'}={}) {
    this.areas=new Map();this.pending=new Map();this.sequence=0;this.revision=0;this.completed=0;
    if(worker){
      this.worker=new Worker(new URL('./navigation-worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{const job=this.pending.get(data.id);if(!job)return;this.pending.delete(data.id);this.completed++;job.resolve(data.error||data.revision!==this.revision?null:data.path);};
      this.worker.onerror=error=>{this.error=error.message;for(const job of this.pending.values())job.resolve(null);this.pending.clear();};
    }
    if(obstacles)this.add('mosswake',obstacles,{x:0,z:0},150);
  }
  add(id,obstacles,origin,extent=150) {
    const local=obstacles.map(b=>({...b,minX:b.minX-origin.x,maxX:b.maxX-origin.x,minZ:b.minZ-origin.z,maxZ:b.maxZ-origin.z}));
    this.areas.set(id,{origin,extent,nav:new TownNavigation(local,extent,{deferGrid:Boolean(this.worker)})});
    this.revision++;this.worker?.postMessage({kind:'add',id,obstacles,origin,extent});
  }
  remove(id) {this.areas.delete(id);this.revision++;this.worker?.postMessage({kind:'remove',id});}
  requestRoute(start,end){
    if(this.segmentClear(start,end))return Promise.resolve([{x:end.x,z:end.z}]);
    if(!this.worker)return Promise.resolve(this.route(start,end));
    if(this.error)return Promise.resolve(null);
    const id=++this.sequence;
    return new Promise(resolve=>{this.pending.set(id,{resolve});this.worker.postMessage({kind:'route',id,start:{x:start.x,z:start.z},end:{x:end.x,z:end.z},revision:this.revision});});
  }
  stats(){return {queued:this.pending.size,completed:this.completed,worker:Boolean(this.worker),error:this.error};}
  dispose(){this.worker?.terminate();for(const job of this.pending.values())job.resolve(null);this.pending.clear();}
  point(p,area){return {x:p.x-area.origin.x,z:p.z-area.origin.z};}
  walkable(x,z,radius=.26){return [...this.areas.values()].every(a=>a.nav.walkable(x-a.origin.x,z-a.origin.z,radius));}
  segmentClear(start,end,ignoreGates=false){return [...this.areas.values()].every(a=>a.nav.segmentClear(this.point(start,a),this.point(end,a),ignoreGates));}
  route(start,end){
    if(this.segmentClear(start,end))return [{x:end.x,z:end.z}];
    const area=[...this.areas.values()].find(a=>[start,end].every(p=>Math.abs(p.x-a.origin.x)<a.extent-2&&Math.abs(p.z-a.origin.z)<a.extent-2));
    if(area)return area.nav.route(this.point(start,area),this.point(end,area)).map(p=>({x:p.x+area.origin.x,z:p.z+area.origin.z}));
    // Join a local town route to the open road at its boundary. An off-grid
    // destination must not make a guard or traveller abandon the whole path.
    for(const a of this.areas.values()){
      const from=this.point(start,a),to=this.point(end,a),inside=p=>Math.abs(p.x)<a.extent-2&&Math.abs(p.z)<a.extent-2;
      if(inside(from)===inside(to))continue;
      const external=inside(from)?to:from,limit=a.extent-3;
      const boundary={x:Math.max(-limit,Math.min(limit,external.x)),z:Math.max(-limit,Math.min(limit,external.z))};
      const path=a.nav.route(inside(from)?from:boundary,inside(to)?to:boundary);
      if(!path.length)continue;
      const worldPath=path.map(p=>({x:p.x+a.origin.x,z:p.z+a.origin.z}));
      if(inside(from)&&this.segmentClear(worldPath.at(-1),end))return [...worldPath,{x:end.x,z:end.z}];
      if(inside(to)&&this.segmentClear(start,worldPath[0]))return worldPath;
    }
    return [];
  }
}
