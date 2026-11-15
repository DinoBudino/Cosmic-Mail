"""05 — franjas naranjas (lateral derecho superior), acentos frontales y banda trasera vertical (según la ficha)."""
from pip_utils import *
from mathutils import Matrix

M = "orange"
clear_module(M)
oc = col("05_ORANGE_PANELS")
ORG, NIGHT = mat("MAT_ORANGE_MISSION"), mat("MAT_NIGHT_BLUE")
BRZ = bpy.data.materials.get("MAT_BRONZE") or create_material("MAT_BRONZE", "#C48A2C", 0.85, 0.28)


def finish(o, thick=0.016, bevel=0.005):
    add_solidify(o, thick, -1.0)
    add_bevel(o, bevel, 2, 40)
    return o


# ── franjas: bandas paralelas al borde superior del visor, del frente-derecha hacia atrás.
# Son "latitudes" alrededor de un eje inclinado 15° hacia delante: bajan por delante (junto al
# visor) y suben hacia atrás, como en la vista lateral de la ficha. Cortadas por juntas de panel.
TILT = Matrix.Rotation(0.26, 3, 'X')     # (0,0,1) -> (0,-0.26,0.97)


def tilt_pt(t, p, off):
    d = Vector((math.sin(t) * math.cos(p), math.sin(t) * math.sin(p), math.cos(t)))
    return dir_to_surface(TILT @ d, off)


def lat_band(name, t0, t1, p0, p1, material=ORG, off=0.013, ni=5, nj=40, solid=True):
    def fn(i, j):
        return tilt_pt(t0 + (t1 - t0) * i / ni, p0 + (p1 - p0) * j / nj, off)
    o = grid_mesh(name, fn, ni, nj, oc, material, M)
    return finish(o) if solid else o


GAP = 0.035
STRIPES = {   # nombre: (theta0, theta1, [cortes de phi])
    "TOP_ORANGE_STRIPE_A": (0.54, 0.71, [-1.25, -0.50, 0.20, 0.95]),
    "TOP_ORANGE_STRIPE_B": (0.77, 0.95, [-1.32, -0.58, 0.12, 0.85]),
}
for nm, (t0, t1, cuts) in STRIPES.items():
    lat_band(nm.replace("STRIPE", "BORDER").replace("TOP_ORANGE", "PANEL"), t0 - 0.012, t1 + 0.012,
             cuts[0] - 0.015, cuts[-1] + 0.015, NIGHT, off=0.006, ni=1, solid=False)
    for k in range(len(cuts) - 1):
        lat_band(f"{nm}_{k + 1}", t0, t1, cuts[k] + (GAP / 2 if k else 0), cuts[k + 1] - (GAP / 2 if k < len(cuts) - 2 else 0))
# acento naranja corto arriba-izquierda (frontal de la ficha), con la misma inclinación
lat_band("FRONT_ACCENT_LEFT_STRIPE", 0.70, 0.88, math.pi + 0.95, math.pi + 1.30)


# ── parche superelíptico proyectado ──
def patch_dir(name, center, hw, hh, n, off, material, rot=0.0, nr=6, nseg=48, thick=0.016):
    c = Vector(center).normalized()
    up = Vector((0, 0, 1)) if abs(c.z) < 0.95 else Vector((1, 0, 0))
    t1 = c.cross(up).normalized()
    t2 = t1.cross(c).normalized()
    cr, sr = math.cos(rot), math.sin(rot)
    t1, t2 = t1 * cr + t2 * sr, -t1 * sr + t2 * cr

    def fn(i, j):
        r = i / nr
        x, z = superellipse(TAU * j / nseg, hw, hh, n)
        return dir_to_surface(c + t1 * x * r + t2 * z * r, off)

    o = grid_mesh(name, fn, nr, nseg, oc, material, M, closed_j=True)
    if thick:
        finish(o, thick, 0.005)
    return o


# ── placa naranja con ranura, arriba al centro sobre el visor ──
fa_center = (0.0, -0.42, 0.91)
patch_dir("FRONT_ACCENT_BORDER", fa_center, 0.215, 0.080, 3.5, 0.011, BRZ, thick=0.014)
patch_dir("FRONT_ACCENT_PLATE", fa_center, 0.188, 0.058, 3.5, 0.020, ORG, thick=0.012)
patch_dir("FRONT_ACCENT_SLOT", fa_center, 0.140, 0.020, 3.5, 0.027, NIGHT, thick=0.006)
# placa técnica gris arriba-izquierda
patch_dir("FRONT_ACCENT_GRAY_PLATE", (-0.42, -0.40, 0.86), 0.075, 0.045, 3.0, 0.014, mat("MAT_PLATE_GRAY"), rot=0.45, thick=0.012)


# ── banda trasera: rectángulo vertical desde la base de la antena hasta la junta horizontal ──
def rear_rect(name, x0, x1, z0, z1, material, off, ni=6, nj=40, solid=True):
    def fn(i, j):
        x = x0 + (x1 - x0) * i / ni
        # más densidad cerca de la cima
        t = j / nj
        z = z0 + (z1 - z0) * (1 - (1 - t) ** 1.6)
        return rear_pt(x, z, off)
    o = grid_mesh(name, fn, ni, nj, oc, material, M)
    return finish(o, 0.012, 0.004) if solid else o


rear_rect("REAR_ORANGE_PANEL", -0.20, 0.20, 0.10, 0.885, ORG, 0.013)
rear_rect("REAR_PANEL_BORDER", -0.212, 0.212, 0.09, 0.89, NIGHT, 0.006, ni=1, solid=False)
print("ORANGE OK", [o.name for o in oc.objects])
