"""06 — guantes de cinco dedos (ficha "Guantes"): dedos y palma azul noche, dorso crema acolchado con costura
en V tipo sobre, puño-guantelete crema con borde oscuro y parche naranja rectangular en el dorso.
Orientación: palma hacia el muslo, pulgar e índice hacia DELANTE (-Y), meñique atrás, dorso hacia fuera.
Dedos de 2 falanges con pivote en cada articulación (para el rig). Pose inicial relajada."""
import math
import bpy
from mathutils import Vector, Matrix
from config import *
from geometry_utils import *
from material_utils import M

MOD = "gloves"
clear_module(MOD)
hc = col("06_HANDS")
RUB, FAB, ORG, COS, SHELL = M("rubber"), M("fabric"), M("orange"), M("cosmic"), M("shell")
GAP = bpy.data.materials.get("MAT_SHELL_GAP") or COS
for sub in ("HAND_L", "HAND_R", "FINGERS_L", "FINGERS_R", "WRIST_CONNECTORS"):
    create_collection(sub, hc)


def capsule(name, p0, p1, r0, r1, collection, material, seg=24, rows=8):
    """Falange: cápsula de p0 a p1 con extremos redondeados; origen del objeto en p0 (articulación)."""
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    prof = []
    for k in range(rows + 1):                       # semiesfera inferior
        a = -math.pi / 2 + (math.pi / 2) * k / rows
        prof.append((r0 * math.cos(a), r0 * math.sin(a)))
    for k in range(rows + 1):                       # semiesfera superior
        a = (math.pi / 2) * k / rows
        prof.append((r1 * math.cos(a), L + r1 * math.sin(a)))
    prof[0] = (0.0, prof[0][1])
    prof[-1] = (0.0, prof[-1][1])
    o = create_surface_of_revolution(name, prof, collection, material, MOD, segments=seg)
    orient_object(o, p0, p1 - p0)
    return o


def rot(v, axis, ang):
    return Matrix.Rotation(ang, 3, axis) @ v


DATA = {}
HS = 1.40                     # escala de mano (ficha: guante tan ancho como el antebrazo)
for sx, nm in ((1, "L"), (-1, "R")):
    W = Vector((sx * C["wrist"][0], C["wrist"][1], C["wrist"][2]))
    D = Vector((sx * 0.06, -0.05, -1.0)).normalized()          # hacia los dedos
    P = Vector((-sx, 0.0, 0.0))                                  # palma hacia el cuerpo
    P = (P - D * P.dot(D)).normalized()
    Y = D.cross(P).normalized()                                  # eje de los nudillos
    if Y.y < 0:                                                  # +Y = atrás: offsets negativos (índice, pulgar) quedan delante
        Y = -Y
    hand_c, fing_c, wrist_c = col(f"HAND_{nm}"), col(f"FINGERS_{nm}"), col("WRIST_CONNECTORS")
    Mx = Matrix((Y, -P, Y.cross(-P))).transposed()                # base ortonormal directa: x=ancho, y=dorso
    # muñeca: borde oscuro de conexión + puño-guantelete crema que se estrecha hacia la mano
    o = create_surface_of_revolution(f"WRIST_{nm}_RING",
                                     [(0.168 + 0.022 * math.cos(TAU * k / 12), 0.022 * math.sin(TAU * k / 12)) for k in range(12)],
                                     wrist_c, COS, MOD, segments=48, closed=True)
    orient_object(o, W, D)
    o = create_surface_of_revolution(f"WRIST_{nm}_BAND", [(0.0, -0.02), (0.170, -0.02), (0.181, 0.010), (0.183, 0.090),
                                                          (0.176, 0.135), (0.160, 0.160), (0.130, 0.172), (0.0, 0.172)],
                                     wrist_c, SHELL, MOD, segments=64)
    orient_object(o, W, D)
    add_bevel(o, 0.004, 2, 35)
    # parche naranja rectangular en el dorso del puño (curvado con el puño)
    org = create_rounded_box(f"WRIST_{nm}_ORANGE", (0.072, 0.011, 0.030), wrist_c, ORG, MOD, n=5.0, center=(0, 0, 0))
    for v in org.data.vertices:
        v.co.y -= v.co.x * v.co.x / (2 * 0.19)
    org.data.update()
    org.matrix_world = Matrix.Translation(W + D * 0.072 - P * 0.180) @ Mx.to_4x4()
    # mano: volumen azul noche; dorso crema acolchado
    pc = W + D * (0.150 + 0.095 * HS)
    palm = create_rounded_box(f"HAND_{nm}", (0.105 * HS, 0.062 * HS, 0.095 * HS), hand_c, RUB, MOD, n=3.0, center=(0, 0, 0))
    palm.matrix_world = Matrix.Translation(pc) @ Mx.to_4x4()
    plate = create_rounded_box(f"HAND_{nm}_BACK_PLATE", (0.094 * HS, 0.024 * HS, 0.088 * HS), hand_c, SHELL, MOD, n=3.6,
                               center=(0, 0, 0), taper=lambda zn: (1.0 - 0.06 * zn, 1.0))
    plate.matrix_world = Matrix.Translation(pc - P * 0.050 * HS - D * 0.004) @ Mx.to_4x4()
    add_bevel(plate, 0.004, 2, 30)
    # costura en V tipo sobre (ficha) sobre la placa del dorso
    s0 = pc - P * (0.050 + 0.024) * HS - P * 0.003 - D * 0.055 * HS
    create_curve(f"HAND_{nm}_BACK_DETAIL", [tuple(p) for p in (s0 - Y * 0.060 * HS, s0 + D * 0.050 * HS, s0 + Y * 0.060 * HS)],
                 hand_c, GAP, MOD, bevel=0.0045)
    create_curve(f"HAND_{nm}_BACK_DETAIL_EDGE", [tuple(p) for p in (s0 - Y * 0.060 * HS - D * 0.006, s0 + Y * 0.060 * HS - D * 0.006)],
                 hand_c, GAP, MOD, bevel=0.0035)
    # refuerzo de palma (ficha: "refuerzo en palma")
    pad = create_rounded_box(f"HAND_{nm}_PALM_PAD", (0.075 * HS, 0.012, 0.060 * HS), hand_c, COS, MOD, n=3.0, center=(0, 0, 0))
    pad.matrix_world = Matrix.Translation(pc + P * 0.058 * HS) @ Mx.to_4x4()

    # dedos: índice (delante) → meñique (detrás). Curvatura relajada hacia la palma
    hinge = Y                    # flexión alrededor del eje de los nudillos
    fingers = [("INDEX", -0.068, 0.062, 0.055, 0.0275, 0.18, 0.30),
               ("MIDDLE", -0.023, 0.068, 0.058, 0.0285, 0.22, 0.34),
               ("RING", 0.023, 0.064, 0.055, 0.0275, 0.26, 0.38),
               ("PINKY", 0.066, 0.052, 0.046, 0.0250, 0.30, 0.42)]
    DATA[nm] = {"W": W, "D": D, "P": P, "Y": Y, "fingers": {}}
    sgn = 1 if hinge.cross(D).dot(P) > 0 else -1          # los dedos se cierran hacia la palma
    for fn_, off, l1, l2, r, a1, a2 in fingers:
        off, l1, l2, r = off * HS, l1 * HS, l2 * HS, r * HS
        base = pc + Y * off + D * 0.090 * HS + P * 0.008 * HS
        d1 = rot((D + Y * off * 1.3).normalized(), hinge, sgn * a1)     # ligera apertura en abanico
        j1 = base + d1 * l1
        d2 = rot(d1, hinge, sgn * a2)
        tip = j1 + d2 * l2
        capsule(f"FINGERS_{nm}_{fn_}_01", base, j1, r, r * 0.97, fing_c, RUB)
        capsule(f"FINGERS_{nm}_{fn_}_02", j1, tip, r * 0.97, r * 0.92, fing_c, RUB)
        # refuerzo de nudillo
        kn = create_rounded_box(f"FINGERS_{nm}_{fn_}_KNUCKLE", (r * 0.85, 0.010, r * 0.9), fing_c, COS, MOD, n=3.0,
                                center=(0, 0, 0))
        kn.matrix_world = Matrix.Translation(base - P * (r * 0.95) + D * 0.005) @ Mx.to_4x4()
        DATA[nm]["fingers"][fn_] = (base, j1, tip)
    # pulgar: nace en el lado del índice, apunta hacia delante-abajo y hacia la palma
    tb = pc + Y * -0.090 * HS + D * -0.010 * HS + P * 0.035 * HS
    td = (D * 0.55 + Y * -0.55 + P * 0.45).normalized()
    t1 = tb + td * 0.070 * HS
    td2 = rot(td, hinge, sgn * 0.35)
    t2 = t1 + td2 * 0.058 * HS
    capsule(f"FINGERS_{nm}_THUMB_01", tb, t1, 0.034 * HS, 0.032 * HS, fing_c, RUB)
    capsule(f"FINGERS_{nm}_THUMB_02", t1, t2, 0.032 * HS, 0.029 * HS, fing_c, RUB)
    DATA[nm]["fingers"]["THUMB"] = (tb, t1, t2)

bpy.app.driver_namespace["ASTRO_HAND_DATA"] = {k: {"W": tuple(v["W"]), "fingers": {f: [tuple(p) for p in ps]
                                                   for f, ps in v["fingers"].items()}} for k, v in DATA.items()}
print("GLOVES OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
