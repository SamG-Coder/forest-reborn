/** Hysteresis prevents boundary thrashing. Late loads cannot resurrect a departed zone. */
export class ZoneStreamer {
  constructor(definitions,create) {
    this.create=create;this.zones=definitions.map(definition=>({definition,status:'dormant',wanted:false,generation:0,runtime:null,loads:0,error:null}));
  }
  update(position,dt=0) {
    for(const zone of this.zones){
      const d=zone.definition,distance=Math.hypot(position.x-d.x,position.z-d.z);
      const wanted=(d.enabled?.()??true)&&distance<=(zone.wanted?d.leave:d.enter);
      if(wanted!==zone.wanted){zone.wanted=wanted;zone.generation++;
        if(wanted)this.load(zone);
        else{zone.runtime?.dispose();zone.runtime=null;zone.status='dormant';}
      }
      if(zone.wanted&&zone.runtime)zone.runtime.update(dt,position);
    }
  }
  async load(zone) {
    // A rapid leave/re-enter must not let two factories register the same
    // navigation area, then have the older factory delete the newer one.
    if(zone.loading)return;
    zone.loading=true;
    const generation=zone.generation;zone.status='loading';zone.error=null;
    try{
      const runtime=await this.create(zone.definition);
      if(!zone.wanted||generation!==zone.generation){runtime.dispose();return;}
      zone.runtime=runtime;zone.status='active';zone.loads++;
    }catch(error){if(generation===zone.generation){zone.error=error.message;zone.status='failed';}}
    finally{zone.loading=false;if(zone.wanted&&generation!==zone.generation)this.load(zone);}
  }
  retry(id) {const zone=this.zones.find(z=>z.definition.id===id);if(zone?.wanted&&zone.status==='failed')this.load(zone);}
  get(id) {return this.zones.find(zone=>zone.definition.id===id)?.runtime;}
  stats() {return this.zones.map(z=>({id:z.definition.id,status:z.status,loads:z.loads,error:z.error,...z.runtime?.stats?.()}));}
  dispose(){for(const zone of this.zones){zone.wanted=false;zone.generation++;zone.runtime?.dispose();zone.runtime=null;zone.status='dormant';}}
}
