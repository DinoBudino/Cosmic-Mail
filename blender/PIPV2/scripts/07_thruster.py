"""07 — propulsor de levitación: placa gris + bulbo amarillo semiesférico brillante (como la ficha)."""
from pip_utils import *

M = "thruster"
clear_module(M)
tc = col("07_THRUSTER")
Z0 = -RZ                  # polo inferior del casco


def circ(cr, ch, rad, n=12):
    return [(cr + rad * math.cos(TAU * k / n), ch + rad * math.sin(TAU * k / n)) for k in range(n)]


def rev(name, prof, material, closed=False, seg=72, bev=None):
    o = create_revolved_mesh(name, prof, tc, material, M, segments=seg, closed=closed)
    if bev:
        add_bevel(o, bev, 2, 40)
    return o


plate_gray = bpy.data.materials.get("MAT_PLATE_GRAY") or create_material("MAT_PLATE_GRAY", "#7C8491", 0.6, 0.35)
bronze = bpy.data.materials.get("MAT_BRONZE") or create_material("MAT_BRONZE", "#C48A2C", 0.85, 0.28)

# Cuello oscuro corto bajo la franja inferior (la ficha no muestra plato ancho)
rev("THRUSTER_NECK", [(0, Z0 + 0.08), (0.27, Z0 + 0.08), (0.30, Z0 + 0.0), (0.0, Z0 + 0.0)], mat("MAT_BOTTOM_DARK"))
rev("THRUSTER_HOUSING", [(0, Z0 + 0.01), (0.31, Z0 + 0.01), (0.325, Z0 - 0.02), (0.31, Z0 - 0.055), (0.0, Z0 - 0.055)],
    mat("MAT_PLATE_GRAY"), bev=C["bevel_small"])
rev("THRUSTER_NOZZLE", circ(0.285, Z0 - 0.058, 0.014), mat("MAT_NIGHT_BLUE"), closed=True, seg=96)

# degradado del bulbo: amarillo en el centro, naranja hacia el borde (Layer Weight → rampa → color)
_nt = mat("MAT_THRUSTER_EMISSION").node_tree
for _n in [n for n in _nt.nodes if n.name in ("LW", "RAMP")]:
    _nt.nodes.remove(_n)
_em = _nt.nodes["EMIT"]
_lw = _nt.nodes.new("ShaderNodeLayerWeight"); _lw.name = "LW"; _lw.inputs[0].default_value = 0.35
_rp = _nt.nodes.new("ShaderNodeValToRGB"); _rp.name = "RAMP"
_rp.color_ramp.elements[0].position, _rp.color_ramp.elements[1].position = 0.15, 0.75
_rp.color_ramp.elements[0].color = hex_to_linear_rgba("#FFDC2E")
_rp.color_ramp.elements[1].color = hex_to_linear_rgba("#FF9A0A")
_nt.links.new(_lw.outputs["Facing"], _rp.inputs[0])
_nt.links.new(_rp.outputs["Color"], _em.inputs[0])

# Bulbo emisivo: media esfera hacia abajo, ligeramente aplanada
BR, BD, BZ = 0.27, 0.25, Z0 - 0.05
bulb = [(BR * math.cos(a), BZ - BD * math.sin(a)) for a in [k * (math.pi / 2) / 14 for k in range(0, 15)]]
bulb = [(0.0, BZ)] + bulb
rev("THRUSTER_EMISSION_CORE", bulb, mat("MAT_THRUSTER_EMISSION"), seg=72)
rev("THRUSTER_INNER_RINGS", circ(0.27, BZ - 0.004, 0.011), mat("MAT_ORANGE_MISSION"), closed=True, seg=96)

# Halo suave hacia abajo
hm = bpy.data.materials.get("MAT_THRUSTER_HALO") or bpy.data.materials.new("MAT_THRUSTER_HALO")
hm.use_nodes = True
hn = hm.node_tree
hn.nodes.clear()
tcn = hn.nodes.new("ShaderNodeTexCoord")
gr = hn.nodes.new("ShaderNodeTexGradient")
gr.gradient_type = 'SPHERICAL'
cr = hn.nodes.new("ShaderNodeMapRange")
cr.inputs[1].default_value, cr.inputs[2].default_value = 0.5, 1.0
cr.inputs[3].default_value, cr.inputs[4].default_value = 0.0, 1.0
cr.clamp = True
sq = hn.nodes.new("ShaderNodeMath")
sq.operation = 'POWER'
sq.inputs[1].default_value = 2.4
em = hn.nodes.new("ShaderNodeEmission")
em.name = "EMIT"
em.inputs[0].default_value = hex_to_linear_rgba("#FFC93C")
em.inputs[1].default_value = 5.0
tr = hn.nodes.new("ShaderNodeBsdfTransparent")
mx = hn.nodes.new("ShaderNodeMixShader")
ou = hn.nodes.new("ShaderNodeOutputMaterial")
L = hn.links.new
L(tcn.outputs["UV"], gr.inputs[0]); L(gr.outputs["Fac"], cr.inputs[0])
L(cr.outputs[0], sq.inputs[0]); L(sq.outputs[0], mx.inputs[0]); L(tr.outputs[0], mx.inputs[1])
L(em.outputs[0], mx.inputs[2]); L(mx.outputs[0], ou.inputs[0])
try:
    hm.surface_render_method = 'BLENDED'
except Exception:
    pass
HR = 0.70
halo_verts = [(0.0, 0.0, 0.0)] + [(HR * math.cos(TAU * k / 48), HR * math.sin(TAU * k / 48), 0.0) for k in range(48)]
halo_faces = [[0, 1 + k, 1 + (k + 1) % 48] for k in range(48)]
halo = create_mesh("THRUSTER_HALO", halo_verts, halo_faces, tc, hm, M, merge=0, recalc=False)
halo.location = (0, 0, BZ - 0.12)
uv = halo.data.uv_layers.new(name="UV")
for pl in halo.data.polygons:
    for li in pl.loop_indices:
        vx = halo.data.vertices[halo.data.loops[li].vertex_index].co
        uv.data[li].uv = (vx.x / (2 * HR), vx.y / (2 * HR))
halo.visible_shadow = False

# luz auxiliar discreta (sin sombras: evita acné)
ld = bpy.data.lights.get("LIGHT_THRUSTER_GLOW") or bpy.data.lights.new("LIGHT_THRUSTER_GLOW", 'POINT')
ld.color = (1.0, 0.78, 0.25)
ld.energy = 25.0
ld.shadow_soft_size = 0.2
ld.use_shadow = False
lo = bpy.data.objects.get("LIGHT_THRUSTER_GLOW")
if lo is None:
    lo = bpy.data.objects.new("LIGHT_THRUSTER_GLOW", ld)
    tc.objects.link(lo)
lo.location = (0, 0, Z0 - 0.30)
lo["pip_module"] = M
print("THRUSTER OK bottom z=", BZ - BD)
