"""05 — brazos acolchados: hombro en bloque acolchado (superelipsoide, no esfera) con placa naranja rectangular
curvada encima (como la ficha), manga superior segmentada,
codo flexible oscuro (fuelle), antebrazo con panel gris y refuerzos. Se genera por lado (sin escalas negativas)."""
import math
import bpy
from mathutils import Vector, Matrix
from config import *
from geometry_utils import *
from material_utils import M

MOD = "arms"
clear_module(MOD)
ac = col("05_ARMS")
FAB, ORG, RUB, COS, GRAY = M("fabric"), M("orange"), M("rubber"), M("cosmic"), M("gray")


def ell_patch(name, center, radii, th0, th1, ph0, ph1, material, off=0.0, out_axis=1, thick=0.016, ni=10, nj=36):
    """Parche sobre un elipsoide (theta desde +Z, phi desde el eje 'hacia fuera' ±X)."""
    c = Vector(center)
    a, b, h = radii

    def fn(i, j):
        t = th0 + (th1 - th0) * i / ni
        p = ph0 + (ph1 - ph0) * j / nj
        d = Vector((out_axis * math.sin(t) * math.cos(p), math.sin(t) * math.sin(p), math.cos(t)))
        q = Vector((a * d.x, b * d.y, h * d.z))
        n = Vector((q.x / a ** 2, q.y / b ** 2, q.z / h ** 2)).normalized()
        return c + q + n * off
    o = grid_mesh(name, fn, ni, nj, ac, material, MOD)
    if thick:
        add_solidify(o, thick, -1.0)
        add_bevel(o, 0.004, 2, 40)
    return o


for sx, nm in ((1, "L"), (-1, "R")):
    sh = Vector((sx * C["shoulder_x"], 0.0, C["shoulder_z"]))
    el = Vector((sx * C["elbow"][0], C["elbow"][1], C["elbow"][2]))
    wr = Vector((sx * C["wrist"][0], C["wrist"][1], C["wrist"][2]))
    # hombro: bloque acolchado de esquinas suaves, inclinado hacia fuera (ficha: hombro cuadrado, no bola)
    tilt = Matrix.Rotation(sx * math.radians(16), 3, 'Y')
    sc_ = sh + Vector((sx * 0.015, 0.0, -0.02))
    HB = (0.225, 0.215, 0.175)
    body = create_rounded_box(f"ARM_{nm}_SHOULDER", HB, ac, FAB, MOD, n=3.4, nz=3.0, center=sc_, rot=tilt)
    # dos costuras acolchadas horizontales en el bloque
    for k, zz in enumerate((-0.035, -0.105)):
        f = (1 - abs(zz / HB[2]) ** 3.0) ** (1 / 3.0)
        sm = create_rounded_box(f"ARM_{nm}_SHOULDER_QUILT_{k + 1}", (HB[0] * f + 0.007, HB[1] * f + 0.007, 0.011), ac, FAB, MOD,
                                n=3.4, nz=2.0, center=sc_ + tilt @ Vector((0, 0, zz)), rot=tilt)
    # placa naranja: losa rectangular redondeada que se apoya sobre la cara superior del bloque (proyectada)
    pad = create_rounded_box(f"ARM_{nm}_SHOULDER_ORANGE", (0.200, 0.192, 0.020), ac, ORG, MOD, n=4.5, nz=2.6,
                             center=(0, 0, 0))
    for v in pad.data.vertices:
        x, y, z = v.co
        x += sx * 0.012
        q = (abs(x / HB[0]) ** 3.4 + abs(y / HB[1]) ** 3.4) ** (3.0 / 3.4)
        zs = HB[2] * max(0.0, 1.0 - min(q, 1.0)) ** (1 / 3.0)
        v.co = Vector((x, y, zs + 0.004 + (z + 0.020)))
    pad.data.update()
    pad.matrix_world = Matrix.Translation(sc_) @ tilt.to_4x4()
    add_bevel(pad, 0.004, 2, 30)
    # conexión oscura interior (anillo hombro-torso)
    ring = create_surface_of_revolution(f"ARM_{nm}_SHOULDER_JOINT",
                                        [(0.16 + 0.03 * math.cos(TAU * k / 10), 0.03 * math.sin(TAU * k / 10)) for k in range(10)],
                                        ac, RUB, MOD, segments=48, closed=True)
    orient_object(ring, sh + Vector((-sx * 0.08, 0, -0.02)), Vector((sx, 0, 0.15)))

    # manga superior: 2 almohadillas, banda oscura de refuerzo
    u0 = sh + Vector((sx * 0.03, 0, -0.10))
    seg_up = create_padded_segment(f"ARM_{nm}_UPPER", u0, el, C["upper_arm_r"], C["upper_arm_r"] * 0.96, ac, FAB, MOD,
                                   rolls=2, depth=0.07, bulge=0.05)
    bnd = u0.lerp(el, 0.42)
    create_padded_segment(f"ARM_{nm}_UPPER_BAND", bnd - (el - u0).normalized() * 0.03, bnd + (el - u0).normalized() * 0.03,
                          C["upper_arm_r"] * 1.07, C["upper_arm_r"] * 1.07, ac, COS, MOD, rolls=1, depth=0.0,
                          end_round=0.12, bulge=0.0)

    # codo: fuelle oscuro flexible
    ax = (wr - el).normalized()
    ax_u = (el - u0).normalized()
    create_hose(f"ARM_{nm}_ELBOW", [el - ax_u * 0.06, el, el + ax * 0.06], C["upper_arm_r"] * 0.86, ac, RUB, MOD,
                pitch=0.035, amp=0.12, seg=36, samples=6)

    # antebrazo: más ancho cerca de la muñeca, panel gris exterior y banda oscura junto al codo
    f0 = el + ax * 0.03
    f1 = wr
    create_padded_segment(f"ARM_{nm}_FOREARM", f0, f1, C["forearm_r"], C["forearm_r"] * 1.10, ac, FAB, MOD,
                          rolls=2, depth=0.06, bulge=0.04, end_round=0.25)
    bb = f0 + ax * 0.05
    create_padded_segment(f"ARM_{nm}_FOREARM_BAND", bb - ax * 0.025, bb + ax * 0.025, C["forearm_r"] * 1.08,
                          C["forearm_r"] * 1.08, ac, COS, MOD, rolls=1, depth=0.0, end_round=0.12, bulge=0.0)
    # panel gris (lado exterior, cerca de la muñeca)
    pc = f0.lerp(f1, 0.62)
    out = Vector((sx, -0.35, 0)).normalized()
    side = out - ax * out.dot(ax)
    side.normalize()
    rr = C["forearm_r"] * 1.07
    gp = create_rounded_box(f"ARM_{nm}_FOREARM_PANEL", (0.012, 0.055, 0.070), ac, GRAY, MOD, n=6.0,
                            center=pc + side * rr)
    gp.rotation_euler = side.to_track_quat('X', 'Z').to_euler()
print("ARMS OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
