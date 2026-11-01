import {TownNavigation} from './navigation.js';

/** Small grids per inhabited area; never allocate a 4 km square path grid. */
export class NavigationAreas {
  constructor(obstacles) {this.areas=new Map();this.add('mosswake',obstacles,{x:0,z:0},150);}
  add(id,obstacles,origin,extent=150) {
    const local=obstacles.map(b=>({...b,minX:b.minX-origin.x,maxX:b.maxX-origin.x,minZ:b.minZ-origin.z,maxZ:b.maxZ-origin.z}));
    this.areas.set(id,{origin,extent,nav:new TownNavigation(local,extent)});
  }
  remove(id) {this.areas.delete(id);}
  point(p,area){return {x:p.x-area.origin.x,z:p.z-area.origin.z};}
  walkable(x,z,radius=.26){return [...this.areas.values()].every(a=>a.nav.walkable(x-a.origin.x,z-a.origin.z,radius));}
  segmentClear(start,end){return [...this.areas.values()].every(a=>a.nav.segmentClear(this.point(start,a),this.point(end,a)));}
  route(start,end){
    if(this.segmentClear(start,end))return [{x:end.x,z:end.z}];
    const area=[...this.areas.values()].find(a=>[start,end].every(p=>Math.abs(p.x-a.origin.x)<a.extent-2&&Math.abs(p.z-a.origin.z)<a.extent-2));
    return area?area.nav.route(this.point(start,area),this.point(end,area)).map(p=>({x:p.x+area.origin.x,z:p.z+area.origin.z})):[];
  }
}
