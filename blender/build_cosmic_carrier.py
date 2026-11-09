"""Build The Little Cosmic Mail Carrier (v2) in Blender 5.2.

This is a NEW character design, not an edit of the previous astronaut.

Usage:
    blender --background --python blender/build_cosmic_carrier.py

Outputs:
    blender/cosmic_carrier.blend
    public/models/astronaut.glb          (game asset, regenerated here)
    <temp>/cosmic_carrier_views/*.png     (neutral validation views)

The game asset in public/models is the single source of truth. Review the
validation views and deformation metrics before using the export in game.
"""

import json
import math
import os
import tempfile

import bmesh
import bpy
from mathutils import Vector


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLEND_PATH = os.path.join(ROOT, "blender", "cosmic_carrier.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "astronaut.glb")
VIEW_DIR = os.path.join(tempfile.gettempdir(), "cosmic_carrier_views")
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
os.makedirs(VIEW_DIR, exist_ok=True)


# --------------------------------------------------------------------------- #
# Scene and palette
# --------------------------------------------------------------------------- #

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
scene.frame_start = 1
scene.frame_end = 96
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0


def srgb_to_linear(hex_color: str) -> tuple[float, float, float, float]:
    values = [int(hex_color[i : i + 2], 16) / 255.0 for i in (1, 3, 5)]
    linear = [
        value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
        for value in values
    ]
    return (linear[0], linear[1], linear[2], 1.0)


def make_material(
    name: str,
    color: str,
    roughness: float,
    metallic: float = 0.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = srgb_to_linear(color)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


MAT_SUIT = make_material("CC_Suit_WarmWhite", "#F2EAE5", 0.68)
MAT_VISOR = make_material("CC_Visor_BlueBlack", "#111124", 0.12, 0.45)
MAT_ORANGE = make_material("CC_Orange_Soft", "#E3A16A", 0.58)
MAT_VIOLET = make_material("CC_Violet_Accent", "#75658C", 0.58)
MAT_BOOT = make_material("CC_Boot_DarkViolet", "#494257", 0.62)
MAT_SOLE = make_material("CC_Sole_Deep", "#3B3548", 0.82)
MAT_PAPER = make_material("CC_Paper_Envelope", "#FAF3EA", 0.55)
MAT_REFLECTION = make_material(
    "CC_Visor_Reflection", "#E9F2FF", 0.30, 0.0, "#E9F2FF", 0.45
)
MAT_LIGHT = make_material(
    "CC_Status_Orange", "#FFD1A1", 0.35, 0.0, "#FFD1A1", 1.0
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

accessories: list[bpy.types.Object] = []


def append_material(obj, material):
    obj.data.materials.append(material)


def shade_smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def assign_group(obj, bone: str):
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")


def add_to_accessories(obj, material, bone: str, smooth=True):
    append_material(obj, material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth
    assign_group(obj, bone)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    accessories.append(obj)
    return obj


def add_existing_accessory(obj, bone: str):
    """Join an already-materialed object into the rigid accessories mesh."""
    assign_group(obj, bone)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    accessories.append(obj)
    return obj


def body_sphere(name, location, scale, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20,
        ring_count=12,
        radius=1.0,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)
    return obj


def add_sphere(name, location, radius, scale, material, bone, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return add_to_accessories(obj, material, bone, True)


def add_rounded_box(
    name,
    location,
    size,
    material,
    bone,
    bevel=0.02,
    bevel_segments=2,
    rotation=(0.0, 0.0, 0.0),
):
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
    modifier.segments = bevel_segments
    modifier.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return add_to_accessories(obj, material, bone, False)


def add_cylinder(
    name,
    location,
    radius,
    depth,
    material,
    bone,
    rotation=(0.0, 0.0, 0.0),
    vertices=16,
    scale=(1.0, 1.0, 1.0),
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return add_to_accessories(obj, material, bone, True)


def add_cone(
    name,
    location,
    radius_bottom,
    radius_top,
    depth,
    material,
    bone,
    vertices=20,
):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    return add_to_accessories(obj, material, bone, True)


def add_foot_sole(name, location, material, bone):
    """A thin, foot-shaped sole: narrow heel, wider ball and rounded toe."""
    outline = [
        (0.052, -0.098),
        (0.072, -0.060),
        (0.082, 0.005),
        (0.092, 0.058),
        (0.078, 0.105),
        (0.043, 0.128),
        (0.000, 0.136),
        (-0.043, 0.128),
        (-0.078, 0.105),
        (-0.092, 0.058),
        (-0.082, 0.005),
        (-0.072, -0.060),
        (-0.052, -0.098),
        (0.000, -0.105),
    ]
    thickness = 0.012
    count = len(outline)
    vertices = [(x, y, 0.0) for x, y in outline]
    vertices += [(x, y, thickness) for x, y in outline]
    faces = [list(range(count - 1, -1, -1)), list(range(count, count * 2))]
    for index in range(count):
        following = (index + 1) % count
        faces.append(
            [index, following, count + following, count + index]
        )

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = location

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new("SoftEdge", "BEVEL")
    bevel.width = 0.003
    bevel.segments = 2
    bevel.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier=bevel.name)

    return add_to_accessories(obj, material, bone, True)


def add_torus(
    name,
    location,
    major_radius,
    minor_radius,
    material,
    bone,
    rotation=(0.0, 0.0, 0.0),
    scale=(1.0, 1.0, 1.0),
):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    return add_to_accessories(obj, material, bone, True)


def local_sphere(name, location, radius, scale, material, segments=48, rings=32):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=radius,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    append_material(obj, material)
    shade_smooth(obj)
    return obj


def make_ellipse_shell(
    name,
    center_z,
    radii,
    a,
    b,
    center_x,
    center_z_offset,
    u_min,
    u_max,
    rings,
    segments,
    material,
):
    """A smooth elliptical shell conforming to the helmet ellipsoid."""
    rx, ry, rz = radii

    def point(u, v):
        x = center_x + a * u * math.cos(v)
        z = center_z_offset + b * u * math.sin(v)
        inside = 1.0 - (x / rx) ** 2 - (z / rz) ** 2
        y = ry * math.sqrt(max(0.0, inside))
        return (x, y, center_z + z)

    vertices = []
    faces = []
    if u_min <= 1e-6:
        vertices.append(point(0.0, 0.0))
        for ring in range(1, rings + 1):
            u = u_max * ring / rings
            for segment in range(segments):
                vertices.append(point(u, 2.0 * math.pi * segment / segments))
        for segment in range(segments):
            faces.append((0, 1 + segment, 1 + (segment + 1) % segments))
        for ring in range(1, rings):
            start = 1 + (ring - 1) * segments
            following = 1 + ring * segments
            for segment in range(segments):
                next_segment = (segment + 1) % segments
                faces.append(
                    (
                        start + segment,
                        following + segment,
                        following + next_segment,
                        start + next_segment,
                    )
                )
    else:
        for ring in range(rings + 1):
            u = u_min + (u_max - u_min) * ring / rings
            for segment in range(segments):
                vertices.append(point(u, 2.0 * math.pi * segment / segments))
        for ring in range(rings):
            start = ring * segments
            following = (ring + 1) * segments
            for segment in range(segments):
                next_segment = (segment + 1) % segments
                faces.append(
                    (
                        start + segment,
                        following + segment,
                        following + next_segment,
                        start + next_segment,
                    )
                )

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.faces.ensure_lookup_table()
    if bm.faces and bm.faces[0].normal.y < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    append_material(obj, material)
    shade_smooth(obj)
    return obj


# --------------------------------------------------------------------------- #
# Continuous suit body (one fused mesh, not assembled limbs)
# --------------------------------------------------------------------------- #

body_parts = [
    body_sphere("Torso", (0, 0, 0.66), (0.202, 0.172, 0.235)),
    body_sphere("Hips", (0, 0, 0.48), (0.175, 0.148, 0.13)),
    body_sphere("Neck", (0, 0, 0.875), (0.115, 0.11, 0.08)),
]

for side in (-1, 1):
    body_parts.append(
        body_sphere(
            f"Thigh{side}",
            (side * 0.11, 0, 0.35),
            (0.082, 0.082, 0.125),
        )
    )
    body_parts.append(
        body_sphere(
            f"Calf{side}",
            (side * 0.11, 0, 0.21),
            (0.072, 0.072, 0.095),
        )
    )

bpy.ops.object.select_all(action="DESELECT")
for part in body_parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = body_parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = "SuitBody"

remesh = body.modifiers.new("ContinuousSuit", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = 0.012
remesh.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier=remesh.name)

smooth = body.modifiers.new("Soften", "SMOOTH")
smooth.factor = 0.65
smooth.iterations = 6
bpy.ops.object.modifier_apply(modifier=smooth.name)

decimate = body.modifiers.new("LowPoly", "DECIMATE")
decimate.ratio = 0.24
bpy.ops.object.modifier_apply(modifier=decimate.name)

smooth_final = body.modifiers.new("SoftenFinal", "SMOOTH")
smooth_final.factor = 0.5
smooth_final.iterations = 4
bpy.ops.object.modifier_apply(modifier=smooth_final.name)

body.data.materials.append(MAT_SUIT)
shade_smooth(body)
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


# --------------------------------------------------------------------------- #
# Helmet with a conformal visor and thin rim
# --------------------------------------------------------------------------- #

HELMET_Z = 1.14
HELMET_RADIUS = 0.29
helmet = local_sphere(
    "Helmet",
    (0, 0, HELMET_Z),
    HELMET_RADIUS,
    (1.0, 0.96, 0.90),
    MAT_SUIT,
)
add_existing_accessory(helmet, "Head")

# Smooth parametric shells conforming to the helmet ellipsoid.
# Big visor: the shell is computed from the helmet ellipsoid, so a wider
# ellipse simply wraps further around the helmet while keeping its curvature.
visor = make_ellipse_shell(
    "Visor",
    HELMET_Z,
    (0.292, 0.2804, 0.263),
    0.235,
    0.162,
    0.0,
    0.018,
    0.0,
    0.97,
    12,
    56,
    MAT_VISOR,
)
add_existing_accessory(visor, "Head")

rim = make_ellipse_shell(
    "VisorRim",
    HELMET_Z,
    (0.294, 0.2824, 0.265),
    0.235,
    0.162,
    0.0,
    0.018,
    0.94,
    1.08,
    3,
    56,
    MAT_ORANGE,
)
add_existing_accessory(rim, "Head")

# Stylised highlights. The game has no environment map, so these shells are
# what actually sells the glossy glass at gameplay distance.
reflection = make_ellipse_shell(
    "VisorReflection",
    HELMET_Z,
    (0.296, 0.2844, 0.267),
    0.058,
    0.024,
    -0.090,
    0.130,
    0.0,
    1.0,
    5,
    28,
    MAT_REFLECTION,
)
add_existing_accessory(reflection, "Head")

reflection_two = make_ellipse_shell(
    "VisorReflectionTwo",
    HELMET_Z,
    (0.297, 0.2854, 0.268),
    0.032,
    0.015,
    0.086,
    0.104,
    0.0,
    1.0,
    4,
    22,
    MAT_REFLECTION,
)
add_existing_accessory(reflection_two, "Head")

reflection_three = make_ellipse_shell(
    "VisorReflectionThree",
    HELMET_Z,
    (0.298, 0.2864, 0.269),
    0.016,
    0.009,
    -0.030,
    0.062,
    0.0,
    1.0,
    3,
    16,
    MAT_REFLECTION,
)
add_existing_accessory(reflection_three, "Head")



for side in (-1, 1):
    add_cylinder(
        f"HelmetSide{side}",
        (side * 0.285, 0, HELMET_Z),
        0.052,
        0.024,
        MAT_VIOLET,
        "Head",
        (0, math.pi / 2, 0),
        16,
    )
    add_cylinder(
        f"HelmetSideCap{side}",
        (side * 0.298, 0, HELMET_Z),
        0.027,
        0.012,
        MAT_ORANGE,
        "Head",
        (0, math.pi / 2, 0),
        12,
    )

# Collar connecting helmet and suit.
add_torus(
    "Collar",
    (0, 0, 0.875),
    0.205,
    0.018,
    MAT_VIOLET,
    "Spine",
    scale=(1.0, 0.9, 1.0),
)


# --------------------------------------------------------------------------- #
# Separate arms (not fused into the torso so they rotate cleanly)
# --------------------------------------------------------------------------- #

for side, suffix in ((-1, "L"), (1, "R")):
    add_sphere(
        f"ShoulderPad.{suffix}",
        (side * 0.205, 0, 0.785),
        1.0,
        (0.055, 0.055, 0.07),
        MAT_SUIT,
        f"UpperArm.{suffix}",
        20,
        12,
    )
    upper_arm_len = math.sqrt((side * 0.055) ** 2 + (-0.14) ** 2)
    add_cylinder(
        f"UpperArm.{suffix}",
        (side * 0.2425, 0, 0.71),
        0.046,
        upper_arm_len,
        MAT_SUIT,
        f"UpperArm.{suffix}",
        rotation=(0, math.atan2(side * 0.055, -0.14), 0),
        vertices=18,
    )
    lower_arm_len = math.sqrt((side * 0.04) ** 2 + (-0.14) ** 2)
    add_cylinder(
        f"LowerArm.{suffix}",
        (side * 0.29, 0, 0.57),
        0.042,
        lower_arm_len,
        MAT_SUIT,
        f"Forearm.{suffix}",
        rotation=(0, math.atan2(side * 0.04, -0.14), 0),
        vertices=18,
    )

# --------------------------------------------------------------------------- #
# Padded mittens and wide boots
# --------------------------------------------------------------------------- #

for side, suffix in ((-1, "L"), (1, "R")):
    # The mitten reaches up to meet the forearm, so the glove reads as one
    # piece. The old floating torus "cuff" read as a bracelet and was
    # removed; the violet forearm band below carries the colour break.
    add_sphere(
        f"Mitten.{suffix}",
        (side * 0.332, 0, 0.42),
        1.0,
        (0.085, 0.072, 0.105),
        MAT_ORANGE,
        f"Hand.{suffix}",
        20,
        12,
    )
    add_sphere(
        f"Thumb.{suffix}",
        (side * 0.285, 0.035, 0.425),
        0.035,
        (1.0, 1.0, 1.0),
        MAT_ORANGE,
        f"Hand.{suffix}",
        12,
        8,
    )

    add_torus(
        f"ShoulderCuff.{suffix}",
        (side * 0.222, 0, 0.775),
        0.054,
        0.012,
        MAT_VIOLET,
        f"UpperArm.{suffix}",
        scale=(1.0, 0.9, 1.0),
    )
    add_torus(
        f"ElbowCuff.{suffix}",
        (side * 0.286, 0, 0.635),
        0.046,
        0.010,
        MAT_VIOLET,
        f"Forearm.{suffix}",
        scale=(1.0, 0.92, 1.0),
    )
    # Violet forearm band: gives the arm a readable colour break at distance.
    add_torus(
        f"ForearmBand.{suffix}",
        (side * 0.303, 0, 0.525),
        0.043,
        0.009,
        MAT_VIOLET,
        f"Forearm.{suffix}",
        scale=(1.0, 0.92, 1.0),
    )
    add_sphere(
        f"ElbowPad.{suffix}",
        (side * 0.27, 0, 0.64),
        1.0,
        (0.042, 0.042, 0.045),
        MAT_VIOLET,
        f"Forearm.{suffix}",
        16,
        10,
    )
    # Violet calf band + knee pad: same colour break for the legs.
    add_torus(
        f"CalfBand.{suffix}",
        (side * 0.11, 0, 0.24),
        0.068,
        0.012,
        MAT_VIOLET,
        f"LowerLeg.{suffix}",
    )
    add_sphere(
        f"KneePad.{suffix}",
        (side * 0.11, 0, 0.31),
        1.0,
        (0.045, 0.045, 0.05),
        MAT_VIOLET,
        f"LowerLeg.{suffix}",
        16,
        10,
    )

    add_sphere(
        f"Boot.{suffix}",
        (side * 0.11, 0.025, 0.09),
        1.0,
        (0.078, 0.095, 0.072),
        MAT_BOOT,
        f"Foot.{suffix}",
        24,
        16,
    )
    add_sphere(
        f"BootToe.{suffix}",
        (side * 0.11, 0.105, 0.058),
        1.0,
        (0.075, 0.05, 0.035),
        MAT_ORANGE,
        f"Foot.{suffix}",
        20,
        12,
    )
    add_rounded_box(
        f"BootSole.{suffix}",
        (side * 0.11, 0.04, 0.02),
        (0.07, 0.125, 0.018),
        MAT_SOLE,
        f"Foot.{suffix}",
        0.008,
        2,
        rotation=(-0.12, 0, 0),
    )
    add_cone(
        f"BootCuff.{suffix}",
        (side * 0.11, 0, 0.16),
        0.075,
        0.068,
        0.04,
        MAT_SUIT,
        f"Foot.{suffix}",
        20,
    )



# --------------------------------------------------------------------------- #
# Postal backpack, straps and letter anchor
# --------------------------------------------------------------------------- #

# The torso is an ellipsoid, so a flat box can only touch it at one point and
# reads as floating (or sinks in) from the side. The pack's contact face is
# instead molded onto the real back surface: every front vertex is ray-cast
# against the body and placed 8 mm off the skin. The shoulder straps are
# built the same way: control points are projected onto the suit, so the band
# lies on the torso instead of hovering next to it.
from mathutils.bvhtree import BVHTree

body_bvh = BVHTree.FromPolygons(
    [vertex.co.copy() for vertex in body.data.vertices],
    [tuple(polygon.vertices) for polygon in body.data.polygons],
)


def body_surface(point, margin=0.009):
    """Closest point on the suit, pushed out along its normal."""
    nearest, normal, _index, _distance = body_bvh.find_nearest(Vector(point))
    if nearest is None:
        return Vector(point)
    direction = Vector(normal)
    if direction.length < 1e-6:
        direction = Vector((0.0, 0.0, 1.0))
    return nearest + direction.normalized() * margin


def catmull_rom(points, samples_per_segment=8):
    padded = [points[0]] + list(points) + [points[-1]]
    sampled = []
    for index in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[index - 1 : index + 3]
        for step in range(samples_per_segment):
            t = step / samples_per_segment
            t2 = t * t
            t3 = t2 * t
            sampled.append(
                0.5
                * (
                    2.0 * p1
                    + (-p0 + p2) * t
                    + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2
                    + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3
                )
            )
    sampled.append(padded[-2])
    return sampled


def project_path(targets, samples_per_segment=8):
    """Sample a smooth path, then snap every sample onto the suit."""
    projected = []
    for point in catmull_rom([Vector(target) for target in targets], samples_per_segment):
        nearest, normal, _index, _distance = body_bvh.find_nearest(point)
        if nearest is None:
            continue
        direction = Vector(normal)
        if direction.length < 1e-6:
            direction = Vector((0.0, 0.0, 1.0))
        projected.append((nearest, direction.normalized()))
    deduplicated = []
    for point, normal in projected:
        if deduplicated and (point - deduplicated[-1][0]).length < 1e-5:
            continue
        deduplicated.append((point, normal))
    return deduplicated


def add_surface_band(
    name, samples, half_width, half_thickness, material, bone, closed=False
):
    """A flat strap lying on the suit: inner face just below the skin,
    outer face `half_thickness` above it, width oriented across the path."""
    count = len(samples)
    vertices = []
    for index, (point, normal) in enumerate(samples):
        if closed:
            previous = samples[(index - 1) % count][0]
            following = samples[(index + 1) % count][0]
        else:
            previous = samples[max(0, index - 1)][0]
            following = samples[min(count - 1, index + 1)][0]
        tangent = (following - previous)
        if tangent.length < 1e-8:
            tangent = Vector((0.0, 0.0, 1.0))
        tangent.normalize()
        width_direction = normal.cross(tangent)
        if width_direction.length < 1e-6:
            width_direction = normal.cross(Vector((0.0, 1.0, 0.0)))
        width_direction.normalize()
        outer = point + normal * half_thickness
        inner = point - normal * 0.0006
        vertices.extend(
            [
                outer - width_direction * half_width,
                outer + width_direction * half_width,
                inner + width_direction * half_width,
                inner - width_direction * half_width,
            ]
        )
    faces = []
    segments = count if closed else count - 1
    for index in range(segments):
        current = index * 4
        following = ((index + 1) % count) * 4
        faces.append((current, current + 1, following + 1, following))
        faces.append((current + 2, following + 2, following + 3, current + 3))
        faces.append((current + 3, following + 3, following, current))
        faces.append((current + 1, current + 2, following + 2, following + 1))
    if not closed:
        faces.append((0, 3, 2, 1))
        last = (count - 1) * 4
        faces.append((last, last + 1, last + 2, last + 3))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.validate()
    mesh.update()
    flat = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(flat)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return add_to_accessories(flat, material, bone, False)


PACK_Y = -0.238
backpack = add_rounded_box(
    "Backpack",
    (0, PACK_Y, 0.66),
    (0.32, 0.14, 0.28),
    MAT_ORANGE,
    "Spine",
    0.03,
    3,
)
# Mold the contact half onto the back of the suit.
for vertex in backpack.data.vertices:
    if vertex.co.y <= PACK_Y:
        continue
    hit, _normal, _index, _distance = body_bvh.ray_cast(
        Vector((vertex.co.x, -0.6, vertex.co.z)),
        Vector((0.0, 1.0, 0.0)),
        0.8,
    )
    if hit is not None:
        vertex.co.y = hit.y - 0.008
backpack.data.update()

lid = add_rounded_box(
    "BackpackLid",
    (0, PACK_Y - 0.01, 0.80),
    (0.30, 0.125, 0.045),
    MAT_SUIT,
    "Spine",
    0.018,
    2,
)
for vertex in lid.data.vertices:
    if vertex.co.y <= PACK_Y - 0.01:
        continue
    hit, _normal, _index, _distance = body_bvh.ray_cast(
        Vector((vertex.co.x, -0.6, vertex.co.z)),
        Vector((0.0, 1.0, 0.0)),
        0.8,
    )
    if hit is not None:
        vertex.co.y = hit.y - 0.008
lid.data.update()

add_torus(
    "BackpackLoop",
    (0, -0.30, 0.855),
    0.042,
    0.009,
    MAT_SUIT,
    "Spine",
    rotation=(math.pi / 2, 0, 0),
    scale=(1.0, 1.0, 0.8),
)

strap_objects = []
for side, suffix in ((-1, "L"), (1, "R")):
    # The band starts at the suit's back just above the pack, crosses the
    # shoulder close to the neck (away from the moving shoulder pads) and
    # runs down the chest, always on the surface.
    # Full harness loop like a real backpack: out of the pack's top, over
    # the shoulder (just inside the shoulder pad), down the chest and back
    # under the armpit to the pack's lower side.
    targets = [
        (side * 0.10, -0.20, 0.805),
        (side * 0.105, -0.10, 0.875),
        (side * 0.11, 0.02, 0.885),
        (side * 0.13, 0.13, 0.82),
        (side * 0.14, 0.16, 0.70),
        (side * 0.165, 0.10, 0.645),
        (side * 0.185, -0.02, 0.622),
        (side * 0.16, -0.14, 0.60),
        (side * 0.115, -0.21, 0.585),
    ]
    path = project_path(targets, 7)
    strap_objects.append(
        add_surface_band(
            f"Strap.{suffix}",
            path,
            0.011,
            0.004,
            MAT_VIOLET,
            "Spine",
        )
    )

    # Adjuster buckle on the chest run, where a real pack lets you tighten.
    buckle_index = len(path) // 2
    buckle_point, buckle_normal = path[buckle_index]
    add_rounded_box(
        f"StrapBuckle.{suffix}",
        tuple(buckle_point + buckle_normal * 0.005),
        (0.030, 0.013, 0.020),
        MAT_BOOT,
        "Spine",
        0.004,
        1,
    )

    add_rounded_box(
        f"StrapAnchor.{suffix}",
        (side * 0.10, -0.205, 0.805),
        (0.045, 0.036, 0.028),
        MAT_VIOLET,
        "Spine",
        0.007,
        1,
    )

# Report how the harness sits: negative distances mean the band sank into the
# suit, large gaps mean it floats. Both should stay near the 9 mm margin.
strap_inside = 0
largest_gap = 0.0
for strap in strap_objects:
    for vertex in strap.data.vertices:
        nearest, normal, _index, _distance = body_bvh.find_nearest(vertex.co)
        if nearest is None:
            continue
        offset = vertex.co - nearest
        signed = offset.dot(Vector(normal).normalized())
        if signed < -0.002:
            strap_inside += 1
        largest_gap = max(largest_gap, offset.length)
print(
    "STRAP_FIT",
    json.dumps(
        {
            "inside_vertices": strap_inside,
            "largest_gap_mm": round(largest_gap * 1000, 1),
        }
    ),
)

add_rounded_box(
    "ChestPanel",
    (0, 0.185, 0.72),
    (0.14, 0.03, 0.10),
    MAT_VIOLET,
    "Spine",
    0.012,
    2,
)
add_sphere(
    "ChestLight",
    (0, 0.203, 0.735),
    0.018,
    (1.0, 0.45, 1.0),
    MAT_LIGHT,
    "Spine",
    10,
    8,
)
# Small paper patch with an orange seal on the chest panel.
add_rounded_box(
    "ChestPatch",
    (0, 0.202, 0.695),
    (0.09, 0.008, 0.055),
    MAT_PAPER,
    "Spine",
    0.004,
    1,
)
add_rounded_box(
    "ChestPatchSeal",
    (0, 0.207, 0.695),
    (0.018, 0.006, 0.018),
    MAT_ORANGE,
    "Spine",
    0.003,
    1,
)
# Waist seam: sampled around the waist and projected onto the suit, so the
# belt hugs the body instead of floating around it.
waist_samples = []
for step in range(48):
    angle = 2.0 * math.pi * step / 48
    direction = Vector((math.cos(angle), math.sin(angle), 0.0))
    hit, normal, _index, _distance = body_bvh.ray_cast(
        Vector((0, 0, 0.505)) + direction * 0.5, -direction, 0.5
    )
    if hit is not None:
        waist_samples.append((hit, Vector(normal).normalized()))
add_surface_band(
    "WaistSeam",
    waist_samples,
    0.011,
    0.007,
    MAT_VIOLET,
    "Hips",
    closed=True,
)

add_rounded_box(
    "Envelope",
    (0, -0.328, 0.68),
    (0.20, 0.012, 0.145),
    MAT_PAPER,
    "Spine",
    0.008,
    1,
)
# Triangular flap pointing down (a V), so the back reads as a sealed
# envelope instead of an upside-down letter.
flap_vertices = [
    (-0.095, -0.3345, 0.748),
    (0.095, -0.3345, 0.748),
    (0.0, -0.3345, 0.658),
    (-0.095, -0.3405, 0.748),
    (0.095, -0.3405, 0.748),
    (0.0, -0.3405, 0.658),
]
flap_faces = [
    (0, 2, 1),
    (3, 4, 5),
    (0, 1, 4, 3),
    (1, 2, 5, 4),
    (2, 0, 3, 5),
]
flap_mesh = bpy.data.meshes.new("EnvelopeFlap")
flap_mesh.from_pydata(flap_vertices, [], flap_faces)
flap_mesh.validate()
flap_mesh.update()
flap = bpy.data.objects.new("EnvelopeFlap", flap_mesh)
scene.collection.objects.link(flap)
flap_bm = bmesh.new()
flap_bm.from_mesh(flap_mesh)
bmesh.ops.recalc_face_normals(flap_bm, faces=list(flap_bm.faces))
flap_bm.to_mesh(flap_mesh)
flap_bm.free()
flap_mesh.update()
add_to_accessories(flap, MAT_ORANGE, "Spine", False)
add_sphere(
    "EnvelopeSeal",
    (0, -0.3425, 0.664),
    0.017,
    (1.0, 0.5, 1.0),
    MAT_ORANGE,
    "Spine",
    12,
    8,
)

# Small marker for future letter-delivery animations.
anchor = bpy.data.objects.new("LetterAnchor", None)
scene.collection.objects.link(anchor)
anchor.empty_display_type = "PLAIN_AXES"
anchor.empty_display_size = 0.04
anchor.location = (0, -0.25, 0.90)


# --------------------------------------------------------------------------- #
# Armature
# --------------------------------------------------------------------------- #

bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
armature = bpy.context.object
armature.name = "CosmicCarrierRig"
armature.data.name = "CosmicCarrierRig"
for bone in list(armature.data.edit_bones):
    armature.data.edit_bones.remove(bone)


def add_bone(name, head, tail, parent=None, connected=False, roll_hint=(0, 1, 0)):
    bone = armature.data.edit_bones.new(name)
    bone.head = Vector(head)
    bone.tail = Vector(tail)
    if parent:
        bone.parent = armature.data.edit_bones[parent]
        bone.use_connect = connected
    bone.align_roll(Vector(roll_hint))
    return bone


add_bone("Root", (0, 0, 0), (0, 0, 0.15), roll_hint=(0, -1, 0))
add_bone("Hips", (0, 0, 0.44), (0, 0, 0.56), "Root", False, (0, -1, 0))
add_bone("Spine", (0, 0, 0.56), (0, 0, 0.86), "Hips", True, (0, -1, 0))
add_bone("Head", (0, 0, 0.86), (0, 0, 1.15), "Spine", True, (0, -1, 0))

for side, suffix in ((-1, "L"), (1, "R")):
    add_bone(
        f"UpperArm.{suffix}",
        (side * 0.215, 0, 0.78),
        (side * 0.27, 0, 0.64),
        "Spine",
        False,
        (0, 1, 0),
    )
    add_bone(
        f"Forearm.{suffix}",
        (side * 0.27, 0, 0.64),
        (side * 0.31, 0, 0.50),
        f"UpperArm.{suffix}",
        True,
        (0, 1, 0),
    )
    add_bone(
        f"Hand.{suffix}",
        (side * 0.31, 0, 0.50),
        (side * 0.32, 0, 0.41),
        f"Forearm.{suffix}",
        True,
        (0, 1, 0),
    )
    add_bone(
        f"UpperLeg.{suffix}",
        (side * 0.11, 0, 0.45),
        (side * 0.11, 0, 0.31),
        "Hips",
        False,
        (0, 1, 0),
    )
    add_bone(
        f"LowerLeg.{suffix}",
        (side * 0.11, 0, 0.31),
        (side * 0.11, 0, 0.17),
        f"UpperLeg.{suffix}",
        True,
        (0, 1, 0),
    )
    add_bone(
        f"Foot.{suffix}",
        (side * 0.11, 0, 0.17),
        (side * 0.11, 0.12, 0.06),
        f"LowerLeg.{suffix}",
        True,
        (0, 0, 1),
    )

bpy.ops.object.mode_set(mode="OBJECT")

# Join all rigid gear into one accessory mesh; the body stays a separate
# auto-weighted continuous mesh.
bpy.ops.object.select_all(action="DESELECT")
for obj in accessories:
    obj.select_set(True)
bpy.context.view_layer.objects.active = accessories[0]
bpy.ops.object.join()
gear = bpy.context.object
gear.name = "SuitAccessories"
bpy.context.scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

gear.parent = armature
gear_modifier = gear.modifiers.new("Armature", "ARMATURE")
gear_modifier.object = armature

# Automatic weights only for the soft body suit. Helmet, backpack, mittens and
# boots are rigid accessory groups, which suits the toy-like style.
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.vertex_group_limit_total(limit=4)


def _smoothstep(edge0, edge1, value):
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


# Keep Blender's heat weights, but diffuse them across neighbouring
# vertices. A previous hand-zoned assignment created a hard seam at the
# hip/leg boundary: two adjacent vertices followed completely different
# bones and a short edge stretched by ~8x in Walk/Run. Neighbour smoothing
# removes that seam while preserving the automatic anatomical assignment.
mesh = body.data
groups_by_name = {group.name: group for group in body.vertex_groups}
vertex_weights = []
for vertex in mesh.vertices:
    weights = {}
    for group_name, group in groups_by_name.items():
        try:
            weight = group.weight(vertex.index)
        except RuntimeError:
            continue
        if weight > 0.0001:
            weights[group_name] = weight
    total = sum(weights.values())
    if total > 0.0:
        weights = {name: value / total for name, value in weights.items()}
    vertex_weights.append(weights)

neighbours = [[] for _ in mesh.vertices]
for edge in mesh.edges:
    start, end = edge.vertices
    neighbours[start].append(end)
    neighbours[end].append(start)

for _iteration in range(3):
    smoothed_weights = []
    for index, weights in enumerate(vertex_weights):
        neighbour_indices = neighbours[index]
        if not neighbour_indices:
            smoothed_weights.append(weights)
            continue
        names = set(weights)
        for neighbour_index in neighbour_indices:
            names.update(vertex_weights[neighbour_index])
        blended = {}
        for name in names:
            own = weights.get(name, 0.0)
            neighbour_average = sum(
                vertex_weights[neighbour_index].get(name, 0.0)
                for neighbour_index in neighbour_indices
            ) / len(neighbour_indices)
            value = own * 0.70 + neighbour_average * 0.30
            if value > 0.0001:
                blended[name] = value
        total = sum(blended.values()) or 1.0
        smoothed_weights.append(
            {name: value / total for name, value in blended.items()}
        )
    vertex_weights = smoothed_weights

# Adaptive smoothing: only vertices whose weights differ sharply from a
# neighbour are diffused further. This removes local seams without
# washing out the automatic anatomical assignment everywhere else.
for _iteration in range(10):
    changed = False
    next_weights = []
    for index, weights in enumerate(vertex_weights):
        neighbour_indices = neighbours[index]
        if not neighbour_indices:
            next_weights.append(weights)
            continue
        names = set(weights)
        for neighbour_index in neighbour_indices:
            names.update(vertex_weights[neighbour_index])
        max_difference = 0.0
        neighbour_average = {}
        for name in names:
            average = sum(
                vertex_weights[neighbour_index].get(name, 0.0)
                for neighbour_index in neighbour_indices
            ) / len(neighbour_indices)
            neighbour_average[name] = average
            for neighbour_index in neighbour_indices:
                max_difference = max(
                    max_difference,
                    abs(weights.get(name, 0.0) - vertex_weights[neighbour_index].get(name, 0.0)),
                )
        if max_difference <= 0.22:
            next_weights.append(weights)
            continue
        changed = True
        blend = min(0.55, 0.20 + max_difference * 0.35)
        blended = {}
        for name in names:
            value = weights.get(name, 0.0) * (1.0 - blend) + neighbour_average[name] * blend
            if value > 0.0001:
                blended[name] = value
        total = sum(blended.values()) or 1.0
        next_weights.append({name: value / total for name, value in blended.items()})
    vertex_weights = next_weights
    if not changed:
        break

# The narrow web between the fused thighs sits on the midline. Automatic
# weights split it between the left and right leg bones, so the two sides
# of a short edge move in opposite directions in Walk/Run and stretch.
# Pin that midline band to Hips, tapering widely into each thigh.
for vertex, weights in zip(mesh.vertices, vertex_weights):
    x, _y, z = vertex.co
    crotch_factor = (
        (1.0 - _smoothstep(0.01, 0.07, abs(x)))
        * _smoothstep(0.28, 0.40, z)
        * (1.0 - _smoothstep(0.40, 0.52, z))
    )
    if crotch_factor > 0.0:
        weights["Hips"] = (
            weights.get("Hips", 0.0) * (1.0 - crotch_factor) + crotch_factor
        )
        total = sum(weights.values()) or 1.0
        vertex_weights[vertex.index] = {
            name: value / total for name, value in weights.items()
        }

# Automatic weights leak UpperLeg influence into the side of the lower
# torso (around z 0.50-0.56). Those vertices then stay with a static leg
# while the torso rotates in Interact, stretching the side of the suit.
# Above the hip line, blend smoothly back toward Spine/Hips.
for vertex, weights in zip(mesh.vertices, vertex_weights):
    _x, _y, z = vertex.co
    torso_factor = (
        _smoothstep(0.47, 0.56, z)
        * (1.0 - _smoothstep(0.05, 0.11, -_y))
        * 0.90
    )
    if torso_factor > 0.0:
        desired = {"Spine": 0.80, "Hips": 0.20}
        for name in set(weights) | set(desired):
            weights[name] = (
                weights.get(name, 0.0) * (1.0 - torso_factor)
                + desired.get(name, 0.0) * torso_factor
            )
        total = sum(weights.values()) or 1.0
        vertex_weights[vertex.index] = {
            name: value / total for name, value in weights.items()
        }

# Back-of-torso cleanup at hip height and above: automatic weights leak
# UpperLeg/UpperArm influence onto the back (y negative, z 0.56+). Those
# vertices stay with a static bone while the torso and arm move in
# Interact. The back thigh itself (z below 0.52) is untouched so
# Walk/Run keep following the leg there.
for vertex, weights in zip(mesh.vertices, vertex_weights):
    _x, y, z = vertex.co
    back_factor = (
        _smoothstep(0.56, 0.62, z)
        * (1.0 - _smoothstep(-0.05, -0.02, y))
        * 0.90
    )
    if back_factor > 0.0:
        desired = {"Spine": 0.80, "Hips": 0.20}
        for name in set(weights) | set(desired):
            weights[name] = (
                weights.get(name, 0.0) * (1.0 - back_factor)
                + desired.get(name, 0.0) * back_factor
            )
        total = sum(weights.values()) or 1.0
        vertex_weights[vertex.index] = {
            name: value / total for name, value in weights.items()
        }

for group in groups_by_name.values():
    group.remove([vertex.index for vertex in mesh.vertices])
for vertex, weights in zip(mesh.vertices, vertex_weights):
    for bone_name, weight in weights.items():
        group = groups_by_name.get(bone_name)
        if group is not None:
            group.add([vertex.index], weight, "REPLACE")
mesh.update()

anchor.parent = armature
anchor.parent_type = "OBJECT"


# --------------------------------------------------------------------------- #
# Actions
# --------------------------------------------------------------------------- #

bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.mode_set(mode="POSE")
armature.animation_data_create()


def reset_pose():
    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0, 0, 0)
        pose_bone.location = (0, 0, 0)
        pose_bone.scale = (1, 1, 1)


def new_action(name, start, end):
    reset_pose()
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    action.use_frame_range = True
    action.frame_start = start
    action.frame_end = end
    armature.animation_data.action = action
    return action


def key(bone_name, frame, x=0.0, y=0.0, z=0.0):
    pose_bone = armature.pose.bones[bone_name]
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = (x, y, z)
    pose_bone.keyframe_insert("rotation_euler", frame=frame, group=bone_name)


def key_location(bone_name, frame, x=0.0, y=0.0, z=0.0):
    pose_bone = armature.pose.bones[bone_name]
    pose_bone.location = (x, y, z)
    pose_bone.keyframe_insert("location", frame=frame, group=bone_name)


# IDLE 1-73 (self-contained) ------------------------------------------------ #
# Every bone the Walk or Run animate is keyed here too (legs, feet, hips,
# root), so switching from walking to standing always resets the legs to a
# relaxed stance instead of leaving them in the last stride. The breathing,
# weight shift and arm sway are deliberately gentle.
idle = new_action("Idle", 1, 73)
key("Root", 1, 0.0, 0.0, 0.0)
key("Root", 73, 0.0, 0.0, 0.0)
key_location("Root", 1, 0.0, 0.0, 0.0)
key_location("Root", 73, 0.0, 0.0, 0.0)
key("Hips", 1, 0.0, 0.0, 0.0)
key("Hips", 25, 0.0, 0.012, 0.008)
key("Hips", 49, 0.0, -0.010, -0.006)
key("Hips", 73, 0.0, 0.0, 0.0)
key("Spine", 1, 0.0)
key("Spine", 36, -0.025)
key("Spine", 73, 0.0)
key("Head", 1, 0.0, 0.0)
key("Head", 24, 0.025, -0.07)
key("Head", 52, -0.015, 0.055)
key("Head", 73, 0.0, 0.0)
for side, suffix in ((-1, "L"), (1, "R")):
    key(f"UpperArm.{suffix}", 1, 0.0)
    key(f"UpperArm.{suffix}", 36, 0.03 if side < 0 else -0.03)
    key(f"UpperArm.{suffix}", 73, 0.0)
    key(f"Forearm.{suffix}", 1, 0.12)
    key(f"Forearm.{suffix}", 36, 0.17 if side < 0 else 0.08)
    key(f"Forearm.{suffix}", 73, 0.12)
    # Relaxed legs: a tiny bend so the stance does not look stiff, planted
    # feet and no stride.
    key(f"UpperLeg.{suffix}", 1, 0.0)
    key(f"UpperLeg.{suffix}", 36, 0.012)
    key(f"UpperLeg.{suffix}", 73, 0.0)
    key(f"LowerLeg.{suffix}", 1, 0.0)
    key(f"LowerLeg.{suffix}", 36, -0.014)
    key(f"LowerLeg.{suffix}", 73, 0.0)
    key(f"Foot.{suffix}", 1, 0.0)
    key(f"Foot.{suffix}", 73, 0.0)

# WALK 1-33 (cozy, grounded) ----------------------------------------------- #
# Rebuilt from scratch. Five key poses per cycle (contact, pass, contact,
# pass, loop). The Root bone is lifted automatically at each key so the
# lowest boot vertex rests 4 mm above the floor: the classic bob comes from
# the legs spreading, not from a guessed offset, so the feet never float or
# sink at the key poses.


def lowest_suit_point():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lowest = 1e9
    for obj in (body, gear):
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        matrix = evaluated.matrix_world
        for vertex in mesh.vertices:
            z = (matrix @ vertex.co).z
            if z < lowest:
                lowest = z
        evaluated.to_mesh_clear()
    return lowest


walk = new_action("Walk", 1, 33)
WALK_FRAMES = (1, 9, 17, 25, 33)
# thighL, kneeL, footL, thighR, kneeR, footR, armL, armR,
# hipsTilt, hipsTwist, spineTwist, headTwist, waddle
WALK_POSES = [
    (0.28, 0.00, 0.18, -0.28, -0.12, -0.18, -0.22, 0.22, 0.02, 0.05, -0.04, 0.02, 0.00),
    (-0.06, -0.04, -0.05, 0.06, -0.48, 0.10, 0.00, 0.00, -0.01, 0.00, 0.00, 0.00, -0.022),
    (-0.28, -0.12, -0.18, 0.28, 0.00, 0.18, 0.22, -0.22, -0.02, -0.05, 0.04, -0.02, 0.00),
    (0.06, -0.48, 0.10, -0.06, -0.04, -0.05, 0.00, 0.00, 0.01, 0.00, 0.00, 0.00, 0.022),
    (0.28, 0.00, 0.18, -0.28, -0.12, -0.18, -0.22, 0.22, 0.02, 0.05, -0.04, 0.02, 0.00),
]
for frame, pose in zip(WALK_FRAMES, WALK_POSES):
    (
        thigh_l, knee_l, foot_l,
        thigh_r, knee_r, foot_r,
        arm_l, arm_r,
        hips_tilt, hips_twist, spine_twist, head_twist, waddle,
    ) = pose
    key("UpperLeg.L", frame, thigh_l)
    key("LowerLeg.L", frame, knee_l)
    key("Foot.L", frame, foot_l)
    key("UpperLeg.R", frame, thigh_r)
    key("LowerLeg.R", frame, knee_r)
    key("Foot.R", frame, foot_r)
    key("UpperArm.L", frame, arm_l)
    key("UpperArm.R", frame, arm_r)
    key("Forearm.L", frame, 0.18)
    key("Forearm.R", frame, 0.18)
    key("Hips", frame, 0.0, hips_tilt, hips_twist)
    key("Spine", frame, -0.02, 0.0, spine_twist)
    key("Head", frame, 0.0, 0.0, head_twist)
    # Gentle waddle over the supporting leg: a small whole-body roll.
    key("Root", frame, 0.0, waddle, 0.0)
    key_location("Root", frame, 0.0, 0.0, 0.0)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    lift = 0.004 - lowest_suit_point()
    key_location("Root", frame, 0.0, lift, 0.0)

# Ground check across the whole cycle: report how far the boots move away
# from the floor between keys (linear interpolation can dip slightly).
ground_min = 1e9
ground_max = -1e9
armature.animation_data.action = walk
for frame in range(1, 34):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    lowest = lowest_suit_point()
    ground_min = min(ground_min, lowest)
    ground_max = max(ground_max, lowest)
print(
    "WALK_GROUND",
    json.dumps(
        {
            "lowest_mm": round(ground_min * 1000, 2),
            "highest_lowest_mm": round(ground_max * 1000, 2),
        }
    ),
)

# RUN 1-21 ------------------------------------------------------------------ #
run = new_action("Run", 1, 21)
run_frames = (1, 6, 11, 16, 21)
run_left_leg = (0.40, 0.0, -0.40, 0.0, 0.40)
run_right_leg = (-0.40, 0.0, 0.40, 0.0, -0.40)
run_left_knee = (0.0, -0.36, 0.0, -0.42, 0.0)
run_right_knee = (0.0, -0.42, 0.0, -0.36, 0.0)
run_left_arm = (-0.46, 0.0, 0.46, 0.0, -0.46)
run_right_arm = (0.46, 0.0, -0.46, 0.0, 0.46)
for index, frame in enumerate(run_frames):
    key("UpperLeg.L", frame, run_left_leg[index])
    key("UpperLeg.R", frame, run_right_leg[index])
    key("LowerLeg.L", frame, run_left_knee[index])
    key("LowerLeg.R", frame, run_right_knee[index])
    key("Foot.L", frame, 0.2 if index in (0, 4) else -0.1)
    key("Foot.R", frame, -0.1 if index in (0, 4) else 0.2)
    key("UpperArm.L", frame, run_left_arm[index])
    key("UpperArm.R", frame, run_right_arm[index])
    key("Forearm.L", frame, 0.35)
    key("Forearm.R", frame, 0.35)
    key("Spine", frame, -0.12)
    key("Hips", frame, 0.0, -0.08 if index in (0, 4) else 0.0)
    key("Head", frame, 0.05)
    # Root stays neutral here (no inherited walk waddle) and is lifted so the
    # supporting boot touches the floor.
    key("Root", frame, 0.0, 0.0, 0.0)
    key_location("Root", frame, 0.0, 0.0, 0.0)
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    lift = 0.004 - lowest_suit_point()
    key_location("Root", frame, 0.0, lift, 0.0)

armature.animation_data.action = idle
scene.frame_set(1)
reset_pose()
bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode="OBJECT")


# --------------------------------------------------------------------------- #
# Deformation validation
# --------------------------------------------------------------------------- #

def validate_deformation():
    """Report edge-length change of the fused suit in the key poses.

    Rigid accessories (helmet, backpack, mittens, boots, letters) cannot
    stretch because each vertex belongs to a single bone. The fused suit
    can, so we measure it directly: for every edge we compare its length in
    the evaluated (posed) mesh against its rest length. A value near 1.0
    means the surface only rotated; large deviations mean visible
    stretching, which the hand-cleaned weights above are meant to prevent.
    """
    rest_positions = [tuple(vertex.co) for vertex in body.data.vertices]
    rest_edges = []
    for edge in body.data.edges:
        start, end = edge.vertices
        length = (
            Vector(rest_positions[end]) - Vector(rest_positions[start])
        ).length
        if length > 1e-6:
            rest_edges.append((start, end, length))

    samples = {}
    for action_name in ("Idle", "Walk", "Run"):
        action = bpy.data.actions[action_name]
        first, last = action.frame_range
        samples[action_name] = sorted(
            {int(round(first + (last - first) * step / 7)) for step in range(8)}
        )
    def vertex_weights(index):
        weights = {}
        for group in body.vertex_groups:
            try:
                weight = group.weight(index)
            except RuntimeError:
                continue
            if weight > 0.001:
                weights[group.name] = round(weight, 3)
        return weights

    report = {}
    worst_ratio = 1.0
    worst_edges = []
    action_worst = {}
    for action_name, frames in samples.items():
        armature.animation_data.action = bpy.data.actions[action_name]
        action_min = float("inf")
        action_max = 0.0
        for frame in frames:
            # Each clip only keys some bones. Reset first so unkeyed bones
            # do not inherit the previous clip's pose during validation.
            reset_pose()
            scene.frame_set(frame)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            evaluated_body = body.evaluated_get(depsgraph)
            evaluated_mesh = evaluated_body.to_mesh()
            positions = [tuple(vertex.co) for vertex in evaluated_mesh.vertices]
            for start, end, rest_length in rest_edges:
                length = (
                    Vector(positions[end]) - Vector(positions[start])
                ).length
                ratio = length / rest_length
                action_min = min(action_min, ratio)
                action_max = max(action_max, ratio)
                if ratio > action_worst.get(action_name, {}).get("ratio", 0.0):
                    action_worst[action_name] = {
                        "frame": frame,
                        "ratio": round(ratio, 4),
                        "start": start,
                        "end": end,
                        "rest_start": tuple(round(v, 4) for v in rest_positions[start]),
                        "rest_end": tuple(round(v, 4) for v in rest_positions[end]),
                        "posed_start": tuple(round(v, 4) for v in positions[start]),
                        "posed_end": tuple(round(v, 4) for v in positions[end]),
                        "start_weights": vertex_weights(start),
                        "end_weights": vertex_weights(end),
                    }
                if ratio > 1.45:
                    worst_edges.append(
                        {
                            "action": action_name,
                            "frame": frame,
                            "ratio": round(ratio, 4),
                            "start": start,
                            "end": end,
                            "rest_start": tuple(round(v, 4) for v in rest_positions[start]),
                            "rest_end": tuple(round(v, 4) for v in rest_positions[end]),
                            "posed_start": tuple(round(v, 4) for v in positions[start]),
                            "posed_end": tuple(round(v, 4) for v in positions[end]),
                            "start_weights": vertex_weights(start),
                            "end_weights": vertex_weights(end),
                        }
                    )
            evaluated_body.to_mesh_clear()
        report[action_name] = {
            "min_edge_ratio": round(action_min, 4),
            "max_edge_ratio": round(action_max, 4),
        }
        worst_ratio = max(worst_ratio, action_max)

    print("DEFORMATION_METRICS", json.dumps(report, indent=2))
    print("ACTION_WORST_EDGES", json.dumps(action_worst, indent=2))
    if worst_edges:
        worst_edges.sort(key=lambda item: item["ratio"], reverse=True)
        print("WORST_EDGES", json.dumps(worst_edges[:60], indent=2))
    if worst_ratio > 1.45:
        raise RuntimeError(
            f"Suit edge stretch {worst_ratio:.3f} exceeds the 1.45 budget; "
            "inspect the shoulder/neck/hip weights before exporting."
        )
    armature.animation_data.action = idle
    scene.frame_set(1)


validate_deformation()
bpy.context.view_layer.update()

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

# --------------------------------------------------------------------------- #
# Export the game GLB
# --------------------------------------------------------------------------- #

bpy.ops.object.select_all(action="DESELECT")
armature.select_set(True)
body.select_set(True)
gear.select_set(True)
anchor.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_anim_single_armature=True,
    export_texcoords=False,
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)


# --------------------------------------------------------------------------- #
# Neutral validation renders: front, profile, back, 3/4
# --------------------------------------------------------------------------- #

view_world = bpy.data.worlds.new("ValidationWorld")
view_world.use_nodes = True
background = view_world.node_tree.nodes.get("Background")
background.inputs["Color"].default_value = (0.16, 0.16, 0.17, 1.0)
background.inputs["Strength"].default_value = 0.7
scene.world = view_world

bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = "ValidationFloor"
floor.data.materials.append(make_material("CC_ValidationFloor", "#8A8A8C", 0.85))

# Neutral studio lights.
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
    direction = Vector((0, 0, 0.7)) - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

camera_data = bpy.data.cameras.new("ValidationCamera")
camera = bpy.data.objects.new("ValidationCamera", camera_data)
scene.collection.objects.link(camera)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 1.65
scene.camera = camera

scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 32
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False

views = {
    "front": ((0, 4.0, 0.7), (0, 0, 0.7)),
    "profile": ((-4.0, 0, 0.7), (0, 0, 0.7)),
    "back": ((0, -4.0, 0.7), (0, 0, 0.7)),
    "three_quarter": ((3.0, 3.0, 2.0), (0, 0, 0.7)),
}
for name, (location, target) in views.items():
    camera.location = location
    direction = Vector(target) - Vector(location)
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(VIEW_DIR, f"{name}.png")
    bpy.ops.render.render(write_still=True)

# Animation pose validation: walk and run from the 3/4 camera.
armature.animation_data.action = bpy.data.actions["Walk"]
scene.frame_set(9)
camera.location = views["three_quarter"][0]
direction = Vector(views["three_quarter"][1]) - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = os.path.join(VIEW_DIR, "walk_pose.png")
bpy.ops.render.render(write_still=True)

armature.animation_data.action = bpy.data.actions["Run"]
scene.frame_set(6)
scene.render.filepath = os.path.join(VIEW_DIR, "run_pose.png")
bpy.ops.render.render(write_still=True)

# Contact sheet for quick visual review.
try:
    from PIL import Image, ImageDraw

    labels = {
        "front": "FRONT",
        "profile": "PROFILE",
        "back": "BACK",
        "three_quarter": "3/4",
    }
    images = []
    for key in ("front", "profile", "back", "three_quarter"):
        image = Image.open(os.path.join(VIEW_DIR, f"{key}.png")).convert("RGB")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, 150, 30), fill=(20, 20, 24))
        draw.text((10, 8), labels[key], fill=(245, 240, 235))
        images.append(image)
    sheet = Image.new("RGB", (1280, 1280), (20, 20, 24))
    for index, image in enumerate(images):
        sheet.paste(image, ((index % 2) * 640, (index // 2) * 640))
    sheet.save(os.path.join(VIEW_DIR, "contact_sheet.png"))
except Exception as error:
    print("Contact sheet generation skipped:", error)

mesh_triangles = 0
for obj in (body, gear):
    obj.data.calc_loop_triangles()
    mesh_triangles += len(obj.data.loop_triangles)
glb_size = os.path.getsize(GLB_PATH)
print(
    json.dumps(
        {
            "blend": BLEND_PATH,
            "glb": GLB_PATH,
            "glb_bytes": glb_size,
            "triangles": mesh_triangles,
            "actions": [action.name for action in bpy.data.actions],
            "views": VIEW_DIR,
        },
        indent=2,
    )
)
