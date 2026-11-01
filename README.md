# Forest Reborn

Three.js anime fantasy RPG prototype. The current game entry is `game.html` (also served by `index.html`). Choose or create a saved character, customise their appearance, then play the rainy walk-home opening. After waking in Mosswake, start with trousers, empty hands and **5 gold**, find Tomas at the tavern, earn equipment, and explore outside town. Loading an existing save preserves its current money.

[Play Forest Reborn](https://samg-coder.github.io/forest-reborn/) · [Build and deployment](https://github.com/SamG-Coder/forest-reborn/actions/workflows/pages.yml)

```sh
npm install
npm run dev
```

## GitHub Pages

`.github/workflows/pages.yml` installs locked dependencies, runs the tests, builds the game and checks the production build in Chromium, including runtime speech and save persistence. Successful pushes to `main` publish `dist/` to GitHub Pages. Pull requests run the checks without deploying. The repository's Pages source must be **GitHub Actions**.

The workflow sets `PAGES_BASE_PATH` to the repository path. For a local production preview on PowerShell:

```powershell
$env:PAGES_BASE_PATH='/forest-reborn/'
npm run build
npm run preview -- --port 5180
# In another terminal:
node tools/check-deployment.mjs http://127.0.0.1:5180/forest-reborn/
```

Hosting serves the game and its assets; gameplay and saves run locally in each visitor's browser. This prototype simulates other players and does not provide a shared multiplayer server. Saves at localhost and on GitHub Pages are separate because browser storage belongs to each origin.

Open http://127.0.0.1:5173/game.html. Each character has independent appearance, inventory, quests, skills and simulated world progress in this browser's local storage. Existing progress is copied into a legacy save without deleting the original. The main menu supports continue, create, rename and confirmed deletion.

Use **Menu · Esc → Log off** to save and return to character selection. The menu also offers Resume and Save progress. Opening the menu pauses the local simulation and disables game input; a failed save keeps the game open. Autosave runs every 30 seconds. The opening can be paused or skipped; skipping reaches the same starting state in Mosswake.

The street opening uses generated asphalt and apartment-window textures, world-anchored wet patches, and seeded rainfall with impact rings and droplets. Its approaching car stays hidden until the crossing begins, then travels straight at 10.6 m/s. The character looks up and steps back before the cut to black. The phone uses a flat hand behind the screen. Male and female character creation each have twelve hairstyle options, including shaved.

## Controls

| Input | Action |
| --- | --- |
| W/S / Shift | Forward and back / run |
| NumLock | Toggle autorun; W, S or Escape cancels it |
| A/D / Q/E | Turn / strafe |
| Space | Jump |
| Left mouse drag | Look around without turning the character |
| Right mouse drag | Turn character and camera together; A/D strafe while held |
| Both mouse buttons | Move forward while steering |
| Wheel | Zoom |
| Click an enemy | Select it and enable auto attack |
| Tab / Shift+Tab | Cycle targets |
| 1 or J | Toggle attack; select the nearest enemy if none is selected |
| R | Dodge |
| V | Talk, trade, or gather nearby |
| B / C / K / L | Bag / character / skills / quests |
| O / M / G | Friends / map / guilds and events |
| Wheel / drag on either map | Zoom / pan; use Centre on me to follow again |
| Escape | Close the current panel, cancel targeting, or open the game menu |

Attacks check distance at their impact time. Attacking preserves movement speed, so you can chase and strike. On foot, the player and simulated adventurers share a 1.45 m/s walk and 3.9 m/s run; running is not gated by stamina. The sword alternates a forehand and a returning backhand; the grip stays attached to the palm. Blocking happens on a successful defensive roll. Combat text shows outgoing damage in gold, incoming damage in red, and damage between other actors in pale text.

The character, skills, quests, trader, crafting, friends, guild, faction, map, journey and camera panels use shared draggable window frames. Their launch buttons and hotkeys toggle them; Escape closes the frontmost window. The backpack remains open beside other windows. Drag items from the bag into a matching equipment slot or onto the character preview; drag equipment back to an empty bag slot to remove it. Right-click is a shortcut for equipping, removing or using an item. Loot opens in a compact window and closes when emptied or when you leave its range. Items that cannot fit stay available to loot.

Highmere's keep can be entered from the winding uphill road. Its great hall contains Lord Edric, the steward, and servants with scheduled work and deliveries. Nearby city residents automatically switch to full rigged models; the distant crowd uses GPU animation. The development server does not refresh your open game when files change: reload manually when ready.

Open `http://127.0.0.1:5173/creatures.html` to inspect the actual rabbit and goblin models, their animations and clothing.

The opening quest chain now leads from Tomas's first errand through the Mosswake jobs to a horse paid for by the watch. Speak to Alden after returning Orin's cargo quest, then find Nell at the southwest stables. Nell gives you Bracken and a letter to deliver to Lord Edric in Highmere's great hall. Edric sends you to Corin's archive for the next lead about your arrival.

Nell also sells horses: Bracken costs 2s 50c; Mistral and Copper cost 6s 50c. Stand still outdoors and press **H** to mount or dismount; hold **Shift** while moving to canter. Horse ownership and your selection are saved per character. Mounted combat supports sword sweeps, spear thrusts, bows and speed-based charge contact; braced spears counter an approaching rider. Dismount before gathering or entering buildings. Open **L** for the quest journal, pin an objective or use **Show destination on map**. The minimap, quests and live events now share one layout, so the bounty panel cannot overlap a tracked quest.

Buy a woodcutting axe from Orin for 15 copper and keep it in your bag. Stand beside a forest tree and press V. Four chops take 4.8 seconds, the tree falls, and three timber enter your bag. Moving or taking damage interrupts the action. Felled trees leave a stump and regrow after three minutes; their state is saved.

Use G to form or join a guild and invite adventurers. Different personalities choose work, hunting, trade, rest, and events. Outlaw factions can fight rival guilds. Entering town while flagged prompts a ten-second warning; staying brings the watch. Leave town and stay out of combat to lower the flag. Defeated residents respawn after 45 seconds.

Archery connects combat to gathering and crafting. Pull flax for fibre, use the loom for bowstrings, shape timber into staves and unstrung bows at the carpenter's bench, then string them. Fletching combines shafts, feathers and different tips into arrows. Bows consume the selected ammunition at release and damage follows the projectile's arrival. Mounted archers and army archers use these same weapon rules.

Ask a townsperson for directions to mark an actual local destination. Adventurers can offer supply agreements and shared quest work: rewards are reserved, both parties must perform their contribution, and expiry returns the reserved payment. Nearby participants gain relationship trust through completed work. Their dialogue follows their current job, injury, combat, travel or quest state, with per-speaker and shared repeat cooldowns.

## Sound

**Menu → Sound & mixing** controls master, voices, combat/actions, music and ambience separately. Positional voices and effects use distance falloff and camera-relative stereo direction, with the listener at the player so zooming does not change loudness. Dialogue ducks music, ambience and effects. Nearby sound sources are limited to 24 ordinary one-shots, with up to 32 for priority events; distant jobs do not allocate audio nodes.

Runtime synthesis supplies varied weapon swings, impacts, arrows, footsteps, hoof contacts, landing, chopping, mining, sawing, sewing, shearing, gathering, cooking and trading sounds. Walking is quiet, while the horse's fast gait groups four hoof contacts with a suspension gap; grass softens the impact. These are synthesized game effects, not recorded sound-library assets.

Character speech generates short phrases in the worker and plays the first while later phrases are generated. The same queue handles NPCs, guard warnings, previews and cinematics. Complete samples are retained at phrase boundaries; pausing saves playback offsets, and cancelled conversations discard remaining work. The voice model stays cached and warmed across the menu and game. Short one-phrase lines still require one inference; the initial model load is separate from time to first audio.

## Connected battles

Local raids originate from seven physical camps. Their existing inhabitants gather, follow a route, fight nearby opponents, attack the town's gate and withdraw toward home. The moving encounter marker follows those same people, including across streaming boundaries. Surviving numbers, faction supply demand and recent losses affect future raids. Forests remain around the routes; there are no cleared circular battle arenas.

The northern encounter is 5,000 versus 5,000, including cavalry and archers. It loads only after accepting **When the banners move**. Choose Highmere or the Ash Company in Journey, travel to that camp, then **Give the signal**. Neither army advances before the signal. Equipment, statistics, targets, loot and quest participation use the RPG systems. Distant units use instanced animation and camera-distance detail levels; nearby deaths receive articulated poses. This does not run cloth physics or a separate CPU skeleton for all 10,000 units.

Terrain sampling, route searches, clothing simplification and army-save compression use workers. Main-thread model and animation preparation yields in small batches. Eight fixed local light slots prevent shader recompilation when approaching torches. See [world streaming and validation](docs/world-streaming.md) for measured performance and remaining limits.

## Code ownership

- `src/avatar/`: reusable male mesh, rig, face/body UV materials.
- `src/gear/`: item registration, inherited coverage masks, layers, cloth, metals and variants.
- `src/game/`: locomotion, sword motion, grip constraints, targeting, combat and camera.
- `src/npc/`: jobs, persistent adventurer decisions, guilds, town law and combat approach spacing.
- `src/mounts/`: horse definitions, purchases, meshes, gaits, rider pose and safe mount/dismount rules.
- `src/audio/dialogue.js`: contextual dialogue pools and speaker/line cooldowns, independent of voice synthesis.
- `src/world/`: streamed terrain, town, vegetation, navigation and shared harvest state.
- `src/progression/` and `src/ui/`: inventory, currency, quests, skills, windows and combat text.
- `src/session/`: save slots, main menu, in-game menu and log-off flow.
- `src/creator/`: appearance controls, studio lighting and hairstyle previews.
- `src/cinematic/`: shot tracks, street, phone attachment, rain and opening poses.

Generated world/item art and prompts are in `public/assets/` and `docs/*prompts.json`. `tools/bake-world-materials.py` derives normal and roughness images from the generated surface images; these are image-derived approximations, not geometry bakes. The toon world materials use the normal maps.

Active opening/menu image prompts and source paths are recorded in `docs/opening-assets.prompts.json`.

Highmere, the hilltop castle, its generated materials, runtime character voices, streaming limits and remaining feature audit are documented in [docs/realm-and-voices.md](docs/realm-and-voices.md). Use Journey to travel from Mosswake. Browser auto refresh is disabled in the dev server; reload manually to pick up edits.

## Validation

Run `npm test` and `npm run build`. With the dev server running, run browser checks **one at a time**:

```sh
node tools/check-session-flow.mjs
node tools/preview-opening.mjs
node tools/audit-haircuts.mjs
node tools/check-quest-mounts.mjs
node tools/check-mounted-road.mjs
node tools/check-movement-inventory.mjs
node tools/check-audio-windows.mjs
node tools/check-streaming-voices.mjs
node tools/check-archery-social.mjs
node tools/check-camp-streaming.mjs
node tools/check-town-life.mjs
node tools/check-town-lights.mjs
node tools/check-world-environment.mjs
node tools/stress-battle.mjs
```

The session check creates two isolated characters through the real menu, completes and skips the opening, tests save failure, logs off, resumes, renames and deletes a save. The opening check captures the camera shots and verifies that the approaching car is absent before the crossing. Earlier gameplay checks remain available under `tools/`:

```sh
node tools/check-game-play.mjs
node tools/check-combat-update.mjs
node tools/check-society-woodcutting.mjs
node tools/check-world-review.mjs
node tools/check-world-activity.mjs
```

Reports and screenshots are written to `test-results/`. Browser tests use isolated saves and explicit fixtures for long battles, cooldowns and purchases; they do not change the player's save.

This is a local MMO simulation, not a multiplayer server. The world spans 4 km by 4 km; distant zones suspend detailed simulation except for active camp expeditions and companions. The quest army pauses while unloaded and resumes its saved state on return. Offline adventurer activity is a bounded, coarse replay, up to eight hours. The legacy crowd preview measures rendering only. The battle stress test separately measures 10,000 combatants at a 20 Hz simulation step; the camp-streaming check exercises the staged army inside the actual RPG. Rendering-only results are not a full-game frame-rate guarantee.
