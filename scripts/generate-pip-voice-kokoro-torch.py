#!/usr/bin/env python3
"""Generate PIP lines with the PyTorch Kokoro package (KPipeline).

Same output contract as generate-pip-voice.py (which uses kokoro-onnx):
public/audio/pip/heart/<key>1.mp3 and <key>2.mp3 (PIP's only voice, af_heart),
with the same two-take treatment (take 2 at 96 % speed, same pitch lift).
Use it when the onnx engine files are not installed.

    python generate-pip-voice-kokoro-torch.py [key ...] [--prefix moon-,apollo-] [--all] [--force]

--all regenerates every line (the JSON catalog plus the four Mars landmark
lines), so the whole game keeps one identical PIP voice.

Requirements: kokoro (>=0.9), soundfile, numpy; ffmpeg on PATH.
"""

import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PIP_AUDIO_DIR", os.path.join(SCRIPT_DIR, "..", "public", "audio", "pip"))
LINES = json.load(open(os.path.join(SCRIPT_DIR, "..", "src", "data", "pipVoiceLines.json"), encoding="utf-8"))
VOICES = [("af_heart", "heart")]  # PIP has one voice
SR = 24000

argv = sys.argv[1:]
FORCE = "--force" in argv
prefixes = ()
if "--prefix" in argv:
    prefixes = tuple(argv[argv.index("--prefix") + 1].split(","))
keys = {a for a in argv if not a.startswith("--") and a not in (",".join(prefixes),)}
# Mars landmark lines live outside the JSON (see generate-pip-voice.py).
LANDMARKS = [
    {"key": "opportunity", "text": "Wow! Valley of Echoes! Look, old rover tracks!", "speed": 1.0},
    {"key": "insight", "text": "Hush now! Silent Plains. Listen with me!", "speed": 1.0},
    {"key": "ingenuity", "text": "First Flight Dunes! Whoa. The sky is so wide here.", "speed": 1.0},
    {"key": "viking1", "text": "Ancient Lands. Whoa! This place feels old.", "speed": 1.0},
]
if "--all" in argv:
    selected = LINES + LANDMARKS
else:
    selected = [l for l in LINES if (l["key"] in keys) or (prefixes and l["key"].startswith(prefixes))]

pipelines = {}


def synth(text, voice, speed):
    pipe = pipelines.setdefault(voice[0], KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M"))
    chunks = [np.asarray(a, dtype=np.float32) for _, _, a in pipe(text, voice=voice, speed=speed)]
    return np.concatenate(chunks)


def to_mp3(audio, mp3, pitch):
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "in.wav")
        sf.write(wav, audio, SR)
        af = ["-af", f"asetrate={SR}*{pitch},aresample={SR},atempo={1 / pitch}"] if pitch != 1.0 else []
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, *af, "-ar", str(SR), "-ac", "1", "-b:a", "32k", mp3],
                       check=True)


for voice, folder in VOICES:
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for line in selected:
        key = line["key"]
        t1 = os.path.join(OUT, folder, f"{key}1.mp3")
        t2 = os.path.join(OUT, folder, f"{key}2.mp3")
        if os.path.exists(t1) and os.path.exists(t2) and not FORCE:
            continue
        speed = float(line["speed"])
        pitch = float(line.get("pitch", 1.0))
        to_mp3(synth(line["text"], voice, speed), t1, pitch)
        to_mp3(synth(line["text"], voice, max(0.5, speed * 0.96)), t2, pitch)
        print("done", folder, key, flush=True)
print("all done")
