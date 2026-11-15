"""Export blender/Scanner/Cosmic_Mail_Scanner_Master.blend to the web GLB.

Run headless (it changes the open scene; do not save the .blend afterwards):
  blender -b blender/Scanner/Cosmic_Mail_Scanner_Master.blend \
    --python blender/Scanner/scripts/export_web.py

Drops the disabled beam FX and the button animation, merges the body meshes
per material (SCN_<material>), decimates meshes over 1500 triangles to 30%
and keeps the activation button under CTRL_ActivationButton_Pivot so the
game can press it.
"""
import os
import bpy
from collections import defaultdict
root=bpy.data.objects['SCANNER_ROOT']
pivot=bpy.data.objects['CTRL_ActivationButton_Pivot']
if pivot.animation_data: pivot.animation_data.action=None
pivot.location=(0.0095,0.0,0.097)
bpy.context.view_layer.update()
bpy.data.objects.remove(bpy.data.objects['FX_ScanBeam_DISABLED'])
button=set(pivot.children)
body=[o for o in root.children_recursive if o.type=='MESH' and o not in button]
# make real meshes with modifiers applied, world transforms baked
dg=bpy.context.evaluated_depsgraph_get()
groups=defaultdict(list)
for o in body:
    groups[o.active_material.name].append(o)
bpy.ops.object.select_all(action='DESELECT')
merged=[]
for mat,objs in groups.items():
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    if len(objs)>1: bpy.ops.object.join()
    m=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    m.name='SCN_'+mat.replace('MAT_','')
    m.data.name=m.name
    m.parent=root
    merged.append(m)
    bpy.ops.object.select_all(action='DESELECT')
for m in merged:
    m.data.calc_loop_triangles()
    n=len(m.data.loop_triangles)
    if n>1500:
        mod=m.modifiers.new('dec','DECIMATE'); mod.ratio=0.3
        bpy.context.view_layer.objects.active=m
        bpy.ops.object.modifier_apply(modifier=mod.name)
        # keep it smooth-looking
        for poly in m.data.polygons: poly.use_smooth=True
for b in button:
    b.select_set(True); bpy.context.view_layer.objects.active=b
    bpy.ops.object.convert(target='MESH'); b.select_set(False)
bpy.ops.object.select_all(action='DESELECT')
sel=[root,pivot]+merged+list(button)
for o in sel: o.select_set(True)
tris=sum(len(o.data.loop_triangles) if (o.data.calc_loop_triangles() or True) else 0 for o in sel if o.type=='MESH')
print('MESHES',len(merged)+len(button),'TRIS',tris,[o.name for o in merged])
bpy.ops.export_scene.gltf(
    filepath=os.path.join(os.path.dirname(bpy.data.filepath), '..', '..', 'public', 'models', 'cosmic-scanner.glb'),
    export_format='GLB', use_selection=True, export_apply=True,
    export_animations=False, export_cameras=False, export_lights=False, export_yup=True)
print('EXPORTED')
