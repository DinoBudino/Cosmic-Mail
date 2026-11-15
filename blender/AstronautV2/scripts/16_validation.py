"""16 — validación geométrica, de materiales, drivers, constraints y rig. Escribe reports/validation.json."""
import json
import math
import os
import bpy
import bmesh
from mathutils import Vector
from config import *
from geometry_utils import refresh_drivers, MOD_KEY

sc = bpy.context.scene
sc.frame_set(1)
bad_drivers, n_drivers = refresh_drivers()
arm = bpy.data.objects["ASTRONAUT_RIG"]
arm.data.pose_position = 'POSE'


def inspect_mesh(obj):
    if obj.type != 'MESH':
        return None
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    r = {"object": obj.name, "vertices": len(bm.verts), "edges": len(bm.edges), "faces": len(bm.faces),
         "non_manifold_edges": sum(1 for e in bm.edges if not e.is_manifold),
         "degenerate_faces": sum(1 for f in bm.faces if f.calc_area() < 1e-10)}
    bm.free()
    return r


# clasificación: superficies abiertas intencionadas (paneles, franjas, correas abiertas, visor)
OPEN_OK = ("HELMET_", "VISOR_", "ARM_L_SHOULDER", "ARM_R_SHOULDER", "LEG_L_KNEE_ORANGE", "LEG_R_KNEE_ORANGE",
           "BOOT_L_TOE", "BOOT_R_TOE", "BOOT_L_HEEL", "BOOT_R_HEEL", "BOOT_L_ORANGE", "BOOT_R_ORANGE", "WAIST_SEAL",
           "TORSO_HARNESS_BELT", "STUDIO_", "BOOT_L", "BOOT_R")
problems = []
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
mesh_stats, open_surfaces, degenerate = [], [], 0
for o in meshes:
    s = inspect_mesh(o)
    mesh_stats.append(s)
    if s["vertices"] == 0:
        problems.append(f"malla vacía: {o.name}")
    degenerate += s["degenerate_faces"]
    if s["non_manifold_edges"]:
        if o.name.startswith(OPEN_OK) or o.data.users > 1:
            open_surfaces.append(o.name)
        else:
            open_surfaces.append(o.name + " (revisar)")
    if not o.material_slots or any(sl.material is None for sl in o.material_slots):
        problems.append(f"sin material: {o.name}")
    if any(v < 0 for v in o.scale):
        problems.append(f"escala negativa: {o.name}")
for o in bpy.data.objects:
    if not o.users_collection or all(c.name == "Scene Collection" for c in o.users_collection):
        problems.append(f"fuera de colección: {o.name}")
    if o.get(MOD_KEY) is None and o.type in ('MESH', 'CURVE'):
        problems.append(f"objeto sin módulo (ajeno?): {o.name}")
generic = [o.name for o in bpy.data.objects if any(o.name.startswith(g) for g in ("Cube", "Sphere", "Cylinder", "Plane", "Empty"))]
if generic:
    problems.append(f"nombres genéricos: {generic}")
broken_constraints = [f"{pb.name}:{c.name}" for pb in arm.pose.bones for c in pb.constraints if not c.is_valid]
if broken_constraints:
    problems.append(f"constraints rotos: {broken_constraints}")
if bad_drivers:
    problems.append(f"drivers inválidos: {bad_drivers}")

# normales hacia fuera en mallas cerradas (volumen firmado > 0)
inverted = []
for o in meshes:
    if o.name.startswith(OPEN_OK) or o.hide_render:
        continue
    me = o.data
    vol = 0.0
    for p in me.polygons:
        vs = [me.vertices[i].co for i in p.vertices]
        for k in range(1, len(vs) - 1):
            vol += vs[0].dot(vs[k].cross(vs[k + 1])) / 6.0
    if vol < -1e-7:
        inverted.append(o.name)
if inverted:
    problems.append(f"normales invertidas: {inverted}")


# ── pruebas del rig ──
def wpos(name):
    return bpy.data.objects[name].matrix_world.translation.copy()


def rel(a, b):
    return (bpy.data.objects[a].matrix_world.inverted() @ bpy.data.objects[b].matrix_world).translation.copy()


tests = {}
PB = arm.pose.bones
for pb in PB:
    pb.rotation_mode = 'XYZ'
base_rel = {"visor_vs_helmet": rel("HELMET_MAIN_SHELL", "VISOR_GLASS"),
            "backpack_vs_torso": rel("TORSO_MAIN", "BACKPACK_MAIN"),
            "hose_vs_backpack": rel("BACKPACK_MAIN", "BACKPACK_HOSES_L")}
# cabeza
PB["HEAD"].rotation_euler = (math.radians(-12), 0, math.radians(25))
PB["SPINE_02"].rotation_euler = (0, 0, math.radians(-10))
bpy.context.view_layer.update()
tests["head_rotation_visor_rigid"] = (rel("HELMET_MAIN_SHELL", "VISOR_GLASS") - base_rel["visor_vs_helmet"]).length < 1e-4
tests["backpack_follows_torso"] = (rel("TORSO_MAIN", "BACKPACK_MAIN") - base_rel["backpack_vs_torso"]).length < 1e-4
tests["hoses_stay_connected"] = (rel("BACKPACK_MAIN", "BACKPACK_HOSES_L") - base_rel["hose_vs_backpack"]).length < 1e-4
PB["HEAD"].rotation_euler = PB["SPINE_02"].rotation_euler = (0, 0, 0)
# codo (IK) y muñeca
hl = bpy.data.objects["CTRL_HAND_L_IK"]
r0 = hl.location.copy()
w0 = wpos("WRIST_L_RING")
hl.location = r0 + Vector((0.05, -0.25, 0.30))
bpy.context.view_layer.update()
ang = PB["FOREARM_L"].matrix.to_3x3().col[1].angle(PB["UPPER_ARM_L"].matrix.to_3x3().col[1])
tests["elbow_flexes_deg"] = round(math.degrees(ang), 1)
tests["wrist_follows_ik"] = (wpos("WRIST_L_RING") - (w0 + Vector((0.05, -0.25, 0.30)))).length < 0.02
hl.rotation_euler = (0, math.radians(25), 0)
bpy.context.view_layer.update()
tests["wrist_rotates"] = PB["HAND_L"].matrix.to_3x3().col[1].angle(arm.data.bones["HAND_L"].matrix_local.to_3x3().col[1]) > 0.1
hl.location, hl.rotation_euler = r0, (0, 0, 0)
# rodilla (IK)
fo = bpy.data.objects["CTRL_FOOT_R_IK"]
f0 = fo.location.copy()
fo.location = f0 + Vector((0, -0.10, 0.22))
bpy.context.view_layer.update()
ang = PB["SHIN_R"].matrix.to_3x3().col[1].angle(PB["THIGH_R"].matrix.to_3x3().col[1])
tests["knee_flexes_deg"] = round(math.degrees(ang), 1)
fo.location = f0
# dedos
tip0 = wpos("FINGERS_R_INDEX_02")
for f in ("INDEX", "MIDDLE", "RING", "PINKY"):
    PB[f"{f}_01_R"].rotation_euler = (math.radians(50), 0, 0)
    PB[f"{f}_02_R"].rotation_euler = (math.radians(50), 0, 0)
bpy.context.view_layer.update()
tests["fingers_bend"] = (wpos("FINGERS_R_INDEX_02") - tip0).length > 0.02
for pb in PB:
    pb.rotation_euler = (0, 0, 0)
tests["no_hud_objects"] = not any(o.name.startswith(("HUD_", "CTRL_HUD")) for o in bpy.data.objects)
sc.frame_set(1)
bpy.context.view_layer.update()
for k, v in tests.items():
    if v is False:
        problems.append(f"prueba de rig fallida: {k}")

report = {
    "blender": bpy.app.version_string,
    "objects": len(bpy.data.objects),
    "meshes": len(meshes),
    "materials_used": sorted({sl.material.name for o in bpy.data.objects if o.type in ('MESH', 'CURVE') for sl in o.material_slots if sl.material}),
    "bones": len(arm.data.bones),
    "cameras": len([o for o in bpy.data.objects if o.type == 'CAMERA']),
    "lights": len([o for o in bpy.data.objects if o.type == 'LIGHT']),
    "drivers": n_drivers,
    "degenerate_faces": degenerate,
    "open_surfaces_intentional": [n for n in open_surfaces if "(revisar)" not in n],
    "open_surfaces_to_review": [n for n in open_surfaces if "(revisar)" in n],
    "rig_tests": tests,
    "problems": problems,
    "vertices_total": sum(s["vertices"] for s in mesh_stats),
    "faces_total": sum(s["faces"] for s in mesh_stats),
}
os.makedirs(REPORTS_DIR, exist_ok=True)
with open(os.path.join(REPORTS_DIR, "validation.json"), "w") as fh:
    json.dump(report, fh, indent=2, ensure_ascii=False)
print("VALIDATION", {k: report[k] for k in ("objects", "meshes", "bones", "cameras", "drivers",
                                            "degenerate_faces", "vertices_total", "faces_total")})
print("RIG TESTS", tests)
print("TO REVIEW", report["open_surfaces_to_review"])
print("PROBLEMS", problems)
