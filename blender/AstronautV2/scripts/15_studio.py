"""15 — estudio: fondo crema rosado, luces de área (key/fill/rim + tarjetas de reflejo cálido del visor),
11 cámaras de focal larga y ajustes de render."""
import math
import bpy
from mathutils import Vector
from config import *
from geometry_utils import *
from material_utils import hex_to_linear_rgba

MOD = "studio"
clear_module(MOD)
cams_c, lights_c, bg_c = col("CAMERAS"), col("LIGHTS"), col("STUDIO_BACKGROUND")
sc = bpy.context.scene

# ── mundo: lo que ve la cámara (fondo de la ficha) ≠ lo que ilumina ──
w = bpy.data.worlds.get("WORLD_STUDIO") or bpy.data.worlds.new("WORLD_STUDIO")
sc.world = w
w.use_nodes = True
nt = w.node_tree
nt.nodes.clear()
lp = nt.nodes.new("ShaderNodeLightPath")
bg_cam = nt.nodes.new("ShaderNodeBackground")
bg_cam.inputs[0].default_value = hex_to_linear_rgba("#F8E6E1")
bg_cam.inputs[1].default_value = 1.30
bg_env = nt.nodes.new("ShaderNodeBackground")
bg_env.inputs[0].default_value = hex_to_linear_rgba("#E8DCDD")
bg_env.inputs[1].default_value = 0.35
mix = nt.nodes.new("ShaderNodeMixShader")
out = nt.nodes.new("ShaderNodeOutputWorld")
nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
nt.links.new(bg_env.outputs[0], mix.inputs[1])
nt.links.new(bg_cam.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs[0])

# ── suelo atrapa-sombras discreto ──
sm = bpy.data.materials.get("MAT_STUDIO_SHADOW") or bpy.data.materials.new("MAT_STUDIO_SHADOW")
sm.use_nodes = True
snt = sm.node_tree
snt.nodes.clear()
tc = snt.nodes.new("ShaderNodeTexCoord")
gr = snt.nodes.new("ShaderNodeTexGradient"); gr.gradient_type = 'SPHERICAL'
mp = snt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.55, 0.75, 1)
dif = snt.nodes.new("ShaderNodeBsdfDiffuse")
dif.inputs[0].default_value = hex_to_linear_rgba("#F3DDD8")
tr = snt.nodes.new("ShaderNodeBsdfTransparent")
mx = snt.nodes.new("ShaderNodeMixShader")
ramp = snt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.0, 0.6
ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
so = snt.nodes.new("ShaderNodeOutputMaterial")
L = snt.links.new
L(tc.outputs["Object"], mp.inputs[0]); L(mp.outputs[0], gr.inputs[0]); L(gr.outputs[0], ramp.inputs[0])
L(ramp.outputs[0], mx.inputs[0]); L(tr.outputs[0], mx.inputs[1]); L(dif.outputs[0], mx.inputs[2]); L(mx.outputs[0], so.inputs[0])
try:
    sm.surface_render_method = 'BLENDED'
except Exception:
    pass
fl_v = [(0, 0, 0)] + [(2.2 * math.cos(TAU * k / 64), 2.2 * math.sin(TAU * k / 64), 0) for k in range(64)]
fl_f = [[0, 1 + k, 1 + (k + 1) % 64] for k in range(64)]
floor = create_mesh("STUDIO_SHADOW_FLOOR", fl_v, fl_f, bg_c, sm, MOD, merge=0, recalc=False)
floor.location = (0, 0, -0.002)


# ── luces ──
def area(name, loc, target, power, size, color=(1, 1, 1), shape='DISK', size_y=None, spec=1.0, diff=1.0):
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, 'AREA')
    ld.energy, ld.color = power, color
    ld.shape = shape
    ld.size = size
    if size_y:
        ld.size_y = size_y
    ld.specular_factor, ld.diffuse_factor = spec, diff
    o = bpy.data.objects.new(name, ld)
    lights_c.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    tag(o, MOD)
    return o


area("LIGHT_KEY", (-5.0, -6.0, 6.0), (0, 0, 1.5), 1500, 4.5, (1.0, 0.95, 0.90), spec=0.35)
area("LIGHT_FILL", (6.0, -4.5, 2.5), (0, 0, 1.4), 500, 5.0, (0.95, 0.95, 1.0), spec=0.2)
area("LIGHT_RIM", (2.5, 6.5, 5.0), (0, 0, 1.8), 1100, 3.0, (1.0, 0.93, 0.88))
area("LIGHT_RIM_L", (-4.5, 5.0, 3.0), (0, 0, 1.6), 500, 3.0, (1.0, 0.95, 0.92))
# tarjetas de reflejo cálido para el visor (solo especular). Ficha: UN brillo cuadrado arriba-derecha,
# un destello pequeño junto al borde izquierdo y un resplandor ámbar difuso en la parte baja.
# (Se evita a propósito cualquier disposición que lea como "ojos y boca": el visor no expresa emociones.)
area("LIGHT_VISOR_CARD_A", (2.4, -4.6, 4.9), (0, 0, 2.47), 900, 1.1, (1.0, 0.70, 0.34), 'RECTANGLE', 1.1,
     spec=1.0, diff=0.0)
area("LIGHT_VISOR_CARD_B", (-7.0, -0.6, 2.4), (0, 0, 2.47), 300, 0.35, (1.0, 0.68, 0.36), 'RECTANGLE', 1.6,
     spec=1.0, diff=0.0)
area("LIGHT_VISOR_CARD_C", (0.0, -2.0, -3.5), (0, 0, 2.20), 420, 22.0, (1.0, 0.62, 0.25), 'RECTANGLE', 12.0,
     spec=1.0, diff=0.0)
# light linking: las luces grandes de relleno no se reflejan en el cristal del visor (sus discos parecían ojos)
ll = bpy.data.collections.get("LL_NO_VISOR") or bpy.data.collections.new("LL_NO_VISOR")
vg = bpy.data.objects.get("VISOR_GLASS")
if vg is not None:
    if vg.name not in ll.objects:
        ll.objects.link(vg)
    for i, ob in enumerate(ll.objects):
        ll.collection_objects[i].light_linking.link_state = 'EXCLUDE'
    for ln in ("LIGHT_KEY", "LIGHT_FILL", "LIGHT_RIM_L"):
        bpy.data.objects[ln].light_linking.receiver_collection = ll

# ── cámaras ──
CAMS = {   # nombre: (posición, objetivo, focal)
    "CAM_FRONT": ((0, -11.0, 1.55), (0, 0, 1.50), 100),
    "CAM_THREE_QUARTER": ((-7.4, -8.2, 2.3), (0, 0, 1.50), 100),     # ficha: lado derecho del personaje
    "CAM_LEFT": ((11.0, 0, 1.55), (0, 0, 1.50), 100),                # ficha "Lateral": mira a la izquierda
    "CAM_RIGHT": ((-11.0, 0, 1.55), (0, 0, 1.50), 100),
    "CAM_REAR": ((0, 11.0, 1.55), (0, 0, 1.50), 100),
    "CAM_REAR_THREE_QUARTER": ((7.4, 8.2, 2.3), (0, 0, 1.50), 100),
    "CAM_HELMET_CLOSEUP": ((-1.9, -4.6, 2.75), (0, 0, 2.45), 100),
    "CAM_BACKPACK_CLOSEUP": ((2.6, 4.9, 2.2), (0, 0.5, 1.62), 100),
    "CAM_GLOVES_CLOSEUP": ((-1.75, -3.1, 1.15), (-0.74, -0.06, 0.93), 100),
    "CAM_BOOTS_CLOSEUP": ((-1.8, -4.0, 0.9), (0, -0.05, 0.25), 100),
    "CAM_HERO": ((-4.6, -6.3, 2.0), (0, 0, 1.52), 85),
}
for name, (loc, tgt, lens) in CAMS.items():
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_end = 100
    o = bpy.data.objects.new(name, cd)
    cams_c.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    tag(o, MOD)
sc.camera = bpy.data.objects["CAM_HERO"]

# ── render ──
sc.render.resolution_x = sc.render.resolution_y = 1024
sc.render.film_transparent = False
try:
    sc.render.engine = 'BLENDER_EEVEE'
except TypeError:
    pass
ee = sc.eevee
for attr, val in (("taa_render_samples", C["render_samples"]), ("use_shadows", True),
                  ("use_raytracing", True), ("shadow_ray_count", 2)):
    if hasattr(ee, attr):
        setattr(ee, attr, val)
try:
    sc.view_settings.view_transform = 'Khronos PBR Neutral'
except TypeError:
    sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'None'
sc.view_settings.exposure = -0.25
print("STUDIO OK cams:", len(CAMS), "view:", sc.view_settings.view_transform)

# ── compositor: bloom suave para los indicadores (umbral alto: no ensucia el visor) ──
try:
    ng = sc.compositing_node_group
    if ng is None:
        ng = bpy.data.node_groups.new("ASTRO_COMPOSITOR", "CompositorNodeTree")
        sc.compositing_node_group = ng
    ng.nodes.clear()
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    outn = ng.nodes.new("NodeGroupOutput")
    if not ng.interface.items_tree:
        ng.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
    for k, v in (("Type", "Bloom"), ("Quality", "High"), ("Threshold", 1.6), ("Strength", 0.45), ("Size", 0.35)):
        s = gl.inputs.get(k)
        if s is not None:
            s.default_value = v
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], outn.inputs[0])
    print("compositor glare OK")
except Exception as exc:
    print("[ASTRONAUT WARN] compositor:", type(exc).__name__, exc)
