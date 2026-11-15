"""Export the CM-01 spaceship (blender/Spaceship/Spaceship.blend) for the web.

    blender -b blender/Spaceship/Spaceship.blend --python blender/Spaceship/scripts/export_web.py

Writes public/models/spaceship-cm01.glb without touching the .blend:
- drops cameras, lights, the BLOCK_ blockout and the hidden Internal_ systems
  (they sit inside the closed service hull);
- applies modifiers, converts curves, decimates the dense nozzle cooling ribs;
- moves the engine emission disc into the throat and makes it glow;
- joins everything into one mesh (one primitive per material);
- turns the ship so the nose points up (+Z Blender = +Y glTF), centred on
  the origin, in metres (about 12.1 m long).
"""
import math
import os
import bpy
import mathutils

OUT = os.path.join(os.path.dirname(bpy.data.filepath), '..', '..', 'public', 'models', 'spaceship-cm01.glb')
OUT = os.path.normpath(OUT)

scene = bpy.data.scenes['CM01_STUDIO']
bpy.context.window.scene = scene if bpy.context.window else scene
for other in [s for s in bpy.data.scenes if s != scene]:
    bpy.data.scenes.remove(other)

# Engine glow: the emission disc was left at the origin; put it at the
# bottom of the deep throat (x ~ 3.18) and light it.
disc = scene.objects.get('Engine_EmissionThroat')
if disc:
    m = disc.matrix_world.copy()
    m.translation.x = 3.2
    disc.matrix_world = m
emission = bpy.data.materials.get('MAT_ENGINE_EMISSION')
if emission:
    bsdf = next(n for n in emission.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Emission Color'].default_value = (1.0, 0.45, 0.12, 1.0)
    bsdf.inputs['Emission Strength'].default_value = 4.0

drop = []
for o in scene.objects:
    if o.type in ('CAMERA', 'LIGHT'):
        drop.append(o)
    elif o.name.startswith(('BLOCK_', 'Internal_')):
        drop.append(o)
for o in drop:
    bpy.data.objects.remove(o, do_unlink=True)

# Real geometry only (empties stay only as the hierarchy we flatten below).
depsgraph = bpy.context.evaluated_depsgraph_get()
meshes = []
for o in list(scene.objects):
    if o.type not in ('MESH', 'CURVE') or o.hide_render:
        continue
    evaluated = o.evaluated_get(depsgraph)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    data.transform(o.matrix_world)
    clone = bpy.data.objects.new(o.name + '_W', data)
    scene.collection.objects.link(clone)
    meshes.append((o.name, clone))

for o in [o for o in scene.objects if not o.name.endswith('_W')]:
    bpy.data.objects.remove(o, do_unlink=True)

# Decimate dense parts (bevelled tiles, rings, nozzle ribs). Small parts
# (bolts, latches, lenses) keep their shape. The ship never fills more
# than a third of the screen in the game.
DENSE = 1500
for name, clone in meshes:
    tris = sum(len(p.vertices) - 2 for p in clone.data.polygons)
    if tris <= DENSE:
        continue
    mod = clone.modifiers.new('dec', 'DECIMATE')
    mod.ratio = 0.22 if name.startswith('Engine_InnerCoolingRib') else max(0.3, DENSE / tris)
    bpy.context.view_layer.objects.active = clone
    bpy.ops.object.modifier_apply(modifier=mod.name)
# Materials are procedural (no image textures): UVs are dead weight.
for _, clone in meshes:
    while clone.data.uv_layers:
        clone.data.uv_layers.remove(clone.data.uv_layers[0])

# One mesh, one primitive per material.
bpy.ops.object.select_all(action='DESELECT')
for _, clone in meshes:
    clone.select_set(True)
bpy.context.view_layer.objects.active = meshes[0][1]
bpy.ops.object.join()
ship = bpy.context.view_layer.objects.active
ship.name = 'CM01_Ship'
ship.data.name = 'CM01_Ship'

# Global collapse: the error-ordered queue spends the budget on flat bevel
# subdivisions first, so small parts keep their silhouette.
TARGET_TRIS = 70000
tris = sum(len(p.vertices) - 2 for p in ship.data.polygons)
if tris > TARGET_TRIS:
    mod = ship.modifiers.new('dec', 'DECIMATE')
    mod.ratio = TARGET_TRIS / tris
    bpy.ops.object.modifier_apply(modifier=mod.name)

# Nose (-X) up (+Z), centred.
ship.data.transform(mathutils.Matrix.Rotation(math.radians(90), 4, 'Y'))
pts = [v.co for v in ship.data.vertices]
lo = mathutils.Vector([min(p[i] for p in pts) for i in range(3)])
hi = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ship.data.transform(mathutils.Matrix.Translation(-(lo + hi) / 2))

tris = sum(len(p.vertices) - 2 for p in ship.data.polygons)
print('EXPORT bounds', [round(v, 3) for v in (hi - lo)], 'tris', tris, 'materials', len(ship.data.materials))

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_texcoords=False,
    export_normals=True,
    export_tangents=False,
    export_animations=False,
)
print('EXPORT wrote', OUT, os.path.getsize(OUT))
