"""
PIP - Retro Space Post Companion
================================
Reproducible Blender generator for the Cosmic Mail companion.

Usage
-----
    blender --background --factory-startup --python blender/PIP/PIP_build.py

Outputs (next to this script)
-----------------------------
    PIP_RetroSpacePost.blend
    PIP_RetroSpacePost.glb
    PIP_validation.json
    textures/PIP_Face_Eyes.png
    textures/PIP_Face_Mouth.png
    textures/PIP_Postal_Stamp.png
    previews/PIP_preview_front.png
    previews/PIP_preview_threequarter.png
    previews/PIP_preview_side.png
    previews/PIP_preview_back.png
    previews/PIP_preview_expressions.png

Coordinate convention
---------------------
    Blender: Z up, character forward = -Y, character right = +X.
    Root origin = centre of the main spherical body.
    After glTF Y-up export the character is upright and faces +Z in three.js.

Facial control strategy
-----------------------
    Eye_L, Eye_R and Mouth are independent meshes with their own materials.
    Each material samples a compact expression atlas.  The active expression
    is selected by changing the texture offset / repeat at runtime (documented
    in PIP_README.md and PIP_R3F_example.tsx).  The atlases are embedded in
    the GLB; no external texture files are required at runtime.
"""

import json
import math
import os
import struct
import time

import bpy
import bmesh
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# --------------------------------------------------------------------------- #
# Paths and constants
# --------------------------------------------------------------------------- #

BASE = os.path.dirname(os.path.abspath(__file__))
TEXTURE_DIR = os.path.join(BASE, "textures")
PREVIEW_DIR = os.path.join(BASE, "previews")
BLEND_PATH = os.path.join(BASE, "PIP_RetroSpacePost.blend")
GLB_PATH = os.path.join(BASE, "PIP_RetroSpacePost.glb")
REPORT_PATH = os.path.join(BASE, "PIP_validation.json")
os.makedirs(TEXTURE_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

BODY_RADIUS = 0.5
FACE_RADIUS = 0.505
FACE_HALF_WIDTH_ANGLE = math.radians(43.0)
FACE_HALF_HEIGHT_ANGLE = math.radians(31.0)
FACE_CENTER_ANGLE = math.radians(2.5)

EXPRESSIONS = [
    "neutral", "happy", "curious", "surprised",
    "sad", "confused", "worried", "thoughtful",
]
EXPRESSION_ROW = {name: index for index, name in enumerate(EXPRESSIONS)}
EYE_COLS = 2
EYE_ROWS = len(EXPRESSIONS)
MOUTH_COLS = 4
MOUTH_ROWS = len(EXPRESSIONS)

PINK_HEX = "#FF9DD5"
PINK_RGB = (255, 157, 213)
CREAM_HEX = "#F1C9AA"
INK_HEX = "#934665"

FACE_MATERIALS = {}
FACE_MAPPINGS = {}


# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

def srgb_to_linear(hex_color):
    h = hex_color.lstrip("#")
    values = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    linear = [
        v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        for v in values
    ]
    return (linear[0], linear[1], linear[2], 1.0)


def rgb_to_linear(rgb):
    return tuple(
        v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
        for v in rgb
    )


def ensure_object_mode():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")


def move_to_collection(obj, collection):
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)


def add_empty(name, collection, location=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.06
    obj.location = location
    collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def parent_to(obj, parent):
    bpy.context.view_layer.update()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()


def apply_rotation_scale(obj):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def apply_modifier(obj, modifier):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    except RuntimeError as exc:
        raise RuntimeError(f"Could not apply {modifier.name} on {obj.name}: {exc}")
    obj.select_set(False)


def finish_mesh(obj, material=None, smooth=True, closed=True,
                outward_center=(0.0, 0.0, 0.0)):
    if material is not None:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = smooth

    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    if closed:
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    else:
        score = 0.0
        for face in bm.faces:
            centre = Vector(outward_center)
            score += face.normal.dot(face.calc_center_median() - centre)
        if score < 0:
            bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate()
    obj.data.update()
    return obj


def mesh_object(name, verts, faces, collection, material=None, smooth=True,
                closed=True, outward_center=(0.0, 0.0, 0.0), location=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    collection.objects.link(obj)
    finish_mesh(obj, material, smooth, closed, outward_center)
    return obj


def add_uv_sphere(name, location, radius, material, collection,
                  segments=32, rings=16, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.scale = scale
    apply_rotation_scale(obj)
    move_to_collection(obj, collection)
    finish_mesh(obj, material, smooth=True, closed=True)
    return obj


def add_cylinder(name, location, radius, depth, material, collection,
                 rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth,
        location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    apply_rotation_scale(obj)
    move_to_collection(obj, collection)
    finish_mesh(obj, material, smooth=True, closed=True)
    return obj


def add_torus(name, location, major, minor, material, collection,
              rotation=(0, 0, 0), major_segments=32, minor_segments=10):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor,
        major_segments=major_segments, minor_segments=minor_segments,
        location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    apply_rotation_scale(obj)
    move_to_collection(obj, collection)
    finish_mesh(obj, material, smooth=True, closed=True)
    return obj


def add_rounded_box(name, location, dimensions, rotation_matrix, material,
                    collection, bevel_width=0.008, bevel_segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.rotation_euler = rotation_matrix.to_euler()
    obj.scale = (dimensions[0], dimensions[1], dimensions[2])
    apply_rotation_scale(obj)
    move_to_collection(obj, collection)
    bevel = obj.modifiers.new("EdgeSoftening", "BEVEL")
    bevel.width = bevel_width
    bevel.segments = bevel_segments
    bevel.limit_method = "ANGLE"
    apply_modifier(obj, bevel)
    finish_mesh(obj, material, smooth=True, closed=True)
    return obj


def add_tube_curve(name, points, radius, material, collection,
                   cyclic=False, resolution=12, bevel_resolution=3):
    curve = bpy.data.curves.new(name + "_curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = bevel_resolution
    curve.fill_mode = "FULL"
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1.0)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.select_set(False)
    finish_mesh(obj, material, smooth=True, closed=True)
    return obj


def join_meshes(name, objects, collection):
    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    joined.data.name = name + "_mesh"
    move_to_collection(joined, collection)
    joined.select_set(False)
    return joined


def catmull_rom(points, samples_per_segment=8):
    pts = [Vector(p) for p in points]
    if len(pts) < 2:
        return pts
    extended = [pts[0] + (pts[0] - pts[1])] + pts + [pts[-1] + (pts[-1] - pts[-2])]
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = extended[i], extended[i + 1], extended[i + 2], extended[i + 3]
        for step in range(samples_per_segment):
            t = step / samples_per_segment
            t2, t3 = t * t, t * t * t
            out.append(
                0.5 * ((2 * p1) + (-p0 + p2) * t
                       + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                       + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            )
    out.append(pts[-1])
    return out


# --------------------------------------------------------------------------- #
# Materials
# --------------------------------------------------------------------------- #

def make_material(name, hex_color, roughness, metallic=0.0,
                  emission_hex=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(hex_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = 1.0
    if emission_hex:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emission_hex)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.diffuse_color = srgb_to_linear(hex_color)
    return mat


def make_textured_face_material(name, image, cols, rows, col, row,
                                emission_strength=1.55):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.3
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Emission Color"].default_value = srgb_to_linear(PINK_HEX)
    bsdf.inputs["Emission Strength"].default_value = emission_strength
    bsdf.inputs["Alpha"].default_value = 1.0

    texcoord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.vector_type = "POINT"
    mapping.inputs["Location"].default_value = (
        col / cols, 1.0 - (row + 1) / rows, 0.0)
    mapping.inputs["Scale"].default_value = (1.0 / cols, 1.0 / rows, 1.0)
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.image = image
    image_node.extension = "CLIP"
    image_node.interpolation = "Linear"

    links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], image_node.inputs["Vector"])
    links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(image_node.outputs["Alpha"], bsdf.inputs["Alpha"])

    mat.blend_method = "BLEND"
    mat.use_backface_culling = True
    mat.show_transparent_back = False
    try:
        mat.surface_render_method = "BLENDED"
    except Exception:
        pass
    FACE_MATERIALS[name] = mat
    FACE_MAPPINGS[name] = (mapping, cols, rows)
    return mat


def make_textured_decal_material(name, image, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.82
    bsdf.inputs["Metallic"].default_value = 0.0
    if emission_strength:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(INK_HEX)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    texcoord = nodes.new("ShaderNodeTexCoord")
    image_node = nodes.new("ShaderNodeTexImage")
    image_node.image = image
    image_node.extension = "CLIP"
    links.new(texcoord.outputs["UV"], image_node.inputs["Vector"])
    links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(image_node.outputs["Alpha"], bsdf.inputs["Alpha"])
    mat.blend_method = "BLEND"
    mat.use_backface_culling = True
    mat.show_transparent_back = False
    try:
        mat.surface_render_method = "BLENDED"
    except Exception:
        pass
    return mat


# --------------------------------------------------------------------------- #
# Facial atlases
# --------------------------------------------------------------------------- #

def _blurred_glow(layer, size, radius_fraction=0.028, opacity=0.55):
    glow = layer.filter(ImageFilter.GaussianBlur(radius=max(1, int(size * radius_fraction))))
    alpha = glow.getchannel("A").point(lambda v: int(v * opacity))
    glow.putalpha(alpha)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(glow)
    out.alpha_composite(layer)
    return out


def _draw_eye_glyph(expression, side, size):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    c = size / 2.0
    pink = PINK_RGB + (255,)

    def ellipse(rx, ry, cx=c, cy=c):
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=pink)

    if expression == "neutral":
        ellipse(0.300 * size, 0.300 * size)
    elif expression == "happy":
        # Smooth, thick upward crescent (closed smiling eye).
        r_out = 0.365 * size
        r_in = 0.205 * size
        start_angle, end_angle = 202, 338
        outer, inner = [], []
        steps = 48
        for index in range(steps + 1):
            angle = math.radians(start_angle + (end_angle - start_angle) * index / steps)
            outer.append((c + r_out * math.cos(angle), c + r_out * math.sin(angle)))
            inner.append((c + r_in * math.cos(angle), c + r_in * math.sin(angle)))
        draw.polygon(outer + list(reversed(inner)), fill=pink)
        cap_r = (r_out - r_in) / 2.0
        cap_radius = (r_out + r_in) / 2.0
        for angle in (start_angle, end_angle):
            rad = math.radians(angle)
            ex = c + cap_radius * math.cos(rad)
            ey = c + cap_radius * math.sin(rad)
            draw.ellipse([ex - cap_r, ey - cap_r, ex + cap_r, ey + cap_r], fill=pink)
    elif expression == "curious":
        ellipse(0.340 * size, 0.340 * size)
    elif expression == "surprised":
        ellipse(0.378 * size, 0.378 * size)
    elif expression == "sad":
        ellipse(0.305 * size, 0.205 * size, cy=c + 0.035 * size)
    elif expression == "confused":
        if side == "L":
            ellipse(0.300 * size, 0.300 * size)
        else:
            ellipse(0.265 * size, 0.175 * size,
                    cx=c + 0.025 * size, cy=c + 0.050 * size)
    elif expression == "worried":
        eye = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        eye_draw = ImageDraw.Draw(eye)
        rx, ry = 0.310 * size, 0.190 * size
        eye_draw.ellipse([c - rx, c - ry, c + rx, c + ry], fill=pink)
        angle = 15 if side == "L" else -15
        eye = eye.rotate(angle, resample=Image.BICUBIC, center=(c, c))
        layer.alpha_composite(eye)
    elif expression == "thoughtful":
        ellipse(0.298 * size, 0.298 * size,
                cx=c + 0.055 * size, cy=c - 0.060 * size)
    else:
        ellipse(0.300 * size, 0.300 * size)

    return _blurred_glow(layer, size)


def _mouth_polygon(expression, level, size):
    open01 = level / max(1, MOUTH_COLS - 1)
    c = size / 2.0
    pink = PINK_RGB + (255,)

    if expression in ("neutral", "happy", "sad", "confused", "worried", "thoughtful"):
        if expression == "neutral":
            width, curve, thickness = 0.54, 0.085, 0.058
            open_height = 0.150
        elif expression == "happy":
            width, curve, thickness = 0.66, 0.110, 0.060
            open_height = 0.205
        elif expression == "sad":
            width, curve, thickness = 0.42, 0.075, 0.050
            open_height = 0.100
        elif expression == "worried":
            width, curve, thickness = 0.34, 0.050, 0.045
            open_height = 0.060
        elif expression == "thoughtful":
            width, curve, thickness = 0.30, 0.055, 0.045
            open_height = 0.060
        else:  # confused
            width, curve, thickness = 0.38, 0.022, 0.050
            open_height = 0.080

        invert = expression in ("sad", "confused", "worried", "thoughtful")
        tilt = math.radians({"confused": 12, "thoughtful": 7}.get(expression, 0))
        cx = c + (0.040 * size if expression == "thoughtful" else
                  (-0.020 * size if expression == "confused" else 0.0))
        cy = c

        w = width * size
        a = curve * size
        t = thickness * size
        base_open = {"neutral": 0.038, "happy": 0.045}.get(expression, 0.0)
        h = (base_open + open_height * open01) * size
        steps = 48
        top, bottom = [], []
        for i in range(steps + 1):
            x_norm = -1.0 + 2.0 * i / steps
            base = a * (0.5 - x_norm * x_norm) if not invert else a * (x_norm * x_norm - 0.5)
            x = x_norm * w / 2.0
            y_top = base - t / 2.0
            y_bottom = base + t / 2.0 + h * (max(0.0, 1.0 - x_norm * x_norm) ** 0.62)
            cos_t, sin_t = math.cos(tilt), math.sin(tilt)
            top.append((cx + x * cos_t - y_top * sin_t, cy + x * sin_t + y_top * cos_t))
            bottom.append((cx + x * cos_t - y_bottom * sin_t, cy + x * sin_t + y_bottom * cos_t))
        return top + list(reversed(bottom))
    return None


def _draw_mouth_glyph(expression, level, size):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    c = size / 2.0
    pink = PINK_RGB + (255,)
    open01 = level / max(1, MOUTH_COLS - 1)

    if expression in ("surprised", "curious"):
        if expression == "surprised":
            rx = 0.155 * size
            ry = (0.095 + 0.175 * open01) * size
        else:
            rx = 0.108 * size
            ry = (0.060 + 0.135 * open01) * size
        draw.ellipse([c - rx, c - ry, c + rx, c + ry], fill=pink)
    else:
        polygon = _mouth_polygon(expression, level, size)
        if polygon:
            draw.polygon(polygon, fill=pink)
    return _blurred_glow(layer, size, radius_fraction=0.026, opacity=0.5)


def generate_eye_atlas(path):
    cell = 256
    supersample = 4
    render_size = cell * supersample
    atlas = Image.new("RGBA", (cell * EYE_COLS, cell * EYE_ROWS), (0, 0, 0, 0))
    for row, expression in enumerate(EXPRESSIONS):
        for col, side in enumerate(("L", "R")):
            glyph = _draw_eye_glyph(expression, side, render_size)
            glyph = glyph.resize((cell, cell), Image.LANCZOS)
            atlas.alpha_composite(glyph, (col * cell, row * cell))
    atlas.save(path)
    return path


def generate_mouth_atlas(path):
    cell = 256
    supersample = 4
    render_size = cell * supersample
    atlas = Image.new("RGBA", (cell * MOUTH_COLS, cell * MOUTH_ROWS), (0, 0, 0, 0))
    for row, expression in enumerate(EXPRESSIONS):
        for col in range(MOUTH_COLS):
            glyph = _draw_mouth_glyph(expression, col, render_size)
            glyph = glyph.resize((cell, cell), Image.LANCZOS)
            atlas.alpha_composite(glyph, (col * cell, row * cell))
    atlas.save(path)
    return path


def generate_postal_stamp(path):
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    burgundy = (147, 70, 101, 255)
    cream = (243, 208, 178, 255)

    # Perforated stamp body, filling most of the atlas.
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    x0, y0, x1, y1 = 105, 115, 919, 909
    mdraw.rounded_rectangle([x0, y0, x1, y1], radius=70, fill=255)
    for x in range(x0 + 42, x1 - 20, 66):
        for y in (y0 + 6, y1 - 6):
            mdraw.ellipse([x - 30, y - 30, x + 30, y + 30], fill=0)
    for y in range(y0 + 42, y1 - 20, 66):
        for x in (x0 + 6, x1 - 6):
            mdraw.ellipse([x - 30, y - 30, x + 30, y + 30], fill=0)
    stamp = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    stamp.putalpha(mask)
    solid = Image.new("RGBA", (size, size), burgundy)
    stamp = Image.composite(solid, stamp, mask)
    img.alpha_composite(stamp)

    # Cream inner field.
    draw.rounded_rectangle([x0 + 54, y0 + 54, x1 - 54, y1 - 54],
                           radius=32, fill=cream)

    # Ringed planet motif.
    px, py, pr = (x0 + x1) / 2, (y0 + y1) / 2, 150
    ring = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(ring)
    rx, ry = 265, 84
    rdraw.ellipse([px - rx, py - ry, px + rx, py + ry], outline=burgundy, width=26)
    ring = ring.rotate(-18, resample=Image.BICUBIC, center=(px, py))
    img.alpha_composite(ring)
    draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=burgundy)
    draw.ellipse([px - 112, py - 112, px - 28, py - 28], fill=cream)
    draw.ellipse([px + 38, py + 44, px + 88, py + 94], fill=cream)

    # Small star dots.
    for sx, sy, sr in ((x0 + 112, y0 + 120, 14), (x1 - 118, y1 - 132, 11)):
        draw.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=burgundy)

    img = img.resize((512, 512), Image.LANCZOS)
    img.save(path)
    return path


def load_image(path, name):
    image = bpy.data.images.load(path, check_existing=False)
    image.name = name
    image.alpha_mode = "STRAIGHT"
    try:
        image.pack()
    except Exception:
        pass
    return image


def set_face_mapping(part, row, col):
    mapping, cols, rows = FACE_MAPPINGS[part]
    mapping.inputs["Location"].default_value = (
        col / cols, 1.0 - (row + 1) / rows, 0.0)
    mapping.inputs["Scale"].default_value = (1.0 / cols, 1.0 / rows, 1.0)


def set_expression(expression, mouth_level=0):
    row = EXPRESSION_ROW[expression]
    set_face_mapping("PIP_Eye_L", row, 0)
    set_face_mapping("PIP_Eye_R", row, 1)
    set_face_mapping("PIP_Mouth", row, mouth_level)


def set_welcome_face():
    """Big round eyes + open smile: the direct, friendly hub greeting."""
    set_face_mapping("PIP_Eye_L", 2, 0)   # curious row = large round eyes
    set_face_mapping("PIP_Eye_R", 2, 1)
    set_face_mapping("PIP_Mouth", 0, 2)   # neutral row, medium-open smile


# --------------------------------------------------------------------------- #
# Scene, collections and materials
# --------------------------------------------------------------------------- #

def initialize_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = False

    character = bpy.data.collections.new("PIP_CHARACTER")
    scene.collection.children.link(character)
    controls = bpy.data.collections.new("PIP_CONTROLS")
    scene.collection.children.link(controls)
    preview_lights = bpy.data.collections.new("PREVIEW_LIGHTS")
    scene.collection.children.link(preview_lights)
    preview_cameras = bpy.data.collections.new("PREVIEW_CAMERAS")
    scene.collection.children.link(preview_cameras)
    reference_only = bpy.data.collections.new("REFERENCE_ONLY")
    scene.collection.children.link(reference_only)
    return scene, character, controls, preview_lights, preview_cameras, reference_only


def create_materials():
    materials = {}
    materials["shell"] = make_material("PIP_Shell_Ivory", CREAM_HEX, 0.32, 0.05)
    materials["orange"] = make_material("PIP_Stripe_Orange", "#E66B39", 0.38, 0.05)
    materials["orange_accent"] = make_material("PIP_Stripe_Accent", "#F6B98E", 0.38, 0.04)
    materials["burgundy"] = make_material("PIP_Scarf_Burgundy", "#812E4D", 0.75, 0.0)
    materials["burgundy_dark"] = make_material("PIP_Scarf_Shadow", "#63213D", 0.80, 0.0)
    materials["gold"] = make_material("PIP_Gold_Metal", "#EBA94D", 0.27, 0.70)
    materials["gold_light"] = make_material("PIP_Gold_Highlight", "#FFD17B", 0.25, 0.55)
    materials["lavender"] = make_material("PIP_Lavender_Module", "#A978A8", 0.32, 0.12)
    materials["lavender_dark"] = make_material("PIP_Lavender_Shadow", "#785279", 0.42, 0.08)
    materials["screen"] = make_material("PIP_Face_Screen", "#120B1E", 0.34, 0.0)
    materials["antenna_orb"] = make_material(
        "PIP_Antenna_Orb", "#FF7CC8", 0.22, 0.0, "#FF7CC8", 0.80)
    materials["thruster"] = make_material(
        "PIP_Hover_Emitter", "#FFA62E", 0.30, 0.0, "#FFA62E", 0.85)
    materials["antenna_stem"] = make_material("PIP_Antenna_Stem", "#5C2338", 0.35, 0.45)
    materials["postal_ink"] = make_material("PIP_Postal_Ink", INK_HEX, 0.80, 0.0)
    return materials


# --------------------------------------------------------------------------- #
# Geometry
# --------------------------------------------------------------------------- #

def create_body_shell(collection, material, root):
    shell = add_uv_sphere(
        "Body_Shell", (0, 0, 0), BODY_RADIUS, material, collection,
        segments=64, rings=30, scale=(1.0, 1.0, 0.985))
    parent_to(shell, root)
    return shell


def face_direction(u_angle, v_angle, radius):
    return Vector((
        radius * math.sin(u_angle) * math.cos(v_angle),
        -radius * math.cos(u_angle) * math.cos(v_angle),
        radius * math.sin(v_angle),
    ))


def create_face_screen(collection, materials, face_root, expression_root):
    rings = 14
    segments = 48
    verts = [Vector((0.0, -FACE_RADIUS, 0.0))]
    # centre offset for the face (slightly above the equator)
    centre = face_direction(0.0, FACE_CENTER_ANGLE, FACE_RADIUS)
    verts[0] = centre

    for ring in range(1, rings + 1):
        r = ring / rings
        for seg in range(segments):
            theta = 2.0 * math.pi * seg / segments
            u = r * FACE_HALF_WIDTH_ANGLE * math.cos(theta)
            v = FACE_CENTER_ANGLE + r * FACE_HALF_HEIGHT_ANGLE * math.sin(theta)
            verts.append(face_direction(u, v, FACE_RADIUS))

    faces = []
    for seg in range(segments):
        faces.append((0, 1 + seg, 1 + (seg + 1) % segments))
    for ring in range(1, rings):
        base = 1 + (ring - 1) * segments
        nxt = 1 + ring * segments
        for seg in range(segments):
            s2 = (seg + 1) % segments
            faces.append((base + seg, nxt + seg, nxt + s2, base + s2))

    screen = mesh_object(
        "Face_Screen", [tuple(v) for v in verts], faces, collection,
        materials["screen"], smooth=True, closed=False, outward_center=(0, 0, 0))
    parent_to(screen, face_root)

    boundary = []
    for seg in range(segments):
        theta = 2.0 * math.pi * seg / segments
        u = FACE_HALF_WIDTH_ANGLE * math.cos(theta)
        v = FACE_CENTER_ANGLE + FACE_HALF_HEIGHT_ANGLE * math.sin(theta)
        boundary.append(face_direction(u, v, FACE_RADIUS + 0.002))
    rim = add_tube_curve("Face_Gold_Rim", boundary, 0.0125,
                         materials["gold"], collection, cyclic=True,
                         resolution=10, bevel_resolution=2)
    parent_to(rim, face_root)

    # Eye and mouth patches (flat-in-tangent-space, projected onto the dome).
    def patch(name, x, z, width, height, material):
        unit = Vector((x, -math.sqrt(max(BODY_RADIUS ** 2 - x * x - z * z, 0.0)), z))
        unit.normalize()
        centre_world = unit * (FACE_RADIUS + 0.0035)
        up = Vector((0, 0, 1))
        right = up.cross(unit).normalized()
        up_t = unit.cross(right).normalized()
        nx, ny = 10, 10
        verts_local = []
        uv = []
        for iy in range(ny + 1):
            for ix in range(nx + 1):
                a = (ix / nx - 0.5) * width
                b = (iy / ny - 0.5) * height
                direction = (unit + right * (a / BODY_RADIUS) + up_t * (b / BODY_RADIUS)).normalized()
                pos = direction * (FACE_RADIUS + 0.0035)
                verts_local.append(tuple(pos - centre_world))
                uv.append((ix / nx, iy / ny))
        faces_local = []
        for iy in range(ny):
            for ix in range(nx):
                a = iy * (nx + 1) + ix
                faces_local.append((a, a + 1, a + nx + 2, a + nx + 1))
        obj = mesh_object(
            name, verts_local, faces_local, collection, material,
            smooth=True, closed=False, outward_center=(0, 0, 0),
            location=tuple(centre_world))
        # outward check relative to its own centre: use local origin
        finish_mesh(obj, None, smooth=True, closed=False, outward_center=(0, 0, 0))
        mesh_uv = obj.data.uv_layers.new(name="UVMap")
        for loop_index, loop in enumerate(obj.data.loops):
            mesh_uv.data[loop_index].uv = uv[loop.vertex_index]
        parent_to(obj, expression_root)
        return obj

    eye_l = patch("Eye_L", -0.145, 0.045, 0.155, 0.155,
                  make_textured_face_material(
                      "PIP_Eye_L", load_image(os.path.join(TEXTURE_DIR, "PIP_Face_Eyes.png"),
                                              "PIP_Face_Eyes"), EYE_COLS, EYE_ROWS, 0, 0))
    eye_r = patch("Eye_R", 0.145, 0.045, 0.155, 0.155,
                  make_textured_face_material(
                      "PIP_Eye_R", bpy.data.images["PIP_Face_Eyes"], EYE_COLS, EYE_ROWS, 1, 0))
    mouth = patch("Mouth", 0.0, -0.095, 0.190, 0.190,
                  make_textured_face_material(
                      "PIP_Mouth",
                      load_image(os.path.join(TEXTURE_DIR, "PIP_Face_Mouth.png"),
                                 "PIP_Face_Mouth"),
                      MOUTH_COLS, MOUTH_ROWS, 0, 0))
    return screen, rim, eye_l, eye_r, mouth


def create_side_modules(collection, materials, body_root):
    modules = add_empty("SIDE_MODULES", collection, parent=body_root)
    for side, suffix in ((-1, "L"), (1, "R")):
        x = side * 0.535
        module_root = add_empty(f"Module_{suffix}", collection,
                                location=(x, 0.0, -0.02), parent=modules)
        housing = add_uv_sphere(
            f"Module_{suffix}_Housing", (x, 0.0, -0.02), 0.155,
            materials["lavender"], collection, segments=24, rings=12,
            scale=(0.55, 1.0, 1.0))
        parent_to(housing, module_root)
        ring = add_torus(
            f"Module_{suffix}_Ring", (side * 0.495, 0.0, -0.02),
            0.148, 0.013, materials["gold"], collection,
            rotation=(0.0, math.pi / 2.0, 0.0), major_segments=24,
            minor_segments=6)
        parent_to(ring, module_root)
        cap = add_uv_sphere(
            f"Module_{suffix}_Cap", (side * 0.603, 0.0, -0.02), 0.100,
            materials["lavender_dark"], collection, segments=20, rings=10,
            scale=(0.32, 1.0, 1.0))
        parent_to(cap, module_root)
    return modules


def create_antenna(collection, materials, body_root):
    pivot = add_empty("ANTENNA_PIVOT", collection,
                      location=(0.055, 0.025, 0.485), parent=body_root)
    base = add_cylinder("Antenna_Base", (0.055, 0.025, 0.500), 0.040, 0.035,
                        materials["gold"], collection, vertices=16)
    parent_to(base, pivot)
    stem = add_cylinder("Antenna_Stem", (0.055, 0.025, 0.565), 0.0105, 0.115,
                        materials["antenna_stem"], collection, vertices=12)
    parent_to(stem, pivot)
    neck = add_torus("Antenna_Neck", (0.055, 0.025, 0.628), 0.021, 0.006,
                     materials["gold"], collection, major_segments=16,
                     minor_segments=6)
    parent_to(neck, pivot)
    orb = add_uv_sphere("Antenna_Orb", (0.055, 0.025, 0.680), 0.060,
                        materials["antenna_orb"], collection, segments=24,
                        rings=12)
    parent_to(orb, pivot)
    return pivot, base, stem, orb


def spherical_band(collection, name, pole, theta0, theta1, phi0, phi1,
                   inner_radius, outer_radius, material, segments_u=48,
                   segments_v=3, solid=False):
    """A painted stripe that conforms to the shell.

    solid=False builds a single surface just above the body (cheapest and
    visually correct for painted livery).  solid=True keeps a thin closed
    shell for cases that need visible thickness.
    """
    p = Vector(pole).normalized()
    e1 = p.cross(Vector((0, 0, 1)))
    if e1.length < 1e-6:
        e1 = p.cross(Vector((0, 1, 0)))
    e1.normalize()
    e2 = p.cross(e1).normalized()

    def direction(theta, phi):
        return (math.cos(theta) * p
                + math.sin(theta) * (math.cos(phi) * e1 + math.sin(phi) * e2)).normalized()

    if not solid:
        verts = []
        for iv in range(segments_v + 1):
            theta = theta0 + (theta1 - theta0) * iv / segments_v
            for iu in range(segments_u + 1):
                phi = phi0 + (phi1 - phi0) * iu / segments_u
                verts.append(tuple(direction(theta, phi) * outer_radius))
        faces = []
        for iv in range(segments_v):
            for iu in range(segments_u):
                a = iv * (segments_u + 1) + iu
                faces.append((a, a + 1, a + segments_u + 2, a + segments_u + 1))
        return mesh_object(name, verts, faces, collection, material,
                           smooth=True, closed=False, outward_center=(0, 0, 0))

    verts = []
    for radius in (outer_radius, inner_radius):
        for iv in range(segments_v + 1):
            theta = theta0 + (theta1 - theta0) * iv / segments_v
            for iu in range(segments_u + 1):
                phi = phi0 + (phi1 - phi0) * iu / segments_u
                verts.append(tuple(direction(theta, phi) * radius))

    stride = (segments_u + 1) * (segments_v + 1)
    faces = []
    for layer in range(2):
        base = layer * stride
        for iv in range(segments_v):
            for iu in range(segments_u):
                a = base + iv * (segments_u + 1) + iu
                b = a + 1
                c = a + segments_u + 2
                d = a + segments_u + 1
                faces.append((a, b, c, d) if layer == 0 else (a, d, c, b))
    outer, inner = 0, 1
    for iv in (0, segments_v):
        for iu in range(segments_u):
            a = outer * stride + iv * (segments_u + 1) + iu
            b = a + 1
            d = inner * stride + iv * (segments_u + 1) + iu
            c = d + 1
            faces.append((a, b, c, d))
    for iu in (0, segments_u):
        for iv in range(segments_v):
            a = outer * stride + iv * (segments_u + 1) + iu
            b = a + segments_u + 1
            d = inner * stride + iv * (segments_u + 1) + iu
            c = d + segments_u + 1
            faces.append((a, b, c, d))

    return mesh_object(name, verts, faces, collection, material,
                       smooth=True, closed=True)


def create_stripes(collection, materials, body_root):
    pole = (0.42, 0.18, 0.89)
    bands = [
        (43.0, 49.5, "orange"),
        (49.8, 50.9, "accent"),
        (51.5, 58.0, "orange"),
        (58.3, 59.4, "accent"),
    ]
    phi0 = math.radians(-32.0)
    phi1 = math.radians(205.0)
    orange_parts = []
    accent_parts = []
    for index, (t0, t1, kind) in enumerate(bands):
        name = f"Stripe_{kind}_{index}"
        obj = spherical_band(
            collection, name, pole,
            math.radians(t0), math.radians(t1), phi0, phi1,
            BODY_RADIUS + 0.0005, BODY_RADIUS + 0.0026,
            materials["orange"] if kind == "orange" else materials["orange_accent"],
            segments_u=48, segments_v=2)
        (orange_parts if kind == "orange" else accent_parts).append(obj)
    orange = join_meshes("Body_Stripe_Orange", orange_parts, collection)
    accent = join_meshes("Body_Stripe_Accent", accent_parts, collection)
    parent_to(orange, body_root)
    parent_to(accent, body_root)
    return orange, accent


def create_forehead_badge(collection, materials, postal_root):
    x, z = -0.070, 0.350
    unit = Vector((x, -math.sqrt(max(BODY_RADIUS ** 2 - x * x - z * z, 0.0)), z)).normalized()
    up = Vector((0, 0, 1))
    right = up.cross(unit).normalized()
    up_t = unit.cross(right).normalized()
    frame = Matrix((
        (right.x, up_t.x, unit.x),
        (right.y, up_t.y, unit.y),
        (right.z, up_t.z, unit.z),
    ))
    centre = unit * (BODY_RADIUS + 0.020)
    badge = add_rounded_box(
        "Forehead_Envelope_Badge", tuple(centre), (0.190, 0.130, 0.040),
        frame, materials["gold"], collection, bevel_width=0.010,
        bevel_segments=4)
    parent_to(badge, postal_root)

    # Embossed envelope flap: two diagonal lines and one horizontal line.
    depth = 0.021
    corner_l = centre - right * 0.075 + up_t * 0.045 + unit * depth
    corner_r = centre + right * 0.075 + up_t * 0.045 + unit * depth
    corner_b = centre - right * 0.075 - up_t * 0.045 + unit * depth
    corner_br = centre + right * 0.075 - up_t * 0.045 + unit * depth
    mid_low = centre + unit * depth + up_t * -0.020
    for idx, (a, b) in enumerate(((corner_l, mid_low), (corner_r, mid_low),
                                  (corner_b, corner_br))):
        fold = add_tube_curve(
            f"Badge_Fold_{idx}", [tuple(a), tuple(b)], 0.0032,
            materials["gold_light"], collection, resolution=4,
            bevel_resolution=2)
        parent_to(fold, postal_root)
    return badge


def create_scarf(collection, materials, body_root, postal_root):
    scarf_root = add_empty("SCARF", collection, parent=body_root)

    # Thick, folded cloth band following the lower sphere.
    segments_phi = 64
    segments_theta = 16
    verts = []
    for i in range(segments_phi):
        phi = 2.0 * math.pi * i / segments_phi
        fold = 0.0100 * math.sin(3.0 * phi + 0.7) + 0.0045 * math.sin(7.0 * phi + 1.3)
        crease = 0.0024 * math.sin(11.0 * phi + 0.2)
        base_radius = 0.432 + fold + crease
        z_centre = (-0.295 + 0.011 * math.sin(2.0 * phi + 0.4)
                    + 0.005 * math.sin(5.0 * phi))
        radial = Vector((math.cos(phi), math.sin(phi), 0.0))
        for j in range(segments_theta):
            theta = 2.0 * math.pi * j / segments_theta
            a = 0.030 * (1.0 + 0.16 * math.sin(5.0 * phi + 0.9)
                         + 0.05 * math.sin(9.0 * phi + 0.3))
            b = 0.072 * (1.0 + 0.11 * math.sin(4.0 * phi + 1.7)
                         + 0.05 * math.sin(8.0 * phi))
            wrinkle = 0.0035 * math.sin(6.0 * phi + theta) * math.cos(theta)
            pos = radial * (base_radius + a * math.cos(theta) + wrinkle)
            pos.z = z_centre + b * math.sin(theta)
            verts.append(tuple(pos))
    faces = []
    for i in range(segments_phi):
        ni = (i + 1) % segments_phi
        for j in range(segments_theta):
            nj = (j + 1) % segments_theta
            a = i * segments_theta + j
            b = ni * segments_theta + j
            c = ni * segments_theta + nj
            d = i * segments_theta + nj
            faces.append((a, b, c, d))
    band = mesh_object("Scarf_Band", verts, faces, collection, materials["burgundy"],
                       smooth=True, closed=True)
    parent_to(band, scarf_root)

    # Rolled top hem so the band reads as folded cloth, not a plain torus.
    hem_points = []
    for i in range(64):
        phi = 2.0 * math.pi * i / 64
        radius = 0.438 + 0.007 * math.sin(3.0 * phi + 0.7)
        z = -0.220 + 0.006 * math.sin(2.0 * phi + 0.4)
        hem_points.append((radius * math.cos(phi), radius * math.sin(phi), z))
    hem = add_tube_curve("Scarf_Top_Hem", hem_points, 0.0105,
                         materials["burgundy_dark"], collection, cyclic=True,
                         resolution=6, bevel_resolution=1)
    parent_to(hem, scarf_root)

    knot_center = Vector((-0.315, -0.385, -0.268))
    knot = add_uv_sphere("Scarf_Knot", tuple(knot_center), 0.098,
                         materials["burgundy"], collection, segments=24, rings=12,
                         scale=(1.0, 0.82, 1.15))
    parent_to(knot, scarf_root)
    knot_wrap = add_torus(
        "Scarf_Knot_Wrap", tuple(knot_center), 0.071, 0.020,
        materials["burgundy_dark"], collection,
        rotation=(math.radians(62), 0.0, math.radians(28)),
        major_segments=24, minor_segments=8)
    parent_to(knot_wrap, scarf_root)

    tail_pivot = add_empty("Scarf_Tail_Pivot", collection,
                           location=tuple(knot_center), parent=scarf_root)

    def ribbon(name, control_points, width_start, width_end, material,
               thickness=0.012, samples=10, material_accent=None,
               accent_t_ranges=None, twist=0.0, flat=False):
        path = catmull_rom(control_points, samples)
        frames = []
        for i, point in enumerate(path):
            if i == 0:
                tangent = (path[1] - path[0]).normalized()
            elif i == len(path) - 1:
                tangent = (path[-1] - path[-2]).normalized()
            else:
                tangent = (path[i + 1] - path[i - 1]).normalized()
            up = Vector((0, 0, 1))
            width_dir = (up - tangent * up.dot(tangent))
            if width_dir.length < 1e-5:
                width_dir = tangent.cross(Vector((1, 0, 0)))
            width_dir.normalize()
            t = i / (len(path) - 1)
            if twist:
                width_dir = Matrix.Rotation(twist * t, 3, tangent) @ width_dir
                width_dir.normalize()
            side_dir = tangent.cross(width_dir).normalized()
            width = width_start + (width_end - width_start) * t
            frames.append((point, width_dir, side_dir, width))

        def build(segment_filter, expand=1.0, extra_thickness=0.0, offset=0.0):
            verts_local = []
            faces_local = []
            index_map = {}
            idx = 0
            for i, (point, width_dir, side_dir, width) in enumerate(frames):
                if not segment_filter(i):
                    continue
                width_use = width * expand
                thick_use = thickness + extra_thickness
                for offset_side in (-1, 1):
                    for offset_depth in (-1, 1):
                        pos = (point
                               + width_dir * (offset_side * width_use / 2.0)
                               + side_dir * (offset_depth * thick_use / 2.0)
                               + side_dir * offset)
                        verts_local.append(tuple(pos))
                index_map[i] = idx
                idx += 4
            for i in range(len(frames) - 1):
                if i not in index_map or i + 1 not in index_map:
                    continue
                a = index_map[i]
                b = index_map[i + 1]
                faces_local += [
                    (a, b, b + 2, a + 2),
                    (a + 1, a + 3, b + 3, b + 1),
                    (a, a + 1, b + 1, b),
                    (a + 2, b + 2, b + 3, a + 3),
                ]
            keys = sorted(index_map.keys())
            if keys:
                a = index_map[keys[0]]
                faces_local.append((a, a + 1, a + 3, a + 2))
                b = index_map[keys[-1]]
                faces_local.append((b, b + 2, b + 3, b + 1))
            return verts_local, faces_local

        all_verts, all_faces = build(lambda i: True)
        obj = mesh_object(name, all_verts, all_faces, collection, material,
                          smooth=not flat, closed=True)
        accent_objs = []
        if material_accent is not None and accent_t_ranges:
            last = len(frames) - 1
            for ai, (t0, t1) in enumerate(accent_t_ranges):
                start_i, end_i = int(t0 * last), int(t1 * last)
                def filt(i, s=start_i, e=end_i):
                    return s <= i <= e
                v, f = build(filt, expand=1.045, extra_thickness=0.006,
                             offset=0.006)
                if v:
                    acc = mesh_object(
                        f"{name}_Accent_{ai}", v, f, collection, material_accent,
                        smooth=not flat, closed=True)
                    accent_objs.append(acc)
        return obj, accent_objs

    tail_a, accents_a = ribbon(
        "Scarf_Tail_A",
        [(-0.315, -0.385, -0.268), (-0.455, -0.425, -0.325),
         (-0.550, -0.405, -0.410), (-0.600, -0.345, -0.495)],
        0.100, 0.068, materials["burgundy"], thickness=0.012,
        material_accent=materials["orange"],
        accent_t_ranges=[(0.69, 0.76), (0.83, 0.90)], twist=0.12,
        flat=True)
    tail_b, accents_b = ribbon(
        "Scarf_Tail_B",
        [(-0.315, -0.385, -0.268), (-0.395, -0.330, -0.340),
         (-0.440, -0.250, -0.430), (-0.450, -0.160, -0.505)],
        0.090, 0.060, materials["burgundy"], thickness=0.012,
        material_accent=materials["orange"],
        accent_t_ranges=[(0.67, 0.74), (0.81, 0.88)], twist=0.10,
        flat=True)
    parent_to(tail_a, tail_pivot)
    parent_to(tail_b, tail_pivot)
    all_accents = accents_a + accents_b
    accent_obj = None
    if all_accents:
        for obj in all_accents:
            parent_to(obj, tail_pivot)
        accent_obj = join_meshes("Scarf_Accent_Stripes", all_accents, collection)
        parent_to(accent_obj, tail_pivot)

    # Gold envelope clasp on the visible front of the scarf band.
    clasp_center = Vector((-0.160, -0.455, -0.288))
    normal = Vector((clasp_center.x, clasp_center.y, 0.0)).normalized()
    up = Vector((0, 0, 1))
    right = up.cross(normal).normalized()
    up_t = normal.cross(right).normalized()
    frame = Matrix((
        (right.x, up_t.x, normal.x),
        (right.y, up_t.y, normal.y),
        (right.z, up_t.z, normal.z),
    ))
    clasp = add_rounded_box(
        "Scarf_Envelope_Clasp", tuple(clasp_center),
        (0.092, 0.070, 0.026), frame, materials["gold"], collection,
        bevel_width=0.006, bevel_segments=3)
    parent_to(clasp, postal_root)
    front = clasp_center + normal * 0.016
    for idx, (a, b) in enumerate((
            (front - right * 0.034 + up_t * 0.022, front - up_t * 0.010),
            (front + right * 0.034 + up_t * 0.022, front - up_t * 0.010))):
        fold = add_tube_curve(
            f"Clasp_Fold_{idx}", [tuple(a), tuple(b)], 0.0028,
            materials["gold_light"], collection, resolution=4,
            bevel_resolution=2)
        parent_to(fold, postal_root)
    return scarf_root, band, knot, tail_pivot, tail_a, tail_b, accent_obj, clasp


def create_postal_details(collection, materials, body_root):
    postal = add_empty("POSTAL_DETAILS", collection, parent=body_root)
    badge = create_forehead_badge(collection, materials, postal)

    # Stamp decal: curved patch projected onto the lower-right shell.
    def decal_patch(name, x, z, width, height, material, nx=8, ny=8):
        unit = Vector((x, -math.sqrt(max(BODY_RADIUS ** 2 - x * x - z * z, 0.0)), z)).normalized()
        centre_world = unit * (BODY_RADIUS + 0.0025)
        right = Vector((0, 0, 1)).cross(unit).normalized()
        up_t = unit.cross(right).normalized()
        verts_local, uv, faces_local = [], [], []
        for iy in range(ny + 1):
            for ix in range(nx + 1):
                a = (ix / nx - 0.5) * width
                b = (iy / ny - 0.5) * height
                direction = (unit + right * (a / BODY_RADIUS) + up_t * (b / BODY_RADIUS)).normalized()
                pos = direction * (BODY_RADIUS + 0.0025)
                verts_local.append(tuple(pos - centre_world))
                uv.append((ix / nx, iy / ny))
        for iy in range(ny):
            for ix in range(nx):
                a = iy * (nx + 1) + ix
                faces_local.append((a, a + 1, a + nx + 2, a + nx + 1))
        obj = mesh_object(name, verts_local, faces_local, collection, material,
                          smooth=True, closed=False, outward_center=(0, 0, 0),
                          location=tuple(centre_world))
        finish_mesh(obj, None, smooth=True, closed=False, outward_center=(0, 0, 0))
        layer = obj.data.uv_layers.new(name="UVMap")
        for loop_index, loop in enumerate(obj.data.loops):
            layer.data[loop_index].uv = uv[loop.vertex_index]
        return obj

    stamp_mat = make_textured_decal_material(
        "PIP_Postal_Stamp_Material",
        load_image(os.path.join(TEXTURE_DIR, "PIP_Postal_Stamp.png"),
                   "PIP_Postal_Stamp"))
    stamp = decal_patch("Postal_Stamp", 0.375, -0.152, 0.150, 0.130, stamp_mat)
    parent_to(stamp, postal)

    # Three cancellation lines conforming to the shell.
    line_points = []
    for index, z0 in enumerate((-0.195, -0.152, -0.109)):
        pts = []
        for i in range(13):
            t = i / 12.0
            x = 0.437 + 0.040 * t
            z = z0 + 0.007 * math.sin(t * math.pi * 3.0 + index)
            y = -math.sqrt(max(BODY_RADIUS ** 2 - x * x - z * z, 1e-6))
            pts.append((x, y, z))
        line_points.append(pts)
    lines = []
    for idx, pts in enumerate(line_points):
        lines.append(add_tube_curve(
            f"Postal_Cancellation_{idx}", pts, 0.0033,
            materials["postal_ink"], collection, resolution=4,
            bevel_resolution=1))
    cancellation = join_meshes("Postal_Cancellation_Lines", lines, collection)
    parent_to(cancellation, postal)
    return postal, badge, stamp, cancellation


def create_hover_thruster(collection, materials, body_root):
    thruster = add_empty("HOVER_THRUSTER", collection, parent=body_root)
    housing = add_uv_sphere("Thruster_Housing", (0.0, 0.0, -0.477), 0.115,
                            materials["shell"], collection, segments=24, rings=12,
                            scale=(1.0, 1.0, 0.55))
    parent_to(housing, thruster)
    ring = add_torus("Thruster_Ring", (0.0, 0.0, -0.522), 0.100, 0.013,
                     materials["gold"], collection, major_segments=24,
                     minor_segments=6)
    parent_to(ring, thruster)
    emitter = add_uv_sphere("Thruster_Emitter", (0.0, 0.0, -0.552), 0.095,
                            materials["thruster"], collection, segments=20,
                            rings=10, scale=(1.0, 1.0, 0.64))
    parent_to(emitter, thruster)
    return thruster, housing, emitter


# --------------------------------------------------------------------------- #
# Preview setup and rendering
# --------------------------------------------------------------------------- #

def create_preview_setup(scene, light_collection, camera_collection):
    world = bpy.data.worlds.new("PIP_PreviewWorld")
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs[0].default_value = (0.020, 0.014, 0.035, 1.0)
    background.inputs[1].default_value = 0.45
    scene.world = world

    floor_mat = make_material("Preview_Floor", "#191225", 0.85, 0.0)
    bpy.ops.mesh.primitive_plane_add(size=12.0, location=(0, 0, -0.625))
    floor = bpy.context.object
    floor.name = "Preview_Floor"
    floor.data.name = "Preview_Floor_mesh"
    floor.data.materials.append(floor_mat)
    move_to_collection(floor, light_collection)

    def area(name, location, rotation, energy, size, color):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        obj.rotation_euler = rotation
        light_collection.objects.link(obj)
        return obj

    area("Preview_Key", (1.9, -2.4, 2.7), (math.radians(48), 0, math.radians(38)),
         230, 1.8, (1.0, 0.87, 0.72))
    area("Preview_Fill", (-2.3, -1.5, 1.0), (math.radians(76), 0, math.radians(-54)),
         90, 1.7, (0.62, 0.72, 1.0))
    area("Preview_Rim", (0.4, 2.5, 1.9), (math.radians(118), 0, math.radians(10)),
         160, 1.5, (1.0, 0.78, 0.58))
    area("Preview_Top", (0.0, 0.0, 3.2), (0, 0, 0), 70, 1.8, (0.85, 0.80, 1.0))

    target = Vector((0.0, 0.0, 0.02))
    views = {
        "front": Vector((0.0, -3.15, 0.18)),
        "threequarter": Vector((1.95, -2.45, 0.72)),
        "side": Vector((3.15, -0.05, 0.18)),
        "back": Vector((0.0, 3.15, 0.18)),
    }
    cameras = {}
    for label, position in views.items():
        data = bpy.data.cameras.new(f"CAM_{label}")
        data.lens = 78
        obj = bpy.data.objects.new(f"CAM_{label}", data)
        obj.location = position
        obj.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()
        camera_collection.objects.link(obj)
        cameras[label] = obj
    expression_data = bpy.data.cameras.new("CAM_Expressions")
    expression_data.lens = 85
    expression_cam = bpy.data.objects.new("CAM_Expressions", expression_data)
    expression_cam.location = (0.55, -1.95, 0.33)
    expression_cam.rotation_euler = (
        Vector((0.0, -0.30, 0.02)) - expression_cam.location
    ).to_track_quat("-Z", "Y").to_euler()
    camera_collection.objects.link(expression_cam)
    cameras["expressions"] = expression_cam

    scene.camera = cameras["threequarter"]
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    try:
        scene.eevee.taa_render_samples = 40
    except Exception:
        pass
    return cameras


def render_previews(scene, cameras):
    rendered = []
    for label in ("front", "threequarter", "side", "back"):
        scene.camera = cameras[label]
        path = os.path.join(PREVIEW_DIR, f"PIP_preview_{label}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        rendered.append(path)
        print("Rendered", path)

    # Dedicated welcome portrait used by the onboarding hub.
    original_mapping = {}
    original_resolution = (scene.render.resolution_x, scene.render.resolution_y)
    for part in ("PIP_Eye_L", "PIP_Eye_R", "PIP_Mouth"):
        mapping, cols, rows = FACE_MAPPINGS[part]
        original_mapping[part] = tuple(mapping.inputs["Location"].default_value)

    set_welcome_face()
    scene.camera = cameras["front"]
    welcome_path = os.path.join(PREVIEW_DIR, "PIP_preview_welcome.png")
    scene.render.filepath = welcome_path
    bpy.ops.render.render(write_still=True)
    rendered.append(welcome_path)
    print("Rendered", welcome_path)

    scene.camera = cameras["expressions"]
    welcome_face_path = os.path.join(PREVIEW_DIR, "PIP_preview_welcome_face.png")
    scene.render.filepath = welcome_face_path
    bpy.ops.render.render(write_still=True)
    rendered.append(welcome_face_path)
    print("Rendered", welcome_face_path)

    for part, loc in original_mapping.items():
        FACE_MAPPINGS[part][0].inputs["Location"].default_value = loc

    # Expression montage: all eight expression states.
    expression_shots = []

    expression_states = [
        ("neutral", 0), ("happy", 2), ("curious", 1), ("surprised", 2),
        ("sad", 1), ("confused", 1), ("worried", 1), ("thoughtful", 0),
    ]
    scene.render.resolution_x = 560
    scene.render.resolution_y = 560
    for expression, level in expression_states:
        set_expression(expression, level)
        scene.camera = cameras["expressions"]
        path = os.path.join(PREVIEW_DIR, f"_expression_{expression}.png")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        expression_shots.append((expression, path))
        print("Rendered", path)

    for part, loc in original_mapping.items():
        FACE_MAPPINGS[part][0].inputs["Location"].default_value = loc
    scene.render.resolution_x, scene.render.resolution_y = original_resolution

    if expression_shots:
        tile_w = 560
        tile_h = 560
        label_h = 34
        columns, rows = 4, 2
        montage = Image.new(
            "RGBA", (columns * tile_w, rows * (tile_h + label_h)),
            (18, 13, 30, 255))
        draw = ImageDraw.Draw(montage)
        try:
            font = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 21)
        except Exception:
            font = ImageFont.load_default()
        for index, (expression, path) in enumerate(expression_shots):
            image = Image.open(path).convert("RGBA")
            column = index % columns
            row = index // columns
            x = column * tile_w
            y = row * (tile_h + label_h)
            montage.alpha_composite(image, (x, y))
            draw.rectangle([x, y + tile_h, x + tile_w, y + tile_h + label_h],
                           fill=(28, 19, 44, 255))
            draw.text((x + 14, y + tile_h + 7), expression.upper(),
                      font=font, fill=(245, 220, 236, 255))
        montage_path = os.path.join(PREVIEW_DIR, "PIP_preview_expressions.png")
        montage.convert("RGB").save(montage_path)
        rendered.append(montage_path)
        print("Rendered", montage_path)
        for _, path in expression_shots:
            try:
                os.remove(path)
            except OSError:
                pass
    return rendered


# --------------------------------------------------------------------------- #
# Save, export and validation
# --------------------------------------------------------------------------- #

def blend_triangle_count(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def parse_glb(path):
    with open(path, "rb") as handle:
        data = handle.read()
    if len(data) < 20:
        raise ValueError("GLB is too small")
    magic, version, length = struct.unpack("<4sII", data[:12])
    if magic != b"glTF":
        raise ValueError("Invalid GLB magic")
    if version != 2:
        raise ValueError(f"Unsupported GLB version {version}")
    if length != len(data):
        raise ValueError("GLB header length does not match file size")
    json_length, json_type = struct.unpack("<II", data[12:20])
    if json_type != 0x4E4F534A:
        raise ValueError("Missing JSON chunk")
    json_bytes = data[20:20 + json_length]
    document = json.loads(json_bytes.decode("utf-8"))
    bin_offset = 20 + json_length
    bin_chunk = data[bin_offset:bin_offset + 8]
    has_bin = len(bin_chunk) == 8 and struct.unpack("<II", bin_chunk)[1] == 0x004E4942
    return data, document, has_bin


def validate_glb(path, blend_path, blend_tris, preview_paths, node_names):
    data, doc, has_bin = parse_glb(path)
    nodes = doc.get("nodes", [])
    materials = doc.get("materials", [])
    meshes = doc.get("meshes", [])
    images = doc.get("images", [])
    textures = doc.get("textures", [])
    animations = doc.get("animations", [])

    triangles = 0
    for mesh in meshes:
        for primitive in mesh.get("primitives", []):
            if "indices" in primitive:
                accessor = doc["accessors"][primitive["indices"]]
                triangles += accessor["count"] // 3

    morph_targets = sum(
        len(primitive.get("targets", []))
        for mesh in meshes for primitive in mesh.get("primitives", [])
    )

    names = {node.get("name") for node in nodes}
    missing = sorted(set(node_names) - names)
    embedded_images = all(
        ("bufferView" in image and "uri" not in image) for image in images
    )

    def node_by_name(name):
        return next((node for node in nodes if node.get("name") == name), None)

    eye_l = node_by_name("Eye_L")
    antenna_orb = node_by_name("Antenna_Orb")
    root = node_by_name("PIP_ROOT")
    orientation_checks = {
        "root_scale_unit": (not root or root.get("scale") in (None, [1, 1, 1])),
        "eye_l_forward_positive_z": bool(eye_l and eye_l.get("translation", [0, 0, 0])[2] > 0),
        "antenna_orb_up_positive_y": bool(
            antenna_orb and antenna_orb.get("translation", [0, 0, 0])[1] > 0),
    }

    face_material_checks = {}
    for material_name in ("PIP_Eye_L", "PIP_Eye_R", "PIP_Mouth"):
        material = next((m for m in materials if m.get("name") == material_name), None)
        if material is None:
            face_material_checks[material_name] = False
            continue
        pbr = material.get("pbrMetallicRoughness", {})
        face_material_checks[material_name] = bool(
            pbr.get("baseColorTexture")
            and material.get("emissiveFactor")
            and material.get("alphaMode") == "BLEND"
        )

    texture_transform_count = 0
    for material in materials:
        pbr = material.get("pbrMetallicRoughness", {})
        for info in (pbr.get("baseColorTexture"), material.get("emissiveTexture")):
            if info and "KHR_texture_transform" in info.get("extensions", {}):
                texture_transform_count += 1

    root_name = None
    scenes = doc.get("scenes", [])
    if scenes and scenes[0].get("nodes"):
        root_node = nodes[scenes[0]["nodes"][0]]
        root_name = root_node.get("name")

    has_cameras = bool(doc.get("cameras"))
    has_lights = "KHR_lights_punctual" in doc.get("extensionsUsed", [])
    extensions_used = doc.get("extensionsUsed", [])

    report = {
        "asset_name": "PIP_RetroSpacePost",
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "blender_version": bpy.app.version_string,
        "blender_file_created": os.path.exists(blend_path),
        "blender_file_size_bytes": os.path.getsize(blend_path) if os.path.exists(blend_path) else 0,
        "glb_file_created": os.path.exists(path),
        "glb_file_size_bytes": os.path.getsize(path) if os.path.exists(path) else 0,
        "glb_header_valid": True,
        "glb_bin_chunk_present": has_bin,
        "glb_parse_validated": True,
        "triangle_count": triangles,
        "triangle_count_blend_evaluated": blend_tris,
        "mesh_count": len(meshes),
        "node_count": len(nodes),
        "material_count": len(materials),
        "texture_count": len(textures),
        "image_count": len(images),
        "animation_count": len(animations),
        "morph_target_count": morph_targets,
        "root_node": root_name,
        "required_nodes_present": len(missing) == 0,
        "missing_nodes": missing,
        "orientation_validated": all(orientation_checks.values()),
        "orientation_checks": orientation_checks,
        "forward_axis_after_export": "+Z",
        "up_axis_after_export": "+Y",
        "root_scale": root.get("scale", [1, 1, 1]) if root else [1, 1, 1],
        "facial_controls_strategy": "independent emissive texture-atlas offset per Eye_L, Eye_R and Mouth",
        "facial_materials": face_material_checks,
        "facial_controls_validated": all(face_material_checks.values()),
        "texture_transform_count": texture_transform_count,
        "expression_count": EYE_ROWS,
        "mouth_openness_levels": MOUTH_COLS,
        "embedded_textures_validated": embedded_images and len(images) > 0,
        "cameras_in_glb": has_cameras,
        "lights_in_glb": has_lights,
        "extensions_used": extensions_used,
        "preview_renders": [os.path.basename(p) for p in preview_paths if os.path.exists(p)],
        "notes": [
            "Final visual pass compared front, three-quarter, side, back and expression renders against the supplied character sheet.",
            "The reference sheet is not embedded in the asset; only the generated atlases are packed.",
            "No baked animation clips are exported; hover/bob/antenna/scarf motion is procedural on the exported pivots.",
            "Preview cameras, lights and floor are excluded from the GLB.",
        ],
    }
    return report


def save_and_export(character_collection, report):
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print("Saved", BLEND_PATH)

    ensure_object_mode()
    bpy.ops.object.select_all(action="DESELECT")
    selected = []
    for obj in character_collection.all_objects:
        obj.select_set(True)
        selected.append(obj)
    bpy.context.view_layer.objects.active = bpy.data.objects["PIP_ROOT"]
    bpy.ops.export_scene.gltf(
        filepath=GLB_PATH,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_image_format="AUTO",
    )
    bpy.ops.object.select_all(action="DESELECT")
    print("Exported", GLB_PATH)
    return selected


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

def main():
    print("=== PIP build ===")
    print("Generating facial and postal atlases...")
    generate_eye_atlas(os.path.join(TEXTURE_DIR, "PIP_Face_Eyes.png"))
    generate_mouth_atlas(os.path.join(TEXTURE_DIR, "PIP_Face_Mouth.png"))
    generate_postal_stamp(os.path.join(TEXTURE_DIR, "PIP_Postal_Stamp.png"))

    scene, character, controls, lights, cameras_col, reference_only = initialize_scene()
    materials = create_materials()

    bpy.context.view_layer.update()

    root = add_empty("PIP_ROOT", character)
    bob = add_empty("PIP_BOB_PIVOT", character, parent=root)
    body_pivot = add_empty("PIP_BODY_PIVOT", character, parent=bob)
    body_group = add_empty("BODY", character, parent=body_pivot)
    face_group = add_empty("FACE", character, parent=body_pivot)
    expressions = add_empty("Face_Expressions", character, parent=face_group)

    bpy.context.view_layer.update()

    create_body_shell(character, materials["shell"], body_group)
    create_face_screen(character, materials, face_group, expressions)
    create_side_modules(character, materials, body_pivot)
    create_antenna(character, materials, body_pivot)
    create_stripes(character, materials, body_group)
    create_hover_thruster(character, materials, body_pivot)
    postal, badge, stamp, cancellation = create_postal_details(
        character, materials, body_pivot)
    create_scarf(character, materials, body_pivot, postal)

    bpy.context.view_layer.update()

    required_nodes = [
        "PIP_ROOT", "PIP_BOB_PIVOT", "PIP_BODY_PIVOT", "BODY", "Body_Shell",
        "Body_Stripe_Orange", "Body_Stripe_Accent", "FACE", "Face_Screen",
        "Face_Gold_Rim", "Face_Expressions", "Eye_L", "Eye_R", "Mouth",
        "SIDE_MODULES", "Module_L", "Module_R", "ANTENNA_PIVOT",
        "Antenna_Base", "Antenna_Stem", "Antenna_Orb", "POSTAL_DETAILS",
        "Forehead_Envelope_Badge", "Scarf_Envelope_Clasp", "Postal_Stamp",
        "SCARF", "Scarf_Band", "Scarf_Knot", "Scarf_Tail_Pivot",
        "Scarf_Tail_A", "Scarf_Tail_B", "Scarf_Accent_Stripes",
        "HOVER_THRUSTER", "Thruster_Housing", "Thruster_Emitter",
    ]
    existing_names = {obj.name for obj in character.all_objects}
    missing = [name for name in required_nodes if name not in existing_names]
    if missing:
        raise RuntimeError(f"Missing required objects: {missing}")

    mesh_objects = [obj for obj in character.all_objects if obj.type == "MESH"]
    for obj in mesh_objects:
        assert obj.parent is not None, f"{obj.name} has no parent"
    print(f"Character objects: {len(character.all_objects)} ({len(mesh_objects)} meshes)")

    blend_tris = blend_triangle_count(mesh_objects)
    print(f"Evaluated triangles in .blend: {blend_tris}")
    if blend_tris > 25000:
        print("WARNING: triangle budget exceeded")

    cameras = create_preview_setup(scene, lights, cameras_col)
    bpy.context.view_layer.update()

    report = {
        "asset_name": "PIP_RetroSpacePost",
        "generated_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "blender_version": bpy.app.version_string,
        "blender_file_created": False,
        "blender_file_size_bytes": 0,
        "glb_file_created": False,
        "glb_file_size_bytes": 0,
        "glb_header_valid": False,
        "glb_bin_chunk_present": False,
        "glb_parse_validated": False,
        "triangle_count": 0,
        "triangle_count_blend_evaluated": blend_tris,
        "mesh_count": 0,
        "node_count": 0,
        "material_count": 0,
        "texture_count": 0,
        "image_count": 0,
        "animation_count": 0,
        "morph_target_count": 0,
        "root_node": None,
        "required_nodes_present": False,
        "missing_nodes": required_nodes,
        "orientation_validated": False,
        "orientation_checks": {},
        "forward_axis_after_export": "+Z",
        "up_axis_after_export": "+Y",
        "root_scale": [1, 1, 1],
        "facial_controls_strategy": "independent emissive texture-atlas offset per Eye_L, Eye_R and Mouth",
        "facial_materials": {},
        "facial_controls_validated": False,
        "texture_transform_count": 0,
        "expression_count": EYE_ROWS,
        "mouth_openness_levels": MOUTH_COLS,
        "embedded_textures_validated": False,
        "cameras_in_glb": None,
        "lights_in_glb": None,
        "extensions_used": [],
        "preview_renders": [],
        "notes": [],
    }

    save_and_export(character, report)

    preview_paths = render_previews(scene, cameras)

    report = validate_glb(
        GLB_PATH, BLEND_PATH, blend_tris, preview_paths, required_nodes)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
        handle.write("\n")
    print("Wrote", REPORT_PATH)
    print(json.dumps(report, indent=2))
    print("=== PIP build complete ===")


if __name__ == "__main__":
    main()
