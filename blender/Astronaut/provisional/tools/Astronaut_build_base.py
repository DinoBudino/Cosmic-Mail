"""Cosmic Mail - Astronauta Mensajero production character build.

Builds the playable astronaut, rig, gameplay clips, master .blend and GLB.

Usage:
    blender --background --python blender/Astronaut/provisional/tools/Astronaut_build_base.py

Outputs:
    blender/Astronaut/provisional/Astronaut_RetroSpacePost_provisional_v1_rebuilt.blend
    blender/Astronaut/provisional/Astronaut_RetroSpacePost_provisional_v1_rebuilt.glb
    /tmp/astronaut_provisional_views/*.png

Design authority: Cosmic Mail "Astronauta Mensajero" reference sheet.
Style authority: approved PIP Retro Space Post asset (cream shell, gold rim,
coral stripes, lavender comms, burgundy scarf, dark glossy visor).

The master character faces Blender -Y. glTF +Y-up export therefore faces
+Z in three.js; the game wrapper applies a documented 180 degree Y rotation.
"""

import json
import math
import os
import struct
import tempfile
from math import radians, sin, cos, pi

import bmesh
import bpy
from mathutils import Euler, Matrix, Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))
BLEND_PATH = os.path.join(ROOT, "blender", "Astronaut", "provisional", "Astronaut_RetroSpacePost_provisional_v1_rebuilt.blend")
GLB_PATH = os.path.join(ROOT, "blender", "Astronaut", "provisional", "Astronaut_RetroSpacePost_provisional_v1_rebuilt.glb")
VIEW_DIR = os.path.join(tempfile.gettempdir(), "astronaut_provisional_views")
os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
os.makedirs(VIEW_DIR, exist_ok=True)

# --------------------------------------------------------------------------- #
# Fresh, dedicated build scene
# --------------------------------------------------------------------------- #

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
scene.render.fps_base = 1.0
scene.frame_start = 1
scene.frame_end = 61
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.render.engine = "BLENDER_EEVEE"

# --------------------------------------------------------------------------- #
# Collections
# --------------------------------------------------------------------------- #

def new_collection(name, parent=None):
    coll = bpy.data.collections.new(name)
    if parent is None:
        scene.collection.children.link(coll)
    else:
        parent.children.link(coll)
    return coll


CM_ROOT = new_collection("CM_ASTRONAUT")
CM_GEO = new_collection("CM_ASTRONAUT_GEO", CM_ROOT)
CM_RIG = new_collection("CM_ASTRONAUT_RIG", CM_ROOT)
CM_ACC = new_collection("CM_ASTRONAUT_ACCESSORIES", CM_ROOT)
CM_HELP = new_collection("CM_ASTRONAUT_HELPERS", CM_ROOT)
CM_PREVIEW = new_collection("CM_ASTRONAUT_PREVIEW", CM_ROOT)


def link_only(obj, coll):
    for existing in list(obj.users_collection):
        if existing != coll:
            existing.objects.unlink(obj)
    if obj.name not in coll.objects:
        coll.objects.link(obj)


# --------------------------------------------------------------------------- #
# Palette / materials (glTF-compatible Principled BSDF only)
# --------------------------------------------------------------------------- #

def srgb_to_linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    linear = [
        v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        for v in values
    ]
    return (linear[0], linear[1], linear[2], 1.0)


def make_material(name, color, roughness, metallic=0.0, emission=None,
                  emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = srgb_to_linear(color)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = 1.0
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.0
    if emission:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emission)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.use_backface_culling = False
    return mat


MAT_CREAM = make_material("AST_Cream_Suit", "#F7E5D1", 0.70, 0.0)
MAT_SHELL = make_material("AST_Cream_Helmet", "#F7E5D1", 0.32, 0.04)
MAT_CORAL = make_material("AST_Coral_Trim", "#FFAA53", 0.40, 0.06)
MAT_GOLD = make_material("AST_Gold_Soft", "#DBB25E", 0.28, 0.78)
MAT_GOLD_DARK = make_material("AST_Gold_Hardware", "#B88A3E", 0.34, 0.72)
MAT_LAVENDER = make_material("AST_Lavender_Gloves", "#B59CE3", 0.55, 0.03)
MAT_LAVENDER_DARK = make_material("AST_Lavender_Deep", "#8E75C0", 0.58, 0.03)
MAT_BURGUNDY = make_material("AST_Burgundy_Scarf", "#7A1E3C", 0.78, 0.0)
MAT_DARK = make_material("AST_Dark_Gray", "#33323A", 0.52, 0.30)
MAT_VISOR = make_material("AST_Visor_Black", "#09090D", 0.13, 0.06)
MAT_PAPER = make_material("AST_Envelope_Cream", "#FFF6E8", 0.52, 0.0)
MAT_STRAP = make_material("AST_Harness_Leather", "#6B3F2A", 0.72, 0.0)
MAT_SOLE = make_material("AST_Boot_Sole", "#E98B45", 0.68, 0.0)
MAT_LIGHT = make_material("AST_Antenna_Glow", "#FFB45E", 0.35, 0.0,
                          emission="#FF8A2A", emission_strength=5.0)
MATS = [MAT_CREAM, MAT_SHELL, MAT_CORAL, MAT_GOLD, MAT_GOLD_DARK,
        MAT_LAVENDER, MAT_LAVENDER_DARK, MAT_BURGUNDY, MAT_DARK, MAT_VISOR,
        MAT_PAPER, MAT_STRAP, MAT_SOLE, MAT_LIGHT]

# --------------------------------------------------------------------------- #
# Geometry helpers
# --------------------------------------------------------------------------- #

GROUPS = {}


def apply_all(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.select_set(False)


def smooth_mark(obj, angle=38.0):
    me = obj.data
    for poly in me.polygons:
        poly.use_smooth = True
    bm = bmesh.new()
    bm.from_mesh(me)
    for edge in bm.edges:
        if len(edge.link_faces) == 2:
            if edge.calc_face_angle(0.0) > radians(angle):
                edge.smooth = False
    bm.to_mesh(me)
    bm.free()
    me.update()


def assign_bone(obj, bone):
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")


def add_to_group(obj, material, bone, group, smooth=True, angle=38.0, flat=False):
    obj.data.materials.append(material)
    if flat:
        for poly in obj.data.polygons:
            poly.use_smooth = False
    elif smooth:
        smooth_mark(obj, angle)
    assign_bone(obj, bone)
    GROUPS.setdefault(group, []).append(obj)
    return obj


def sphere(name, loc, scale, material, bone, group, segments=14, rings=8,
           rotation=(0, 0, 0), flat=False, high_detail=False):
    if not high_detail:
        segments = min(segments, 14)
        rings = min(rings, 8)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0, location=loc,
        rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_all(obj)
    return add_to_group(obj, material, bone, group, smooth=True, flat=flat)


def box(name, loc, size, material, bone, group, bevel=0.015, segments=3,
        rotation=(0, 0, 0), flat=False):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    apply_all(obj)
    if bevel > 0:
        mod = obj.modifiers.new("SoftBevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = radians(30)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)
    return add_to_group(obj, material, bone, group, smooth=True, flat=flat)


def cylinder(name, loc, radius, depth, material, bone, group,
             axis=(0, 0, 1), vertices=24, bevel=0.0, flat=False, scale=None):
    direction = Vector(axis).normalized()
    rot = direction.to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=loc,
        rotation=rot)
    obj = bpy.context.object
    obj.name = name
    if scale:
        obj.scale = scale
    apply_all(obj)
    if bevel > 0:
        mod = obj.modifiers.new("SoftEdge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)
    return add_to_group(obj, material, bone, group, smooth=True, flat=flat)


def torus(name, loc, major, minor, material, bone, group, axis=(0, 0, 1),
          rotation=(0, 0, 0), scale=(1, 1, 1), major_segments=16,
          minor_segments=4, high_detail=False):
    if not high_detail:
        major_segments = min(major_segments, 16)
        minor_segments = min(minor_segments, 4)
    if axis != (0, 0, 1):
        direction = Vector(axis).normalized()
        rot = direction.to_track_quat("Z", "Y").to_euler()
    else:
        rot = rotation
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=major_segments, minor_segments=minor_segments,
        location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_all(obj)
    return add_to_group(obj, material, bone, group, smooth=True)


def ellipsoid_between(name, p1, p2, rx, ry, material, bone, group,
                      segments=14, rings=8, extra_z=0.0):
    segments = min(segments, 14)
    rings = min(rings, 8)
    p1 = Vector(p1)
    p2 = Vector(p2)
    direction = p2 - p1
    length = direction.length
    center = (p1 + p2) * 0.5
    rot = direction.normalized().to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=1.0, location=center,
        rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (rx, ry, length * 0.5 + extra_z)
    apply_all(obj)
    return add_to_group(obj, material, bone, group, smooth=True)


def tube(name, points, radius, material, bone, group, sides=6):
    curve = bpy.data.curves.new(name + "_Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 6
    curve.bevel_depth = radius
    curve.bevel_resolution = max(1, sides // 6)
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = Vector(co)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    CM_ACC.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    apply_all(obj)
    return add_to_group(obj, material, bone, group, smooth=True)


def orient_faces(obj, hint):
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    avg = Vector((0, 0, 0))
    for face in bm.faces:
        avg += face.normal
    if avg.dot(Vector(hint)) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    me.update()


def custom_mesh(name, verts, faces, material, bone, group, smooth=True,
                hint=None, flat=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    obj = bpy.data.objects.new(name, me)
    CM_GEO.objects.link(obj)
    if hint is not None:
        orient_faces(obj, hint)
    return add_to_group(obj, material, bone, group, smooth=smooth,
                        flat=flat)


def basis_matrix(center, normal, up=(0, 0, 1)):
    n = Vector(normal).normalized()
    u = Vector(up)
    u = u - n * u.dot(n)
    if u.length < 1e-6:
        u = Vector((0, 1, 0))
        u = u - n * u.dot(n)
    u.normalize()
    r = u.cross(n).normalized()
    center = Vector(center)
    return Matrix((
        (r.x, n.x, u.x, center.x),
        (r.y, n.y, u.y, center.y),
        (r.z, n.z, u.z, center.z),
        (0.0, 0.0, 0.0, 1.0),
    ))


def transform_obj(obj, matrix):
    obj.matrix_world = matrix @ obj.matrix_world
    apply_all(obj)


def polygon_prism(name, points_xz, thickness, material, bone, group,
                  matrix, bevel=0.0, flat=False):
    n = len(points_xz)
    verts = [(x, -thickness * 0.5, z) for x, z in points_xz]
    verts += [(x, thickness * 0.5, z) for x, z in points_xz]
    faces = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    obj = bpy.data.objects.new(name, me)
    CM_GEO.objects.link(obj)
    orient_faces(obj, Vector((0, 1, 0)))
    transform_obj(obj, matrix)
    if bevel > 0:
        mod = obj.modifiers.new("SoftEdge", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        obj.select_set(False)
    return add_to_group(obj, material, bone, group, smooth=not flat, flat=flat)


def envelope(name, center, normal, up, width, height, bone, group,
             plaque_mat=MAT_GOLD, paper_mat=MAT_PAPER, flap_mat=MAT_GOLD_DARK,
             depth=0.012):
    M = basis_matrix(center, normal, up)
    # local +Y is the outward normal
    parts = []
    b = box(name + "_Plate", (0, 0, 0), (width, depth, height),
            plaque_mat, bone, group, bevel=depth * 0.45, segments=2)
    transform_obj(b, M)
    parts.append(b)
    p = box(name + "_Paper", (0, depth * 0.72, 0),
            (width * 0.80, depth * 0.55, height * 0.70),
            paper_mat, bone, group, bevel=depth * 0.25, segments=2)
    transform_obj(p, M)
    parts.append(p)
    # Triangle envelope flap, extruded shallowly and conformed to the plaque
    w = width * 0.76
    h = height * 0.66
    tri = [(-w * 0.5, h * 0.44), (w * 0.5, h * 0.44), (0.0, -h * 0.34)]
    f = polygon_prism(name + "_Flap", tri, depth * 0.42, flap_mat, bone,
                      group, M @ Matrix.Translation((0, depth * 0.98, 0)),
                      flat=False)
    parts.append(f)
    return parts


# --------------------------------------------------------------------------- #
# Helmet dimensions
# --------------------------------------------------------------------------- #

RX, RY, RZ = 0.315, 0.300, 0.325
CZ = 1.100
HELMET_CENTER = (0.0, 0.0, CZ)


def helmet_point(theta, phi, offset=0.0):
    """theta: longitude from +X, phi: polar from +Z."""
    x = RX * sin(phi) * cos(theta)
    y = RY * sin(phi) * sin(theta)
    z = CZ + RZ * cos(phi)
    normal = Vector((x / RX ** 2, y / RY ** 2, (z - CZ) / RZ ** 2))
    normal.normalize()
    return Vector((x, y, z)) + normal * offset


def visor_surface(u, angle, a=0.238, b=0.190, n=2.7, bulge=0.011):
    """Rounded-rectangle visor footprint projected on the helmet front."""
    c = cos(angle)
    s = sin(angle)
    x = a * u * math.copysign(abs(c) ** (2.0 / n), c)
    z = CZ + 0.008 + b * u * math.copysign(abs(s) ** (2.0 / n), s)
    inside = 1.0 - (x / RX) ** 2 - ((z - CZ) / RZ) ** 2
    y = -RY * math.sqrt(max(0.0, inside))
    y -= 0.003 + bulge * (1.0 - u * u)
    return Vector((x, y, z))


def build_visor_patch(name, u_max, rings, segments, bone, group, offset_inside=0.0):
    verts = []
    faces = []
    center = visor_surface(0.0, 0.0)
    center.y += offset_inside
    verts.append(tuple(center))
    for ring in range(1, rings + 1):
        u = u_max * (ring / rings) ** 0.9
        for seg in range(segments):
            ang = 2.0 * pi * seg / segments
            p = visor_surface(u, ang)
            p.y += offset_inside
            verts.append(tuple(p))
    for seg in range(segments):
        j = (seg + 1) % segments
        faces.append((0, 1 + seg, 1 + j))
    for ring in range(1, rings):
        start = 1 + (ring - 1) * segments
        following = 1 + ring * segments
        for seg in range(segments):
            j = (seg + 1) % segments
            faces.append((start + seg, following + seg,
                          following + j, start + j))
    return custom_mesh(name, verts, faces, MAT_VISOR, bone, group,
                       smooth=True, hint=(0, -1, 0))


def build_visor_rim(name, bone, group):
    # Gold seating band just outside the black glass
    rings = 4
    segments = 56
    u0, u1 = 0.93, 1.12
    verts = []
    faces = []
    for i in range(rings):
        u = u0 + (u1 - u0) * i / (rings - 1)
        for seg in range(segments):
            ang = 2.0 * pi * seg / segments
            verts.append(tuple(visor_surface(u, ang, bulge=0.0)))
    for i in range(rings - 1):
        a = i * segments
        b = (i + 1) * segments
        for seg in range(segments):
            j = (seg + 1) % segments
            faces.append((a + seg, b + seg, b + j, a + j))
    band = custom_mesh(name + "_Band", verts, faces, MAT_GOLD, bone, group,
                       smooth=True, hint=(0, -1, 0))
    # Rounded tube following the opening edge
    path = []
    for seg in range(segments):
        ang = 2.0 * pi * seg / segments
        p = visor_surface(1.02, ang, bulge=0.0)
        path.append(p)
    tube_verts = []
    tube_faces = []
    sides = 6
    for i, p in enumerate(path):
        p_next = path[(i + 1) % segments]
        p_prev = path[(i - 1) % segments]
        tangent = (p_next - p_prev).normalized()
        normal = Vector((p.x / RX ** 2, p.y / RY ** 2,
                         (p.z - CZ) / RZ ** 2)).normalized()
        side = tangent.cross(normal).normalized()
        center = p - normal * 0.006
        for s in range(sides):
            th = 2.0 * pi * s / sides
            q = center + side * (math.cos(th) * 0.017) + normal * (math.sin(th) * 0.014)
            tube_verts.append(tuple(q))
    for i in range(segments):
        i2 = (i + 1) % segments
        for s in range(sides):
            s2 = (s + 1) % sides
            tube_faces.append((i * sides + s, i2 * sides + s,
                               i2 * sides + s2, i * sides + s2))
    rim = custom_mesh(name + "_Rim", tube_verts, tube_faces, MAT_GOLD, bone,
                      group, smooth=True, hint=(0, -1, 0))
    return band, rim


def build_helmet():
    bone = "Helmet"
    group = "AST_Helmet"
    shell = sphere("AST_Helmet_Shell", HELMET_CENTER, (RX, RY, RZ),
                   MAT_SHELL, bone, group, segments=44, rings=28,
                   high_detail=True)
    shell = shell  # named reference retained

    # inner dark backstop behind the glass, entirely hidden by the visor
    build_visor_patch("AST_Visor_Backstop", 1.16, 4, 48, bone, "AST_Visor",
                      offset_inside=0.010)

    # Coral identification stripes conforming to the shell
    def ribbon(u_center, du, phi0, phi1, width_samples=4, steps=38):
        verts = []
        faces = []
        for i in range(steps + 1):
            phi = phi0 + (phi1 - phi0) * i / steps
            for j in range(width_samples + 1):
                u = u_center - du * 0.5 + du * j / width_samples
                verts.append(tuple(helmet_point(u, phi, 0.005)))
        row = width_samples + 1
        for i in range(steps):
            for j in range(width_samples):
                a = i * row + j
                b = (i + 1) * row + j
                faces.append((a, b, b + 1, a + 1))
        return custom_mesh(
            f"AST_Helmet_Stripe_{abs(u_center):.2f}",
            verts, faces, MAT_CORAL, bone, group, smooth=True,
            hint=(0, 0, 1))

    # broad vertical rear stripe + two side crown stripes
    ribbon(radians(90), radians(18.0), 0.22, 2.42, width_samples=4, steps=30)
    ribbon(radians(54), radians(4.5), 0.30, 2.20, width_samples=2, steps=30)
    ribbon(radians(126), radians(4.5), 0.30, 2.20, width_samples=2, steps=30)
    # front-crown coral identification band, visible in the front view
    ribbon(radians(304), radians(10.0), 0.25, 0.98, width_samples=3, steps=24)
    ribbon(radians(290), radians(3.5), 0.32, 0.88, width_samples=2, steps=20)

    # Gold neck attachment under the helmet
    torus("AST_Helmet_NeckRing_Dark", (0, 0, 0.784), 0.190, 0.017,
          MAT_DARK, bone, group, scale=(1.0, 0.96, 0.72))
    torus("AST_Helmet_NeckRing_Gold", (0, 0, 0.803), 0.193, 0.008,
          MAT_GOLD, bone, group, scale=(1.0, 0.96, 0.7))

    # Side communication modules
    for side, suffix in ((1, "L"), (-1, "R")):
        x = side * 0.315
        cylinder(f"AST_Helmet_Comms_{suffix}_Mount", (x, 0.0, 1.085),
                 0.086, 0.034, MAT_GOLD, bone, group, axis=(1, 0, 0),
                 vertices=20)
        torus(f"AST_Helmet_Comms_{suffix}_OuterRing", (x + side * 0.017, 0.0, 1.085),
              0.077, 0.011, MAT_CORAL, bone, group, axis=(1, 0, 0),
              major_segments=20, minor_segments=6)
        cylinder(f"AST_Helmet_Comms_{suffix}_Housing", (x + side * 0.050, 0.0, 1.085),
                 0.074, 0.062, MAT_LAVENDER, bone, group, axis=(1, 0, 0),
                 vertices=24, bevel=0.014)
        cylinder(f"AST_Helmet_Comms_{suffix}_Disc", (x + side * 0.086, 0.0, 1.085),
                 0.050, 0.018, MAT_LAVENDER_DARK, bone, group, axis=(1, 0, 0),
                 vertices=20, bevel=0.005)
        torus(f"AST_Helmet_Comms_{suffix}_Ring", (x + side * 0.097, 0.0, 1.085),
              0.054, 0.0055, MAT_GOLD, bone, group, axis=(1, 0, 0),
              major_segments=20, minor_segments=6)
        cylinder(f"AST_Helmet_Comms_{suffix}_Center", (x + side * 0.103, 0.0, 1.085),
                 0.034, 0.012, MAT_LAVENDER, bone, group, axis=(1, 0, 0),
                 vertices=18, bevel=0.004)

    # Antenna
    cylinder("AST_Helmet_AntennaPlate", (0, 0, 1.432), 0.033, 0.016,
             MAT_GOLD, bone, group, vertices=20, bevel=0.004)
    cylinder("AST_Helmet_AntennaStem", (0, 0, 1.455), 0.0085, 0.042,
             MAT_GOLD_DARK, bone, group, vertices=12)
    torus("AST_Helmet_AntennaCollar", (0, 0, 1.469), 0.014, 0.005,
          MAT_GOLD, bone, group, major_segments=16, minor_segments=6)
    sphere("AST_Helmet_AntennaLight", (0, 0, 1.478), (0.024, 0.024, 0.024),
           MAT_LIGHT, bone, group, segments=20, rings=14)

    # Front-top postal emblem housing
    z = 1.335
    y = -RY * math.sqrt(max(0.0, 1.0 - ((z - CZ) / RZ) ** 2))
    normal = Vector((0.0, y / RY ** 2, (z - CZ) / RZ ** 2)).normalized()
    center = Vector((0.0, y, z)) + normal * 0.017
    hb = box("AST_Helmet_EmblemHousing", center, (0.126, 0.022, 0.084),
             MAT_GOLD, bone, group, bevel=0.010, segments=3,
             rotation=(math.atan2(-normal.z, -normal.y) + pi,
                       0, 0))
    transform_obj(hb, Matrix.Identity(4))
    envelope("AST_Helmet_Envelope", center + normal * 0.016, normal,
             (0, 0, 1), 0.098, 0.060, bone, group,
             plaque_mat=MAT_GOLD_DARK, paper_mat=MAT_PAPER,
             flap_mat=MAT_GOLD, depth=0.009)

    # Visor glass + gold surround
    build_visor_patch("AST_Visor_Glass", 1.0, 11, 56, bone, "AST_Visor")
    build_visor_rim("AST_Visor", bone, "AST_Visor")


# --------------------------------------------------------------------------- #
# Suit body
# --------------------------------------------------------------------------- #

def build_body():
    # torso, pelvis, chest
    box("AST_Body_Pelvis", (0, 0, 0.468), (0.300, 0.250, 0.150),
        MAT_CREAM, "Hips", "AST_Body", bevel=0.062, segments=4)
    box("AST_Body_Waist", (0, 0, 0.560), (0.325, 0.262, 0.130),
        MAT_CREAM, "Spine", "AST_Body", bevel=0.060, segments=4)
    box("AST_Body_Torso", (0, 0, 0.665), (0.340, 0.272, 0.235),
        MAT_CREAM, "Spine", "AST_Body", bevel=0.085, segments=5)
    box("AST_Body_Chest", (0, 0, 0.738), (0.360, 0.282, 0.145),
        MAT_CREAM, "UpperBody", "AST_Body", bevel=0.070, segments=4)
    sphere("AST_Body_Collar", (0, 0, 0.790), (0.108, 0.100, 0.070),
           MAT_CREAM, "Neck", "AST_Body", segments=24, rings=14)

    # soft panel seams
    torus("AST_Body_Seam_Waist", (0, 0, 0.607), 0.171, 0.005,
          MAT_CORAL, "Spine", "AST_Body", scale=(1.0, 0.82, 1.0),
          major_segments=32, minor_segments=8)
    torus("AST_Body_Seam_Chest", (0, 0, 0.745), 0.181, 0.005,
          MAT_CREAM, "UpperBody", "AST_Body", scale=(1.0, 0.80, 1.0),
          major_segments=32, minor_segments=8)

    for side, suffix in ((1, "L"), (-1, "R")):
        # shoulder and arm chain
        sphere(f"AST_Body_Shoulder_{suffix}", (side * 0.196, 0.0, 0.752),
               (0.077, 0.073, 0.070), MAT_CREAM, f"Shoulder_{suffix}",
               "AST_Body", segments=22, rings=14)
        ellipsoid_between(f"AST_Body_UpperArm_{suffix}",
                          (side * 0.196, 0.0, 0.748),
                          (side * 0.262, 0.0, 0.594),
                          0.058, 0.056, MAT_CREAM, f"UpperArm_{suffix}",
                          "AST_Body", extra_z=0.012)
        sphere(f"AST_Body_Elbow_{suffix}", (side * 0.262, 0.0, 0.592),
               (0.058, 0.057, 0.055), MAT_CREAM, f"UpperArm_{suffix}",
               "AST_Body", segments=20, rings=12)
        ellipsoid_between(f"AST_Body_Forearm_{suffix}",
                          (side * 0.262, 0.0, 0.592),
                          (side * 0.305, 0.0, 0.440),
                          0.052, 0.051, MAT_CREAM, f"Forearm_{suffix}",
                          "AST_Body", extra_z=0.010)
        # coral upper-arm identification band
        torus(f"AST_Body_ArmBand_{suffix}",
              (side * 0.224, 0.0, 0.690), 0.061, 0.012,
              MAT_CORAL, f"UpperArm_{suffix}", "AST_Body",
              axis=(side * 0.394, 0.0, -0.919),
              major_segments=24, minor_segments=8)
        # gold wrist cuff
        torus(f"AST_Body_WristGold_{suffix}",
              (side * 0.302, 0.0, 0.449), 0.054, 0.009,
              MAT_GOLD, f"Forearm_{suffix}", "AST_Body",
              axis=(side * 0.278, 0.0, -0.960),
              major_segments=24, minor_segments=8)
        cylinder(f"AST_Body_WristCuff_{suffix}",
                 (side * 0.301, 0.0, 0.452), 0.055, 0.030,
                 MAT_LAVENDER, f"Forearm_{suffix}", "AST_Body",
                 axis=(side * 0.278, 0.0, -0.960), vertices=24,
                 bevel=0.008)
        # leg chain
        sphere(f"AST_Body_Hip_{suffix}", (side * 0.105, 0.0, 0.438),
               (0.086, 0.080, 0.078), MAT_CREAM, f"UpperLeg_{suffix}",
               "AST_Body", segments=22, rings=14)
        ellipsoid_between(f"AST_Body_Thigh_{suffix}",
                          (side * 0.105, 0.0, 0.435),
                          (side * 0.110, 0.0, 0.250),
                          0.078, 0.078, MAT_CREAM, f"UpperLeg_{suffix}",
                          "AST_Body", extra_z=0.012)
        sphere(f"AST_Body_Knee_{suffix}", (side * 0.110, 0.0, 0.250),
               (0.071, 0.072, 0.060), MAT_CREAM, f"LowerLeg_{suffix}",
               "AST_Body", segments=20, rings=12)
        ellipsoid_between(f"AST_Body_Shin_{suffix}",
                          (side * 0.110, 0.0, 0.250),
                          (side * 0.110, 0.0, 0.142),
                          0.067, 0.067, MAT_CREAM, f"LowerLeg_{suffix}",
                          "AST_Body", extra_z=0.010)
        torus(f"AST_Body_ThighBand_{suffix}",
              (side * 0.108, 0.0, 0.322), 0.082, 0.012,
              MAT_CORAL, f"UpperLeg_{suffix}", "AST_Body",
              major_segments=24, minor_segments=8)
        torus(f"AST_Body_KneeBand_{suffix}",
              (side * 0.110, 0.0, 0.247), 0.074, 0.008,
              MAT_LAVENDER_DARK, f"LowerLeg_{suffix}", "AST_Body",
              major_segments=24, minor_segments=8)

        build_glove(side, suffix)
        build_boot(side, suffix)

    # belt
    torus("AST_Body_Belt", (0, 0, 0.506), 0.166, 0.019,
          MAT_STRAP, "Hips", "AST_Body", scale=(1.0, 0.86, 1.35),
          major_segments=32, minor_segments=9)
    box("AST_Body_BeltBuckle", (0, -0.152, 0.506), (0.072, 0.025, 0.052),
        MAT_GOLD, "Hips", "AST_Body", bevel=0.008, segments=2)


def build_glove(side, suffix):
    wrist = Vector((side * 0.305, 0.0, 0.438))
    palm = Vector((side * 0.315, -0.004, 0.388))
    bone = f"Hand_{suffix}"
    group = "AST_Body"
    sphere(f"AST_Glove_{suffix}_Palm", palm, (0.056, 0.043, 0.064),
           MAT_LAVENDER, bone, group, segments=22, rings=14)
    # cuff and gold trim sit on the forearm
    cylinder(f"AST_Glove_{suffix}_Cuff", (side * 0.303, 0.0, 0.445),
             0.058, 0.036, MAT_LAVENDER_DARK, f"Forearm_{suffix}", group,
             axis=(side * 0.278, 0.0, -0.960), vertices=24, bevel=0.010)
    torus(f"AST_Glove_{suffix}_CuffGold", (side * 0.302, 0.0, 0.458),
          0.057, 0.008, MAT_GOLD, f"Forearm_{suffix}", group,
          axis=(side * 0.278, 0.0, -0.960), major_segments=24,
          minor_segments=8)
    # cream reinforcement on the back of the hand (faces forward)
    box(f"AST_Glove_{suffix}_BackPanel", (side * 0.315, -0.043, 0.395),
        (0.080, 0.010, 0.058), MAT_CREAM, bone, group,
        bevel=0.005, segments=2)
    envelope(f"AST_Glove_{suffix}_Envelope", (side * 0.315, -0.050, 0.395),
             (0, -1, 0), (0, 0, 1), 0.050, 0.038, bone, group,
             plaque_mat=MAT_GOLD_DARK, paper_mat=MAT_PAPER,
             flap_mat=MAT_GOLD, depth=0.005)
    # four fingers, slightly curved and spread
    offsets = (-0.034, -0.011, 0.012, 0.035)
    for i, ox in enumerate(offsets):
        finger_x = side * 0.315 + ox
        sphere(f"AST_Glove_{suffix}_Finger{i}_A",
               (finger_x, -0.010, 0.333), (0.0145, 0.016, 0.033),
               MAT_LAVENDER, bone, group, segments=10, rings=6)
        sphere(f"AST_Glove_{suffix}_Finger{i}_B",
               (finger_x + ox * 0.20, -0.020, 0.298),
               (0.013, 0.014, 0.027), MAT_LAVENDER, bone, group,
               segments=10, rings=6)
    thumb_x = side * 0.265
    sphere(f"AST_Glove_{suffix}_Thumb",
           (thumb_x, -0.012, 0.362), (0.019, 0.021, 0.039),
           MAT_LAVENDER, bone, group, segments=12, rings=8,
           rotation=(0, radians(side * 18), 0))


def build_boot(side, suffix):
    x = side * 0.105
    bone = f"Foot_{suffix}"
    group = "AST_Body"
    # Sole outline, toe toward -Y
    outline = [
        (0.056, -0.150), (0.080, -0.120), (0.086, -0.040),
        (0.088, 0.030), (0.080, 0.086), (0.052, 0.112),
        (0.000, 0.120), (-0.052, 0.112), (-0.080, 0.086),
        (-0.088, 0.030), (-0.086, -0.040), (-0.080, -0.120),
        (-0.056, -0.150), (0.000, -0.158),
    ]
    top = 0.032
    verts = [(x + px, py, 0.0) for px, py in outline]
    verts += [(x + px, py, top) for px, py in outline]
    n = len(outline)
    faces = [list(range(n - 1, -1, -1)), list(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, j, n + j, n + i])
    me = bpy.data.meshes.new(f"AST_Boot_{suffix}_SoleMesh")
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    sole = bpy.data.objects.new(f"AST_Boot_{suffix}_Sole", me)
    CM_GEO.objects.link(sole)
    orient_faces(sole, (0, 0, -1))
    mod = sole.modifiers.new("SoleEdge", "BEVEL")
    mod.width = 0.004
    mod.segments = 2
    bpy.context.view_layer.objects.active = sole
    sole.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    sole.select_set(False)
    add_to_group(sole, MAT_SOLE, bone, group, smooth=True)

    box(f"AST_Boot_{suffix}_Upper", (x, -0.010, 0.106),
        (0.170, 0.235, 0.150), MAT_CREAM, bone, group,
        bevel=0.046, segments=4)
    box(f"AST_Boot_{suffix}_ToeCap", (x, -0.112, 0.075),
        (0.166, 0.108, 0.087), MAT_CORAL, bone, group,
        bevel=0.034, segments=4)
    box(f"AST_Boot_{suffix}_Heel", (x, 0.072, 0.055),
        (0.150, 0.070, 0.060), MAT_GOLD_DARK, bone, group,
        bevel=0.018, segments=3)
    box(f"AST_Boot_{suffix}_Strap", (x, -0.030, 0.153),
        (0.186, 0.060, 0.036), MAT_LAVENDER, bone, group,
        bevel=0.014, segments=3)
    torus(f"AST_Boot_{suffix}_AnkleCuff", (x, 0.0, 0.183), 0.064, 0.017,
          MAT_LAVENDER, bone, group, scale=(1.05, 1.0, 0.75),
          major_segments=24, minor_segments=8)
    torus(f"AST_Boot_{suffix}_AnkleGold", (x, 0.0, 0.172), 0.063, 0.007,
          MAT_GOLD, bone, group, scale=(1.05, 1.0, 0.7),
          major_segments=24, minor_segments=8)
    box(f"AST_Boot_{suffix}_Buckle", (x + side * 0.092, -0.030, 0.153),
        (0.025, 0.048, 0.042), MAT_GOLD, bone, group,
        bevel=0.006, segments=2)
    star_points = []
    for i in range(8):
        ang = pi * 0.5 + i * pi / 4.0
        radius = 0.037 if i % 2 == 0 else 0.014
        star_points.append((radius * cos(ang), radius * sin(ang)))
    M = basis_matrix((x + side * 0.089, -0.010, 0.112),
                     (side, 0, 0), (0, 0, 1))
    polygon_prism(f"AST_Boot_{suffix}_Star", star_points, 0.007,
                  MAT_GOLD, bone, group, M, bevel=0.002, flat=False)


def build_scarf():
    group = "AST_Scarf"
    # three layered folds, tucking under the helmet
    torus("AST_Scarf_Layer_Low", (0, 0.004, 0.762), 0.176, 0.033,
          MAT_BURGUNDY, "Scarf_Base", group, scale=(1.0, 0.94, 0.82),
          major_segments=24, minor_segments=8, high_detail=True)
    torus("AST_Scarf_Layer_Mid", (0, 0.004, 0.792), 0.188, 0.035,
          MAT_BURGUNDY, "Scarf_Base", group, scale=(1.0, 0.94, 0.82),
          major_segments=24, minor_segments=8, high_detail=True)
    torus("AST_Scarf_Layer_Top", (0, 0.004, 0.822), 0.178, 0.031,
          MAT_BURGUNDY, "Scarf_Base", group, scale=(1.0, 0.94, 0.82),
          major_segments=24, minor_segments=8, high_detail=True)
    # knot on the character's right front
    sphere("AST_Scarf_Knot", (-0.148, -0.164, 0.770),
           (0.055, 0.045, 0.052), MAT_BURGUNDY, "Scarf_Base", group,
           segments=22, rings=14)
    # short thick tail over the chest: one continuous folded strip
    tail = tube("AST_Scarf_Tail",
                [(-0.150, -0.180, 0.762),
                 (-0.164, -0.196, 0.700),
                 (-0.178, -0.200, 0.630),
                 (-0.188, -0.198, 0.575)],
                0.036, MAT_BURGUNDY, "Scarf_Tip", group, sides=12)
    for vert in tail.data.vertices:
        vert.co.y = -0.192 + (vert.co.y + 0.192) * 0.62
        t = max(0.0, min(1.0, (0.762 - vert.co.z) / 0.187))
        cx = -0.150 - 0.039 * t
        taper = 1.0 - 0.28 * t
        vert.co.x = cx + (vert.co.x - cx) * taper
    tail.data.update()
    torus("AST_Scarf_Tail_Gold", (-0.186, -0.192, 0.578), 0.040, 0.007,
          MAT_GOLD, "Scarf_Tip", group, axis=(0.12, 0.03, -1.0),
          major_segments=20, minor_segments=6)


def build_backpack():
    bone = "Backpack"
    group = "AST_Backpack"
    # body sits behind the torso, top clear of the helmet's lower back
    box("AST_Backpack_Main", (0, 0.260, 0.665), (0.360, 0.190, 0.330),
        MAT_CORAL, bone, group, bevel=0.055, segments=4)
    box("AST_Backpack_RearPanel", (0, 0.352, 0.665), (0.340, 0.020, 0.290),
        MAT_CORAL, bone, group, bevel=0.018, segments=2)
    box("AST_Backpack_Flap", (0, 0.305, 0.807), (0.380, 0.120, 0.110),
        MAT_CREAM, bone, group, bevel=0.035, segments=3)
    box("AST_Backpack_FlapTrim", (0, 0.367, 0.758), (0.370, 0.018, 0.030),
        MAT_GOLD, bone, group, bevel=0.006, segments=2)
    box("AST_Backpack_LowerBand", (0, 0.358, 0.525), (0.350, 0.020, 0.045),
        MAT_GOLD_DARK, bone, group, bevel=0.008, segments=2)
    # two vertical envelope emblems on the back
    for i, z in enumerate((0.745, 0.600)):
        envelope(f"AST_Backpack_Envelope_{i+1}", (0, 0.363, z),
                 (0, 1, 0), (0, 0, 1), 0.115, 0.090, bone, group,
                 plaque_mat=MAT_GOLD, paper_mat=MAT_PAPER,
                 flap_mat=MAT_GOLD_DARK, depth=0.012)
    # side utility pods
    for side, suffix in ((1, "L"), (-1, "R")):
        box(f"AST_Backpack_SidePod_{suffix}",
            (side * 0.198, 0.270, 0.640), (0.070, 0.150, 0.140),
            MAT_CREAM, bone, group, bevel=0.020, segments=3)
        box(f"AST_Backpack_SidePod_{suffix}_Flap",
            (side * 0.206, 0.270, 0.700), (0.060, 0.155, 0.048),
            MAT_CORAL, bone, group, bevel=0.014, segments=2)
        box(f"AST_Backpack_SidePod_{suffix}_Buckle",
            (side * 0.236, 0.215, 0.662), (0.022, 0.030, 0.030),
            MAT_GOLD, bone, group, bevel=0.005, segments=2)
        envelope(f"AST_Backpack_SideEnvelope_{suffix}",
                 (side * 0.236, 0.270, 0.632), (side, 0, 0), (0, 0, 1),
                 0.052, 0.042, bone, group,
                 plaque_mat=MAT_GOLD_DARK, paper_mat=MAT_PAPER,
                 flap_mat=MAT_GOLD, depth=0.006)
        cylinder(f"AST_Backpack_Canister_{suffix}",
                 (side * 0.208, 0.315, 0.710), 0.032, 0.140,
                 MAT_CREAM, bone, group, axis=(0, 0, 1), vertices=14,
                 bevel=0.004)
        torus(f"AST_Backpack_CanisterBand_{suffix}",
              (side * 0.208, 0.315, 0.710), 0.032, 0.007,
              MAT_BURGUNDY, bone, group, major_segments=18,
              minor_segments=6)
    # small rolled accessory across the top side
    cylinder("AST_Backpack_Roll", (0.150, 0.300, 0.872), 0.028, 0.145,
             MAT_CREAM, bone, group, axis=(1, 0, 0), vertices=14,
             bevel=0.004)
    torus("AST_Backpack_RollBandA", (0.095, 0.300, 0.872), 0.028, 0.006,
          MAT_BURGUNDY, bone, group, axis=(1, 0, 0),
          major_segments=18, minor_segments=6)
    torus("AST_Backpack_RollBandB", (0.205, 0.300, 0.872), 0.028, 0.006,
          MAT_BURGUNDY, bone, group, axis=(1, 0, 0),
          major_segments=18, minor_segments=6)
    # shoulder and rear harness straps
    for side, suffix in ((1, "L"), (-1, "R")):
        tube(f"AST_Backpack_StrapFront_{suffix}",
             [(side * 0.128, -0.150, 0.772),
              (side * 0.168, -0.108, 0.805),
              (side * 0.150, 0.100, 0.805),
              (side * 0.138, 0.300, 0.775)],
             0.015, MAT_STRAP, "UpperBody", group)
        tube(f"AST_Backpack_StrapRear_{suffix}",
             [(side * 0.158, 0.362, 0.810),
              (side * 0.168, 0.370, 0.665),
              (side * 0.158, 0.360, 0.520)],
             0.014, MAT_STRAP, bone, group)
        box(f"AST_Backpack_StrapBuckle_{suffix}",
            (side * 0.166, 0.372, 0.715), (0.032, 0.018, 0.028),
            MAT_GOLD, bone, group, bevel=0.004, segments=2)


def build_harness():
    bone = "UpperBody"
    group = "AST_Harness"
    # vertical chest straps
    for side, suffix in ((1, "L"), (-1, "R")):
        tube(f"AST_Harness_FrontStrap_{suffix}",
             [(side * 0.118, -0.130, 0.778),
              (side * 0.152, -0.160, 0.705),
              (side * 0.145, -0.168, 0.620),
              (side * 0.130, -0.158, 0.535)],
             0.014, MAT_STRAP, bone, group)
        box(f"AST_Harness_Buckle_{suffix}",
            (side * 0.147, -0.176, 0.692), (0.052, 0.025, 0.042),
            MAT_GOLD, bone, group, bevel=0.007, segments=2)
        box(f"AST_Harness_LowerBuckle_{suffix}",
            (side * 0.134, -0.168, 0.565), (0.040, 0.022, 0.033),
            MAT_GOLD_DARK, bone, group, bevel=0.005, segments=2)
    tube("AST_Harness_ChestStrap",
         [(-0.145, -0.167, 0.630), (0.0, -0.176, 0.630),
          (0.145, -0.167, 0.630)],
         0.012, MAT_STRAP, bone, group)
    # central postal utility module
    box("AST_Harness_Module", (0, -0.170, 0.660),
        (0.118, 0.036, 0.138), MAT_GOLD, bone, group,
        bevel=0.014, segments=3)
    envelope("AST_Harness_Envelope", (0, -0.192, 0.668),
             (0, -1, 0), (0, 0, 1), 0.094, 0.082, bone, group,
             plaque_mat=MAT_GOLD_DARK, paper_mat=MAT_PAPER,
             flap_mat=MAT_GOLD, depth=0.010)
    box("AST_Harness_LowerClasp", (0, -0.165, 0.535),
        (0.082, 0.030, 0.052), MAT_GOLD_DARK, bone, group,
        bevel=0.008, segments=2)
    # compact side pouches on the belt
    for side, suffix in ((1, "L"), (-1, "R")):
        box(f"AST_Harness_Pouch_{suffix}",
            (side * 0.178, -0.078, 0.492), (0.076, 0.062, 0.100),
            MAT_STRAP, "Hips", group, bevel=0.016, segments=3)
        box(f"AST_Harness_PouchFlap_{suffix}",
            (side * 0.178, -0.112, 0.530), (0.080, 0.012, 0.045),
            MAT_CREAM, "Hips", group, bevel=0.010, segments=2)
        box(f"AST_Harness_PouchBuckle_{suffix}",
            (side * 0.178, -0.121, 0.518), (0.028, 0.012, 0.024),
            MAT_GOLD, "Hips", group, bevel=0.004, segments=2)


def build_insignias():
    group = "AST_Insignias"
    for side, suffix in ((1, "L"), (-1, "R")):
        # small postal mission patch on the outer upper arm
        center = Vector((side * 0.286, 0.0, 0.665))
        normal = (side, 0, 0)
        M = basis_matrix(center, normal, (0, 0, 1))
        box(f"AST_Insignia_ArmPatch_{suffix}", center,
            (0.008, 0.050, 0.050), MAT_CREAM, f"UpperArm_{suffix}",
            group, bevel=0.004, segments=2)
        # tiny lavender ringed planet
        cylinder(f"AST_Insignia_ArmPlanet_{suffix}",
                 (side * 0.294, 0.0, 0.665), 0.017, 0.006,
                 MAT_LAVENDER_DARK, f"UpperArm_{suffix}", group,
                 axis=(1, 0, 0), vertices=18)
        torus(f"AST_Insignia_ArmPlanetRing_{suffix}",
              (side * 0.298, 0.0, 0.665), 0.023, 0.003,
              MAT_GOLD, f"UpperArm_{suffix}", group,
              axis=(1, 0, 0), scale=(1.0, 1.0, 0.45),
              major_segments=18, minor_segments=6)


# --------------------------------------------------------------------------- #
# Build all geometry
# --------------------------------------------------------------------------- #

build_body()
build_helmet()
build_scarf()
build_backpack()
build_harness()
build_insignias()

# --------------------------------------------------------------------------- #
# Rig
# --------------------------------------------------------------------------- #

arm_data = bpy.data.armatures.new("CM_Astronaut_Skeleton")
arm = bpy.data.objects.new("CM_Astronaut_Armature", arm_data)
CM_RIG.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")

BONE_DEFS = [
    ("Root", (0, 0, 0.0), (0, 0, 0.12), None, False),
    ("Hips", (0, 0, 0.440), (0, 0, 0.530), "Root", False),
    ("Spine", (0, 0, 0.530), (0, 0, 0.660), "Hips", True),
    ("UpperBody", (0, 0, 0.660), (0, 0, 0.780), "Spine", True),
    ("Neck", (0, 0, 0.780), (0, 0, 0.880), "UpperBody", True),
    ("Helmet", (0, 0, 0.880), (0, 0, 1.250), "Neck", True),
    ("Backpack", (0, 0.120, 0.700), (0, 0.310, 0.700), "UpperBody", False),
    ("Scarf_Base", (0, 0.0, 0.805), (-0.120, -0.120, 0.770), "UpperBody", False),
    ("Scarf_Tip", (-0.120, -0.120, 0.770), (-0.190, -0.155, 0.560), "Scarf_Base", True),
]
for side, suffix in ((1, "L"), (-1, "R")):
    BONE_DEFS += [
        (f"Shoulder_{suffix}", (side * 0.050, 0, 0.752), (side * 0.196, 0, 0.752), "UpperBody", False),
        (f"UpperArm_{suffix}", (side * 0.196, 0, 0.752), (side * 0.262, 0, 0.592), f"Shoulder_{suffix}", True),
        (f"Forearm_{suffix}", (side * 0.262, 0, 0.592), (side * 0.305, 0, 0.438), f"UpperArm_{suffix}", True),
        (f"Hand_{suffix}", (side * 0.305, 0, 0.438), (side * 0.320, 0, 0.300), f"Forearm_{suffix}", True),
        (f"UpperLeg_{suffix}", (side * 0.105, 0, 0.440), (side * 0.110, 0, 0.250), "Hips", False),
        (f"LowerLeg_{suffix}", (side * 0.110, 0, 0.250), (side * 0.110, 0, 0.140), f"UpperLeg_{suffix}", True),
        (f"Foot_{suffix}", (side * 0.110, 0, 0.140), (side * 0.110, -0.105, 0.055), f"LowerLeg_{suffix}", True),
        (f"Toe_{suffix}", (side * 0.110, -0.105, 0.055), (side * 0.110, -0.190, 0.050), f"Foot_{suffix}", True),
    ]

edit_bones = arm_data.edit_bones
for name, head, tail, parent, connected in BONE_DEFS:
    b = edit_bones.new(name)
    b.head = head
    b.tail = tail
    b.roll = 0.0
    if parent:
        b.parent = edit_bones[parent]
        b.use_connect = connected
bpy.ops.object.mode_set(mode="OBJECT")
arm.show_in_front = True
arm.data.display_type = "OCTAHEDRAL"

ALL_BONES = [b[0] for b in BONE_DEFS]
DEFORM_BONES = [b for b in ALL_BONES if b != "Root"]

# --------------------------------------------------------------------------- #
# Join meshes and bind
# --------------------------------------------------------------------------- #

def dedupe_material_slots(obj):
    old = [obj.data.materials[p.material_index] for p in obj.data.polygons]
    unique = []
    index = {}
    for mat in old:
        if mat.name not in index:
            index[mat.name] = len(unique)
            unique.append(mat)
    obj.data.materials.clear()
    for mat in unique:
        obj.data.materials.append(mat)
    for poly, mat in zip(obj.data.polygons, old):
        poly.material_index = index[mat.name]


def join_group(group_name, final_name, collection):
    objs = GROUPS.get(group_name, [])
    if not objs:
        raise RuntimeError(f"No geometry for group {group_name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objs:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = final_name
    joined.data.name = final_name + "_Mesh"
    linked = False
    for coll in joined.users_collection:
        if coll == collection:
            linked = True
    if not linked:
        link_only(joined, collection)
    dedupe_material_slots(joined)
    mod = joined.modifiers.new("AstronautArmature", "ARMATURE")
    mod.object = arm
    joined.parent = arm
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.data.update()
    return joined


for _gname, _objs in GROUPS.items():
    _t = 0
    for _o in _objs:
        _o.data.calc_loop_triangles()
        _t += len(_o.data.loop_triangles)
    print("GROUP_TRIS", _gname, len(_objs), _t)
    for _o in sorted(_objs, key=lambda o: len(o.data.loop_triangles),
                     reverse=True)[:8]:
        print("   PART", _o.name, len(_o.data.loop_triangles))

MESHES = [
    join_group("AST_Body", "AST_Body", CM_GEO),
    join_group("AST_Helmet", "AST_Helmet", CM_ACC),
    join_group("AST_Visor", "AST_Visor", CM_ACC),
    join_group("AST_Scarf", "AST_Scarf", CM_ACC),
    join_group("AST_Backpack", "AST_Backpack", CM_ACC),
    join_group("AST_Harness", "AST_Harness", CM_ACC),
    join_group("AST_Insignias", "AST_Insignias", CM_ACC),
]

# --------------------------------------------------------------------------- #
# Animation helpers
# --------------------------------------------------------------------------- #

arm.animation_data_create()


def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def world_quat(bone_name, rx=0.0, ry=0.0, rz=0.0):
    q = Quaternion((0, 0, 1), rz) @ Quaternion((0, 1, 0), ry) @ Quaternion((1, 0, 0), rx)
    rest = arm.data.bones[bone_name].matrix_local.to_quaternion()
    return rest.inverted() @ q @ rest


def local_quat(rx=0.0, ry=0.0, rz=0.0):
    return Euler((rx, ry, rz), "XYZ").to_quaternion()


def key_all(frame):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)
        pb.keyframe_insert("location", frame=frame, group=pb.name)


def key_rot(frame, bone, world=None, local=None):
    pb = arm.pose.bones[bone]
    pb.rotation_mode = "QUATERNION"
    if world is not None:
        pb.rotation_quaternion = world_quat(bone, *world)
    else:
        pb.rotation_quaternion = local_quat(*(local or (0, 0, 0)))
    pb.keyframe_insert("rotation_quaternion", frame=frame, group=bone)


def key_loc(frame, bone, offset):
    pb = arm.pose.bones[bone]
    rest = pb.bone.matrix_local.to_3x3()
    pb.location = rest.inverted() @ Vector(offset)
    pb.keyframe_insert("location", frame=frame, group=bone)


def new_action(name, end):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data.action = action
    reset_pose()
    key_all(1)
    key_all(end)
    try:
        action.use_frame_range = True
        action.frame_start = 1
        action.frame_end = end
    except Exception:
        pass
    return action


def action_fcurves(action):
    curves = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                curves.extend(list(bag.fcurves))
    if not curves and hasattr(action, "fcurves"):
        curves.extend(list(action.fcurves))
    return curves


def finish_action(action, name):
    for fc in action_fcurves(action):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = "AUTO_CLAMPED"
            kp.handle_right_type = "AUTO_CLAMPED"
    print("ACTION", name, tuple(action.frame_range))


def set_world_arms(frame, left_x=0.0, right_x=0.0, left_y=0.0,
                   right_y=0.0, left_z=0.0, right_z=0.0):
    key_rot(frame, "UpperArm_L", world=(left_x, left_y, left_z))
    key_rot(frame, "UpperArm_R", world=(right_x, right_y, right_z))


# --------------------------------------------------------------------------- #
# Idle
# --------------------------------------------------------------------------- #

def build_idle():
    action = new_action("Idle", 61)
    frames = [1, 16, 31, 46, 61]
    hip_z = [0.0, 0.006, 0.002, 0.006, 0.0]
    lean = [0.0, 0.014, 0.004, 0.014, 0.0]
    helmet_yaw = [0.0, 0.025, 0.0, -0.025, 0.0]
    arm_sway = [0.0, -0.012, 0.0, 0.012, 0.0]
    for i, f in enumerate(frames):
        key_loc(f, "Hips", (0, 0, hip_z[i]))
        key_rot(f, "UpperBody", world=(lean[i], 0.0, 0.0))
        key_rot(f, "Spine", world=(lean[i] * 0.4, 0.0, 0.0))
        key_rot(f, "Helmet", world=(0.0, 0.0, helmet_yaw[i]))
        key_rot(f, "Neck", world=(0.0, 0.0, -helmet_yaw[i] * 0.25))
        key_rot(f, "UpperArm_L", world=(arm_sway[i], -0.015, 0.0))
        key_rot(f, "UpperArm_R", world=(arm_sway[i], 0.015, 0.0))
        key_rot(f, "Forearm_L", local=(-0.06, 0, 0))
        key_rot(f, "Forearm_R", local=(-0.06, 0, 0))
        key_rot(f, "Scarf_Base", world=(0.0, 0.0, 0.01 * sin(2 * pi * i / 4)))
        key_rot(f, "Scarf_Tip", world=(0.02 * sin(2 * pi * i / 4), 0.0,
                                      0.025 * sin(2 * pi * i / 4 + 0.6)))
    finish_action(action, "Idle")
    return action


# --------------------------------------------------------------------------- #
# Walk and Run
# --------------------------------------------------------------------------- #

def locomotion(name, frames, t_values, amp_leg, amp_knee, amp_arm,
               lean, bob, raise_amt=0.0):
    action = new_action(name, frames[-1])
    for f, t in zip(frames, t_values):
        s = sin(2 * pi * t)
        c = cos(2 * pi * t)
        leg_l = -amp_leg * c
        leg_r = amp_leg * c
        knee_l = 0.10 + amp_knee * max(0.0, -s)
        knee_r = 0.10 + amp_knee * max(0.0, s)
        foot_l = -0.16 * c + 0.04
        foot_r = 0.16 * c + 0.04
        key_rot(f, "UpperLeg_L", local=(leg_l, 0, 0))
        key_rot(f, "UpperLeg_R", local=(leg_r, 0, 0))
        key_rot(f, "LowerLeg_L", local=(knee_l, 0, 0))
        key_rot(f, "LowerLeg_R", local=(knee_r, 0, 0))
        key_rot(f, "Foot_L", local=(foot_l, 0, 0))
        key_rot(f, "Foot_R", local=(foot_r, 0, 0))
        key_loc(f, "Hips", (0, 0, -0.008 - bob * cos(4 * pi * t)))
        key_rot(f, "Hips", world=(0.0, 0.0, 0.055 * s))
        key_rot(f, "Spine", world=(lean * 0.35, 0.0, -0.035 * s))
        key_rot(f, "UpperBody", world=(lean, 0.0, -0.045 * s))
        key_rot(f, "Helmet", world=(0.0, 0.0, 0.035 * s))
        key_rot(f, "UpperArm_L", world=(amp_arm * c, -raise_amt, 0.0))
        key_rot(f, "UpperArm_R", world=(-amp_arm * c, raise_amt, 0.0))
        key_rot(f, "Forearm_L", local=(-0.16 - 0.12 * max(0.0, -c), 0, 0))
        key_rot(f, "Forearm_R", local=(-0.16 - 0.12 * max(0.0, c), 0, 0))
        key_rot(f, "Scarf_Tip", world=(0.05 * s, 0.0, 0.04 * c))
        key_rot(f, "Scarf_Base", world=(0.02 * s, 0.0, 0.0))
    finish_action(action, name)
    return action


# --------------------------------------------------------------------------- #
# Turns
# --------------------------------------------------------------------------- #

def build_turn(name, sign):
    action = new_action(name, 16)
    for f, amount in ((1, 0.0), (5, 0.55), (9, 1.0), (16, 0.0)):
        key_loc(f, "Hips", (0, 0, -0.006 * amount))
        key_rot(f, "Hips", world=(0.0, 0.03 * sign * amount,
                                 0.12 * sign * amount))
        key_rot(f, "Spine", world=(0.02 * amount, 0.04 * sign * amount,
                                  0.15 * sign * amount))
        key_rot(f, "UpperBody", world=(0.03 * amount, 0.05 * sign * amount,
                                      0.18 * sign * amount))
        key_rot(f, "Helmet", world=(0.02 * amount, 0.0,
                                   0.13 * sign * amount))
        key_rot(f, "UpperArm_L", world=(-0.10 * amount, -0.04 * amount, 0.0))
        key_rot(f, "UpperArm_R", world=(0.10 * amount, 0.04 * amount, 0.0))
        key_rot(f, "Scarf_Base", world=(0.0, 0.0, -0.05 * sign * amount))
        key_rot(f, "Scarf_Tip", world=(0.0, 0.03 * sign * amount,
                                      -0.08 * sign * amount))
    finish_action(action, name)
    return action


# --------------------------------------------------------------------------- #
# Jump
# --------------------------------------------------------------------------- #

def build_jump():
    action = new_action("Jump", 28)
    frames = [1, 5, 9, 14, 20, 24, 28]
    hip = [0.0, -0.075, 0.020, 0.130, -0.075, -0.020, 0.0]
    lean = [0.0, 0.12, 0.03, 0.06, 0.16, 0.04, 0.0]
    knee = [0.0, 0.65, 0.25, 0.55, 0.70, 0.25, 0.0]
    foot = [0.0, -0.12, 0.25, 0.30, -0.10, 0.0, 0.0]
    arm = [0.0, 0.38, -0.40, -0.55, 0.20, 0.05, 0.0]
    for i, f in enumerate(frames):
        key_loc(f, "Hips", (0, 0, hip[i]))
        key_rot(f, "Hips", world=(lean[i] * 0.35, 0, 0))
        key_rot(f, "Spine", world=(lean[i] * 0.5, 0, 0))
        key_rot(f, "UpperBody", world=(lean[i], 0, 0))
        key_rot(f, "Neck", world=(0.02, 0, 0))
        key_rot(f, "Helmet", world=(0.05 * sin(i), 0, 0))
        key_rot(f, "UpperLeg_L", local=(-0.06, 0, 0))
        key_rot(f, "UpperLeg_R", local=(-0.06, 0, 0))
        key_rot(f, "LowerLeg_L", local=(knee[i], 0, 0))
        key_rot(f, "LowerLeg_R", local=(knee[i], 0, 0))
        key_rot(f, "Foot_L", local=(foot[i], 0, 0))
        key_rot(f, "Foot_R", local=(foot[i], 0, 0))
        key_rot(f, "UpperArm_L", world=(arm[i], -0.06, 0.0))
        key_rot(f, "UpperArm_R", world=(arm[i], 0.06, 0.0))
        key_rot(f, "Forearm_L", local=(-0.25 - 0.2 * (i / 6), 0, 0))
        key_rot(f, "Forearm_R", local=(-0.25 - 0.2 * (i / 6), 0, 0))
        key_rot(f, "Scarf_Tip", world=(0.10 * (1 if i in (2, 3, 4) else 0), 0, 0))
    finish_action(action, "Jump")
    return action


# --------------------------------------------------------------------------- #
# Interact
# --------------------------------------------------------------------------- #

def build_interact():
    action = new_action("Interact", 37)
    frames = [1, 8, 16, 23, 30, 37]
    reach = [0.0, 0.45, 1.0, 0.85, 0.25, 0.0]
    for i, f in enumerate(frames):
        r = reach[i]
        key_loc(f, "Hips", (0, 0, -0.010 * r))
        key_rot(f, "Spine", world=(0.04 * r, 0, -0.04 * r))
        key_rot(f, "UpperBody", world=(0.06 * r, 0, -0.10 * r))
        key_rot(f, "Helmet", world=(0.04 * r, 0.0, -0.08 * r))
        key_rot(f, "UpperArm_R", world=(-0.78 * r, 0.10 * r, 0.0))
        key_rot(f, "Forearm_R", local=(-0.35 * r, 0, 0))
        key_rot(f, "Hand_R", local=(-0.15 * r, 0, 0))
        key_rot(f, "UpperArm_L", world=(0.16 * r, -0.06, 0.0))
        key_rot(f, "Forearm_L", local=(-0.12, 0, 0))
        key_rot(f, "UpperLeg_L", local=(-0.04 * r, 0, 0))
        key_rot(f, "UpperLeg_R", local=(-0.04 * r, 0, 0))
        key_rot(f, "LowerLeg_L", local=(0.08 * r, 0, 0))
        key_rot(f, "LowerLeg_R", local=(0.08 * r, 0, 0))
        key_rot(f, "Scarf_Tip", world=(0.04 * r, 0, 0))
    finish_action(action, "Interact")
    return action


# --------------------------------------------------------------------------- #
# Wave
# --------------------------------------------------------------------------- #

def build_wave():
    action = new_action("Wave", 46)
    frames = [1, 9, 13, 17, 21, 25, 29, 33, 39, 46]
    raise_amt = [0.0, 0.45, 0.75, 0.90, 1.0, 1.0, 1.0, 0.95, 0.5, 0.0]
    elbow = [0.0, 0.15, 0.40, 0.65, 0.75, 0.75, 0.72, 0.55, 0.18, 0.0]
    wave = [0.0, 0.0, 0.0, 0.36, -0.36, 0.34, -0.32, 0.20, 0.0, 0.0]
    for i, f in enumerate(frames):
        r = raise_amt[i]
        key_loc(f, "Hips", (0, 0, 0.006 * r))
        key_rot(f, "Hips", world=(0, -0.03 * r, 0))
        key_rot(f, "Spine", world=(0.01 * r, -0.03 * r, -0.03 * r))
        key_rot(f, "UpperBody", world=(0.02 * r, -0.05 * r, -0.06 * r))
        key_rot(f, "Helmet", world=(0.02 * r, 0.02 * r, -0.06 * r))
        key_rot(f, "UpperArm_R", world=(-0.18 * r, 1.95 * r, 0.0))
        key_rot(f, "Forearm_R", local=(0.0, 0.0, elbow[i]))
        key_rot(f, "Hand_R", world=(0.05 * r, wave[i], 0.0))
        key_rot(f, "UpperArm_L", world=(0.03 * r, -0.02, 0.0))
        key_rot(f, "Forearm_L", local=(-0.10, 0, 0))
        key_rot(f, "LowerLeg_L", local=(0.04 * r, 0, 0))
        key_rot(f, "LowerLeg_R", local=(0.04 * r, 0, 0))
        key_rot(f, "Scarf_Tip", world=(0.03 * r, 0, 0.03 * wave[i]))
    finish_action(action, "Wave")
    return action


# --------------------------------------------------------------------------- #
# PickUp
# --------------------------------------------------------------------------- #

def build_pickup():
    action = new_action("PickUp", 40)
    frames = [1, 8, 16, 23, 31, 40]
    depth = [0.0, 0.45, 1.0, 0.95, 0.35, 0.0]
    for i, f in enumerate(frames):
        r = depth[i]
        key_loc(f, "Hips", (0, 0, -0.095 * r))
        key_rot(f, "Hips", world=(0.10 * r, 0, 0))
        key_rot(f, "Spine", world=(0.22 * r, 0, 0))
        key_rot(f, "UpperBody", world=(0.30 * r, 0, 0))
        key_rot(f, "Helmet", world=(0.12 * r, 0, 0))
        key_rot(f, "UpperLeg_L", local=(-0.30 * r, 0, 0))
        key_rot(f, "UpperLeg_R", local=(-0.30 * r, 0, 0))
        key_rot(f, "LowerLeg_L", local=(0.82 * r, 0, 0))
        key_rot(f, "LowerLeg_R", local=(0.82 * r, 0, 0))
        key_rot(f, "Foot_L", local=(-0.28 * r, 0, 0))
        key_rot(f, "Foot_R", local=(-0.28 * r, 0, 0))
        key_rot(f, "UpperArm_L", world=(-0.50 * r, -0.10 * r, 0.0))
        key_rot(f, "UpperArm_R", world=(-0.50 * r, 0.10 * r, 0.0))
        key_rot(f, "Forearm_L", local=(-0.25 * r, 0, 0))
        key_rot(f, "Forearm_R", local=(-0.25 * r, 0, 0))
        key_rot(f, "Scarf_Tip", world=(0.12 * r, 0, 0.02 * r))
    finish_action(action, "PickUp")
    return action


# --------------------------------------------------------------------------- #
# Celebrate
# --------------------------------------------------------------------------- #

def build_celebrate():
    action = new_action("Celebrate", 52)
    frames = [1, 8, 14, 20, 28, 36, 44, 52]
    up = [0.0, 0.65, 1.0, 0.95, 0.75, 0.95, 0.45, 0.0]
    bounce = [0.0, 0.015, 0.045, 0.010, 0.035, 0.010, 0.0, 0.0]
    for i, f in enumerate(frames):
        r = up[i]
        key_loc(f, "Hips", (0, 0, bounce[i]))
        key_rot(f, "Hips", world=(-0.03 * r, 0, 0))
        key_rot(f, "Spine", world=(-0.04 * r, 0, 0))
        key_rot(f, "UpperBody", world=(-0.06 * r, 0, 0))
        key_rot(f, "Helmet", world=(-0.06 * r, 0, 0))
        key_rot(f, "UpperArm_L", world=(-0.22 * r, -1.62 * r, 0.0))
        key_rot(f, "UpperArm_R", world=(-0.22 * r, 1.62 * r, 0.0))
        key_rot(f, "Forearm_L", world=(0.0, -0.72 * r, 0.0))
        key_rot(f, "Forearm_R", world=(0.0, 0.72 * r, 0.0))
        key_rot(f, "Hand_L", world=(0.0, -0.12 * r, 0.0))
        key_rot(f, "Hand_R", world=(0.0, 0.12 * r, 0.0))
        key_rot(f, "LowerLeg_L", local=(0.16 * r, 0, 0))
        key_rot(f, "LowerLeg_R", local=(0.16 * r, 0, 0))
        key_rot(f, "Foot_L", local=(-0.05 * r, 0, 0))
        key_rot(f, "Foot_R", local=(-0.05 * r, 0, 0))
        key_rot(f, "Scarf_Tip", world=(-0.06 * r, 0, 0.05 * r))
    finish_action(action, "Celebrate")
    return action


# --------------------------------------------------------------------------- #
# Create actions
# --------------------------------------------------------------------------- #

idle = build_idle()
walk = locomotion("Walk", [1, 7, 13, 19, 25], [0.0, 0.25, 0.5, 0.75, 1.0],
                  0.38, 0.42, 0.32, 0.045, 0.010)
run = locomotion("Run", [1, 5, 10, 14, 19], [0.0, 0.25, 0.5, 0.75, 1.0],
                 0.58, 0.62, 0.55, 0.17, 0.035, raise_amt=0.12)
turn_left = build_turn("Turn_Left", 1)
turn_right = build_turn("Turn_Right", -1)
jump = build_jump()
interact = build_interact()
wave = build_wave()
pickup = build_pickup()
celebrate = build_celebrate()

ACTIONS = {a.name: a for a in bpy.data.actions}
REQUIRED_ACTIONS = ["Idle", "Walk", "Run", "Turn_Left", "Turn_Right",
                    "Jump", "Interact", "Wave", "PickUp", "Celebrate"]
for name in REQUIRED_ACTIONS:
    assert name in ACTIONS, f"Missing action {name}"

arm.animation_data.action = idle
scene.frame_set(1)
reset_pose()
arm.animation_data.action = None

# --------------------------------------------------------------------------- #
# Ground-contact bake: lift the hips per frame when a boot dips below Z=0.
# This keeps the authored crouches, walk contacts and landings planted.
# --------------------------------------------------------------------------- #

def evaluated_min_z():
    depsgraph = bpy.context.evaluated_depsgraph_get()
    body = bpy.data.objects["AST_Body"]
    eval_obj = body.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    coords = [0.0] * (len(mesh.vertices) * 3)
    mesh.vertices.foreach_get("co", coords)
    min_z = min(coords[2::3]) if coords else 0.0
    eval_obj.to_mesh_clear()
    return min_z


def ground_actions():
    hips_rest = arm.data.bones["Hips"].matrix_local.to_3x3()
    corrections = {}
    for name in REQUIRED_ACTIONS:
        action = ACTIONS[name]
        arm.animation_data.action = action
        try:
            if action.slots:
                arm.animation_data.action_slot = action.slots[0]
        except Exception:
            pass
        start, end = int(action.frame_range[0]), int(action.frame_range[1])
        worst_before = 0.0
        worst_after = 0.0
        pb = arm.pose.bones["Hips"]
        for frame in range(start, end + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            min_z = evaluated_min_z()
            worst_before = min(worst_before, min_z)
            if min_z < -1e-5:
                world_offset = hips_rest @ pb.location
                world_offset.z -= min_z
                pb.location = hips_rest.inverted() @ world_offset
            pb.keyframe_insert("location", frame=frame, group="Hips")
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            worst_after = min(worst_after, evaluated_min_z())
        corrections[name] = {
            "worst_before": round(worst_before, 5),
            "worst_after": round(worst_after, 5),
        }
        print("GROUND", name, corrections[name])
    for name in REQUIRED_ACTIONS:
        for fc in action_fcurves(ACTIONS[name]):
            if fc.data_path == 'pose.bones["Hips"].location':
                for kp in fc.keyframe_points:
                    kp.interpolation = "BEZIER"
                    kp.handle_left_type = "AUTO_CLAMPED"
                    kp.handle_right_type = "AUTO_CLAMPED"
    scene.frame_set(1)
    reset_pose()
    return corrections


GROUND_REPORT = ground_actions()
arm.animation_data.action = None
scene.frame_set(1)
reset_pose()

# --------------------------------------------------------------------------- #
# Validation helpers
# --------------------------------------------------------------------------- #

def world_bounds(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            p = obj.matrix_world @ Vector(corner)
            mn.x = min(mn.x, p.x)
            mn.y = min(mn.y, p.y)
            mn.z = min(mn.z, p.z)
            mx.x = max(mx.x, p.x)
            mx.y = max(mx.y, p.y)
            mx.z = max(mx.z, p.z)
    return mn, mx


def triangle_count(objects):
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


bpy.context.view_layer.update()
mn, mx = world_bounds(MESHES)
height = mx.z - mn.z
tris = triangle_count(MESHES)
print("BOUNDS", tuple(round(v, 4) for v in mn), tuple(round(v, 4) for v in mx),
      "HEIGHT", round(height, 4), "TRIS", tris)
assert mn.z > -0.002, f"Mesh below ground: {mn.z}"
assert 1.45 <= height <= 1.55, f"Unexpected character height {height}"
assert 12000 <= tris <= 40000, f"Geometry budget out of range: {tris}"
assert len(ACTIONS) >= len(REQUIRED_ACTIONS)

# Anonymous avatar: no facial/head geometry or skin material anywhere.
forbidden = ("face", "eye", "mouth", "nose", "hair", "skin", "brow", "head")
found = []
for obj in bpy.data.objects:
    low = obj.name.lower()
    for token in forbidden:
        if token in low:
            found.append((obj.name, token))
for mat in bpy.data.materials:
    low = mat.name.lower()
    for token in forbidden:
        if token in low:
            found.append((mat.name, token))
assert not found, f"Anonymous-avatar audit failed: {found}"

# Visor must be opaque, non-transmissive, near-black.
bsdf = next(n for n in MAT_VISOR.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
base = bsdf.inputs["Base Color"].default_value
alpha = bsdf.inputs["Alpha"].default_value
transmission = bsdf.inputs.get("Transmission Weight")
assert alpha >= 0.999, f"Visor alpha is {alpha}"
if transmission:
    assert transmission.default_value <= 0.001, "Visor must not transmit"
assert max(base[0], base[1], base[2]) < 0.01, "Visor base color is not black"

# All final meshes bound.
for obj in MESHES:
    assert obj.find_armature() is arm, f"{obj.name} not bound to armature"
    assert len(obj.vertex_groups) > 0, f"{obj.name} has no vertex groups"
    groups = {vg.name for vg in obj.vertex_groups}
    missing = groups - set(ALL_BONES)
    assert not missing, f"{obj.name} has unknown bone groups {missing}"

# --------------------------------------------------------------------------- #
# Save master, export GLB (before any preview objects exist)
# --------------------------------------------------------------------------- #

bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
for obj in MESHES:
    obj.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=False,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_anim_slide_to_zero=True,
    export_force_sampling=True,
    export_optimize_animation_size=False,
    export_skins=True,
    export_def_bones=False,
    export_anim_single_armature=True,
    export_reset_pose_bones=True,
    export_texcoords=False,
    export_normals=True,
    export_tangents=False,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)
print("EXPORTED", GLB_PATH, os.path.getsize(GLB_PATH))

# --------------------------------------------------------------------------- #
# Parse exported GLB for independent structural checks
# --------------------------------------------------------------------------- #

def parse_glb(path):
    data = open(path, "rb").read()
    magic, version, length = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, "Invalid GLB magic"
    assert version == 2, f"Unexpected GLB version {version}"
    offset = 12
    gltf = None
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            gltf = json.loads(chunk.decode("utf-8"))
    assert gltf is not None, "GLB has no JSON chunk"
    return data, gltf


glb_bytes, gltf = parse_glb(GLB_PATH)
anim_names = [a.get("name") for a in gltf.get("animations", [])]
print("GLB_MESHES", len(gltf.get("meshes", [])),
      "NODES", len(gltf.get("nodes", [])),
      "MATERIALS", len(gltf.get("materials", [])),
      "SKINS", len(gltf.get("skins", [])),
      "ANIMATIONS", anim_names)
assert len(gltf.get("animations", [])) == len(REQUIRED_ACTIONS), anim_names
for name in REQUIRED_ACTIONS:
    assert name in anim_names, f"GLB missing animation {name}"
assert len(gltf.get("skins", [])) >= 1, "GLB has no skin"
assert len(gltf.get("materials", [])) >= 10, "GLB material library incomplete"

# Visor material in the exported glTF.
visor_export = None
for mat in gltf.get("materials", []):
    if mat.get("name") == "AST_Visor_Black":
        visor_export = mat
assert visor_export is not None, "Visor material missing from GLB"
pbr = visor_export.get("pbrMetallicRoughness", {})
visor_rgb = pbr.get("baseColorFactor", [0, 0, 0, 1])[:3]
assert max(visor_rgb) < 0.006, f"Exported visor not black: {visor_rgb}"
assert visor_export.get("alphaMode", "OPAQUE") == "OPAQUE"
assert visor_export.get("doubleSided", False) in (True, False)

# --------------------------------------------------------------------------- #
# Preview renders (not saved into the master file)
# --------------------------------------------------------------------------- #

def make_preview_material(name, color, roughness=0.9):
    return make_material(name, color, roughness)


preview_dark = make_preview_material("AST_Preview_Backdrop", "#1A1426", 0.92)
preview_floor = make_preview_material("AST_Preview_Floor", "#2A2036", 0.88)

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
floor = bpy.context.object
floor.name = "AST_Preview_Floor"
floor.data.materials.append(preview_floor)
link_only(floor, CM_PREVIEW)

studio_world = bpy.data.worlds.new("AST_Preview_World")
studio_world.use_nodes = True
bg = studio_world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.035, 0.028, 0.055, 1.0)
bg.inputs["Strength"].default_value = 0.75
scene.world = studio_world

preview_lights = []
for name, loc, energy, size, color in (
    ("Key", (-2.2, -3.4, 3.6), 420, 3.2, (1.0, 0.93, 0.84)),
    ("Fill", (3.0, -2.0, 1.4), 150, 3.0, (0.66, 0.78, 1.0)),
    ("Rim", (0.4, 3.2, 2.8), 320, 2.6, (1.0, 0.72, 0.52)),
    ("Top", (0.0, 0.4, 4.6), 130, 2.2, (1.0, 0.92, 0.86)),
):
    ld = bpy.data.lights.new("AST_Preview_" + name, "AREA")
    ld.energy = energy
    ld.shape = "DISK"
    ld.size = size
    ld.color = color
    lo = bpy.data.objects.new("AST_Preview_" + name, ld)
    lo.location = loc
    direction = Vector((0, 0, 0.85)) - lo.location
    lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    CM_PREVIEW.objects.link(lo)
    preview_lights.append(lo)

cam_data = bpy.data.cameras.new("AST_Preview_Camera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 1.70
cam = bpy.data.objects.new("AST_Preview_Camera", cam_data)
CM_PREVIEW.objects.link(cam)
scene.camera = cam

scene.render.resolution_x = 760
scene.render.resolution_y = 950
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
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

VIEWS = {
    "front": ((0.0, -4.0, 0.80), (0.0, 0.0, 0.80)),
    "three_quarter": ((2.7, -3.1, 1.65), (0.0, 0.0, 0.80)),
    "side": ((4.0, 0.0, 0.80), (0.0, 0.0, 0.80)),
    "rear": ((0.0, 4.0, 0.80), (0.0, 0.0, 0.80)),
}


def place_camera(position, target):
    cam.location = position
    direction = Vector(target) - Vector(position)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_view(label, position, target=None, action=None, frame=1):
    place_camera(position, target or (0, 0, 0.80))
    if action is None:
        arm.animation_data.action = None
        reset_pose()
    else:
        arm.animation_data.action = ACTIONS[action]
        scene.frame_set(frame)
    scene.render.filepath = os.path.join(VIEW_DIR, f"astronaut_{label}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDER", scene.render.filepath)


for label, (pos, target) in VIEWS.items():
    render_view(label, pos, target)

# Diagnostic lighting: much brighter and cooler, from the side
for light in preview_lights:
    light.data.energy *= 1.5
bg.inputs["Color"].default_value = (0.10, 0.11, 0.14, 1.0)
bg.inputs["Strength"].default_value = 1.3
render_view("diagnostic_front", (0.0, -3.4, 1.2), (0, 0, 0.82))
render_view("diagnostic_side", (3.4, -1.2, 1.4), (0, 0, 0.82))

# Representative animation poses
render_view("pose_walk", (2.7, -3.1, 1.65), (0, 0, 0.80), "Walk", 13)
render_view("pose_run", (2.7, -3.1, 1.65), (0, 0, 0.80), "Run", 10)
render_view("pose_wave", (0.0, -4.0, 0.80), (0, 0, 0.80), "Wave", 21)
render_view("pose_jump", (2.7, -3.1, 1.65), (0, 0, 0.80), "Jump", 14)
render_view("pose_pickup", (2.7, -3.1, 1.65), (0, 0, 0.80), "PickUp", 16)
render_view("pose_interact", (0.0, -4.0, 0.80), (0, 0, 0.80), "Interact", 16)
render_view("pose_turn", (0.0, -4.0, 0.80), (0, 0, 0.80), "Turn_Left", 9)
render_view("pose_celebrate", (0.0, -4.0, 0.80), (0, 0, 0.80), "Celebrate", 14)
arm.animation_data.action = None
reset_pose()

# --------------------------------------------------------------------------- #
# Final report
# --------------------------------------------------------------------------- #

report = {
    "blend": BLEND_PATH,
    "glb": GLB_PATH,
    "glb_bytes": os.path.getsize(GLB_PATH),
    "height": round(height, 4),
    "bounds_min": [round(v, 4) for v in mn],
    "bounds_max": [round(v, 4) for v in mx],
    "triangles": tris,
    "meshes": len(MESHES),
    "materials": len(MATS),
    "bones": len(ALL_BONES),
    "actions": {name: [int(ACTIONS[name].frame_range[0]),
                       int(ACTIONS[name].frame_range[1])]
                for name in REQUIRED_ACTIONS},
    "glb_animations": anim_names,
    "glb_materials": len(gltf.get("materials", [])),
    "glb_nodes": len(gltf.get("nodes", [])),
    "ground_contact": GROUND_REPORT,
    "preview_dir": VIEW_DIR,
}
with open(os.path.join(VIEW_DIR, "build_report.json"), "w") as handle:
    json.dump(report, handle, indent=2)
print("BUILD_REPORT", json.dumps(report, indent=2))
print("DONE")
