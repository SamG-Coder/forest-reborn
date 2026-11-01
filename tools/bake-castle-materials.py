"""Bake only the generated castle swatches. Normals are estimated microdetail, not geometry bakes."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT = Path(__file__).resolve().parents[1] / 'public/assets/world'

def periodic(image):
    h, w = image.shape
    boundary = np.zeros_like(image)
    boundary[0] = image[-1] - image[0]
    boundary[-1] = -boundary[0]
    boundary[:, 0] += image[:, -1] - image[:, 0]
    boundary[:, -1] -= image[:, -1] - image[:, 0]
    denominator = 2*np.cos(2*np.pi*np.arange(w)/w)[None, :] + 2*np.cos(2*np.pi*np.arange(h)/h)[:, None] - 4
    denominator[0, 0] = 1
    spectrum = np.fft.fft2(boundary) / denominator
    spectrum[0, 0] = 0
    result = image - np.fft.ifft2(spectrum).real
    result[0] = result[-1] = (result[0] + result[-1]) / 2
    result[:, 0] = result[:, -1] = (result[:, 0] + result[:, -1]) / 2
    return result

report = {}
for name, strength, roughness in [('castle-limestone', 4, .93), ('castle-slate', 4, .83), ('castle-bedrock', 5, .98)]:
    source = np.asarray(Image.open(ROOT / 'source' / f'{name}.png').convert('RGB').resize((1024, 1024)), dtype=float) / 255
    rgb = np.clip(np.stack([periodic(source[:, :, channel]) for channel in range(3)], axis=2), 0, 1)
    height = gaussian_filter(rgb @ np.array([.2126, .7152, .0722]), 1, mode='wrap')
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * .5 * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * .5 * strength
    normal = np.stack([-dx, dy, np.ones_like(dx)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    maps = {'basecolor': rgb, 'normal': normal*.5+.5, 'roughness': np.clip(roughness + (height-height.mean())*.1, 0, 1)}
    for suffix, data in maps.items():
        Image.fromarray(np.uint8(np.clip(data, 0, 1)*255+.5)).save(ROOT / f'{name}-{suffix}.png')
    report[name] = {'size': 1024, 'normalConvention': 'OpenGL +Y', 'normalSource': 'estimated luminance microheight; not geometry-baked',
                    'basecolorEdgeError': float(max(abs(rgb[0]-rgb[-1]).max(), abs(rgb[:, 0]-rgb[:, -1]).max()))}
(ROOT / 'castle-bake-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
