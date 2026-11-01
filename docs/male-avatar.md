# Male avatar appearance and joint preview

Open `/avatar.html` on the local Vite server. The source is the simplified male base. `src/avatar/` separates catalog definitions, rig/weights, materials, garment construction, head refinement, and preview controls.

## Assets

Five newly generated grayscale male faces: Calm, Resolute, Gentle, Wry, Stern. Originals are in `public/assets/male/face-*.png`. The face preparation script creates RGBA feature layers and separate grayscale iris masks, as well as body-atlas bakes for interchange. The live material uses a dedicated face UV channel so the face keeps its source resolution. Iris tint affects only masked iris pixels; pupils, highlights and whites retain their grayscale detail.

Two newly generated skin material swatches, smooth and lightly weathered, are mapped through the base body's UVs. These provide subtle surface variation, not anatomical illustrations. Skin colour is a shader parameter. The generated starter cotton map is UV-mapped onto a separate boxer-brief shell, with a shader waistband and hems. Colour can change independently. No original modelling reference image is used as a texture.

Prompts are saved in `male-customization-prompts.json`; generation used the built-in image tool. Rebuild face layers with `python tools/bake-male-faces.py`. The live dedicated face projection is in `head-shape.js`; the optional atlas-bake projection is recorded separately in the UV manifest.

## Skeleton and clothing

`male-tpose-v2` has 49 bones including torso, head/neck, clavicles, arms, wrists, finger segments, legs, ankles and toes. Body and underwear use the same skeleton. Weighting is a deterministic spatial initial bind with regional constraints; it is not hand-painted production weighting. Joint sliders and a test pose expose deformation for inspection. Extreme posing and intersections still need cleanup.

Starter underwear is registered as `underwear.male.starter`, compatible with `male-base-v2`. Its mesh is clipped at exact waist/leg planes to avoid whole-triangle jagged hems, offset from the skin, and weighted to the common rig. It is a fitted shell, not simulated cloth.

Head-only refinement preserves the UVs, keeps a smaller overall head proportion, and adds restrained continuous nose/lip/chin profile geometry. Facial artwork remains texture detail, not separate eye or mouth meshes. The side profile is an approximation guided by user markup, not a measured 1:1 fit. The avatar is constructed at runtime; the earlier static GLBs remain source geometry and do not contain these appearance shaders or this skeleton.

## Verification

`node tools/check-avatar.mjs` loads the actual preview, verifies normalized weights, shared clothing bind, and finite nonzero influence for every joint. It captures all five faces, two eye colours and a test pose. `npm test` includes exact hem clipping regression coverage. `npm run build` includes the avatar page.
