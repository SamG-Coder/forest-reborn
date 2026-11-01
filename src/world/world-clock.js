/** Simulation time belongs to the save, not the computer's wall clock. */
export class WorldClock {
  constructor(save, {daySeconds=2880}={}) {
    this.save=save;this.daySeconds=daySeconds;
    if(!Number.isFinite(save.dayTime))save.dayTime=8*3600;
  }
  update(dt){this.save.dayTime+=Math.max(0,dt)*86400/this.daySeconds;}
  get hour(){return (this.save.dayTime/3600)%24;}
  get day(){return Math.floor(this.save.dayTime/86400)+1;}
  get night(){return this.hour<6||this.hour>=20;}
  setHour(hour){if(!Number.isFinite(hour))return false;this.save.dayTime=Math.floor(this.save.dayTime/86400)*86400+((hour%24)+24)%24*3600;return true;}
  get label(){return `${String(Math.floor(this.hour)).padStart(2,'0')}:${String(Math.floor(this.hour%1*60)).padStart(2,'0')}`;}
}

export function dayLighting(hour){
  const altitude=Math.sin((hour-6)/24*Math.PI*2);
  const daylight=Math.max(0,Math.min(1,(altitude+.1)/.55));
  return {altitude,daylight,lamps:1-Math.max(0,Math.min(1,(altitude+.04)/.28))};
}
