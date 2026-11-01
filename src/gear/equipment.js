import {buildGear} from './patterns.js';
import {bakeCoverage,applyCoverage,resolveCoverage,REGIONS,setSurfaceCoverage} from './coverage.js';
import {avatarCapsules} from './cloth.js';
import {createFittedHelmet,createCollarFacing} from './headwear.js';
import {GarmentDepthCollider} from './collision.js';

function topologyKey(geometry){
  let hash=2166136261;
  for(const index of geometry.index?.array??[])hash=Math.imul(hash^index,16777619)>>>0;
  return `${geometry.attributes.position.count}:${geometry.index?.count??0}:${hash}`;
}

/** This system targets the current male avatar. Legacy workshop gear is separate. */
export class LayeredEquipment {
  constructor(avatar,registry,materials){
    this.avatar=avatar;this.registry=registry;this.materials=materials;this.entries=new Map();
    this.bodyCoverage=bakeCoverage(avatar.body.geometry);this.maskCache=new Map();this.wind=2;this.simulate=true;
    const fitted=avatar.gearTemplates;
    this.templates={...materials.templates,helmet:fitted?{shell:fitted.helmet.shell.clone(),rim:fitted.helmet.rim.clone()}:createFittedHelmet(avatar.body.geometry),collarFacing:fitted?fitted.collarFacing.clone():createCollarFacing(avatar.body.geometry)};
    this.garmentCollider=new GarmentDepthCollider();
  }
  ids(){return [...this.entries.values()].map(e=>e.definition.id);}
  equip(id){const item=this.registry.get(id);this.apply([...this.ids().filter(other=>this.registry.get(other).slot!==item.slot),id]);}
  unequip(slot){this.apply(this.ids().filter(id=>this.registry.get(id).slot!==slot));}
  apply(ids){
    const items=ids.map(id=>this.registry.get(id)),slots=new Set();
    for(const item of items){if(slots.has(item.slot))throw new Error(`Slot collision: ${item.slot}`);slots.add(item.slot);}
    const staged=new Map();
    try{
      for(const item of [...items].sort((a,b)=>a.layer-b.layer)){
        const support=staged.get('clothes')?.meshes.find(mesh=>mesh.name.endsWith('.sewn-shell'))?.geometry??this.avatar.body.geometry;
        const entry=buildGear(this.avatar,item,this.materials.create(item),this.templates,support);
        entry.meshes.forEach((mesh,index)=>{const supportKey=item.slot==='necklace'?(staged.get('clothes')?.definition.base.id??'skin'):'';const key=`${item.base.id}:${this.avatar.bodyType}:${supportKey}:${index}:${topologyKey(mesh.geometry)}`;if(!this.maskCache.has(key))this.maskCache.set(key,bakeCoverage(mesh.geometry));mesh.userData.coverage=this.maskCache.get(key);});
        staged.set(item.slot,entry);
      }
    }catch(error){for(const entry of staged.values())entry.dispose();throw error;}
    for(const entry of this.entries.values())entry.dispose();this.entries=staged;
    const coverage=resolveCoverage(items);this.coverage=coverage;
    applyCoverage(this.avatar.body.geometry,this.bodyCoverage,coverage.body);
    setSurfaceCoverage(this.avatar.body,coverage.body);
    this.avatar.underwear.visible=!(coverage.body&REGIONS.pelvis);
    this.avatar.bodySystem?.updateCoverage(Boolean(coverage.body&REGIONS.chest));
    for(const entry of this.entries.values()){
      this.avatar.root.add(entry.group);
      for(const mesh of entry.meshes){const hidden=coverage.hidden.get(entry.definition.id);setSurfaceCoverage(mesh,hidden);applyCoverage(mesh.geometry,mesh.userData.coverage,hidden);mesh.visible=mesh.geometry.index.count>0&&mesh.userData.partEnabled!==false;}
      for(const patch of entry.patches)patch.reset();
    }
    this.avatar.hair?.setHeadwear(this.entries.get('head')?.definition??null);
  }
  update(dt){
    if(![...this.entries.values()].some(e=>e.patches.some(p=>p.enabled!==false)))return;
    this.avatar.root.updateMatrixWorld(true);this.avatar.rig.skeleton.update();
    const capsules=this.simulate?avatarCapsules(this.avatar):null;
    if(this.simulate)this.garmentCollider.update(this.entries.get('legs')?.meshes??[]);
    for(const entry of this.entries.values())for(const patch of entry.patches){
      if(patch.enabled===false)continue;
      if(this.simulate)patch.update(dt,capsules,this.wind,p=>this.garmentCollider.project(p,patch.side));else{patch.reset();patch.update(0);}
    }
  }
  stats(){const entries=[...this.entries.values()];return {items:entries.length,clothParticles:entries.reduce((n,e)=>n+e.patches.reduce((a,p)=>a+p.positions.length,0),0),maxStretch:Math.max(1,...entries.flatMap(e=>e.patches.map(p=>p.maxStretch()))),bodyTriangles:this.avatar.body.geometry.index.count/3};}
  dispose(){for(const entry of this.entries.values())entry.dispose();this.entries.clear();for(const geometry of Object.values(this.templates.helmet))geometry.dispose();this.templates.collarFacing.dispose();applyCoverage(this.avatar.body.geometry,this.bodyCoverage,0);setSurfaceCoverage(this.avatar.body,0);this.avatar.underwear.visible=true;}
}
