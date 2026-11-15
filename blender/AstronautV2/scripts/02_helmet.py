"""02 — casco hard-surface: núcleo, paneles separados por juntas reales, franjas naranjas
(central sagital + dos laterales en el lado +X), módulos laterales y cuello mecánico."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import M, create_material

clear_module("blockout")          # el blockout se sustituye por las piezas definitivas
MOD = "helmet"
clear_module(MOD)
hc = col("02_HELMET")
SHELL, ORG, GRAY, RUB, COS = M("shell"), M("orange"), M("gray"), M("rubber"), M("cosmic")
GAP_MAT = create_material("MAT_SHELL_GAP", "#6F665D", 0.0, 0.7)
TH_BOTTOM = 2.60                   # límite inferior del casco (z local ≈ -0.44)
G = C["panel_gap"]


def panel(name, th0, th1, ph0, ph1, material=SHELL, off=0.0, ni=None, nj=None, thick=0.022, gap=G):
    """Panel de carcasa sobre el elipsoide, recortado 'gap' en sus bordes (junta física)."""
    gth = gap / HZ
    th0g, th1g = th0 + (gth if th0 > 0.01 else 0), th1 - gth
    ni = ni or max(6, int((th1 - th0) * 40))
    nj = nj or max(8, int(abs(ph1 - ph0) * 40))
    full = abs(ph1 - ph0) >= TAU - 1e-6

    def fn(i, j):
        t = th0g + (th1g - th0g) * i / ni
        gph = 0 if full else gap / max(HX * math.sin(max(t, 0.05)), 0.05)
        p = (ph0 + gph) + ((ph1 - gph) - (ph0 + gph)) * j / nj
        return helmet_pt(max(t, 1e-4), p, off)
    o = grid_mesh(name, fn, ni, nj, hc, material, MOD, closed_j=full)
    if thick:
        add_solidify(o, thick, -1.0)
        add_bevel(o, 0.006, 2, 40)
    return o


# núcleo oscuro ligeramente hundido: lo que se ve dentro de las juntas
core = panel("HELMET_SEAL_CORE", 0.0, TH_BOTTOM + 0.02, -math.pi, math.pi, GAP_MAT, off=-0.012, thick=0, gap=0)

# paneles: superior, frontal (alrededor del visor), laterales y trasero
TOP = 0.42
panel("HELMET_MAIN_SHELL", 0.0, TOP, -math.pi, math.pi, gap=G * 0.5)
panel("HELMET_FRONT_SHELL", TOP, TH_BOTTOM, math.radians(-148), math.radians(-32))
panel("HELMET_SIDE_PANEL_L", TOP, TH_BOTTOM, math.radians(-32), math.radians(32))
panel("HELMET_SIDE_PANEL_R", TOP, TH_BOTTOM, math.radians(148), math.radians(212))
panel("HELMET_REAR_SHELL", TOP, 1.85, math.radians(32), math.radians(148))
panel("HELMET_REAR_LOWER", 1.85, TH_BOTTOM, math.radians(32), math.radians(148))


# ── franjas naranjas ──
def band_xz(name, x0, x1, t0, t1, off=0.016, ni=4, nj=60):
    """Franja sagital: |x| en [x0,x1] (local), recorre theta del frente (phi=-90) a la nuca (phi=+90)."""
    def fn(i, j):
        x = x0 + (x1 - x0) * i / ni
        t = t0 + (t1 - t0) * j / nj           # parámetro angular en el plano sagital (0 = cima)
        z = HZ * math.cos(t)
        y = HY * math.sin(t)                  # t<0 frente, t>0 nuca
        # proyectar a la superficie manteniendo x
        k = 1 - (x / HX) ** 2
        p = Vector((x, y * math.sqrt(max(k, 0)), z * math.sqrt(max(k, 0))))
        return HC + p + helmet_normal(p) * off
    o = grid_mesh(name, fn, ni, nj, hc, ORG, MOD)
    add_solidify(o, 0.014, -1.0)
    add_bevel(o, 0.004, 2, 40)
    return o


# central: delante (sobre el visor) → cima → nuca (vista trasera de la ficha)
band_xz("HELMET_ORANGE_CENTER", -0.105, 0.105, -0.66, 2.25)


def gc_band(name, d0, d1, width, off=0.016, nj=40, ni=4):
    """Franja corta a lo largo del arco máximo entre dos direcciones del casco."""
    a, b = Vector(d0).normalized(), Vector(d1).normalized()
    side = a.cross(b).normalized()

    def fn(i, j):
        t = j / nj
        d = a.slerp(b, t) if hasattr(a, "slerp") else (a.lerp(b, t)).normalized()
        d = d.normalized() + side * width * (i / ni - 0.5) / HX
        return helmet_dir(d, off)
    o = grid_mesh(name, fn, ni, nj, hc, ORG, MOD)
    add_solidify(o, 0.014, -1.0)
    add_bevel(o, 0.004, 2, 40)
    return o


# laterales (+X, izquierda del personaje): bajan en diagonal hacia el módulo lateral
gc_band("HELMET_ORANGE_SIDE_A", (0.22, -0.62, 0.75), (0.80, -0.14, 0.58), 0.085)
gc_band("HELMET_ORANGE_SIDE_B", (0.32, -0.44, 0.84), (0.87, 0.06, 0.50), 0.085)


# ── módulos laterales (comunicación/sensores) ──
EAR_R = C["ear_radius"]


def circ(cr, ch, rad, n=10):
    return [(cr + rad * math.cos(TAU * k / n), ch + rad * math.sin(TAU * k / n)) for k in range(n)]


for sx, nm in ((1, "LEFT"), (-1, "RIGHT")):
    d = Vector((sx, 0.0, -0.04))
    base = helmet_dir(d, -0.02)
    axis = helmet_normal(base - HC)
    R = EAR_R
    parts = [
        # (nombre, perfil (r, h), material, cerrado) — ficha: cilindro gris, filo naranja en la cara exterior,
        # anillo gris, disco claro abombado y botón central
        ("MOUNT", [(0, 0.0), (R - 0.02, 0.0), (R - 0.012, 0.02), (R - 0.016, 0.04), (0, 0.04)], GRAY, False),
        ("HOUSING", [(0, 0.03), (R - 0.004, 0.03), (R + 0.010, 0.050), (R + 0.012, 0.125), (R + 0.004, 0.142),
                     (R - 0.030, 0.146), (0, 0.146)], GRAY, False),
        ("ACCENT", circ(R - 0.004, 0.140, 0.013, 12), ORG, True),
        ("RIM", circ(R * 0.66, 0.150, 0.016, 12), GRAY, True),
        ("DISC", [(0, 0.172), (R * 0.30, 0.170), (R * 0.52, 0.162), (R * 0.60, 0.150), (R * 0.60, 0.140), (0, 0.140)], GRAY, False),
        ("CENTER", [(0, 0.184), (0.030, 0.182), (0.046, 0.172), (0.048, 0.165), (0, 0.165)], GRAY, False),
    ]
    for pn, prof, mt, closed in parts:
        o = create_surface_of_revolution(f"HELMET_{nm}_MODULE_{pn}", prof, hc, mt, MOD, segments=72, closed=closed)
        orient_object(o, base, axis)
        if not closed:
            add_bevel(o, 0.006, 2, 35)
    # marcador de sensor (pequeña luz cálida apagada en el borde frontal)
# un material gris más claro para el disco exterior (ficha: centro claro, carcasa media)
light_gray = create_material("MAT_TECH_GRAY_LIGHT", "#C3C8CF", 0.2, 0.40)
for nm in ("LEFT", "RIGHT"):
    for pn in ("DISC", "CENTER"):
        o = bpy.data.objects[f"HELMET_{nm}_MODULE_{pn}"]
        o.data.materials[0] = light_gray

# ── cuello mecánico: anillo superior, sello oscuro, segmentos y anillo inferior ──
NZ0 = HC.z + HZ * math.cos(TH_BOTTOM)          # base del casco
neck = [
    ("HELMET_NECK_RING", circ(0.305, NZ0 - 0.015, 0.035, 14), COS, True),
    ("HELMET_SEALS", [(0.29, NZ0 - 0.03), (0.30, NZ0 - 0.06), (0.285, NZ0 - 0.09), (0.0, NZ0 - 0.09)], RUB, False),
    ("NECK_SEGMENT_A", circ(0.270, NZ0 - 0.075, 0.020, 12), RUB, True),
    ("NECK_SEGMENT_B", circ(0.262, NZ0 - 0.110, 0.020, 12), RUB, True),
    ("NECK_LOWER_RING", circ(0.275, NZ0 - 0.140, 0.026, 12), COS, True),
]
for nm, prof, mt, closed in neck:
    o = create_surface_of_revolution(nm, prof, hc, mt, MOD, segments=72, closed=closed)
    o.location = (0, HC.y * 0.5, 0)
print("HELMET OK base z=%.3f" % NZ0, len(hc.objects), "objetos")
