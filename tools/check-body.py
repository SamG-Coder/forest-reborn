"""Check the delivered GLB, including topology and the no-reference-texture rule."""
import json
import struct
import numpy as np
import trimesh
from body_depth import ROOT

for name in ['male-depth-body.glb','male-silhouette-body.glb','male-uv-body.glb']:
    path=ROOT/'public/models'/name
    raw=path.read_bytes(); length,kind=struct.unpack_from('<II',raw,12)
    document=json.loads(raw[20:20+length])
    assert not document.get('images'), 'Reference images must never be embedded as textures'
    assert not document.get('textures'), 'This preview uses plain shader materials'
    scene=trimesh.load(path,force='scene')
    parts=list(scene.geometry.values())
    for part in parts:
        assert np.isfinite(part.vertices).all()
        assert np.isfinite(part.vertex_normals).all()
        assert part.visual.uv is not None
        assert np.isfinite(part.visual.uv).all()
        assert (part.visual.uv>=0).all() and (part.visual.uv<=1).all()
    surface=trimesh.util.concatenate(parts)
    surface.merge_vertices(merge_tex=True,merge_norm=True)
    assert surface.is_watertight, 'UV/material boundaries must weld into a closed surface'
    assert surface.is_winding_consistent
    assert len(surface.split())==1, 'Hands and shoulders must connect to the same body'
    assert len(surface.faces)<=45000
    print(f'{name}: closed connected surface; {len(surface.faces)} triangles; valid UVs; zero image textures')
