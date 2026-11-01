"""Build a connected hollow tunic shell with open neck, cuffs and waist.

An authored garment volume, independent of the body mesh. Free skirt panels
are simulated separately at the sewn waist seam. Output is a prototype art base.
"""
from pathlib import Path
import numpy as np
import trimesh
import xatlas
from skimage.measure import marching_cubes

root=Path(__file__).resolve().parents[1]
step=.0025
origin=np.array([-.49,1.015,-.205])
x=np.arange(-.49,.491,step)[:,None,None]
y=np.arange(1.015,1.546,step)[None,:,None]
z=np.arange(-.205,.206,step)[None,None,:]
rx=np.interp(y,[1.03,1.10,1.23,1.34,1.405,1.445,1.495,1.525],[.173,.161,.195,.222,.233,.20,.105,.094])
rz=np.interp(y,[1.03,1.10,1.23,1.34,1.405,1.445,1.495,1.525],[.132,.13,.15,.159,.15,.122,.090,.082])
neck_offset=.026*np.clip((y-1.445)/.045,0,1)
ax=np.abs(x)
arm_radius=np.interp(ax,[0,.23,.30,.40,.47],[.092,.095,.09,.080,.076])

def garment(ease=0, sleeves=True, cuff=.447, top=1.525, bottom=1.055):
    a,b=rx+ease,rz+ease
    torso=(np.sqrt((x/a)**2+((z+neck_offset)/b)**2)-1)*np.minimum(a,b)
    torso=np.maximum(torso,np.maximum(1.025-y,y-top))
    radius=arm_radius+ease
    arm=(np.sqrt(((y-1.423)/radius)**2+(z/(radius*1.02))**2)-1)*radius
    arm=np.maximum(arm,ax-(.47 if sleeves else .27))
    k=.043
    h=np.clip(.5+.5*(arm-torso)/k,0,1)
    outer=arm*(1-h)+torso*h-k*h*(1-h)
    outer+=.0018*np.cos(np.arctan2(z,x)*12)*(1-np.clip((y-1.09)/.18,0,1))
    shell=np.maximum(outer,-(outer+.006))
    shell=np.maximum(shell,np.maximum(ax-cuff,bottom-y))
    neck=(np.sqrt((x/(.082+ease))**2+((z+.026)/(.069+ease))**2)-1)*(.069+ease)
    shell=np.maximum(shell,-np.maximum(neck,1.43-y))
    if not sleeves:
        # Actual arm openings leave continuous bridges over both shoulders.
        armhole=(np.sqrt(((y-1.358)/.080)**2+(z/.105)**2)-1)*.080
        armhole=np.maximum(armhole,.143-ax)
        shell=np.maximum(shell,-armhole)
    return shell

def export_shell(field,name,triangles):
    verts,faces,_,_=marching_cubes(field.astype(np.float32),0,spacing=(step,step,step))
    verts+=origin
    mesh=trimesh.Trimesh(verts,faces,process=True)
    mesh=max(mesh.split(only_watertight=False),key=lambda p:len(p.faces))
    mesh=mesh.simplify_quadric_decimation(face_count=triangles,aggression=3)
    mesh.fix_normals()
    mapping,indices,uv=xatlas.parametrize(mesh.vertices.astype(np.float32),mesh.faces.astype(np.uint32))
    result=trimesh.Trimesh(mesh.vertices[mapping],indices,vertex_normals=mesh.vertex_normals[mapping],process=False)
    result.visual=trimesh.visual.TextureVisuals(uv=uv)
    result.export(root/f'public/models/gear-{name}.glb')
    print({'model':name,'triangles':len(result.faces),'connectedShellComponents':len(mesh.split(only_watertight=False))})

export_shell(garment(),'tunic',12000)
export_shell(garment(.014,cuff=.325,top=1.515,bottom=1.075),'mail',9000)
export_shell(garment(.020,sleeves=False,cuff=.245,top=1.507,bottom=1.105),'vest',7000)
