import * as THREE from 'three';
import {WorldClock,dayLighting} from './world-clock.js';
import {createSky} from './sky.js';
import {LocalLightPool} from '../graphics/local-light-pool.js';

/** All flame meshes stay cheap; only the nearest eight emit real lights. */
export class DayNight {
  constructor({scene,sun,ambient,save}){
    Object.assign(this,{scene,sun,ambient});this.clock=new WorldClock(save);this.fixtures=new Set();this.time=0;this.selectionTime=0;
    this.localLights=new LocalLightPool(scene,8);this.pool=this.localLights.lights;
    this.daySky=new THREE.Color('#c9dfe2');this.duskSky=new THREE.Color('#876c85');this.nightSky=new THREE.Color('#111e37');
    this.sunDay=new THREE.Color('#fff0cb');this.sunDusk=new THREE.Color('#ffb478');this.moon=new THREE.Color('#98b5ec');
    this.ambientDay=new THREE.Color('#e5f0e1');this.groundDay=new THREE.Color('#6b8661');
    scene.add(sun.target);
  }
  register(fixtures){for(const f of fixtures)this.fixtures.add(f);this.localLights.invalidate();return ()=>{for(const f of fixtures)this.fixtures.delete(f);this.localLights.invalidate();};}
  async loadSky(camera){this.sky=await createSky(this.scene,camera);}
  update(dt,position){
    this.clock.update(dt);this.time+=dt;const {altitude,daylight,lamps}=dayLighting(this.clock.hour);
    this.scene.background.copy(this.nightSky).lerp(this.duskSky,Math.max(0,1-Math.abs(altitude)*5)).lerp(this.daySky,daylight);
    this.scene.fog?.color.copy(this.scene.background);
    this.daylight=daylight;this.sky?.update(this.clock.hour,this.time,daylight,this.scene.background);
    this.ambient.color.set('#aec8f0').lerp(this.ambientDay,daylight);this.ambient.groundColor.set('#303b51').lerp(this.groundDay,daylight);
    this.ambient.intensity=.43+1.22*daylight;this.sun.intensity=.24+1.86*daylight;
    this.sun.color.copy(this.moon).lerp(this.sunDusk,Math.min(1,daylight*3)).lerp(this.sunDay,Math.max(0,daylight*2-1));
    const angle=this.clock.hour/24*Math.PI*2;
    this.sun.position.set(position.x+Math.cos(angle)*14,position.y+12+Math.abs(altitude)*8,position.z+Math.sin(angle)*11);
    this.sun.target.position.copy(position);this.sun.target.updateMatrixWorld();
    for(const f of this.fixtures){
      const distance=f.position.distanceToSquared(position);if(f.root)f.root.visible=distance<220*220;
      if(f.flame){f.flame.visible=f.alwaysOn||lamps>.02;
      f.flame.scale.y=.88+Math.sin(this.time*9+(f.phase??0))*.1+Math.sin(this.time*17+(f.phase??0))*.06;}
      if(f.glow)f.glow.material.emissiveIntensity=lamps*.85;
    }
    this.localLights.update(this.fixtures,position,{dt,time:this.time,lamps});
  }
  stats(){return {day:this.clock.day,time:this.clock.label,night:this.clock.night,torches:this.fixtures.size,lights:this.pool.filter(l=>l.intensity>.025).length,lightSlots:this.pool.length};}
  dispose(){this.sky?.dispose();this.localLights.dispose();this.fixtures.clear();}
}
