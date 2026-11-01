# Locomotion and combat animation implementation

Updated 2026-11-01. The runtime uses hand-authored pose curves and FK/IK constraints; it does not contain imported motion-capture clips.

## Current game behaviour (revision 17)

The playable game now uses two horizontal cuts: right-to-left forehand and a returning backhand. `src/game/sword-motion.js` owns their shared timing, blade directions and body turn. `sword-alignment.js` derives the hand/forearm frame from the fixed grip and constrains the elbow outside the torso. Both cuts keep the wrist neutral. A thrust remains available in the debug animation preview.

The MMO combat controller applies one distance-based hit at 43% of a normal 0.78-second sword action. Mesh contact is not a damage requirement. Pursuers use `src/npc/combat-approach.js` to reserve separate positions within range and recheck range/line of sight at impact. `src/ui/damage-numbers.js` displays actual health loss for player and world combat. Tab ordering is stable while cycling, even when auto-facing rotates the player.

Space jumps, 1/J toggles auto attack, and clicking an enemy selects it and enables attack. Block is a defensive reaction. The older direct-action controls and three-cut choreography described below are historical and have been superseded. Add `?debug=1` to `game.html` to show the animation preview controls.

Current checks: `tests/attack-grip.test.js`, `tests/hand-jump.test.js`, `tests/combat-update.test.js`, and `tools/check-combat-update.mjs`. The latter renders both full cut cycles and checks group chase spacing plus visible combat text in the actual game.

## Earlier implementation notes

## Research applied

- Animation Mentor's walk-cycle tutorial describes contact/down/passing/up poses, hip/chest opposition, shoulder-led arm swing and delayed forearm/wrist motion: https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/
- AnimSchool's run-cycle breakdown distinguishes contact/down/push/flight and emphasizes contrast between compression and extension: https://blog.animschool.edu/2024/04/10/the-key-poses-of-a-run-cycle/
- Rusty Animator's original arm-swing tutorial describes shoulder-driven arcs, elbow overlap and further wrist delay: https://rustyanimator.com/animation-walk-cycle/
- Yegian et al. studied gait-specific elbow behavior: walking generally uses straighter arms, running bent arms. This supports distinct arm poses, not a claim that one precise angle is universal: https://pubmed.ncbi.nlm.nih.gov/31289110/
- Riot's Yone development article describes contrasting quick blade attacks with broader arcs to communicate weight: https://www.leagueoflegends.com/en-us/news/dev/champion-insights-yone/
- Primary animator Adam Turnbull describes preserving an upright silhouette: https://vimeo.com/499757929 (text description consulted; no frame-by-frame reproduction of that reel).
- Jonathan Cooper's original Game Anim excerpt explains anticipation, overlap, arcs and responsive gameplay timing: https://www.gamedeveloper.com/production/the-12-principles-of-animation-in-video-games

Exact timings, joint angles and combo choreography are authored for this male rig; they are not measurements extracted from those references.

## Runtime ownership

- `src/game/locomotion.js`: independent walk/run contact schedules, pelvis rise/fall, lateral weight shift, heel/toe roll, and swing trajectories. The run has a flight phase and heel recovery; it is not a sped-up walk.
- `src/game/arm-motion.js`: shoulder-led free-arm FK; distinct walking/running elbow flexion; delayed elbow/wrist motion; three sword cuts. Monotone cubic interpolation preserves movement through impact without overshooting the authored angles.
- `src/game/animation.js`: body layers, support-leg reach correction, foot grounding, bounded pose adaptation, grip poses and state transitions. FK owns locomotion arms and sword wrist alignment. IK owns foot placement, punch reach and selected guard/chill targets.
- `src/game/constraints.js`: analytic two-bone solver using actual segment lengths and animated parent transforms.
- `src/game/weapon-sockets.js`: right-palm socket, primary grip, blade base/tip. Grip data is separate from the item mesh and animation.
- `src/game/combat.js`: input buffer, three-cut timing, directional defense, stamina, hit events. A queued cut branches after the active window rather than waiting to return to idle. Animator carries the preceding arm and torso pose into the new windup.
- `src/game/weapon-contact.js`: sampled swept blade contact; one hit per target per swing. Punch damage still uses the existing short-range facing test.
- `src/game/weapon-trail.js`: ribbon from actual blade endpoints, not a character-centred ring.

## Inspection and checks

Open `/game.html`, enter the clearing, and open Move tests. Walk/run support a phase scrubber; all previews support normal/half/quarter speed, front/side/back cameras and rig/grip axes. Combo previews the buffered three-cut sequence. Preview attacks do not damage targets.

`npm test` covers actual rig IK, grip alignment, neutral sword wrist, walking support/running flight, arm phase/flexion, foot drift, three sword cuts at 30/60/120 FPS, directional defense and chained transitions. `tools/check-game-play.mjs` exercises real browser keyboard input, movement, sword damage, punching, guard input and the preview controls. `tools/check-locomotion-cycle.mjs` renders eight poses across both sides of each full cycle. `tools/check-game-animation.mjs` captures windup, impact, follow-through and guard views.

The shared reconstructed mesh still limits deformation at extreme poses. These tests establish functional constraints and regressions; they do not certify final production animation quality. The current root movement remains collision-driven, while combat footwork is an in-place pose adjustment. Strafe/backpedal use redirected foot targets rather than separately authored directional clips.

## Grip, fist and jump correction (revision 9)

The diagonal palm socket is now fitted inside the curled fingers. Open hands, cylindrical grips and fists have separate poses; the thumb opposes across the outside of the curled fingers. Punch pronation rotates the forearm around its longitudinal axis while keeping the hand neutral relative to it.

Sword attacks construct an explicit blade frame: cutting edge tangent to the slash arc, or point along the thrust line. The elbow is reprojected to its reachable sphere while the forearm carries that frame, avoiding compensating wrist bends. Grip position remains fixed in the hand through attack poses. Sources consulted: https://swordfight.uk/hold-the-sword/ and https://boxingcanada.org/wp-content/uploads/2025/01/Instruction-Beginners-Reference-Manual-EN.pdf . Exact socket dimensions and joint angles are calibrated to this mesh, not extracted from those publications.

Space jumps; left click/J attacks; T thrusts; Q/E punch; F/right mouse guard. Takeoff includes 0.10 seconds of leg loading. Landing compresses the legs and recovers over roughly 0.31 seconds. Walk/run phase and blend state freeze in the air; footsteps stop. Jump poses and upper-body attacks remain independent. The flat-ground jump is tested at 30, 60 and 120 FPS, including no double jump. Browser validation covers running jump + attack, frozen airborne gait phase, landing and T thrust.

## Attack elbow / grip correction (revision 11)

The old blade-led solver could preserve the blade direction but leave the upper arm rolled arbitrarily, allowing elbow flexion across its local hinge plane. `alignElbowHinge` now reconstructs the upper-arm frame from the actual shoulder-elbow-wrist plane, including the sloping T-pose rest-frame correction. It preserves elbow/wrist positions and forearm world orientation. This runs after animation blending for both arms, including punch, guard and chained attacks. It does not impose a complete anatomical joint-limit model or improve the underlying mesh topology.

The sword hand uses its full cylindrical grip immediately, including the first frame after equipping. The palm-relative handle anchor is invariant. Forehand and backhand retain opposing diagonal planes; the third cut and heavy cut use a vertical overhead plane. Thrust retains its forward point alignment. Neutral wrists are an intentional simplification for this practice-sword rig, not a claim that all real sword systems use an immobile wrist.

Research: Academy of Historical Fencing, [The Six Cuts](https://swordfight.uk/the-six-cuts/) describes edge alignment, follow-through and recovery; [Hold the Sword](https://swordfight.uk/hold-the-sword/) distinguishes grips by weapon/action. Guy Windsor's [grip explanation](https://www.guywindsor.net/2022/02/youre-holding-the-sword-wrong-heres-why/) emphasizes routing impact through aligned hand/wrist structure. The IKMAF [grip reference](https://www.ikmaf.com/index.php/styles/yu-shin-gum-bup/foundation-skills/gripping-the-sword) was also consulted, but its two-handed spacing and power-hand guidance are not applied to this one-handed weapon. Joint angles and curve timings remain authored animation values, not measured motion capture.

Validation: 26 tests pass. `tests/attack-grip.test.js` checks the actual elbow hinge plane, palm-relative grip, neutral wrist and closed fingers through full cuts/thrusts at 30/60/120 FPS with a rotated/translated avatar, walking guard entry and airborne intervals. Existing tests cover blade-edge travel, thrust direction and combo continuity. `tools/check-attack-poses.mjs` renders a 16-frame pose sheet; `tools/check-hand-alignment.mjs` renders the hand close-up and punch/slash/thrust views. Both rendered without browser exceptions. Build passes with the existing large-bundle warning.

## Ready guard and body clearance (revision 12)

Follow-up visual review exposed two problems not caught by the earlier hinge tests: elbow penetration into the torso and a hilt position too high/too lateral. The ready guard is now authored from the arm first (upper-arm drop, elbow bend and forward forearm). Its wrist and weapon frames are derived together from the shared grip. The hilt is approximately 1.17 m high, 0.49 m ahead of the character origin and 0.19 m to the right; the blade rises toward an opponent instead of sitting alongside the head. Guard blending is continuous.

The sword-arm solver constrains the elbow outside a body-local clearance plane at x=-0.275 m on this male rig. This is a conservative rig-specific clearance constraint, not general mesh collision detection. The overhead cut brings the blade toward the centre line while leaving the elbow outside. Thrust uses an edge-down frame to avoid lateral elbow flare and up to 0.20 radians of deliberate wrist deviation. Other cuts and punches retain neutral wrists. Ready/recovery and action framing share a single grip orientation factory. Finger curls vary along the diagonal handle and maintain a complete curl.

Additional references consulted: [AHF guards](https://swordfight.uk/the-guards/) and [single-handed basics](https://wychwood.wikidot.com/fighting-sword). The implementation uses a relaxed forward one-handed ready pose, not a claim of reproducing a particular historical system exactly.

Validation now includes 27 passing tests: complete-attack elbow clearance, fingertip distance to the handle axis, palm-relative grip alignment, forward/lower hilt position, blade contact for all three cuts and prior movement/jump regressions. Tests remain insufficient to certify final skin deformation quality; close-up mesh faceting and extreme poses still require visual assessment.
