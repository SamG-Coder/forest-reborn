# Character animation and weapon attachment

Research date: 2026-11-01. Applies to the current male rig and local Three.js demo.
This is an implementation specification, not a claim that the clip or constraint pipeline is already implemented.

## Findings from the current implementation

- `src/game/animation.js` generates every pose procedurally. It has no authored animation clips or animation mixer. Smoothing a procedural pose is not equivalent to an authored weight shift, anticipation, or recovery.
- `armPose` uses a fixed shoulder position, fixed segment lengths and +/-X rest directions. Actual rig segment offsets include Y components. Its targets also do not account for the animated chest/clavicle parent transform. This can produce hand placement errors when the torso twists.
- Sword geometry is attached directly to `handR` at (-0.035, 0, 0.012), rotated 0.15*pi about X. The handle centre is another -0.05 along sword Y. There is no explicit palm anchor or grip alignment constraint.
- All fingers, including both thumbs, receive the same curl amount for sword use. A grip needs separate finger joints and thumb opposition, and only the holding hand should take the sword grip pose.
- Combat damage uses a radius/cone test at a single progress threshold. It does not follow the blade's swept path. Visual swing and damage can disagree.

## Motion architecture

Use authored skeletal clips for the movement's character and timing, with procedural corrections layered afterward. Three.js supplies AnimationMixer, AnimationAction weights, crossfades, time scaling and additive blending. Its examples demonstrate both ordinary and additive skeletal blending. These are engine mechanisms; the proposed artistic choices below are our design decisions.

Recommended frame order:

1. Process input, movement collision and combat state.
2. Evaluate the locomotion clips with gait phase aligned across walk/run transitions.
3. Blend attack, guard and reaction tracks. Explicitly filter bone tracks for upper-body layers: Three.js actions do not provide a turnkey humanoid body mask.
4. Apply restrained additive breath, lean and aim adjustments.
5. Update world transforms; solve foot contact and pelvis correction where required.
6. Solve main arm reach in its animated parent's space, including the real rest vectors and lengths; apply the desired hand orientation separately.
7. Update transforms so the sword follows the right-hand socket.
8. If a weapon needs two hands, solve the left arm toward the sword's support-hand marker, with an elbow hint and blended constraint weight.
9. Update transforms again; sample blade base/tip for trails and swept hit detection.

The main hand owns the sword. The support hand follows it. Do not make the sword follow both hands, or let the support-hand solver move the sword and create a dependency loop.

## First animation set

| Set | Clips/poses | Quality checks |
| --- | --- | --- |
| Relaxed | idle, chill entry/loop/exit | Subtle breath, weight over supporting foot, no repeated large head sway |
| Locomotion | walk/run loops, start/stop | Contact foot stays planted; cadence follows movement; no knee snapping |
| Armed | ready idle, armed walk/run | Sword clears knees, floor and torso; wrist stays aligned |
| Sword | two alternating diagonal cuts, recovery | Distinct anticipation, fast strike, readable follow-through |
| Unarmed | left jab, right cross, guard | Shoulder and torso support each punch; other hand protects face |
| Defense | sword guard, unarmed guard, block impact | Different poses for weapon and fists; brief impact response |
| Reactions | stagger, dodge | Recovery transitions do not pop or leave limbs behind |

For anime timing, author strong silhouettes and clear anticipation followed by a fast strike and a longer settle. Do not reduce the renderer's frame rate to create that effect. Keep silhouette readability in front, side and gameplay camera views.

Prefer in-place locomotion for the present collision-driven controller. Record each clip's intended speed and scale playback moderately to match travel. Lock stance feet to world contact points when practical; release during swing. Root-motion attacks can come later, but their displacement must be swept through the movement collision system rather than applied independently of it.

Imported clips need bone-name mapping, unit scale and rest-pose alignment. SkeletonUtils.retargetClip supports mapping and local offsets, but is not automatic anatomical correction. Bake and inspect retargeted clips on this exact male body; preserve the accepted mesh and shoulder weights.

## Sword reference points and relative transforms

Coordinates use metres. Character +Y is up and +Z is forward. The current sword's blade points along its local +Y; preserve that convention in its asset metadata.

| Reference | Parent | Purpose |
| --- | --- | --- |
| rightPalmGrip | handR bone | Calibrated palm attachment transform, separate from the wrist pivot |
| primaryGrip | sword asset root | Centre and orientation of the closed main-hand grip |
| supportGrip | sword asset root | Optional second-hand target, only for a suitable two-hand handle |
| bladeBase | sword asset root | Start of cutting portion; collision/trail sample |
| bladeTip | sword asset root | End of cutting portion; collision/trail sample |
| edgeDirection | sword asset metadata | Defines cutting plane and blade roll |
| sheathMount | hips/equipment socket | Optional stowed weapon attachment |

For the existing primitive sword, primaryGrip is (0, -0.05, 0); bladeBase is (0, 0.055, 0); bladeTip is (0, 0.705, 0), derived from its actual geometry. These are asset-local markers, not final hand placement coordinates. The 0.15 m handle should remain a one-handed weapon; do not force an overlapping second-hand grip onto it.

The hand bone is a wrist pivot, not the centre of the palm. Calibrate rightPalmGrip against the closed fingers in the actual mesh. Store its position AND quaternion on the male rig, and store primaryGrip position AND quaternion with each weapon. Avoid one universal Euler rotation for every weapon.

With column-vector transforms, solve:

    weaponWorld = handWorld * palmSocketLocal * inverse(primaryGripLocal)

If the weapon is a child of the palm socket, its local matrix is simply inverse(primaryGripLocal). This aligns both grip position and orientation without compensating separately in each animation.

Debug display should show palm/primary/support grip axes, blade endpoints, wrist/knuckles, and elbow hint. Verify a closed grip from palm, back, side and underside views. Numerical grip alignment alone does not prove fingers wrap correctly.

## Adaptive combat

- Adapt target height and a limited facing angle during anticipation. Freeze or strongly limit tracking during the committed strike so enemies cannot pull the arm into impossible positions.
- Preserve the authored arc and body follow-through. Apply bounded aim/IK offsets rather than replacing the whole attack with a line to the target.
- Represent windup, active window, recovery and combo acceptance as action data. Keep damage and visual animation on the same action clock.
- Sweep blade base/tip between frames during the active window, accounting for blade radius and target volumes. Subdivide large angular steps; a single straight tip segment can miss the swept arc. Record targets already hit per swing.
- Punches use their corresponding fist contact region; sword damage is disabled while punching. The equipped weapon needs a deliberate stow/switch policy rather than remaining visible through a right punch.
- Keep defensive pose separate from block rules: facing, stamina and action state still decide whether a hit is blocked.

## Acceptance checks

1. Scrub every clip at contact, passing, windup, impact and recovery poses; inspect front/side/back and gameplay view.
2. Measure planted-foot drift and floor penetration throughout walk/run, including transitions.
3. Measure hand/socket grip positional and angular error through every armed state; visually inspect fingers and sword clearance.
4. Verify elbow bend continuity, wrist limits and shoulder deformation during torso twists and low/high attacks.
5. Repeat attacks at 30, 60 and 120 FPS, including skipped frames. One damage event per target per swing, consistent with blade contact.
6. Test interrupted attacks, queued combos, block release, stamina exhaustion and weapon switching.

## Primary sources

- Three.js AnimationMixer: https://threejs.org/docs/pages/AnimationMixer.html
- Three.js AnimationAction: https://threejs.org/docs/pages/AnimationAction.html
- Three.js blending example: https://threejs.org/examples/webgl_animation_skinning_blending.html
- Three.js additive blending example: https://threejs.org/examples/webgl_animation_skinning_additive_blending.html
- Three.js SkeletonUtils / retargetClip: https://threejs.org/docs/pages/module-SkeletonUtils
- Epic skeletal mesh sockets (engine-independent attachment principle): https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-sockets-in-unreal-engine
- Unity Two Bone IK (target, orientation, elbow hint and influence): https://docs.unity3d.com/Packages/com.unity.animation.rigging@1.2/manual/constraints/TwoBoneIKConstraint.html
