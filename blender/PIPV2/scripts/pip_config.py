"""PIP V2 — configuración central. Todas las proporciones salen de aquí."""
import os

PROJECT_DIR = "/home/dinobudino/Documentos/TEST/cosmic-mail/blender/PIPV2"
SCRIPTS_DIR = os.path.join(PROJECT_DIR, "scripts")
RENDERS_DIR = os.path.join(PROJECT_DIR, "renders")
REPORTS_DIR = os.path.join(PROJECT_DIR, "reports")
CHECKPOINTS_DIR = os.path.join(PROJECT_DIR, "checkpoints")
FINAL_BLEND = os.path.join(PROJECT_DIR, "PIP_CosmicMail_Final.blend")

PIP_CONFIG = {
    "body_width": 1.92,
    "body_depth": 1.78,
    "body_height": 1.90,
    "visor_width_ratio": 0.735,
    "visor_height_ratio": 0.545,
    "visor_superellipse_n": 2.45,        # mitad inferior
    "visor_superellipse_n_top": 2.0,     # mitad superior: arco elíptico (ficha)
    "visor_center_z": 0.09,
    "visor_bulge": 0.030,
    "visor_edge_lift": 0.012,
    "side_module_scale": 0.76,
    "panel_gap": 0.012,
    "shell_thickness": 0.045,
    "bevel_small": 0.008,
    "bevel_medium": 0.025,
    "bevel_large": 0.045,
    "subdivision_level": 2,
    "render_samples": 128,
    "antenna_height": 0.50,
    "thruster_drop": 0.40,
}

C = PIP_CONFIG
RX = C["body_width"] / 2
RY = C["body_depth"] / 2
RZ = C["body_height"] / 2

# Paleta obligatoria (sRGB hex)
PALETTE = {
    "orange": "#F47B38",
    "cream": "#F5F0E7",
    "cosmic_blue": "#26354A",
    "tech_gray": "#9DA5B0",
    "night_blue": "#151C29",
}

EXPRESSIONS = [
    "EXP_01_NEUTRAL", "EXP_02_ALEGRE", "EXP_03_GUINO", "EXP_04_EMOCIONADO",
    "EXP_05_CURIOSO", "EXP_06_ANALIZANDO", "EXP_07_SATISFECHO",
    "EXP_08_SORPRENDIDO", "EXP_09_PENSATIVO",
    "EXP_10_ALEGRE_VISTA_PRINCIPAL",     # variante de la vista principal: ojo + guiño + sonrisa
]
