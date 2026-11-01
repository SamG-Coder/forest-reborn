import {PointLight,MathUtils} from 'three';

/** A fixed light count keeps Three.js shader variants stable while walking.
 * Slots fade to zero before changing fixtures; inactive slots remain visible
 * to the renderer with zero intensity, and never allocate shadow maps. */
export class LocalLightPool {
  constructor(scene,count=8){
    this.lights=Array.from({length:count},()=>{const light=new PointLight('#ffbc71',0,11,2);light.castShadow=false;scene.add(light);return light;});
    this.slots=this.lights.map(light=>({light,fixture:null,next:null}));this.nextSelection=0;
  }
  update(fixtures,position,{dt,time,lamps}){
    this.nextSelection-=dt;
    if(this.nextSelection<=0){
      const held=new Set(this.slots.map(s=>s.fixture));
      const chosen=[...fixtures].map(f=>({f,d:f.position.distanceToSquared(position)*(held.has(f)?.88:1)})).filter(p=>p.d<45*45).sort((a,b)=>a.d-b.d).slice(0,this.slots.length).map(p=>p.f);
      for(const slot of this.slots)slot.next=chosen.includes(slot.fixture)?slot.fixture:null;
      for(const f of chosen)if(!this.slots.some(s=>s.next===f)){const slot=this.slots.find(s=>!s.next);if(slot)slot.next=f;}
      this.nextSelection=.3;
    }
    for(const slot of this.slots){
      if(slot.fixture&&!fixtures.has(slot.fixture))slot.next=null;
      const f=slot.fixture,changing=f!==slot.next;
      const target=f&&!changing?(f.alwaysOn?1:lamps)*(f.power??4.2)*(1+Math.sin(time*9+(f.phase??0))*.07):0;
      slot.light.intensity=MathUtils.damp(slot.light.intensity,target,changing?18:7,Math.min(.1,Math.max(.001,dt)));
      if(changing&&slot.light.intensity<.025){slot.light.intensity=0;slot.fixture=slot.next;if(slot.fixture){slot.light.position.copy(slot.fixture.position);slot.light.distance=slot.fixture.range??11;}}
    }
  }
  invalidate(){this.nextSelection=0;}
  dispose(){for(const light of this.lights)light.removeFromParent();}
}
