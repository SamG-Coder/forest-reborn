import {MathUtils} from 'three';
const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));

/** Consume before locomotion so steering and movement share this frame's heading. */
export function consumeMouseCamera(input,orbit,sensitivity=1){
  orbit.cameraYaw=angle(orbit.cameraYaw-input.lookX*.006*sensitivity);
  orbit.cameraPitch=MathUtils.clamp(orbit.cameraPitch+input.lookY*.004*sensitivity,-.15,1.15);
  orbit.cameraDistance=MathUtils.clamp(orbit.cameraDistance+input.zoom*.005,2,12);
  input.lookX=input.lookY=input.zoom=0;
}
export function updateMouseHeading(input,player,orbit,dt){
  if(input.steering)player.yaw=angle(orbit.cameraYaw+Math.PI);
  else if(input.turn){const turn=input.turn*1.9*dt;player.yaw=angle(player.yaw+turn);if(!input.freeLooking)orbit.cameraYaw=angle(orbit.cameraYaw+turn);}
}
export function followMovementHeading(input,player,orbit,dt){
  const move=input.movement;
  if(!input.steering&&!input.freeLooking&&(move.x||move.z))orbit.cameraYaw+=angle(player.yaw-Math.PI-orbit.cameraYaw)*(1-Math.exp(-dt*3));
}
export function movementDirection(movement,yaw){
  return {x:Math.sin(yaw)*movement.z-Math.cos(yaw)*movement.x,z:Math.cos(yaw)*movement.z+Math.sin(yaw)*movement.x};
}
