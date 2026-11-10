"""
Independent GLB verification for PIP_RetroSpacePost.glb.

Re-imports the exported GLB into a clean Blender scene, checks names,
materials and embedded images, renders a preview, and merges the result
into PIP_validation.json.

Usage:
    blender --background --factory-startup --python blender/PIP/PIP_verify_glb.py
"""

import json
import math
import os

import bpy
from mathutils import Vector

BASE = os.path.dirname(os.path.abspath(__file__))
GLB_PATH = os.path.join(BASE, "PIP_RetroSpacePost.glb")
REPORT_PATH = os.path.join(BASE, "PIP_validation.json")
PREVIEW_PATH = os.path.join(BASE, "previews", "PIP_preview_glb_reimport.png")

REQUIRED_NODES = [
    "PIP_ROOT", "PIP_BOB_PIVOT", "PIP_BODY_PIVOT", "BODY", "Body_Shell",
    "Body_Stripe_Orange", "Body_Stripe_Accent", "FACE", "Face_Screen",
    "Face_Gold_Rim", "Face_Expressions", "Eye_L", "Eye_R", "Mouth",
    "SIDE_MODULES", "Module_L", "Module_R", "ANTENNA_PIVOT",
    "Antenna_Base", "Antenna_Stem", "Antenna_Orb", "POSTAL_DETAILS",
    "Forehead_Envelope_Badge", "Scarf_Envelope_Clasp", "Postal_Stamp",
    "SCARF", "Scarf_Band", "Scarf_Knot", "Scarf_Tail_Pivot",
    "Scarf_Tail_A", "Scarf_Tail_B", "Scarf_Accent_Stripes",
    "HOVER_THRUSTER", "Thruster_Housing", "Thruster_Emitter",
]
FACIAL_MATERIALS = ["PIP_Eye_L", "PIP_Eye_R", "PIP_Mouth"]


def setup_preview(scene):
    world = bpy.data.worlds.new("VerifyWorld")
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs[0].default_value = (0.020, 0.014, 0.035, 1.0)
    background.inputs[1].default_value = 0.45
    scene.world = world

    floor_mat = bpy.data.materials.new("VerifyFloor")
    floor_mat.use_nodes = True
    bsdf = next(n for n in floor_mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (0.008, 0.005, 0.016, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.85

    bpy.ops.mesh.primitive_plane_add(size=12.0, location=(0, 0, -0.625))
    floor = bpy.context.object
    floor.name = "VerifyFloor"
    floor.data.materials.append(floor_mat)

    def area(name, location, rotation, energy, size, color):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        obj.rotation_euler = rotation
        bpy.context.scene.collection.objects.link(obj)

    area("VerifyKey", (1.9, -2.4, 2.7), (math.radians(48), 0, math.radians(38)),
         230, 1.8, (1.0, 0.87, 0.72))
    area("VerifyFill", (-2.3, -1.5, 1.0), (math.radians(76), 0, math.radians(-54)),
         90, 1.7, (0.62, 0.72, 1.0))
    area("VerifyRim", (0.4, 2.5, 1.9), (math.radians(118), 0, math.radians(10)),
         160, 1.5, (1.0, 0.78, 0.58))

    target = Vector((0.0, 0.0, 0.02))
    position = Vector((1.95, -2.45, 0.72))
    camera_data = bpy.data.cameras.new("VerifyCamera")
    camera_data.lens = 78
    camera = bpy.data.objects.new("VerifyCamera", camera_data)
    camera.location = position
    camera.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(camera)
    scene.camera = camera

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 800
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = PREVIEW_PATH
    try:
        scene.eevee.taa_render_samples = 40
    except Exception:
        pass


def main():
    if not os.path.exists(GLB_PATH):
        raise SystemExit(f"Missing GLB: {GLB_PATH}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=GLB_PATH)
    scene = bpy.context.scene

    objects = list(bpy.data.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    names = {obj.name for obj in objects}
    missing = sorted(set(REQUIRED_NODES) - names)

    materials = list(bpy.data.materials)
    material_names = {material.name for material in materials}
    facial_present = {
        name: name in material_names for name in FACIAL_MATERIALS
    }
    images = list(bpy.data.images)
    embedded_images = [
        image for image in images
        if image.name not in ("Render Result", "Viewer Node")
    ]

    texture_transform_nodes = 0
    for material in materials:
        if not material.use_nodes:
            continue
        texture_transform_nodes += sum(
            1 for node in material.node_tree.nodes if node.type == "MAPPING"
        )

    setup_preview(scene)
    bpy.context.view_layer.update()
    bpy.ops.render.render(write_still=True)

    report = {
        "glb_reimport_validated": len(missing) == 0 and all(facial_present.values()),
        "imported_objects": len(objects),
        "imported_meshes": len(meshes),
        "imported_materials": len(materials),
        "imported_images": len(embedded_images),
        "required_nodes_present": len(missing) == 0,
        "missing_nodes": missing,
        "facial_materials_present": facial_present,
        "mapping_nodes_in_materials": texture_transform_nodes,
        "render": os.path.join("previews", os.path.basename(PREVIEW_PATH)),
        "notes": [
            "Independent re-import of the exported GLB in a fresh Blender scene.",
            "The re-import render is a visual check of the exported materials and hierarchy.",
        ],
    }

    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, "r", encoding="utf-8") as handle:
            validation = json.load(handle)
    else:
        validation = {}
    validation["glb_reimport"] = report
    validation["glb_reimport_validated"] = report["glb_reimport_validated"]
    previews = validation.setdefault("preview_renders", [])
    if "PIP_preview_glb_reimport.png" not in previews:
        previews.append("PIP_preview_glb_reimport.png")
    notes = validation.setdefault("notes", [])
    note = "Independent re-import render of the exported GLB is included in previews."
    if note not in notes:
        notes.append(note)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(validation, handle, indent=2)
        handle.write("\n")

    print(json.dumps(report, indent=2))
    print("Wrote", REPORT_PATH)


if __name__ == "__main__":
    main()
