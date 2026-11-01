"""Reference-image contour reconstruction and independently rendered error report.

Annotations trim away neck, ears and text; boundaries hidden behind ears are
estimated. This is a silhouette-constrained depth estimate, not measured depth.
The third illustration is used for cross-section/camera calibration after the
front/profile contour reconstruction; it is not an independent test set.
"""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter1d, binary_fill_holes, binary_erosion, distance_transform_edt

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/validation'
SOURCE=ROOT/'public/assets/reference/male-head-three-views.png'
SIZE=512
HEIGHT=430
ANNOTATIONS={
 'front':{'top':32,'chin':633,'polygon':[(299,32),(245,37),(190,62),(146,99),(112,151),(98,200),(96,253),(104,302),(111,352),(119,411),(133,477),(151,525),(190,572),(237,616),(271,631),(308,633),(345,625),(384,593),(425,549),(451,506),(466,454),(481,387),(492,321),(499,262),(498,207),(485,152),(456,104),(411,65),(358,39)]},
 'threeQuarter':{'top':32,'chin':629,'polygon':[(881,32),(948,36),(1005,54),(1052,83),(1082,123),(1099,176),(1107,224),(1113,267),(1118,291),(1103,329),(1093,378),(1080,411),(1068,437),(1054,451),(1051,480),(1043,502),(1047,519),(1042,564),(1030,607),(1013,624),(973,629),(933,621),(882,603),(826,575),(778,541),(744,502),(729,465),(714,409),(696,355),(672,311),(655,275),(647,231),(651,182),(670,140),(704,102),(751,71),(807,47)]},
 'profile':{'top':32,'chin':621,'origin':1520,'polygon':[(1485,32),(1554,39),(1613,64),(1651,102),(1675,153),(1688,211),(1694,260),(1709,289),(1711,306),(1701,323),(1704,346),(1722,378),(1747,412),(1754,429),(1744,439),(1720,446),(1694,451),(1697,470),(1712,486),(1706,496),(1696,506),(1699,526),(1686,539),(1685,563),(1689,582),(1682,607),(1665,621),(1632,617),(1587,601),(1540,576),(1495,551),(1452,520),(1413,478),(1367,449),(1319,418),(1271,377),(1235,329),(1214,277),(1207,220),(1213,170),(1237,121),(1277,80),(1330,52),(1394,36)]}
}

def references():
 image=Image.open(SOURCE).convert('RGB');rgb=np.asarray(image).astype(float);result={}
 for view,annotation in ANNOTATIONS.items():
  trim=Image.new('L',image.size);ImageDraw.Draw(trim).polygon(annotation['polygon'],fill=255)
  # Skin-colour segmentation rejects paper and captions inside the trim region.
  skin=(rgb[:,:,0]-rgb[:,:,2]>16)&(rgb[:,:,0]>85)
  mask=binary_fill_holes(skin & (np.asarray(trim)>0))
  ys,xs=np.where(mask);center=(xs.min()+xs.max())/2
  scale=HEIGHT/(annotation['chin']-annotation['top'])
  transform=(1/scale,0,center-SIZE/2/scale,0,1/scale,annotation['top']-30/scale)
  normalized=Image.fromarray((mask*255).astype(np.uint8)).transform((SIZE,SIZE),Image.Transform.AFFINE,transform,Image.Resampling.NEAREST)
  artwork=image.transform((SIZE,SIZE),Image.Transform.AFFINE,transform,Image.Resampling.BICUBIC,fillcolor='white')
  white=Image.new('RGB',(SIZE,SIZE),'white');white.paste(artwork,mask=normalized)
  normalized.save(OUT/f'reference-{view}-mask.png');white.save(OUT/f'reference-{view}.png')
  result[view]=(mask,annotation)
 (OUT/'annotations.json').write_text(json.dumps({'source':str(SOURCE.relative_to(ROOT)),'method':'Manual neck/ear exclusion polygons plus skin segmentation; occluded contours estimated.','views':ANNOTATIONS},indent=2))
 return result

def scanlines(mask,annotation):
 ys=np.arange(annotation['top'],annotation['chin']+1);left=[];right=[]
 for y in ys:
  x=np.where(mask[y])[0];left.append(x.min() if len(x) else np.nan);right.append(x.max() if len(x) else np.nan)
 left=np.array(left);right=np.array(right)
 for values in [left,right]:
  ok=np.isfinite(values);values[:]=np.interp(np.arange(len(values)),np.where(ok)[0],values[ok]);values[:]=gaussian_filter1d(values,1.5)
 return ys,left,right

def fit():
 refs=references();fy,fl,fr=scanlines(*refs['front']);sy,sl,sr=scanlines(*refs['profile'])
 rows=[];worldHeight=.645
 for t in np.linspace(0,1,161):
  frontY=633-t*(633-32);sideY=621-t*(621-32)
  width=(np.interp(frontY,fy,fr)-np.interp(frontY,fy,fl))/2*worldHeight/(633-32)
  front=(np.interp(sideY,sy,sr)-1520)*worldHeight/(621-32)
  back=(np.interp(sideY,sy,sl)-1520)*worldHeight/(621-32)
  rows.append([2.40+t*worldHeight,float(max(.001,width)),float(front),float(back)])
 # Close both poles, without flattening the forehead or chin contours below them.
 rows[0][1]=rows[-1][1]=.001
 rows[0][3]=rows[0][2]-.001;rows[-1][3]=rows[-1][2]-.001
 data={'enabled':True,'method':'front/profile contour-constrained cross-section reconstruction','source':str(SOURCE.relative_to(ROOT)),'heldOutView':'threeQuarter','rows':rows}
 (ROOT/'src/fitting/head-fit.json').write_text(json.dumps(data,indent=2))
 # An explicit estimated depth map from the fitted cross-sections, not monocular ground truth.
 depth=np.zeros((SIZE,SIZE));valid=np.zeros((SIZE,SIZE),dtype=bool)
 for row in range(30,461):
  y=3.045-(row-30)/HEIGHT*worldHeight;w=np.interp(y,np.array(rows)[:,0],np.array(rows)[:,1]);f=np.interp(y,np.array(rows)[:,0],np.array(rows)[:,2]);b=np.interp(y,np.array(rows)[:,0],np.array(rows)[:,3])
  x=(np.arange(SIZE)-256)/HEIGHT*worldHeight;inside=np.abs(x)<=w;center=(f+b)/2
  depth[row,inside]=center+(f-center)*np.sqrt(np.maximum(0,1-(x[inside]/w)**2));valid[row,inside]=True
 values=depth[valid];depth[valid]=(values-values.min())/(values.max()-values.min())*240+15
 Image.fromarray(depth.astype(np.uint8)).save(OUT/'estimated-front-depth.png')
 print('Wrote measured contour profiles and estimated-front-depth.png. Three-quarter held out.')

def metric(target,predicted):
 union=np.logical_or(target,predicted).sum();iou=np.logical_and(target,predicted).sum()/union
 a=target^binary_erosion(target);b=predicted^binary_erosion(predicted)
 distances=np.concatenate([distance_transform_edt(~a)[b],distance_transform_edt(~b)[a]])
 return {'silhouetteIoU':float(iou),'meanBoundaryErrorPx':float(distances.mean()),'p95BoundaryErrorPx':float(np.percentile(distances,95)),'normalizedMeanErrorPercentOfHeadHeight':float(distances.mean()/HEIGHT*100)}

def report():
 fit=json.loads((ROOT/'src/fitting/head-fit.json').read_text())
 report={'alignment':'Orthographic; uniform 430px head height, centred silhouette bounding box; no nonrigid image warp.','scope':'Cranial silhouette only, excluding ears and neck. Reference masks use recorded manual trim annotations. Interior features and texture similarity are not scored.','depth':'Estimated from front/profile contours. Not measured or uniquely recovered depth.','thirdViewCameraDegrees':fit.get('threeQuarterAngle',45),'baselineThirdViewCameraDegrees':45,'crossSectionExponent':fit.get('frontExponent',.5),'validation':'All three views used for fitting. Camera and shape jointly fitted for third view; scores are training-fit errors, not independent reconstruction accuracy.','views':{}}
 for view in ANNOTATIONS:
  target=np.asarray(Image.open(OUT/f'reference-{view}-mask.png'))>127
  reference=Image.open(OUT/f'reference-{view}.png').convert('RGB')
  results={}
  panels=[]
  for stage in ['baseline','fitted']:
   prediction=np.asarray(Image.open(OUT/f'{stage}-{view}-mask.png').convert('L'))<127
   results[stage]=metric(target,prediction)
   overlay=np.asarray(reference).copy();refEdge=target^binary_erosion(target,iterations=2);modelEdge=prediction^binary_erosion(prediction,iterations=2)
   overlay[refEdge]=[18,180,135];overlay[modelEdge]=[223,43,103]
   Image.fromarray(overlay).save(OUT/f'{stage}-{view}-overlay.png')
   difference=np.full((SIZE,SIZE,3),245,dtype=np.uint8);difference[target&prediction]=[195,216,205];difference[target&~prediction]=[18,180,135];difference[prediction&~target]=[223,43,103]
   Image.fromarray(difference).save(OUT/f'{stage}-{view}-error.png')
  results['usedForFit']=True;report['views'][view]=results
 (OUT/'metrics.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))

OUT.mkdir(exist_ok=True)
if __name__=='__main__':
 if len(sys.argv)>1 and sys.argv[1]=='report':report()
 else:fit()
