"""Run pretrained Depth Anything V2 Small ONNX on the actual reference artwork.

Produces raw relative inverse-depth tensors, 16-bit/colour previews and provenance.
No contour-derived depth is passed off as a network prediction.
"""
from pathlib import Path
import hashlib,json,time,urllib.request
import numpy as np
from PIL import Image
import cv2
import onnxruntime as ort

ROOT=Path(__file__).resolve().parents[1]
REVISION='4472b7362082ad9968fee890ca0f1e5aca36b93d'
REPOSITORY='onnx-community/depth-anything-v2-small'
MODEL=ROOT/'.cache/depth-anything-v2/model.onnx'
OUT=ROOT/'public/validation/network-depth'
SOURCE=ROOT/'public/assets/reference/male-head-three-views.png'

def main():
 OUT.mkdir(parents=True,exist_ok=True);MODEL.parent.mkdir(parents=True,exist_ok=True)
 if not MODEL.exists():urllib.request.urlretrieve(f'https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/onnx/model.onnx',MODEL)
 options=ort.SessionOptions();options.intra_op_num_threads=8
 session=ort.InferenceSession(str(MODEL),sess_options=options,providers=['CPUExecutionProvider'])
 image=Image.open(SOURCE).convert('RGB')
 crops={'sheet':(0,0,image.width,image.height),'front':(35,10,565,805),'threeQuarter':(620,10,1140,805),'profile':(1175,10,1774,805)}
 results={}
 for view,box in crops.items():
  crop=image.crop(box);crop.save(OUT/f'{view}-input.png')
  ratio=518/min(crop.size);size=tuple(max(14,round(v*ratio/14)*14) for v in crop.size)
  resized=np.asarray(crop.resize(size,Image.Resampling.BICUBIC),dtype=np.float32)/255
  pixels=((resized-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)).transpose(2,0,1)[None]
  started=time.perf_counter();raw=session.run(None,{session.get_inputs()[0].name:pixels})[0].squeeze();elapsed=time.perf_counter()-started
  prediction=cv2.resize(raw,crop.size,interpolation=cv2.INTER_CUBIC)
  np.save(OUT/f'{view}-raw.npy',prediction)
  low,high=np.percentile(prediction,[1,99]);normalized=np.clip((prediction-low)/(high-low),0,1)
  Image.fromarray((normalized*65535).astype(np.uint16)).save(OUT/f'{view}-depth16.png')
  Image.fromarray((normalized*255).astype(np.uint8)).save(OUT/f'{view}-depth.png')
  colored=cv2.cvtColor(cv2.applyColorMap((normalized*255).astype(np.uint8),cv2.COLORMAP_INFERNO),cv2.COLOR_BGR2RGB);Image.fromarray(colored).save(OUT/f'{view}-color.png')
  results[view]={'crop':box,'inputShape':list(pixels.shape),'outputShape':list(prediction.shape),'seconds':elapsed,'rawMin':float(prediction.min()),'rawMax':float(prediction.max()),'displayPercentiles':[float(low),float(high)]}
  print(f'{view}: actual network inference {elapsed:.2f}s, raw {prediction.shape}',flush=True)
 provenance={'model':'Depth Anything V2 Small','repository':REPOSITORY,'revision':REVISION,'weightsSHA256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'runtime':f'onnxruntime {ort.__version__}','provider':session.get_providers(),'preprocess':'RGB bicubic, shorter side 518, dimensions multiple of 14; /255 then ImageNet mean/std','meaning':'Relative inverse depth. Larger values are closer; not metric depth or calibrated multi-view depth.','views':results}
 (OUT/'provenance.json').write_text(json.dumps(provenance,indent=2))

if __name__=='__main__':main()
