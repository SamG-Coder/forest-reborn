# Highmere, runtime voices, and the next slice

Highmere is 1.2 km northeast of Mosswake at (850, -850). Reach it on foot along the northern road, or use Journey → Take the caravan. The lower town follows an irregular defensive wall; a limestone rise carries the keep above it. The route to the keep winds around the slope. House foundations are locally levelled rather than flattening the whole town.

Castle materials are three separate image_gen assets: limestone ashlar, blue slate, and exposed bedrock. Original images live in `public/assets/world/source/castle-*.png`. Exact prompts are in `castle-assets.prompts.json`. `tools/bake-castle-materials.py` creates periodic 1024 px base-colour, normal and roughness maps. The normals estimate surface microdetail from image luminance; they are not high-poly geometry bakes. The active toon shader uses base colour and normals. Roughness maps are retained for a physical-material tier.

## Streaming and population

- Highmere loads within 300 m and unloads beyond 390 m. The east field loads within 180 m and unloads beyond 250 m. A factory cannot register a second copy while an earlier copy is still loading.
- Faraway Highmere and east-field geometry, population and combat are not created. Departed zones dispose their generated geometry, materials, actors and local navigation registrations.
- Mosswake residents pause while the player is away. Up to three chosen companions follow the player and remain active. Mosswake's initial asset templates remain cached in memory.
- Highmere has 22 building plots, ten named residents, three usable workshops, and 128 ambient citizens. The named residents handle conversations, shops and physical work animations. Ambient citizens have individual clothes, skin, hair and proportions. Within 22 m they automatically use complete rigged characters; beyond 29 m they return to GPU-animated proxies. This hysteresis prevents repeated swapping at the boundary. Ambient citizens are not complete quest agents.
- The east field has 600 GPU-animated combatants in paired skirmishes plus nine fully targetable enemies: five raiders, three shieldbreakers, and one giant. Pair combat checks distance, cooldown, health and respawn. The larger field is currently an ongoing battle, not a territory-capture campaign.
- Seven quests, four recipes and four equipment items extend the northern progression. Existing save slots own their progress and party list. No starter armour or weapon is granted by travelling.

## Castle and city

The keep has a level terrain pad, foundations extending down to the sampled ground, an open four-metre entrance, and a playable great hall. Its towers and chapel remain exterior structures. Road grading shares height samples at intersections and limits the connected street network to an 18% target grade. The caravan enters through the south gate; the market street curves around the fountain. Local navigation uses the same wall, furniture and tree colliders as player movement.

Lord Edric reviews petitions and receives visitors. Steward Elin checks and delivers the accounts. Maren mends and puts away table linen, then sets the hall table. Bren brings deliveries to the pantry and service table. Each route has explicit work positions beside furniture, facing, action and duration. Work time only advances after arrival; conversation pauses the route. The household runs only while the player is nearby and the Highmere zone is active.

The old forked oak occupies the western courtyard, with two smaller trees elsewhere in the city. Short green grass, taller tufts and dry grass use deterministic patches. The market fountain has a recessed basin, a water shader with animated ripple highlights, four streams and looping splash droplets. It does not use expensive scene reflections.

## Maps and wildlife

Both maps share the same interaction and rendering code. Wheel zoom and drag pan do not move the game camera. Panning disables following until **Centre on me** is selected. Terrain tiles sample the actual height function and add relief/contours; roads, buildings, keep footprint, trees, monster clusters, workstations and quest states are overlaid separately.

Rabbits use a new articulated model with four coats. Sixteen roam four habitats, graze, look around, flee approaching people, and choose another safe position when respawning. Goblins share the human rig, UVs and clothing registry, with smaller bodies, enlarged heads, pointed ears and green skin. `creatures.html` previews the actual runtime models and their idle, walk, run and attack states; it is not concept art.

## Speech

The local model is [Kitten TTS Nano 0.8 int8](https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8). The actual model file is 24,369,971 bytes and voices are 3,278,902 bytes. This is about 27.7 MB of model assets, plus the browser runtime. It is not a verified 9 MB solution. The model card identifies Apache-2.0 licensing. The vendored JavaScript adapter retains its licence and attribution in `src/vendor/kitten`.

Speech is synthesized in a worker at runtime. Model responses use the browser Cache API; up to 24 generated lines are retained in session memory. The save menu begins warming the worker before dialogue. Stable character IDs choose a consistent voice, pitch and warmth; creator choices use four male and four female base voices. Modest pitch adjustment changes playback speed too; this is not a formant-preserving voice-conversion system.

The WASM phonemizer returns an array of clauses and omits punctuation. The adapter now retains every clause and reconstructs punctuation instead of silently keeping only element zero. Generated PCM is not cut by a fixed 5,000-sample tail trim. A short silent lead-in and release retain all samples. The opening holds the current caption and camera beat until that line ends, including synthesis time. Skip, mute and closing dialogue intentionally stop their associated channel.

Guard warnings and retaliation use the actual guard's voice and an overhead speech bubble. Nearby lines queue behind foreground dialogue, expire instead of playing late, and retain visible text when sound is muted. Speech bubbles remain while queued/playing and briefly after playback.

Tomas now participates in a shot/reverse-shot conversation after the town-centre awakening. His normal work routine is suspended for the scene and restored on completion or skip. This is head/hand acting with the existing UV face, not phoneme lip sync.

## Opening journey, horses and dialogue

The main journey now follows `errand → supper → briar → cargo → saddle-earned → north-road → unlisted-arrival`. Tomas gives the player paid work after the awakening. Helping the town earns Alden's trust; the watch pays Nell for Bracken, then Nell hands over Alden's letter. Deliver it to Lord Edric in the great hall. Edric sends the player to Corin's arrival records. Existing quest IDs and completed progress are retained; no save reset is required. Quarry and guild work remain available as side progression.

Nell's stables occupy the southwest plot in Mosswake, with three actual horse models and a working routine. Bracken can also be purchased for 2s 50c; Mistral and Copper cost 6s 50c each. All include saddles and share movement speeds. Ownership and the selected horse belong to the current save, separate from bag slots. Stand outside and press H to mount/dismount; move with the usual controls and hold Shift to canter. Horses cannot enter buildings. Dismounting searches for a clear, level position, and combat/gathering require dismounting. Mounting currently changes pose immediately; breeding, horse equipment and mounted combat are not implemented.

`src/mounts/` owns the catalogue, purchase validation, connected loft meshes, articulated walk/canter and rider IK. Linen trousers and jeans now share the continuous garment shell, avoiding open leg tubes when seated. Horse shop portraits in `public/assets/mounts/` are rendered from these same meshes by `tools/render-horses.mjs`, rather than concept pictures that differ from the game.

Quest cards distinguish the main journey from side work, name the objective, show the location and hand-in NPC, and can mark a destination on the world map. The HUD tracks up to three quests, with a player-pinned quest first. Map, quest tracker and events share one scrolling column; bounties no longer have an independent absolute screen position.

`DialogueDirector` chooses greetings from the person's job, current adventurer task, party state and relevant story context. A normal greeting has a 12-second speaker cooldown, ambient lines have a 90-second speaker cooldown and a 24-second global gap, and the same line cannot repeat for three minutes. Explicit quest details/replies still use their authored lines. Ambient dialogue waits for dialogue, guard and cinematic channels and checks proximity and line of sight. The existing runtime voice identity and speech bubbles are retained.

Goblins have pointed, slightly lifted noses as well as long pointed ears. Both are deformations of the accepted human-derived mesh, preserving its rig, indices and facial UVs.

## Validation and limits

- `npm test`: 117 tests passing at this revision, including horse ownership and purchases, quest hand-in routing and real workshop/resource destinations, dialogue cooldown/context changes, safe dismounting, goblin nose/ear isolation, road gradients, level foundations, character promotion/demotion, maps, guard speech, wildlife, and household arrival/conversation handling.
- `tools/check-quest-mounts.mjs`: real NPC quest buttons, horse reward, keyboard mount/walk/canter/dismount, journal destination mapping, live bounty separation at 1440×1000 / 1100×800 / 1000×760, and Lord Edric/Corin hand-ins. Prerequisite combat counters use fixtures; the test does not claim a full paced campaign playthrough.
- `tools/check-mounted-road.mjs`: a mounted character travels the actual 1,361.6 m road route with movement/collision/terrain/zone streaming active, then dismounts and enters the great hall on foot. Steering is automated at waypoints; rendering is skipped during accelerated travel, so this is not a frame-rate benchmark.
- `tools/check-city.mjs`: actual player input through the keep entrance, unblocked road segments, full household work/travel cycles, nearby character promotion and distant demotion, rendered city captures and a five-second frame sample. This checks the real game, rather than a separate geometry mockup.
- `tools/check-maps-and-wildlife.mjs`: real wheel/drag/recentre interaction on both maps, roaming habitats, a spoken guard warning and its overhead text.
- `tools/check-creatures.mjs`: runtime previews of the rabbit and clothed goblin, including movement and attack poses.
- `tools/check-regions.mjs`: fresh start creates neither remote zone; travel loads Highmere; companions stay active; distant residents pause; the field deals in-range damage; leaving unregisters both zones and their actors/colliders.
- `tools/check-session-flow.mjs`: complete opening, log off, resume, separate characters, rename/delete and failed-storage handling.
- `tools/check-voice-quality.mjs`: all eight voices synthesize the exact creator preview. A separate local Whisper transcription recovered every word in all eight samples, and the complete comma-separated test sentence. This checks intelligibility, not subjective acting quality.
- `tools/check-spoken-opening.mjs`: the actual creator button and all eight town-conversation lines complete without cancellation. The production build test measured 2,785 ms from preview click to playback on this machine, with a 7.41-second preview. Hardware/cache/network conditions affect this result.
- `tools/check-mouse-controls.mjs`: actual browser mouse gestures exercise independent left orbit, right steering, two-button movement, strafing, click/drag separation, zoom and focus loss.
- `tools/check-manual-refresh.mjs`: an imported source module changes and invalidates its cache without navigating the browser. The running dev server has HMR disabled; reload manually.
- `tools/benchmark-crowd.mjs`: 5,000 visible far-LOD animated bodies rendered at approximately 60 FPS on an RTX 5080 through headless Chromium/D3D11, at 1190×1000 rendering resolution. That benchmark uses one outfit, no AI, shadows, network or live cloth. It does not prove that 5,000 full characters or a complete MMO simulation sustain 60 FPS.

## Remaining features, in priority order

1. Expand the companion state machine from travel following into explicit assist, defend and retreat orders, with shared quest participation rules. Avoid presenting ambient crowd bodies as recruitable people.
2. Give the field a commander, phase objectives, defeat/retreat conditions and persistent rewards; replace fixed pair assignments with squad objectives before calling it a siege.
3. Extend Highmere-specific guard law and household routes to additional rooms. The great hall is playable; upper floors, tower stairs and the chapel interior are not yet open.
4. Add a distant castle silhouette/impostor without waking the zone simulation, and benchmark full-world traversal on lower-end hardware. The present lazy castle appears only on entering its streaming radius.
5. Add lip-sync assets and evaluate longer conversations across all voices. The existing UV-face convention is preserved.
6. Run a complete level 1–13 progression balance pass with real quest travel, resource supply and equipment upgrades. Quest definitions exist; their presence alone does not establish a well-paced campaign.

### Suggested exploration areas — design only

These are proposed additions, not currently populated zones:

| Area | Purpose | Short scene trigger |
| --- | --- | --- |
| Stream and damaged mill between Mosswake and the ridge | Level 2–4 timber, fishing and repairs; a useful stop on the northern road | On first repair, water turns the wheel and reveals a marked stone in the channel |
| Abandoned toll house beside the old cart road | Level 4–6 bandit camp, stolen cargo and a recruitable courier | After clearing the yard, a survivor recognises the player's description of the modern street |
| Ridge watch post | Level 6–8 rest stop, supplies and a clear first view of Highmere | First safe arrival reveals the castle and the distant battle, then immediately returns control |
| Orchard and tenant farms outside Highmere | Cloth, food, animal care and civilian requests; a quieter contrast to the field | A farmer introduces a missing caravan lead after the player earns their trust |
| Quarry stair and sealed archive beneath the keep | Level 9–11 group encounters tied to the arrival records | Bringing Corin's evidence opens the seal; no scene fires during combat |
| Ruined bridge beyond the east field | Level 11–13 company event with repair, escort and defence phases | A completed defence reveals the road into the next region |

Scene triggers should be saved once per character, require a safe grounded state, have skip/replay support, preserve party positions, and never overwrite an active conversation or battle. Resource placement should follow each location's purpose rather than uniform random scattering.

## Mouse and camera

Left-drag orbits independently. Right-drag turns the character with the view; holding both buttons moves forward. W/S move along the character's heading, A/D turn, Q/E strafe, and A/D also strafe while right mouse is held. Wheel zoom is bounded to 2–12 m. A click selects only when the gesture stayed within its drag threshold. The steady camera keeps movement free of head bob and dynamic field-of-view changes.
