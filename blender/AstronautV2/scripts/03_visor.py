"""03 — visor negro reflectante: cristal convexo superelíptico, rebaje, sello cálido y marco crema."""
import math
import bpy
from config import *
from geometry_utils import *
from material_utils import M

MOD = "visor"
clear_module(MOD)
vc = col("03_VISOR")
NR, NSEG = 14, 128


def glass_fn(i, j):
    t = TAU * j / NSEG
    if i <= NR:
        return visor_pt(i / NR, t)
    return visor_pt(1.0, t, -0.05)         # labio que se hunde bajo el marco (sin bordes vistos)


glass = grid_mesh("VISOR_GLASS", glass_fn, NR + 1, NSEG, vc, M("visor"), MOD, closed_j=True)


def strip(name, rows, material, bevel=None):
    """Banda alrededor del visor: rows=[(radio normalizado, altura extra sobre la superficie del visor)]."""
    def fn(i, j):
        r, h = rows[i]
        x, z = superellipse(TAU * j / NSEG, VA * r, VB * r, VN)
        z += VZ
        return helmet_front(x, z, visor_lift(1.0) + h)
    o = grid_mesh(name, fn, len(rows) - 1, NSEG, vc, material, MOD, closed_j=True)
    if bevel:
        add_bevel(o, bevel, 2, 40)
    return o


# junta oscura en el contacto cristal/marco
strip("VISOR_INNER_SEAL", [(0.985, -0.03), (1.0, -0.004), (1.012, 0.010), (1.02, 0.014)], M("rubber"))
# contorno interior cálido muy discreto (la ficha muestra un filo ámbar)
strip("VISOR_SEAL", [(1.012, 0.006), (1.02, 0.016), (1.03, 0.020), (1.04, 0.016)], M("warm_rim"))
# marco crema exterior, perfil redondeado y grueso
strip("VISOR_FRAME", [(1.035, 0.012), (1.048, 0.030), (1.068, 0.040), (1.088, 0.036), (1.102, 0.020),
                      (1.110, 0.000), (1.114, -0.03)], M("shell"), bevel=0.004)
# el cristal nuevo vuelve a la colección de light linking (las luces de relleno no se reflejan en él)
ll = bpy.data.collections.get("LL_NO_VISOR")
if ll is not None:
    ll.objects.link(glass)
    for i, ob in enumerate(ll.objects):
        ll.collection_objects[i].light_linking.link_state = 'EXCLUDE'
print("VISOR OK", [o.name for o in vc.objects if o.get(MOD_KEY) == MOD])
