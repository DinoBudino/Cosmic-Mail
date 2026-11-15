"""06 — antena superior corta: base bronce, vástago oscuro, bulbo rosado luminoso."""
from pip_utils import *

M = "antenna"
clear_module(M)
ac = col("06_ANTENNA")
Z0 = RZ - 0.025
bronze = bpy.data.materials.get("MAT_BRONZE") or create_material("MAT_BRONZE", "#C48A2C", 0.85, 0.28)


def sphere_profile(r, h, n=14):
    return [(r * math.sin(math.pi * k / n), h - r * math.cos(math.pi * k / n)) for k in range(n + 1)]


def rev(name, prof, material, closed=False, seg=48, bev=None):
    o = create_revolved_mesh(name, prof, ac, material, M, segments=seg, closed=closed)
    o.location = (0, 0, Z0)
    if bev:
        add_bevel(o, bev, 2, 40)
    return o


rev("ANTENNA_BASE", [(0, -0.03), (0.20, -0.03), (0.215, 0.0), (0.205, 0.040), (0.17, 0.055), (0.0, 0.055)],
    bronze, bev=C["bevel_small"])
rev("ANTENNA_COLLAR", [(0, 0.05), (0.075, 0.05), (0.075, 0.085), (0.05, 0.10), (0, 0.10)], mat("MAT_NIGHT_BLUE"), seg=48)
rev("ANTENNA_STEM", [(0, 0.095), (0.042, 0.095), (0.038, 0.13), (0.036, 0.30), (0, 0.30)], mat("MAT_NIGHT_BLUE"), seg=24)
rev("ANTENNA_LIGHT", sphere_profile(0.100, 0.39), mat("MAT_ANTENNA_EMISSION"), seg=40)
_a = mat("MAT_ANTENNA_EMISSION").node_tree.nodes["EMIT"]
_a.inputs[0].default_value = hex_to_linear_rgba("#FFB4B0")
print("ANTENNA OK top z=", Z0 + 0.473)
