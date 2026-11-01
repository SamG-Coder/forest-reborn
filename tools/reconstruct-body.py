"""Build a closed experimental male surface from silhouettes and learned depth.

Coordinates during fitting are source-image pixels: x right, y down, z forward.
Front/back relative network predictions modulate rounded cross sections. Side
and overhead silhouettes calibrate thickness. This is depth-assisted fitting,
not calibrated photogrammetry. Diagonal images are never read by fit_surface.
"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.measure import marching_cubes
import trimesh
from body_depth import ROOT, DepthPredictor
from body_finish import finish_anatomy, unwrap_surface

SOURCES = ROOT / 'public/assets/body-views'
OUTPUT = ROOT / 'public/validation/body'
VIEWS = ['front', 'back', 'left', 'top', 'front-quarter', 'rear-quarter']


def foreground(rgb):
    # Saturation separates peach/charcoal artwork from the near-white backdrop.
    mask = (rgb.min(axis=2) < 215) & ((rgb.max(axis=2) - rgb.min(axis=2) > 12) | (rgb.mean(axis=2) < 170))
    labels, _ = ndi.label(mask)
    counts = np.bincount(labels.ravel()); counts[0] = 0
    return ndi.binary_fill_holes(labels == counts.argmax())


def bounds(mask):
    y, x = np.where(mask)
    return [int(x.min()), int(y.min()), int(x.max()), int(y.max())]


def prepare():
    """Align vertical views by crown/sole; overhead by arm span, without warping."""
    data = {}
    for name in VIEWS:
        rgb = np.asarray(Image.open(SOURCES / f'{name}.png').convert('RGB'))
        mask = foreground(rgb); box = bounds(mask)
        raw = np.load(OUTPUT / f'{name}-depth.npy')
        if name == 'top':
            scale = 1132 / (box[2] - box[0])
            # Arm axis measured away from torso; z=0 lies on arm centerline.
            ys, _ = np.where(mask[:, box[0]+80:box[0]+300])
            center_y = float(np.median(ys))
            matrix = np.float32([[scale, 0, 768-scale*(box[0]+box[2])/2], [0, scale, 512-scale*center_y]])
        else:
            scale = 984 / (box[3] - box[1])
            # Body axis from central waist, not asymmetric arm silhouettes.
            waist_y = int(box[1] + .39 * (box[3]-box[1]))
            xx = np.where(mask[waist_y])[0]
            center_x = (xx[0]+xx[-1])/2
            matrix = np.float32([[scale, 0, 768-scale*center_x], [0, scale, 15-scale*box[1]]])
        rgb = cv2.warpAffine(rgb, matrix, (1536,1024), borderValue=(255,255,255))
        mask = cv2.warpAffine(mask.astype('uint8'), matrix, (1536,1024), flags=cv2.INTER_NEAREST).astype(bool)
        raw = cv2.warpAffine(raw, matrix, (1536,1024))
        Image.fromarray(rgb).save(OUTPUT / f'{name}-aligned.png')
        Image.fromarray(np.uint8(mask)*255).save(OUTPUT / f'{name}-mask.png')
        data[name] = dict(rgb=rgb, mask=mask, depth=raw, alignment=matrix.tolist(), originalBounds=box)
    return data


def smooth_masked(values, mask, sigma):
    return ndi.gaussian_filter(values*mask, sigma) / np.maximum(ndi.gaussian_filter(mask.astype(float), sigma), 1e-6)


def fit_surface(data, depth_strength):
    front = data['front']; mask = front['mask']
    side = data['left']['mask']
    # Smooth per-height front/back extents observed in the side drawing.
    back_extent = np.zeros(1024); front_extent = np.zeros(1024)
    for y in range(1024):
        xs = np.where(side[y])[0]
        if len(xs):
            back_extent[y], front_extent[y] = xs[0]-768, xs[-1]-768
    back_extent = ndi.gaussian_filter1d(back_extent, 4)
    front_extent = ndi.gaussian_filter1d(front_extent, 4)
    center = (front_extent+back_extent)/2
    radius = np.maximum((front_extent-back_extent)/2, 4)
    # Front silhouette's local distance gives a rounded section rather than a slab.
    distance = ndi.distance_transform_edt(mask)
    rounding = np.zeros_like(distance)
    for y in range(1024):
        labels,count=ndi.label(mask[y])
        for label in range(1,count+1):
            run=np.where(labels==label)[0]
            lo,hi=run[0],run[-1]
            if 165<y<255 and hi-lo>300:
                # Extend the torso section beneath the deltoid blend. Ending
                # at the shoulder center creates an hourglass-shaped joint.
                lo,hi=548,988
            center_x=(lo+hi)/2; width=max((hi-lo)/2,1)
            rounding[y,run]=np.sqrt(np.clip(1-((run-center_x)/width)**2,0,1))
    half = rounding*radius[:,None]
    centers = np.broadcast_to(center[:,None], mask.shape).copy()
    # Overhead silhouette supplies separate thickness for the horizontal arms.
    top = data['top']['mask']
    for x in range(1536):
        if abs(x-768) < 100:
            continue
        ys = np.where(top[:, x])[0]
        fy = np.where(mask[:, x])[0]
        if not len(ys) or not len(fy):
            continue
        lo, hi = fy[0], fy[-1]
        arm_y = (lo+hi)/2; arm_r = max((hi-lo)/2,1)
        arm_shape = np.sqrt(np.clip(1-((np.arange(1024)-arm_y)/arm_r)**2,0,1))
        top_radius = np.clip((ys[-1]-ys[0])/2, 10, 65)
        blend = np.clip((abs(x-768)-100)/100,0,1)
        blend = blend*blend*(3-2*blend)
        half[:,x] = half[:,x]*(1-blend)+arm_shape*top_radius*blend
        centers[:,x] *= 1-blend
    # Network prediction contributes bounded relief. Remove only broad drift;
    # retain the network's local chest, knees, calves and head depth structure.
    residuals = []
    for name in ['front','back']:
        d = data[name]['depth']; m = data[name]['mask']
        if name == 'back':
            d = np.fliplr(d); m = np.fliplr(m)
        d = smooth_masked(d,m,2)
        residual = d-smooth_masked(d,m,28)
        limit = np.percentile(np.abs(residual[mask]),95)
        residuals.append(np.clip(residual/max(limit,1e-6),-1,1))
    relief_front = depth_strength*half*residuals[0]
    relief_back = depth_strength*half*residuals[1]
    zfront = centers+half+relief_front
    zback = centers-half-relief_back
    # Preserve profile constraints in torso/legs, where the side view is visible.
    core = np.abs(np.arange(1536)-768)<145
    zfront[:,core] = np.minimum(zfront[:,core], front_extent[:,None])
    zback[:,core] = np.maximum(zback[:,core], back_extent[:,None])
    # The blank head has a smooth cranium; ear silhouette pixels must not
    # inflate into a second large lobe. Preserve thin integrated ear rims.
    for y in range(15,150):
        xs = np.where(mask[y])[0]
        if not len(xs):
            continue
        width = min((xs[-1]-xs[0])/2, 45)
        x = np.arange(1536)-768
        section = np.sqrt(np.clip(1-(x/max(width,1))**2,0,1))
        section = np.maximum(section, np.where(mask[y], .09, 0))
        zfront[y] = center[y]+radius[y]*section+relief_front[y]*.25
        zback[y] = center[y]-radius[y]*section-relief_back[y]*.25
    zfront = smooth_masked(zfront,mask,2.5)
    zback = smooth_masked(zback,mask,2.5)
    return zfront, zback, distance, {'meanReliefPixels':float(np.abs(relief_front[mask]).mean()), 'maxReliefPixels':float(np.abs(relief_front[mask]).max())}


def mesh_surface(data, strength, filename):
    front, back, distance, influence = fit_surface(data,strength)
    step = 2.0
    xs = np.arange(175,1360,step); ys = np.arange(3,1014,step); zs = np.arange(-155,185,step)
    xx, yy = np.meshgrid(xs,ys,indexing='ij')
    ix,iy = xx.astype(int),yy.astype(int)
    sdf2 = distance-ndi.distance_transform_edt(~data['front']['mask'])
    field = np.minimum(np.minimum(front[iy,ix,None]-zs, zs-back[iy,ix,None]), sdf2[iy,ix,None]).astype('float32')
    field = ndi.gaussian_filter(field,.65)
    field = finish_anatomy(field, xs, ys, zs)
    verts,faces,_,_ = marching_cubes(field,0,spacing=(step,step,step))
    verts += [xs[0],ys[0],zs[0]]
    # metres, conventional Three.js +Y up / +Z forward
    world = np.column_stack([(verts[:,0]-768)/550,(999-verts[:,1])/550,verts[:,2]/550])
    mesh = trimesh.Trimesh(world,faces,process=True)
    mesh.fix_normals()
    parts = mesh.split(only_watertight=False)
    mesh = max(parts,key=lambda part:len(part.faces))
    trimesh.smoothing.filter_taubin(mesh, lamb=.5, nu=.53, iterations=12)
    mesh = mesh.simplify_quadric_decimation(face_count=45000, aggression=3)
    mesh.fix_normals()
    print(f'Unwrapping {filename}: {len(mesh.faces)} triangles',flush=True)
    atlas, uv_report = unwrap_surface(mesh,ROOT / 'public/models',filename)
    if strength:
        atlas.save(OUTPUT/'body-uv-layout.png')
    return {'vertices':len(mesh.vertices),'triangles':len(mesh.faces),'watertight':bool(mesh.is_watertight),'componentsBeforeCleanup':len(parts),'boundsMetres':mesh.bounds.tolist(),'uv':uv_report,**influence}



def main():
    parser=argparse.ArgumentParser();parser.add_argument('--skip-inference',action='store_true');args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    if not args.skip_inference:
        predictor=DepthPredictor();provenance=predictor.provenance();provenance['views']={}
        for name in VIEWS:
            provenance['views'][name]=predictor.predict(SOURCES/f'{name}.png',OUTPUT/f'{name}-depth')
            print(f'{name}: actual network inference complete',flush=True)
        (OUTPUT/'depth-provenance.json').write_text(json.dumps(provenance,indent=2))
    data=prepare()
    result={'method':'Silhouette-constrained rounded surface with Depth Anything V2 front/back relief; side/top thickness calibration',
            'fitViews':VIEWS[:4],'heldOutViews':VIEWS[4:],'depthStrength':.30,
            'calibration':{k:{'alignment':v['alignment'],'originalBounds':v['originalBounds']} for k,v in data.items()}}
    result['withDepth']=mesh_surface(data,.30,'male-depth-body.glb')
    result['withoutDepth']=mesh_surface(data,0,'male-silhouette-body.glb')
    (OUTPUT/'reconstruction.json').write_text(json.dumps(result,indent=2))
    print(json.dumps(result['withDepth'],indent=2))


if __name__=='__main__':
    main()
