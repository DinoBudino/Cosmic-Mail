"""02 — visor convexo superelíptico, alojamiento, marco e inner border."""
from pip_utils import *

M = "visor"
clear_module(M)
vc = col("02_VISOR")
NSEG, NR = 128, 22


def strip(name, rows, material, bevel=None, smooth=True):
    """rows: [(k, h)] radio normalizado y altura normal; sigue el contorno del visor."""
    def fn(i, j):
        k, h = rows[i]
        x, z = visor_xz(k, TAU * j / NSEG)
        return front_pt(x, z, h)
    o = grid_mesh(name, fn, len(rows) - 1, NSEG, vc, material, M, closed_j=True, smooth=smooth)
    if bevel:
        add_bevel(o, bevel, 2, 50)
    return o


# Cristal: abanico polar + pared lateral que se hunde en el alojamiento
EL = C["visor_edge_lift"]


def glass_fn(i, j):
    if i <= NR:
        r = i / NR
        return visor_pt(r, TAU * j / NSEG)
    x, z = visor_xz(1.0, TAU * j / NSEG)
    return front_pt(x, z, EL - 0.045)


glass = grid_mesh("VISOR_GLASS", glass_fn, NR + 1, NSEG, vc, mat("MAT_VISOR_OPTICAL_BLACK"), M, closed_j=True)

# Alojamiento oscuro (recess): anillo interior que cierra la unión visor/carcasa
strip("VISOR_RECESS", [(1.0, EL - 0.045), (1.015, EL - 0.02), (1.03, EL + 0.006)], mat("MAT_NIGHT_BLUE"))

# Borde técnico interior fino (gris metálico)
strip("VISOR_INNER_BORDER", [(1.0, EL + 0.002), (1.006, EL + 0.012), (1.016, EL + 0.016), (1.026, EL + 0.010)],
      mat("MAT_BRONZE"), bevel=0.003)

# Marco estructural crema (perfil redondeado)
frame_rows = [(1.024, EL + 0.008), (1.04, EL + 0.018), (1.065, EL + 0.022), (1.095, EL + 0.017),
              (1.12, EL + 0.006), (1.14, EL - 0.008), (1.155, EL - 0.025)]
fr = strip("VISOR_FRAME", frame_rows, mat("MAT_CREAM_SATIN"), bevel=0.004)

# ── reflejo curvo (ficha: brillo en media luna arriba-izquierda, siguiendo el borde del visor) ──
def reflection_material():
    m = bpy.data.materials.get("MAT_VISOR_REFLECTION") or bpy.data.materials.new("MAT_VISOR_REFLECTION")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "UV"
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    # opacidad = perfil transversal suave (centro de la banda) × afinado en las puntas
    def math_node(op, a=None, b=None):
        n = nt.nodes.new("ShaderNodeMath"); n.operation = op
        if a is not None: n.inputs[0].default_value = a
        if b is not None: n.inputs[1].default_value = b
        return n
    sy = math_node('SINE'); my = math_node('MULTIPLY', None, math.pi)
    sx = math_node('SINE'); mx = math_node('MULTIPLY', None, math.pi)
    py = math_node('POWER', None, 0.8); px = math_node('POWER', None, 0.6)
    mul = math_node('MULTIPLY'); k = math_node("MULTIPLY", None, 0.92)
    em = nt.nodes.new("ShaderNodeEmission"); em.name = "EMIT"
    em.inputs[0].default_value = hex_to_linear_rgba("#FFF6F2"); em.inputs[1].default_value = 1.6
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(uvn.outputs[0], sep.inputs[0])
    L(sep.outputs[1], my.inputs[0]); L(my.outputs[0], sy.inputs[0]); L(sy.outputs[0], py.inputs[0])
    L(sep.outputs[0], mx.inputs[0]); L(mx.outputs[0], sx.inputs[0]); L(sx.outputs[0], px.inputs[0])
    L(py.outputs[0], mul.inputs[0]); L(px.outputs[0], mul.inputs[1]); L(mul.outputs[0], k.inputs[0])
    L(k.outputs[0], mix.inputs[0]); L(tr.outputs[0], mix.inputs[1]); L(em.outputs[0], mix.inputs[2])
    L(mix.outputs[0], out.inputs[0])
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass
    return m


def crescent(name, t0, t1, r_in, r_out, taper=0.55, nu=40, nv=6):
    """Banda curva sobre el cristal: u recorre el arco, v el ancho (se estrecha hacia las puntas)."""
    rc, hw = (r_in + r_out) / 2, (r_out - r_in) / 2

    def fn(i, j):
        u, v = j / nu, i / nv
        w = hw * (taper + (1 - taper) * math.sin(math.pi * u))
        return visor_pt(rc + w * (2 * v - 1), t0 + (t1 - t0) * u, 0.006)
    o = grid_mesh(name, fn, nv, nu, vc, reflection_material(), M, merge=0)
    uv = o.data.uv_layers.new(name="UV")
    for pl in o.data.polygons:
        for li in pl.loop_indices:
            vi = o.data.loops[li].vertex_index      # grid_mesh: índice = i*(nu+1)+j
            uv.data[li].uv = ((vi % (nu + 1)) / nu, (vi // (nu + 1)) / nv)
    o.visible_shadow = False
    return o


crescent("VISOR_REFLECTION", math.radians(104), math.radians(170), 0.72, 0.87, taper=0.35)
crescent("VISOR_REFLECTION_SMALL", math.radians(176), math.radians(192), 0.81, 0.87, taper=0.35, nu=16)
print("VISOR OK", [o.name for o in vc.objects])
