# World streaming and camp encounters

## Encounter ownership

`CAMP_DEFINITIONS` owns the camp positions, factions, approach routes and target gates. `CampDirector` tracks pressure, losses, available fighters and a seeded chance check. A nearby player enables the check; there is no invisible army waiting at an arbitrary battlefield coordinate.

`camp-expeditions.js` locks the actual inhabitants into a raid roster. It keeps the route and casualties for that expedition. Most surviving members must reach a waypoint before the group advances. A respawned casualty cannot refill a raid in progress. The party retreats on heavy losses or after its expedition time expires. The map follows its current centre, and a successful raid can take supplies only after reaching the town. Participation awards are paid once.

The seven camps are Briar grove, Old cart road, East-road camp, South ridge camp, Eastern thicket, Ash road camp and Ash ridge camp. The last two replace the old permanent east-field quest targets. Town defenders and camp inhabitants use the same target, combat, death, loot and faction interfaces as ordinary world characters.

`BattleDirector` now owns only the northern quest army. Accepting **When the banners move** unlocks its two camps. Choosing a side does not start combat. The player must reach that camp and give the signal. After departure, changing sides is locked. Leaving the zone pauses the army; returning reuses its state, including casualties. A local raid does not allocate this 10,000-person roster.

## Work outside the frame loop

| Work | Scheduling |
| --- | --- |
| Fine terrain heights, road and bank samples | Terrain worker; transferable arrays; nearest chunks first |
| NPC obstacle grids and route search | Navigation worker; revisions discard stale answers; retain the previous route while waiting |
| Clothing/character detail meshes | Geometry worker; preserve skinning and UV attributes |
| Army creation, animation palette and cavalry | Cooperative batches that yield to rendering/input |
| GPU preparation | Compile asynchronously, then upload/warm individual meshes between yields |
| Army saves | Batched snapshots, compression in a worker, awaited before log-off |

The forest keeps existing trees and terrain while detail changes. Only grass density changes with distance. Combat does not remove vegetation. Small camp footprints, roads, settlements and water retain their own placement exclusions. Armies query deterministic tree obstacles when moving.

Eight point lights stay registered with the renderer. Their intensity fades before a slot changes fixture. Approaching a torch therefore does not change the number of shader lights or allocate another shadow map. Highmere's night guards, archery posts and civilian sleep/work schedules use the same world clock. Gate damage/repairs and arrows consume settlement resources.

## Verification

Tests run in isolated browser saves, without refreshing the user's running game:

- `npm test`: 177 passing unit/regression tests during this update.
- `check-camp-streaming.mjs`: original bandit identities moved along their route; the target count stayed constant. The locked campaign had no army. With the quest accepted, 10,000 combatants remained staged at simulation time zero until the start signal. Ash selection made Highmere the opposing team. The asynchronous save contained the army state.
- `check-town-life.mjs`: 25 named Highmere residents; 21 sleeping and four guards on duty during the night check; chat developer controls worked without runtime errors.
- `check-town-lights.mjs`: a scripted 18 m/s route through Highmere, transitioning day to night, at 1600 by 1000 in Chromium/D3D11 on RTX 5080. Across 1,223 frames, mean interval was 16.76 ms, p95 16.7 ms, p99 16.8 ms, maximum 66.6 ms. One interval exceeded 50 ms. Eight point lights remained registered throughout. This is a bounded town test, not a promise of those timings on other hardware.
- `check-world-environment.mjs`: rendered town square, shop threshold, night sky, river, lake and mountain views. The diagnostic camera is kept above the sampled ground. The distant water mask excludes the deep interior only, preserving the visible banks.
- `stress-battle.mjs`: 10,000 units, 60 simulated seconds, 18,855 hits, 2,990 arrows and 1,396 mounted contacts. Mean simulation step was 14.43 ms, p95 22.22 ms. In the separate 1440 by 900 battle preview, wide combat averaged 16.63 ms/frame; close combat averaged 20.22 ms/frame, p95 32.9 ms, with 16 active articulated bodies. The real open world adds terrain, town, UI and agent work, so these are not full-world frame rates.

Reports and images go in ignored `test-results/`. The generated terrain and sky sources and prompts are in `public/assets/world/` and `docs/*image-prompts.json`.

## Remaining limits

WebGL draw submission and GPU uploads still require the main thread. First use of a material can stall its driver; this work is reduced and spread out, not eliminated. The army loading profile originally had a roughly 1.2-second first draw. Preparing buffers individually and allocating cavalry colours before compilation removed the final roughly 0.55-second late variant stall. First entry into the world and cold material draws can still exceed a frame budget.

Detailed camp actors are created when approached and retained dormant afterwards; they are not yet evicted from a shared pool. Camp movement far from the observer is coarse and updated once per second. The 10,000-person army uses GPU animation and a bounded number of nearby articulated deaths, not 10,000 physical ragdolls or cloth solvers. Full campaign balance, lower-end GPU performance and all possible saved-state migrations still need broader playtesting.
