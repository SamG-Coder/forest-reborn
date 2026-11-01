import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {CombatController} from '../src/game/combat.js';
import {weaponAction} from '../src/game/weapon-catalog.js';
import {mountedAttack} from '../src/mounts/combat.js';

test('mounted strikes use real weapon costs, capped momentum and impact-time range checks',()=>{
  for(const weapon of ['sword','weapon.spear','weapon.greatsword']){
    const spec=weaponAction(weapon),mounted=mountedAttack(spec,{mounted:true,speed:100});
    assert.ok(mounted.damage<=Math.round(spec.damage*(spec.grip==='spear'?1.85:1.25)));assert.equal(mounted.interval,spec.interval);
    const combat=new CombatController({random:()=>1}),target={hp:1000,height:1.2,position:{x:0,y:0,z:spec.reach+.3}},player={position:{x:0,y:0,z:0},yaw:.4,speed:8};
    combat.weapon=weapon;combat.mounted=true;combat.target=target;combat.request('sword',null,8);
    assert.equal(combat.stamina,100-spec.cost);for(let i=0;i<120;i++)combat.update(1/60,player);
    assert.ok(target.hp<1000);assert.equal(player.yaw,.4,'a moving horse keeps its heading');
    combat.stamina=100;combat.request('sword');target.position.z=spec.reach+20;const hp=target.hp;
    for(let i=0;i<120;i++)combat.update(1/60,player);assert.equal(target.hp,hp);
  }
});

test('idle remnants join a larger friendly company without replacing any NPC identity or gear',()=>{
  const sim=new BattleSimulation(300),small=sim.companies[0],large=sim.companies[1];
  for(const a of sim.actors)if(a.team===1){a.x+=300;a.homeX+=300;}
  for(const c of sim.companies)if(c.team===1){c.x+=300;c.homeX+=300;}
  const survivors=small.members.slice(0,8).map(i=>sim.actors[i]),gear=survivors.map(a=>JSON.stringify(a.equipped));
  small.members.slice(8).forEach(i=>{sim.actors[i].hp=0;});
  for(const a of survivors){a.x=large.x-Math.sin(large.yaw)*5;a.z=large.z-Math.cos(large.yaw)*5;}
  sim.rebuild();sim.command();
  assert.ok(survivors.every(a=>a.squad===large.id));assert.equal(large.members.length,58);
  survivors.forEach((a,i)=>{assert.equal(sim.actors[a.id],a);assert.equal(JSON.stringify(a.equipped),gear[i]);});
  assert.equal(new Set(sim.companies.flatMap(c=>c.members)).size,300);assert.equal(sim.companies.reduce((n,c)=>n+c.initial,0),300);
  assert.ok(sim.events.some(e=>e.type==='regroup'&&e.count===8));
});

test('engaged remnants and hostile companies are never merged',()=>{
  const sim=new BattleSimulation(200),small=sim.companies[0];small.alive=5;small.cx=small.x;small.cz=small.z;small.engaged=1;
  assert.equal(sim.regroup(small,null),false);small.engaged=0;
  assert.equal(sim.regroup(small,{cx:small.x+2,cz:small.z}),false);
});
