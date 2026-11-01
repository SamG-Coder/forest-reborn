import test from 'node:test';
import assert from 'node:assert/strict';
import {METAL_IDS, METAL_RESOURCES} from '../src/gear/resources.js';
import {createGearRegistry} from '../src/gear/catalog.js';
import {resolveCoverage} from '../src/gear/coverage.js';
import {DEFAULT_VARIANT, VARIANT_COUNT, encodeVariant, decodeVariant, variantItemIds, garmentPartEnabled} from '../src/gear/variants.js';
import {saveOutfit, loadOutfit} from '../src/gear/outfit-storage.js';

test('six resources have distinct colours without changing the base rig or mask',()=>{
  const registry=createGearRegistry();assert.equal(METAL_IDS.length,6);
  assert.equal(new Set(Object.values(METAL_RESOURCES).map(m=>m.color)).size,6);
  const items=METAL_IDS.map(metal=>registry.get(encodeVariant({metal})+'/body'));
  for(const item of items){assert.equal(item.base,items[0].base);assert.equal(item.mask,items[0].mask);}
});

test('thousands of recipes round-trip exactly, without expanding the registry',()=>{
  const registry=createGearRegistry(),initial=registry.items.size,seen=new Set();
  const samples=[0,VARIANT_COUNT-1];
  for(let i=0;i<10000;i++)samples.push((i*467)%VARIANT_COUNT);
  for(const code of samples){
    const id=`look-v1-${code.toString(36)}`,spec=decodeVariant(id);
    assert.equal(encodeVariant(spec),id);seen.add(id);
    const items=variantItemIds(id).map(item=>registry.get(item));
    assert.equal(new Set(items.map(item=>item.slot)).size,items.length);
    assert.ok(items.every(item=>Object.isFrozen(item)&&Object.isFrozen(item.states)));
  }
  assert.ok(seen.size>=10000);assert.equal(registry.items.size,initial);
  for(const bad of ['look-v1--1','look-v1-00',`look-v1-${VARIANT_COUNT.toString(36)}`,'look-v2-0','look-v1-1junk/legs'])assert.throws(()=>decodeVariant(bad));
  assert.throws(()=>encodeVariant({states:{frontPanel:'off'}}));
  assert.throws(()=>encodeVariant({metal:'plastic'}));
});

test('disabled slots restore skin coverage, while cosmetic parts keep inherited masks',()=>{
  const registry=createGearRegistry(),full=encodeVariant(),off=encodeVariant({states:{helmet:false,frontPanel:false,belt:false,trim:false,shoulderLeft:false}});
  const before=resolveCoverage(variantItemIds(full).map(id=>registry.get(id)));
  const after=resolveCoverage(variantItemIds(off).map(id=>registry.get(id)));
  assert.notEqual(before.body,after.body);assert.throws(()=>registry.get(off+'/head'));
  const tunic=registry.get(off+'/clothes'),plate=registry.get(off+'/body');
  for(const part of ['panel-front','waist-belt','buckle','cuff-piping'])assert.equal(garmentPartEnabled(tunic,part),false);
  assert.equal(garmentPartEnabled(tunic,'panel-back'),true);
  assert.equal(garmentPartEnabled(tunic,'sewn-shell'),true);
  assert.equal(garmentPartEnabled(plate,'shoulder-L'),false);assert.equal(garmentPartEnabled(plate,'shoulder-R'),true);
  assert.equal(tunic.mask,registry.get(full+'/clothes').mask);
});

test('saved outfits validate all items and reject stale, corrupt and colliding slots',()=>{
  let value=null;const storage={setItem:(key,item)=>value=item,getItem:()=>value};
  const registry=createGearRegistry(),id=encodeVariant({...DEFAULT_VARIANT,metal:'copper'}),ids=variantItemIds(id);
  saveOutfit(storage,ids,'copper');assert.deepEqual(loadOutfit(storage,registry),{ids,metal:'copper'});
  saveOutfit(storage,[...ids,ids[0]],'copper');assert.equal(loadOutfit(storage,registry),null);
  saveOutfit(storage,['missing'],'copper');assert.equal(loadOutfit(storage,registry),null);
  value='not json';assert.equal(loadOutfit(storage,registry),null);
});
