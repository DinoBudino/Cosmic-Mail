"""10 — detalles del traje: costuras longitudinales que siguen el relieve acolchado de brazos y piernas
(misma fórmula de radio que create_padded_segment), discretas y de poco grosor."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import create_material

MOD = "details"
clear_module(MOD)
SEAM = bpy.data.materials.get("MAT_SEAM_THREAD") or create_material("MAT_SEAM_THREAD", "#CDBFAE", 0.0, 0.8)


def padded_r(t, r0, r1, rolls, depth, bulge):
    r = r0 + (r1 - r0) * t
    ph = (t * rolls) % 1.0
    pad = (math.sin(math.pi * ph) ** 0.45) if 0 < ph else 0.0
    r *= (1 - depth) + depth * pad
    return r * (1 + bulge * math.sin(math.pi * t))


def seam(name, p0, p1, r0, r1, rolls, depth, bulge, out_dir, collection, t0=0.08, t1=0.92, n=60):
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0).normalized()
    o = Vector(out_dir)
    o = (o - ax * o.dot(ax)).normalized()
    pts = []
    for k in range(n + 1):
        t = t0 + (t1 - t0) * k / n
        pts.append(p0.lerp(p1, t) + o * (padded_r(t, r0, r1, rolls, depth, bulge) + 0.001))
    return create_curve(name, pts, collection, SEAM, MOD, bevel=0.0032)


for sx, nm in ((1, "L"), (-1, "R")):
    hp = Vector((sx * C["hip"][0], C["hip"][1], C["hip"][2]))
    kn = Vector((sx * C["knee"][0], C["knee"][1], C["knee"][2]))
    an = Vector((sx * C["ankle"][0], C["ankle"][1], C["ankle"][2]))
    tr, sr = C["thigh_r"], C["shin_r"]
    t0 = hp + (kn - hp).normalized() * 0.06
    t1 = kn - (kn - hp).normalized() * 0.035
    s0 = kn + (an - kn).normalized() * 0.05
    s1 = an + Vector((0, 0, 0.02))
    for k, d in enumerate(((sx, -0.35, 0), (sx * 0.2, 1, 0))):
        seam(f"LEG_{nm}_THIGH_SEAM_{k + 1}", t0, t1, tr, tr * 0.97, 3, 0.06, 0.03, d, col("07_LEGS"))
        seam(f"LEG_{nm}_SHIN_SEAM_{k + 1}", s0, s1, sr, sr * 0.97, 3, 0.055, 0.03, d, col("07_LEGS"), t1=0.80)
    sh = Vector((sx * C["shoulder_x"], 0.0, C["shoulder_z"]))
    el = Vector((sx * C["elbow"][0], C["elbow"][1], C["elbow"][2]))
    u0 = sh + Vector((sx * 0.03, 0, -0.10))
    seam(f"ARM_{nm}_UPPER_SEAM", u0, el, C["upper_arm_r"], C["upper_arm_r"] * 0.96, 2, 0.07, 0.05, (sx, -0.2, 0),
         col("05_ARMS"), t0=0.55, t1=0.95)
print("DETAILS OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
