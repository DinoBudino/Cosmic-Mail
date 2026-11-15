"""Astronauta Mensajero V2 — configuración central (todas las proporciones salen de aquí).

Medidas tomadas de la vista frontal de la ficha: figura de 548 px (escala 1.5x) = 3.0 u.
Orientación: -Y frente, +Z arriba, origen entre las botas sobre el suelo.
"""
import os

PROJECT_DIR = "/home/dinobudino/Documentos/TEST/cosmic-mail/blender/AstronautV2"
SCRIPTS_DIR = os.path.join(PROJECT_DIR, "scripts")
RENDERS_DIR = os.path.join(PROJECT_DIR, "renders")
REPORTS_DIR = os.path.join(PROJECT_DIR, "reports")
CHECKPOINTS_DIR = os.path.join(PROJECT_DIR, "checkpoints")
REFERENCE = os.path.join(PROJECT_DIR, "reference", "astronaut_reference.png")
FINAL_BLEND = os.path.join(PROJECT_DIR, "CosmicMail_Astronaut_Final.blend")

ASTRONAUT_CONFIG = {
    "total_height": 3.0,
    # casco (semiejes) — ficha: 1.06 ancho sin módulos, ~1.0 alto
    "helmet_center": (0.0, -0.02, 2.47),
    "helmet_rx": 0.545,
    "helmet_ry": 0.575,
    "helmet_rz": 0.540,
    # visor: superelipse proyectada sobre el frente del casco
    "visor_a": 0.425,          # semianchura (ficha: visor ~0.86 del ancho del casco, con marco crema visible)
    "visor_b": 0.345,          # semialtura
    "visor_n": 2.25,           # más ovalado, menos rectangular
    "visor_cz": -0.035,        # centro relativo al centro del casco
    "visor_bulge": 0.045,
    "ear_radius": 0.215,
    # cuello
    "neck_z": (1.93, 2.04),
    # torso
    "torso_z": (1.10, 1.93),
    "torso_width": 0.86,       # anchura máx (semieje 0.43)
    "torso_depth": 0.62,
    "shoulder_x": 0.55,
    "shoulder_z": 1.78,
    # brazos
    "elbow": (0.685, 0.02, 1.40),
    "wrist": (0.725, -0.03, 1.15),
    "upper_arm_r": 0.170,
    "forearm_r": 0.175,
    # piernas
    "hip": (0.235, 0.0, 1.08),
    "knee": (0.25, -0.01, 0.72),
    "ankle": (0.255, 0.0, 0.38),
    "thigh_r": 0.245,
    "shin_r": 0.232,
    # botas
    "boot_length": 0.64,
    "boot_width": 0.52,
    "boot_height": 0.40,
    # mochila
    "backpack_width": 0.88,
    "backpack_height": 1.12,
    "backpack_depth": 0.46,
    "backpack_center": (0.0, 0.57, 1.76),
    # detalle
    "panel_gap": 0.008,
    "bevel_small": 0.006,
    "bevel_medium": 0.018,
    "bevel_large": 0.035,
    "render_samples": 128,
}
C = ASTRONAUT_CONFIG

PALETTE = {
    "orange": "#F47B38",
    "cream": "#F5F0E7",
    "cosmic_blue": "#26354A",
    "tech_gray": "#9DA5B0",
    "night_blue": "#151C29",
}

# Sin expresiones HUD: el visor es un cristal negro reflectante sin emociones (decisión del usuario).

COLLECTIONS = [
    "00_REFERENCE", "01_BODY", "02_HELMET", "03_VISOR", "04_TORSO", "05_ARMS",
    "06_HANDS", "07_LEGS", "08_BOOTS", "09_BACKPACK", "10_MATERIALS", "11_RIG_CONTROLS",
    "12_LIGHTING_CAMERAS", "13_VALIDATION",
]
