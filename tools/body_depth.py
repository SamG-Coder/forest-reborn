"""Reproducible relative-depth inference; no geometric estimates in these outputs."""
from pathlib import Path
import hashlib
import time
import urllib.request
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REVISION = '4472b7362082ad9968fee890ca0f1e5aca36b93d'
REPOSITORY = 'onnx-community/depth-anything-v2-small'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class DepthPredictor:
    def __init__(self):
        self.path = ROOT / '.cache/depth-anything-v2/model.onnx'
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            urllib.request.urlretrieve(f'https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/onnx/model.onnx', self.path)
        options = ort.SessionOptions()
        options.intra_op_num_threads = 8
        self.session = ort.InferenceSession(str(self.path), sess_options=options, providers=['CPUExecutionProvider'])

    def predict(self, path, destination):
        image = Image.open(path).convert('RGB')
        ratio = 518 / min(image.size)
        size = tuple(max(14, round(v * ratio / 14) * 14) for v in image.size)
        rgb = np.asarray(image.resize(size, Image.Resampling.BICUBIC), dtype=np.float32) / 255
        pixels = ((rgb - np.array([.485, .456, .406], np.float32)) / np.array([.229, .224, .225], np.float32)).transpose(2, 0, 1)[None]
        start = time.perf_counter()
        prediction = self.session.run(None, {self.session.get_inputs()[0].name: pixels})[0].squeeze()
        raw = cv2.resize(prediction, image.size, interpolation=cv2.INTER_CUBIC)
        np.save(destination.with_suffix('.npy'), raw)
        low, high = np.percentile(raw, [1, 99])
        display = np.uint8(np.clip((raw - low) / (high - low), 0, 1) * 255)
        cv2.imwrite(str(destination.with_suffix('.png')), cv2.applyColorMap(display, cv2.COLORMAP_INFERNO))
        return {'sourceSHA256': sha256(path), 'seconds': time.perf_counter() - start, 'inputShape': list(pixels.shape), 'range': [float(raw.min()), float(raw.max())]}

    def provenance(self):
        return {'model': 'Depth Anything V2 Small', 'repository': REPOSITORY, 'revision': REVISION,
                'weightsSHA256': sha256(self.path), 'runtime': ort.__version__, 'provider': self.session.get_providers(),
                'meaning': 'Relative inverse depth, larger is closer. Each view has unknown scale and offset; not metric depth.'}
