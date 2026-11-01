"""Score actual WebGL GLB renders against the aligned image silhouettes."""
import json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from body_depth import ROOT

OUT=ROOT/'public/validation/body'
views=['front','back','left','top','front-quarter','rear-quarter']
scores={}
for variant in ['baseline','depth']:
    scores[variant]={}
    for view in views:
        target=np.asarray(Image.open(OUT/f'{view}-mask.png'))>127
        rendered=np.asarray(Image.open(OUT/f'{variant}-{view}-mask.png').convert('RGB')).mean(axis=2)<127
        a=target ^ ndi.binary_erosion(target)
        b=rendered ^ ndi.binary_erosion(rendered)
        error=(ndi.distance_transform_edt(~a)[b].mean()+ndi.distance_transform_edt(~b)[a].mean())/2
        scores[variant][view]={'silhouetteIoU':float((target&rendered).sum()/(target|rendered).sum()),'meanContourErrorPixels':float(error),'heldOut':view.endswith('quarter')}
        rgb=np.asarray(Image.open(OUT/f'{view}-aligned.png').convert('RGB')).copy()
        rgb=(rgb*.55+255*.45).astype('uint8')
        rgb[target & ~rendered]=[235,115,93]
        rgb[rendered & ~target]=[63,145,203]
        rgb[ndi.binary_dilation(a)]=[191,68,53]
        rgb[ndi.binary_dilation(b)]=[30,107,161]
        Image.fromarray(rgb).save(OUT/f'{variant}-{view}-overlay.png')
scores['meaning']='Fixed nominal cameras, uniform scale/translation only. Red=reference-only, blue=mesh-only. IoU measures silhouette, not anatomical accuracy. Diagonal images were excluded from fitting but themselves contain camera/pose drift.'
(OUT/'metrics.json').write_text(json.dumps(scores,indent=2))
print(json.dumps(scores,indent=2))
