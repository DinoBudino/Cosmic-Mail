#!/usr/bin/env python3
"""Generate PIP's lines with Kokoro (patched input dtypes for onnxruntime>=1.20).

Rebuilds every MP3 in public/audio/pip/<voice>/<phrase><take>.mp3 plus
pip/chirp.mp3. See generate-pip-voice.md for the full setup instructions.

Requirements (Python venv):
    kokoro-onnx, soundfile, numpy
    system: ffmpeg (for MP3 encoding)
Engine files (model.onnx + voices.bin) live in KOKORO_DIR (default
/tmp/opencode/kokoro) — downloaded once from the kokoro-onnx releases.
"""

import json
import os
import subprocess
import sys

import numpy as np
import soundfile as sf

from kokoro_onnx import Kokoro

KOKORO_DIR = os.environ.get("KOKORO_DIR", "/tmp/opencode/kokoro")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PIP_AUDIO_DIR", os.path.join(SCRIPT_DIR, "..", "public", "audio", "pip"))

KO = Kokoro(os.path.join(KOKORO_DIR, "model.onnx"), os.path.join(KOKORO_DIR, "voices.bin"))

# Keep in sync with src/data/pipVoiceLines.json and AUDIO_KEYS in
# src/game/pipVoice.ts. The onboarding JSON is the shared source of truth.
LINE_MANIFEST = os.path.join(SCRIPT_DIR, "..", "src", "data", "pipVoiceLines.json")
with open(LINE_MANIFEST, "r", encoding="utf-8") as handle:
    ONBOARDING_LINES = json.load(handle)

LANDMARK_PHRASES = [
    ("opportunity", "Wow! Valley of Echoes! Look, old rover tracks!"),
    ("insight", "Hush now! Silent Plains. Listen with me!"),
    ("ingenuity", "First Flight Dunes! Whoa. The sky is so wide here."),
    ("viking1", "Ancient Lands. Whoa! This place feels old."),
]
ONBOARDING_PHRASES = [(line["key"], line["text"]) for line in ONBOARDING_LINES]
ONBOARDING_KEYS = {line["key"] for line in ONBOARDING_LINES}
ONBOARDING_SPEEDS = {line["key"]: float(line["speed"]) for line in ONBOARDING_LINES}
# Optional per-line pitch lift (formant-preserving duration via atempo):
# a slightly brighter PIP on cheerful lines, softer on sad ones.
ONBOARDING_PITCHES = {line["key"]: float(line.get("pitch", 1.0)) for line in ONBOARDING_LINES}
PHRASES = LANDMARK_PHRASES + ONBOARDING_PHRASES

# Voice id -> folder name used by the game (see src/game/pipVoice.ts).
VOICES = [("af_heart", "heart")]  # PIP has one voice

TMP = os.path.join(KOKORO_DIR, "tmp.wav")


def synth(text, voice_id, speed):
    # tokenize() expects PHONEMES, not raw text: phonemize first or the
    # model receives raw letters and spells them out ("fly" -> "fli").
    phonemes = KO.tokenizer.tokenize(KO.tokenizer.phonemize(text))[:510]
    tokens = np.array([[0, *phonemes, 0]], dtype=np.int64)
    style = KO.voices[voice_id][len(phonemes)].astype(np.float32)
    feed = {
        "input_ids": tokens,
        "style": style,
        # kokoro-onnx sends speed as int32; the model wants float.
        "speed": np.array([speed], dtype=np.float32),
    }
    return KO.sess.run(None, feed)[0].squeeze(), 24000


def to_mp3(wav, mp3, pitch=1.0):
    output = ["-ar", "24000", "-ac", "1", "-b:a", "32k", mp3]
    if pitch != 1.0:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", wav,
             "-af", f"asetrate=24000*{pitch},aresample=24000,atempo={1 / pitch}", *output],
            check=True,
        )
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, *output], check=True)


# CLI: positional keys filter the run; --onboarding-only limits it to the
# shared JSON lines; --force overwrites existing files.
ARGV = sys.argv[1:]
ONBOARDING_ONLY = "--onboarding-only" in ARGV
FORCE = "--force" in ARGV
ONLY = {arg for arg in ARGV if not arg.startswith("--")} or None

SELECTED = ONBOARDING_PHRASES if ONBOARDING_ONLY else PHRASES

for voice_id, folder in VOICES:
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for key, text in SELECTED:
        if ONLY and key not in ONLY:
            continue
        take1 = os.path.join(OUT, folder, f"{key}1.mp3")
        take2 = os.path.join(OUT, folder, f"{key}2.mp3")
        if os.path.exists(take1) and os.path.exists(take2) and not FORCE:
            print("skip existing", folder, key)
            continue

        if key in ONBOARDING_KEYS:
            # Selected natural treatment: no pitch shift. Two close takes
            # keep the existing variation mechanism without changing timbre.
            speed1 = ONBOARDING_SPEEDS[key]
            speed2 = max(0.5, speed1 * 0.96)
            pitch1 = ONBOARDING_PITCHES[key]
            pitch2 = pitch1
        else:
            # World orientation lines keep the original two takes.
            speed1, speed2, pitch1, pitch2 = 1.0, 0.92, 1.0, 1.06

        audio, sr = synth(text, voice_id, speed1)
        sf.write(TMP, audio, sr)
        to_mp3(TMP, take1, pitch1)
        audio2, sr2 = synth(text, voice_id, speed2)
        sf.write(TMP, audio2, sr2)
        to_mp3(TMP, take2, pitch2)
        print("done", folder, key)

# Two-note robot chirp announced before every line. Do not rewrite it while
# adding onboarding lines: that file belongs to the existing game audio.
chirp_path = os.path.join(OUT, "chirp.mp3")
if not ONBOARDING_ONLY and (FORCE or not os.path.exists(chirp_path)):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y",
         "-f", "lavfi", "-i", "sine=frequency=880:duration=0.07",
         "-f", "lavfi", "-i", "sine=frequency=1320:duration=0.09",
         "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1,volume=0.5",
         chirp_path],
        check=True,
    )

print("all done")
