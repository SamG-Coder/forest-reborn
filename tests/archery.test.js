import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Group} from 'three';
import {CombatController} from '../src/game/combat.js';
import {spendArrow,selectedArrow} from '../src/game/archery.js';
import {PlayerProgress} from '../src/progression/save.js';
import {RECIPES,craftItem} from '../src/progression/recipes.js';
import {chargeContact} from '../src/mounts/combat.js';
import {weaponAction} from '../src/game/weapon-catalog.js';
import {BattleSimulation} from '../src/world/battle-simulation.js';
import {createBaseRig} from '../src/avatar/rig.js';
import {CharacterAnimator} from '../src/game/animation.js';
import {equipPracticeSword} from '../src/game/equipment.js';
import {NOCK_GRIP} from '../src/game/bow-model.js';

test('a bow consumes one arrow on release, resolves after flight, and can miss a moving target',()=>{
  const c=new CombatController({random:()=>1}),data={ammunition:{'arrow.iron':3}};c.weapon='weapon.shortbow';c.hasArrow=()=>selectedArrow(data);c.consumeArrow=()=>spendArrow(data);
  const player={id:'player',position:new Vector3(),yaw:0},target={id:'target',position:new Vector3(0,0,15),hp:100,height:1.8,aimHeight:1.35};c.target=target;
  assert.ok(c.request());c.update(1.02,player);assert.equal(data.ammunition['arrow.iron'],3);assert.equal(target.hp,100);
  c.update(.03,player);assert.equal(data.ammunition['arrow.iron'],2);assert.equal(target.hp,100);assert.equal(c.shots.length,1);
  c.update(.5,player);assert.equal(target.hp,70);c.update(.2,player);assert.ok(c.request());c.update(1.05,player);target.position.x=5;c.update(.5,player);assert.equal(target.hp,70);
  data.ammunition['arrow.iron']=0;c.update(.5,player);assert.equal(c.request(),false);
});
test('flax, wood and feathers craft a stave, an unstrung bow, string and ammunition without skipping parts',()=>{
  const p=new PlayerProgress({getItem:()=>null,setItem(){}});for(const [id,count]of Object.entries({wood:8,flax:12,feather:3}))p.addItem(id,count);
  const craft=id=>assert.ok(craftItem(p,RECIPES.find(r=>r.id===id)),id);
  for(let i=0;i<4;i++)craft('flax-fibre');craft('bow-stave');craft('unstrung-shortbow');
  assert.ok(p.hasItem('unstrungShortbow'));assert.equal(p.equipItem(p.data.bag.findIndex(s=>s?.id==='unstrungShortbow')),false);
  craft('bowstring');craft('shortbow');craft('arrow-shafts');craft('field-arrows');assert.ok(p.hasItem('weapon.shortbow'));assert.ok(p.hasItem('arrow.wood',12));assert.ok(p.data.skills.fletching.total>0);
});
test('fast swept contacts cause charge damage; a facing, stationary spear braces against a horse',()=>{
  const from={x:0,z:0},to={x:0,z:1},target={x:0,z:1.5},sword=weaponAction('sword'),spear=weaponAction('weapon.spear');
  assert.equal(chargeContact(from,to,target,{speed:2,weapon:sword}),null);
  const basic=chargeContact(from,to,target,{speed:7,weapon:sword}),lance=chargeContact(from,to,target,{speed:7,weapon:spear});assert.ok(lance.damage>basic.damage);
  const brace=chargeContact(from,to,target,{speed:7,weapon:spear,targetWeapon:spear,targetYaw:Math.PI,targetSpeed:0});assert.ok(brace.counter>spear.damage);assert.ok(brace.damage<lance.damage);
  assert.equal(chargeContact(from,to,{x:0,z:-1},{speed:7,weapon:sword}),null);
});
test('archer companies use finite ammunition and preserve arrows in flight across saves',()=>{
  const sim=new BattleSimulation(1000);for(let i=0;i<500;i++)sim.step(()=>{});
  assert.ok(sim.arrowsFired>0);assert.ok(sim.actors.some(a=>a.attack.ranged&&a.ammunition['arrow.iron']<60));
  const restored=new BattleSimulation(1000);restored.restore(sim.snapshot());assert.equal(restored.arrowsFired,sim.arrowsFired);assert.deepEqual(restored.projectiles,sim.projectiles);
});
test('the bow and its string are bound to opposite hands throughout draw and release',()=>{
  const root=new Group(),rig=createBaseRig(root),avatar={root,rig,equipment:new Map()},equipment=equipPracticeSword(avatar),animator=new CharacterAnimator(avatar);equipment.setWeapon('weapon.shortbow');
  assert.equal(equipment.sword.parent.name,'socket.leftBowGrip');assert.ok(root.getObjectByName('Linen bowstring').isSkinnedMesh);
  const string=root.getObjectByName('Linen bowstring'),nock=root.getObjectByName('Nocked arrow');
  for(let i=0;i<=40;i++){
    animator.update(1/60,{speed:0,weapon:'weapon.shortbow',action:{kind:'sword',side:'R',height:1.3,combo:0,progress:i/40}});root.updateMatrixWorld(true);rig.skeleton.update();
    // A full draw separates the wrists. The meaningful constraint is that the
    // string centre and arrow nock never leave the drawing hand.
    const expected=rig.bones.handR.localToWorld(new Vector3(...NOCK_GRIP));
    const centre=string.getVertexPosition(2,new Vector3()).add(string.getVertexPosition(3,new Vector3())).multiplyScalar(.5);string.localToWorld(centre);
    assert.ok(centre.distanceTo(expected)<.002);assert.ok(nock.getWorldPosition(new Vector3()).distanceTo(expected)<.0001);
    for(const side of ['L','R']){
      const shoulder=rig.bones['upperArm'+side].getWorldPosition(new Vector3()),hand=rig.bones['hand'+side].getWorldPosition(new Vector3());
      const length=rig.bones['forearm'+side].position.length()+rig.bones['hand'+side].position.length();
      assert.ok(hand.distanceTo(shoulder)<=length+.001);assert.ok(hand.toArray().every(Number.isFinite));
    }
  }
});
