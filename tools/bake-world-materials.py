"""Create periodic RGB tiles and approximate microdetail normals from generated art."""
from pathlib import Path
import json
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ROOT=Path(__file__).resolve().parents[1]/'public/assets/world'

def periodic(a):
    h,w=a.shape
    b=np.zeros_like(a)
    b[0]=a[-1]-a[0];b[-1]=-b[0]
    b[:,0]+=a[:,-1]-a[:,0];b[:,-1]-=a[:,-1]-a[:,0]
    d=2*np.cos(2*np.pi*np.arange(w)/w)[None,:]+2*np.cos(2*np.pi*np.arange(h)/h)[:,None]-4
    d[0,0]=1;s=np.fft.fft2(b)/d;s[0,0]=0
    a=a-np.fft.ifft2(s).real
    a[0]=a[-1]=(a[0]+a[-1])/2;a[:,0]=a[:,-1]=(a[:,0]+a[:,-1])/2
    return a

report={}
for name,strength,roughness in [('ground',3,.98),('paving',5,.92),('plaster',2,.94),('roof',4,.87),('masonry',5,.95),('roof-clay',4,.88),('wall-brick',4,.93),('wall-timber',3,.9),('bark',5,.98),('birch-bark',3,.96)]:
    source=np.asarray(Image.open(ROOT/'source'/f'{name}.png').convert('RGB').resize((1024,1024)),dtype=float)/255
    rgb=np.clip(np.stack([periodic(source[:,:,i]) for i in range(3)],axis=2),0,1)
    height=gaussian_filter(rgb@np.array([.2126,.7152,.0722]),1,mode='wrap')
    dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.5*strength
    dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.5*strength
    normal=np.stack([-dx,dy,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
    for suffix,data in [('basecolor',rgb),('normal',normal*.5+.5),('roughness',np.clip(roughness+(height-height.mean())*.1,0,1))]:
        Image.fromarray(np.uint8(np.clip(data,0,1)*255+.5)).save(ROOT/f'{name}-{suffix}.png')
    report[name]={'size':1024,'normalConvention':'OpenGL +Y','normalSource':'approximate luminance microheight, not a geometry bake','basecolorEdgeError':float(max(abs(rgb[0]-rgb[-1]).max(),abs(rgb[:,0]-rgb[:,-1]).max()))}
(ROOT/'bake-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
