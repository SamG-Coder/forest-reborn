"""Choose the lightest closed mesh that meets sampled shape-error limits."""
import json
import numpy as np
import trimesh
from body_depth import ROOT
from body_finish import unwrap_surface

OUT=ROOT/'public/validation/body'
scene=trimesh.load(ROOT/'public/models/male-depth-body.glb',force='scene')
source=trimesh.util.concatenate(list(scene.geometry.values()))
source.merge_vertices(merge_tex=True,merge_norm=True)
source.remove_unreferenced_vertices()
samples,_=trimesh.sample.sample_surface(source,20000,seed=41)
# Include every original hand vertex so small fingers aren't lost in body averages.
hands=source.vertices[np.abs(source.vertices[:,0])>.84]
reference_points=np.vstack([samples,hands])
results=[];selected=None
for count in [6000,9000,12000,18000]:
    mesh=source.simplify_quadric_decimation(face_count=count,aggression=3)
    mesh.fix_normals()
    probe,_=trimesh.sample.sample_surface(mesh,20000,seed=41)
    _,forward,_=trimesh.proximity.closest_point(mesh,reference_points)
    _,reverse,_=trimesh.proximity.closest_point(source,probe)
    errors=np.concatenate([forward,reverse])*1000
    result={'triangles':len(mesh.faces),'vertices':len(mesh.vertices),'meanErrorMM':float(errors.mean()),'p99ErrorMM':float(np.percentile(errors,99)),'sampledMaxErrorMM':float(errors.max()),'handMaxErrorMM':float(forward[-len(hands):].max()*1000),'closed':bool(mesh.is_watertight)}
    result['accepted']=result['closed'] and result['p99ErrorMM']<.8 and result['sampledMaxErrorMM']<2 and result['handMaxErrorMM']<1
    results.append(result);print(result,flush=True)
    if result['accepted']:
        selected=mesh;break
if selected is None:
    raise RuntimeError('No candidate meets shape limits; original retained')
layout,uv=unwrap_surface(selected,ROOT/'public/models','male-uv-body.glb')
layout.save(OUT/'male-uv-layout.png')
report={'sourceTriangles':len(source.faces),'selected':results[-1],'candidates':results,'uv':uv,'measurement':'Bidirectional sampled point-to-triangle distance, 20k samples per surface plus all source hand vertices. Not an exhaustive Hausdorff bound.','topology':'Simplified triangles; not anatomical quad retopology. No image textures.'}
(OUT/'simplification.json').write_text(json.dumps(report,indent=2))
