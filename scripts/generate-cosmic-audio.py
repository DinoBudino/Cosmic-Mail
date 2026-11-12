#!/usr/bin/env python3
"""Generate Cosmic Mail's original CC0 audio assets.

Run from the repository root:

    python3 scripts/generate-cosmic-audio.py

The script writes WAVs to a temporary directory, then encodes the one-shots
and ambience loops into public/audio. It is deterministic (fixed random seed)
so the shipped assets can be reproduced. Third-party music and Kenney SFX are
processed separately; see AUDIO_CREDITS.md.
"""

from __future__ import annotations

import math
import os
import random
import shutil
import struct
import subprocess
import tempfile
import wave

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")
random.seed(20261110)


def write_wav(path: str, samples, channels: int = 1) -> None:
    with wave.open(path, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        frames = bytearray()
        if channels == 1:
            for sample in samples:
                value = max(-1.0, min(1.0, sample))
                frames += struct.pack("<h", int(value * 32767))
        else:
            for frame in samples:
                for sample in frame:
                    value = max(-1.0, min(1.0, sample))
                    frames += struct.pack("<h", int(value * 32767))
        wav.writeframes(frames)


def envelope(t: float, attack: float, decay: float, curve: float = 2.0) -> float:
    if t < attack:
        return t / attack if attack > 0 else 1.0
    x = (t - attack) / max(1e-6, decay)
    return max(0.0, 1.0 - x) ** curve


def normalize(samples, peak: float = 0.7):
    maximum = max(abs(sample) for sample in samples) or 1.0
    return [sample / maximum * peak for sample in samples]


def chirp(name: str, notes, duration: float, peak=0.55, harmonics=0.35,
          vibrato=0.0, vibrato_rate=7.0, tail=0.06) -> None:
    total = duration + tail
    frames = []
    for index in range(int(total * SR)):
        t = index / SR
        frequency = 0.0
        for start, end, f0, f1 in notes:
            if start <= t <= end:
                u = (t - start) / max(1e-6, end - start)
                frequency = f0 + (f1 - f0) * u
                break
        if frequency <= 0:
            frames.append(0.0)
            continue
        phase = 2 * math.pi * frequency * t
        if vibrato:
            phase += vibrato * math.sin(2 * math.pi * vibrato_rate * t)
        value = math.sin(phase) + harmonics * math.sin(2 * phase)
        frames.append(value * envelope(t, 0.008, duration, 2.2))
    write_wav(os.path.join(TEMP, name + ".wav"), normalize(frames, peak), 1)


def chord(name: str, frequencies, duration: float, peak=0.62, bell=0.0) -> None:
    frames = []
    for index in range(int(duration * SR)):
        t = index / SR
        value = 0.0
        for offset, frequency in enumerate(frequencies):
            e = envelope(t, 0.02 + offset * 0.015, duration * (0.8 + offset * 0.03), 1.4)
            value += math.sin(2 * math.pi * frequency * t + offset * 0.4) * e / len(frequencies)
        if bell:
            value += math.sin(2 * math.pi * 2637 * t) * math.exp(-t * 7) * bell
        frames.append(value)
    write_wav(os.path.join(TEMP, name + ".wav"), normalize(frames, peak), 1)


def wind_loop(name: str, seconds=12.0, peak=0.55) -> None:
    count = int(seconds * SR)
    channels = []
    for channel in range(2):
        rnd = random.Random(1000 + channel)
        lp = 0.0
        lp2 = 0.0
        values = []
        for index in range(count):
            t = index / SR
            white = rnd.uniform(-1, 1)
            lp = lp * 0.985 + white * 0.015
            lp2 = lp2 * 0.93 + lp * 0.07
            gust = 0.55 + 0.45 * (0.5 + 0.5 * math.sin(2 * math.pi * t / seconds + channel * 0.7))
            gust *= 0.7 + 0.3 * (0.5 + 0.5 * math.sin(2 * math.pi * t / seconds * 3 + channel * 1.9))
            values.append(lp2 * gust)
        maximum = max(abs(value) for value in values) or 1.0
        channels.append([value / maximum * peak for value in values])
    write_wav(os.path.join(TEMP, name + ".wav"), list(zip(channels[0], channels[1])), 2)


def drone_loop(name: str, seconds=12.0, peak=0.42) -> None:
    count = int(seconds * SR)
    base = 55.0
    frequencies = [base * ratio for ratio in (1.0, 1.5, 2.0, 2.5, 3.0)]
    left, right = [], []
    for index in range(count):
        t = index / SR
        value = 0.0
        for offset, frequency in enumerate(frequencies):
            cycles = round(frequency * seconds)
            snapped = cycles / seconds
            value += math.sin(2 * math.pi * snapped * t + offset * 0.8) * (0.20 / (offset + 1))
        value += 0.02 * math.sin(2 * math.pi * (round(0.25 * seconds) / seconds) * t)
        lfo = 0.8 + 0.2 * math.sin(2 * math.pi * t / seconds)
        left.append(value * lfo * 0.95)
        right.append(value * lfo)
    maximum = max(max(abs(value) for value in left), max(abs(value) for value in right)) or 1.0
    frames = [(left[i] / maximum * peak, right[i] / maximum * peak) for i in range(count)]
    write_wav(os.path.join(TEMP, name + ".wav"), frames, 2)


def encode_one_shot(name: str, folder: str) -> None:
    source = os.path.join(TEMP, name + ".wav")
    target = os.path.join(OUT, folder, name + ".mp3")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", source,
         "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", target],
        check=True,
    )


def encode_loop(name: str, folder: str, length=12.0, crossfade=1.5) -> None:
    source = os.path.join(TEMP, name + ".wav")
    target = os.path.join(OUT, folder, name + ".mp3")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    body_end = length - crossfade
    graph = (
        f"[0:a]asplit=3[a][b][c];"
        f"[a]atrim=0:{crossfade},asetpts=PTS-STARTPTS[head];"
        f"[b]atrim={crossfade}:{body_end},asetpts=PTS-STARTPTS[body];"
        f"[c]atrim={body_end}:{length},asetpts=PTS-STARTPTS[tail];"
        f"[tail][head]acrossfade=d={crossfade}:c1=tri:c2=tri[x];"
        f"[body][x]concat=n=2:v=0:a=1,aresample=44100:async=1:first_pts=0,"
        f"asetpts=N/SR/TB,volume=0.9[out]"
    )
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", source,
         "-filter_complex", graph, "-map", "[out]", "-ar", "44100", "-ac", "2",
         "-c:a", "libmp3lame", "-b:a", "160k", target],
        check=True,
    )


with tempfile.TemporaryDirectory(prefix="cosmic-mail-audio-") as temp:
    TEMP = temp
    # PIP chirps
    chirp("pip-attention", [(0, 1, 740, 1180)], 0.16, 0.55, 0.45, 0.02, 9)
    chirp("pip-curious", [(0, 0.35, 620, 980), (0.35, 0.7, 980, 820), (0.7, 1, 820, 1120)], 0.38, 0.5, 0.4, 0.015, 7)
    chirp("pip-surprise", [(0, 0.45, 520, 1640), (0.45, 0.75, 1640, 1080), (0.75, 1, 1080, 1480)], 0.30, 0.58, 0.35, 0.02, 10)
    chirp("pip-worried", [(0, 0.4, 880, 720), (0.4, 0.75, 660, 560), (0.75, 1, 560, 500)], 0.46, 0.48, 0.3, 0.03, 5)
    chirp("pip-discovery", [(0, 0.25, 660, 660), (0.25, 0.5, 880, 880), (0.5, 0.75, 1100, 1100), (0.75, 1, 1320, 1320)], 0.62, 0.52, 0.3, 0.01, 8)
    chirp("pip-celebrate", [(0, 0.2, 784, 784), (0.2, 0.4, 988, 988), (0.4, 0.6, 1175, 1175), (0.6, 0.85, 1568, 1568), (0.85, 1, 1175, 1175)], 0.8, 0.55, 0.4, 0.02, 11)
    chirp("pip-hologram", [(0, 1, 1320, 1760)], 0.34, 0.38, 0.6, 0.04, 15)
    chirp("scanner-progress", [(0, 1, 1200, 1320)], 0.055, 0.3, 0.15, 0, 1)

    chord("memory-recovered", [261.63, 329.63, 392.00, 523.25, 659.25], 2.4, 0.62, 0.25)
    chord("history-restored", [261.63, 329.63, 392.00, 523.25, 659.25, 783.99], 2.8, 0.62, 0.18)
    wind_loop("mars-wind")
    drone_loop("deep-space-drone")

    for name in ("pip-attention", "pip-curious", "pip-surprise", "pip-worried",
                 "pip-discovery", "pip-celebrate", "pip-hologram"):
        encode_one_shot(name, os.path.join("sfx", "pip"))
    encode_one_shot("scanner-progress", os.path.join("sfx", "scanner"))
    encode_one_shot("memory-recovered", os.path.join("sfx", "memory"))
    encode_one_shot("history-restored", os.path.join("sfx", "transmission"))
    encode_loop("mars-wind", "ambience")
    encode_loop("deep-space-drone", "ambience")

print("Generated original Cosmic Mail audio in", OUT)
