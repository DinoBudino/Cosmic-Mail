"""00 — escena limpia, colecciones y materiales."""
from pip_utils import *

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

# Escena por defecto de Blender (sin guardar): se retiran Cube/Light/Camera de fábrica.
for n in ("Cube", "Light", "Camera"):
    o = bpy.data.objects.get(n)
    if o is not None and not o.get("pip_module"):
        bpy.data.objects.remove(o, do_unlink=True)

root = create_collection("PIP_PROJECT")
NAMES = ["00_CONTROLLERS", "01_MAIN_BODY", "02_VISOR", "03_FACE", "04_SIDE_MODULES",
         "05_ORANGE_PANELS", "06_ANTENNA", "07_THRUSTER", "08_MECHANICAL_DETAILS",
         "09_MATERIALS_HELPERS", "10_RIG_HELPERS", "11_STUDIO", "12_VALIDATION"]
for n in NAMES:
    create_collection(n, root)
studio = col("11_STUDIO")
for n in ("CAMERAS", "LIGHTS", "BACKGROUND"):
    create_collection("STUDIO_" + n, studio)

P = PALETTE
create_material("MAT_CREAM_SATIN", P["cream"], 0.05, 0.34, coat=0.25)
create_material("MAT_ORANGE_MISSION", P["orange"], 0.08, 0.28, coat=0.25)
create_material("MAT_TECH_GRAY", P["tech_gray"], 0.55, 0.32)
create_material("MAT_COSMIC_BLUE", P["cosmic_blue"], 0.35, 0.35)
create_material("MAT_NIGHT_BLUE", P["night_blue"], 0.20, 0.40)
create_material("MAT_VISOR_OPTICAL_BLACK", "#050609", 0.10, 0.08, coat=1.0, coat_rough=0.03)
create_material("MAT_MOUTH_INTERIOR", "#0a0507", 0.0, 0.5)

create_emission_material("MAT_FACE_EMISSION", "#FFD9C9", 5.0)        # ojos
create_emission_material("MAT_MOUTH_EMISSION", "#FFC9A6", 5.0)       # boca / HUD
create_emission_material("MAT_LED_ORANGE_EMISSION", "#FFA23A", 6.0)
create_emission_material("MAT_SIDE_RING_EMISSION", "#FF8A1F", 2.4)
create_emission_material("MAT_ANTENNA_EMISSION", "#FF6A63", 4.0)
create_emission_material("MAT_THRUSTER_EMISSION", "#FFC93C", 8.0)
create_emission_material("MAT_SENSOR_BLUE_EMISSION", "#3FA8FF", 3.0)
print("INIT OK collections:", len(root.children), "materials:", len(bpy.data.materials))
