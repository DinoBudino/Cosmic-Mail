"""04 — módulos laterales: cúpula gris oscura, aro luminoso, centro oscuro y brida bronce (como la ficha)."""
from pip_utils import *

M = "side"
clear_module(M)
sc = col("04_SIDE_MODULES")
S = C["side_module_scale"]
MOD_Y, MOD_Z = 0.0, -0.02
XPOS = RX * math.sqrt(max(0.0, 1 - (MOD_Y / RY) ** 2)) - 0.02

SLATE = create_material("MAT_EAR_SLATE", "#6B7180", 0.55, 0.36, coat=0.35)
CENTER_DARK = create_material("MAT_EAR_CENTER", "#171C27", 0.30, 0.22, coat=0.6)
BRONZE = bpy.data.materials.get("MAT_BRONZE") or create_material("MAT_BRONZE", "#C48A2C", 0.85, 0.28)
_ring = mat("MAT_SIDE_RING_EMISSION").node_tree.nodes["EMIT"]
_ring.inputs[0].default_value = hex_to_linear_rgba("#FFC21A")
_ring.inputs[1].default_value = 3.2

DR, DH, DB = 0.50, 0.24, -0.06      # radio de cúpula, altura, base


def dome_h(r):
    return DB + DH * math.sqrt(max(0.0, 1 - (r / DR) ** 2))


def circle_profile(cr, ch, rad, n=12):
    return [(cr + rad * math.cos(TAU * k / n), ch + rad * math.sin(TAU * k / n)) for k in range(n)]


def sc_(profile):
    return [(r * S, h * S) for r, h in profile]


N = 16
housing_p = [(0, -0.10), (0.44, -0.10), (DR - 0.01, DB - 0.02)]
housing_p += [(DR * math.cos(k * math.pi / 2 / N), DB + DH * math.sin(k * math.pi / 2 / N)) for k in range(0, N + 1)]
housing_p[-1] = (0.0, DB + DH)
housing_p = sc_(housing_p)

CAP_R = 0.29
a0 = math.acos(CAP_R / DR)
cap_p = [(0.0, dome_h(0) + 0.007)]
cap_p += [(DR * math.cos(a), DB + DH * math.sin(a) + 0.007) for a in [math.pi / 2 - (math.pi / 2 - a0) * k / 8 for k in range(1, 9)]]
cap_p += [(CAP_R, dome_h(CAP_R) - 0.02), (0.0, dome_h(0) - 0.02)]
cap_p = sc_(cap_p)

connector_p = sc_([(0, -0.24), (0.30, -0.24), (0.34, -0.19), (0.34, -0.05), (0, -0.05)])
flange_p = sc_(circle_profile(0.462, -0.07, 0.045))   # oculto de lado, visible de frente
ring_p = sc_(circle_profile(0.33, dome_h(0.33) + 0.006, 0.026))
lens_p = sc_([(0.0, dome_h(0) + 0.020), (0.045, dome_h(0) + 0.014), (0.06, dome_h(0) + 0.004), (0.0, dome_h(0) + 0.004)])
screw_p = [(0, 0.0), (0.016, 0.0), (0.016, 0.010), (0.0, 0.010)]

for side, sx in (("LEFT", -1), ("RIGHT", 1)):
    ang = math.pi / 2 * sx
    loc = Vector((sx * XPOS, MOD_Y, MOD_Z))

    def make(name, prof, material, closed=False, seg=72, bev=None):
        o = create_revolved_mesh(f"{name}_{side}", prof, sc, material, M, segments=seg, closed=closed)
        o.location = loc
        o.rotation_euler = (0, ang, 0)
        if bev:
            add_bevel(o, bev, 2, 40)
        return o

    make("MODULE", housing_p, SLATE, seg=96)
    make("SIDE_CONNECTOR", connector_p, mat("MAT_COSMIC_BLUE"))
    make("SIDE_FLANGE", flange_p, BRONZE, closed=True, seg=96)
    make("SIDE_RING_EMISSIVE", ring_p, mat("MAT_SIDE_RING_EMISSION"), closed=True, seg=96)
    make("SIDE_CENTER", cap_p, CENTER_DARK, seg=96)
    make("SIDE_SENSOR_LENS", lens_p, CENTER_DARK)

    # fijaciones discretas sobre la cúpula (3 tornillos)
    for k in range(3):
        a = TAU * k / 3 + math.pi / 2
        r = 0.43
        lx, ly, lz = r * S * math.cos(a), r * S * math.sin(a), (dome_h(r) + 0.004) * S
        scr = create_revolved_mesh(f"SIDE_FASTENER_{side}_{k + 1}", screw_p, sc, BRONZE, M, segments=12)
        scr.location = loc + Vector((sx * lz, ly, -sx * lx))
        scr.rotation_euler = (0, ang, 0)
print("SIDE OK", len(sc.objects), "objetos; x=", round(XPOS, 3))
