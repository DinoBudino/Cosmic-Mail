"""07 — piernas cortas y robustas: conexión de cadera, muslo y espinilla acolchados,
rodilla con fuelle oscuro, banda azul noche y refuerzos naranjas delante y detrás."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import M

MOD = "legs"
clear_module(MOD)
lc = col("07_LEGS")
FAB, ORG, RUB, COS = M("fabric"), M("orange"), M("rubber"), M("cosmic")
create_collection("HIP_CONNECTORS", lc)

for sx, nm in ((1, "L"), (-1, "R")):
    hp = Vector((sx * C["hip"][0], C["hip"][1], C["hip"][2]))
    kn = Vector((sx * C["knee"][0], C["knee"][1], C["knee"][2]))
    an = Vector((sx * C["ankle"][0], C["ankle"][1], C["ankle"][2]))
    tr, sr = C["thigh_r"], C["shin_r"]
    # conexión de cadera: fuelle de tejido parcialmente oculto por la pelvis
    create_hose(f"HIP_CONNECTOR_{nm}", [hp + Vector((0, 0, 0.10)), hp, hp + (kn - hp).normalized() * 0.08], tr * 0.97,
                col("HIP_CONNECTORS"), FAB, MOD, pitch=0.05, amp=0.06, seg=40, samples=6)
    # muslo
    t0 = hp + (kn - hp).normalized() * 0.06
    t1 = kn - (kn - hp).normalized() * 0.035
    create_padded_segment(f"LEG_{nm}_THIGH", t0, t1, tr, tr * 0.97, lc, FAB, MOD, rolls=3, depth=0.06, bulge=0.03,
                          end_round=0.25)
    # rodilla: fuelle flexible + banda azul noche + refuerzos naranjas (frente y detrás, como la ficha)
    create_hose(f"LEG_{nm}_KNEE", [kn + Vector((0, 0, 0.07)), kn, kn + Vector((0, 0, -0.07))], sr * 0.98, lc, RUB, MOD,
                pitch=0.035, amp=0.10, seg=40, samples=6)
    kb = kn + Vector((0, 0, 0.045))
    create_padded_segment(f"LEG_{nm}_KNEE_BAND", kb + Vector((0, 0, -0.033)), kb + Vector((0, 0, 0.033)),
                          tr * 1.04, tr * 1.04, lc, COS, MOD, rolls=1, depth=0.0, end_round=0.10, bulge=0.0)
    for side, yc in (("FRONT", -math.pi / 2), ("BACK", math.pi / 2)):
        R0 = tr * 1.04 + 0.012

        def fn(i, j, yc=yc, kb=kb, R0=R0):
            a = yc + math.radians(-34 + 68 * j / 24)
            zz = -0.052 + 0.104 * i / 6
            return kb + Vector((R0 * math.cos(a), R0 * math.sin(a), zz))
        pad = grid_mesh(f"LEG_{nm}_KNEE_ORANGE_{side}", fn, 6, 24, lc, ORG, MOD)
        add_solidify(pad, 0.026, 0.0)
        add_bevel(pad, 0.006, 2, 40)
    # espinilla
    s0 = kn + (an - kn).normalized() * 0.05
    create_padded_segment(f"LEG_{nm}_SHIN", s0, an + Vector((0, 0, 0.02)), sr, sr * 0.97, lc, FAB, MOD, rolls=3,
                          depth=0.055, bulge=0.03, end_round=0.2)
    # banda oscura fina en la espinilla (refuerzo)
    sb = s0.lerp(an, 0.30)
    create_padded_segment(f"LEG_{nm}_SHIN_BAND", sb + Vector((0, 0, -0.018)), sb + Vector((0, 0, 0.018)), sr * 1.02,
                          sr * 1.02, lc, COS, MOD, rolls=1, depth=0.0, end_round=0.10, bulge=0.0)
print("LEGS OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
