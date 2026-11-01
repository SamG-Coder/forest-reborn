# Full-body reconstruction experiment

Open `http://127.0.0.1:5173/body.html` with the local Vite server running.

## Assets and separation

- `public/assets/body-views/`: six separate generated images, bald adult male, blank face, T-pose, fitted shorts.
- Front/back/left/top are construction references. Front/rear three-quarter images are withheld from geometry fitting.
- `public/models/male-depth-body.glb`: closed reconstruction with neutral skin/shorts materials.
- `public/models/male-silhouette-body.glb`: same pipeline with network contribution disabled.
- `public/validation/body/`: raw network tensors, visual depth maps, model/input provenance, aligned references, actual Three.js renders, overlays, scores and UV atlas.
- The existing modular rig/item workshop and its original face/ear UV atlas are preserved. This experimental body is not silently substituted into that rig.

## Reproduce

```powershell
python -m pip install -r tools/requirements-body.txt
python tools/reconstruct-body.py
# Keep npm run dev running in another terminal:
node tools/capture-body.mjs
python tools/score-body.py
npm test
npm run build
```

`--skip-inference` reuses existing raw predictions when iterating geometry. Weights are cached under `.cache`, pinned to the revision in `body_depth.py`. Source and model hashes are recorded. The predictor uses ONNX Runtime CPU inference, RGB bicubic resize to shorter side 518 / multiples of 14, ImageNet normalization.

## What the geometry actually uses

This is depth-assisted surface fitting, not a metric multi-view reconstruction. Front silhouette constrains connectivity and width. Side silhouette calibrates thickness by height; overhead silhouette calibrates arm thickness. The front/back network predictions add bounded local relief to rounded cross sections (30% maximum relative to local half-thickness). Head relief is attenuated to keep the requested blank surface. Marching cubes creates the closed surface; Taubin smoothing reduces voxel artifacts. Diagonal depth outputs are saved but not fed into geometry fitting. Left/top depth maps are likewise available for inspection, while their silhouettes currently supply the thickness constraints.

Network inverse-depth scales/offsets differ between images. The fitter removes broad drift and uses normalized local residuals. Therefore this is not direct calibrated depth-map fusion. The zero-depth GLB makes the actual effect inspectable; silhouette improvement is not guaranteed in every view.

Reference images are used ONLY for geometry. Current GLBs contain no image textures. An xatlas UV unwrap is included for separately authored textures later; body-uv-layout.png is the wire layout. The preview uses cel-shaded skin and charcoal shorts materials. The pre-existing face UV remains unchanged in the older workshop.

## Image consistency and limits

The first overhead image was rejected for excessive tilt and regenerated. Its replacement is closer but still not a perfect orthographic plan view. Diagonal retries improved arm heights but worsened projected armspan/yaw, so the first diagonal images were retained and their disagreement is reported. Prompts and review are recorded alongside this document.

The captured GLB is one connected watertight surface, approximately 22.5k unique vertices / 45k triangles. It is not retopologized, rigged, or separated into body and clothing; fingers are not independently articulated. These are required before replacing the reusable game avatar. The current result demonstrates the image → actual depth inference → mesh → rendered comparison pipeline, not a finished game character.

Metrics use fixed nominal camera angles and uniform image alignment; they measure silhouette overlap/contour distance only. They do not prove correct interior anatomy, UV alignment, or 1:1 matching. The front and side are strong, overhead and held-out diagonals remain weaker. See `metrics.json` for measured results including the no-depth baseline.

## Shoulder and hand finishing

The finishing module uses rounded torso cross sections and a smooth shoulder transition. Old silhouette-derived mittens are replaced with connected palms, four separate fingers and a thumb per hand, blended into tapered wrists. These are explicit anatomy modelling constraints, not predicted depth. The surface is simplified to 45k triangles and unwrapped using xatlas. This remains a triangulated static mesh; deformation loops, finger bones and animation checks are still needed before production rigging.

## Simplified UV working mesh

Run `python tools/simplify-body.py` after rebuilding the source. It tries increasingly detailed candidates and accepts the smallest closed surface meeting explicit bidirectional sampled distance limits, including every source hand vertex. The selected GLB is `public/models/male-uv-body.glb`; UV layout and measurements are in `public/validation/body/male-uv-layout.png` and `simplification.json`. The preview defaults to this mesh and preserves the original for comparison. Wireframe mode draws an opaque surface beneath the edges to hide far-side clutter. This reduces triangles and UV islands; it does not create anatomical quad loops or prove zero shape error.
