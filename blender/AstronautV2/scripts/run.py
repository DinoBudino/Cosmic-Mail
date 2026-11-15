"""Ejecutor: run_stage('02_helmet') dentro del Blender vivo (vía MCP)."""
import sys, importlib, traceback
SD = "/home/dinobudino/Documentos/TEST/cosmic-mail/blender/AstronautV2/scripts"
if SD not in sys.path:
    sys.path.insert(0, SD)
# evita colisión con los módulos de PIPV2 (pip_config/pip_utils) cargados en la misma sesión
for _m in ("config", "geometry_utils", "material_utils", "rig_utils"):
    if _m in sys.modules and not getattr(sys.modules[_m], "__file__", "").startswith(SD):
        del sys.modules[_m]


def run_stage(name):
    for m in ("config", "geometry_utils", "material_utils", "rig_utils"):
        if m in sys.modules:
            importlib.reload(sys.modules[m])
    path = f"{SD}/{name}.py"
    try:
        exec(compile(open(path).read(), path, "exec"), {"__name__": "__astro__"})
        print(f"[ASTRONAUT] stage {name} OK")
    except Exception as exc:
        print(f"[ASTRONAUT ERROR] {type(exc).__name__}: {exc}")
        traceback.print_exc()
        raise
