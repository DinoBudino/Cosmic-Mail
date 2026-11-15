"""01 — blockout: volúmenes principales para validar silueta y proporciones (se reemplaza en fases 2+)."""
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import M

MOD = "blockout"
clear_module(MOD)
bc = col("13_VALIDATION")
cr, rb, gy = M("fabric"), M("rubber"), M("gray")

# casco + visor + módulos
hel = create_rounded_box("BLOCK_HELMET", (HX, HY, HZ), bc, M("shell"), MOD, n=2.0, center=HC)
vis = create_rounded_box("BLOCK_VISOR", (VA, 0.12, VB), bc, M("visor"), MOD, n=2.5,
                         center=HC + Vector((0, -HY + 0.07, VZ)))
for sx in (-1, 1):
    create_rounded_box(f"BLOCK_EAR_{'L' if sx > 0 else 'R'}", (0.07, 0.19, 0.19), bc, gy, MOD, n=2.0,
                       center=HC + Vector((sx * (HX + 0.03), 0, -0.02)))
# cuello
create_rounded_box("BLOCK_NECK", (0.24, 0.21, 0.07), bc, rb, MOD, n=2.0, center=(0, 0, 1.97))
# torso
rings = [ring_points(Vector((0, yo, z)), Vector((1, 0, 0)), Vector((0, 1, 0)), w, d, 32, TORSO_N)
         for (z, w, d, yo) in TORSO_PROFILE]
loft("BLOCK_TORSO", rings, bc, cr, MOD)
# brazos, manos
for sx, nm in ((1, "L"), (-1, "R")):
    sh = Vector((sx * C["shoulder_x"], 0, C["shoulder_z"]))
    el = Vector((sx * C["elbow"][0], C["elbow"][1], C["elbow"][2]))
    wr = Vector((sx * C["wrist"][0], C["wrist"][1], C["wrist"][2]))
    create_rounded_box(f"BLOCK_SHOULDER_{nm}", (0.22, 0.22, 0.19), bc, M("orange"), MOD, n=2.0, center=sh)
    create_padded_segment(f"BLOCK_UPPER_{nm}", sh, el, C["upper_arm_r"], C["upper_arm_r"], bc, cr, MOD, rolls=1, depth=0.0)
    create_padded_segment(f"BLOCK_FORE_{nm}", el, wr, C["forearm_r"], C["forearm_r"] * 1.08, bc, cr, MOD, rolls=1, depth=0.0)
    create_rounded_box(f"BLOCK_HAND_{nm}", (0.10, 0.15, 0.19), bc, rb, MOD, n=2.2, center=wr + Vector((sx * 0.01, -0.02, -0.20)))
    hp = Vector((sx * C["hip"][0], 0, C["hip"][2]))
    kn = Vector((sx * C["knee"][0], C["knee"][1], C["knee"][2]))
    an = Vector((sx * C["ankle"][0], 0, C["ankle"][2]))
    create_padded_segment(f"BLOCK_THIGH_{nm}", hp, kn, C["thigh_r"], C["thigh_r"], bc, cr, MOD, rolls=1, depth=0.0)
    create_padded_segment(f"BLOCK_SHIN_{nm}", kn, an, C["shin_r"], C["shin_r"], bc, cr, MOD, rolls=1, depth=0.0)
    create_rounded_box(f"BLOCK_BOOT_{nm}", (C["boot_width"] / 2, C["boot_length"] / 2, C["boot_height"] / 2), bc, cr, MOD,
                       n=3.0, center=(sx * C["ankle"][0], -0.07, C["boot_height"] / 2))
# mochila
bw, bh, bd = C["backpack_width"], C["backpack_height"], C["backpack_depth"]
create_rounded_box("BLOCK_BACKPACK", (bw / 2, bd / 2, bh / 2), bc, M("shell"), MOD, n=5.0, center=C["backpack_center"])
print("BLOCKOUT OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
