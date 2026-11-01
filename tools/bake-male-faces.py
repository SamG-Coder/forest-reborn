"""Bake NEW generated face artwork into the selected base mesh's existing UVs.

Creates independent RGBA detail and grayscale iris masks. No modelling reference
images are consumed. Original generated texture images remain unchanged.
"""
import json
import numpy as np
import cv2
import trimesh
from scipy import ndimage as ndi
from PIL import Image
from body_depth import ROOT

ASSETS=ROOT/'public/assets/male'; OUT=ASSETS/'uv'; OUT.mkdir(exist_ok=True)
SIZE=2048
styles={'calm':[(370,540,48),(882,540,48)],'resolute':[(358,520,54),(896,520,54)],'gentle':[(371,531,52),(883,531,52)],'wry':[(355,516,50),(896,516,50)],'stern':[(369,535,52),(883,535,52)]}
scene=trimesh.load(ROOT/'public/models/male-uv-body.glb',force='scene')
records=[]
for mesh in scene.geometry.values():
    uv=mesh.visual.uv*np.array([SIZE-1,SIZE-1]); uv[:,1]=SIZE-1-uv[:,1]
    for face in mesh.faces:
        p=mesh.vertices[face]
        if p[:,1].max()<1.51 or p[:,2].max()<.005: continue
        tri=uv[face];a,b,c=tri
        lo=np.maximum(np.floor(tri.min(axis=0)).astype(int),0);hi=np.minimum(np.ceil(tri.max(axis=0)).astype(int),SIZE-1)
        xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1))
        den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-8: continue
        wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den
        wc=1-wa-wb; inside=(wa>=0)&(wb>=0)&(wc>=0)
        weights=np.column_stack([wa[inside],wb[inside],wc[inside]])
        pos=weights@p
        u=pos[:,0]/.19+.5;v=(1.80-pos[:,1])/.29
        visible=(u>0)&(u<1)&(v>0)&(v<1)&(pos[:,2]>.005)
        records.append((yy[inside][visible],xx[inside][visible],u[visible],v[visible]))
Y=np.concatenate([r[0] for r in records]);X=np.concatenate([r[1] for r in records]);U=np.concatenate([r[2] for r in records]);V=np.concatenate([r[3] for r in records])
occupied=np.zeros((SIZE,SIZE),bool);occupied[Y,X]=True
dist,nearest=ndi.distance_transform_edt(~occupied,return_indices=True)
padding=(~occupied)&(dist<=5)
for name,eyes in styles.items():
    src=np.asarray(Image.open(ASSETS/f'face-{name}.png').convert('L'),dtype=float)
    h,w=src.shape
    # A dedicated face UV channel keeps the full artwork resolution instead of
    # spending most of a body atlas on skin. Retain the atlas bake for interchange.
    sy,sx=np.mgrid[:h,:w]
    source_bg=float(np.median(src[:int(h*.2)]))
    source_alpha=np.clip((np.abs(src-source_bg)-7)/23,0,1)
    source_iris=np.zeros_like(src)
    for cx,cy,r in eyes:
        rad=np.sqrt(((sx*1254/w-cx)/r)**2+((sy*1254/h-cy)/r)**2)
        source_iris=np.maximum(source_iris,np.clip((1-rad)*10,0,1))
    source_iris*=np.clip((src-35)/30,0,1)*np.clip((205-src)/35,0,1)
    layer=np.dstack([src,src,src,source_alpha*255]).astype('uint8')
    Image.fromarray(layer).save(OUT/f'layer-{name}.png')
    Image.fromarray((source_iris*255).astype('uint8')).save(OUT/f'layer-iris-{name}.png')
    gray=ndi.map_coordinates(src,[V*(h-1),U*(w-1)],order=1,mode='nearest')
    # Grey background is transparent; authored dark marks and whites are retained.
    bg=float(np.median(src[:int(h*.2)]))
    alpha=np.clip((np.abs(gray-bg)-7)/23,0,1)
    color=gray.copy()
    mask=np.zeros(len(U))
    for cx,cy,r in eyes:
        radius=np.sqrt(((U*1254-cx)/r)**2+((V*1254-cy)/r)**2)
        mask=np.maximum(mask,np.clip((1-radius)*10,0,1))
    mask*=np.clip((gray-35)/30,0,1)*np.clip((205-gray)/35,0,1)
    rgba=np.zeros((SIZE,SIZE,4),np.uint8);rgba[Y,X,:3]=gray[:,None].astype('uint8');rgba[Y,X,3]=(alpha*255).astype('uint8')
    iris=np.zeros((SIZE,SIZE),np.uint8);iris[Y,X]=(mask*255).astype('uint8')
    rgba[padding]=rgba[nearest[0][padding],nearest[1][padding]];iris[padding]=iris[nearest[0][padding],nearest[1][padding]]
    Image.fromarray(rgba).save(OUT/f'face-{name}.png');Image.fromarray(iris).save(OUT/f'iris-{name}.png')
    print(f'{name}: UV detail + iris mask',flush=True)
(OUT/'manifest.json').write_text(json.dumps({'sourceModel':'male-uv-body.glb','size':SIZE,'styles':styles,'faceProjection':{'width':.19,'top':1.80,'height':.29},'sourceImages':'new generated face maps only'},indent=2))
