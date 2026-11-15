"""16b — renders finales (1600 px) por lotes.
Uso: bpy.app.driver_namespace["ASTRO_RENDER_SET"] = "views" | "closeups" antes de ejecutar."""
import os
import bpy
from config import *
from geometry_utils import render_camera, refresh_drivers

sc = bpy.context.scene
sc.frame_set(1)
refresh_drivers()
RES = 1600
which = bpy.app.driver_namespace.get("ASTRO_RENDER_SET", "views")
VIEWS = {"CAM_FRONT": "Astronaut_Front", "CAM_THREE_QUARTER": "Astronaut_ThreeQuarter", "CAM_LEFT": "Astronaut_Left",
         "CAM_RIGHT": "Astronaut_Right", "CAM_REAR": "Astronaut_Rear", "CAM_REAR_THREE_QUARTER": "Astronaut_Rear_ThreeQuarter"}
CLOSE = {"CAM_HELMET_CLOSEUP": "Astronaut_Helmet_Closeup", "CAM_BACKPACK_CLOSEUP": "Astronaut_Backpack_Closeup",
         "CAM_GLOVES_CLOSEUP": "Astronaut_Gloves_Closeup", "CAM_BOOTS_CLOSEUP": "Astronaut_Boots_Closeup",
         "CAM_HERO": "Astronaut_Hero"}
done = []
if which in ("views", "closeups"):
    for cam, name in (VIEWS if which == "views" else CLOSE).items():
        done.append(render_camera(cam, os.path.join(RENDERS_DIR, name + ".png"), RES))
print("RENDERS OK", which, [os.path.basename(d) for d in done])
