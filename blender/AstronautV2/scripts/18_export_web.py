"""
Web export of the Astronauta Mensajero V2 for the game (headless).

    blender -b blender/AstronautV2/CosmicMail_Astronaut_Final.blend \
        --python blender/AstronautV2/scripts/18_export_web.py

The studio build is made of 264 rigid parts parented to bones (one draw
call each, ~275k vertices) and only has a test animation. The game needs a
light model with the same clip set and sockets as the previous astronaut,
so this script:

1. Drops cameras, lights, the studio and controllers, and clears the IK /
   Child Of constraints and test actions (the clips are baked below).
2. Bakes every visible part (bevel/solidify applied) into ONE skinned mesh:
   each part gets a vertex group for its parent bone with weight 1, so it
   still moves rigidly with that bone.
3. Decimates the joined mesh to TARGET_TRIS and removes UVs (the materials
   are flat PBR colours; procedural micro-relief does not export to glTF).
4. Scales the character to game size (SCALE): the old astronaut is ~1.5 m.
5. Adds ThrusterSocket_L/R bones under the feet (kept for compatibility;
   the game has no jet boots any more, so nothing is attached to them).
6. Retargets the non-locomotion clips of the previous astronaut (Idle,
   Interact, PickUp, Celebrate, Turn_Left, Turn_Right). Each mapped bone
   gets the source bone's world-space rotation change from rest, applied on
   top of the V2 rest pose aligned to the source rest direction. The pelvis
   follows the source hips' movement scaled by leg height, with a ground
   clamp for the soles. Walk and Run are authored on the V2 rig instead
   (gait.py): the retargeted ones looked stiff.
7. Exports public/models/astronaut-v2.glb (skinned, one mesh, 8 clips).

The source .blend files are only read; nothing is saved over them.
"""

import math
import os
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gait  # noqa: E402
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SOURCE_BLEND = os.path.join(ROOT, 'blender', 'Astronaut', 'Astronaut_RetroSpacePost.blend')
OUT_GLB = os.path.join(ROOT, 'public', 'models', 'astronaut-v2.glb')

TARGET_TRIS = 52000
# V2 is ~3 m to the top of the helmet; the game character is ~1.5 m.
SCALE = 0.5
# Retargeted from the previous astronaut. Walk and Run are authored on the
# V2 rig instead (gait.py). No flight or wave clips: the game has no jet
# boots any more and the astronaut does not wave on Mars.
CLIPS = [
    'Idle', 'Interact', 'PickUp', 'Celebrate', 'Turn_Left', 'Turn_Right',
]

# Previous astronaut bone -> V2 bone.
BONE_MAP = {
    'Root': 'ROOT',
    'Hips': 'PELVIS',
    'Spine': 'SPINE_01',
    'UpperBody': 'SPINE_02',
    'Neck': 'NECK',
    'Helmet': 'HEAD',
    'Shoulder_L': 'CLAVICLE_L',
    'UpperArm_L': 'UPPER_ARM_L',
    'Forearm_L': 'FOREARM_L',
    'Hand_L': 'HAND_L',
    'Shoulder_R': 'CLAVICLE_R',
    'UpperArm_R': 'UPPER_ARM_R',
    'Forearm_R': 'FOREARM_R',
    'Hand_R': 'HAND_R',
    'UpperLeg_L': 'THIGH_L',
    'LowerLeg_L': 'SHIN_L',
    'Foot_L': 'FOOT_L',
    'UpperLeg_R': 'THIGH_R',
    'LowerLeg_R': 'SHIN_R',
    'Foot_R': 'FOOT_R',
}
# Limbs are re-aimed so the V2 rest direction matches the source rest
# direction; the spine and head keep their own (both are vertical).
ALIGNED = {
    'CLAVICLE_L', 'UPPER_ARM_L', 'FOREARM_L', 'HAND_L',
    'CLAVICLE_R', 'UPPER_ARM_R', 'FOREARM_R', 'HAND_R',
    'THIGH_L', 'SHIN_L', 'FOOT_L', 'THIGH_R', 'SHIN_R', 'FOOT_R',
}

scene = bpy.context.scene
rig = bpy.data.objects['ASTRONAUT_RIG']


def log(*args):
    print('[astro-web]', *args, flush=True)


# --------------------------------------------------------------- 1. cleanup
rig.animation_data_clear()
rig.data.pose_position = 'REST'
for pb in rig.pose.bones:
    for constraint in list(pb.constraints):
        pb.constraints.remove(constraint)
    pb.rotation_mode = 'QUATERNION'
    pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()


def visible(obj):
    if obj.hide_render or obj.hide_get():
        return False
    return any(not col.hide_render for col in obj.users_collection)


parts = [
    o for o in scene.objects
    if o.type == 'MESH' and o.parent == rig and o.parent_type == 'BONE' and visible(o)
]
log('rigid parts', len(parts))

# --------------------------------------------------- 2. one skinned mesh
depsgraph = bpy.context.evaluated_depsgraph_get()
baked = []
for part in parts:
    evaluated = part.evaluated_get(depsgraph)
    mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=False, depsgraph=depsgraph)
    mesh.transform(part.matrix_world)
    obj = bpy.data.objects.new('BAKE_' + part.name, mesh)
    scene.collection.objects.link(obj)
    group = obj.vertex_groups.new(name=part.parent_bone)
    group.add(range(len(mesh.vertices)), 1.0, 'REPLACE')
    baked.append(obj)

# Everything else (studio, controllers, cameras, lights, rigid parts) goes.
keep = set(baked) | {rig}
for obj in list(scene.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.select_all(action='DESELECT')
for obj in baked:
    obj.select_set(True)
bpy.context.view_layer.objects.active = baked[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'Astronaut_Body'
body.data.name = 'Astronaut_Body'

# Studio-only material faces, if any slipped in.
studio = [i for i, slot in enumerate(body.material_slots) if slot.material and 'STUDIO' in slot.material.name]
if studio:
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for poly in body.data.polygons:
        poly.select = poly.material_index in studio
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='FACE')
    bpy.ops.object.mode_set(mode='OBJECT')

while body.data.uv_layers:
    body.data.uv_layers.remove(body.data.uv_layers[0])

# ------------------------------------------------------------- 3. decimate
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
log('joined triangles', tris)
if tris > TARGET_TRIS:
    decimate = body.modifiers.new('Decimate', 'DECIMATE')
    decimate.decimate_type = 'COLLAPSE'
    decimate.ratio = TARGET_TRIS / tris
    decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
log('final triangles', tris)

# Flat PBR materials: drop the procedural micro-relief (not exportable).
for slot in body.material_slots:
    material = slot.material
    if not material or not material.use_nodes:
        continue
    tree = material.node_tree
    principled = next((n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not principled:
        continue
    rough = principled.inputs['Roughness']
    for link in list(rough.links):
        source = link.from_node
        if source.type == 'MAP_RANGE':
            rough.default_value = (source.inputs[3].default_value + source.inputs[4].default_value) / 2
        tree.links.remove(link)
    for link in list(principled.inputs['Normal'].links):
        tree.links.remove(link)

# --------------------------------------------------------- 4. game scale
bpy.ops.object.select_all(action='DESELECT')
body.parent = None
for obj in (rig, body):
    obj.select_set(True)
    obj.scale = (SCALE, SCALE, SCALE)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
modifier = body.modifiers.new('Armature', 'ARMATURE')
modifier.object = rig
body.parent = rig
body.matrix_parent_inverse = rig.matrix_world.inverted()

# -------------------------------------------------- 5. thruster sockets
def sole_centre(bone_name):
    index = body.vertex_groups[bone_name].index
    points = [
        v.co for v in body.data.vertices
        if any(g.group == index and g.weight > 0.5 for g in v.groups)
    ]
    lowest = min(p.z for p in points)
    sole = [p for p in points if p.z < lowest + 0.02]
    centre = sum(sole, Vector()) / len(sole)
    return Vector((centre.x, centre.y, lowest + 0.002))


sockets = {side: sole_centre('FOOT_' + side) for side in ('L', 'R')}
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for side, head in sockets.items():
    bone = rig.data.edit_bones.new('ThrusterSocket_' + side)
    bone.head = head
    bone.tail = head + Vector((0, 0.03, 0))
    bone.align_roll(Vector((0, 0, 1)))
    bone.parent = rig.data.edit_bones['FOOT_' + side]
    bone.use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')
log('sockets', {k: tuple(round(c, 3) for c in v) for k, v in sockets.items()})

# --------------------------------------------------------- 6. retarget
with bpy.data.libraries.load(SOURCE_BLEND, link=False) as (data_from, data_to):
    data_to.objects = [n for n in data_from.objects if n == 'CM_Astronaut_Armature']
    data_to.actions = [n for n in data_from.actions if n in CLIPS]
source = data_to.objects[0]
source_actions = {a.name: a for a in data_to.actions}
log('source clips', sorted(source_actions))

src_bones = source.data.bones
tgt_bones = rig.data.bones
src_world = source.matrix_world.copy()


def hierarchy(bones):
    ordered = []
    def visit(bone):
        ordered.append(bone)
        for child in bone.children:
            visit(child)
    for bone in bones:
        if bone.parent is None:
            visit(bone)
    return ordered


def rest_relative(bone):
    if bone.parent is None:
        return bone.matrix_local.copy()
    return bone.parent.matrix_local.inverted() @ bone.matrix_local


def fcurve_table(action):
    table = {}
    bag = action.layers[0].strips[0].channelbags[0]
    for fc in bag.fcurves:
        name = fc.data_path.split('"')[1]
        prop = fc.data_path.rsplit('.', 1)[1]
        table[(name, prop, fc.array_index)] = fc
    return table


def source_pose(table, frame):
    """Armature-space pose matrices of the source rig at `frame`."""
    pose = {}
    for bone in hierarchy(src_bones):
        loc = Vector((
            table[(bone.name, 'location', i)].evaluate(frame) if (bone.name, 'location', i) in table else 0.0
            for i in range(3)
        ))
        quat = Quaternion((
            table[(bone.name, 'rotation_quaternion', i)].evaluate(frame)
            if (bone.name, 'rotation_quaternion', i) in table else (1.0 if i == 0 else 0.0)
            for i in range(4)
        ))
        quat.normalize()
        basis = Matrix.Translation(loc) @ quat.to_matrix().to_4x4()
        parent = pose[bone.parent.name] if bone.parent else Matrix.Identity(4)
        pose[bone.name] = parent @ rest_relative(bone) @ basis
    return pose


src_rest_rot = {b.name: (src_world @ b.matrix_local).to_quaternion() for b in src_bones}
tgt_rest_rot = {b.name: b.matrix_local.to_quaternion() for b in tgt_bones}
Y = Vector((0, 1, 0))
offset = {}
for src_name, tgt_name in BONE_MAP.items():
    align = Quaternion()
    if tgt_name in ALIGNED:
        d_src = src_rest_rot[src_name] @ Y
        d_tgt = tgt_rest_rot[tgt_name] @ Y
        align = d_tgt.rotation_difference(d_src)
    # target = R_src(t) @ R_src_rest^-1 @ align @ R_tgt_rest
    offset[tgt_name] = (src_name, src_rest_rot[src_name].inverted() @ align @ tgt_rest_rot[tgt_name])

src_hip_height = (src_world @ src_bones['Hips'].head_local).z
tgt_hip_height = tgt_bones['PELVIS'].head_local.z
travel_scale = tgt_hip_height / src_hip_height
src_hips_rest = src_world @ src_bones['Hips'].head_local
log('hip heights', round(src_hip_height, 3), round(tgt_hip_height, 3), 'travel x', round(travel_scale, 3))

SOLE_BONES = ('FOOT_L', 'FOOT_R')
tgt_order = hierarchy(tgt_bones)


def target_pose(src_pose, lift):
    """Armature-space pose and local bases for the V2 rig."""
    pose = {}
    basis = {}
    hips_world = src_world @ src_pose['Hips'].translation
    travel = (hips_world - src_hips_rest) * travel_scale + Vector((0, 0, lift))
    for bone in tgt_order:
        parent = pose[bone.parent.name] if bone.parent else Matrix.Identity(4)
        rest_pose = parent @ rest_relative(bone)
        if bone.name in offset:
            src_name, off = offset[bone.name]
            world_rot = (src_world @ src_pose[src_name]).to_quaternion() @ off
            head = rest_pose.translation.copy()
            if bone.name == 'PELVIS':
                head += travel
            desired = Matrix.LocRotScale(head, world_rot, None)
        else:
            desired = rest_pose
        pose[bone.name] = desired
        basis[bone.name] = rest_pose.inverted() @ desired
    return pose, basis


def sole_height(pose):
    lowest = math.inf
    for name in SOLE_BONES:
        matrix = pose[name]
        length = tgt_bones[name].length
        for point in (matrix.translation, matrix @ Vector((0, length, 0))):
            lowest = min(lowest, point.z)
    return lowest


rest_sole = sole_height({b.name: b.matrix_local for b in tgt_bones})

if rig.animation_data is None:
    rig.animation_data_create()
for action in list(bpy.data.actions):
    # The studio's reference pose and test animation are not game clips.
    if action.name.startswith(('ASTRO_', 'POSE_')):
        bpy.data.actions.remove(action)

baked_actions = []
for clip in CLIPS:
    src_action = source_actions[clip]
    table = fcurve_table(src_action)
    start, end = (int(round(v)) for v in src_action.frame_range)
    src_action.name = 'SRC_' + clip
    action = bpy.data.actions.new(clip)
    action.use_fake_user = True
    rig.animation_data.action = action
    previous = {}
    for frame in range(start, end + 1):
        src_pose = source_pose(table, frame)
        pose, basis = target_pose(src_pose, 0.0)
        # Soles never sink below the ground they rest on in the rest pose.
        sink = rest_sole - sole_height(pose)
        if sink > 0.002:
            pose, basis = target_pose(src_pose, sink)
        for bone in tgt_order:
            name = bone.name
            if name not in offset:
                continue
            pb = rig.pose.bones[name]
            quat = basis[name].to_quaternion()
            if name in previous:
                quat.make_compatible(previous[name])
            previous[name] = quat
            pb.rotation_quaternion = quat
            pb.location = basis[name].translation
            pb.keyframe_insert('rotation_quaternion', frame=frame - start + 1, group=name)
            pb.keyframe_insert('location', frame=frame - start + 1, group=name)
    baked_actions.append(action)
    log('baked', clip, end - start + 1, 'frames')

# Authored locomotion (see gait.py).
for clip_name, cfg in (('Walk', gait.WALK), ('Run', gait.RUN)):
    baked_actions.append(gait.build_cycle(
        rig, tgt_order, rest_relative, sole_height, rest_sole, clip_name, cfg, log,
    ))

rig.animation_data.action = None
for pb in rig.pose.bones:
    pb.matrix_basis = Matrix.Identity(4)
rig.data.pose_position = 'POSE'
bpy.data.objects.remove(source, do_unlink=True)
for action in list(bpy.data.actions):
    if action not in baked_actions:
        bpy.data.actions.remove(action)

# Each clip on its own NLA track so the exporter sees all of them.
for action in baked_actions:
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    track.strips.new(action.name, 1, action)
    track.mute = True

scene.render.fps = 30
scene.frame_start = 1

# ---------------------------------------------------------------- 7. export
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_texcoords=False,
    export_normals=True,
    export_skins=True,
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_force_sampling=True,
    export_optimize_animation_size=True,
    export_def_bones=False,
    export_lights=False,
    export_cameras=False,
)
log('exported', OUT_GLB, round(os.path.getsize(OUT_GLB) / 1e6, 2), 'MB')
