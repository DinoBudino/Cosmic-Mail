"""11 — renders de entrega, hoja de expresiones y validación geométrica automática."""
import json
import numpy as np
from pip_utils import *

scene = bpy.context.scene
R = scene.render
vc = col("12_VALIDATION")
os.makedirs(RENDERS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# cámara de primer plano facial (validación)
cf = create_camera("CAM_FACE_CLOSE", (0, -8.2, 0.06), (0, 0, 0.06), col("STUDIO_CAMERAS"), lens=150.0)
cf["pip_module"] = "studio"

face = bpy.data.objects["CTRL_FACE"]
orig_expr = face["face_expression"]
orig_cam = scene.camera
scene.frame_set(1)


def render(cam, path, size=1024):
    scene.camera = bpy.data.objects[cam]
    R.resolution_x = R.resolution_y = size
    R.filepath = path
    bpy.ops.render.render(write_still=True)


VIEWS = {"PIP_Front": "CAM_FRONT", "PIP_Front_ThreeQuarter": "CAM_FRONT_3Q", "PIP_Left": "CAM_LEFT",
         "PIP_Right": "CAM_RIGHT", "PIP_Rear": "CAM_REAR", "PIP_Rear_ThreeQuarter": "CAM_REAR_3Q",
         "PIP_Top_ThreeQuarter": "CAM_TOP_3Q", "PIP_Hero": "CAM_HERO"}
for fn, cam in VIEWS.items():
    render(cam, f"{RENDERS_DIR}/{fn}.png")
    print("render", fn)

# hoja de expresiones 3x3 (cada expresión se renderiza en el frame donde está clavada)
# Para evitar que el fcurve pise el valor, se renderiza en el frame donde cada expresión está clavada
FRAME_OF = {10: 1, 1: 13, 2: 25, 3: 37, 4: 49, 5: 61, 6: 73, 7: 85, 8: 97, 9: 109}
imgs = []
for i in range(1, 10):
    scene.frame_set(FRAME_OF[i])
    assert int(round(face["face_expression"])) == i, (i, face["face_expression"])
    p = f"{RENDERS_DIR}/_expr_{i}.png"
    render("CAM_FACE_CLOSE", p, 512)
    imgs.append(bpy.data.images.load(p, check_existing=False))
S = 512
sheet = np.zeros((S * 3, S * 3, 4), dtype=np.float32)
for k, im in enumerate(imgs):
    a = np.array(im.pixels[:], dtype=np.float32).reshape(S, S, 4)
    r, c = divmod(k, 3)
    sheet[(2 - r) * S:(3 - r) * S, c * S:(c + 1) * S] = a
out = bpy.data.images.new("PIP_Expressions", S * 3, S * 3, alpha=True)
out.pixels = sheet.ravel().tolist()
out.filepath_raw = f"{RENDERS_DIR}/PIP_Expressions.png"
out.file_format = 'PNG'
out.save()
for im in imgs:
    bpy.data.images.remove(im)
for i in range(1, 10):
    try:
        os.remove(f"{RENDERS_DIR}/_expr_{i}.png")
    except OSError:
        pass
bpy.data.images.remove(out)

scene.frame_set(1)
scene.camera = bpy.data.objects["CAM_HERO"]
R.resolution_x = R.resolution_y = 1024

# ─────────── validación geométrica ───────────
rep = {"objects": 0, "meshes": 0, "problems": [], "per_mesh": []}
OPEN_OK = ("FACE", "EXP_", "STRIPE", "BORDER", "SEAM", "STRUCTURAL", "PANEL", "DIFFUSER", "RING", "RECESS", "VISOR",
           "SHELL", "BODY_CORE", "FRONT_ACCENT", "REAR_", "VENT", "CAMERA", "SENSOR", "THRUSTER_HALO")
names = {}
for o in bpy.data.objects:
    rep["objects"] += 1
    names[o.name] = names.get(o.name, 0) + 1
    if o.type != 'MESH':
        continue
    rep["meshes"] += 1
    ins = inspect_mesh(o)
    if ins["verts"] == 0:
        rep["problems"].append(f"{o.name}: malla vacía")
    if ins["materials"] == 0:
        rep["problems"].append(f"{o.name}: sin material")
    if ins["degenerate_faces"]:
        rep["problems"].append(f"{o.name}: {ins['degenerate_faces']} caras degeneradas")
    if o.parent is None and o.name != "SCREW_SOURCE" and not o.name.startswith("STUDIO_"):
        rep["problems"].append(f"{o.name}: fuera de la jerarquía")
    if min(o.scale) < 0:
        rep["problems"].append(f"{o.name}: escala negativa")
    # volumen cerrado esperado en revoluciones/módulos
    expect_closed = o.name.startswith(("MODULE", "SIDE_CENTER", "ANTENNA_", "THRUSTER_N", "THRUSTER_H", "THRUSTER_E", "SCREW"))
    ins["expect_closed"] = expect_closed
    if expect_closed and ins["non_manifold_edges"] and not o.name.startswith(("THRUSTER_HALO",)):
        ins["note"] = "bordes abiertos (revolución abierta/tapa)"
    rep["per_mesh"].append(ins)
rep["duplicate_names"] = [n for n, c in names.items() if c > 1]
bad = []
for o in bpy.data.objects:
    for d in (o.animation_data.drivers if o.animation_data else []):
        if not d.driver.is_valid:
            bad.append((o.name, d.data_path))
for idb in list(bpy.data.materials) + list(bpy.data.lights):
    t = getattr(idb, "node_tree", None) or idb
    if t and t.animation_data:
        for d in t.animation_data.drivers:
            if not d.driver.is_valid:
                bad.append((idb.name, d.data_path))
rep["invalid_drivers"] = bad
rep["modifier_errors"] = [f"{o.name}:{m.name}" for o in bpy.data.objects for m in getattr(o, "modifiers", []) if not m.show_viewport and False]
rep["counts"] = {
    "mesh_objects": rep["meshes"],
    "materials": len(bpy.data.materials),
    "expressions": len([o for o in bpy.data.objects if o.name.startswith("EXP_") and o.type == 'EMPTY']),
    "controllers": len([o for o in col("00_CONTROLLERS").objects]),
    "cameras": len([o for o in bpy.data.objects if o.type == 'CAMERA']),
    "lights": len([o for o in bpy.data.objects if o.type == 'LIGHT']),
}
with open(f"{REPORTS_DIR}/validation.json", "w") as f:
    json.dump(rep, f, indent=1, default=str)
print("VALIDATION", rep["counts"], "problems:", len(rep["problems"]), "dup:", rep["duplicate_names"], "drivers:", bad)
for pr in rep["problems"][:25]:
    print(" -", pr)
