"""Reusable anatomy finishing and UV layout generation for the male base.

Reference artwork is deliberately never read or baked by this module.
"""
import numpy as np
import cv2
from scipy import ndimage as ndi
from PIL import Image
import trimesh
import xatlas


def smooth_union(a, b, radius):
    h = np.maximum(radius - np.abs(a-b), 0) / radius
    return np.maximum(a,b) + h*h*radius*.25


def finish_anatomy(field, xs, ys, zs):
    """Round the shoulder junction and replace silhouette-extruded mittens.

    Hand proportions are explicit modelling constraints, not network predictions.
    Palms face down; finger separation lies in the x/z plane of the T pose.
    """
    x = np.abs(xs[:,None,None]-768)
    y = ys[None,:,None]
    z = zs[None,None,:]
    shoulder_weight = np.exp(-((x-155)/70)**4-((y-218)/65)**4)
    rounded = ndi.gaussian_filter(field, 2.8)
    field = field*(1-shoulder_weight)+rounded*shoulder_weight
    # The reference shorts hem is an illustration boundary, not an anatomical
    # shelf. Blend its reconstructed discontinuity into the upper thigh.
    hip_weight=np.exp(-((y-538)/39)**4) * np.exp(-(x/135)**8)
    hip_smooth=ndi.gaussian_filter(field,(2.2,6,2.2))
    field=field*(1-hip_weight)+hip_smooth*hip_weight

    def ellipsoid(center, radii):
        return (1-np.sqrt(((x-center[0])/radii[0])**2+((y-center[1])/radii[1])**2+((z-center[2])/radii[2])**2))*min(radii)

    def capsule(start, end, radius):
        v=np.asarray(end)-start
        t=np.clip(((x-start[0])*v[0]+(y-start[1])*v[1]+(z-start[2])*v[2])/np.dot(v,v),0,1)
        return radius-np.sqrt((x-start[0]-t*v[0])**2+(y-start[1]-t*v[1])**2+(z-start[2]-t*v[2])**2)

    # A gradual wrist transition joins the existing forearm without a seam.
    wrist_blend=np.clip((x-410)/45,0,1)
    wrist_blend=wrist_blend*wrist_blend*(3-2*wrist_blend)
    wrist=(1-np.sqrt(((y-219)/12)**2+(z/17)**2))*12
    field=field*(1-wrist_blend)+wrist*wrist_blend
    field=np.minimum(field, 476-x)
    hand=ellipsoid([491,220,0],[29,10.5,23])
    hand=smooth_union(hand,ellipsoid([469,219,0],[25,12,17]),5)
    # Four fingers with a knuckle arc and two slight segment bends.
    for base_z,length,radius in [(-18,42,5),(-5.5,49,5.4),(7.5,46,5.1),(20,35,4.6)]:
        root=[506,220,base_z]; middle=[506+length*.57,221,base_z+1]
        tip=[506+length,222.2,base_z+2]
        finger=smooth_union(capsule(root,middle,radius),capsule(middle,tip,radius*.86),2)
        hand=smooth_union(hand,finger,2.5)
    # Opposable thumb; joined at the thenar pad, clear of the index finger.
    hand=smooth_union(hand,ellipsoid([487,222,20],[15,9,13]),4)
    thumb=smooth_union(capsule([487,222,23],[504,224,35],6.4),capsule([504,224,35],[519,225,39],5.2),2)
    hand=smooth_union(hand,thumb,3)
    return smooth_union(field,hand,5).astype('float32')



def unwrap_surface(mesh, output, filename):
    """Create a reusable UV layout with neutral materials, never reference artwork."""
    atlas=xatlas.Atlas()
    atlas.add_mesh(mesh.vertices.astype('float32'),mesh.faces.astype('uint32'),mesh.vertex_normals.astype('float32'))
    pack=xatlas.PackOptions();pack.resolution=2048;pack.padding=10;pack.bilinear=True
    atlas.generate(pack_options=pack)
    mapping,faces,uv=atlas[0]
    positions=mesh.vertices[mapping]; normals=mesh.vertex_normals[mapping]
    skin=trimesh.visual.material.PBRMaterial(name='male.skin',baseColorFactor=[241,195,158,255],roughnessFactor=.85,metallicFactor=0)
    shorts=trimesh.visual.material.PBRMaterial(name='preview.shorts',baseColorFactor=[63,69,75,255],roughnessFactor=1,metallicFactor=0)
    center=positions[faces].mean(axis=1)
    image_y=999-center[:,1]*550
    clothing=(image_y>428)&(image_y<542)&(np.abs(center[:,0]*550)<120)
    # GLB material groups preserve the common surface and UVs. No image texture.
    material=trimesh.visual.material.MultiMaterial([skin,shorts])
    exported=trimesh.Trimesh(positions,faces,vertex_normals=normals,process=False)
    exported.visual=trimesh.visual.TextureVisuals(uv=uv,material=material,face_materials=clothing.astype(int))
    exported.export(output/filename)
    width,height=atlas.width,atlas.height
    layout=np.full((height,width,3),255,dtype=np.uint8)
    pixels=uv*np.array([width-1,height-1]);pixels[:,1]=height-1-pixels[:,1]
    cv2.polylines(layout,[np.int32(pixels[face]) for face in faces],True,(120,135,142),1,cv2.LINE_AA)
    return Image.fromarray(layout),{'atlasSize':[width,height],'uvVertices':len(positions),'charts':atlas.chart_count,'referenceImagesUsedAsTexture':False}
