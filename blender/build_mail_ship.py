"""Build the Cosmic Mail ship ("Mailwing") in Blender 5.2.

A small, rounded mail-carrier spacecraft for the astronaut. Designed to be
reused in three places: the main-menu scene, exterior shots, and a future
star-travel scene filmed from inside the cockpit — so the interior (seat,
dashboard, canopy frame) is modelled now, kept deliberately simple.

Usage:
    blender --background --python blender/build_mail_ship.py

Outputs:
    blender/mail_ship.blend
    public/models/mail-ship.glb
    /tmp/opencode/mail_ship_views/*.png  (neutral validation views)

Orientation (v2, vertical mail pod): nose up +Z, engine down -Z, front
(round window) toward +Y, mail compartment at the back (-Y). On GLB export
(Y-up) the nose points +Y in three.js and the window faces -Z, matching the
astronaut model's facing convention. The pod is presented tilted in the menu
so it reads as a flying capsule, like the Astroneer habitat pod.
"""

import json
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_PATH = os.path.join(ROOT, "blender", "mail_ship.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "mail-ship.glb")
VIEW_DIR = "/tmp/opencode/mail_ship_views"
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
os.makedirs(VIEW_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0


# --------------------------------------------------------------------------- #
# Palette (approved Cosmic Mail colours) and materials
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


MAT_HULL = make_material("Mail_HullCream", "#F2EAE5", 0.55)
MAT_ACCENT = make_material("Mail_Terracotta", "#C97A63", 0.6)
MAT_VIOLET = make_material("Mail_Violet", "#75658C", 0.6)
MAT_DARK = make_material("Mail_Dark", "#2A1D3B", 0.5, 0.3)
MAT_SEAT = make_material("Mail_SeatViolet", "#5B4A6E", 0.75)
MAT_PAPER = make_material("Mail_Paper", "#FAF3EA", 0.55)
MAT_GLASS = make_material("Mail_CanopyGlass", "#BFE3FF", 0.08, 0.0,
                          "#BFE3FF", 0.08, alpha=0.16)
MAT_LIGHT = make_material("Mail_WarmLight", "#FFD9A8", 0.35, 0.0,
                          "#FFD9A8", 1.6)
MAT_THRUST = make_material("Mail_Thruster", "#FFBA70", 0.4, 0.0,
                           "#FFBA70", 2.2)
MAT_GOLD = make_material("Mail_WindowGold", "#E8B04B", 0.45, 0.25)


# --------------------------------------------------------------------------- #
# Helpers (same style as build_cosmic_carrier.py)
# --------------------------------------------------------------------------- #

parts = []


def finish(obj, material, smooth=True):
    obj.data.materials.append(material)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    parts.append(obj)
    return obj


def add_sphere(name, location, radius, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32, ring_count=24, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return finish(obj, material)


def add_box(name, location, size, material, bevel=0.02, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    obj.rotation_euler = rotation
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("SoftBevel", "BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return finish(obj, material, smooth=False)


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


# --------------------------------------------------------------------------- #
# Hull: vertical mail pod (Astroneer habitat-pod language): cylindrical
# body, domed top, big round window as the focal point, landing legs and
# a visible engine nozzle. Nose up +Z, engine down, window front +Y.
# --------------------------------------------------------------------------- #

add_cylinder("Hull", (0, 0, 1.05), 0.55, 1.10, MAT_HULL)
add_sphere("DomeTop", (0, 0, 1.60), 1.0, (0.55, 0.55, 0.48), MAT_HULL)
add_cone("BottomTaper", (0, 0, 0.28), 0.38, 0.55, 0.50, MAT_HULL)

# Painted bands: terracotta stripe + dark rings (high-contrast readable
# from a distance, like the references).
add_cylinder("Stripe", (0, 0, 1.30), 0.56, 0.20, MAT_ACCENT)
add_cylinder("RingTop", (0, 0, 1.47), 0.565, 0.06, MAT_DARK)
add_cylinder("RingBottom", (0, 0, 0.78), 0.565, 0.06, MAT_DARK)

# Top cap + antenna with a warm tip light.
add_cylinder("TopCap", (0, 0, 1.98), 0.20, 0.08, MAT_DARK)
add_cylinder("Antenna", (0, 0, 2.15), 0.012, 0.30, MAT_DARK)
add_sphere("AntennaTip", (0, 0, 2.32), 0.024, (1.0, 1.0, 1.0), MAT_LIGHT)

# Big round window on the front: thin gold rim, dark glass with a small
# warm reflection, and the astronaut's helmet just behind the glass so
# someone is clearly "inside".
MAT_WINDOW = make_material("Mail_WindowDark", "#17172E", 0.15, 0.2,
                           "#3A4A6E", 0.25)
add_cylinder("WindowRim", (0, 0.53, 1.15), 0.25, 0.06, MAT_GOLD,
             rotation=(math.pi / 2, 0, 0))
add_cylinder("WindowGlass", (0, 0.565, 1.15), 0.20, 0.02, MAT_WINDOW,
             rotation=(math.pi / 2, 0, 0))
add_sphere("OccupantHelmet", (0, 0.44, 1.15), 0.13, (1.0, 0.75, 1.0), MAT_HULL)
add_sphere("OccupantVisor", (0, 0.53, 1.15), 0.10, (0.85, 0.45, 0.75), MAT_DARK)
add_sphere("WindowGlint", (0.07, 0.585, 1.22), 0.035, (1.0, 0.6, 1.0), MAT_LIGHT)

# Little ladder under the window (warm gold, like the reference pods).
for side in (-1, 1):
    add_cylinder(f"LadderRail{side}", (side * 0.10, 0.56, 0.62), 0.016, 0.52,
                 MAT_GOLD)
for index, z in enumerate((0.44, 0.60, 0.76)):
    add_box(f"LadderRung{index}", (0, 0.56, z), (0.24, 0.03, 0.03), MAT_GOLD,
            bevel=0.008)

# Engine nozzle + thruster glow at the bottom.
add_cone("EngineNozzle", (0, 0, -0.02), 0.20, 0.30, 0.22, MAT_DARK)
add_cylinder("ThrusterGlow", (0, 0, -0.15), 0.13, 0.03, MAT_THRUST)

# Four landing legs with foot pads (Mars-ready, like the reference pods).
for index, angle in enumerate((45, 135, 225, 315)):
    radians = math.radians(angle)
    dx, dy = math.cos(radians), math.sin(radians)
    add_cylinder(f"Leg{index}", (dx * 0.40, dy * 0.40, 0.18), 0.045, 0.36,
                 MAT_VIOLET)
    add_sphere(f"Foot{index}", (dx * 0.44, dy * 0.44, -0.02), 1.0,
               (0.16, 0.16, 0.07), MAT_HULL)
    add_sphere(f"FootPad{index}", (dx * 0.44, dy * 0.44, -0.06), 1.0,
               (0.11, 0.11, 0.04), MAT_DARK)

# (Side tanks removed: they read as stray rectangles/arms in the menu
# view. The pod silhouette stays clean and capsule-like.)

# Mail compartment on the back: terracotta box + envelope + orange seal.
add_box("MailBox", (0, -0.56, 1.05), (0.36, 0.14, 0.30), MAT_ACCENT, bevel=0.03)
add_box("Envelope", (0, -0.64, 1.05), (0.22, 0.02, 0.18), MAT_PAPER, bevel=0.005)
add_sphere("EnvelopeSeal", (0, -0.66, 1.05), 0.02, (1.0, 1.0, 1.0), MAT_THRUST)

# Join everything into a single mesh for a light game asset. The window
# glass stays separate so the game can toggle it (e.g. for an interior
# camera later).
canopy_obj = next(obj for obj in parts if obj.name == "WindowGlass")
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    if obj.name != "WindowGlass":
        obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
hull = bpy.context.object
hull.name = "Mailwing"
canopy_obj.select_set(True)
bpy.context.view_layer.objects.active = canopy_obj
bpy.context.view_layer.update()

bpy.ops.object.select_all(action="DESELECT")
hull.select_set(True)
bpy.context.view_layer.objects.active = hull
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

# --------------------------------------------------------------------------- #
# Export the game GLB (static mesh, no rig/animations needed)
# --------------------------------------------------------------------------- #

bpy.ops.object.select_all(action="DESELECT")
hull.select_set(True)
canopy_obj.select_set(True)
bpy.context.view_layer.objects.active = hull
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_skins=False,
    export_texcoords=False,
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)

# --------------------------------------------------------------------------- #
# Neutral validation renders: front, profile, back, 3/4, cockpit
# --------------------------------------------------------------------------- #

view_world = bpy.data.worlds.new("ValidationWorld")
view_world.use_nodes = True
background = view_world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.055, 0.035, 0.09, 1.0)
background.inputs["Strength"].default_value = 0.8
scene.world = view_world

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = "ValidationFloor"
floor.data.materials.append(make_material("ValidationFloor", "#8A8A8C", 0.85))

for name, location, energy, size in (
    ("Key", (-3, 3.5, 4.0), 550, 4.0),
    ("Fill", (3, 2.5, 2.0), 260, 5.0),
    ("Rim", (0, -4, 3.5), 400, 3.0),
):
    bpy.ops.object.light_add(type="AREA", location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    direction = Vector((0, 0, 0.55)) - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("ValidationCamera")
camera = bpy.data.objects.new("ValidationCamera", camera_data)
scene.collection.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.4
scene.camera = camera

scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 32
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False

views = {
    "front": ((0, 5.0, 1.3), (0, 0, 0.95)),
    "profile": ((-5.0, 0, 1.3), (0, 0, 0.95)),
    "back": ((0, -5.0, 1.3), (0, 0, 0.95)),
    "three_quarter": ((3.4, 3.4, 2.4), (0, 0, 0.95)),
    # Close front view of the round window and its occupant.
    "cockpit": ((0.9, 2.6, 1.9), (0, 0.3, 1.1)),
}
for name, (location, target) in views.items():
    camera.location = location
    direction = Vector(target) - Vector(location)
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(VIEW_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

try:
    from PIL import Image, ImageDraw

    labels = {"front": "FRONT", "profile": "PROFILE", "back": "BACK",
              "three_quarter": "3/4", "cockpit": "COCKPIT"}
    keys = ["front", "profile", "back", "three_quarter", "cockpit"]
    images = []
    for key in keys:
        image = Image.open(os.path.join(VIEW_DIR, f"{key}.png")).convert("RGB")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 170, 30), fill=(20, 20, 24))
        draw.text((10, 8), labels[key], fill=(245, 240, 235))
        images.append(image)
    sheet = Image.new("RGB", (1280, 1920), (20, 20, 24))
    for index, image in enumerate(images):
        sheet.paste(image, ((index % 2) * 640, (index // 2) * 640))
    sheet.save(os.path.join(VIEW_DIR, "contact_sheet.png"))
except Exception as error:
    print("Contact sheet generation skipped:", error)

triangles = 0
for obj in (hull,):
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
canopy_obj.data.calc_loop_triangles()
triangles += len(canopy_obj.data.loop_triangles)

print(json.dumps({
    "blend": BLEND_PATH,
    "glb": GLB_PATH,
    "glb_bytes": os.path.getsize(GLB_PATH),
    "triangles": triangles,
    "views": VIEW_DIR,
}, indent=2))
