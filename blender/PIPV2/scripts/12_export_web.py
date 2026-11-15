"""12 — export para la web (public/models/pip-v2.glb).
Ejecutar en consola:  blender -b PIP_CosmicMail_Final.blend --python scripts/12_export_web.py
No guarda el .blend: quita los drivers de visibilidad solo en memoria y deja TODAS las expresiones
visibles (la web elige cuál mostrar). Excluye el disco de sombra del estudio."""
import bpy

OUT = "/home/dinobudino/Documentos/TEST/cosmic-mail/public/models/pip-v2.glb"
root = bpy.data.objects["PIP_ROOT"]


def walk(o):
    yield o
    for c in o.children:
        yield from walk(c)


objs = list(walk(root))
for o in objs:
    ad = o.animation_data
    if ad:
        for fc in list(ad.drivers):
            if fc.data_path in ("hide_render", "hide_viewport"):
                ad.drivers.remove(fc)
    o.hide_render = False
    o.hide_viewport = False
    o.hide_set(False)
# los controladores vuelven a reposo (sin pose de prueba)
bpy.context.scene.frame_set(1)
for o in bpy.context.view_layer.objects:
    o.select_set(o in objs)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
                          export_animations=False, export_yup=True, export_extras=False)
print("PIP_WEB_EXPORT", OUT, len(objs))
