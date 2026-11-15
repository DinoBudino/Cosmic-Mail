"""11 — materiales PBR: reconstruye los nodos de todos los materiales del proyecto (paleta obligatoria,
microtexturas procedurales) sin cambiar las asignaciones. También retira cualquier resto del antiguo HUD
de expresiones (el visor no muestra emociones)."""
import bpy
from geometry_utils import clear_module
from material_utils import ensure_materials, _principled

clear_module("hud")
for n in ("MAT_HUD_AMBER",):
    if n in bpy.data.materials:
        bpy.data.materials.remove(bpy.data.materials[n])
for n in ("HUD_CONTROLLER",):
    if n in bpy.data.collections:
        bpy.data.collections.remove(bpy.data.collections[n])
if "03_VISOR_EXPRESSIONS" in bpy.data.collections:
    bpy.data.collections["03_VISOR_EXPRESSIONS"].name = "03_VISOR"

mats = ensure_materials()
mc = bpy.data.collections["10_MATERIALS"]
# registro de materiales: un objeto vacío por material no hace falta; se documenta en el informe
used = sorted({s.material.name for o in bpy.data.objects if o.type in ('MESH', 'CURVE')
               for s in o.material_slots if s.material})
print("MATERIALS OK", len(mats), "en uso:", len(used))
