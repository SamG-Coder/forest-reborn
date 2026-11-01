import * as THREE from 'three';

export const PRACTICE_SWORD_POINTS = Object.freeze({
  primaryGrip: [0, -.05, 0], bladeBase: [0, .055, 0], bladeTip: [0, .705, 0],
});
export const SWORD_GRIP=Object.freeze({position:Object.freeze([-.074,-.026,.002]),angle:-.45,radius:.014});

export function swordGripOrientation(){
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),SWORD_GRIP.angle)
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
}

/** Rig-specific palm frame. Sword +Y maps to the thumb side of this T-pose hand. */
export function attachSword(rig, sword) {
  const socket = new THREE.Object3D();
  socket.name = 'socket.rightPalmGrip';
  socket.position.fromArray(SWORD_GRIP.position);
  // Diagonal handle through the palm, rather than a perpendicular hammer grip.
  socket.quaternion.copy(swordGripOrientation());
  rig.bones.handR.add(socket);
  sword.position.set(0, .05, 0);
  sword.quaternion.identity();
  socket.add(sword);
  const markers = {};
  for (const [name, point] of Object.entries(PRACTICE_SWORD_POINTS)) {
    const marker = new THREE.Object3D();
    marker.name = `weapon.${name}`;
    marker.position.fromArray(point);
    sword.add(marker);
    markers[name] = marker;
  }
  sword.userData.markers = markers;
  sword.userData.socket = socket;
  return { socket, markers };
}
