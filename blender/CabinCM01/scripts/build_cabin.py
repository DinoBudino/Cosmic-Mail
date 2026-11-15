"""Cabina de mando CM-01 Explorer — construcción procedural reproducible.

Uso (consola):
    blender -b --factory-startup --python blender/CabinCM01/scripts/build_cabin.py -- [--render] [--no-export]

Crea la escena desde cero, guarda blender/CabinCM01/CabinCM01.blend, exporta
public/models/cabin-cm01.glb y (con --render) renders de control en blender/CabinCM01/renders/.

Ejes (Blender): X derecha, Y hacia la ventana (delante), Z arriba. En three.js (glTF +Y up):
three = (x, z, -y). La cámara del puesto de mando mira hacia +Y.

Las piezas interactivas (pantallas, botón con tapa, álbum) se dibujan/animan en la web; aquí se
exportan sus soportes y unos *anchors* (empties ANCHOR_*) con la convención: Z local = normal de
la superficie (hacia la sala), Y local = "arriba" de la pantalla, X local = derecha.
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = "/home/dinobudino/Documentos/TEST/cosmic-mail"
BASE = os.path.join(ROOT, "blender", "CabinCM01")
GLB = os.path.join(ROOT, "public", "models", "cabin-cm01.glb")
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []

# ───────────────────────── escena limpia ─────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "CM01_CABIN"
COLL = {}


def coll(name):
    if name not in COLL:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        COLL[name] = c
    return COLL[name]


# ───────────────────────── materiales (paleta de la ficha) ─────────────────────────
def srgb(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


MATS = {}


def mat(name, hexc, metal=0.0, rough=0.5, emit=None, strength=0.0, alpha=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = srgb(hexc)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if emit:
        p.inputs["Emission Color"].default_value = srgb(emit)
        p.inputs["Emission Strength"].default_value = strength
    if alpha is not None:
        p.inputs["Alpha"].default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    MATS[name] = m
    return m


mat("CM_PANEL_WHITE", "#E6E6E6", 0.0, 0.55)        # Blanco espacial
mat("CM_PANEL_LIGHT", "#B9BFC6", 0.15, 0.5)        # Gris claro
mat("CM_PANEL_MID", "#8A9099", 0.35, 0.42)         # Gris medio / metal anodizado
mat("CM_PANEL_DARK", "#4B515B", 0.25, 0.5)         # Gris oscuro
mat("CM_NIGHT", "#1C2330", 0.1, 0.55)              # Azul noche
mat("CM_PANEL_BLUE", "#243A6B", 0.1, 0.45)         # Azul panel
mat("CM_ORANGE", "#F47B38", 0.05, 0.42)            # Naranja misión
mat("CM_RED", "#B5363E", 0.05, 0.35)               # Rojo técnico
mat("CM_FLOOR", "#2E343E", 0.1, 0.85)              # Textura técnica antideslizante
mat("CM_SEAM", "#2A2F38", 0.0, 0.7)
mat("CM_SCREEN", "#071417", 0.0, 0.25, emit="#0E3A3A", strength=0.6)
mat("CM_AMBER", "#FFB347", 0.0, 0.4, emit="#FF9A2E", strength=3.0)      # señalización
mat("CM_RING_LIGHT", "#FF9A3C", 0.0, 0.4, emit="#FF7A1A", strength=2.0)
mat("CM_CEIL_LIGHT", "#FFE2B0", 0.0, 0.4, emit="#FFD08A", strength=5.0)
mat("CM_LANTERN_CORE", "#FFC060", 0.0, 0.3, emit="#FFB040", strength=9.0)
mat("CM_GLASS", "#D8E4EA", 0.0, 0.05, alpha=0.28)
mat("CM_HAZARD_Y", "#F2B51C", 0.05, 0.45)
mat("CM_HAZARD_K", "#15181E", 0.05, 0.5)
mat("CM_SEAT_CREAM", "#E4DED4", 0.0, 0.8)          # textil técnico
mat("CM_SEAT_DARK", "#2C323C", 0.0, 0.7)
mat("CM_ALBUM_COVER", "#1F2645", 0.0, 0.6)
mat("CM_GOLD", "#E3A43A", 0.6, 0.35)
mat("CM_TAB_BLUE", "#3D8BD9", 0.0, 0.5)
mat("CM_TAB_GREEN", "#4CC28A", 0.0, 0.5)
mat("CM_PAGE", "#EFE6D2", 0.0, 0.8)
mat("CM_TEXT", "#E9E4DA", 0.0, 0.5)
mat("CM_RED_LIGHT", "#FF4A4A", 0.0, 0.4, emit="#FF3B3B", strength=5.0)
mat("CM_BLUE_LIGHT", "#59B8FF", 0.0, 0.4, emit="#4AA8FF", strength=5.0)


# ───────────────────────── utilidades geométricas ─────────────────────────
def finish(o, collection, material=None, bevel=0.0, segs=2, smooth=True, parent=None):
    for c in o.users_collection:
        c.objects.unlink(o)
    coll(collection).objects.link(o)
    if material is not None:
        o.data.materials.clear()
        o.data.materials.append(MATS[material] if isinstance(material, str) else material)
    if bevel:
        m = o.modifiers.new("Bevel", "BEVEL")
        m.width, m.segments = bevel, segs
        m.limit_method = "ANGLE"
        m.angle_limit = math.radians(35)
        m.harden_normals = False
    if smooth and o.type == "MESH":
        for p in o.data.polygons:
            p.use_smooth = True
        try:
            o.data.set_sharp_from_angle(angle=math.radians(35))
        except Exception:
            pass
    if parent is not None:
        o.parent = parent
    return o


def box(name, size, loc, collection, material, bevel=0.015, rot=(0, 0, 0), parent=None, segs=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, collection, material, bevel, segs, parent=parent)


def cyl(name, r, depth, loc, collection, material, rot=(0, 0, 0), verts=40, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return finish(o, collection, material, bevel, parent=parent)


def torus(name, R, r, loc, collection, material, rot=(0, 0, 0), maj=72, minr=14, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=maj, minor_segments=minr)
    o = bpy.context.active_object
    o.name = name
    return finish(o, collection, material, parent=parent)


def mesh_from(name, verts, faces, collection, material, bevel=0.0, solidify=0.0, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    if solidify:
        s = o.modifiers.new("Solidify", "SOLIDIFY")
        s.thickness, s.offset = solidify, -1.0
    return finish(o, collection, material, bevel, smooth=smooth)


def frame_matrix(origin, normal, up):
    n = Vector(normal).normalized()
    u = Vector(up)
    u = (u - n * u.dot(n)).normalized()
    x = u.cross(n).normalized()
    return Matrix((
        (x.x, u.x, n.x, origin[0]),
        (x.y, u.y, n.y, origin[1]),
        (x.z, u.z, n.z, origin[2]),
        (0, 0, 0, 1),
    ))


def anchor(name, matrix, size=0.2):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "ARROWS"
    e.empty_display_size = size
    e.matrix_world = matrix
    coll("ANCHORS").objects.link(e)
    return e


def text_mesh(name, body, size, loc, collection, material, rot=(math.pi / 2, 0, 0), extrude=0.004,
              font_bold=True, align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = "CENTER"
    if font_bold:
        for path in ("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
                     "/usr/share/fonts/noto/NotoSans-Bold.ttf", "/usr/share/fonts/TTF/OpenSans-Bold.ttf"):
            if os.path.exists(path):
                cu.font = bpy.data.fonts.load(path, check_existing=True)
                break
    o = bpy.data.objects.new(name, cu)
    scene.collection.objects.link(o)
    o.location, o.rotation_euler = loc, rot
    bpy.context.view_layer.objects.active = o
    for ob in bpy.context.view_layer.objects:
        ob.select_set(ob == o)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    o.name = name
    return finish(o, collection, material, smooth=False)


# ───────────────────────── casco: perfil octogonal extruido en Y ─────────────────────────
FLOOR_Z, CEIL_Z = -1.0, 2.1
Y_REAR, Y_FRONT = -3.4, 3.4
PROFILE_R = [(2.2, FLOOR_Z), (2.75, -0.25), (2.75, 0.95), (1.75, CEIL_Z)]   # lado derecho, de suelo a techo
RIBS = [-3.4, -1.9, -0.4, 1.1, 2.55]
GAP = 0.022


def side_profile(sx):
    return [(sx * x, z) for x, z in PROFILE_R]


def panel_quad(name, a, b, y0, y1, collection, material, inset=GAP, thick=0.05):
    """Panel entre dos puntos del perfil (a,b en XZ) y dos estaciones Y, con junta."""
    ax, az = a
    bx, bz = b
    d = Vector((bx - ax, 0, bz - az))
    L = d.length
    d.normalize()
    pa = Vector((ax, 0, az)) + d * inset
    pb = Vector((bx, 0, bz)) - d * inset
    ya, yb = y0 + inset, y1 - inset
    verts = [(pa.x, ya, pa.z), (pb.x, ya, pb.z), (pb.x, yb, pb.z), (pa.x, yb, pa.z)]
    o = mesh_from(name, verts, [(0, 1, 2, 3)], collection, material, bevel=0.012, solidify=thick)
    # normales hacia el interior de la sala
    c = Vector(((pa.x + pb.x) / 2, 0, (pa.z + pb.z) / 2))
    n = o.data.polygons[0].normal
    inward = Vector((0, 0, 0.6)) - c
    if n.dot(inward) < 0:
        o.data.flip_normals()
    return o


hull_panels = []
for sx in (1, -1):
    prof = side_profile(sx)
    for i in range(len(prof) - 1):
        for k in range(len(RIBS) - 1):
            y0, y1 = RIBS[k], RIBS[k + 1]
            m = "CM_PANEL_WHITE" if i in (1,) else "CM_PANEL_LIGHT"
            if i == 0:
                m = "CM_PANEL_DARK"
            hull_panels.append(panel_quad(f"HULL_P_{sx}_{i}_{k}", prof[i], prof[i + 1], y0, y1, "HULL", m))
        # tramo entre el último nervio y la pared frontal
        hull_panels.append(panel_quad(f"HULL_PF_{sx}_{i}", prof[i], prof[i + 1], RIBS[-1], Y_FRONT, "HULL",
                                      "CM_PANEL_LIGHT" if i else "CM_PANEL_DARK"))
# techo
for k in range(len(RIBS) - 1):
    hull_panels.append(panel_quad(f"HULL_CEIL_{k}", (-1.75, CEIL_Z), (1.75, CEIL_Z), RIBS[k], RIBS[k + 1], "HULL",
                                  "CM_PANEL_LIGHT"))
hull_panels.append(panel_quad("HULL_CEIL_F", (-1.75, CEIL_Z), (1.75, CEIL_Z), RIBS[-1], Y_FRONT, "HULL",
                              "CM_PANEL_LIGHT"))
# núcleo oscuro detrás de las juntas (lo que se ve por los huecos)
core_pts = [(-2.2, FLOOR_Z)] + list(reversed(side_profile(-1)))[:-1][::-1]
full = side_profile(-1)[::-1] + side_profile(1)
for i in range(len(full) - 1):
    a, b = full[i], full[i + 1]
    verts = [(a[0] * 1.012, Y_REAR, a[1] + (0.012 if a[1] > 0 else -0.012)),
             (b[0] * 1.012, Y_REAR, b[1] + (0.012 if b[1] > 0 else -0.012)),
             (b[0] * 1.012, Y_FRONT, b[1] + (0.012 if b[1] > 0 else -0.012)),
             (a[0] * 1.012, Y_FRONT, a[1] + (0.012 if a[1] > 0 else -0.012))]
    mesh_from(f"HULL_CORE_{i}", verts, [(0, 1, 2, 3)], "HULL", "CM_SEAM")

# nervios estructurales (marcos gris medio) con ranuras de luz ámbar en los paneles superiores
for k, y in enumerate(RIBS[1:]):
    for sx in (1, -1):
        prof = side_profile(sx)
        for i in range(len(prof) - 1):
            a, b = prof[i], prof[i + 1]
            d = Vector((b[0] - a[0], 0, b[1] - a[1]))
            L = d.length
            mid = Vector(((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2))
            ang = math.atan2(d.z, d.x)
            o = box(f"RIB_{k}_{sx}_{i}", (L + 0.06, 0.16, 0.10), mid, "RIBS",
                    "CM_ORANGE" if (k == 1 and sx == -1 and i in (1, 2)) else "CM_PANEL_MID",
                    bevel=0.02, rot=(0, -ang, 0))
            # empuja el nervio hacia la sala
            n = Vector((-math.sin(ang), 0, math.cos(ang)))
            inward = Vector((0, 0, 0.6)) - Vector((mid.x, 0, mid.z))
            if n.dot(inward) < 0:
                n = -n
            o.location = mid + n * 0.035
    o = box(f"RIB_CEIL_{k}", (3.56, 0.16, 0.10), (0, y, CEIL_Z - 0.035), "RIBS", "CM_PANEL_MID", bevel=0.02)

# luces ámbar en los paneles inclinados superiores (señalización / luz ambiental)
for sx in (1, -1):
    a, b = side_profile(sx)[2], side_profile(sx)[3]
    d = Vector((b[0] - a[0], 0, b[1] - a[1]))
    ang = math.atan2(d.z, d.x)
    n = Vector((-math.sin(ang), 0, math.cos(ang)))
    if n.dot(Vector((0, 0, 0.6)) - Vector(((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2))) < 0:
        n = -n
    for j, y in enumerate((0.35, 1.85, 3.0)):
        c = Vector(((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2)) + n * 0.03
        box(f"AMBIENT_LIGHT_{sx}_{j}", (0.62, 0.20, 0.035), c, "LIGHTS", "CM_AMBER", bevel=0.012, rot=(0, -ang, 0))
        box(f"AMBIENT_LIGHT_FRAME_{sx}_{j}", (0.72, 0.28, 0.03), c - n * 0.012, "LIGHTS", "CM_PANEL_DARK", bevel=0.01,
            rot=(0, -ang, 0))
    # rejillas de ventilación sobre los monitores
    c = Vector(((a[0] + b[0]) / 2, 2.25, (a[1] + b[1]) / 2)) + n * 0.03
    box(f"VENT_{sx}", (0.78, 0.36, 0.05), c, "DETAILS", "CM_PANEL_DARK", bevel=0.02, rot=(0, -ang, 0))
    for s in range(4):
        box(f"VENT_SLAT_{sx}_{s}", (0.68, 0.035, 0.03), c + n * 0.03 + Vector((0, -0.12 + s * 0.08, 0)), "DETAILS",
            "CM_NIGHT", bevel=0.006, rot=(0, -ang, 0))

# panel de luz del techo, sobre la ventana
box("CEILING_LIGHT_FRAME", (1.9, 0.62, 0.08), (0, 2.75, CEIL_Z - 0.06), "LIGHTS", "CM_PANEL_DARK", bevel=0.025)
box("CEILING_LIGHT", (1.6, 0.4, 0.04), (0, 2.75, CEIL_Z - 0.105), "LIGHTS", "CM_CEIL_LIGHT", bevel=0.015)
box("CEILING_LIGHT_B", (1.2, 0.3, 0.04), (0, 0.4, CEIL_Z - 0.09), "LIGHTS", "CM_CEIL_LIGHT", bevel=0.012)

# suelo técnico con pasillo y franjas
box("FLOOR", (4.4, Y_FRONT - Y_REAR, 0.06), (0, 0, FLOOR_Z - 0.03), "FLOOR", "CM_FLOOR", bevel=0.0)
for sx in (1, -1):
    box(f"FLOOR_EDGE_{sx}", (0.05, Y_FRONT - Y_REAR - 0.4, 0.012), (sx * 0.85, 0, FLOOR_Z + 0.006), "FLOOR",
        "CM_ORANGE", bevel=0.0)
for k in range(9):
    box(f"FLOOR_PLATE_{k}", (1.6, 0.7, 0.012), (0, Y_REAR + 0.55 + k * 0.75, FLOOR_Z + 0.006), "FLOOR",
        "CM_PANEL_DARK", bevel=0.004)

# ───────────────────────── pared frontal y ventana panorámica ─────────────────────────
WIN_C = Vector((0, Y_FRONT, 0.78))
WIN_R = 1.42          # hueco abierto al espacio
outline = side_profile(-1)[::-1] + side_profile(1)
bm = bmesh.new()
outer = [bm.verts.new((x, Y_FRONT, z)) for x, z in [(-2.2, FLOOR_Z)] + outline[1:-1] + [(2.2, FLOOR_Z)]]
bm.faces.new(outer)
bm.normal_update()
me = bpy.data.meshes.new("FRONT_WALL")
bm.to_mesh(me)
bm.free()
wall = bpy.data.objects.new("FRONT_WALL", me)
scene.collection.objects.link(wall)
sol = wall.modifiers.new("Solidify", "SOLIDIFY")
sol.thickness, sol.offset = 0.12, 1.0
bpy.ops.mesh.primitive_cylinder_add(radius=WIN_R + 0.3, depth=2.0, location=WIN_C, rotation=(math.pi / 2, 0, 0),
                                    vertices=96)
cutter = bpy.context.active_object
boo = wall.modifiers.new("Hole", "BOOLEAN")
boo.object, boo.operation = cutter, "DIFFERENCE"
bpy.context.view_layer.objects.active = wall
for mname in ("Solidify", "Hole"):
    bpy.ops.object.modifier_apply(modifier=mname)
bpy.data.objects.remove(cutter, do_unlink=True)
finish(wall, "WINDOW", "CM_PANEL_LIGHT", bevel=0.01)
wall.data.flip_normals() if wall.data.polygons and wall.data.polygons[0].normal.y > 0 else None


def ring(name, r_in, r_out, y0, y1, collection, material, seg=128):
    """Anillo grueso (tubo) coaxial a la ventana, de y0 a y1."""
    bm = bmesh.new()
    rings = []
    for (r, y) in ((r_out, y0), (r_out, y1), (r_in, y1), (r_in, y0)):
        rings.append([bm.verts.new((WIN_C.x + r * math.cos(2 * math.pi * s / seg), y,
                                    WIN_C.z + r * math.sin(2 * math.pi * s / seg))) for s in range(seg)])
    for a in range(4):
        A, B = rings[a], rings[(a + 1) % 4]
        for s in range(seg):
            bm.faces.new((A[s], A[(s + 1) % seg], B[(s + 1) % seg], B[s]))
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    return finish(o, collection, material, bevel=0.012)


ring("WINDOW_BEZEL", WIN_R + 0.18, WIN_R + 0.42, Y_FRONT - 0.32, Y_FRONT, "WINDOW", "CM_PANEL_MID")
ring("WINDOW_BEZEL_OUTER", WIN_R + 0.42, WIN_R + 0.52, Y_FRONT - 0.22, Y_FRONT, "WINDOW", "CM_PANEL_DARK")
ring("WINDOW_ORANGE_RING", WIN_R + 0.02, WIN_R + 0.19, Y_FRONT - 0.36, Y_FRONT + 0.05, "WINDOW", "CM_ORANGE")
ring("WINDOW_INNER_LIP", WIN_R - 0.04, WIN_R + 0.03, Y_FRONT - 0.28, Y_FRONT + 0.12, "WINDOW", "CM_NIGHT")
# segmentos de luz en el anillo (ventana panorámica de la ficha)
N_SEG = 18
for s in range(N_SEG):
    a0 = 2 * math.pi * s / N_SEG + 0.05
    a1 = 2 * math.pi * (s + 1) / N_SEG - 0.05
    if math.sin((a0 + a1) / 2) < -0.55:      # la parte inferior queda tapada por la consola
        continue
    bm = bmesh.new()
    k = 8
    R0, R1, yy = WIN_R + 0.235, WIN_R + 0.345, Y_FRONT - 0.335
    vs = []
    for j in range(k + 1):
        a = a0 + (a1 - a0) * j / k
        vs.append((bm.verts.new((R0 * math.cos(a), yy, WIN_C.z + R0 * math.sin(a))),
                   bm.verts.new((R1 * math.cos(a), yy, WIN_C.z + R1 * math.sin(a)))))
    for j in range(k):
        bm.faces.new((vs[j][0], vs[j + 1][0], vs[j + 1][1], vs[j][1]))
    me = bpy.data.meshes.new(f"WINDOW_LIGHT_{s:02d}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"WINDOW_LIGHT_{s:02d}", me)
    scene.collection.objects.link(o)
    sm = o.modifiers.new("Solidify", "SOLIDIFY")
    sm.thickness, sm.offset = 0.02, 0
    finish(o, "LIGHTS", "CM_RING_LIGHT", smooth=False)
# tornillos del bisel
for s in range(16):
    a = 2 * math.pi * s / 16 + 0.1
    cyl(f"WINDOW_BOLT_{s:02d}", 0.028, 0.03, (WIN_C.x + (WIN_R + 0.47) * math.cos(a), Y_FRONT - 0.235,
                                              WIN_C.z + (WIN_R + 0.47) * math.sin(a)), "WINDOW", "CM_PANEL_DARK",
        rot=(math.pi / 2, 0, 0), verts=12)

# ───────────────────────── monitores laterales ─────────────────────────
for sx, nm in ((-1, "L"), (1, "R")):
    c = Vector((sx * 2.18, 2.55, 0.62))
    look = Vector((0, -1.6, 0.35)) - c
    normal = Vector((look.x, look.y, 0)).normalized()
    M = frame_matrix(c, normal, (0, 0, 1))
    hous = box(f"MONITOR_{nm}_HOUSING", (1.08, 0.74, 0.12), (0, 0, 0), "MONITORS", "CM_PANEL_DARK", bevel=0.03)
    hous.matrix_world = M @ Matrix.Translation((0, 0, -0.05))
    bez = box(f"MONITOR_{nm}_BEZEL", (1.0, 0.66, 0.04), (0, 0, 0), "MONITORS", "CM_NIGHT", bevel=0.012)
    bez.matrix_world = M @ Matrix.Translation((0, 0, 0.0))
    arm = box(f"MONITOR_{nm}_ARM", (0.16, 0.16, 0.5), (0, 0, 0), "MONITORS", "CM_PANEL_MID", bevel=0.02)
    arm.matrix_world = M @ Matrix.Translation((0, 0, -0.3))
    anchor(f"ANCHOR_SCREEN_{nm}", M @ Matrix.Translation((0, 0, 0.024)))
    for j in range(3):
        led = box(f"MONITOR_{nm}_LED_{j}", (0.05, 0.02, 0.012), (0, 0, 0), "MONITORS",
                  "CM_AMBER" if j else "CM_BLUE_LIGHT", bevel=0.004)
        led.matrix_world = M @ Matrix.Translation((0.36 + j * 0.07 - 0.07, -0.345, 0.03))

# ───────────────────────── consola de mando ─────────────────────────
# Sección (Y,Z): frente vertical, borde, tablero inclinado hacia el piloto, peldaño trasero y repisa.
CONS_X = 2.45
SEC = [(1.42, FLOOR_Z), (1.42, -0.46), (1.32, -0.34), (2.42, -0.06), (2.52, 0.12), (Y_FRONT - 0.36, 0.12),
       (Y_FRONT - 0.36, FLOOR_Z)]
bm = bmesh.new()
L_ = [bm.verts.new((-CONS_X, y, z)) for y, z in SEC]
R_ = [bm.verts.new((CONS_X, y, z)) for y, z in SEC]
n = len(SEC)
for i in range(n):
    j = (i + 1) % n
    bm.faces.new((L_[i], L_[j], R_[j], R_[i]))
bm.faces.new(list(reversed(L_)))
bm.faces.new(R_)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new("CONSOLE_BODY")
bm.to_mesh(me)
bm.free()
cons = bpy.data.objects.new("CONSOLE_BODY", me)
scene.collection.objects.link(cons)
finish(cons, "CONSOLE", "CM_PANEL_LIGHT", bevel=0.025, segs=3)
# superficie del tablero (gris medio) ligeramente elevada
P0, P1 = Vector((0, 1.36, -0.335)), Vector((0, 2.42, -0.06))
slope = (P1 - P0).normalized()
top_n = Vector((0, -slope.z, slope.y))           # normal del tablero (hacia arriba y hacia el piloto)


def on_top(x, t, h=0.0):
    """Punto del tablero: x lateral, t a lo largo de la pendiente (0 borde delantero, 1 trasero)."""
    p = P0.lerp(P1, t)
    return Vector((x, p.y, p.z)) + top_n * h


TOP_UP = slope                                    # "arriba" de las pantallas tumbadas = hacia la ventana


def top_box(name, x, t, size, h, collection, material, bevel=0.012):
    o = box(name, size, (0, 0, 0), collection, material, bevel=bevel)
    o.matrix_world = frame_matrix(on_top(x, t, h), top_n, TOP_UP)
    return o


top_box("CONSOLE_TOP_PLATE", 0, 0.5, (4.7, 1.08, 0.03), 0.012, "CONSOLE", "CM_PANEL_MID", bevel=0.01)
# consola de navegación (izquierda-centro): marco oscuro + anchor de pantalla
top_box("NAV_FRAME", -0.78, 0.52, (1.32, 0.78, 0.05), 0.03, "CONSOLE", "CM_PANEL_DARK", bevel=0.018)
top_box("NAV_RECESS", -0.78, 0.52, (1.22, 0.68, 0.02), 0.052, "CONSOLE", "CM_NIGHT", bevel=0.006)
anchor("ANCHOR_NAV", frame_matrix(on_top(-0.78, 0.52, 0.066), top_n, TOP_UP))
# módulo del botón principal (centro): placa, anillo de peligro amarillo/negro
top_box("BUTTON_PLATE", 0.38, 0.5, (0.74, 0.74, 0.05), 0.03, "CONSOLE", "CM_PANEL_DARK", bevel=0.02)
btn_c = on_top(0.38, 0.5, 0.056)
B = frame_matrix(btn_c, top_n, TOP_UP)
anchor("ANCHOR_BUTTON", B)
NH = 24
for s in range(NH):
    a0, a1 = 2 * math.pi * s / NH, 2 * math.pi * (s + 1) / NH
    bm = bmesh.new()
    k = 4
    vs = []
    for j in range(k + 1):
        a = a0 + (a1 - a0) * j / k
        for r in (0.21, 0.29):
            pass
        vs.append((bm.verts.new((0.21 * math.cos(a), 0.21 * math.sin(a), 0)),
                   bm.verts.new((0.29 * math.cos(a), 0.29 * math.sin(a), 0))))
    for j in range(k):
        bm.faces.new((vs[j][0], vs[j][1], vs[j + 1][1], vs[j + 1][0]))
    me = bpy.data.meshes.new(f"HAZARD_{s}")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(f"BUTTON_HAZARD_{s:02d}", me)
    scene.collection.objects.link(o)
    sm = o.modifiers.new("Solidify", "SOLIDIFY")
    sm.thickness, sm.offset = 0.035, 1.0
    finish(o, "CONSOLE", "CM_HAZARD_Y" if s % 2 == 0 else "CM_HAZARD_K", smooth=False)
    o.matrix_world = B
cyl("BUTTON_SOCKET", 0.205, 0.04, (0, 0, 0), "CONSOLE", "CM_NIGHT", verts=48, bevel=0.01).matrix_world = \
    B @ Matrix.Translation((0, 0, 0.02))
# pantallita de estado junto al botón
top_box("BUTTON_STATUS", 0.38, 0.88, (0.42, 0.07, 0.02), 0.06, "CONSOLE", "CM_BLUE_LIGHT", bevel=0.006)

# ── álbum de misiones (derecha): libro con esquinas doradas, planeta grabado y pestañas ──
alb_root = bpy.data.objects.new("ALBUM", None)
coll("ALBUM").objects.link(alb_root)
alb_root.matrix_world = frame_matrix(on_top(1.36, 0.5, 0.035), top_n, TOP_UP) @ Matrix.Rotation(math.radians(-6), 4, "Z")
AW, AH, AT = 0.62, 0.80, 0.11                       # ancho, alto, grosor
box("ALBUM_PAGES", (AW - 0.04, AH - 0.05, AT - 0.035), (0.01, 0, AT / 2), "ALBUM", "CM_PAGE", bevel=0.006,
    parent=alb_root)
box("ALBUM_COVER_BACK", (AW, AH, 0.022), (0, 0, 0.011), "ALBUM", "CM_ALBUM_COVER", bevel=0.008, parent=alb_root)
box("ALBUM_COVER", (AW, AH, 0.022), (0, 0, AT - 0.011), "ALBUM", "CM_ALBUM_COVER", bevel=0.008, parent=alb_root)
box("ALBUM_SPINE", (0.05, AH, AT), (-AW / 2 - 0.012, 0, AT / 2), "ALBUM", "CM_ORANGE", bevel=0.012, parent=alb_root)
for cx in (-1, 1):
    for cy in (-1, 1):
        box(f"ALBUM_CORNER_{cx}_{cy}", (0.11, 0.11, AT + 0.012), (cx * (AW / 2 - 0.045), cy * (AH / 2 - 0.045), AT / 2),
            "ALBUM", "CM_ORANGE", bevel=0.012, parent=alb_root)
# cierre/correa
box("ALBUM_STRAP", (0.2, 0.09, AT + 0.02), (AW / 2 - 0.02, 0.0, AT / 2), "ALBUM", "CM_ORANGE", bevel=0.012,
    parent=alb_root)
box("ALBUM_CLASP", (0.07, 0.06, 0.02), (AW / 2 - 0.07, 0.0, AT + 0.012), "ALBUM", "CM_GOLD", bevel=0.006,
    parent=alb_root)
# emblema: planeta con anillo + estrellas
emb = cyl("ALBUM_PLANET", 0.085, 0.012, (0.0, 0.03, AT + 0.002), "ALBUM", "CM_GOLD", verts=40, parent=alb_root)
ring_o = torus("ALBUM_PLANET_RING", 0.15, 0.011, (0.0, 0.03, AT + 0.004), "ALBUM", "CM_GOLD",
               rot=(0, 0, math.radians(-18)), maj=64, minr=8, parent=alb_root)
ring_o.scale = (1, 0.42, 1)
for j, (sx_, sy_, sz) in enumerate(((-0.2, 0.25, 0.022), (0.18, -0.24, 0.018), (-0.16, -0.22, 0.014),
                                    (0.2, 0.28, 0.014), (0.05, 0.31, 0.01))):
    st = cyl(f"ALBUM_STAR_{j}", sz, 0.01, (sx_, sy_, AT + 0.002), "ALBUM", "CM_GOLD", verts=4, parent=alb_root)
# pestañas de colores en el canto
for j, m in enumerate(("CM_ORANGE", "CM_TAB_BLUE", "CM_TAB_GREEN")):
    box(f"ALBUM_TAB_{j}", (0.06, 0.08, 0.05), (AW / 2 + 0.02, 0.22 - j * 0.12, AT / 2), "ALBUM", m, bevel=0.008,
        parent=alb_root)
anchor("ANCHOR_ALBUM", alb_root.matrix_world.copy())

# placa COSMIC MAIL CM-01 EXPLORER en el frente de la consola
PL_C = Vector((0.2, 1.405, -0.66))
box("PLAQUE_FRAME", (1.12, 0.05, 0.36), PL_C, "CONSOLE", "CM_PANEL_MID", bevel=0.02)
box("PLAQUE", (1.02, 0.03, 0.28), PL_C + Vector((0, -0.02, 0)), "CONSOLE", "CM_NIGHT", bevel=0.01)
text_mesh("PLAQUE_TEXT_1", "COSMIC MAIL", 0.105, PL_C + Vector((0, -0.04, 0.04)), "CONSOLE", "CM_TEXT")
text_mesh("PLAQUE_TEXT_2", "CM-01 EXPLORER", 0.05, PL_C + Vector((0, -0.04, -0.07)), "CONSOLE", "CM_TEXT",
          font_bold=False)
# franjas de luz ámbar en el borde de la consola y en el frente
box("CONSOLE_EDGE_LIGHT", (0.9, 0.04, 0.03), (-0.55, 1.335, -0.315), "LIGHTS", "CM_AMBER", bevel=0.008)
box("CONSOLE_FRONT_LIGHT", (0.7, 0.03, 0.05), (0.2, 1.41, -0.40), "LIGHTS", "CM_AMBER", bevel=0.008)
for sx in (-1, 1):
    box(f"CONSOLE_VENT_{sx}", (0.6, 0.04, 0.16), (sx * 1.45, 1.41, -0.66), "CONSOLE", "CM_PANEL_DARK", bevel=0.012)
    for s in range(3):
        box(f"CONSOLE_VENT_SLAT_{sx}_{s}", (0.52, 0.03, 0.022), (sx * 1.45, 1.39, -0.71 + s * 0.05), "CONSOLE",
            "CM_NIGHT", bevel=0.004)
# peldaño trasero: interruptores, luz roja, asa roja (panel técnico)
for j in range(5):
    box(f"SWITCH_{j}", (0.05, 0.05, 0.07), (-1.9 + j * 0.13, 2.53, 0.16), "CONSOLE", "CM_PANEL_DARK", bevel=0.01)
box("RED_INDICATOR", (0.22, 0.06, 0.06), (1.95, 2.6, 0.17), "CONSOLE", "CM_RED_LIGHT", bevel=0.015)
cyl("RED_HANDLE", 0.06, 0.42, (2.05, 2.25, 0.04), "CONSOLE", "CM_RED", rot=(0, math.pi / 2, 0), verts=24, bevel=0.01)
top_box("TECH_PANEL", 2.05, 0.35, (0.5, 0.42, 0.04), 0.02, "CONSOLE", "CM_PANEL_DARK", bevel=0.012)
for j in range(3):
    top_box(f"TECH_PORT_{j}", 1.92 + j * 0.13, 0.35, (0.08, 0.14, 0.03), 0.045, "CONSOLE", "CM_NIGHT", bevel=0.006)

# alas laterales de la consola con luminarias
for sx, nm in ((-1, "L"), (1, "R")):
    box(f"CONSOLE_WING_{nm}", (0.62, 1.6, 0.66), (sx * 2.4, 1.85, -0.67), "CONSOLE", "CM_PANEL_LIGHT", bevel=0.03)
    box(f"CONSOLE_WING_TOP_{nm}", (0.66, 1.64, 0.04), (sx * 2.4, 1.85, -0.32), "CONSOLE", "CM_PANEL_MID", bevel=0.012)
    lx, ly = sx * 2.25, 1.55 if sx < 0 else 1.45
    z0 = -0.30
    cyl(f"LANTERN_{nm}_BASE", 0.12, 0.06, (lx, ly, z0 + 0.03), "LANTERNS", "CM_PANEL_DARK", verts=32, bevel=0.01)
    cyl(f"LANTERN_{nm}_CORE", 0.055, 0.26, (lx, ly, z0 + 0.2), "LANTERNS", "CM_LANTERN_CORE", verts=24)
    cyl(f"LANTERN_{nm}_GLASS", 0.1, 0.3, (lx, ly, z0 + 0.21), "LANTERNS", "CM_GLASS", verts=32)
    cyl(f"LANTERN_{nm}_CAP", 0.115, 0.05, (lx, ly, z0 + 0.385), "LANTERNS", "CM_PANEL_DARK", verts=32, bevel=0.01)
    for a in range(3):
        ang = a * 2 * math.pi / 3
        cyl(f"LANTERN_{nm}_ROD_{a}", 0.012, 0.32, (lx + 0.105 * math.cos(ang), ly + 0.105 * math.sin(ang), z0 + 0.21),
            "LANTERNS", "CM_PANEL_MID", verts=8)
    anchor(f"ANCHOR_LANTERN_{nm}", Matrix.Translation((lx, ly, z0 + 0.2)))

# ───────────────────────── asiento del piloto ─────────────────────────
seat = bpy.data.objects.new("PILOT_SEAT", None)
coll("SEAT").objects.link(seat)
seat.location = (-0.78, 0.62, FLOOR_Z)
seat.scale = (0.8, 0.8, 0.8)
seat.rotation_euler = (0, 0, math.radians(-16))
S = "SEAT"
cyl("SEAT_PEDESTAL", 0.09, 0.42, (0, 0.05, 0.21), S, "CM_PANEL_MID", verts=24, parent=seat)
box("SEAT_FOOT", (0.62, 0.62, 0.06), (0, 0.05, 0.03), S, "CM_PANEL_DARK", bevel=0.02, parent=seat)
box("SEAT_CUSHION", (0.66, 0.62, 0.16), (0, 0.06, 0.5), S, "CM_SEAT_CREAM", bevel=0.06, segs=4, parent=seat)
box("SEAT_CUSHION_BASE", (0.7, 0.66, 0.08), (0, 0.06, 0.4), S, "CM_SEAT_DARK", bevel=0.03, parent=seat)
# respaldo: centro crema, laterales oscuros, franja naranja vertical
box("SEAT_BACK_CORE", (0.66, 0.2, 0.95), (0, -0.27, 1.02), S, "CM_SEAT_DARK", bevel=0.05, segs=4, parent=seat)
box("SEAT_BACK_PAD", (0.46, 0.2, 0.86), (0, -0.22, 1.02), S, "CM_SEAT_CREAM", bevel=0.06, segs=4, parent=seat)
box("SEAT_BACK_STRIPE", (0.12, 0.03, 0.84), (0.12, -0.41, 1.0), S, "CM_ORANGE", bevel=0.015, parent=seat)
box("SEAT_BACK_SHELL", (0.6, 0.06, 0.86), (0, -0.37, 1.0), S, "CM_SEAT_CREAM", bevel=0.03, parent=seat)
for sx in (-1, 1):
    box(f"SEAT_BOLSTER_{sx}", (0.13, 0.26, 0.9), (sx * 0.31, -0.22, 1.02), S, "CM_SEAT_DARK", bevel=0.05, segs=3,
        parent=seat)
    box(f"SEAT_ARMREST_{sx}", (0.12, 0.5, 0.1), (sx * 0.4, 0.05, 0.72), S, "CM_SEAT_CREAM", bevel=0.04, segs=3,
        parent=seat)
    box(f"SEAT_ARMREST_LIGHT_{sx}", (0.012, 0.22, 0.03), (sx * 0.465, 0.1, 0.72), S, "CM_AMBER", bevel=0.006,
        parent=seat)
    box(f"SEAT_ARM_POST_{sx}", (0.06, 0.08, 0.24), (sx * 0.4, -0.1, 0.58), S, "CM_PANEL_MID", bevel=0.01, parent=seat)
# reposacabezas con luz y logo del planeta
box("SEAT_HEADREST", (0.5, 0.2, 0.32), (0, -0.25, 1.68), S, "CM_SEAT_CREAM", bevel=0.07, segs=4, parent=seat)
box("SEAT_HEADREST_SIDE", (0.56, 0.16, 0.26), (0, -0.24, 1.68), S, "CM_SEAT_DARK", bevel=0.05, segs=3, parent=seat)
box("SEAT_HEADREST_LIGHT", (0.16, 0.02, 0.045), (-0.1, -0.36, 1.7), S, "CM_AMBER", bevel=0.01, parent=seat)
lg = torus("SEAT_LOGO_RING", 0.05, 0.006, (0.12, -0.355, 1.69), S, "CM_PANEL_MID", rot=(math.pi / 2, 0.3, 0),
           maj=32, minr=6, parent=seat)
lg.scale = (1, 1, 0.45)
cyl("SEAT_LOGO_PLANET", 0.026, 0.012, (0.12, -0.355, 1.69), S, "CM_PANEL_MID", rot=(math.pi / 2, 0, 0), verts=16,
    parent=seat)
box("SEAT_LOWER_LIGHT", (0.2, 0.012, 0.03), (0.0, 0.38, 0.5), S, "CM_AMBER", bevel=0.006, parent=seat)

# ───────────────────────── zona trasera: acceso y módulos ─────────────────────────
YB = Y_REAR + 0.06
bm = bmesh.new()
outer = [bm.verts.new((x, YB, z)) for x, z in [(-2.2, FLOOR_Z)] + outline[1:-1] + [(2.2, FLOOR_Z)]]
bm.faces.new(outer)
me = bpy.data.meshes.new("REAR_WALL")
bm.to_mesh(me)
bm.free()
rw = bpy.data.objects.new("REAR_WALL", me)
scene.collection.objects.link(rw)
finish(rw, "REAR", "CM_PANEL_LIGHT")
# puerta octogonal con marco iluminado
box("DOOR_FRAME", (1.6, 0.16, 2.3), (0, YB + 0.08, FLOOR_Z + 1.15), "REAR", "CM_PANEL_MID", bevel=0.12, segs=3)
box("DOOR", (1.1, 0.1, 1.95), (0, YB + 0.14, FLOOR_Z + 1.0), "REAR", "CM_PANEL_DARK", bevel=0.08, segs=3)
box("DOOR_WINDOW", (0.42, 0.04, 0.14), (0, YB + 0.2, FLOOR_Z + 1.5), "REAR", "CM_AMBER", bevel=0.02)
box("DOOR_PANEL", (0.7, 0.03, 0.6), (0, YB + 0.2, FLOOR_Z + 0.6), "REAR", "CM_PANEL_MID", bevel=0.02)
for sx in (-1, 1):
    box(f"DOOR_LIGHT_{sx}", (0.04, 0.05, 0.42), (sx * 0.7, YB + 0.18, FLOOR_Z + 1.15), "REAR", "CM_AMBER", bevel=0.01)
    # taquillas
    box(f"LOCKER_{sx}", (0.7, 0.4, 1.7), (sx * 1.35, YB + 0.22, FLOOR_Z + 0.85), "REAR",
        "CM_PANEL_WHITE" if sx > 0 else "CM_PANEL_DARK", bevel=0.03)
    for r in range(3):
        box(f"LOCKER_{sx}_HANDLE_{r}", (0.12, 0.03, 0.025), (sx * 1.35, YB + 0.43, FLOOR_Z + 0.4 + r * 0.5), "REAR",
            "CM_AMBER", bevel=0.006)
    # maletas de equipo
    case = box(f"CASE_{sx}", (0.75, 0.45, 0.48), (sx * 1.9, YB + 0.9, FLOOR_Z + 0.24), "REAR", "CM_PANEL_LIGHT",
               bevel=0.04)
    for b in (-0.2, 0.2):
        box(f"CASE_{sx}_BAND_{b}", (0.06, 0.47, 0.5), (sx * 1.9 + b, YB + 0.9, FLOOR_Z + 0.24), "REAR", "CM_ORANGE",
            bevel=0.012)
    box(f"CASE_{sx}_HANDLE", (0.24, 0.05, 0.04), (sx * 1.9, YB + 0.9, FLOOR_Z + 0.5), "REAR", "CM_PANEL_DARK",
        bevel=0.01)

# ───────────────────────── luces y cámaras de control (no se exportan) ─────────────────────────
def add_light(name, kind, loc, energy, color=(1, 0.9, 0.8), size=1.0, rot=(0, 0, 0)):
    ld = bpy.data.lights.new(name, kind)
    ld.energy, ld.color = energy, color
    if kind == "AREA":
        ld.size = size
    o = bpy.data.objects.new(name, ld)
    coll("PREVIEW").objects.link(o)
    o.location, o.rotation_euler = loc, rot
    return o


add_light("PV_KEY", "AREA", (0, 0.5, 1.95), 260, (1, 0.93, 0.85), 2.4)
add_light("PV_WINDOW", "AREA", (0, 3.0, 1.0), 120, (1, 0.65, 0.35), 2.5, rot=(math.radians(90), 0, 0))
add_light("PV_LANTERN_L", "POINT", (-2.25, 1.55, -0.05), 25, (1, 0.7, 0.35))
add_light("PV_LANTERN_R", "POINT", (2.25, 1.45, -0.05), 25, (1, 0.7, 0.35))
add_light("PV_FILL", "AREA", (0, -2.5, 1.2), 120, (0.85, 0.9, 1.0), 3.0, rot=(math.radians(-80), 0, 0))
w = bpy.data.worlds.new("PV_WORLD")
scene.world = w
w.use_nodes = True
bg = next(nd for nd in w.node_tree.nodes if nd.type == "BACKGROUND")
bg.inputs[0].default_value = (0.01, 0.012, 0.03, 1)
bg.inputs[1].default_value = 1.0


def cam(name, loc, target, lens=18):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    o = bpy.data.objects.new(name, cd)
    coll("PREVIEW").objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


# FOV vertical de la web (55°, 16:9) ≈ 21 mm sobre sensor de 36 mm
CAM_HUB = cam("PV_CAM_HUB", (0.35, -0.95, 0.42), (0.1, 3.4, -0.05), lens=19)
cam("PV_CAM_FRONT", (0, -1.4, 0.3), (0, 3.4, 0.1), lens=21)
cam("PV_CAM_SIDE", (2.1, -1.2, 0.6), (-0.6, 2.4, -0.2), lens=21)
cam("PV_CAM_REAR", (0, 1.0, 0.4), (0, -3.4, 0.1), lens=21)

# ───────────────────────── guardar, exportar, renderizar ─────────────────────────
os.makedirs(os.path.join(BASE, "renders"), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "CabinCM01.blend"))
stats = {"objects": len([o for o in bpy.data.objects if o.type == "MESH"]),
         "anchors": sorted(o.name for o in bpy.data.objects if o.name.startswith("ANCHOR_"))}

if "--no-export" not in ARGS:
    for o in bpy.context.view_layer.objects:
        o.select_set(o.users_collection[0].name != "PREVIEW" and o.type in ("MESH", "EMPTY"))
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_animations=False, export_lights=False, export_cameras=False)
    stats["glb_bytes"] = os.path.getsize(GLB)

if "--render" in ARGS:
    scene.render.engine = "BLENDER_EEVEE"
    try:
        scene.view_settings.view_transform = "AgX"
    except TypeError:
        pass
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.eevee.taa_render_samples = 32
    for cname in ("PV_CAM_HUB", "PV_CAM_FRONT", "PV_CAM_SIDE", "PV_CAM_REAR"):
        scene.camera = bpy.data.objects[cname]
        scene.render.filepath = os.path.join(BASE, "renders", cname.replace("PV_CAM_", "Cabin_") + ".png")
        bpy.ops.render.render(write_still=True)
print("CABIN_BUILD", stats)
