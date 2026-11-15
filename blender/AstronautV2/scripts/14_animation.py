"""14 — pose base y animación de prueba (120 f @ 24 fps): inclinación de cabeza, torso, brazo por IK,
apertura/cierre de dedos y flexión de rodilla y tobillo.
También guarda POSE_REFERENCE_NEUTRAL (acción con fake user)."""
import math
import bpy
from mathutils import Vector
from config import *

sc = bpy.context.scene
sc.frame_start, sc.frame_end, sc.render.fps = 1, 120, 24
arm = bpy.data.objects["ASTRONAUT_RIG"]
ctrls = [bpy.data.objects[n] for n in ("CTRL_HAND_L_IK", "CTRL_HAND_R_IK", "CTRL_FOOT_L_IK", "CTRL_FOOT_R_IK")]
# reposo de los controladores = posiciones de diseño (config), nunca la pose actual
REST = {}
for sx, s_ in ((1, "L"), (-1, "R")):
    REST[f"CTRL_HAND_{s_}_IK"] = (sx * C["wrist"][0], C["wrist"][1], C["wrist"][2])
    REST[f"CTRL_FOOT_{s_}_IK"] = (sx * C["ankle"][0], C["ankle"][1], C["ankle"][2])


def fcurves_of(action):
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for cb in getattr(strip, "channelbags", []):
                out += list(cb.fcurves)
    if not out and hasattr(action, "fcurves"):
        out = list(action.fcurves)
    return out


def reset_pose():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    for o in ctrls:
        o.location = REST[o.name]
        o.rotation_euler = (0, 0, 0)


# limpiar animación previa
for idb in [arm] + ctrls:
    if idb.animation_data:
        idb.animation_data_clear()
for name in ("POSE_REFERENCE_NEUTRAL", "ASTRO_TestAnim_Rig", "ASTRO_TestAnim_HUD", "ASTRO_TestAnim_HandL",
             "ASTRO_TestAnim_FootR", "ASTRO_TestAnim_HandR", "ASTRO_TestAnim_FootL"):
    a = bpy.data.actions.get(name)
    if a:
        bpy.data.actions.remove(a)

# ── pose de referencia neutral (codos ya suavemente flexionados en el modelado, dedos relajados) ──
reset_pose()
for pb in arm.pose.bones:
    pb.keyframe_insert("rotation_euler", frame=1)
pose_action = arm.animation_data.action
pose_action.name = "POSE_REFERENCE_NEUTRAL"
pose_action.use_fake_user = True
arm.animation_data.action = None

# ── animación de prueba ──
B = arm.pose.bones


def key_bone(name, frame, rot_deg):
    pb = B[name]
    pb.rotation_euler = tuple(math.radians(a) for a in rot_deg)
    pb.keyframe_insert("rotation_euler", frame=frame)


for fr, head, spine in ((1, (0, 0, 0), (0, 0, 0)), (30, (-6, 0, 14), (0, 0, -5)), (60, (8, 0, -6), (2, 0, 4)),
                        (90, (-4, 6, -14), (0, 0, 6)), (120, (0, 0, 0), (0, 0, 0))):
    key_bone("HEAD", fr, head)
    key_bone("SPINE_02", fr, spine)
# dedos: abierto → cierre parcial → abierto (ambas manos)
for fr, a1, a2 in ((1, 0, 0), (25, -12, -8), (50, 55, 60), (75, 30, 35), (100, -10, -5), (120, 0, 0)):
    for s in ("L", "R"):
        for f in ("INDEX", "MIDDLE", "RING", "PINKY"):
            key_bone(f"{f}_01_{s}", fr, (a1, 0, 0))
            key_bone(f"{f}_02_{s}", fr, (a2, 0, 0))
        key_bone(f"THUMB_01_{s}", fr, (a1 * 0.4, 0, 0))
        key_bone(f"THUMB_02_{s}", fr, (a2 * 0.5, 0, 0))
arm.animation_data.action.name = "ASTRO_TestAnim_Rig"

# brazo izquierdo (IK): saludo suave
hl = bpy.data.objects["CTRL_HAND_L_IK"]
r = Vector(REST[hl.name])
for fr, d in ((1, (0, 0, 0)), (35, (0.06, -0.22, 0.30)), (55, (0.10, -0.28, 0.38)), (75, (0.06, -0.22, 0.30)),
              (105, (0, 0, 0)), (120, (0, 0, 0))):
    hl.location = r + Vector(d)
    hl.keyframe_insert("location", frame=fr)
hl.animation_data.action.name = "ASTRO_TestAnim_HandL"
# brazo derecho: pequeño balanceo
hr = bpy.data.objects["CTRL_HAND_R_IK"]
r = Vector(REST[hr.name])
for fr, d in ((1, (0, 0, 0)), (40, (0, 0.06, 0.03)), (80, (0, -0.06, 0.03)), (120, (0, 0, 0))):
    hr.location = r + Vector(d)
    hr.keyframe_insert("location", frame=fr)
hr.animation_data.action.name = "ASTRO_TestAnim_HandR"
# pierna derecha: levantar el pie (flexión de rodilla) y rotar el tobillo
fo = bpy.data.objects["CTRL_FOOT_R_IK"]
r = Vector(REST[fo.name])
for fr, d, rx in ((1, (0, 0, 0), 0), (60, (0, 0, 0), 0), (78, (0, -0.10, 0.20), 12), (90, (0, -0.10, 0.20), -10),
                  (104, (0, 0, 0), 0), (120, (0, 0, 0), 0)):
    fo.location = r + Vector(d)
    fo.rotation_euler = (math.radians(rx), 0, 0)
    fo.keyframe_insert("location", frame=fr)
    fo.keyframe_insert("rotation_euler", frame=fr)
fo.animation_data.action.name = "ASTRO_TestAnim_FootR"

for o in (arm, hl, hr, fo):
    for fc in fcurves_of(o.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
sc.frame_set(1)
from geometry_utils import refresh_drivers
bad, n = refresh_drivers()
print("drivers:", n, "inválidos:", bad)
print("ANIM OK actions:", [a.name for a in bpy.data.actions])
