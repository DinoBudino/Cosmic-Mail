"""Export the Mars Exploration Rover (Spirit / Opportunity share one design)
to a light GLB for the web game.

    blender -b blender/Spirit/Spirit_CosmicMail_SolarCorrected.blend \
        --python blender/Spirit/scripts/export_web.py

What it does (the source .blend is never saved or modified):
- drops studio lights, cameras, the backup solar arrays and rig empties;
- bakes modifiers and curves, removes sub-3 cm bolts (invisible in game);
- joins the rover into a few named parts the scanner can target:
  Rover_Pancam (camera head), Rover_Mast (Mini-TES looks out through it),
  Rover_RAT (on the robotic arm), Rover_Arm, Rover_Solar, Rover_Wheels,
  Rover_Antenna and Rover_Body;
- adds the instrument arm (IDD) stowed at the front, which the source model
  does not have yet: the Rock Abrasion Tool lives on its turret;
- decimates each part to a web budget and exports public/models/mer-rover.glb.

Blender is Z-up with the rover front at -X; glTF/three is Y-up, so a
Blender point (x, y, z) lands at three (x, z, -y).
"""

import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(bpy.data.filepath), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'mer-rover.glb')

GROUP_BY_COLLECTION = {
    '05_CAMERA_HEAD': 'Rover_Pancam',
    '04_CAMERA_MAST': 'Rover_Mast',
    'SOLAR_ARRAYS_CORRECTED': 'Rover_Solar',
    '08_WHEELS': 'Rover_Wheels',
    '06_ANTENNAS': 'Rover_Antenna',
    '01_CHASSIS': 'Rover_Body',
    '02_BODY_PANELS': 'Rover_Body',
    '07_SUSPENSION': 'Rover_Body',
    '10_SENSORS': 'Rover_Body',
    '11_CABLES': 'Rover_Body',
}
SKIP_COLLECTIONS = {
    '13_RIG_CONTROLS', '14_LIGHTING', '15_CAMERAS',
    'SOLAR_ARRAYS_ORIGINAL_BACKUP', 'SOLAR_CORRECTION_VALIDATION',
}
# Fraction of triangles kept per part (collapse decimation).
DECIMATE = {
    'Rover_Wheels': 0.1,
    'Rover_Solar': 0.36,
    'Rover_Body': 0.36,
    'Rover_Pancam': 0.36,
    'Rover_Mast': 0.45,
    'Rover_Antenna': 0.35,
    'Rover_Arm': 1.0,
    'Rover_RAT': 1.0,
}
TINY = 0.03


def group_for(obj):
    for collection in obj.users_collection:
        if collection.name in SKIP_COLLECTIONS:
            return None
        if collection.name in GROUP_BY_COLLECTION:
            return GROUP_BY_COLLECTION[collection.name]
    return None


def material(name):
    return bpy.data.materials[name]


def baked_parts():
    """World-space mesh copies (modifiers and curves applied), by group."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    parts = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        group = group_for(obj)
        if group is None:
            continue
        if obj.hide_render:
            continue
        if max(obj.dimensions) < TINY and not obj.name.startswith('OPTIC_'):
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
        mesh.transform(obj.matrix_world)
        if not mesh.materials and obj.material_slots:
            for slot in obj.material_slots:
                mesh.materials.append(slot.material)
        parts.setdefault(group, []).append(mesh)
    return parts


def add_cylinder(bm, start, end, radius, segments, mat_index):
    """Capped cylinder between two points, appended to bm."""
    start, end = Vector(start), Vector(end)
    axis = end - start
    length = axis.length
    rotation = axis.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    matrix = Matrix.Translation((start + end) / 2) @ rotation
    result = bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius,
        depth=length, matrix=matrix,
    )
    for face in {f for v in result['verts'] for f in v.link_faces}:
        face.material_index = mat_index


def add_box(bm, center, size, mat_index):
    matrix = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((*size, 1))
    result = bmesh.ops.create_cube(bm, size=1.0, matrix=matrix)
    for face in {f for v in result['verts'] for f in v.link_faces}:
        face.material_index = mat_index


def build_arm():
    """The stowed instrument arm (IDD) and its RAT, in the model's style.

    Real MER: a 5-joint arm mounted at the front of the body, folded under
    the front of the deck when driving; its turret carries four instruments,
    one of them the Rock Abrasion Tool. Kept simple and chunky so it reads
    at game distance and is easy to aim at.
    """
    mats = ['MAT_Beige_Casing', 'MAT_DarkGray_Structure', 'MAT_Satin_Metal',
            'MAT_Orange_Accents', 'MAT_MediumGray_Modules']
    arm = bmesh.new()
    shoulder = (-0.74, 0.30, 0.66)
    elbow = (-0.84, -0.30, 0.62)
    wrist = (-0.90, 0.10, 0.54)
    add_box(arm, (-0.73, 0.30, 0.70), (0.08, 0.12, 0.12), 1)       # mount
    add_cylinder(arm, shoulder, (-0.80, 0.30, 0.66), 0.045, 14, 2)  # shoulder
    add_cylinder(arm, (-0.80, 0.30, 0.66), elbow, 0.03, 12, 0)      # upper arm
    add_cylinder(arm, (-0.84, -0.30, 0.67), (-0.84, -0.30, 0.57), 0.045, 14, 1)
    add_cylinder(arm, elbow, wrist, 0.026, 12, 0)                   # forearm
    add_cylinder(arm, (-0.90, 0.10, 0.60), (-0.90, 0.10, 0.48), 0.04, 14, 2)
    # Turret hub with three other instruments (small stubs).
    add_box(arm, (-0.93, 0.16, 0.50), (0.09, 0.09, 0.09), 4)
    add_cylinder(arm, (-0.93, 0.16, 0.50), (-0.93, 0.27, 0.50), 0.03, 12, 4)
    add_cylinder(arm, (-0.93, 0.16, 0.50), (-0.93, 0.16, 0.61), 0.03, 12, 4)
    add_cylinder(arm, (-0.93, 0.16, 0.50), (-0.93, 0.05, 0.50), 0.028, 12, 2)
    arm_mesh = bpy.data.meshes.new('Rover_Arm')
    arm.to_mesh(arm_mesh)
    arm.free()
    for name in mats:
        arm_mesh.materials.append(material(name))

    rat = bmesh.new()
    # RAT points forward (-X): body, grinding head, orange ring, dark face.
    add_cylinder(rat, (-0.97, 0.16, 0.50), (-1.07, 0.16, 0.50), 0.05, 18, 0)
    add_cylinder(rat, (-1.07, 0.16, 0.50), (-1.10, 0.16, 0.50), 0.056, 18, 3)
    add_cylinder(rat, (-1.10, 0.16, 0.50), (-1.13, 0.16, 0.50), 0.045, 18, 1)
    rat_mesh = bpy.data.meshes.new('Rover_RAT')
    rat.to_mesh(rat_mesh)
    rat.free()
    for name in mats:
        rat_mesh.materials.append(material(name))
    return arm_mesh, rat_mesh


def join(name, meshes):
    """One object per part; materials merged by name."""
    target = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    bpy.context.scene.collection.objects.link(target)
    objects = []
    for mesh in meshes:
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        objects.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return target


def clean_and_decimate(obj, ratio):
    bpy.context.view_layer.objects.active = obj
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bm.to_mesh(obj.data)
    bm.free()
    if ratio < 1.0:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = ratio
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    # Keep crisp hard edges on panels, smooth on round parts.
    for poly in obj.data.polygons:
        poly.use_smooth = True
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
    except Exception:  # older/newer API names
        obj.data.set_sharp_from_angle(angle=math.radians(35))
    # Drop unused material slots.
    used = {p.material_index for p in obj.data.polygons}
    for index in reversed(range(len(obj.material_slots))):
        if index not in used:
            obj.active_material_index = index
            bpy.ops.object.material_slot_remove()


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def main():
    parts = baked_parts()
    arm_mesh, rat_mesh = build_arm()
    parts['Rover_Arm'] = [arm_mesh]
    parts['Rover_RAT'] = [rat_mesh]

    # Remove every source object so only the export parts remain.
    for obj in list(bpy.context.scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    root = bpy.data.objects.new('MER_Rover', None)
    bpy.context.scene.collection.objects.link(root)
    total = 0
    for name, meshes in parts.items():
        obj = join(name, meshes)
        clean_and_decimate(obj, DECIMATE.get(name, 0.5))
        obj.parent = root
        tris = triangles(obj)
        total += tris
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
        hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
        center = (lo + hi) / 2
        size = hi - lo
        # three.js coordinates: (x, z, -y)
        print(f'PART {name} tris={tris} center3=({center.x:.2f}, {center.z:.2f}, {-center.y:.2f}) '
              f'size3=({size.x:.2f}, {size.z:.2f}, {size.y:.2f}) mats={[m.name for m in obj.data.materials]}')
    print('TOTAL_TRIS', total)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_texcoords=False,
        export_normals=True,
    )
    print('WROTE', OUT, os.path.getsize(OUT))


main()
