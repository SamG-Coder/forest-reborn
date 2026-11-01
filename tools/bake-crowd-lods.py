"""Decimate a rest-pose outfit exported by the lab; preserve sampled skin weights.

This is a crowd proxy bake, not retopology for close-up hero characters.
"""
import json
from pathlib import Path
import numpy as np
import trimesh
from scipy.spatial import cKDTree

ROOT=Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'public/models/crowd-source.json').read_text())
vertices=np.array(data['position']).reshape(-1,3)
faces=np.array(data['index']).reshape(-1,3)
colors=np.array(data['color']).reshape(-1,3)
skin_ids=np.array(data['skinIndex']).reshape(-1,4)
skin_weights=np.array(data['skinWeight']).reshape(-1,4)
source=trimesh.Trimesh(vertices,faces,process=False)
source.merge_vertices(merge_tex=True,merge_norm=True)
tree=cKDTree(vertices)
report=[]
for level,count in enumerate([6000,1800,500]):
    mesh=source.simplify_quadric_decimation(face_count=count,aggression=4)
    distance,nearest=tree.query(mesh.vertices,k=1)
    result={'position':np.round(mesh.vertices,6).ravel().tolist(),'normal':np.round(mesh.vertex_normals,6).ravel().tolist(),
        'index':mesh.faces.ravel().tolist(),'color':np.round(colors[nearest],5).ravel().tolist(),
        'skinIndex':skin_ids[nearest].ravel().tolist(),'skinWeight':np.round(skin_weights[nearest],7).ravel().tolist()}
    (ROOT/f'public/models/crowd-lod{level}.json').write_text(json.dumps(result,separators=(',',':')))
    report.append({'level':level,'triangles':len(mesh.faces),'vertices':len(mesh.vertices),'nearestSourceVertexMaxDistance':float(distance.max()),'note':'Distance to nearest source vertex is not a surface-error bound.'})
(ROOT/'public/models/crowd-lods-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
