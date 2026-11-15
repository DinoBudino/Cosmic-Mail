"""04 — torso presurizado: pelvis, cintura y tronco acolchados (tres piezas para el rig),
unidad pectoral con círculo azul, arnés azul noche con hebillas y costuras discretas."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import M, create_material

MOD = "torso"
clear_module(MOD)
tc, bc = col("04_TORSO"), col("01_BODY")
FAB, SHELL, RUB, COS, GRAY = M("fabric"), M("shell"), M("rubber"), M("cosmic"), M("gray")
SEAM = create_material("MAT_SEAM_THREAD", "#CDBFAE", 0.0, 0.8)
SEG = 64


def quilt(z, z0, z1, rolls, depth):
    """Factor radial de almohadillado horizontal entre z0 y z1."""
    if z <= z0 or z >= z1:
        return 1.0
    ph = ((z - z0) / (z1 - z0) * rolls) % 1.0
    return (1 - depth) + depth * (math.sin(math.pi * ph) ** 0.45)


def vseams(a):
    """Surcos verticales suaves en el frente y la espalda (paneles del traje)."""
    k = 1.0
    for c in (-90 - 38, -90 + 38, 90 - 42, 90 + 42):
        d = math.degrees(a) - c
        d = (d + 180) % 360 - 180
        k -= 0.012 * math.exp(-(d / 5.0) ** 2)
    return k


def torso_piece(name, z0, z1, collection, rolls_zone=None, rows=None):
    rows = rows or max(12, int((z1 - z0) / 0.008))
    rings = []
    for i in range(rows + 1):
        z = z0 + (z1 - z0) * i / rows
        w, d, yo = torso_section(z)
        q = quilt(z, *rolls_zone) if rolls_zone else 1.0
        rings.append(ring_points(Vector((0, yo, z)), Vector((1, 0, 0)), Vector((0, 1, 0)), w * q, d * q, SEG,
                                 TORSO_N, rfn=vseams))
    return loft(name, rings, collection, FAB, MOD)


# tres piezas solapadas (pelvis / cintura / tronco) → el rig gira la cintura sin abrir huecos
torso_piece("PELVIS", 0.98, 1.24, bc, (1.04, 1.24, 2, 0.035))
torso_piece("WAIST", 1.18, 1.40, bc, (1.18, 1.40, 2, 0.045))
torso_piece("TORSO_MAIN", 1.34, 1.985, tc, (1.34, 1.86, 6, 0.030))

# ── cintura: sello flexible con segmentos y refuerzos oscuros ──
for k, z in enumerate((1.215, 1.395)):
    w, d, yo = torso_section(z)
    rp = ring_points(Vector((0, yo, z)), Vector((1, 0, 0)), Vector((0, 1, 0)), w * 1.012, d * 1.012, SEG, TORSO_N)
    rp2 = [p + Vector((0, 0, 0.018)) for p in rp]
    rp3 = [p + Vector((0, 0, -0.018)) for p in rp]
    loft(f"WAIST_SEAL_{k + 1}", [rp3, rp, rp2], bc, FAB, MOD, cap_start=False, cap_end=False)   # sello de tejido (relieve)

# ── unidad pectoral ──
CZ = 1.655
front, nrm = torso_front_pt(0.0, CZ, 0.0)
box_c = front + Vector((0, -0.055, 0))
box = create_rounded_box("TORSO_CHEST_PANEL", (0.185, 0.075, 0.170), tc, SHELL, MOD, n=7.0, center=box_c)
add_bevel(box, 0.004, 2, 30)
frame = create_rounded_box("TORSO_CHEST_FRAME", (0.165, 0.012, 0.150), tc, M("gray"), MOD, n=8.0,
                           center=box_c + Vector((0, -0.068, 0)))
plate = create_rounded_box("TORSO_CHEST_FACE", (0.155, 0.012, 0.140), tc, SHELL, MOD, n=8.0,
                           center=box_c + Vector((0, -0.076, 0)))
disc = create_surface_of_revolution("TORSO_BLUE_CIRCLE", [(0, 0.0), (0.085, 0.0), (0.088, 0.010), (0.082, 0.018),
                                                          (0, 0.020)], tc, M("chest_blue"), MOD, segments=64)
orient_object(disc, box_c + Vector((0, -0.086, 0.0)), Vector((0, -1, 0)))
ring = create_surface_of_revolution("TORSO_BLUE_CIRCLE_RING", [(0.088 + 0.012 * math.cos(TAU * k / 10),
                                                                0.008 + 0.010 * math.sin(TAU * k / 10)) for k in range(10)],
                                    tc, SHELL, MOD, segments=64, closed=True)
orient_object(ring, box_c + Vector((0, -0.086, 0.0)), Vector((0, -1, 0)))
# tornillos discretos (instancias de una sola malla)
screw_src = create_surface_of_revolution("SCREW_SOURCE", [(0, 0), (0.014, 0), (0.014, 0.004), (0.010, 0.008), (0, 0.009)],
                                         tc, GRAY, MOD, segments=16)
screw_src.hide_viewport = screw_src.hide_render = True
for k, (sx, sz) in enumerate(((-1, 1), (1, 1), (-1, -1), (1, -1))):
    s = bpy.data.objects.new(f"TORSO_CHEST_SCREW_{k + 1}", screw_src.data)
    tc.objects.link(s)
    tag(s, MOD)
    orient_object(s, box_c + Vector((sx * 0.125, -0.088, sz * 0.110)), Vector((0, -1, 0)))
# conexiones inferiores (dos tomas cortas hacia el arnés)
for sx in (-1, 1):
    p0 = box_c + Vector((sx * 0.10, -0.02, -0.165))
    p1, n1 = torso_front_pt(sx * 0.13, CZ - 0.29, 0.02)
    create_hose(f"TORSO_CHEST_CONNECTOR_{'L' if sx > 0 else 'R'}", [p0, p0 + Vector((0, -0.01, -0.08)), p1], 0.022,
                tc, RUB, MOD, pitch=0.022, amp=0.2, seg=14)


# ── arnés ──
def strap_path(x, z0, z1, back=False, n=24, off=0.006):
    pts, ups = [], []
    for k in range(n + 1):
        z = z0 + (z1 - z0) * k / n
        p, nr = torso_front_pt(x, z, off, back)
        pts.append(p)
        ups.append(nr)
    return pts, ups


SW, ST = 0.088, 0.018
for sx, nm in ((1, "L"), (-1, "R")):
    x = sx * 0.285
    fp, fu = strap_path(x, 1.30, 1.89)
    bp, bu = strap_path(x, 1.89, 1.40, back=True)
    top = Vector((x, 0.0, torso_section(1.93)[0] * 0 + 1.965))
    pts = fp + [top] + bp
    ups = fu + [Vector((0, 0, 1))] + bu
    pts = catmull_rom(pts, 3)
    ups_i = []
    for p in pts:   # normal hacia fuera aproximada desde el eje del torso
        u = Vector((p.x * 0.4, p.y, max(0.0, p.z - 1.86) * 3.0))
        ups_i.append(u.normalized() if u.length > 1e-4 else Vector((0, 0, 1)))
    sweep_rect(f"TORSO_HARNESS_SHOULDER_{nm}", pts, ups_i, SW, ST, tc, COS, MOD)
    # tirantes inferiores en V hacia la entrepierna
    lp, lu = [], []
    for k in range(13):
        t = k / 12
        xx = x * (1 - t) + sx * 0.09 * t
        zz = 1.31 * (1 - t) + 1.06 * t
        p, nr = torso_front_pt(xx, zz, 0.008)
        lp.append(p); lu.append(nr)
    sweep_rect(f"TORSO_HARNESS_LEG_{nm}", lp, lu, SW * 0.85, ST, tc, COS, MOD)
    # hebillas en los laterales de la unidad pectoral
    bpnt, bn = torso_front_pt(x, 1.47, ST + 0.012)
    buck = create_rounded_box(f"TORSO_HARNESS_BUCKLE_{nm}", (0.058, 0.014, 0.040), tc, GRAY, MOD, n=6.0, center=bpnt)
    slot = create_rounded_box(f"TORSO_HARNESS_BUCKLE_SLOT_{nm}", (0.040, 0.006, 0.010), tc, RUB, MOD, n=6.0,
                              center=bpnt + Vector((0, -0.013, 0.004)))
    # correa corta pectoral → caja
    cp, cu = [], []
    for k in range(9):
        t = k / 8
        p, nr = torso_front_pt(x * (1 - t) + sx * 0.17 * t, 1.56, 0.008)
        cp.append(p); cu.append(nr)
    sweep_rect(f"TORSO_HARNESS_CHEST_{nm}", cp, cu, 0.05, ST, tc, COS, MOD)

# cinturón (anillo completo azul noche) con refuerzos
z = 1.305
w, d, yo = torso_section(z)
rings = []
for dz in (-0.034, -0.03, 0.03, 0.034):
    k = 1.03 if abs(dz) < 0.032 else 1.012
    rings.append(ring_points(Vector((0, yo, z + dz)), Vector((1, 0, 0)), Vector((0, 1, 0)), w * k * quilt(z, 1.18, 1.40, 2, 0.045),
                             d * k, SEG, TORSO_N))
loft("TORSO_HARNESS_BELT", rings, tc, COS, MOD, cap_start=False, cap_end=False)

# ── costuras discretas ──
for k, (x, z0, z1) in enumerate(((0.0, 1.10, 1.46), (0.36, 1.10, 1.80), (-0.36, 1.10, 1.80))):
    pts = [torso_front_pt(x, z0 + (z1 - z0) * i / 30, 0.002)[0] for i in range(31)]
    create_curve(f"TORSO_SEAMS_{k + 1}", pts, tc, SEAM, MOD, bevel=0.0035)
print("TORSO OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
