"""13 — rig: ASTRONAUT_RIG (columna, cuello, cabeza, clavículas, brazos, manos con 5 dedos x 2 falanges,
piernas y pies), IK de manos y pies con polos, piezas rígidas emparentadas a huesos y propiedades
conectadas (visor_reflection_strength, backpack_light_intensity)."""
import math
import bpy
from mathutils import Vector, Matrix
from config import *
from geometry_utils import *
from rig_utils import *

MOD = "rig"
rc = col("11_RIG_CONTROLS")
for sub in ("ARMATURE", "IK_CONTROLLERS", "LIGHT_CONTROLLERS"):
    create_collection(sub, rc)

# ── limpieza idempotente: desemparentar piezas y borrar rig/controles anteriores ──
old = bpy.data.objects.get("ASTRONAUT_RIG")
if old is not None:
    old.data.pose_position = 'REST'          # desemparentar siempre desde la pose de reposo
    bpy.context.view_layer.update()
    for o in list(bpy.data.objects):
        if o.parent == old:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    bpy.data.objects.remove(old, do_unlink=True)
if "ASTRONAUT_RIG_DATA" in bpy.data.armatures:
    bpy.data.armatures.remove(bpy.data.armatures["ASTRONAUT_RIG_DATA"])
clear_module(MOD)
bpy.context.view_layer.update()

arm_data = bpy.data.armatures.new("ASTRONAUT_RIG_DATA")
arm = bpy.data.objects.new("ASTRONAUT_RIG", arm_data)
col("ARMATURE").objects.link(arm)
tag(arm, MOD)
arm_data.display_type = 'STICK'
arm.show_in_front = True

hand_data = bpy.app.driver_namespace.get("ASTRO_HAND_DATA")
if hand_data is None:
    raise RuntimeError("Ejecuta 06_gloves antes de 13_rig (faltan los datos de dedos)")

for o in bpy.context.view_layer.objects:
    o.select_set(False)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
create_bone(eb, "ROOT", (0, 0, 0), (0, 0.45, 0))
create_bone(eb, "PELVIS", (0, 0, 1.08), (0, 0, 1.24), "ROOT", deform=True)
create_bone(eb, "SPINE_01", (0, 0, 1.24), (0, 0, 1.42), "PELVIS", connect=True, deform=True)
create_bone(eb, "SPINE_02", (0, 0, 1.42), (0, 0, 1.90), "SPINE_01", connect=True, deform=True)
create_bone(eb, "NECK", (0, 0, 1.90), (0, 0, 2.03), "SPINE_02", connect=True, deform=True)
create_bone(eb, "HEAD", (0, 0, 2.03), (0, 0, 2.60), "NECK", connect=True, deform=True)
for sx, s in ((1, "L"), (-1, "R")):
    sh = Vector((sx * C["shoulder_x"], 0.0, C["shoulder_z"]))
    el = Vector((sx * C["elbow"][0], C["elbow"][1], C["elbow"][2]))
    wr = Vector((sx * C["wrist"][0], C["wrist"][1], C["wrist"][2]))
    create_bone(eb, f"CLAVICLE_{s}", (sx * 0.08, 0, 1.84), sh, "SPINE_02", deform=True)
    create_bone(eb, f"UPPER_ARM_{s}", sh, el, f"CLAVICLE_{s}", connect=True, deform=True)
    create_bone(eb, f"FOREARM_{s}", el, wr, f"UPPER_ARM_{s}", connect=True, deform=True)
    hd = hand_data[s]
    create_bone(eb, f"HAND_{s}", wr, wr + Vector((sx * 0.012, -0.012, -0.22)), f"FOREARM_{s}", connect=True, deform=True)
    for fname, (b, j1, tip) in hd["fingers"].items():
        create_bone(eb, f"{fname}_01_{s}", b, j1, f"HAND_{s}", deform=True)
        create_bone(eb, f"{fname}_02_{s}", j1, tip, f"{fname}_01_{s}", connect=True, deform=True)
    hp = Vector((sx * C["hip"][0], C["hip"][1], C["hip"][2]))
    kn = Vector((sx * C["knee"][0], C["knee"][1], C["knee"][2]))
    an = Vector((sx * C["ankle"][0], C["ankle"][1], C["ankle"][2]))
    create_bone(eb, f"THIGH_{s}", hp, kn, "PELVIS", deform=True)
    create_bone(eb, f"SHIN_{s}", kn, an, f"THIGH_{s}", connect=True, deform=True)
    create_bone(eb, f"FOOT_{s}", an, Vector((an.x, -0.36, 0.08)), f"SHIN_{s}", connect=True, deform=True)
bpy.ops.object.mode_set(mode='OBJECT')
n_bones = len(arm_data.bones)

# ── controladores IK + polos ──
ikc = col("IK_CONTROLLERS")
for sx, s in ((1, "L"), (-1, "R")):
    wr = Vector((sx * C["wrist"][0], C["wrist"][1], C["wrist"][2]))
    el = Vector((sx * C["elbow"][0], C["elbow"][1], C["elbow"][2]))
    an = Vector((sx * C["ankle"][0], C["ankle"][1], C["ankle"][2]))
    kn = Vector((sx * C["knee"][0], C["knee"][1], C["knee"][2]))
    h = create_controller(f"CTRL_HAND_{s}_IK", ikc, 'CUBE', 0.09, wr, MOD)
    hp_ = create_controller(f"CTRL_ELBOW_{s}_POLE", ikc, 'SPHERE', 0.05, el + Vector((sx * 0.05, 0.75, 0)), MOD)
    f = create_controller(f"CTRL_FOOT_{s}_IK", ikc, 'CUBE', 0.13, an, MOD)
    kp = create_controller(f"CTRL_KNEE_{s}_POLE", ikc, 'SPHERE', 0.06, kn + Vector((0, -0.9, 0)), MOD)
    for o in (h, hp_, f, kp):
        o.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()
ik_report = {}
for sx, s in ((1, "L"), (-1, "R")):
    ik = add_ik(arm, f"FOREARM_{s}", bpy.data.objects[f"CTRL_HAND_{s}_IK"], bpy.data.objects[f"CTRL_ELBOW_{s}_POLE"])
    ik_report[f"ARM_{s}"] = best_pole_angle(arm, ik, [f"UPPER_ARM_{s}", f"FOREARM_{s}"])
    ik = add_ik(arm, f"SHIN_{s}", bpy.data.objects[f"CTRL_FOOT_{s}_IK"], bpy.data.objects[f"CTRL_KNEE_{s}_POLE"])
    ik_report[f"LEG_{s}"] = best_pole_angle(arm, ik, [f"THIGH_{s}", f"SHIN_{s}"])
    add_child_of(arm, f"HAND_{s}", bpy.data.objects[f"CTRL_HAND_{s}_IK"])
    add_child_of(arm, f"FOOT_{s}", bpy.data.objects[f"CTRL_FOOT_{s}_IK"])
bpy.context.view_layer.update()

# ── piezas rígidas → huesos ──
RULES = [   # (prefijo, hueso) — el primero que coincide gana
    ("HELMET_NECK_RING", "HEAD"), ("HELMET_SEALS", "HEAD"), ("NECK_SEGMENT", "NECK"), ("NECK_LOWER_RING", "SPINE_02"),
    ("HELMET_", "HEAD"), ("VISOR_", "HEAD"),
    ("TORSO_HARNESS_BELT", "SPINE_01"), ("TORSO_HARNESS_LEG", "PELVIS"), ("TORSO_SEAMS_1", "SPINE_01"),
    ("TORSO_", "SPINE_02"), ("WAIST", "SPINE_01"), ("PELVIS", "PELVIS"), ("BACKPACK_", "SPINE_02"),
]
for s in ("L", "R"):
    RULES += [(f"ARM_{s}_SHOULDER", f"CLAVICLE_{s}"), (f"ARM_{s}_UPPER", f"UPPER_ARM_{s}"),
              (f"ARM_{s}_ELBOW", f"FOREARM_{s}"), (f"ARM_{s}_FOREARM", f"FOREARM_{s}"), (f"WRIST_{s}_", f"FOREARM_{s}"),
              (f"HAND_{s}", f"HAND_{s}"), (f"HIP_CONNECTOR_{s}", f"THIGH_{s}"), (f"LEG_{s}_THIGH", f"THIGH_{s}"),
              (f"LEG_{s}_KNEE_BAND", f"THIGH_{s}"), (f"LEG_{s}_KNEE_ORANGE", f"THIGH_{s}"), (f"LEG_{s}_KNEE", f"SHIN_{s}"), (f"LEG_{s}_SHIN", f"SHIN_{s}"),
              (f"BOOT_SOLES_{s}", f"FOOT_{s}"), (f"BOOT_TREAD_{s}_", f"FOOT_{s}"), (f"BOOT_{s}", f"FOOT_{s}")]
    for fname in ("THUMB", "INDEX", "MIDDLE", "RING", "PINKY"):
        RULES += [(f"FINGERS_{s}_{fname}_02", f"{fname}_02_{s}"), (f"FINGERS_{s}_{fname}_", f"{fname}_01_{s}")]
RULES.sort(key=lambda r: -len(r[0]))          # el prefijo más específico primero
skip = {"SCREW_SOURCE", "BACKPACK_SCREW_SOURCE", "BOOT_TREAD_LUG_SOURCE"}
parented, unmatched = 0, []
for o in list(bpy.data.objects):
    if o.parent is not None or o.name in skip or o.type not in ('MESH', 'CURVE', 'EMPTY'):
        continue
    if o.get(MOD_KEY) in (None, "rig", "studio", "blockout"):
        continue
    bone = next((b for p, b in RULES if o.name.startswith(p)), None)
    if bone is None:
        unmatched.append(o.name)
        continue
    parent_to_bone(o, arm, bone)
    parented += 1

# ── propiedades del rig conectadas a mecanismos reales ──
for k, v, lo, hi in (("visor_reflection_strength", 1.0, 0.0, 3.0),
                     ("backpack_light_intensity", 1.0, 0.0, 3.0)):
    arm[k] = v
    arm.id_properties_ui(k).update(min=lo, max=hi)


def drv(id_, path, expr, vars_):
    try:
        id_.driver_remove(path)
    except Exception:
        pass
    fc = id_.driver_add(path)
    d = fc.driver
    d.type = 'SCRIPTED'
    for vn, tgt, prop in vars_:
        v = d.variables.new()
        v.name, v.type = vn, 'SINGLE_PROP'
        v.targets[0].id = tgt
        v.targets[0].data_path = f'["{prop}"]'
    d.expression = expr
    return fc


lm = bpy.data.materials["MAT_STATUS_LIGHT_ORANGE"]
drv(lm.node_tree, 'nodes["EMIT"].inputs[1].default_value', "4.0*k", [("k", arm, "backpack_light_intensity")])
# energía base fija (la de 15_studio): nunca leerla de la luz, que el driver pudo dejar a 0 al reconstruir el rig
for ln, base in (("LIGHT_VISOR_CARD_A", 900.0), ("LIGHT_VISOR_CARD_B", 300.0), ("LIGHT_VISOR_CARD_C", 420.0)):
    lo = bpy.data.objects.get(ln)
    if lo is not None:
        lo["base_energy"] = base
        drv(lo.data, "energy", "e*k", [("e", lo, "base_energy"), ("k", arm, "visor_reflection_strength")])
if "hud_intensity" in arm:
    del arm["hud_intensity"]
# reevaluar drivers (al reconstruir el rig quedan marcados como inválidos aunque sus objetivos ya existan)
for idb in list(bpy.data.objects) + list(bpy.data.lights) + [m.node_tree for m in bpy.data.materials if m.node_tree]:
    ad = getattr(idb, "animation_data", None)
    if ad:
        for fc in ad.drivers:
            fc.driver.is_valid = True
            fc.driver.expression = fc.driver.expression
bpy.context.scene.frame_set(bpy.context.scene.frame_current)
bpy.context.view_layer.update()
print("RIG OK bones:", n_bones, "parented:", parented, "unmatched:", unmatched,
      "IK:", {k: (round(v[0], 4), round(math.degrees(v[1]), 2)) for k, v in ik_report.items()})
