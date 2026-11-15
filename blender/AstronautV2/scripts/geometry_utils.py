"""Astronauta V2 — utilidades de geometría procedural (bpy/bmesh). Todas implementadas aquí."""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from config import *

TAU = math.tau
MOD_KEY = "astro_module"


# ───────────────────────── colecciones / idempotencia ─────────────────────────
def create_collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def col(name):
    return bpy.data.collections[name]


def clear_module(module):
    """Borra solo los objetos etiquetados con este módulo (no toca nada ajeno)."""
    for o in list(bpy.data.objects):
        if o.get(MOD_KEY) == module:
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if data is not None and data.users == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Curve):
                    bpy.data.curves.remove(data)


def tag(obj, module):
    obj[MOD_KEY] = module
    return obj


# ───────────────────────── mallas base ─────────────────────────
def create_mesh(name, verts, faces, collection, material=None, module="", smooth=True,
                merge=1e-6, recalc=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    if merge:
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    collection.objects.link(obj)
    if material:
        obj.data.materials.append(material)
    if module:
        tag(obj, module)
    for p in obj.data.polygons:
        p.use_smooth = smooth
    return obj


def grid_mesh(name, fn, ni, nj, collection, material=None, module="", closed_j=False, **kw):
    cols = nj if closed_j else nj + 1
    verts, faces = [], []
    for i in range(ni + 1):
        for j in range(cols):
            verts.append(fn(i, j))
    for i in range(ni):
        for j in range(nj):
            j2 = (j + 1) % cols
            if not closed_j and j + 1 >= cols:
                continue
            faces.append([i * cols + j, i * cols + j2, (i + 1) * cols + j2, (i + 1) * cols + j])
    return create_mesh(name, verts, faces, collection, material, module, **kw)


def loft(name, rings, collection, material=None, module="", cap_start=True, cap_end=True, **kw):
    """Une anillos (listas de Vector con igual número de puntos) en una superficie cerrada."""
    n = len(rings[0])
    verts = [v for r in rings for v in r]
    faces = []
    for i in range(len(rings) - 1):
        for s in range(n):
            s2 = (s + 1) % n
            faces.append([i * n + s, i * n + s2, (i + 1) * n + s2, (i + 1) * n + s])
    extra = []
    if cap_start:
        c = sum(rings[0], Vector()) / n
        verts.append(c)
        ci = len(verts) - 1
        faces += [[ci, (s + 1) % n, s] for s in range(n)]
    if cap_end:
        c = sum(rings[-1], Vector()) / n
        verts.append(c)
        ci = len(verts) - 1
        b = (len(rings) - 1) * n
        faces += [[ci, b + s, b + (s + 1) % n] for s in range(n)]
    return create_mesh(name, verts, faces, collection, material, module, **kw)


def ring_points(center, ax, ay, rx, ry, seg=32, n=2.0, rfn=None):
    """Anillo superelíptico en el plano (ax, ay) alrededor de center. rfn(angle)->escala radial."""
    pts = []
    for s in range(seg):
        a = TAU * s / seg
        c, si = math.cos(a), math.sin(a)
        x = rx * math.copysign(abs(c) ** (2 / n), c)
        y = ry * math.copysign(abs(si) ** (2 / n), si)
        k = rfn(a) if rfn else 1.0
        pts.append(Vector(center) + ax * x * k + ay * y * k)
    return pts


def create_surface_of_revolution(name, profile, collection, material=None, module="", segments=64,
                                 closed=False, **kw):
    """profile=[(r, h)] alrededor de Z local. closed: perfil cerrado (anillos, toros)."""
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
    if not closed:
        for idx in (0, n - 1):
            if profile[idx][0] > 1e-6:
                faces.append([idx * segments + s for s in range(segments)])
    return create_mesh(name, verts, faces, collection, material, module, **kw)


def orient_object(obj, origin, axis):
    """Coloca un objeto creado alrededor de Z local para que su Z apunte a 'axis' desde 'origin'."""
    q = Vector(axis).normalized().to_track_quat('Z', 'Y')
    obj.matrix_world = Matrix.Translation(Vector(origin)) @ q.to_matrix().to_4x4()
    return obj


def create_rounded_box(name, half, collection, material=None, module="", n=6.0, nz=None,
                       center=(0, 0, 0), rot=None, seg_u=48, seg_v=24, taper=None):
    """Caja redondeada como superelipsoide (|x/a|^n+|y/b|^n)^(..)+|z/c|^nz=1.
    taper(zn)->(sx, sy) escala la sección según z normalizado (-1..1)."""
    a, b, c = half
    nz = nz or n
    verts, faces = [], []
    for i in range(seg_v + 1):
        v = -math.pi / 2 + math.pi * i / seg_v
        cv, sv = math.cos(v), math.sin(v)
        for j in range(seg_u):
            u = TAU * j / seg_u
            cu, su = math.cos(u), math.sin(u)
            ex, ez = 2 / n, 2 / nz
            x = a * math.copysign(abs(cv) ** ez, cv) * math.copysign(abs(cu) ** ex, cu)
            y = b * math.copysign(abs(cv) ** ez, cv) * math.copysign(abs(su) ** ex, su)
            z = c * math.copysign(abs(sv) ** ez, sv)
            if taper:
                sx, sy = taper(z / c)
                x, y = x * sx, y * sy
            verts.append(Vector((x, y, z)))
    for i in range(seg_v):
        for j in range(seg_u):
            j2 = (j + 1) % seg_u
            faces.append([i * seg_u + j, i * seg_u + j2, (i + 1) * seg_u + j2, (i + 1) * seg_u + j])
    o = create_mesh(name, verts, faces, collection, material, module, merge=1e-5)
    m = Matrix.Translation(Vector(center))
    if rot:
        m = m @ Matrix(rot).to_4x4() if not isinstance(rot, Matrix) else m @ rot.to_4x4()
    o.matrix_world = m
    return o


# ───────────────────────── trayectorias ─────────────────────────
def catmull_rom(points, samples_per_seg=12):
    P = [Vector(p) for p in points]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(samples_per_seg):
            t = k / samples_per_seg
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
                              (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


def path_frames(pts, up_hint=Vector((0, 0, 1))):
    """Marcos por transporte paralelo: [(T, N, B)]."""
    T = []
    for i in range(len(pts)):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        T.append((b - a).normalized())
    n = up_hint - T[0] * up_hint.dot(T[0])
    if n.length < 1e-4:
        n = Vector((1, 0, 0)) - T[0] * T[0].x
    n.normalize()
    frames = []
    for i, t in enumerate(T):
        if i:
            n = n - t * n.dot(t)
            n.normalize()
        frames.append((t, n, t.cross(n)))
    return frames


def path_lengths(pts):
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + (pts[i] - pts[i - 1]).length)
    return L


def create_hose(name, ctrl_pts, radius, collection, material=None, module="", pitch=0.045,
                amp=0.18, seg=20, samples=14):
    """Conducto corrugado: tubo sobre Catmull-Rom con radio modulado periódicamente."""
    pts = catmull_rom(ctrl_pts, samples)
    # remuestreo fino para corrugación regular
    L = path_lengths(pts)
    total = L[-1]
    steps = max(8, int(total / (pitch / 6)))
    fine = []
    k = 0
    for s in range(steps + 1):
        d = total * s / steps
        while k < len(L) - 2 and L[k + 1] < d:
            k += 1
        t = (d - L[k]) / max(L[k + 1] - L[k], 1e-9)
        fine.append(pts[k].lerp(pts[k + 1], t))
    frames = path_frames(fine)
    Lf = path_lengths(fine)
    rings = []
    for p, (t, nrm, bnm), d in zip(fine, frames, Lf):
        ph = (d / pitch) % 1.0
        r = radius * (1 - amp + amp * (math.sin(math.pi * ph) ** 0.6))
        rings.append(ring_points(p, nrm, bnm, r, r, seg))
    return loft(name, rings, collection, material, module)


def sweep_rect(name, pts, ups, w, th, collection, material=None, module="", n=5.0, seg=12):
    """Correa: sección rectangular redondeada barrida por pts; ups = normales hacia fuera."""
    rings = []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        t = (b - a).normalized()
        u = Vector(ups[i])
        u = (u - t * u.dot(t)).normalized()
        s = t.cross(u)
        rings.append(ring_points(p + u * th / 2, s, u, w / 2, th / 2, seg, n))
    return loft(name, rings, collection, material, module)


def create_padded_segment(name, p0, p1, r0, r1, collection, material=None, module="", rolls=3,
                          depth=0.06, seg=40, rows_per_roll=10, squash=1.0, bulge=0.04, end_round=0.35,
                          up=Vector((0, -1, 0))):
    """Segmento acolchado: tubo de p0 a p1, radio r0→r1, con 'rolls' almohadillas separadas por surcos.
    end_round redondea los extremos (fracción del radio)."""
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0)
    Ln = ax.length
    ax.normalize()
    u = Vector(up) - ax * Vector(up).dot(ax)
    if u.length < 1e-4:
        u = Vector((1, 0, 0)) - ax * ax.x
    u.normalize()
    v = ax.cross(u)
    rows = rolls * rows_per_roll
    rings = []
    for i in range(rows + 1):
        t = i / rows
        r = r0 + (r1 - r0) * t
        ph = (t * rolls) % 1.0
        pad = (math.sin(math.pi * ph) ** 0.45) if 0 < ph else 0.0
        r *= (1 - depth) + depth * pad
        r *= 1 + bulge * math.sin(math.pi * t)
        # redondeo de extremos
        e = min(t, 1 - t) * Ln
        er = end_round * r
        if e < er:
            r *= math.sqrt(max(0.0, 1 - ((er - e) / er) ** 2)) * 0.35 + 0.65
        rings.append(ring_points(p0 + ax * (Ln * t), u, v, r * squash, r, seg))
    return loft(name, rings, collection, material, module)


def create_curve(name, points, collection, material=None, module="", bevel=0.004, res=6):
    """Curva poly con grosor (costuras finas)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (*q, 1.0)
    o = bpy.data.objects.new(name, cu)
    collection.objects.link(o)
    if material:
        cu.materials.append(material)
    if module:
        tag(o, module)
    return o


# ───────────────────────── modificadores ─────────────────────────
def add_bevel(obj, width, segments=2, angle=35):
    m = obj.modifiers.new("Bevel", 'BEVEL')
    m.width, m.segments = width, segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    return m


def add_solidify(obj, thickness, offset=-1.0):
    m = obj.modifiers.new("Solidify", 'SOLIDIFY')
    m.thickness, m.offset = thickness, offset
    return m


def add_subsurf(obj, level=1):
    m = obj.modifiers.new("Subsurf", 'SUBSURF')
    m.levels = m.render_levels = level
    return m


def add_weighted_normal(obj):
    m = obj.modifiers.new("WeightedNormal", 'WEIGHTED_NORMAL')
    m.keep_sharp = True
    return m


# ───────────────────────── superficie del casco ─────────────────────────
HC = Vector(C["helmet_center"])
HX, HY, HZ = C["helmet_rx"], C["helmet_ry"], C["helmet_rz"]


def helmet_dir(d, off=0.0):
    d = Vector(d).normalized()
    p = Vector((HX * d.x, HY * d.y, HZ * d.z))
    if off:
        p += helmet_normal(p) * off
    return HC + p


def helmet_normal(p_local):
    return Vector((p_local.x / HX ** 2, p_local.y / HY ** 2, p_local.z / HZ ** 2)).normalized()


def helmet_pt(theta, phi, off=0.0):
    """theta desde +Z, phi desde +X hacia +Y (frente = -90°)."""
    d = Vector((math.sin(theta) * math.cos(phi), math.sin(theta) * math.sin(phi), math.cos(theta)))
    return helmet_dir(d, off)


def helmet_front(x, z, off=0.0):
    """Punto de la cara frontal (-Y) del casco en (x, z) locales."""
    t = 1 - (x / HX) ** 2 - (z / HZ) ** 2
    p = Vector((x, -HY * math.sqrt(max(t, 0.0)), z))
    if off:
        p += helmet_normal(p) * off
    return HC + p


# visor
VA, VB, VN, VZ = C["visor_a"], C["visor_b"], C["visor_n"], C["visor_cz"]


def superellipse(t, a, b, n):
    c, s = math.cos(t), math.sin(t)
    return a * math.copysign(abs(c) ** (2 / n), c), b * math.copysign(abs(s) ** (2 / n), s)


def visor_r(x, z):
    return ((abs(x) / VA) ** VN + (abs(z - VZ) / VB) ** VN) ** (1 / VN)


def visor_lift(r):
    return 0.010 + C["visor_bulge"] * max(0.0, 1 - min(r, 1.0) ** 2)


def visor_pt(r, t, extra=0.0):
    x, z = superellipse(t, VA, VB, VN)
    x, z = x * r, z * r + VZ
    return helmet_front(x, z, visor_lift(r) + extra)


def visor_surface(x, z, extra=0.0):
    return helmet_front(x, z, visor_lift(visor_r(x, z)) + extra)


# ───────────────────────── superficie del torso ─────────────────────────
# (z, semiancho, semifondo, desplazamiento y) — leído de las vistas frontal y lateral
TORSO_PROFILE = [
    (0.98, 0.18, 0.14, 0.00),
    (1.04, 0.34, 0.25, 0.00),
    (1.10, 0.415, 0.285, 0.00),
    (1.20, 0.430, 0.295, 0.00),
    (1.32, 0.420, 0.290, 0.00),
    (1.45, 0.445, 0.300, -0.005),
    (1.60, 0.485, 0.310, -0.01),
    (1.73, 0.500, 0.312, -0.01),
    (1.83, 0.470, 0.300, -0.005),
    (1.90, 0.380, 0.265, 0.00),
    (1.95, 0.240, 0.195, 0.00),
    (1.985, 0.18, 0.155, 0.00),
]
TORSO_N = 2.5


def torso_section(z):
    P = TORSO_PROFILE
    if z <= P[0][0]:
        return P[0][1:]
    for a, b in zip(P, P[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            t = t * t * (3 - 2 * t)
            return tuple(a[k] + (b[k] - a[k]) * t for k in (1, 2, 3))
    return P[-1][1:]


def torso_pt(z, ang, off=0.0):
    """ang: 0 = +X, -90° = frente (-Y)."""
    w, d, yo = torso_section(z)
    c, s = math.cos(ang), math.sin(ang)
    x = w * math.copysign(abs(c) ** (2 / TORSO_N), c)
    y = d * math.copysign(abs(s) ** (2 / TORSO_N), s) + yo
    p = Vector((x, y, z))
    if off:
        nrm = Vector((x / w ** 2, (y - yo) / d ** 2, 0)).normalized()
        p += nrm * off
    return p


def torso_normal(z, ang):
    w, d, yo = torso_section(z)
    p = torso_pt(z, ang)
    return Vector((p.x / w ** 2, (p.y - yo) / d ** 2, 0)).normalized()


def torso_front_pt(x, z, off=0.0, back=False):
    """Punto del torso en (x, z) delante (o detrás) por búsqueda del ángulo."""
    w, d, yo = torso_section(z)
    best, ba = 9, -math.pi / 2
    base = math.pi / 2 if back else -math.pi / 2
    for k in range(-90, 91):
        a = base + math.radians(k)
        e = abs(torso_pt(z, a).x - x)
        if e < best:
            best, ba = e, a
    return torso_pt(z, ba, off), torso_normal(z, ba)


# ───────────────────────── controladores ─────────────────────────
def create_controller(name, collection, display='PLAIN_AXES', size=0.2, location=(0, 0, 0), module="rig"):
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, None)
        collection.objects.link(o)
    o.empty_display_type = display
    o.empty_display_size = size
    o.location = location
    tag(o, module)
    return o


# ───────────────────────── render / checkpoints ─────────────────────────
def render_camera(cam_name, filepath, res=None):
    import os
    sc = bpy.context.scene
    old = (sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath)
    sc.camera = bpy.data.objects[cam_name]
    if res:
        sc.render.resolution_x = sc.render.resolution_y = res
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    sc.render.filepath = filepath
    bpy.ops.render.render(write_still=True)
    sc.camera, sc.render.resolution_x, sc.render.resolution_y, sc.render.filepath = old
    return filepath


def save_checkpoint(name):
    import os
    path = os.path.join(CHECKPOINTS_DIR, name)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True)
    return path


def refresh_drivers():
    """Reevalúa todos los drivers del proyecto y devuelve los que siguen siendo inválidos."""
    ids = list(bpy.data.objects) + list(bpy.data.lights) + [m.node_tree for m in bpy.data.materials if m.node_tree]
    fcs = []
    for idb in ids:
        ad = getattr(idb, "animation_data", None)
        if ad:
            for fc in ad.drivers:
                fc.driver.is_valid = True
                fc.driver.expression = fc.driver.expression
                fcs.append((idb, fc))
    sc = bpy.context.scene
    sc.frame_set(sc.frame_current)
    bpy.context.view_layer.update()
    return [(idb.name, fc.data_path) for idb, fc in fcs if not fc.driver.is_valid], len(fcs)
