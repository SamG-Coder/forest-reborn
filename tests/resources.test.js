import test from 'node:test';
import assert from 'node:assert/strict';
import {ResourceLedger,sellInventory} from '../src/world/resources.js';

test('shared nodes require proximity, deplete and respawn once, and preserve their state',()=>{
  const ledger=new ResourceLedger(),node=ledger.nodes.find(n=>n.id==='herbs-1'),near={x:node.x,z:node.z},now=100000;
  assert.equal(ledger.harvest(node.id,{x:0,z:0},now),null);
  for(let i=0;i<3;i++)assert.equal(ledger.harvest(node.id,near,now),'herbs');
  assert.equal(ledger.harvest(node.id,near,now),null);assert.equal(node.remaining,0);
  const loaded=new ResourceLedger(ledger.snapshot());assert.equal(loaded.nodes.find(n=>n.id==='herbs-1').remaining,0);
  loaded.update(now+89999);assert.equal(loaded.nodes.find(n=>n.id==='herbs-1').remaining,0);loaded.update(now+90000);assert.equal(loaded.nodes.find(n=>n.id==='herbs-1').remaining,3);
});
test('selling transfers cargo into merchant stock and cannot sell it twice',()=>{
  const actor={coins:0,inventory:{herbs:3,iron:1}},stock={};assert.equal(sellInventory(actor,stock),14);assert.equal(sellInventory(actor,stock),0);
  assert.deepEqual(stock,{herbs:3,iron:1});assert.equal(actor.coins,14);
});
