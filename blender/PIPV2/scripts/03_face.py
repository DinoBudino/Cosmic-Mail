"""03 — rostro emisivo. Expresiones copiadas de la ficha ("Expresiones de visor") + variante de la vista principal."""
from pip_utils import *

M = "face"
clear_module(M)
fc = col("03_FACE")
ctrl_col = col("00_CONTROLLERS")

PIV = face_pt(0, VZ, 0.0)
EYE_Z = VZ + 0.005          # altura de ojos (ficha: ligeramente por encima del centro)
MOUTH_Z = VZ - 0.175
EX = 0.355                   # separación horizontal de ojos
ER = 0.108                  # radio de ojo
# Hoja de expresiones de la ficha: ámbar. Vista principal: blanco rosado.
MAT_E = mat("MAT_FACE_EMISSION")
MAT_M = mat("MAT_MOUTH_EMISSION")
for _m, _c in ((MAT_E, "#FFC768"), (MAT_M, "#FFB54F")):
    _m.node_tree.nodes["EMIT"].inputs[0].default_value = hex_to_linear_rgba(_c)
MAT_EP = create_emission_material("MAT_FACE_EMISSION_PRINCIPAL", "#FFE6E6", 6.0)
MAT_MP = create_emission_material("MAT_MOUTH_EMISSION_PRINCIPAL", "#FFE0E0", 6.0)


FS = VA / 0.792             # el rostro se diseñó para el visor anterior: escala proporcional


def P(x, z, e):
    return face_pt(FS * x, VZ + FS * (z - VZ), e) - PIV


def mk(name, verts, faces, material, parent):
    o = create_mesh(name, verts, faces, fc, material, M, merge=0, recalc=False)
    o.location = (0, 0, 0)      # geometría ya relativa al pivote CTRL_FACE
    o.parent = parent
    o["face_part"] = True
    return o


def fan_rings(name, center, pts, material, parent, e, nr=4):
    n = len(pts)
    cx, cz = center
    v = [P(cx, cz, e)]
    for r in range(1, nr + 1):
        k = r / nr
        for (x, z) in pts:
            v.append(P(cx + (x - cx) * k, cz + (z - cz) * k, e))
    f = [[0, 1 + j, 1 + (j + 1) % n] for j in range(n)]
    for r in range(1, nr):
        a0, a1 = 1 + (r - 1) * n, 1 + r * n
        f += [[a0 + j, a0 + (j + 1) % n, a1 + (j + 1) % n, a1 + j] for j in range(n)]
    return mk(name, v, f, material, parent)


def disc(name, cx, cz, r, parent, material=None, e=0.004, n=40):
    pts = [(cx + r * math.cos(TAU * k / n), cz + r * math.sin(TAU * k / n)) for k in range(n)]
    return fan_rings(name, (cx, cz), pts, material or MAT_E, parent, e)


def arc(name, cx, cz, R, a0, a1, w, parent, material=None, e=0.004, n=28):
    """Arco con grosor casi constante y extremos suavizados."""
    v, f = [], []
    for k in range(n + 1):
        a = a0 + (a1 - a0) * k / n
        t = 0.62 + 0.38 * math.sin(math.pi * k / n)
        for s in (-0.5, 0.5):
            rr = R + s * w * t
            v.append(P(cx + rr * math.cos(a), cz + rr * math.sin(a), e))
    for k in range(n):
        f.append([2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1])
    return mk(name, v, f, material or MAT_E, parent)


def smile_d(name, cx, cz, R, parent, h=0.78, e=0.004, n=28):
    """Sonrisa rellena en D: borde superior recto, curva inferior (como en la ficha)."""
    pts = [(cx + R * math.cos(math.pi + math.pi * k / n), cz + R * h * math.sin(math.pi + math.pi * k / n)) for k in range(n + 1)]
    return fan_rings(name, (cx, cz - 0.30 * R * h), pts, MAT_M, parent, e)


def ring(name, cx, cz, R, w, parent, e=0.004, n=40):
    v = []
    for k in range(n):
        a = TAU * k / n
        for rr in (R - w / 2, R + w / 2):
            v.append(P(cx + rr * math.cos(a), cz + rr * math.sin(a), e))
    f = [[2 * k, 2 * ((k + 1) % n), 2 * ((k + 1) % n) + 1, 2 * k + 1] for k in range(n)]
    return mk(name, v, f, MAT_M, parent)


def bar(name, x0, z0, x1, z1, w, parent, e=0.004, seg=6):
    d = Vector((x1 - x0, 0, z1 - z0))
    nrm = Vector((-d.z, 0, d.x)).normalized() * w / 2
    v = []
    for k in range(seg + 1):
        t = k / seg
        cx, cz = x0 + (x1 - x0) * t, z0 + (z1 - z0) * t
        for s in (-1, 1):
            v.append(P(cx + nrm.x * s, cz + nrm.z * s, e))
    f = [[2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1] for k in range(seg)]
    return mk(name, v, f, MAT_M, parent)


# ─────────── controlador facial ───────────
ctrl = bpy.data.objects.get("CTRL_FACE")
if ctrl is None:
    ctrl = bpy.data.objects.new("CTRL_FACE", None)
    ctrl_col.objects.link(ctrl)
ctrl.empty_display_type = 'CIRCLE'
ctrl.empty_display_size = 0.12
ctrl.location = PIV
ctrl.parent = None
ctrl["pip_module"] = "rig"
N_EXP = len(EXPRESSIONS)
for k, v in (("face_expression", N_EXP), ("eye_brightness", 1.0), ("mouth_brightness", 1.0),
             ("face_scale", 1.0), ("face_offset_x", 0.0), ("face_offset_z", 0.0)):
    ctrl[k] = v
ctrl.id_properties_ui("face_expression").update(min=1, max=N_EXP, soft_min=1, soft_max=N_EXP)
ctrl.id_properties_ui("eye_brightness").update(min=0.0, max=3.0)
ctrl.id_properties_ui("mouth_brightness").update(min=0.0, max=3.0)
ctrl.id_properties_ui("face_scale").update(min=0.5, max=1.5)
ctrl.id_properties_ui("face_offset_x").update(min=-0.12, max=0.12)
ctrl.id_properties_ui("face_offset_z").update(min=-0.12, max=0.12)

roots = {}
for i in range(1, N_EXP + 1):
    e = bpy.data.objects.new(EXPRESSIONS[i - 1], None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.05
    e["pip_module"] = M
    fc.objects.link(e)
    e.parent = ctrl
    roots[i] = e


def eyes_dots(n, p, r=ER, dy=0.0, dx=EX):
    disc(f"{n}_EyeL", -dx, EYE_Z + dy, r, p)
    disc(f"{n}_EyeR", dx, EYE_Z + dy, r, p)


def eye_arch(n, side, p, R=0.090, w=0.048, dy=0.0, lower=False):
    """Ojo en arco: ^ (feliz) o ∪ (satisfecho)."""
    cx = side * EX
    nm = f"{n}_Eye{'L' if side < 0 else 'R'}"
    if lower:
        arc(nm, cx, EYE_Z + dy + R * 0.7, R, math.radians(215), math.radians(325), w, p)
    else:
        arc(nm, cx, EYE_Z + dy - R * 0.7, R, math.radians(35), math.radians(145), w, p)


# 01 NEUTRAL / EN REPOSO: dos puntos luminosos
n = EXPRESSIONS[0]; p = roots[1]
eyes_dots(n, p)

# 02 ALEGRE / ENTUSIASTA: dos arcos ^ ^ + sonrisa abierta rellena
n = EXPRESSIONS[1]; p = roots[2]
eye_arch(n, -1, p); eye_arch(n, 1, p)
smile_d(n, 0, MOUTH_Z + 0.02, 0.120, p, h=0.9)

# 03 GUIÑO / CONFIADO: un ojo redondo + un ojo guiñado, sin boca
n = EXPRESSIONS[2]; p = roots[3]
disc(f"{n}_EyeL", -EX, EYE_Z, ER, p)
arc(f"{n}_EyeR", EX, EYE_Z - 0.050, 0.090, math.radians(30), math.radians(150), 0.048, p)

# 04 EMOCIONADO / DESCUBRIMIENTO: ojos redondos + sonrisa rellena
n = EXPRESSIONS[3]; p = roots[4]
eyes_dots(n, p, r=0.098, dy=0.01)
smile_d(n, 0, MOUTH_Z + 0.02, 0.105, p, h=0.9)

# 05 CURIOSO / EXPLORANDO: ojos redondos grandes + boca mínima (punto)
n = EXPRESSIONS[4]; p = roots[5]
eyes_dots(n, p, r=0.108, dy=0.02)
disc(f"{n}_Mouth", 0, MOUTH_Z + 0.012, 0.034, p, MAT_M, n=24)

# 06 ANALIZANDO / ESCANEO: retícula HUD (esquinas + círculo + cruz)
n = EXPRESSIONS[5]; p = roots[6]
cz, hw, hh, L, W = VZ, 0.285, 0.195, 0.095, 0.026
for sx in (-1, 1):
    for sz in (-1, 1):
        t = f"{n}_Br{'L' if sx < 0 else 'R'}{'T' if sz > 0 else 'B'}"
        bar(t + "_h", sx * (hw + W / 2), cz + sz * hh, sx * (hw - L), cz + sz * hh, W, p)
        bar(t + "_v", sx * hw, cz + sz * (hh + W / 2), sx * hw, cz + sz * (hh - L), W, p)
ring(f"{n}_Target", 0, cz, 0.072, 0.022, p)
disc(f"{n}_Core", 0, cz, 0.018, p, MAT_M, n=16)
for k, (dx, dz) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1))):
    bar(f"{n}_Tick{k + 1}", dx * 0.09, cz + dz * 0.09, dx * 0.125, cz + dz * 0.125, 0.018, p, seg=2)

# 07 SATISFECHO / MISIÓN COMPLETADA: ojos cerrados curvados + sonrisa rellena pequeña
n = EXPRESSIONS[6]; p = roots[7]
eye_arch(n, -1, p, lower=True); eye_arch(n, 1, p, lower=True)
smile_d(n, 0, MOUTH_Z + 0.015, 0.085, p)

# 08 SORPRENDIDO / ¡WOW!: ojos grandes + boca diminuta
n = EXPRESSIONS[7]; p = roots[8]
eyes_dots(n, p, r=0.112, dy=0.02)
disc(f"{n}_Mouth", 0, MOUTH_Z + 0.015, 0.022, p, MAT_M, n=20)

# 09 PENSATIVO / CALCULANDO: tres puntos en fila
n = EXPRESSIONS[8]; p = roots[9]
for k, x in enumerate((-0.16, 0.0, 0.16)):
    disc(f"{n}_Dot{k + 1}", x, VZ, 0.050, p, MAT_E, n=28)

# 10 ALEGRE (VISTA PRINCIPAL): ojo redondo + ojo guiñado + sonrisa abierta rellena
n = EXPRESSIONS[9]; p = roots[10]
disc(f"{n}_EyeL", -EX, EYE_Z, ER * 1.05, p, MAT_EP)
arc(f"{n}_EyeR", EX, EYE_Z - 0.030, 0.090, math.radians(25), math.radians(155), 0.040, p, MAT_EP)
_s = smile_d(n, 0, MOUTH_Z + 0.03, 0.150, p, h=0.80)
_s.data.materials[0] = MAT_MP


# ─────────── drivers ───────────
def add_driver(target_struct, path, expr, var_target, prop, index=-1):
    fcu = target_struct.driver_add(path, index) if index >= 0 else target_struct.driver_add(path)
    d = fcu.driver
    d.type = 'SCRIPTED'
    d.expression = expr
    var = d.variables.new()
    var.name = "v"
    var.type = 'SINGLE_PROP'
    var.targets[0].id = var_target
    var.targets[0].data_path = f'["{prop}"]'
    return fcu


for i, r in roots.items():
    for o in [r] + list(r.children):
        for attr in ("hide_viewport", "hide_render"):
            try:
                o.driver_remove(attr)
            except Exception:
                pass
            add_driver(o, attr, f"int(round(v)) != {i}", ctrl, "face_expression")

for matname, prop, base in (("MAT_FACE_EMISSION", "eye_brightness", 6.0), ("MAT_MOUTH_EMISSION", "mouth_brightness", 6.0),
                              ("MAT_FACE_EMISSION_PRINCIPAL", "eye_brightness", 6.0), ("MAT_MOUTH_EMISSION_PRINCIPAL", "mouth_brightness", 6.0)):
    nt = mat(matname).node_tree
    path = 'nodes["EMIT"].inputs[1].default_value'
    try:
        nt.driver_remove(path)
    except Exception:
        pass
    add_driver(nt, path, f"{base}*v", ctrl, prop)

for ax, prop in ((0, "face_offset_x"), (2, "face_offset_z")):
    try:
        ctrl.driver_remove("location", ax)
    except Exception:
        pass
    add_driver(ctrl, "location", f"{PIV[ax]:.6f}+v", ctrl, prop, ax)
for ax in range(3):
    try:
        ctrl.driver_remove("scale", ax)
    except Exception:
        pass
    add_driver(ctrl, "scale", "v", ctrl, "face_scale", ax)

print("FACE OK objects:", len([o for o in fc.objects if o.get('face_part')]), "expressions:", len(roots))
