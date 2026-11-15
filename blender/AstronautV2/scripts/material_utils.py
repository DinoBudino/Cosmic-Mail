"""Astronauta V2 — materiales PBR con la paleta obligatoria y microtexturas procedurales."""
import bpy
from config import PALETTE


def srgb_to_linear(value):
    if value <= 0.04045:
        return value / 12.92
    return ((value + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_color):
    v = hex_color.lstrip("#")
    rgb = [int(v[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(srgb_to_linear(c) for c in rgb) + (1.0,)


def _principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _set(node, name, val):
    s = node.inputs.get(name)
    if s is not None:
        s.default_value = val


def _reset(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    return m, nt, out


def create_material(name, hex_color, metallic=0.0, roughness=0.5, coat=0.0, coat_rough=0.1,
                    bump=0.0, bump_scale=60.0, rough_var=0.0):
    """Principled + (opcional) microrelieve y variación de rugosidad procedurales sutiles."""
    m, nt, out = _reset(name)
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.location = (100, 0)
    col = hex_to_linear_rgba(hex_color)
    _set(p, "Base Color", col)
    _set(p, "Metallic", metallic)
    _set(p, "Roughness", roughness)
    _set(p, "Coat Weight", coat)
    _set(p, "Coat Roughness", coat_rough)
    nt.links.new(p.outputs[0], out.inputs[0])
    if bump > 0 or rough_var > 0:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tex = nt.nodes.new("ShaderNodeTexNoise")
        _set(tex, "Detail", 6.0)
        _set(tex, "Roughness", 0.6)
        fac_out = tex.outputs["Fac"]
        _set(tex, "Scale", bump_scale)
        nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
        if bump > 0:
            b = nt.nodes.new("ShaderNodeBump")
            _set(b, "Strength", bump)
            _set(b, "Distance", 0.002)
            nt.links.new(fac_out, b.inputs["Height"])
            nt.links.new(b.outputs["Normal"], p.inputs["Normal"])
        if rough_var > 0:
            mr = nt.nodes.new("ShaderNodeMapRange")
            mr.inputs[3].default_value = roughness - rough_var
            mr.inputs[4].default_value = roughness + rough_var
            nt.links.new(fac_out, mr.inputs[0])
            nt.links.new(mr.outputs[0], p.inputs["Roughness"])
    m.diffuse_color = col
    return m


def create_emission_material(name, hex_color, strength=5.0):
    m, nt, out = _reset(name)
    em = nt.nodes.new("ShaderNodeEmission")
    em.name = "EMIT"
    em.inputs[0].default_value = hex_to_linear_rgba(hex_color)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    m.diffuse_color = hex_to_linear_rgba(hex_color)
    return m


def ensure_materials():
    P = PALETTE
    mats = {}
    # tejido técnico crema: mate, microrelieve multicapa muy sutil
    mats["fabric"] = create_material("MAT_SUIT_CREAM_FABRIC", P["cream"], 0.0, 0.74, bump=0.18,
                                     bump_scale=180.0, rough_var=0.05)
    # carcasa del casco/mochila: crema satinado rígido
    mats["shell"] = create_material("MAT_CREAM_SHELL", P["cream"], 0.0, 0.40, coat=0.25, coat_rough=0.25,
                                    bump=0.03, bump_scale=90.0)
    mats["orange"] = create_material("MAT_ORANGE_PANELS", P["orange"], 0.05, 0.43, bump=0.05, bump_scale=140.0)
    mats["cosmic"] = create_material("MAT_COSMIC_BLUE", P["cosmic_blue"], 0.15, 0.48, bump=0.08, bump_scale=200.0)
    mats["gray"] = create_material("MAT_TECH_GRAY", P["tech_gray"], 0.25, 0.46, rough_var=0.04, bump_scale=40.0)
    mats["rubber"] = create_material("MAT_NIGHT_RUBBER", P["night_blue"], 0.0, 0.72, bump=0.12, bump_scale=120.0)
    # visor negro óptico (ligero tinte ámbar como en la ficha)
    mats["visor"] = create_material("MAT_VISOR_OPTICAL_BLACK", "#100804", 0.12, 0.05, coat=1.0, coat_rough=0.02)
    _set(_principled(mats["visor"]), "Specular IOR Level", 0.65)
    # disco de la unidad pectoral: la ficha lo pinta azul real (más vivo que #26354A).
    # Interpretación registrada en el informe; se limita a este componente.
    mats["chest_blue"] = create_material("MAT_CHEST_BLUE", "#1F4FA8", 0.1, 0.30, coat=0.4)
    mats["light"] = create_emission_material("MAT_STATUS_LIGHT_ORANGE", "#FF8A2A", 4.0)
    mats["warm_rim"] = create_material("MAT_VISOR_WARM_RIM", "#C77B2A", 0.7, 0.3)
    return mats


def M(key):
    names = {
        "fabric": "MAT_SUIT_CREAM_FABRIC", "shell": "MAT_CREAM_SHELL", "orange": "MAT_ORANGE_PANELS",
        "cosmic": "MAT_COSMIC_BLUE", "gray": "MAT_TECH_GRAY", "rubber": "MAT_NIGHT_RUBBER",
        "visor": "MAT_VISOR_OPTICAL_BLACK", "chest_blue": "MAT_CHEST_BLUE",
        "light": "MAT_STATUS_LIGHT_ORANGE", "warm_rim": "MAT_VISOR_WARM_RIM",
    }
    return bpy.data.materials[names[key]]
