"""10 — estudio (mundo, luces, cámaras, render) y animaciones de prueba."""
from pip_utils import *

M = "studio"
clear_module(M)
scene = bpy.context.scene
stc = col("11_STUDIO")
cams_c, lights_c = col("STUDIO_CAMERAS"), col("STUDIO_LIGHTS")

# ── fondo (mundo): crema rosado muy pálido ──
w = bpy.data.worlds.get("PIP_Studio_World") or bpy.data.worlds.new("PIP_Studio_World")
w.use_nodes = True
nt_w = w.node_tree
nt_w.nodes.clear()
bg_cam = nt_w.nodes.new("ShaderNodeBackground")      # lo que ve la cámara: crema rosado
bg_cam.inputs[0].default_value = hex_to_linear_rgba("#F8E8E3")
bg_cam.inputs[1].default_value = 1.32
bg_env = nt_w.nodes.new("ShaderNodeBackground")      # luz ambiente / reflejos: tenue y neutra
bg_env.inputs[0].default_value = hex_to_linear_rgba("#E9DCE0")
bg_env.inputs[1].default_value = 0.28
lp = nt_w.nodes.new("ShaderNodeLightPath")
mx = nt_w.nodes.new("ShaderNodeMixShader")
wo = nt_w.nodes.new("ShaderNodeOutputWorld")
nt_w.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
nt_w.links.new(bg_env.outputs[0], mx.inputs[1])
nt_w.links.new(bg_cam.outputs[0], mx.inputs[2])
nt_w.links.new(mx.outputs[0], wo.inputs[0])
scene.world = w

# ── luces de estudio (Area) ──
def area(name, loc, target, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.get(name) or bpy.data.lights.new(name, 'AREA')
    ld.energy, ld.size, ld.color = energy, size, color
    ld.shape = 'DISK'      # reflejos redondeados en el visor, como en la ficha
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, ld)
        lights_c.objects.link(o)
    o.location = loc
    point_camera_at(o, target)
    o["pip_module"] = M
    return o


T = Vector((0, 0, 0.1))
k_ = area("LIGHT_KEY", (-4.5, -5.0, 4.5), T, 650, 4.5, (1.0, 0.90, 0.80))
k_.data.specular_factor = 0.0
f_ = area("LIGHT_FILL", (5.5, -3.5, 1.0), T, 220, 4.0, (0.95, 0.95, 1.0))
f_.data.specular_factor = 0.0
area("LIGHT_RIM", (1.5, 5.5, 3.5), T, 380, 3.0, (1.0, 0.9, 0.85))
# tarjeta de reflejo: solo especular, dibuja el brillo curvo arriba-izquierda del visor (ficha)
h_ = area("LIGHT_VISOR_HIGHLIGHT", (-2.4, -3.4, 3.4), (0.0, -0.8, 0.35), 12, 2.4, (1.0, 1.0, 1.0))
h_.data.shape = 'ELLIPSE'
h_.data.size, h_.data.size_y = 3.2, 1.1
h_.data.diffuse_factor = 0.0
h_.data.specular_factor = 1.0

# ── sombra suave bajo el personaje (fondo, no es parte del modelo) ──
shm = bpy.data.materials.get("MAT_STUDIO_SHADOW") or bpy.data.materials.new("MAT_STUDIO_SHADOW")
shm.use_nodes = True
sn = shm.node_tree
sn.nodes.clear()
t_ = sn.nodes.new("ShaderNodeTexCoord"); g_ = sn.nodes.new("ShaderNodeTexGradient"); g_.gradient_type = 'SPHERICAL'
m_ = sn.nodes.new("ShaderNodeMapRange"); m_.inputs[1].default_value = 0.5; m_.inputs[2].default_value = 1.0
m_.inputs[3].default_value = 0.0; m_.inputs[4].default_value = 0.55; m_.clamp = True
e_ = sn.nodes.new("ShaderNodeEmission"); e_.inputs[0].default_value = hex_to_linear_rgba("#9C7F86"); e_.inputs[1].default_value = 1.0
tr_ = sn.nodes.new("ShaderNodeBsdfTransparent"); x_ = sn.nodes.new("ShaderNodeMixShader"); o_ = sn.nodes.new("ShaderNodeOutputMaterial")
sn.links.new(t_.outputs["UV"], g_.inputs[0]); sn.links.new(g_.outputs["Fac"], m_.inputs[0])
sn.links.new(m_.outputs[0], x_.inputs[0]); sn.links.new(tr_.outputs[0], x_.inputs[1]); sn.links.new(e_.outputs[0], x_.inputs[2])
sn.links.new(x_.outputs[0], o_.inputs[0])
try:
    shm.surface_render_method = 'BLENDED'
except Exception:
    pass
SR = 1.5
sv = [(0, 0, 0)] + [(SR * math.cos(TAU * k / 48), SR * 0.42 * math.sin(TAU * k / 48), 0) for k in range(48)]
sf = [[0, 1 + k, 1 + (k + 1) % 48] for k in range(48)]
sh = create_mesh("STUDIO_SHADOW_DISC", sv, sf, col("STUDIO_BACKGROUND"), shm, M, merge=0, recalc=False, smooth=False)
sh.location = (0, 0, -1.72)
shuv = sh.data.uv_layers.new(name="UV")
for pl in sh.data.polygons:
    for li in pl.loop_indices:
        vx = sh.data.vertices[sh.data.loops[li].vertex_index].co
        shuv.data[li].uv = (vx.x / (2 * SR), vx.y / (2 * SR * 0.42))
sh.visible_shadow = False
sh.hide_select = True

# ── cámaras de validación ──
CAMS = {
    "CAM_FRONT": ((0, -8.2, 0.12), False),
    "CAM_FRONT_3Q": ((5.6, -5.9, 0.9), False),   # ficha: 3/4 desde el lado derecho (+X)
    "CAM_LEFT": ((-8.2, 0, 0.12), False),
    "CAM_RIGHT": ((8.2, 0, 0.12), False),
    "CAM_REAR": ((0, 8.2, 0.12), False),
    "CAM_REAR_3Q": ((4.9, 6.4, 1.6), False),
    "CAM_TOP_3Q": ((3.8, -4.8, 6.2), False),
    "CAM_HERO": ((3.0, -7.6, 1.1), False),      # ficha: vista principal casi frontal desde la derecha
}
for nm, (loc, ortho) in CAMS.items():
    o = create_camera(nm, loc, (0, 0, 0.12), cams_c, lens=85.0)
    o["pip_module"] = M
scene.camera = bpy.data.objects["CAM_HERO"]

# ── render ──
r = scene.render
r.resolution_x = r.resolution_y = 1024
r.resolution_percentage = 100
r.film_transparent = False
r.fps = 24
scene.frame_start, scene.frame_end = 1, 120
scene.frame_set(1)
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError as e:
    print("engine:", e)
try:
    scene.eevee.taa_render_samples = C["render_samples"]
except Exception as e:
    print("eevee samples:", e)
vt = [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties["view_transform"].enum_items]
print("view transforms:", vt)
for cand in ("Khronos PBR Neutral", "Standard"):
    try:
        scene.view_settings.view_transform = cand
        break
    except TypeError:
        continue
print("view transform:", scene.view_settings.view_transform)
scene.view_settings.exposure = -0.35
try:
    scene.view_settings.look = "None"
except Exception:
    pass

def fcurves_of(action):
    """Blender 5.x: acciones por capas/slots."""
    return [fc for ly in action.layers for st in ly.strips for cb in st.channelbags for fc in cb.fcurves]


# ── glow (bloom) vía compositor: ojos, boca, anillos y propulsor ──
try:
    ng = bpy.data.node_groups.get("PIP_Compositor")
    if ng:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new("PIP_Compositor", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new("CompositorNodeRLayers")
    gl = ng.nodes.new("CompositorNodeGlare")
    go = ng.nodes.new("NodeGroupOutput")
    for k, v in (("Type", "Bloom"), ("Quality", "High")):
        try:
            gl.inputs[k].default_value = v
        except Exception as e:
            print("glare", k, e)
    gl.inputs["Threshold"].default_value = 2.2
    gl.inputs["Strength"].default_value = 0.35
    gl.inputs["Size"].default_value = 0.3
    ng.links.new(rl.outputs["Image"], gl.inputs["Image"])
    ng.links.new(gl.outputs["Image"], go.inputs[0])
    scene.compositing_node_group = ng
    print("compositor glare OK")
except Exception as e:
    print("compositor error:", type(e).__name__, e)


# ── animación: expresiones (constantes) ──
face = bpy.data.objects["CTRL_FACE"]
if face.animation_data and face.animation_data.action:
    bpy.data.actions.remove(face.animation_data.action)
seq = [(1, 10), (13, 1), (25, 2), (37, 3), (49, 4), (61, 5), (73, 6), (85, 7), (97, 8), (109, 9)]
for fr, ex in seq:
    face["face_expression"] = ex
    face.keyframe_insert('["face_expression"]', frame=fr)
for fc_ in fcurves_of(face.animation_data.action):
    for kp in fc_.keyframe_points:
        kp.interpolation = 'CONSTANT'
face["face_expression"] = 10
if face.animation_data.action:
    face.animation_data.action.name = "PIP_ExpressionCycle"

# ── prueba de giro 360° (acción aparte, con fake user) ──
rot = bpy.data.objects["CTRL_BODY_ROTATION"]
old = bpy.data.actions.get("PIP_Turntable_360")
if old:
    bpy.data.actions.remove(old)
rot.rotation_euler = (0, 0, 0)
rot.keyframe_insert("rotation_euler", index=2, frame=1)
rot.rotation_euler = (0, 0, TAU)
rot.keyframe_insert("rotation_euler", index=2, frame=120)
act = rot.animation_data.action
act.name = "PIP_Turntable_360"
act.use_fake_user = True
for fcu in fcurves_of(act):
    for kp in fcu.keyframe_points:
        kp.interpolation = 'LINEAR'
rot.animation_data.action = None        # el giro se activa asignando la acción
rot.rotation_euler = (0, 0, 0)
scene.frame_set(1)
print("STUDIO OK cams:", len(CAMS), "lights:", len(lights_c.objects))
