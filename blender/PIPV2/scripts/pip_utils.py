"""PIP V2 — utilidades reutilizables (bpy)."""
import math
import bpy
import bmesh
from mathutils import Vector
from pip_config import *

TAU = math.tau


# ───────────────────────── color ─────────────────────────
def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_color):
    h = hex_color.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return (*[srgb_to_linear(c) for c in rgb], 1.0)


# ───────────────────────── colecciones ─────────────────────────
def create_collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(col)
    return col


def move_object_to_collection(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def clear_module(module):
    """Idempotencia: borra solo objetos etiquetados con este módulo."""
    for o in list(bpy.data.objects):
        if o.get("pip_module") == module:
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if data and getattr(data, "users", 1) == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)


def col(path):
    """Obtiene una colección por nombre (creada en 00_initialize)."""
    return bpy.data.collections[path]


# ───────────────────────── materiales ─────────────────────────
def _pr(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _set(node, name, val):
    s = node.inputs.get(name)
    if s is not None:
        s.default_value = val


def create_material(name, hex_color, metallic=0.0, roughness=0.4, coat=0.0, coat_rough=0.15):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    p = _pr(mat)
    _set(p, "Base Color", hex_to_linear_rgba(hex_color))
    _set(p, "Metallic", metallic)
    _set(p, "Roughness", roughness)
    _set(p, "Coat Weight", coat)
    _set(p, "Coat Roughness", coat_rough)
    mat.diffuse_color = hex_to_linear_rgba(hex_color)
    return mat


def create_emission_material(name, hex_color, strength=4.0):
    """Material emisivo: nodo Emission llamado EMIT (strength = inputs[1])."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.name = "EMIT"
    em.inputs[0].default_value = hex_to_linear_rgba(hex_color)
    em.inputs[1].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    mat.diffuse_color = hex_to_linear_rgba(hex_color)
    return mat


def mat(name):
    return bpy.data.materials[name]


# ───────────────────────── mallas ─────────────────────────
def create_mesh(name, verts, faces, collection, material=None, module="", smooth=True,
                merge=1e-5, recalc=True, location=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    if merge:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-7)
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location = location
    collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    if module:
        obj["pip_module"] = module
    set_smooth_shading(obj, smooth)
    return obj


def set_smooth_shading(obj, smooth=True):
    for p in obj.data.polygons:
        p.use_smooth = smooth


def grid_mesh(name, fn, ni, nj, collection, material=None, module="", closed_j=False,
              closed_i=False, **kw):
    """Malla (ni+1)x(nj+1 | nj) con fn(i,j)->Vector. j puede cerrarse (anillo)."""
    cols = nj if closed_j else nj + 1
    verts, faces = [], []
    for i in range(ni + 1):
        for j in range(cols):
            verts.append(fn(i, j))
    for i in range(ni):
        for j in range(nj if closed_j else nj):
            j2 = (j + 1) % cols
            if not closed_j and j + 1 >= cols:
                continue
            a = i * cols + j
            b = i * cols + j2
            c = (i + 1) * cols + j2
            d = (i + 1) * cols + j
            faces.append([a, b, c, d])
    return create_mesh(name, verts, faces, collection, material, module, **kw)


def create_revolved_mesh(name, profile, collection, material=None, module="", segments=64,
                         closed=False, **kw):
    """Superficie de revolución alrededor de Z local. profile=[(r,h)...].
    closed=True une el último punto con el primero (perfil cerrado, p.ej. anillo)."""
    n = len(profile)
    verts, faces = [], []
    for (r, h) in profile:
        for s in range(segments):
            a = TAU * s / segments
            verts.append((r * math.cos(a), r * math.sin(a), h))
    rows = n if closed else n - 1
    for i in range(rows):
        i2 = (i + 1) % n
        for s in range(segments):
            s2 = (s + 1) % segments
            faces.append([i * segments + s, i * segments + s2, i2 * segments + s2, i2 * segments + s])
    # tapas si el perfil no toca el eje en sus extremos
    if not closed:
        for idx in (0, n - 1):
            if profile[idx][0] > 1e-6:
                faces.append([idx * segments + s for s in range(segments)])
    return create_mesh(name, verts, faces, collection, material, module, **kw)


def add_bevel(obj, width, segments=2, angle=35, name="Mechanical_Bevel"):
    m = obj.modifiers.new(name, 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    return m


def add_solidify(obj, thickness, offset=-1.0, name="Shell_Solidify"):
    m = obj.modifiers.new(name, 'SOLIDIFY')
    m.thickness = thickness
    m.offset = offset
    return m


def add_subsurf(obj, level=2, name="Subsurf"):
    m = obj.modifiers.new(name, 'SUBSURF')
    m.levels = level
    m.render_levels = level
    return m


# ───────────────────────── superficie del cuerpo ─────────────────────────
def ell_pt(theta, phi, off=0.0):
    """Punto del elipsoide por (theta desde +Z, phi desde +X hacia +Y) + offset normal."""
    d = Vector((math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)))
    return dir_to_surface(d, off)


def dir_to_surface(d, off=0.0):
    d = Vector(d).normalized()
    p = Vector((RX * d.x, RY * d.y, RZ * d.z))
    if off:
        p += ell_normal(p) * off
    return p


def ell_normal(p):
    return Vector((p.x / RX ** 2, p.y / RY ** 2, p.z / RZ ** 2)).normalized()


def front_pt(x, z, off=0.0):
    """Superficie frontal (-Y) del elipsoide en (x,z) + offset normal."""
    t = 1.0 - (x / RX) ** 2 - (z / RZ) ** 2
    y = -RY * math.sqrt(max(t, 0.0))
    p = Vector((x, y, z))
    return p + ell_normal(p) * off if off else p


def rear_pt(x, z, off=0.0):
    p = front_pt(x, z, 0.0)
    p.y = -p.y
    return p + ell_normal(p) * off if off else p


def superellipse(t, a, b, n):
    c, s = math.cos(t), math.sin(t)
    return (a * math.copysign(abs(c) ** (2 / n), c), b * math.copysign(abs(s) ** (2 / n), s))


# visor
VA = RX * C["visor_width_ratio"] * 0.96      # semianchura
VB = RZ * C["visor_height_ratio"] * 0.93     # semialtura
VN = C["visor_superellipse_n"]
VN_TOP = C.get("visor_superellipse_n_top", VN)
VZ = C["visor_center_z"]


def visor_n(upper):
    return VN_TOP if upper else VN


def visor_xz(r, t):
    x, z = superellipse(t, VA, VB, visor_n(math.sin(t) >= 0))
    return x * r, z * r + VZ


def visor_height(r):
    """Altura normal sobre la carcasa en función del radio normalizado."""
    return C["visor_edge_lift"] + C["visor_bulge"] * max(0.0, 1 - min(r, 1.0) ** 2)


def visor_pt(r, t, extra=0.0):
    x, z = visor_xz(r, t)
    return front_pt(x, z, visor_height(r) + extra)


def visor_norm_r(x, z):
    """Radio normalizado (superelipse) de un punto (x,z) respecto al visor."""
    n = visor_n(z >= VZ)
    return ((abs(x) / VA) ** n + (abs(z - VZ) / VB) ** n) ** (1 / n)


def face_pt(x, z, extra=0.004):
    """Punto de la superficie del visor en (x,z), para elementos faciales."""
    r = visor_norm_r(x, z)
    return front_pt(x, z, visor_height(r) + extra)


# ───────────────────────── rig / cámaras ─────────────────────────
def create_controller(name, collection, display='PLAIN_AXES', size=0.3, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.get(name)
    if e is None:
        e = bpy.data.objects.new(name, None)
        collection.objects.link(e)
    e.empty_display_type = display
    e.empty_display_size = size
    e.location = location
    if parent:
        e.parent = parent
    e["pip_module"] = "rig"
    return e


def parent_keep_transform(child, parent):
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    child.matrix_world = mw


def point_camera_at(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def create_camera(name, loc, target, collection, lens=85.0, ortho=False, ortho_scale=3.4):
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cd.lens = lens
    cd.type = 'ORTHO' if ortho else 'PERSP'
    cd.ortho_scale = ortho_scale
    cd.clip_end = 100
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, cd)
        collection.objects.link(o)
    o.location = loc
    point_camera_at(o, target)
    return o


def inspect_mesh(obj):
    if obj.type != 'MESH':
        return None
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    r = {"name": obj.name, "verts": len(bm.verts), "faces": len(bm.faces),
         "non_manifold_edges": sum(1 for e in bm.edges if not e.is_manifold),
         "degenerate_faces": sum(1 for f in bm.faces if f.calc_area() < 1e-10),
         "materials": len(obj.data.materials)}
    bm.free()
    return r
