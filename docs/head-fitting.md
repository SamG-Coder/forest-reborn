# Head fitting and UV workflow

The male head is built in `src/model/head.js`. Its fitted cross-sections live in
`src/fitting/head-fit.json`; the body skeleton and equipment registry remain separate.

`public/assets/warrior-face.png` is the original generated face artwork. The packing
script copies those pixels unchanged into the left half of `male-head-atlas.png`.
The right half contains the separately generated ear artwork. Both ears and the
head use this same texture. Eyes, eyebrows, lips, and ear folds are not standalone
feature meshes. Ears retain a shallow geometric surface for their silhouette.

## Reproduce

With the local Vite server running (`npm run dev`):

```text
python -m pip install numpy pillow scipy
python tools/pack-head-atlas.py
python tools/fit-head.py
node tools/optimize-head.mjs
node tools/capture-head.mjs fitted
python tools/fit-head.py report
```

Open `http://127.0.0.1:5173/validation.html` for the reference/render blend slider,
contour overlay, estimated depth, disagreement map, and measurements.

The baseline captures preserve the pre-fitting head. Do not overwrite those when
rerunning a new fit. `capture-head.mjs` renders the actual Three.js mesh with an
orthographic camera, rather than drawing its expected outline in the test.

## What the numbers mean

Manual polygons recorded in `public/validation/annotations.json` remove neck, ears,
and captions from the source illustration. Skin-colour segmentation extracts the
remaining head region. Hidden boundaries behind ears are estimated. The front and
profile scanlines determine width and depth extents. Cross-section shape and the
third-view camera yaw are selected by grid search against rendered overlap.

The images are aligned with uniform scale to 430 pixels of head height and centred
horizontally. No nonrigid image warp is used. Silhouette IoU and symmetric boundary
distance compare masks; they do not measure facial-feature likeness, texture error,
ear fit, or independent 3D reconstruction accuracy. All three drawings now participate
in fitting, so these are training-fit errors. The source illustration is not a calibrated
multi-camera capture. In particular, fitted camera yaw can differ from the nominal
three-quarter label.

`estimated-front-depth.png` is the initial contour-derived depth estimate.
`fitted-*-depth.png` are depth renders of the resulting mesh, not ground-truth depth
from the image. A single design sheet does not uniquely determine the hidden shape.

The current fitting leaves visible differences in the third view and interior facial
planes. A high outline score is not a claim of a one-to-one finished face.
