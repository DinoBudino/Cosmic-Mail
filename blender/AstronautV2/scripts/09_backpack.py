"""09 — mochila de soporte vital: carcasa crema redondeada, montaje frontal, panel trasero modular
(tapa superior, panel central, ranuras, tornillos), rieles laterales con indicadores naranjas,
conductos corrugados en lazo a cada lado con conectores y anclajes al arnés."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import M

MOD = "backpack"
clear_module(MOD)
bc = col("09_BACKPACK")
SHELL, GRAY, RUB, COS, ORG = M("shell"), M("gray"), M("rubber"), M("cosmic"), M("orange")
LIGHT = M("light")
CX, CY, CZ = C["backpack_center"]
HW, HD, HH = C["backpack_width"] / 2, C["backpack_depth"] / 2, C["backpack_height"] / 2
BACK = CY + HD                     # cara trasera


def rbox(name, half, center, material, n=6.0, bevel=None):
    o = create_rounded_box(name, half, bc, material, MOD, n=n, center=center)
    if bevel:
        add_bevel(o, bevel, 2, 30)
    return o


# cuerpo
main = rbox("BACKPACK_MAIN", (HW, HD, HH), (CX, CY, CZ), SHELL, n=5.0)
# montaje frontal contra la espalda del traje
rbox("BACKPACK_FRONT_MOUNT", (HW * 0.70, 0.045, HH * 0.78), (CX, CY - HD + 0.01, CZ - 0.02), GRAY, n=5.0)

# panel trasero modular
rbox("BACKPACK_REAR_PANEL", (HW * 0.80, 0.030, HH * 0.86), (CX, BACK - 0.005, CZ - 0.01), SHELL, n=7.0, bevel=0.004)
rbox("BACKPACK_REAR_PANEL_FRAME", (HW * 0.84, 0.020, HH * 0.89), (CX, BACK - 0.018, CZ - 0.01), GRAY, n=8.0)
# panel central superior con placa
rbox("BACKPACK_REAR_UPPER_PLATE", (HW * 0.55, 0.020, HH * 0.30), (CX, BACK + 0.025, CZ + HH * 0.36), SHELL, n=8.0, bevel=0.003)
rbox("BACKPACK_REAR_UPPER_DETAIL", (HW * 0.16, 0.010, HH * 0.06), (CX, BACK + 0.046, CZ + HH * 0.40), GRAY, n=6.0)
# tapa superior (asa gris) y tapa inferior
rbox("BACKPACK_TOP_CAP", (HW * 0.66, 0.085, 0.045), (CX, CY + HD * 0.50, CZ + HH + 0.012), GRAY, n=5.0, bevel=0.004)
for sx in (-1, 1):
    rbox(f"BACKPACK_TOP_CAP_POST_{'L' if sx > 0 else 'R'}", (0.025, 0.05, 0.04), (sx * HW * 0.55, CY + HD * 0.55, CZ + HH - 0.02),
         GRAY, n=5.0)
rbox("BACKPACK_BOTTOM_CAP", (HW * 0.70, 0.07, 0.030), (CX, CY + HD * 0.45, CZ - HH - 0.005), GRAY, n=6.0, bevel=0.004)
# ranuras horizontales (barra media y ranura inferior)
rbox("BACKPACK_SLOT_MID_FRAME", (HW * 0.42, 0.016, 0.028), (CX, BACK + 0.026, CZ - HH * 0.12), GRAY, n=6.0)
rbox("BACKPACK_SLOT_MID", (HW * 0.36, 0.010, 0.010), (CX, BACK + 0.040, CZ - HH * 0.12), RUB, n=6.0)
rbox("BACKPACK_SLOT_LOW_FRAME", (HW * 0.42, 0.016, 0.026), (CX, BACK + 0.026, CZ - HH * 0.62), GRAY, n=6.0)
rbox("BACKPACK_SLOT_LOW", (HW * 0.36, 0.010, 0.009), (CX, BACK + 0.040, CZ - HH * 0.62), RUB, n=6.0)
# panel inferior rebajado (entre la barra media y la ranura inferior) y pestañas grises en los bordes
rbox("BACKPACK_REAR_LOWER_PLATE", (HW * 0.55, 0.018, HH * 0.17), (CX, BACK + 0.022, CZ - HH * 0.37), SHELL, n=8.0, bevel=0.003)
for sx, nm in ((1, "L"), (-1, "R")):
    rbox(f"BACKPACK_REAR_TAB_{nm}_1", (0.024, 0.022, 0.075), (sx * HW * 0.86, BACK + 0.010, CZ + HH * 0.48), GRAY, n=5.0, bevel=0.003)
    rbox(f"BACKPACK_REAR_TAB_{nm}_2", (0.024, 0.022, 0.030), (sx * HW * 0.86, BACK + 0.010, CZ - HH * 0.30), GRAY, n=5.0, bevel=0.003)
# tornillos (instancias de una malla)
src = create_surface_of_revolution("BACKPACK_SCREW_SOURCE", [(0, 0), (0.016, 0), (0.016, 0.004), (0.011, 0.009), (0, 0.010)],
                                   bc, GRAY, MOD, segments=16)
src.hide_viewport = src.hide_render = True
k = 0
for sx in (-1, 1):
    for z in (CZ + HH * 0.74, CZ - HH * 0.40, CZ - HH * 0.80):
        o = bpy.data.objects.new(f"BACKPACK_SCREW_{k + 1:02d}", src.data)
        bc.objects.link(o)
        tag(o, MOD)
        orient_object(o, Vector((sx * HW * 0.70, BACK + 0.018, z)), Vector((0, 1, 0)))
        k += 1
o = bpy.data.objects.new(f"BACKPACK_SCREW_{k + 1:02d}", src.data)      # tornillo del panel inferior (ficha)
bc.objects.link(o)
tag(o, MOD)
orient_object(o, Vector((HW * 0.40, BACK + 0.038, CZ - HH * 0.47)), Vector((0, 1, 0)))

# laterales: rieles grises, ranuras e indicadores naranjas verticales con marco oscuro
for sx, nm in ((1, "L"), (-1, "R")):
    xs = sx * HW
    rbox(f"BACKPACK_SIDE_MODULES_{nm}", (0.030, HD * 0.62, HH * 0.80), (xs + sx * 0.012, CY + 0.02, CZ), GRAY, n=6.0, bevel=0.004)
    rbox(f"BACKPACK_STATUS_FRAME_{nm}", (0.022, 0.036, 0.135), (xs + sx * 0.040, CY + HD * 0.42, CZ - 0.05), RUB, n=6.0)
    li = rbox(f"BACKPACK_STATUS_LIGHTS_{nm}", (0.016, 0.022, 0.115), (xs + sx * 0.052, CY + HD * 0.42, CZ - 0.05), LIGHT, n=4.0)
    # segunda luz, más delgada, hacia la parte delantera del lateral (vista lateral de la ficha)
    rbox(f"BACKPACK_STATUS_FRAME_{nm}_B", (0.020, 0.028, 0.110), (xs + sx * 0.040, CY - HD * 0.20, CZ - 0.12), RUB, n=6.0)
    rbox(f"BACKPACK_STATUS_LIGHTS_{nm}_B", (0.014, 0.016, 0.092), (xs + sx * 0.050, CY - HD * 0.20, CZ - 0.12), LIGHT, n=4.0)
    # botón cuadrado oscuro con marco gris (arriba del lateral)
    rbox(f"BACKPACK_SIDE_BUTTON_FRAME_{nm}", (0.020, 0.062, 0.062), (xs + sx * 0.038, CY + HD * 0.10, CZ + HH * 0.55), GRAY, n=5.0, bevel=0.003)
    rbox(f"BACKPACK_SIDE_BUTTON_{nm}", (0.014, 0.044, 0.044), (xs + sx * 0.052, CY + HD * 0.10, CZ + HH * 0.55), RUB, n=5.0)
    # zócalo gris inferior del lateral
    rbox(f"BACKPACK_SIDE_FOOT_{nm}", (0.026, HD * 0.55, 0.040), (xs + sx * 0.012, CY + HD * 0.05, CZ - HH * 0.90), GRAY, n=5.0, bevel=0.003)
    for j, zz in enumerate((CZ + 0.24, CZ + 0.16)):
        rbox(f"BACKPACK_SIDE_SLOT_{nm}_{j + 1}", (0.012, 0.075, 0.010), (xs + sx * 0.045, CY - 0.03, zz), RUB, n=6.0)

    # conducto corrugado en lazo: sale arriba-delante, se abre hacia fuera, baja y vuelve abajo
    # (ficha: lazo grueso en C que sobresale hacia fuera y hacia delante, visible desde atrás y de lado)
    p_top = Vector((xs + sx * 0.03, CY - HD * 0.05, CZ + HH * 0.46))
    p_bot = Vector((xs + sx * 0.03, CY - HD * 0.40, CZ - HH * 0.74))
    ctrl = [p_top,
            p_top + Vector((sx * 0.08, -0.04, 0.02)),
            Vector((xs + sx * 0.17, CY - HD * 0.65, CZ + HH * 0.22)),
            Vector((xs + sx * 0.20, CY - HD * 0.90, CZ - HH * 0.12)),
            Vector((xs + sx * 0.17, CY - HD * 0.95, CZ - HH * 0.48)),
            p_bot + Vector((sx * 0.08, -0.06, -0.04)),
            p_bot]
    create_hose(f"BACKPACK_HOSES_{nm}", ctrl, 0.060, bc, RUB, MOD, pitch=0.038, amp=0.20, seg=24, samples=14)
    for j, (p, d) in enumerate(((p_top, Vector((sx, -0.2, 0.3))), (p_bot, Vector((sx, -0.2, -0.3))))):
        cn = create_surface_of_revolution(f"BACKPACK_CONNECTORS_{nm}_{j + 1}",
                                          [(0, -0.02), (0.058, -0.02), (0.062, 0.0), (0.062, 0.045), (0.054, 0.06), (0, 0.06)],
                                          bc, GRAY, MOD, segments=32)
        orient_object(cn, p - d.normalized() * 0.03, d)
    # anclaje del arnés (la correa del hombro entra en la mochila)
    rbox(f"BACKPACK_ANCHOR_{nm}", (0.060, 0.030, 0.045), (sx * 0.285, CY - HD - 0.005, CZ + HH * 0.62), GRAY, n=5.0, bevel=0.003)
    rbox(f"BACKPACK_ANCHOR_LOW_{nm}", (0.060, 0.030, 0.045), (sx * 0.285, CY - HD - 0.005, CZ - HH * 0.55), GRAY, n=5.0, bevel=0.003)
print("BACKPACK OK", len([o for o in bpy.data.objects if o.get(MOD_KEY) == MOD]))
