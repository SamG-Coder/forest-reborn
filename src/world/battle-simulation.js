import {mountedAttack,chargeContact} from '../mounts/combat.js';
import {createArrowShot,arrowHits,spendArrow,selectedArrow} from '../game/archery.js';
import {createBattleRoster,createBattleRosterAsync,createBattleProfiles} from '../npc/battle-roster.js';
import {resolveStrike} from '../game/combat-rules.js';
import {addStatus,tickStatuses} from '../game/status-effects.js';
import {yieldJob} from './async-jobs.js';

const STEP=.05,CELL=4,SPACING=.88;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));

/** Company orders run at 4 Hz; local steering and RPG combat run at 20 Hz.
 * Members keep their own identity, equipment, HP, target and attack clock.
 * Rendering is deliberately absent: HLOD cannot change a battle outcome. */
export class BattleSimulation {
  static async create(count,options={}){
    const profiles=options.profiles??createBattleProfiles(options.training,options.registry,{factions:options.factions});
    const roster=await createBattleRosterAsync(count,profiles,options);
    return new BattleSimulation(count,{...options,roster});
  }
  constructor(count=1000,{seed=3411,respawn=false,training=[0,0],registry,profiles,factions,cavalry=true,idPrefix='',height=()=>0,walkable=()=>true,roster:preparedRoster}={}){
    this.time=0;this.accumulator=0;this.hits=0;this.blocks=0;this.defeats=0;this.steps=0;this.perceptionChecks=0;
    this.height=height;this.walkable=walkable;
    this.projectiles=[];this.arrowsFired=0;this.charges=0;
    this.seed=seed>>>0;this.respawn=respawn;this.winner=null;this.cells=new Map();this.activeCells=[];this.damageQueue=[];
    const roster=preparedRoster??createBattleRoster(count,profiles??createBattleProfiles(training,registry,{factions}),{cavalry,idPrefix});
    this.actors=roster.units;this.byId=new Map(this.actors.map(a=>[a.id,a]));this.companies=roster.formations;this.profiles=roster.profiles;
    this.guests=new Map();this.savedFields=[...Object.keys(this.actors[0]),'pressure','deathRecorded','lastHitBy','statusEffects','slowFactor','hitDirection','lastImpact','severedPart','revengeUntil','revengeTarget'];
    this.claims=new Uint16Array(this.actors.length);this.guestClaims=new Map();this.alive=[count/2,count/2];this.initial=Math.floor(count/2);this.events=[];
  }
  random(){let x=this.seed+=0x6D2B79F5;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;}
  unit(id){return this.guests.get(id)??this.byId.get(id);}
  claim(id,amount){const unit=this.unit(id);if(!unit)return;if(unit.index!==undefined)this.claims[unit.index]=Math.max(0,this.claims[unit.index]+amount);else this.guestClaims.set(id,Math.max(0,(this.guestClaims.get(id)??0)+amount));}
  cellKey(x,z){return (Math.floor(x/CELL)+32768)*65536+Math.floor(z/CELL)+32768;}
  rebuild(){
    for(const cell of this.activeCells)cell.length=0;this.activeCells.length=0;this.alive=[0,0];this.claims.fill(0);this.guestClaims.clear();
    for(const a of this.actors)if(a.hp>0){
      this.alive[a.team]++;this.claim(a.opponent,1);
      const key=this.cellKey(a.x,a.z);let cell=this.cells.get(key);if(!cell){cell=[];this.cells.set(key,cell);}if(!cell.length)this.activeCells.push(cell);cell.push(a.index);
    }
  }
  regroup(company,enemy){
    if(company.order==='rout'||company.engaged||company.alive>15)return false;
    if(enemy&&Math.hypot((enemy.cx??enemy.x)-company.cx,(enemy.cz??enemy.z)-company.cz)<14)return false;
    const candidates=this.companies.filter(c=>c!==company&&c.team===company.team&&c.order!=='rout'&&c.order!=='regroup'&&c.alive>company.alive&&c.alive+company.alive<=100);
    const score=c=>Math.hypot((c.cx??c.x)-company.cx,(c.cz??c.z)-company.cz)+(c.role===company.role?0:15);
    const leader=candidates.sort((a,b)=>score(a)-score(b))[0];
    if(!leader||score(leader)>100)return false;
    company.order='regroup';company.regroupTarget=leader.id;
    company.goalX=(leader.cx??leader.x)-Math.sin(leader.yaw)*5;company.goalZ=(leader.cz??leader.z)-Math.cos(leader.yaw)*5;
    if(Math.hypot(company.cx-company.goalX,company.cz-company.goalZ)>8)return true;
    const survivors=company.members.filter(id=>this.actors[id].hp>0);
    for(const id of survivors){const a=this.actors[id];a.squad=leader.id;a.slot=leader.members.length;leader.members.push(id);a.opponent=-1;}
    company.members=company.members.filter(id=>this.actors[id].hp<=0);company.initial-=survivors.length;
    leader.initial+=survivors.length;leader.alive+=survivors.length;company.alive=0;company.order='joined';company.mergedInto=leader.id;
    this.events.push({type:'regroup',company:company.id,into:leader.id,count:survivors.length});return true;
  }
  command(){
    for(const c of this.companies){
      const living=c.members.filter(i=>this.actors[i].hp>0);c.alive=living.length;c.engaged=0;
      if(!living.length){c.order=c.mergedInto!==undefined?'joined':'defeated';continue;}
      let x=0,z=0,pressure=0;
      living.forEach((id,index)=>{const a=this.actors[id];a.slot=index;x+=a.x;z+=a.z;pressure+=a.pressure??0;if(a.strike)c.engaged++;});
      c.cx=x/living.length;c.cz=z/living.length;
      const desired=clamp(.35+.65*c.alive/c.initial-pressure/living.length,.02,1);c.morale+=clamp(desired-c.morale,-.06,.015);
      const enemy=this.companies.filter(e=>e.team!==c.team&&e.alive>0&&e.order!=='rout').sort((a,b)=>Math.hypot((a.cx??a.x)-c.cx,(a.cz??a.z)-c.cz)-Math.hypot((b.cx??b.x)-c.cx,(b.cz??b.z)-c.cz))[0];
      if(this.regroup(c,enemy))continue;
      if(!enemy){c.order='hold';continue;}c.enemy=enemy.id;
      if(c.morale<.30&&c.order!=='rout'){c.order='rout';c.routedAt=this.time;this.events.push({type:'rout',company:c.id});}
      if(c.order==='rout'){
        c.goalX=c.homeX+c.side*22;c.goalZ=c.homeZ;
        if(this.time-c.routedAt>14&&c.alive>c.initial*.3&&Math.hypot(c.cx-enemy.x,c.cz-enemy.z)>20&&c.rallies<1){c.rallies++;c.morale=.6;c.order='advance';}
        continue;
      }
      if(c.role==='reserve'&&this.time<12+c.id%3*2){c.order='reserve';c.goalX=c.homeX;c.goalZ=c.homeZ;continue;}
      if(c.role==='flank'&&(c.flankLeg??0)<2){
        const sign=c.flankSide||1,leg=c.flankLeg??0;c.order='flank';c.goalX=leg===0?c.side*8:-c.side*12;c.goalZ=(c.bandZ??0)+sign*61;
        if(Math.hypot(c.cx-c.goalX,c.cz-c.goalZ)<5)c.flankLeg=leg+1;
        continue;
      }
      const ex=enemy.cx??enemy.x,ez=enemy.cz??enemy.z,dx=ex-c.cx,dz=ez-c.cz,d=Math.hypot(dx,dz)||1;
      if(c.role==='archer'){
        c.goalX=ex-dx/d*21;c.goalZ=ez-dz/d*21;c.order=d<27?'volley':'advance';c.desiredYaw=Math.atan2(dx,dz);continue;
      }
      c.goalX=ex-dx/d*7.1;c.goalZ=ez-dz/d*7.1;c.order=d<14?'engage':'advance';
      c.desiredYaw=Math.atan2(dx,dz);
    }
  }
  nearest(a){
    let best=-1,bestScore=Infinity,checks=0;const cx=Math.floor(a.x/CELL),cz=Math.floor(a.z/CELL);
    const rangeSq=a.attack.ranged?a.reach*a.reach:42.25;
    const score=(b,d,claims)=>d+Math.max(0,claims-1)*9+(b.squad===this.companies[a.squad].enemy?0:4)-(a.revengeTarget===b.id&&a.revengeUntil>this.time?8:0);
    for(const b of this.guests.values())if(b.hp>0&&(b.team!==a.team||a.revengeTarget===b.id&&a.revengeUntil>this.time)){const d=(b.x-a.x)**2+(b.z-a.z)**2,s=score(b,d,this.guestClaims.get(b.id)??0);if(d<rangeSq&&s<bestScore){bestScore=s;best=b.id;}}
    if(a.attack.ranged){
      const company=this.companies[this.companies[a.squad].enemy];
      for(const id of company?.members??[]){const b=this.actors[id];if(b.hp<=0)continue;const d=(b.x-a.x)**2+(b.z-a.z)**2,s=score(b,d,this.claims[id]);this.perceptionChecks++;if(d<rangeSq&&s<bestScore){bestScore=s;best=b.id;}}
      return best;
    }
    for(let ox=-2;ox<=2;ox++)for(let oz=-2;oz<=2;oz++){
      const cell=this.cells.get((cx+ox+32768)*65536+cz+oz+32768);if(!cell)continue;
      for(const id of cell){const b=this.actors[id];if(b.team===a.team)continue;this.perceptionChecks++;if(++checks>64)return best;
        const d=(b.x-a.x)**2+(b.z-a.z)**2;if(d>42.25)continue;
        const s=score(b,d,this.claims[id]);
        if(s<bestScore){bestScore=s;best=b.id;}
      }
    }
    return best;
  }
  steering(a,vx,vz){
    const cx=Math.floor(a.x/CELL),cz=Math.floor(a.z/CELL);let checked=0,sx=0,sz=0;
    for(let ox=-1;ox<=1;ox++)for(let oz=-1;oz<=1;oz++){
      const cell=this.cells.get((cx+ox+32768)*65536+cz+oz+32768);if(!cell)continue;
      for(const id of cell){if(id===a.index)continue;const b=this.actors[id],dx=a.x-b.x,dz=a.z-b.z,d2=dx*dx+dz*dz;if(d2>2.56)continue;
        if(++checked>24)break;
        const spacing=a.mounted||b.mounted?1.5:SPACING;
        const d=Math.sqrt(d2)||.001,px=dx+(vx-b.vx)*.22,pz=dz+(vz-b.vz)*.22,pd=Math.hypot(px,pz);
        if(d<spacing){const force=(spacing-d)*5;sx+=dx/d*force;sz+=dz/d*force;}
        else if(pd<spacing&&d<1.6){const force=(spacing-pd)*2;sx+=dx/d*force;sz+=dz/d*force;}
      }
    }
    return [vx+clamp(sx,-2.5,2.5),vz+clamp(sz,-2.5,2.5)];
  }
  die(a,killer){
    if(this.guests.has(a.id))return;
    if(a.deathRecorded)return;a.hp=0;a.deathRecorded=true;a.deadAt=this.time;a.respawnAt=this.time+45;a.clip=0;a.speed=0;a.strike=null;this.defeats++;
    this.events.push({type:'death',unit:a.index,killer:killer?.id??null});
  }
  step(onHit){
    this.time+=STEP;this.steps++;this.damageQueue.length=0;
    this.projectiles=this.projectiles.filter(shot=>{if(this.time<shot.end)return true;const target=this.unit(shot.target);if(arrowHits(shot,target))this.damageQueue.push([this.unit(shot.source)?.index,shot.target,{damage:shot.damage,penetration:shot.penetration,type:'arrow'}]);return false;});
    for(const a of this.actors){a.previousX=a.x;a.previousZ=a.z;if(a.hp<=0&&!a.deathRecorded)this.die(a);
      if(a.hp<=0&&this.respawn&&this.time>=a.respawnAt){a.hp=a.maxHp;a.x=a.homeX;a.z=a.homeZ;a.opponent=-1;a.readyAt=this.time+1;a.deathRecorded=false;a.severedPart=null;a.statusEffects=[];}}
    this.rebuild();if(this.steps%5===1)this.command();
    const active=[0,0];for(const c of this.companies)if(c.order!=='rout')active[c.team]+=c.alive;
    this.winner=this.alive[0]===0||active[0]===0?1:this.alive[1]===0||active[1]===0?-1:null;
    for(const c of this.companies){
      if(!c.alive)continue;
      const dx=(c.goalX??c.x)-c.x,dz=(c.goalZ??c.z)-c.z,d=Math.hypot(dx,dz),speed=c.mounted?(c.order==='engage'?1.2:4.8):c.order==='rout'?2.8:c.order==='flank'?2.4:c.order==='engage'?.65:1.5;
      if(d>.1){const step=Math.min(d,speed*STEP);c.x+=dx/d*step;c.z+=dz/d*step;}
      const cx=c.cx??c.x,cz=c.cz??c.z,drag=Math.hypot(c.x-cx,c.z-cz);if(drag>3){c.x=cx+(c.x-cx)/drag*3;c.z=cz+(c.z-cz)/drag*3;}
      const yaw=c.order==='flank'||c.order==='rout'?Math.atan2(dx,dz):c.desiredYaw??c.yaw;c.yaw+=clamp(angle(yaw-c.yaw),-STEP,STEP);
    }
    for(const a of this.actors){
      if(a.hp<=0)continue;
      a.pressure=Math.max(0,(a.pressure??0)-STEP*.018);a.stamina=Math.min(100,a.stamina+STEP*(a.strike?4:12));
      if(a.statusEffects?.length)tickStatuses(a,this.time,(damage,type)=>{this.hits++;onHit(a,damage,this.unit(a.lastHitBy),type);if(a.hp<=0)this.die(a,this.unit(a.lastHitBy));});
      if(a.hp<=0)continue;
      const c=this.companies[a.squad],columns=Math.min(10,c.alive),rank=Math.floor(a.slot/columns),col=a.slot%columns,forwardX=Math.sin(c.yaw),forwardZ=Math.cos(c.yaw);
      const back=(rank-2)*(a.mounted?2.4:1.28),across=(col-(columns-1)/2)*(a.mounted?1.8:1.28),slotX=c.x-forwardX*back+forwardZ*across,slotZ=c.z-forwardZ*back-forwardX*across;
      let b=this.unit(a.opponent);
      if(this.time>=a.decideAt||b?.hp<=0){
        if(!b||b.hp<=0||Math.hypot(b.x-a.x,b.z-a.z)>a.reach+2){this.claim(a.opponent,-1);a.opponent=this.nearest(a);this.claim(a.opponent,1);}
        a.decideAt=this.time+.65+(a.index%5)*.07;b=this.unit(a.opponent);
      }
      const ranged=a.attack.ranged,routed=c.order==='rout',d=b?Math.hypot(b.x-a.x,b.z-a.z):Infinity,canEngage=!routed&&c.order!=='reserve'&&d<(ranged?a.reach:6.5)&&(ranged||Math.hypot(a.x-slotX,a.z-slotZ)<5);
      let gx=slotX,gz=slotZ;
      if(canEngage){const dx=b.x-a.x,dz=b.z-a.z,length=d||1,pass=a.mounted&&this.time>=a.chargeReadyAt&&a.speed>3.5;gx=b.x-dx/length*(pass?-3:a.reach*.82);gz=b.z-dz/length*(pass?-3:a.reach*.82);if(ranged&&d>7&&d<a.reach*.92){gx=a.x;gz=a.z;}}
      let dx=gx-a.x,dz=gz-a.z,distance=Math.hypot(dx,dz),limit=a.mounted?(canEngage?5.5:6.8):routed?3.4:c.order==='flank'?2.7:canEngage?2.1:1.8;
      if(this.winner&&c.order!=='regroup')limit=0;limit*=a.slowFactor??1;
      let velocity=distance>.1?Math.min(limit,distance*3):0;if(a.strike&&d<a.reach&&!a.mounted)velocity*=.12;
      let [vx,vz]=this.steering(a,distance?dx/distance*velocity:0,distance?dz/distance*velocity:0);
      const slope=Math.abs(this.height(a.x+vx*STEP,a.z+vz*STEP)-this.height(a.x,a.z))/(Math.hypot(vx,vz)*STEP||1);
      const terrainScale=slope>.7?0:1/(1+slope*(a.mounted?3:1.5));vx*=terrainScale;vz*=terrainScale;
      if(!this.walkable(a.x+vx*STEP,a.z+vz*STEP)){
        const turn=a.index%2?1:-1;
        if(this.walkable(a.x-vz*STEP*turn,a.z+vx*STEP*turn)){const old=vx;vx=-vz*turn;vz=old*turn;}
        else if(this.walkable(a.x+vx*STEP,a.z))vz=0;
        else if(this.walkable(a.x,a.z+vz*STEP))vx=0;
        else{vx=0;vz=0;}
      }
      const speed=Math.hypot(vx,vz);if(speed>limit&&speed){vx*=limit/speed;vz*=limit/speed;}
      a.vx+=clamp(vx-a.vx,-STEP*7,STEP*7);a.vz+=clamp(vz-a.vz,-STEP*7,STEP*7);
      // Acceleration smoothing must not carry a unit through the obstacle that
      // steering just avoided; once inside a trunk all exits can be blocked.
      if(!this.walkable(a.x+a.vx*STEP,a.z+a.vz*STEP)){a.vx=vx;a.vz=vz;}
      if(this.walkable(a.x+a.vx*STEP,a.z+a.vz*STEP)){a.x+=a.vx*STEP;a.z+=a.vz*STEP;}else{a.vx=0;a.vz=0;}
      a.speed=Math.hypot(a.vx,a.vz);
      if(a.mounted&&b?.hp>0&&this.time>=a.chargeReadyAt){
        const contact=chargeContact({x:a.previousX,z:a.previousZ},a,b,{speed:a.speed,weapon:a.attack,targetWeapon:b.attack,targetSpeed:b.speed,targetYaw:b.yaw});
        if(contact){a.chargeReadyAt=this.time+1.4;this.charges++;this.damageQueue.push([a.index,b.id,{damage:contact.damage,type:'charge'}]);if(contact.counter&&b.index!==undefined)this.damageQueue.push([b.index,a.id,{damage:contact.counter,type:'brace'}]);}
      }
      const wanted=canEngage?Math.atan2(b.x-a.x,b.z-a.z):a.speed>.1?Math.atan2(a.vx,a.vz):c.yaw;a.yaw+=clamp(angle(wanted-a.yaw),-STEP*4.5,STEP*4.5);
      a.morale=c.morale;a.clip=a.speed>2?2:a.speed>.08?1:4;
      if(canEngage&&!a.strike&&d<=a.reach&&this.time>=a.readyAt&&a.stamina>=a.attack.cost&&(!ranged||selectedArrow(a))){
        a.strike={target:b.id,hit:false};a.attackAt=this.time;a.readyAt=this.time+a.stats.interval;a.stamina-=a.attack.cost;a.chargeSpeed=a.speed;a.strikes++;
      }
      if(a.strike){
        a.clip=3;const progress=(this.time-a.attackAt)/a.attack.duration;
        if(progress>=a.attack.hit&&!a.strike.hit){
          a.strike.hit=true;
          if(ranged){const target=this.unit(a.strike.target),arrow=spendArrow(a);if(target?.hp>0&&arrow){this.arrowsFired++;this.projectiles.push(createArrowShot({...a,y:this.height(a.x,a.z)},target,{time:this.time,speed:a.attack.projectileSpeed,damage:a.damage,arrow}));}}
          else this.damageQueue.push([a.index,a.strike.target]);
        }
        if(progress>=1)a.strike=null;
      }else if(this.time-a.blockAt<.42)a.clip=4;
    }
    for(const [attackerId,targetId,impact]of this.damageQueue){
      const a=this.actors[attackerId],b=this.unit(targetId);if(!a||!b||b.hp<=0||a.hp<=0&&impact?.type!=='arrow'||!impact&&Math.hypot(a.x-b.x,a.z-b.z)>a.reach+.001)continue;
      const attackDamage=impact?.damage??mountedAttack({...a.attack,damage:a.damage},{mounted:a.mounted,speed:a.chargeSpeed??0}).damage;
      if(b.receive){const before=b.hp;b.receive(attackDamage,a,impact?.penetration??0);if(b.hp<before){this.hits++;onHit(b,before-b.hp,a,impact?.type??'strike');}continue;}
      const facing=angle(Math.atan2(a.x-b.x,a.z-b.z)-b.yaw),hit=resolveStrike({damage:attackDamage,defender:b.stats,facing,stamina:b.stamina,random:()=>this.random(),penetration:impact?.penetration??0});
      if(hit.blocked){b.stamina-=hit.staminaCost;b.blockAt=this.time;this.blocks++;this.events.push({type:'block',unit:b.id});continue;}
      const dealt=Math.min(hit.damage,b.hp);b.hp-=dealt;b.lastHitBy=a.id;b.pressure=(b.pressure??0)+(Math.abs(facing)>1.8?.16:.015);this.hits++;onHit(b,dealt,a,impact?.type??'strike');
      addStatus(b,a.attack.effect,this.time);if(b.hp<=0)this.die(b,a);
    }
    if(this.events.length>2048)this.events.splice(0,this.events.length-2048);
  }
  advanceStrategic(seconds){
    // No transforms, animation, raycasts or per-frame steering outside an active zone.
    // Losses affect the very same soldiers that will be rendered on re-entry.
    if(this.winner)return;
    this.time+=seconds;this.rebuild();this.command();
    if(this.time<35)return;
    for(const company of this.companies){
      if(!company.alive||company.order==='rout')continue;
      const enemy=this.companies[company.enemy];if(!enemy?.alive)continue;
      const fighters=company.members.map(i=>this.actors[i]).filter(a=>a.hp>0);
      const targets=enemy.members.map(i=>this.actors[i]).filter(a=>a.hp>0);
      if(!targets.length||!fighters.length)continue;
      const ready=fighters.filter(a=>!a.attack.ranged||selectedArrow(a));if(!ready.length)continue;
      const frontage=Math.min(10,ready.length),attacker=ready[Math.floor(this.random()*ready.length)];
      let damage=frontage*seconds*attacker.damage/attacker.stats.interval*.14;
      if(attacker.attack.ranged){
        let releases=0;
        for(const archer of ready.filter(a=>a.attack.ranged).slice(0,frontage)){
          const count=Math.min(8,Math.max(1,Math.floor(seconds/archer.stats.interval)));
          for(let i=0;i<count;i++)if(spendArrow(archer))releases++;else break;
        }
        this.arrowsFired+=releases;damage=releases*attacker.damage*.14;
        if(!damage)continue;
      }
      for(const target of targets){
        const hit=resolveStrike({damage:Math.min(damage,attacker.damage),defender:target.stats,facing:0,stamina:target.stamina,random:()=>this.random()});
        if(hit.blocked){this.blocks++;damage-=attacker.damage;continue;}
        const amount=Math.min(target.hp,hit.damage);target.hp-=amount;this.hits++;damage-=attacker.damage;
        if(target.hp<=0)this.die(target,attacker);if(damage<=0)break;
      }
    }
    this.rebuild();this.command();
    const active=[0,0];for(const c of this.companies)if(c.order!=='rout')active[c.team]+=c.alive;
    this.winner=!active[0]?1:!active[1]?-1:null;
    this.events.length=0;
  }
  update(dt,onHit=()=>{}){if(!Number.isFinite(dt)||dt<=0)return;this.accumulator+=Math.min(dt,.25);while(this.accumulator+1e-9>=STEP){this.accumulator-=STEP;this.step(onHit);}}
  stats(){return {combatants:this.actors.length,alive:[...this.alive],companies:this.companies.length,routing:this.companies.filter(c=>c.order==='rout').length,hits:this.hits,blocks:this.blocks,defeats:this.defeats,steps:this.steps,perceptionChecks:this.perceptionChecks,winner:this.winner,time:this.time,arrowsFired:this.arrowsFired,charges:this.charges};}
  snapshot(){return {version:2,projectiles:this.projectiles,arrowsFired:this.arrowsFired,charges:this.charges,time:this.time,steps:this.steps,accumulator:this.accumulator,seed:this.seed,hits:this.hits,blocks:this.blocks,defeats:this.defeats,actors:this.actors.map(a=>Object.fromEntries(this.savedFields.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]))),companies:this.companies.map(c=>({...c,members:[...c.members]}))};}
  async snapshotAsync(){
    const saved={version:2,projectiles:structuredClone(this.projectiles),arrowsFired:this.arrowsFired,charges:this.charges,time:this.time,steps:this.steps,accumulator:this.accumulator,seed:this.seed,hits:this.hits,blocks:this.blocks,defeats:this.defeats,actors:[],companies:this.companies.map(c=>({...c,members:[...c.members]}))};
    for(let i=0;i<this.actors.length;i+=64){
      for(const a of this.actors.slice(i,i+64))saved.actors.push(structuredClone(Object.fromEntries(this.savedFields.filter(k=>a[k]!==undefined).map(k=>[k,a[k]]))));
      await yieldJob();
    }
    return saved;
  }
  restore(saved){if(saved?.version!==2||saved.actors?.length!==this.actors.length)return;this.projectiles=saved.projectiles??[];this.arrowsFired=saved.arrowsFired??0;this.charges=saved.charges??0;this.time=saved.time;this.steps=saved.steps??Math.round(saved.time/STEP);this.accumulator=saved.accumulator??0;this.seed=saved.seed;this.hits=saved.hits;this.blocks=saved.blocks;this.defeats=saved.defeats;saved.actors.forEach((a,i)=>Object.assign(this.actors[i],a));saved.companies.forEach((c,i)=>Object.assign(this.companies[i],c));this.rebuild();}
}
