import {Vector3, Quaternion, MathUtils} from 'three';

/** Pure, seekable camera track. Positions are in scene space; shots can cut or dolly. */
export class ShotTrack {
  constructor(shots) {
    this.shots = shots;
    if (!shots.length || shots.some(s => !(s.end > s.start))) throw new Error('Every shot needs a positive duration.');
  }
  sample(time) {
    const shot = this.shots.find(s => time >= s.start && time < s.end) ?? (time < this.shots[0].start ? this.shots[0] : this.shots.at(-1));
    let t = MathUtils.clamp((time - shot.start) / (shot.end - shot.start), 0, 1);
    if (shot.ease !== 'linear') t = t * t * (3 - 2 * t);
    const point = (a, b) => new Vector3(...a).lerp(new Vector3(...(b ?? a)), t);
    return {id: shot.id, scene: shot.scene, position: point(shot.from, shot.to), target: point(shot.look, shot.lookTo), fov: MathUtils.lerp(shot.fov ?? 43, shot.fovTo ?? shot.fov ?? 43, t)};
  }
  apply(camera, time, offset = null) {
    const shot = this.sample(time);
    if (offset) { shot.position.add(offset); shot.target.add(offset); }
    camera.up.set(0,1,0);camera.position.copy(shot.position); camera.lookAt(shot.target);
    if (camera.fov !== shot.fov) { camera.fov = shot.fov; camera.updateProjectionMatrix(); }
    return shot;
  }
}

/** Aim from an attachment's local frame, e.g. a held prop or vehicle dashboard. */
export function frameAttachment(camera,attachment,{position,target=[0,0,0],fov=40}){
  attachment.updateWorldMatrix(true,false);
  camera.up.set(0,1,0).applyQuaternion(attachment.getWorldQuaternion(new Quaternion()));
  camera.position.copy(attachment.localToWorld(new Vector3(...position)));
  camera.lookAt(attachment.localToWorld(new Vector3(...target)));
  camera.fov=fov;camera.updateProjectionMatrix();
}
