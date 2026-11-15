"""17 — guardado y exportación: .blend principal, GLB (malla + rig + acciones) y FBX. Comprueba el GLB reimportándolo
en una escena temporal (escala, orientación, jerarquía, materiales y animaciones)."""
import os
import bpy
from config import *
from geometry_utils import refresh_drivers

sc = bpy.context.scene
sc.frame_set(1)
refresh_drivers()
sc.camera = bpy.data.objects["CAM_HERO"]
out = {}
# ocultar fuentes de instancias y estudio en la exportación
export_objs = [o for o in bpy.data.objects
               if o.type in ('MESH', 'CURVE', 'ARMATURE', 'EMPTY') and not o.hide_render
               and not o.name.startswith("STUDIO_") and o.users_collection]
for o in bpy.context.view_layer.objects:
    o.select_set(o in export_objs)
glb = os.path.join(PROJECT_DIR, "CosmicMail_Astronaut.glb")
r = bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
                              export_animations=True, export_yup=True)
out["glb"] = (r, os.path.getsize(glb) if os.path.exists(glb) else 0)
fbx = os.path.join(PROJECT_DIR, "CosmicMail_Astronaut.fbx")
try:
    r = bpy.ops.export_scene.fbx(filepath=fbx, use_selection=True, apply_unit_scale=True, add_leaf_bones=False,
                                 bake_anim=True, object_types={'ARMATURE', 'MESH', 'EMPTY'})
    out["fbx"] = (r, os.path.getsize(fbx) if os.path.exists(fbx) else 0)
except Exception as exc:
    out["fbx"] = f"{type(exc).__name__}: {exc}"
for o in bpy.context.view_layer.objects:
    o.select_set(False)

# verificación del GLB: importar en una escena temporal y medir
tmp = bpy.data.scenes.new("_GLB_CHECK")
win = bpy.context.window
prev = win.scene
win.scene = tmp
try:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=glb)
    new = [o for o in bpy.data.objects if o not in before]
    # solo piezas del personaje (el importador crea una esfera auxiliar sin material para mostrar huesos)
    meshes = [o for o in new if o.type == 'MESH' and o.material_slots and o.material_slots[0].material]
    zs = [(o.matrix_world @ o.data.vertices[i].co).z for o in meshes for i in range(0, len(o.data.vertices), 50)]
    out["glb_check"] = {"objects": len(new), "meshes": len(meshes),
                        "armatures": len([o for o in new if o.type == 'ARMATURE']),
                        "height": round(max(zs) - min(zs), 3) if zs else 0, "min_z": round(min(zs), 3) if zs else 0,
                        "materials": len({s.material.name for o in meshes for s in o.material_slots if s.material}),
                        "imported_actions": len([a for a in bpy.data.actions if a.users and a.name.endswith(".001")])}
finally:
    win.scene = prev
    for o in list(tmp.collection.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(tmp.collection.children_recursive):
        bpy.data.collections.remove(c)
    bpy.data.scenes.remove(tmp)
    for coll in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
# acciones importadas sobrantes
for a in list(bpy.data.actions):
    if a.users == 0 and not a.use_fake_user:
        bpy.data.actions.remove(a)
for img in list(bpy.data.images):
    if img.users == 0:
        bpy.data.images.remove(img)
bpy.ops.wm.save_as_mainfile(filepath=FINAL_BLEND)
out["blend"] = FINAL_BLEND
print("EXPORT OK", out)
