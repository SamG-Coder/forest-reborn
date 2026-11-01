// The phone sits in front of an open palm. Its top follows the fingers (-X),
// while the screen faces away from the palm (-Y). No finger contact solver.
export const PHONE_ATTACHMENT = Object.freeze({
  width: .080, height: .158, depth: .009,
  position: Object.freeze([-.098, -.026, 0]),
  rotation: Object.freeze([Math.PI / 2, 0, Math.PI / 2]),
});

export function posePhoneHand(rig) {
  const b = rig.bones;
  for (const finger of ['index','middle','ring','little','thumb']) {
    for (let joint = 1; joint <= (finger === 'thumb' ? 2 : 3); joint++) b[`${finger}${joint}R`].quaternion.identity();
  }
}
