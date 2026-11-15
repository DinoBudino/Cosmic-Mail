"""08 — detalles según la ficha: LEDs con marco bronce, sensor, botón, luces del cinturón,
rejillas traseras, placa trasera, juntas de panel y remaches."""
from pip_utils import *

M = "details"
clear_module(M)
dc = col("08_MECHANICAL_DETAILS")
NIGHT, GRAY = mat("MAT_NIGHT_BLUE"), mat("MAT_TECH_GRAY")
PLATE = mat("MAT_PLATE_GRAY")
SEAM = create_material("MAT_SEAM", "#6E6459", 0.0, 0.6)      # juntas beige oscuro, discretas
BRZ = mat("MAT_BRONZE")
DARK = bpy.data.materials.get("MAT_EAR_CENTER") or NIGHT
LED = mat("MAT_LED_ORANGE_EMISSION")
LED.node_tree.nodes["EMIT"].inputs[0].default_value = hex_to_linear_rgba("#FFB23A")


def surf(side, x, z, off):
    return front_pt(x, z, off) if side == "F" else rear_pt(x, z, off)


def patch_xz(name, side, cx, cz, hw, hh, n, off, material, thick=0.010, nr=4, nseg=40, bev=0.003):
    """Parche superelíptico definido en el plano XZ y proyectado sobre el frente/trasera."""
    def fn(i, j):
        r = i / nr
        x, z = superellipse(TAU * j / nseg, hw, hh, n)
        return surf(side, cx + x * r, cz + z * r, off)
    o = grid_mesh(name, fn, nr, nseg, dc, material, M, closed_j=True)
    if thick:
        add_solidify(o, thick, -1.0)
    if bev:
        add_bevel(o, bev, 2, 40)
    return o


def line_xz(name, side, x0, z0, x1, z1, w=0.007, off=0.004, material=None, n=40):
    material = material or SEAM
    d = Vector((x1 - x0, z1 - z0))
    nn = Vector((-d.y, d.x)).normalized() * w / 2

    def fn(i, j):
        t = j / n
        s = -1 if i == 0 else 1
        return surf(side, x0 + (x1 - x0) * t + nn.x * s, z0 + (z1 - z0) * t + nn.y * s, off)
    return grid_mesh(name, fn, 1, n, dc, material, M)


def seam_phi(name, phi, t0, t1, w=0.010, material=NIGHT, off=0.004):
    def fn(i, j):
        t = t0 + (t1 - t0) * j / 30
        return ell_pt(t, phi + (i - 0.5) * w / RX, off)
    return grid_mesh(name, fn, 1, 30, dc, material, M)


def led(prefix, side, cx, cz, hw, hh):
    patch_xz(prefix + "_FRAME", side, cx, cz, hw + 0.026, hh + 0.024, 5.0, 0.010, BRZ)
    patch_xz(prefix + "_DIFFUSER", side, cx, cz, hw, hh, 5.0, 0.018, LED, thick=0.004, bev=0.002)


# ── LEDs de estado ──
led("FRONT_LED", "F", 0.0, -0.50, 0.165, 0.032)
led("REAR_LED", "R", 0.0, -0.46, 0.26, 0.038)

# ── franja oscura frontal: sensor/cámara, botón y pilotos ──
patch_xz("CAMERA_HOUSING", "F", 0.40, -0.74, 0.075, 0.075, 2.0, 0.012, PLATE, thick=0.012)
patch_xz("CAMERA_RING", "F", 0.40, -0.74, 0.058, 0.058, 2.0, 0.020, NIGHT, thick=0.008)
patch_xz("CAMERA_LENS", "F", 0.40, -0.74, 0.036, 0.036, 2.0, 0.026, DARK, thick=0.004, nr=3, nseg=28)
patch_xz("BELT_BUTTON", "F", -0.40, -0.75, 0.070, 0.042, 3.0, 0.012, PLATE, thick=0.010)
for sx, nm in ((-1, "L"), (1, "R")):
    patch_xz(f"BELT_LIGHT_{nm}", "F", sx * 0.62, -0.69, 0.030, 0.030, 2.0, 0.012, LED, thick=0.004, nr=2, nseg=20)
    patch_xz(f"REAR_BELT_LIGHT_{nm}", "R", sx * 0.55, -0.72, 0.030, 0.030, 2.0, 0.012, LED, thick=0.004, nr=2, nseg=20)

# juntas verticales del cinturón (segmentos como en la ficha)
T2, T3 = 2.29, 2.72
for k, ph in enumerate([math.pi + 0.55, math.pi + 1.15, 1.5 * math.pi, TAU - 1.15, TAU - 0.55,
                        0.55, 1.15, 0.5 * math.pi, math.pi - 1.15, math.pi - 0.55]):
    seam_phi(f"BELT_SEAM_{k + 1:02d}", ph, T2 + 0.02, T3 - 0.01, w=0.012, material=PLATE, off=0.003)

# ── sensor pequeño frontal izquierdo (ficha: pieza azulada junto a la oreja) ──
patch_xz("SENSOR_DETAIL_HOUSING", "F", -0.80, -0.22, 0.040, 0.050, 2.6, 0.011, NIGHT, thick=0.008)
patch_xz("SENSOR_DETAIL_LENS", "F", -0.80, -0.22, 0.020, 0.028, 2.0, 0.017, mat("MAT_SENSOR_BLUE_EMISSION"), thick=0.004, nr=2, nseg=20)

# ── trasera: rejillas verticales a ambos lados de la banda, placa central bajo la junta ──
for sx, nm in ((-1, "L"), (1, "R")):
    patch_xz(f"VENT_RECESS_{nm}", "R", sx * 0.42, 0.40, 0.065, 0.115, 4.0, 0.009, NIGHT, thick=0.010)
    for k in range(5):
        patch_xz(f"VENT_SLAT_{nm}{k + 1}", "R", sx * 0.42, 0.40 + (k - 2) * 0.042, 0.050, 0.008, 4.0, 0.016,
                 GRAY, thick=0.006, nr=2, nseg=24, bev=0.002)
patch_xz("REAR_PLATE", "R", 0.0, -0.14, 0.095, 0.045, 3.0, 0.012, PLATE, thick=0.010)
patch_xz("REAR_PLATE_SLOT", "R", 0.0, -0.14, 0.055, 0.014, 3.0, 0.018, NIGHT, thick=0.004, nr=2)

# ── juntas de panel (líneas finas oscuras) ──
for sx, nm in ((-1, "L"), (1, "R")):
    line_xz(f"PANEL_GAP_REAR_V{nm}", "R", sx * 0.60, 0.09, sx * 0.60, 0.72)
    line_xz(f"PANEL_GAP_FRONT_V{nm}", "F", sx * 0.80, 0.30, sx * 0.80, -0.24)
line_xz("PANEL_GAP_REAR_LOW", "R", -0.62, -0.27, 0.62, -0.27)
line_xz("PANEL_GAP_FRONT_LOW", "F", -0.55, -0.42, -0.28, -0.42)
line_xz("PANEL_GAP_FRONT_LOW_R", "F", 0.28, -0.42, 0.55, -0.42)

# ── remaches (detalle característico de la ficha): una malla compartida, instancias por la normal ──
# ficha: remaches discretos, tono beige-gris algo más oscuro que el casco, poco relieve
RIVET = create_material("MAT_RIVET", "#A79C8C", 0.35, 0.38)
screw_prof = [(0, 0.0), (0.016, 0.0), (0.016, 0.003), (0.012, 0.007), (0.006, 0.009), (0, 0.0095)]
screw_src = create_revolved_mesh("SCREW_SOURCE", screw_prof, dc, RIVET, M, segments=16)
screw_src.hide_viewport = True
screw_src.hide_render = True
spots = []
# trasera: a lo largo de la junta horizontal, de las verticales y bajo la banda
spots += [rear_pt(x, 0.04, 0.0) for x in (-0.55, -0.32, 0.32, 0.55)]
spots += [rear_pt(x, -0.32, 0.0) for x in (-0.45, -0.15, 0.15, 0.45)]
spots += [rear_pt(sx * 0.66, z, 0.0) for sx in (-1, 1) for z in (0.22, 0.48, 0.66)]
# frente: columnas entre el visor y las orejas, línea del cinturón y junto a la placa superior
spots += [front_pt(sx * 0.80, z, 0.0) for sx in (-1, 1) for z in (0.36, -0.30)]
spots += [front_pt(x, -0.47, 0.0) for x in (-0.62, -0.32, 0.32, 0.62)]
spots += [front_pt(sx * 0.30, 0.74, 0.0) for sx in (-1, 1)]
# alrededor de cada oreja (sobre el casco)
for sx in (-1, 1):
    for a in (40, 100, 160, 220, 280, 340):
        r = math.radians(a)
        spots.append(dir_to_surface(Vector((sx * 0.62, 0.50 * math.cos(r), -0.02 + 0.50 * math.sin(r))), 0.0))
# corona alrededor de la base de la antena
spots += [ell_pt(0.30, math.radians(a), 0.0) for a in range(30, 360, 60)]
# laterales: extremos de las franjas y panel superior trasero
spots += [ell_pt(t, p, 0.0) for t, p in ((0.62, 0.95), (0.92, 0.70), (0.75, math.pi - 0.95), (1.05, -0.95))]
for k, p in enumerate(spots):
    nrm = ell_normal(p)
    s = bpy.data.objects.new(f"SCREW_{k + 1:02d}", screw_src.data)
    dc.objects.link(s)
    s.location = p + nrm * 0.003
    s.rotation_euler = nrm.to_track_quat('Z', 'Y').to_euler()
    s["pip_module"] = M
print("DETAILS OK", len(dc.objects), "objetos")
