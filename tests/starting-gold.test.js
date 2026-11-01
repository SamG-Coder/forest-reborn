import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerProgress} from '../src/progression/save.js';
import {denominations} from '../src/progression/currency.js';

test('new characters start with five gold; loading a save never replenishes spent money',()=>{
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  const progress=new PlayerProgress(storage);
  assert.deepEqual(denominations(progress.data.coins),{gold:5,silver:0,copper:0});
  assert.equal(progress.data.weapon,'unarmed');
  progress.data.coins=0;progress.save();
  assert.equal(new PlayerProgress(storage).data.coins,0);
});
