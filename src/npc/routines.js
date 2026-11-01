/** Each stop has an actual destination, facing and sustained activity. */
const stop=(x,z,seconds,action,label,face=0)=>({x,z,seconds,action,label,face});
export const JOB_ROUTES=Object.freeze({
  stablemaster:[stop(-29,28,30,'trade','Helping riders',Math.PI),stop(-31,33,16,'read','Checking the stable ledger',Math.PI),stop(-29,28,20,'watch','Watching the yard',Math.PI)],
  innkeeper:[stop(-19,-24,32,'serve','Serving breakfast'),stop(-12.5,-22,9,'carry','Collecting clean cups',Math.PI/2),stop(-15,-18.4,15,'wipe','Clearing a table',Math.PI),stop(-19,-24,24,'serve','Keeping the bar')],
  trader:[stop(10,4.2,36,'trade','Trading at the market',Math.PI),stop(14,4,12,'carry','Checking stock',Math.PI/2),stop(10,4.2,25,'trade','Waiting for customers',Math.PI)],
  smith:[stop(23,25.1,26,'hammer','Forging a blade',Math.PI),stop(26,24.4,10,'carry','Checking the forge',2.5),stop(23,25.1,22,'hammer','Dressing the edge',Math.PI),stop(19.5,26.1,12,'rest','Taking a breather')],
  herbalist:[stop(-22,24.1,24,'sort','Sorting herbs',Math.PI),stop(-19.5,25.1,12,'carry','Collecting a basket',Math.PI),stop(-23.2,24.1,22,'sort','Tying herb bundles',Math.PI),stop(-22,26.5,10,'rest','Resting hands')],
  vendor:[stop(-10,5,30,'trade','Selling produce',Math.PI),stop(-13.2,3.7,12,'carry','Unpacking a crate',Math.PI/2),stop(-10,5,24,'sort','Sorting vegetables',Math.PI)],
  courier:[stop(4,0,8,'read','Checking deliveries'),stop(10,4.3,12,'carry','Delivering a parcel',Math.PI),stop(0,-33,8,'read','Checking the address'),stop(-19,-10.5,10,'carry','Delivering to the tavern',Math.PI)],
  captain:[stop(-4,-39,25,'watch','Watching the north road',Math.PI),stop(-4,-44,12,'watch','Checking the gate',Math.PI),stop(4,-37,15,'read','Reviewing the watch',-Math.PI/2),stop(-4,-39,18,'watch','Waiting for reports',Math.PI)],
});
export function guardRoute(index){
  const side=index%2?1:-1,z=index<2?-39:29;
  return [stop(side*5,z,18,'watch','Watching the road',index<2?Math.PI:0),stop(side*5,index<2?-29:10,6,'watch','Checking the lane',side*Math.PI/2),stop(side*6,z+2,8,'rest','Changing watch'),stop(side*5,z,14,'watch','On patrol',index<2?Math.PI:0)];
}
export class JobRoutine {
  constructor(stops,offset=0){this.stops=stops;this.index=offset%stops.length;this.elapsed=0;this.cycles=0;}
  get goal(){return this.stops[this.index];}
  update(dt,arrived){
    if(!arrived){this.elapsed=0;return;}
    this.elapsed+=dt;
    if(this.elapsed>=this.goal.seconds){this.elapsed=0;this.index=(this.index+1)%this.stops.length;if(this.index===0)this.cycles++;}
  }
}
