"""01 — cuerpo: núcleo estructural, carcasas por paneles (con juntas), anillos y costuras."""
from pip_utils import *

M = "body"
clear_module(M)
body_col = col("01_MAIN_BODY")
g = C["panel_gap"] / 2.0 / min(RX, RY, RZ)      # holgura angular por lado
NT, NP = 40, 120


def patch(name, t0, t1, p0, p1, material, full_phi=False, solid=True):
    nt = max(8, int(NT * (t1 - t0) / math.pi * 2))
    npp = NP if full_phi else int(NP * (p1 - p0) / TAU) + 2
    ta, tb = (t0 if t0 < 0.1 else t0 + g), (t1 if t1 > math.pi - 0.1 else t1 - g)
    pa, pb = (p0, p1) if full_phi else (p0 + g, p1 - g)

    def fn(i, j):
        t = ta + (tb - ta) * i / nt
        ph = pa + (pb - pa) * (j / npp if not full_phi else j / npp)
        return ell_pt(t, ph)

    o = grid_mesh(name, fn, nt, npp, body_col, material, M, closed_j=full_phi)
    if solid:
        add_solidify(o, C["shell_thickness"], -1.0)
    add_bevel(o, C["bevel_small"], 2, 40)
    return o


cream = create_material("MAT_CREAM_SATIN", PALETTE["cream"], 0.05, 0.42, coat=0.15)
bronze = create_material("MAT_BRONZE", "#C48A2C", 0.85, 0.28)
belt_dark = create_material("MAT_BELT_DARK", "#171B25", 0.35, 0.42, coat=0.2)
plate_gray = create_material("MAT_PLATE_GRAY", "#7C8491", 0.6, 0.35)
bottom_dark = create_material("MAT_BOTTOM_DARK", "#2B303B", 0.45, 0.40)
T1, T2, T3 = 1.483, 2.29, 2.72      # T1 = junta horizontal (z≈0.08) visible atrás      # cima | carcasa crema | franja oscura | placa inferior

# Núcleo estructural interior (visible por las juntas)
core = grid_mesh("BODY_CORE", lambda i, j: ell_pt(math.pi * i / 36, TAU * j / 72) * 0.93, 36, 72,
                 body_col, mat("MAT_NIGHT_BLUE"), M, closed_j=True)

patch("SHELL_TOP", 0.045, T1, 0, TAU, cream, full_phi=True)   # el polo queda bajo la base de la antena
patch("SHELL_FRONT", T1, T2, math.pi, TAU, cream)
patch("SHELL_REAR", T1, T2, 0, math.pi, cream)
patch("SHELL_BELT_FRONT", T2, T3, math.pi, TAU, belt_dark)
patch("SHELL_BELT_REAR", T2, T3, 0, math.pi, belt_dark)
patch("SHELL_BOTTOM", T3, math.pi - 0.06, 0, TAU, bottom_dark, full_phi=True)   # polo cubierto por el cuello del propulsor


def band(name, theta, width, phi0, phi1, material, off, n=96):
    """Banda fina que sigue una latitud del cuerpo."""
    def fn(i, j):
        t = theta + (i - 0.5) * width / RZ
        return ell_pt(t, phi0 + (phi1 - phi0) * j / n, off)
    return grid_mesh(name, fn, 1, n, body_col, material, M)


b = band("EQUATOR_SEAMS", T2 - 0.012, 0.016, 0.0, TAU, bronze, 0.004, 160)     # filete bronce entre carcasa y franja oscura
b.data.polygons  # costura inferior continua
band("STRUCTURAL_RINGS", T3, 0.010, 0.0, TAU, mat("MAT_NIGHT_BLUE"), 0.004, 160)    # junta franja/placa inferior
print("BODY objects:", [o.name for o in body_col.objects])
