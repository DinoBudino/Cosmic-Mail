"""08 — botas espaciales: cuerpo crema por secciones transversales, puntera y talonera azul noche,
suela real con borde perimetral y patrón de tacos en relieve, caña con correa gris y acento naranja."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import M

MOD = "boots"
clear_module(MOD)
bc = col("08_BOOTS")
FAB, SHELL, ORG, RUB, COS, GRAY = M("fabric"), M("shell"), M("orange"), M("rubber"), M("cosmic"), M("gray")
for sub in ("BOOT_L", "BOOT_R", "BOOT_SOLES", "BOOT_TOE_CAPS", "BOOT_TREAD"):
    create_collection(sub, bc)

SOLE_H = 0.075
# (y relativo al tobillo, semiancho, altura total) — de la vista lateral y la ampliación de botas
SECTIONS = [(0.262, 0.040, 0.12), (0.250, 0.150, 0.26), (0.225, 0.215, 0.36), (0.150, 0.250, 0.405), (0.050, 0.262, 0.415),
            (-0.050, 0.265, 0.400), (-0.140, 0.265, 0.345), (-0.230, 0.262, 0.270), (-0.310, 0.250, 0.225),
            (-0.370, 0.225, 0.195), (-0.410, 0.180, 0.170), (-0.432, 0.110, 0.135), (-0.442, 0.030, 0.095)]
NS = 48


def section_pt(y, a, k=1.0, x0=0.0, y0=0.0):
    """a: ángulo en el plano XZ de la sección (0 = exterior +X, -90° = suela)."""
    ys = [s[0] for s in SECTIONS]
    # interpolación lineal entre secciones (de talón a puntera, y decreciente)
    for s0, s1 in zip(SECTIONS, SECTIONS[1:]):
        if s1[0] <= y <= s0[0]:
            t = (s0[0] - y) / (s0[0] - s1[0])
            w = s0[1] + (s1[1] - s0[1]) * t
            h = s0[2] + (s1[2] - s0[2]) * t
            break
    else:
        w, h = SECTIONS[-1][1], SECTIONS[-1][2]
    hh = (h - SOLE_H * 0.6) / 2
    zc = SOLE_H * 0.6 + hh
    c, s = math.cos(a), math.sin(a)
    n = 2.6
    x = w * math.copysign(abs(c) ** (2 / n), c)
    z = hh * math.copysign(abs(s) ** (2 / n), s)
    return Vector((x0 + x * k, y0 + y, zc + z * k))


def boot_surface(name, y0r, y1r, a0, a1, k, collection, material, x0, y0, ni=30, nj=NS, closed=False):
    def fn(i, j):
        y = y0r + (y1r - y0r) * i / ni
        a = a0 + (a1 - a0) * j / nj
        return section_pt(y, a, k, x0, y0)
    return grid_mesh(name, fn, ni, nj, collection, material, MOD, closed_j=closed)


for sx, nm in ((1, "L"), (-1, "R")):
    X0, Y0 = sx * C["ankle"][0], C["ankle"][1]
    bcol = col(f"BOOT_{nm}")
    # cuerpo (crema), cerrado alrededor de la sección
    body = boot_surface(f"BOOT_{nm}", SECTIONS[0][0], SECTIONS[-1][0], 0, TAU, 1.0, bcol, SHELL, X0, Y0, ni=40, closed=True)
    # puntera azul noche (mitad inferior + frente)
    toe = boot_surface(f"BOOT_{nm}_TOE_CAP", -0.215, SECTIONS[-1][0], math.radians(-200), math.radians(20), 1.02,
                       col("BOOT_TOE_CAPS"), RUB, X0, Y0, ni=18)
    add_solidify(toe, 0.010, 0.0)
    # talonera
    heel = boot_surface(f"BOOT_{nm}_HEEL_CAP", SECTIONS[0][0] - 0.0005, 0.150, math.radians(-200), math.radians(20), 1.02,
                        col("BOOT_TOE_CAPS"), RUB, X0, Y0, ni=10)
    add_solidify(heel, 0.010, 0.0)
    # acento naranja lateral exterior junto al talón (ficha)
    acc = boot_surface(f"BOOT_{nm}_ORANGE_ACCENT", 0.13, 0.03, math.radians(-12) if sx > 0 else math.radians(168),
                       math.radians(12) if sx > 0 else math.radians(192), 1.025, bcol, ORG, X0, Y0, ni=6, nj=6)
    add_solidify(acc, 0.008, 0.0)
    # refuerzo lateral (costura en relieve)
    seam_pts = [section_pt(y, 0.0 if sx > 0 else math.pi, 1.01, X0, Y0) for y in [0.20 - 0.022 * k for k in range(19)]]
    create_curve(f"BOOT_{nm}_SIDE_SEAM", seam_pts, bcol, COS, MOD, bevel=0.005)

    # caña: aro crema + correa gris con hebilla en el frente
    top_z = 0.405
    cuff = create_padded_segment(f"BOOT_{nm}_CUFF", Vector((X0, Y0 + 0.02, top_z - 0.07)), Vector((X0, Y0 + 0.02, top_z + 0.03)),
                                 0.250, 0.245, bcol, SHELL, MOD, rolls=1, depth=0.0, end_round=0.2, bulge=0.02)
    strap = create_padded_segment(f"BOOT_{nm}_STRAP", Vector((X0, Y0 + 0.02, top_z - 0.045)), Vector((X0, Y0 + 0.02, top_z - 0.005)),
                                  0.258, 0.258, bcol, GRAY, MOD, rolls=1, depth=0.0, end_round=0.1, bulge=0.0)
    buckle = create_rounded_box(f"BOOT_{nm}_BUCKLE", (0.075, 0.016, 0.034), bcol, GRAY, MOD, n=6.0,
                                center=(X0, Y0 + 0.02 - 0.262, top_z - 0.025))
    slot = create_rounded_box(f"BOOT_{nm}_BUCKLE_SLOT", (0.050, 0.006, 0.010), bcol, RUB, MOD, n=6.0,
                              center=(X0, Y0 + 0.02 - 0.278, top_z - 0.025))

    # suela: contorno de la huella extruido (talón, zona media, antepié) con borde perimetral
    outline = []
    ys = [SECTIONS[0][0] + (SECTIONS[-1][0] - SECTIONS[0][0]) * k / 40 for k in range(41)]
    for y in ys:
        outline.append(section_pt(y, 0.0, 1.0, 0, 0))
    for y in reversed(ys):
        outline.append(section_pt(y, math.pi, 1.0, 0, 0))
    ring0 = [Vector((X0 + p.x * 1.03, Y0 + p.y * 1.01, 0.022)) for p in outline]
    ring1 = [Vector((X0 + p.x * 1.05, Y0 + p.y * 1.02, 0.030)) for p in outline]
    ring2 = [Vector((X0 + p.x * 1.05, Y0 + p.y * 1.02, SOLE_H)) for p in outline]
    ring3 = [Vector((X0 + p.x * 1.00, Y0 + p.y * 1.00, SOLE_H + 0.012)) for p in outline]
    sole = loft(f"BOOT_SOLES_{nm}", [ring0, ring1, ring2, ring3], col("BOOT_SOLES"), RUB, MOD)
    # tacos de tracción en relieve (divisiones geométricas de la ficha)
    lug_src_name = "BOOT_TREAD_LUG_SOURCE"
    lug_src = bpy.data.objects.get(lug_src_name)
    if lug_src is None:
        lug_src = create_rounded_box(lug_src_name, (0.040, 0.026, 0.011), col("BOOT_TREAD"), RUB, MOD, n=4.0, center=(0, 0, 0))
        lug_src.hide_viewport = lug_src.hide_render = True
    k = 0
    for yy in [0.20, 0.13, 0.06, -0.03, -0.10, -0.17, -0.24, -0.31, -0.37]:
        w = section_pt(yy, 0.0).x
        for xx in (-0.5, 0.0, 0.5):
            if abs(xx) * 2 * w > w * 0.9 and abs(yy) > 0.34:
                continue
            o = bpy.data.objects.new(f"BOOT_TREAD_{nm}_{k:02d}", lug_src.data)
            col("BOOT_TREAD").objects.link(o)
            tag(o, MOD)
            o.location = (X0 + xx * w * 1.15, Y0 + yy, 0.011)
            o.rotation_euler = (0, 0, math.radians(18 if (k % 2) else -18))
            k += 1
print("BOOTS OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
