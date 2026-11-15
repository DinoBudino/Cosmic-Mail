"""09 — rig por empties: jerarquía, propiedades y drivers funcionales."""
from pip_utils import *

rc = col("00_CONTROLLERS")
ant_z = RZ - 0.025


def ctrl(name, loc=(0, 0, 0), display='PLAIN_AXES', size=0.3):
    o = bpy.data.objects.get(name)
    if o is None:
        o = bpy.data.objects.new(name, None)
        rc.objects.link(o)
    o.empty_display_type = display
    o.empty_display_size = size
    o.parent = None
    o.location = loc
    o.rotation_euler = (0, 0, 0)
    o["pip_module"] = "rig"
    return o


root = ctrl("PIP_ROOT", display='ARROWS', size=1.0)
hover = ctrl("CTRL_HOVER", display='SINGLE_ARROW', size=0.5)
rot = ctrl("CTRL_BODY_ROTATION", display='CIRCLE', size=1.3)
tilt = ctrl("CTRL_BODY_TILT", display='CIRCLE', size=1.1)
head = ctrl("CTRL_HEAD_ORIENTATION", display='SPHERE', size=0.2)
ant = ctrl("CTRL_ANTENNA", loc=(0, 0, ant_z), display='CONE', size=0.12)
thr = ctrl("CTRL_THRUSTER", loc=(0, 0, -RZ), display='CONE', size=0.15)
thr.rotation_euler = (math.pi, 0, 0)
face = bpy.data.objects["CTRL_FACE"]

for child, parent in ((hover, root), (rot, hover), (tilt, rot), (head, tilt), (ant, tilt), (thr, tilt)):
    child.parent = parent
face.parent = head          # padres en el origen → sin matriz inversa

bpy.context.view_layer.update()     # matrices al día antes de calcular inversas

# Geometría → controladores (re-parenting idempotente: se parte de padre limpio)
for cn in ("01_MAIN_BODY", "02_VISOR", "04_SIDE_MODULES", "05_ORANGE_PANELS", "06_ANTENNA",
           "07_THRUSTER", "08_MECHANICAL_DETAILS"):
    for o in col(cn).objects:
        if o.type in {'MESH', 'LIGHT'} and o.parent is not None and o.get("face_part") is None:
            o.parent = None
            o.matrix_parent_inverse.identity()
bpy.context.view_layer.update()
GROUPS = {
    tilt: ["01_MAIN_BODY", "04_SIDE_MODULES", "05_ORANGE_PANELS", "08_MECHANICAL_DETAILS"],
    head: ["02_VISOR"],
    ant: ["06_ANTENNA"],
    thr: ["07_THRUSTER"],
}
for p, cols in GROUPS.items():
    for cn in cols:
        for o in col(cn).objects:
            if o.parent is None and o.type in {'MESH', 'LIGHT'}:
                parent_keep_transform(o, p)
bpy.context.view_layer.update()


# ── propiedades personalizadas ──
def prop(o, name, val, lo=None, hi=None):
    o[name] = val
    if lo is not None:
        o.id_properties_ui(name).update(min=lo, max=hi)


prop(hover, "hover_amplitude", 0.06, 0.0, 0.3)
prop(hover, "hover_frequency", 0.5, 0.0, 3.0)
prop(hover, "hover_height", 0.0, -1.0, 1.0)
prop(tilt, "body_tilt_amount", 0.05, 0.0, 0.3)
prop(ant, "antenna_sway", 0.09, 0.0, 0.4)
prop(ant, "antenna_glow", 1.0, 0.0, 3.0)
prop(thr, "thruster_intensity", 1.0, 0.0, 3.0)
prop(thr, "thruster_pulse", 0.15, 0.0, 0.6)


def drv(idb, path, expr, variables, index=-1):
    try:
        idb.driver_remove(path, index) if index >= 0 else idb.driver_remove(path)
    except Exception:
        pass
    f = idb.driver_add(path, index) if index >= 0 else idb.driver_add(path)
    d = f.driver
    d.type = 'SCRIPTED'
    d.expression = expr
    for nm, (tid, dp) in variables.items():
        v = d.variables.new()
        v.name = nm
        v.type = 'SINGLE_PROP'
        v.targets[0].id = tid
        v.targets[0].data_path = dp
    return f


# Flotación (z)
drv(hover, "location", "h + a*sin(2*pi*f*frame/24)",
    {"h": (hover, '["hover_height"]'), "a": (hover, '["hover_amplitude"]'), "f": (hover, '["hover_frequency"]')}, 2)
# Inclinación suave
drv(tilt, "rotation_euler", "t*sin(2*pi*0.31*frame/24)", {"t": (tilt, '["body_tilt_amount"]')}, 0)
drv(tilt, "rotation_euler", "0.7*t*sin(2*pi*0.23*frame/24+1.0)", {"t": (tilt, '["body_tilt_amount"]')}, 1)
# Antena
drv(ant, "rotation_euler", "s*sin(2*pi*0.8*frame/24)", {"s": (ant, '["antenna_sway"]')}, 0)
drv(ant, "rotation_euler", "0.6*s*sin(2*pi*0.6*frame/24+1.3)", {"s": (ant, '["antenna_sway"]')}, 1)
nt = mat("MAT_ANTENNA_EMISSION").node_tree
drv(nt, 'nodes["EMIT"].inputs[1].default_value', "4.5*g", {"g": (ant, '["antenna_glow"]')})
# Propulsor
pulse = "1+pls*sin(2*pi*1.2*frame/24)"
vars_t = {"inten": (thr, '["thruster_intensity"]'), "pls": (thr, '["thruster_pulse"]')}
drv(mat("MAT_THRUSTER_EMISSION").node_tree, 'nodes["EMIT"].inputs[1].default_value', f"2.6*inten*({pulse})", vars_t)
light = bpy.data.lights["LIGHT_THRUSTER_GLOW"]
drv(light, "energy", f"25.0*inten*({pulse})", vars_t)

# resumen en PIP_ROOT (solo lectura/documentación; la fuente real está en cada controlador)
root["_nota"] = "Fuente de cada propiedad: CTRL_HOVER, CTRL_BODY_TILT, CTRL_ANTENNA, CTRL_THRUSTER, CTRL_FACE"
print("RIG OK", [o.name for o in rc.objects])
