"""00 — escena limpia del astronauta: colecciones, unidades, materiales base.
Seguridad: si el archivo abierto tiene cambios sin guardar, se detiene (no destruye trabajo ajeno)."""
import bpy
from config import *
from geometry_utils import create_collection
from material_utils import ensure_materials

if bpy.data.is_dirty and bpy.data.filepath and bpy.data.filepath != FINAL_BLEND:
    raise RuntimeError(f"El archivo abierto tiene cambios sin guardar: {bpy.data.filepath}")

# escena vacía dentro de la sesión (sin recargar Blender, para no cortar el MCP)
for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras,
             bpy.data.lights, bpy.data.armatures, bpy.data.actions, bpy.data.collections, bpy.data.images,
             bpy.data.node_groups):
    bpy.data.batch_remove(list(coll))
for w in list(bpy.data.worlds):
    bpy.data.worlds.remove(w)

sc = bpy.context.scene
sc.name = "COSMIC_MAIL_ASTRONAUT"
sc.unit_settings.system = 'METRIC'
sc.unit_settings.scale_length = 1.0
sc.render.fps = 24
sc.frame_start, sc.frame_end = 1, 120

root = create_collection("COSMIC_MAIL_ASTRONAUT")
for name in COLLECTIONS:
    create_collection(name, root)
for sub in ("CAMERAS", "LIGHTS", "STUDIO_BACKGROUND"):
    create_collection(sub, bpy.data.collections["12_LIGHTING_CAMERAS"])
ensure_materials()
print("INIT OK", bpy.app.version_string, "collections:", len(bpy.data.collections),
      "materials:", len(bpy.data.materials))
