"""Bake periodic, tintable material maps from preserved image_gen source swatches.

Normal maps use a luminance-derived microheight approximation, not inferred
physical geometry. Large folds and individual silhouette rings belong in meshes.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/gear'

def periodic(image):
    h, w = image.shape
    boundary = np.zeros_like(image)
    boundary[0, :] = image[-1, :] - image[0, :]
    boundary[-1, :] = -boundary[0, :]
    boundary[:, 0] += image[:, -1] - image[:, 0]
    boundary[:, -1] -= image[:, -1] - image[:, 0]
    denominator = 2*np.cos(2*np.pi*np.arange(w)/w)[None, :] + 2*np.cos(2*np.pi*np.arange(h)/h)[:, None] - 4
    denominator[0, 0] = 1
    smooth = np.fft.fft2(boundary)/denominator
    smooth[0, 0] = 0
    out = image - np.fft.ifft2(smooth).real
    out[0, :] = out[-1, :] = (out[0, :] + out[-1, :])/2
    out[:, 0] = out[:, -1] = (out[:, 0] + out[:, -1])/2
    return out

def save(name, kind, data):
    Image.fromarray(np.uint8(np.clip(data, 0, 1)*255+.5)).save(ROOT/f'{name}-{kind}.png')

report = {}
for name, roughness, metalness, strength in [('cloth', .92, 0, 4), ('leather', .73, 0, 4), ('mail', .48, .85, 12), ('iron', .52, .95, 3), ('brocade', .8, 0, 5), ('engraved', .5, .95, 5)]:
    source = Image.open(ROOT/'source'/f'{name}.png').convert('L').resize((1024, 1024), Image.Resampling.LANCZOS)
    grey = periodic(np.asarray(source, dtype=np.float64)/255)
    height = gaussian_filter(grey, .8, mode='wrap')
    detail = height-gaussian_filter(height, 16, mode='wrap')
    dx = (np.roll(height, -1, 1)-np.roll(height, 1, 1))*.5*strength
    dy = (np.roll(height, -1, 0)-np.roll(height, 1, 0))*.5*strength
    normal = np.stack([-dx, dy, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    # Preserve stronger ring/gap contrast, but remove most shading from textiles.
    base = np.clip(.78+(grey-grey.mean())*(.9 if name == 'mail' else .4), .15, .98)
    rough = np.clip(roughness-detail*.25, .1, 1)
    ao = np.clip(1+detail*.6, .7, 1)
    save(name, 'basecolor', np.repeat(base[..., None], 3, axis=2))
    save(name, 'height', height)
    save(name, 'normal', normal*.5+.5)
    save(name, 'roughness', rough)
    save(name, 'orm', np.stack([ao, rough, np.full_like(ao, metalness)], axis=-1))
    report[name] = {'size': [1024, 1024], 'normalConvention': 'OpenGL +Y', 'source': f'source/{name}.png',
        'heightMethod': 'approximate luminance microheight; not a geometry bake',
        'basecolorEdgeError': float(max(np.max(abs(base[0]-base[-1])), np.max(abs(base[:, 0]-base[:, -1])))),
        'normalUnitLengthMaxError': float(abs(np.linalg.norm(normal, axis=-1)-1).max())}
(ROOT/'bake-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
