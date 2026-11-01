const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

/** The raid owns identities and a journey, never a second set of spawned enemies. */
export function prepareExpedition(definition,raid,members){
  raid.members??=members.filter(t=>t.hp>0).map(t=>t.id);
  raid.fallen??=[];raid.phase??='forming';raid.waypoint??=0;
  raid.route??=[{x:definition.x,z:definition.z},...(definition.route??[]).map(([x,z])=>({x,z})),{x:definition.gate[0],z:definition.gate[1]}];
  return raid;
}

export function expeditionState(definition,raid,members,now){
  prepareExpedition(definition,raid,members);
  const roster=members.filter(t=>raid.members.includes(t.id));
  for(const t of roster)if(t.hp<=0&&!raid.fallen.includes(t.id))raid.fallen.push(t.id);
  const alive=roster.filter(t=>t.hp>0&&!raid.fallen.includes(t.id));
  if(!alive.length)return {finished:true,repelled:true,alive,centre:{x:definition.x,z:definition.z},radius:20};
  const centre={x:0,z:0};for(const t of alive){centre.x+=t.position.x/alive.length;centre.z+=t.position.z/alive.length;}
  const radius=Math.max(18,...alive.map(t=>distance(t.position,centre)+12));
  const fighting=alive.some(t=>t.combatTarget?.hp>0&&distance(t.position,t.combatTarget.position)<24);
  if(raid.phase!=='withdrawing'&&(now-raid.started>210||alive.length<=raid.members.length*.4)){raid.phase='withdrawing';raid.waypoint=Math.min(raid.waypoint,raid.route.length-1);}
  if(raid.phase==='forming'&&now-raid.started>=8){raid.phase='marching';raid.waypoint=1;}
  let goal=raid.route[raid.waypoint];
  const gathered=alive.filter(t=>distance(t.position,goal)<9).length>=Math.ceil(alive.length*.7);
  if(raid.phase==='withdrawing'){
    if(gathered&&raid.waypoint>0)goal=raid.route[--raid.waypoint];
    if(raid.waypoint===0&&gathered)return {finished:true,repelled:raid.fallen.length>raid.members.length*.5,alive,centre,radius};
  }else if(raid.phase!=='forming'){
    if(gathered&&!fighting&&raid.waypoint<raid.route.length-1)goal=raid.route[++raid.waypoint];
    raid.phase=fighting?'fighting':raid.waypoint===raid.route.length-1&&gathered?'raiding':'marching';
  }
  return {finished:false,alive,centre,radius,goal,phase:raid.phase};
}
