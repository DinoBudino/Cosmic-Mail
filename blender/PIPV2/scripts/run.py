"""Ejecutor: run_stage('01_body') dentro del Blender vivo (vía MCP)."""
import sys, importlib, traceback
SD = "/home/dinobudino/Documentos/TEST/cosmic-mail/blender/PIPV2/scripts"
if SD not in sys.path:
    sys.path.insert(0, SD)


def run_stage(name):
    for m in ("pip_config", "pip_utils"):
        if m in sys.modules:
            importlib.reload(sys.modules[m])
    path = f"{SD}/{name}.py"
    try:
        exec(compile(open(path).read(), path, "exec"), {"__name__": "__pip__"})
        print(f"[PIP] stage {name} OK")
    except Exception as exc:
        print(f"[PIP ERROR] {type(exc).__name__}: {exc}")
        traceback.print_exc()
        raise
