"""Independent validation of Astronaut_RetroSpacePost.glb.

Runs in a fresh Blender process, imports the GLB, checks rig, clips,
materials, orientation, loop seams and ground contact, then renders the
reimported asset. No master-scene data is reused, so action names and
dimensions reflect the actual shipped file.
"""

import json
import math
import os
import struct

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GLB_PATH = os.path.join(ROOT, "blender", "Astronaut", "Astronaut_RetroSpacePost.glb")
OUT_DIR = os.path.join(ROOT, "blender", "Astronaut", "previews")
os.makedirs(OUT_DIR, exist_ok=True)

REQUIRED = ["Idle", "Walk", "Run", "Turn_Left", "Turn_Right",
            "Jump", "Interact", "Wave", "PickUp", "Celebrate",
            "Takeoff", "Flying", "Landing"]
EXPECTED_SECONDS = {
    "Idle": 2.0, "Walk": 0.8, "Run": 0.6,
    "Turn_Left": 0.5, "Turn_Right": 0.5, "Jump": 0.9,
    "Interact": 1.2, "Wave": 1.5, "PickUp": 1.3, "Celebrate": 1.7,
    "Takeoff": 0.8, "Flying": 1.2, "Landing": 0.8,
}

# --------------------------------------------------------------------------- #
# Raw GLB inspection
# --------------------------------------------------------------------------- #

data = open(GLB_PATH, "rb").read()
magic, version, length = struct.unpack_from("<III", data, 0)
assert magic == 0x46546C67 and version == 2, "Not a glTF 2 binary"
offset = 12
gltf = None
while offset < len(data):
    clen, ctype = struct.unpack_from("<II", data, offset)
    offset += 8
    chunk = data[offset:offset + clen]
    offset += clen
    if ctype == 0x4E4F534A:
        gltf = json.loads(chunk.decode("utf-8"))
assert gltf is not None

# read binary buffer for animation timing
bin_chunk = None
offset = 12
while offset < len(data):
    clen, ctype = struct.unpack_from("<II", data, offset)
    offset += 8
    chunk = data[offset:offset + clen]
    offset += clen
    if ctype == 0x004E4942:
        bin_chunk = chunk
assert bin_chunk is not None


def accessor_values(index, count=None):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    comp_type = acc["componentType"]
    type_count = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[acc["type"]]
    fmt = {5126: "f", 5123: "H", 5125: "I", 5121: "B"}[comp_type]
    size = struct.calcsize(fmt)
    n = count or acc["count"]
    out = []
    for i in range(n):
        vals = struct.unpack_from("<" + fmt * type_count, bin_chunk,
                                  start + i * size * type_count)
        out.append(vals if type_count > 1 else vals[0])
    return out


# Position bounds in mesh space
mins = []
maxs = []
for mesh in gltf["meshes"]:
    for prim in mesh["primitives"]:
        pos_idx = prim["attributes"]["POSITION"]
        acc = gltf["accessors"][pos_idx]
        if "min" in acc:
            mins.append(acc["min"])
            maxs.append(acc["max"])
mn = [min(v[i] for v in mins) for i in range(3)]
mx = [max(v[i] for v in maxs) for i in range(3)]
glb_height = mx[1] - mn[1]

# Triangles
triangles = 0
for mesh in gltf["meshes"]:
    for prim in mesh["primitives"]:
        if "indices" in prim:
            triangles += gltf["accessors"][prim["indices"]]["count"] // 3

animations = {}
for anim in gltf.get("animations", []):
    times = []
    for sampler in anim["samplers"]:
        acc = gltf["accessors"][sampler["input"]]
        if "min" in acc and "max" in acc:
            times.extend([acc["min"][0], acc["max"][0]])
        else:
            vals = accessor_values(sampler["input"])
            times.extend([min(vals), max(vals)])
    animations[anim.get("name")] = {
        "start": round(min(times), 4),
        "end": round(max(times), 4),
        "duration": round(max(times) - min(times), 4),
        "channels": len(anim["channels"]),
    }

materials = [m.get("name") for m in gltf.get("materials", [])]
visor = next((m for m in gltf.get("materials", [])
              if m.get("name") == "AST_Visor_Black"), None)
assert visor is not None
visor_pbr = visor.get("pbrMetallicRoughness", {})
visor_base = visor_pbr.get("baseColorFactor", [0, 0, 0, 1])
assert visor.get("alphaMode", "OPAQUE") == "OPAQUE"
assert max(visor_base[:3]) < 0.006
assert "KHR_materials_transmission" not in visor.get("extensions", {})

node_names = [n.get("name", "") for n in gltf.get("nodes", [])]
assert not any(k in n for n in node_names for k in ("Preview", "Camera",
                                                    "Light", "Floor"))
assert len(gltf.get("cameras", [])) == 0
assert len(gltf.get("skins", [])) >= 1
assert not gltf.get("images"), "Unexpected embedded images"
assert not gltf.get("textures"), "Unexpected textures"
assert set(REQUIRED).issubset(set(animations)), animations.keys()
for socket_name in ("ThrusterSocket_L", "ThrusterSocket_R"):
    assert socket_name in node_names, f"Missing raw GLB socket {socket_name}"
for nozzle_name in ("AST_ThrusterHousing_L", "AST_ThrusterHousing_R",
                    "AST_ThrusterRing_L", "AST_ThrusterRing_R",
                    "AST_ThrusterCore_L", "AST_ThrusterCore_R"):
    assert nozzle_name in node_names, f"Missing nozzle mesh {nozzle_name}"
assert not any(token in n.lower() for n in node_names
               for token in ("flame", "fire", "smoke", "exhaust"))

raw_report = {
    "file_bytes": len(data),
    "glb_version": version,
    "declared_length": length,
    "mesh_space_bounds_min": [round(v, 4) for v in mn],
    "mesh_space_bounds_max": [round(v, 4) for v in mx],
    "height": round(glb_height, 4),
    "triangles": triangles,
    "meshes": len(gltf.get("meshes", [])),
    "nodes": len(node_names),
    "materials": materials,
    "skins": len(gltf.get("skins", [])),
    "joints": len(gltf["skins"][0]["joints"]),
    "animations": animations,
    "node_names": node_names,
    "visor": {
        "baseColorFactor": visor_base,
        "alphaMode": visor.get("alphaMode", "OPAQUE"),
        "metallic": visor_pbr.get("metallicFactor", 1.0),
        "roughness": visor_pbr.get("roughnessFactor", 1.0),
        "doubleSided": visor.get("doubleSided", False),
    },
}
print("RAW_GLB", json.dumps(raw_report, indent=2))
assert abs(glb_height - 1.502) < 0.01, glb_height

# --------------------------------------------------------------------------- #
# Fresh import
# --------------------------------------------------------------------------- #

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.render.engine = "BLENDER_EEVEE"
bpy.ops.import_scene.gltf(filepath=GLB_PATH)

imported = list(bpy.data.objects)
meshes = [o for o in imported if o.type == "MESH" and o.name.startswith("AST_")]
armatures = [o for o in imported if o.type == "ARMATURE"]
assert len(armatures) == 1, [o.name for o in armatures]
arm = armatures[0]
print("IMPORTED_OBJECTS", [(o.name, o.type) for o in imported])
print("ARMATURE", arm.name, "BONES", len(arm.data.bones))

# Sockets are dedicated bones under the feet. Verify exact names, parenting,
# rest position and the documented local -Z exhaust axis.
socket_report = {}
for suffix in ("L", "R"):
    socket_name = f"ThrusterSocket_{suffix}"
    bone = arm.data.bones.get(socket_name)
    assert bone is not None, f"Missing imported socket bone {socket_name}"
    assert bone.parent is not None and bone.parent.name == f"Foot_{suffix}", socket_name
    pb = arm.pose.bones[socket_name]
    rest_head = arm.matrix_world @ pb.head
    exhaust = arm.matrix_world.to_3x3() @ (pb.matrix.to_3x3() @ Vector((0, 0, -1)))
    socket_report[socket_name] = {
        "parent": bone.parent.name,
        "rest_head": [round(v, 4) for v in rest_head],
        "rest_exhaust": [round(v, 4) for v in exhaust],
    }
    assert exhaust.z < -0.95, (socket_name, exhaust)

nozzle_report = {}
for name in ("AST_ThrusterHousing_L", "AST_ThrusterHousing_R",
             "AST_ThrusterRing_L", "AST_ThrusterRing_R",
             "AST_ThrusterCore_L", "AST_ThrusterCore_R"):
    obj = bpy.data.objects.get(name)
    assert obj is not None and obj.type == "MESH", f"Missing nozzle {name}"
    zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
    nozzle_report[name] = round(min(zs), 5)
    assert min(zs) > -0.002, (name, min(zs))

# Bounds (rest pose)
mn_b = Vector((1e9, 1e9, 1e9))
mx_b = Vector((-1e9, -1e9, -1e9))
for obj in meshes:
    for corner in obj.bound_box:
        p = obj.matrix_world @ Vector(corner)
        mn_b.x = min(mn_b.x, p.x)
        mn_b.y = min(mn_b.y, p.y)
        mn_b.z = min(mn_b.z, p.z)
        mx_b.x = max(mx_b.x, p.x)
        mx_b.y = max(mx_b.y, p.y)
        mx_b.z = max(mx_b.z, p.z)
height = mx_b.z - mn_b.z
print("IMPORT_BOUNDS", tuple(round(v, 4) for v in mn_b),
      tuple(round(v, 4) for v in mx_b), "HEIGHT", round(height, 4))
assert abs(height - 1.502) < 0.015
assert mn_b.z > -0.005, "Imported character is not on the ground"
# Visor faces Blender -Y after import, backpack +Y.
assert mx_b.y > 0.30 and mn_b.y < -0.30

# Actions
actions = {a.name: a for a in bpy.data.actions}
assert set(REQUIRED).issubset(actions.keys()), actions.keys()
action_report = {}
for name in REQUIRED:
    a = actions[name]
    action_report[name] = {
        "frame_range": [round(v, 3) for v in a.frame_range],
        "seconds": round((a.frame_range[1] - a.frame_range[0]) / 30.0, 3),
    }
    assert abs(action_report[name]["seconds"] - EXPECTED_SECONDS[name]) < 0.05
print("IMPORTED_ACTIONS", json.dumps(action_report, indent=2))

# Material / anonymity audit
mat_names = [m.name for m in bpy.data.materials]
assert any("Visor" in n for n in mat_names)
for token in ("face", "eye", "mouth", "nose", "hair", "skin", "brow", "head"):
    assert not any(token in n.lower() for n in node_names), token
    assert not any(token in m.lower() for m in mat_names), token

# Visor material after import
visor_mat = next((m for m in bpy.data.materials if "Visor" in m.name), None)
assert visor_mat is not None
bsdf = next((n for n in visor_mat.node_tree.nodes
             if n.type == "BSDF_PRINCIPLED"), None)
assert bsdf is not None
base = bsdf.inputs["Base Color"].default_value
assert max(base[0], base[1], base[2]) < 0.02
assert bsdf.inputs["Alpha"].default_value >= 0.999
if "Transmission Weight" in bsdf.inputs:
    assert bsdf.inputs["Transmission Weight"].default_value <= 0.001

# --------------------------------------------------------------------------- #
# Loop seam + pose evaluation + ground contact tests
# --------------------------------------------------------------------------- #

def set_action(name):
    action = actions[name]
    arm.animation_data_create()
    arm.animation_data.action = action
    try:
        if action.slots:
            arm.animation_data.action_slot = action.slots[0]
    except Exception:
        pass
    return action


def bone_snapshot(frame):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    return {pb.name: pb.matrix.copy() for pb in arm.pose.bones}


def snapshot_delta(a, b):
    worst = 0.0
    for name in a:
        for r in range(4):
            for c in range(4):
                worst = max(worst, abs(a[name][r][c] - b[name][r][c]))
    return worst


def imported_min_z():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    worst = 1e9
    for obj in meshes:
        ev = obj.evaluated_get(depsgraph)
        me = ev.to_mesh()
        coords = [0.0] * (len(me.vertices) * 3)
        me.vertices.foreach_get("co", coords)
        if coords:
            mw = ev.matrix_world
            for i in range(0, len(coords), 3):
                p = mw @ Vector((coords[i], coords[i + 1], coords[i + 2]))
                worst = min(worst, p.z)
        ev.to_mesh_clear()
    return worst


loop_report = {}
for name in ("Idle", "Walk", "Run", "Flying"):
    action = set_action(name)
    start = int(action.frame_range[0])
    end = int(action.frame_range[1])
    first = bone_snapshot(start)
    last = bone_snapshot(end)
    loop_report[name] = round(snapshot_delta(first, last), 6)
    assert loop_report[name] < 1e-4, (name, loop_report[name])
print("LOOP_SEAMS", loop_report)

ground_report = {}
for name in REQUIRED:
    action = set_action(name)
    start = int(action.frame_range[0])
    end = int(action.frame_range[1])
    worst = 1e9
    for frame in range(start, end + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        worst = min(worst, imported_min_z())
    ground_report[name] = round(worst, 5)
print("IMPORTED_GROUND", ground_report)
for name in REQUIRED:
    assert ground_report[name] > -0.002, (name, ground_report[name])

# Socket follow test: sample both feet through locomotion and flight.
socket_follow = {}
for suffix in ("L", "R"):
    socket_name = f"ThrusterSocket_{suffix}"
    socket_follow[socket_name] = {}
    for action_name in ("Walk", "Run", "Takeoff", "Flying", "Landing"):
        action = set_action(action_name)
        start = int(action.frame_range[0])
        end = int(action.frame_range[1])
        positions = []
        for frame in (start, (start + end) // 2, end):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            pb = arm.pose.bones[socket_name]
            p = arm.matrix_world @ pb.head
            positions.append((round(p.x, 4), round(p.y, 4), round(p.z, 4)))
        spread = max(
            math.dist(positions[0], positions[1]),
            math.dist(positions[1], positions[2]),
            math.dist(positions[0], positions[2]),
        )
        socket_follow[socket_name][action_name] = {
            "positions": positions,
            "spread": round(spread, 5),
        }
        assert spread > 0.002, (socket_name, action_name, spread)
    # Flying exhaust must stay mostly downward.
    set_action("Flying")
    action = actions["Flying"]
    exhausts = []
    for frame in (int(action.frame_range[0]),
                  int(action.frame_range[0]) + int(action.frame_range[1]) // 2,
                  int(action.frame_range[1])):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        pb = arm.pose.bones[socket_name]
        direction = arm.matrix_world.to_3x3() @ (pb.matrix.to_3x3() @ Vector((0, 0, -1)))
        exhausts.append([round(v, 4) for v in direction])
        assert direction.z < -0.5, (socket_name, frame, direction)
    socket_report[socket_name]["flying_exhaust"] = exhausts

# Root must remain fixed in every clip; flight translation belongs to the
# existing game controller, never to the authored animation.
root_drift = {}
for name in REQUIRED:
    action = set_action(name)
    start = int(action.frame_range[0])
    end = int(action.frame_range[1])
    worst = 0.0
    rest_head = arm.data.bones["Root"].head_local
    for frame in (start, (start + end) // 2, end):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        pb = arm.pose.bones["Root"]
        worst = max(worst, (pb.head - rest_head).length, pb.location.length)
    root_drift[name] = round(worst, 6)
    assert worst < 1e-5, (name, worst)

# Pose evaluation changes the rig
set_action("Wave")
pose_a = bone_snapshot(1)
pose_b = bone_snapshot(21)
assert snapshot_delta(pose_a, pose_b) > 0.05, "Wave does not animate the rig"

# --------------------------------------------------------------------------- #
# Render reimported asset
# --------------------------------------------------------------------------- #

world = bpy.data.worlds.new("ValidationWorld")
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.035, 0.028, 0.055, 1.0)
bg.inputs["Strength"].default_value = 0.75
scene.world = world

floor_mat = bpy.data.materials.new("ValidationFloor")
floor_mat.use_nodes = True
fbsdf = next(n for n in floor_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
fbsdf.inputs["Base Color"].default_value = (0.02, 0.013, 0.03, 1.0)
fbsdf.inputs["Roughness"].default_value = 0.9
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
floor = bpy.context.object
floor.data.materials.append(floor_mat)

for name, loc, energy, size, color in (
    ("Key", (-2.2, -3.4, 3.6), 420, 3.2, (1.0, 0.93, 0.84)),
    ("Fill", (3.0, -2.0, 1.4), 150, 3.0, (0.66, 0.78, 1.0)),
    ("Rim", (0.4, 3.2, 2.8), 320, 2.6, (1.0, 0.72, 0.52)),
    ("Top", (0.0, 0.4, 4.6), 130, 2.2, (1.0, 0.92, 0.86)),
):
    ld = bpy.data.lights.new("V_" + name, "AREA")
    ld.energy = energy
    ld.shape = "DISK"
    ld.size = size
    ld.color = color
    lo = bpy.data.objects.new("V_" + name, ld)
    lo.location = loc
    direction = Vector((0, 0, 0.85)) - lo.location
    lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(lo)

cam_data = bpy.data.cameras.new("ValidationCamera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 1.70
cam = bpy.data.objects.new("ValidationCamera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.resolution_x = 760
scene.render.resolution_y = 950
scene.render.image_settings.file_format = "PNG"
scene.render.engine = "BLENDER_EEVEE"
try:
    scene.view_settings.view_transform = "Khronos PBR Neutral"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
except Exception:
    pass
try:
    scene.eevee.taa_render_samples = 48
except Exception:
    pass


def render(label, position, target=(0.0, 0.0, 0.80), scale=1.70,
           action=None, frame=1, hide_floor=False):
    floor.hide_render = hide_floor
    cam.data.ortho_scale = scale
    cam.location = position
    direction = Vector(target) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    if action:
        set_action(action)
        scene.frame_set(frame)
    else:
        arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
        scene.frame_set(1)
    scene.render.filepath = os.path.join(OUT_DIR, f"Astronaut_preview_glb_{label}.png")
    bpy.ops.render.render(write_still=True)
    print("GLB_RENDER", scene.render.filepath)


# Extra under-light for the sole validation view.
ld = bpy.data.lights.new("V_Under", "AREA")
ld.energy = 300
ld.shape = "DISK"
ld.size = 2.0
ld.color = (1.0, 0.82, 0.65)
under = bpy.data.objects.new("V_Under", ld)
under.location = (0.0, -0.8, -0.6)
under.rotation_euler = (Vector((0, 0, 0.1)) - under.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(under)

render("front", (0.0, -4.0, 0.80))
render("three_quarter", (2.7, -3.1, 1.65))
render("side", (4.0, 0.0, 0.80))
render("rear", (0.0, 4.0, 0.80))
render("wave", (0.0, -4.0, 0.80), action="Wave", frame=21)
render("walk", (2.7, -3.1, 1.65), action="Walk", frame=13)
render("bottom", (0.0, -1.2, -0.28), target=(0, 0.0, 0.03), scale=0.72,
       hide_floor=True)
render("sole_close", (0.28, -0.55, -0.18), target=(0.105, 0.015, 0.02),
       scale=0.24, hide_floor=True)
render("flying", (2.7, -3.1, 1.60), target=(0, 0, 0.78), scale=1.80,
       action="Flying", frame=19)
render("flying_bottom", (0.0, -1.5, 0.05), target=(0, 0.0, 0.25), scale=1.2,
       action="Flying", frame=19, hide_floor=True)

report = {
    "raw": raw_report,
    "import": {
        "objects": [(o.name, o.type) for o in imported],
        "armature": arm.name,
        "bones": len(arm.data.bones),
        "bounds_min": [round(v, 4) for v in mn_b],
        "bounds_max": [round(v, 4) for v in mx_b],
        "height": round(height, 4),
        "actions": action_report,
        "material_names": mat_names,
        "visor_imported_base": [round(v, 5) for v in base],
        "loops": loop_report,
        "ground_contact": ground_report,
        "socket_follow": socket_follow,
        "root_drift": root_drift,
        "pose_changes": round(snapshot_delta(pose_a, pose_b), 4),
    },
    "sockets": socket_report,
    "nozzles": nozzle_report,
}
with open(os.path.join(os.path.dirname(OUT_DIR), "Astronaut_validation.json"), "w") as handle:
    json.dump(report, handle, indent=2)
print("GLB_VALIDATION_OK")
