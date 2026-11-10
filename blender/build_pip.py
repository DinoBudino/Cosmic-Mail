"""Build PIP (the cabin companion) as a single unified Blender model.

Replaces the two hand-built primitive versions (CabinPip in MenuScene
and Companion in the Mars scene) with one editable GLB that keeps the
same silhouette, palette and animation pivots.

Usage:
    blender --background --python blender/build_pip.py

Outputs:
    blender/pip.blend
    blender/pip.glb                  (NOT wired into the game yet)
    /tmp/opencode/pip_views/*.png    (validation renders)

Orientation
    Blender is Z-up with the face toward -Y, so the glTF export (Y-up)
    faces +Z in three.js, matching the current PIP rigs. Origin sits at
    the shell centre; the thruster points down -Z.

Hierarchy (empties are kept so the existing procedural animations can
target the same pivots):
    PIP_Root
      PIP_Shell
        PIP_Eye_L / PIP_Eye_R / PIP_Mouth
        PIP_Antenna
        PIP_Arm_L / PIP_Arm_R
        PIP_Stabilizer_L / PIP_Stabilizer_R
        PIP_Thruster
          PIP_ThrusterGlow

No animation clips are exported: every motion (bob, blink, mouth,
antenna wiggle, arm wave) stays procedural in React Three Fiber.
"""

import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_PATH = os.path.join(ROOT, "blender", "pip.blend")
GLB_PATH = os.path.join(ROOT, "blender", "pip.glb")
VIEW_DIR = "/tmp/opencode/pip_views"
os.makedirs(VIEW_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0


# --------------------------------------------------------------------------- #
# Palette / materials (approved Cosmic Mail colours)
# --------------------------------------------------------------------------- #

def srgb_to_linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    linear = [
        v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        for v in values
    ]
    return (linear[0], linear[1], linear[2], 1.0)


def make_material(name, color, roughness, metallic=0.0, emission=None,
                  emission_strength=0.0, alpha=1.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        material.blend_method = "BLEND"
    return material


MAT_SHELL = make_material("Pip_ShellCream", "#F2EAE5", 0.55, 0.03)
MAT_VIOLET = make_material("Pip_Violet", "#75658C", 0.5, 0.15)
MAT_SCREEN = make_material("Pip_Screen", "#17172E", 0.22, 0.25)
MAT_FACE = make_material("Pip_FaceGlow", "#F2B5E2", 0.35, 0.0,
                         "#F2B5E2", 2.6)
MAT_THRUST = make_material("Pip_Thruster", "#FFBA70", 0.4, 0.0,
                           "#FFBA70", 2.2)
MAT_GLOW = make_material("Pip_ThrusterGlow", "#FFBA70", 0.5, 0.0,
                         "#FFBA70", 1.2, alpha=0.18)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

parts = []


def apply_transforms(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def finish(obj, material, smooth=True):
    obj.data.materials.append(material)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    apply_transforms(obj)
    parts.append(obj)
    return obj


def add_sphere(name, location, radius, scale, material, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=16, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return finish(obj, material, smooth)


def add_cylinder(name, location, radius, depth, material,
                 rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth,
        location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material)


def add_cone(name, location, r_bottom, r_top, depth, material,
             rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=r_bottom, radius2=r_top, depth=depth,
        location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material)


def add_torus(name, location, major, minor, material,
              rotation=(0, 0, 0), major_segments=24, minor_segments=10,
              arc=math.pi * 2):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=major_segments, minor_segments=minor_segments,
        location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    return finish(obj, material)


def add_empty(name, location=(0, 0, 0), parent=None):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.05
    empty.location = location
    scene.collection.objects.link(empty)
    if parent is not None:
        empty.parent = parent
    return empty


def parent_to(obj, parent):
    """Parent keeping the world transform (pivot at its own origin)."""
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()


# --------------------------------------------------------------------------- #
# Rig pivots
# --------------------------------------------------------------------------- #

ROOT_EMPTY = add_empty("PIP_Root")
SHELL = add_empty("PIP_Shell")
SHELL.parent = ROOT_EMPTY

EYE_L = add_empty("PIP_Eye_L", (-0.082, -0.246, 0.045))
EYE_R = add_empty("PIP_Eye_R", (0.082, -0.246, 0.045))
MOUTH = add_empty("PIP_Mouth", (0, -0.243, -0.072))
ANTENNA = add_empty("PIP_Antenna", (0.055, 0.015, 0.20))
ARM_L = add_empty("PIP_Arm_L", (-0.18, 0.03, 0.02))
ARM_R = add_empty("PIP_Arm_R", (0.18, 0.03, 0.02))
THRUSTER = add_empty("PIP_Thruster", (0, 0, -0.2))
for pivot in (EYE_L, EYE_R, MOUTH, ANTENNA, ARM_L, ARM_R, THRUSTER):
    pivot.parent = SHELL


# --------------------------------------------------------------------------- #
# Shell + screen (face toward -Y on export, +Z in three.js)
# --------------------------------------------------------------------------- #

shell = add_sphere("PIP_ShellMesh", (0, 0, 0), 0.235, (1, 0.9, 0.92), MAT_SHELL)
parent_to(shell, SHELL)

bezel = add_sphere("PIP_ScreenBezel", (0, -0.195, 0.005), 0.205,
                   (1, 0.22, 0.72), MAT_VIOLET)
parent_to(bezel, SHELL)

screen = add_sphere("PIP_Screen", (0, -0.202, 0.005), 0.19,
                    (1, 0.24, 0.72), MAT_SCREEN)
parent_to(screen, SHELL)

eye_l = add_sphere("PIP_Eye_L_Mesh", (-0.082, -0.246, 0.045), 0.024,
                   (1, 0.5, 1.2), MAT_FACE)
parent_to(eye_l, EYE_L)

eye_r = add_sphere("PIP_Eye_R_Mesh", (0.082, -0.246, 0.045), 0.024,
                   (1, 0.5, 1.2), MAT_FACE)
parent_to(eye_r, EYE_R)

mouth = add_sphere("PIP_Mouth_Mesh", (0, -0.243, -0.072), 0.03,
                   (0.62, 0.18, 0.28), MAT_FACE)
parent_to(mouth, MOUTH)


# --------------------------------------------------------------------------- #
# Antenna (curved stub + ring + glowing tip)
# --------------------------------------------------------------------------- #

curve = bpy.data.curves.new("PIP_AntennaCurve", "CURVE")
curve.dimensions = "3D"
curve.resolution_u = 12
curve.bevel_depth = 0.009
curve.bevel_resolution = 4
spline = curve.splines.new("BEZIER")
spline.bezier_points.add(2)
points = [(0, 0, 0), (0.012, 0.005, 0.09), (0.05, -0.006, 0.155)]
for point, co in zip(spline.bezier_points, points):
    point.co = Vector(co)
    point.handle_left_type = "AUTO"
    point.handle_right_type = "AUTO"
antenna_mesh = bpy.data.objects.new("PIP_AntennaStalk", curve)
antenna_mesh.location = ANTENNA.location
scene.collection.objects.link(antenna_mesh)
bpy.context.view_layer.objects.active = antenna_mesh
antenna_mesh.select_set(True)
bpy.ops.object.convert(target="MESH")
antenna_mesh = bpy.context.object
finish(antenna_mesh, MAT_SHELL)
parent_to(antenna_mesh, ANTENNA)

antenna_ring = add_torus("PIP_AntennaRing", (0.105, 0.009, 0.355), 0.022,
                         0.006, MAT_VIOLET, rotation=(math.pi / 2, 0, 0))
parent_to(antenna_ring, ANTENNA)

antenna_tip = add_sphere("PIP_AntennaTip", (0.11, 0.009, 0.40), 0.027,
                        (1, 1, 1), MAT_FACE)
parent_to(antenna_tip, ANTENNA)


# --------------------------------------------------------------------------- #
# EVA arms (side pods with a warm light) + cabin stabilizers
# --------------------------------------------------------------------------- #

arm_l = add_sphere("PIP_Arm_L_Mesh", (-0.255, 0.03, 0.0), 0.05,
                   (0.55, 0.3, 1.1), MAT_SHELL)
arm_l.rotation_euler = (0, math.radians(20), 0)
apply_transforms(arm_l)
parent_to(arm_l, ARM_L)

arm_l_light = add_sphere("PIP_Arm_L_Light", (-0.305, 0.03, 0.03), 0.013,
                         (1, 1, 1), MAT_FACE)
parent_to(arm_l_light, ARM_L)

arm_r = add_sphere("PIP_Arm_R_Mesh", (0.255, 0.03, 0.0), 0.05,
                   (0.55, 0.3, 1.1), MAT_SHELL)
arm_r.rotation_euler = (0, math.radians(-20), 0)
apply_transforms(arm_r)
parent_to(arm_r, ARM_R)

arm_r_light = add_sphere("PIP_Arm_R_Light", (0.305, 0.03, 0.03), 0.013,
                         (1, 1, 1), MAT_FACE)
parent_to(arm_r_light, ARM_R)

for side, name in ((-1, "PIP_Stabilizer_L"), (1, "PIP_Stabilizer_R")):
    stabilizer = add_sphere(name, (side * 0.285, 0.0, -0.05), 0.045,
                            (1, 1, 1), MAT_VIOLET)
    parent_to(stabilizer, SHELL)


# --------------------------------------------------------------------------- #
# Thruster (base pod + nozzle + additive glow cone)
# --------------------------------------------------------------------------- #

thruster_base = add_sphere("PIP_ThrusterBase", (0, 0, -0.2), 0.085,
                           (1, 1, 0.62), MAT_VIOLET)
parent_to(thruster_base, THRUSTER)

nozzle = add_cylinder("PIP_ThrusterNozzle", (0, 0, -0.245), 0.058, 0.012,
                      MAT_THRUST)
parent_to(nozzle, THRUSTER)

glow = add_cone("PIP_ThrusterGlow", (0, 0, -0.29), 0.004, 0.045, 0.08,
                MAT_GLOW)
parent_to(glow, THRUSTER)


# --------------------------------------------------------------------------- #
# Consistency check + export
# --------------------------------------------------------------------------- #

bpy.context.view_layer.update()
for obj in parts:
    assert obj.parent is not None, f"{obj.name} is not parented to a pivot"

triangles = 0
for obj in parts:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
)

print(f"PIP triangles: {triangles}")
print(f"PIP parts: {len(parts)}")
print(f"blend: {BLEND_PATH}")
print(f"glb:   {GLB_PATH}")


# --------------------------------------------------------------------------- #
# Validation renders (neutral studio, three views)
# --------------------------------------------------------------------------- #

studio = bpy.data.collections.new("ValidationStudio")
scene.collection.children.link(studio)

floor_mat = make_material("StudioFloor", "#1A1426", 0.9)
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.42))
floor = bpy.context.object
floor.data.materials.append(floor_mat)
for collection in floor.users_collection:
    collection.objects.unlink(floor)
studio.objects.link(floor)

key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
key.data.energy = 180
key.data.size = 3
key.location = (1.6, -2.0, 1.8)
key.rotation_euler = (math.radians(52), 0, math.radians(38))
studio.objects.link(key)

fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
fill.data.energy = 70
fill.data.size = 3
fill.data.color = (0.62, 0.78, 1.0)
fill.location = (-1.8, -1.4, 0.6)
fill.rotation_euler = (math.radians(78), 0, math.radians(-52))
studio.objects.link(fill)

rim = bpy.data.objects.new("Rim", bpy.data.lights.new("Rim", "AREA"))
rim.data.energy = 90
rim.data.size = 2
rim.data.color = (1.0, 0.78, 0.55)
rim.location = (0.2, 1.9, 1.2)
rim.rotation_euler = (math.radians(115), 0, math.radians(6))
studio.objects.link(rim)

world = bpy.data.worlds.new("StudioWorld")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.015, 0.04, 1)
scene.world = world

camera_data = bpy.data.cameras.new("ValidationCamera")
camera_data.lens = 62
camera = bpy.data.objects.new("ValidationCamera", camera_data)
studio.objects.link(camera)
scene.camera = camera

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.film_transparent = False

views = {
    "front": (0.0, -1.45, 0.16),
    "three_quarter": (1.05, -1.12, 0.42),
    "side": (1.42, -0.16, 0.2),
}
for label, position in views.items():
    camera.location = position
    target = Vector((0, 0, 0.04))
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(VIEW_DIR, f"pip_{label}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", scene.render.filepath)

print("done")
