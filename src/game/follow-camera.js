import {Vector3,MathUtils} from 'three';

export const CAMERA_STORAGE_KEY='forest-reborn-camera-v1';
export const DEFAULT_CAMERA_SETTINGS=Object.freeze({fov:60,sensitivity:1,steady:true,shake:false});
export function cameraSettings(value={}){
  const number=(key,min,max)=>Number.isFinite(value[key])?MathUtils.clamp(value[key],min,max):DEFAULT_CAMERA_SETTINGS[key];
  return {fov:number('fov',45,85),sensitivity:number('sensitivity',.25,2),
    steady:typeof value.steady==='boolean'?value.steady:true,shake:typeof value.shake==='boolean'?value.shake:false};
}
export function loadCameraSettings(storage){
  try{return cameraSettings(JSON.parse(storage.getItem(CAMERA_STORAGE_KEY))??{});}catch{return cameraSettings();}
}

/** Translate the camera and its aim together, so following never rocks the horizon. */
export class FollowCamera {
  constructor(camera,height,settings=DEFAULT_CAMERA_SETTINGS){
    this.camera=camera;this.height=height;this.settings=cameraSettings(settings);
    this.focus=new Vector3();this.aim=new Vector3();this.offset=new Vector3();this.lastPosition=new Vector3();
    this.initialized=false;this.lift=0;this.time=0;this.distance=4.5;
  }
  setSettings(settings){this.settings=cameraSettings(settings);}
  reset(){this.initialized=false;this.lift=0;}
  update(dt,player,orbit,shake=0){
    const {camera,settings,focus,offset}=this;
    if(camera.fov!==settings.fov){camera.fov=settings.fov;camera.updateProjectionMatrix();}
    const ground=this.height(player.position.x,player.position.z);
    // Follow the ground, not the animated hips. Let a jump rise within the frame.
    const y=ground+1.12+(player.mountOffset??0)+(player.position.y-ground)*(settings.steady?.28:1);
    const snap=!this.initialized||this.lastPosition.distanceToSquared(player.position)>100;
    if(snap){focus.set(player.position.x,y,player.position.z);this.distance=orbit.cameraDistance;this.lift=0;}
    else{
      focus.x=player.position.x;focus.z=player.position.z;
      focus.y=MathUtils.lerp(focus.y,y,1-Math.exp(-dt*(settings.steady?7:14)));
      this.distance=MathUtils.lerp(this.distance,orbit.cameraDistance,1-Math.exp(-dt*14));
    }
    const radius=this.distance*Math.cos(orbit.cameraPitch);
    offset.set(Math.sin(orbit.cameraYaw)*radius,Math.sin(orbit.cameraPitch)*this.distance,Math.cos(orbit.cameraYaw)*radius);
    camera.position.copy(focus).add(offset);
    const clearance=this.height(camera.position.x,camera.position.z)+.45;
    const required=Math.max(0,clearance-camera.position.y);
    this.lift=snap?required:Math.max(required,MathUtils.lerp(this.lift,required,1-Math.exp(-dt*7)));
    camera.position.y+=this.lift;this.aim.copy(focus);this.aim.y+=this.lift;
    this.time+=dt;
    if(settings.shake&&!settings.steady&&shake>0){
      const x=Math.sin(this.time*41)*shake*.4,yShake=Math.sin(this.time*53)*shake*.3;
      camera.position.x+=x;camera.position.y+=yShake;this.aim.x+=x;this.aim.y+=yShake;
    }
    camera.lookAt(this.aim);camera.updateMatrixWorld();
    this.lastPosition.copy(player.position);this.initialized=true;
  }
}
