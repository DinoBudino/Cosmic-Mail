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

import os
import subprocess

import numpy as np
import soundfile as sf

from kokoro_onnx import Kokoro

KOKORO_DIR = os.environ.get("KOKORO_DIR", "/tmp/opencode/kokoro")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("PIP_AUDIO_DIR", os.path.join(SCRIPT_DIR, "..", "public", "audio", "pip"))

KO = Kokoro(os.path.join(KOKORO_DIR, "model.onnx"), os.path.join(KOKORO_DIR, "voices.bin"))

# Keep in sync with AUDIO_KEYS in src/game/pipVoice.ts.
# Sources: src/data/marsObjects.ts (REGION_INFO[*].pipMessage),
# src/data/personalization.ts (INTRO_LINES + HISTORICAL_EXPLORERS),
# src/ui/onboarding/Cabin.tsx (ritual lines, hub tour),
# src/ui/onboarding/LaunchSequence.tsx (LAUNCH_MEMORY_LOSS_LINE),
# src/ui/SiteInteraction.tsx (hero.memoryLine).
# NOTE: question keys keep their historic numbering (q4/q5 files hold
# the current Q3/Q4 texts); the game matches on exact text.
PHRASES = [
    ("opportunity", "Wow! Valley of Echoes! Look, old rover tracks!"),
    ("insight", "Hush now! Silent Plains. Listen with me!"),
    ("ingenuity", "First Flight Dunes! Whoa. The sky is so wide here."),
    ("viking1", "Ancient Lands. Whoa! This place feels old."),
    ("welcome", "Hi! I am Pip, your mail companion."),
    # --- Cinematic intro (INTRO_LINES in personalization.ts) ---
    ("cabin-intro-1", "Hi! I'm PIP, your cabin buddy. Welcome aboard Cosmic Mail!"),
    ("cabin-intro-2", "Long ago, explorers traveled to the Moon, Mars, and far beyond."),
    ("cabin-intro-3", "They were machines, sent to discover things humans couldn't see."),
    ("cabin-intro-4", "Some of their missions have ended."),
    ("cabin-intro-5", "But their stories are still out there, waiting to be remembered."),
    ("cabin-intro-6", "That's where you come in!"),
    ("cabin-intro-8", "You'll travel across space and deliver letters to these forgotten explorers. Will you help me?"),
    ("cabin-intro-9", "Every explorer sees the universe in a different way."),
    ("cabin-intro-10", "Before we begin, let's discover your explorer spirit."),
    # --- Cabin ritual dialogue (src/ui/onboarding/Cabin.tsx) ---
    ("cabin-welcome", "Welcome aboard! Quick check before we fly."),
    ("cabin-q1", "You open your eyes on a quiet night sky. What calls you first?"),
    ("cabin-q2-intro", "Something strange is under our feet."),
    ("cabin-q2", "You find a tiny door on Mars that was not there before. What do you do?"),
    ("cabin-q4-intro", "Friends make every mission brighter, do not you think?"),
    ("cabin-q4", "A little robot is lost and cannot find its way home. What do you do?"),
    ("cabin-q5-intro", "One last light, then the stars will show us something special."),
    ("cabin-q5", "At the end of the mission, what would make you smile most?"),
    ("cabin-reveal", "The stars have spoken..."),
    ("cabin-name", "One last thing, carrier! Every letter needs a name. What should I call you?"),
    # Explorer step: history first, then the power it inspires.
    ("cabin-hero-sally-story", "Sally Ride became the first American woman in space in 1983."),
    ("cabin-hero-sally-power", "Her courage inspires Second Chance: make one mistake without starting over!"),
    ("cabin-hero-mae-story", "Mae Jemison traveled into space in 1992. She was both a scientist and an astronaut."),
    ("cabin-hero-mae-power", "Her curiosity inspires Explorer Vision: reveal important clues!"),
    ("cabin-hero-katherine-story", "Katherine Johnson used mathematics to calculate important spaceflight paths."),
    ("cabin-hero-katherine-power", "Her careful math inspires Mission Plan: follow clear steps to solve challenges!"),
    ("cabin-hero-margaret-story", "Margaret Hamilton led a team that developed software for the Apollo missions."),
    ("cabin-hero-margaret-power", "Her attention to detail inspires Safety Check: spot a possible mistake before acting!"),
    ("cabin-hero-carl-story", "Carl Sagan studied planets and inspired people to explore big questions about the universe."),
    ("cabin-hero-carl-power", "His curiosity inspires Time to Think: slow down danger and pause to decide!"),
    # Hub tour + route confirmation (src/ui/onboarding/Cabin.tsx).
    ("cabin-hub-0", "Look, carrier — your Cosmic Mail passport is ready!"),
    ("cabin-hub-1", "It holds your name, your power, your hero and your stamps."),
    ("cabin-hub-2", "And this green screen is navigation. Moon and Deep Space are still sleeping — Mars is ready."),
    ("cabin-hub-3", "When you land, find the silent machines and deliver their letters. When you are ready, tap the radar screen and choose."),
    ("cabin-explorer-fallback", "Which explorer feels like you?"),
    ("cabin-all-set", "All set, carrier! Press the red button to take off!"),
    # Launch: archive damage warning (LaunchSequence.tsx).
    ("cabin-launch-memory", "Warning! My hero archive took a hit entering Mars. I only remember your current hero — the others are lost as memory fragments near the silent machines!"),
    # Restored hero memories (SiteInteraction.tsx, hero.memoryLine).
    # Explorer presentation lines are subtitle-only (no recordings).
    ("cabin-memory-sally", "I became the first American woman in space in 1983."),
    ("cabin-memory-mae", "I traveled into space in 1992 and studied how bodies behave in zero gravity."),
    ("cabin-memory-katherine", "My careful calculations helped astronauts travel safely."),
    ("cabin-memory-margaret", "I led a team that wrote software for the Apollo missions."),
    ("cabin-memory-carl", "I helped people ask big questions about the universe."),
]

# Voice id -> folder name used by the game (see src/game/pipVoice.ts).
VOICES = [("af_heart", "heart"), ("af_sky", "sky"), ("bf_lily", "lily"), ("am_michael", "michael")]

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
    if pitch != 1.0:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", wav,
             "-af", f"asetrate=24000*{pitch},aresample=24000,atempo={1 / pitch}", mp3],
            check=True,
        )
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, mp3], check=True)


# Optional CLI filter: only generate these phrase keys (e.g. new
# lines) instead of rebuilding every recording.
ONLY = set(__import__("sys").argv[1:]) or None

for voice_id, folder in VOICES:
    os.makedirs(os.path.join(OUT, folder), exist_ok=True)
    for key, text in PHRASES:
        if ONLY and key not in ONLY:
            continue
        # Cabin lines: slower and pitch-natural — the pitch-shifted take
        # sounded robotic/foreign. World lines keep the original takes.
        cabin = key.startswith("cabin-")
        speed1, speed2, pitch2 = (0.9, 0.85, 1.0) if cabin else (1.0, 0.92, 1.06)
        audio, sr = synth(text, voice_id, speed1)
        sf.write(TMP, audio, sr)
        to_mp3(TMP, os.path.join(OUT, folder, f"{key}1.mp3"), 1.0)
        audio2, sr2 = synth(text, voice_id, speed2)
        sf.write(TMP, audio2, sr2)
        to_mp3(TMP, os.path.join(OUT, folder, f"{key}2.mp3"), pitch2)
        print("done", folder, key)

# Two-note robot chirp announced before every line.
subprocess.run(
    ["ffmpeg", "-v", "error", "-y",
     "-f", "lavfi", "-i", "sine=frequency=880:duration=0.07",
     "-f", "lavfi", "-i", "sine=frequency=1320:duration=0.09",
     "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1,volume=0.5",
     os.path.join(OUT, "chirp.mp3")],
    check=True,
)

print("all done")
