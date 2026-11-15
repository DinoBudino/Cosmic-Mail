#!/usr/bin/env python3
"""Generate Cosmic Mail's original CC0 audio assets.

Run from the repository root:

    python3 scripts/generate-cosmic-audio.py
    python3 scripts/generate-cosmic-audio.py ship-solar-rumble   # only some assets

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
import sys
import tempfile
import wave

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")
random.seed(20261110)
# Optional asset names on the command line: only those are rebuilt.
ONLY = set(sys.argv[1:])


def want(name: str) -> bool:
    return not ONLY or name in ONLY


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


def solar_rumble(name: str, duration=1.9, peak=0.62) -> None:
    """The solar storm reaching Mailwing: a deep, soft hull rumble with a
    little electric crackle. Rounded attack and no high transient, so it
    reads as a tremor, never as an explosion."""
    rnd = random.Random(4242)
    count = int(duration * SR)
    lp1 = lp2 = 0.0
    hp_prev = hp_out = 0.0
    values = []
    for index in range(count):
        t = index / SR
        env = envelope(t, 0.05, duration - 0.05, 1.7)
        white = rnd.uniform(-1, 1)
        # Two-pole low-pass noise: the hull rumble.
        lp1 = lp1 * 0.992 + white * 0.008
        lp2 = lp2 * 0.985 + lp1 * 0.015
        rumble = lp2 * 9.0
        # Sub tones sliding slightly down, with a slow beat.
        drop = 1.0 - 0.18 * (t / duration)
        tone = (math.sin(2 * math.pi * 41 * drop * t) * 0.55
                + math.sin(2 * math.pi * 62 * drop * t + 0.6) * 0.3)
        tone *= 0.75 + 0.25 * math.sin(2 * math.pi * 7 * t)
        # Sparse, quiet electric crackle in the first part.
        hp_out = 0.6 * (hp_out + white - hp_prev)
        hp_prev = white
        crackle = 0.0
        if t < 1.2 and rnd.random() < 0.0035:
            crackle = rnd.uniform(0.4, 0.9) * (1 if rnd.random() < 0.5 else -1)
        values.append(env * (rumble * 0.6 + tone * 0.5) + crackle * hp_out * 0.035 * (1.2 - t))
    write_wav(os.path.join(TEMP, name + ".wav"), normalize(values, peak))


def site_reveal(name: str, airy: bool, duration=4.2, peak=0.6) -> None:
    """The landing-site title card. Mars: a warm wind swell under an open,
    hopeful chord and three soft bells as the place name appears. Moon: the
    same chord and bells, cooler and with no wind, because there is no air
    to carry it. Gentle attack, no percussion, no pitch drop."""
    rnd = random.Random(7070 if airy else 7171)
    count = int(duration * SR)
    pad = [146.83, 220.00, 293.66, 329.63] if airy else [130.81, 196.00, 293.66, 493.88]
    bells = [(0.55, 880.0), (0.85, 1174.66), (1.15, 1318.51)] if airy else \
            [(0.55, 987.77), (0.85, 1318.51), (1.15, 1567.98)]
    lp1 = lp2 = 0.0
    values = []
    for index in range(count):
        t = index / SR
        # Slow swell in and a long release.
        swell = min(1.0, t / 0.9) ** 1.5 * max(0.0, 1.0 - max(0.0, t - 2.0) / (duration - 2.0)) ** 1.6
        value = 0.0
        for offset, frequency in enumerate(pad):
            detune = 1.0 + 0.0015 * math.sin(2 * math.pi * (0.3 + offset * 0.11) * t)
            value += math.sin(2 * math.pi * frequency * detune * t + offset) * (0.5 if offset == 0 else 0.32)
        value *= swell * 0.55
        if airy:
            # Wind: band-limited noise whose brightness rises with the swell.
            white = rnd.uniform(-1, 1)
            k = 0.004 + 0.018 * swell
            lp1 = lp1 * (1 - k) + white * k
            lp2 = lp2 * 0.96 + lp1 * 0.04
            value += lp2 * 4.5 * swell
        else:
            # A deep, soft sub swell instead of wind.
            value += math.sin(2 * math.pi * 55 * t) * swell * 0.35
        for start, frequency in bells:
            if t >= start:
                u = t - start
                ring = math.exp(-u * (2.2 if airy else 1.4))
                value += (math.sin(2 * math.pi * frequency * u)
                          + 0.25 * math.sin(2 * math.pi * frequency * 2.01 * u)) * ring * min(1.0, u / 0.006) * 0.28
        values.append(value)
    write_wav(os.path.join(TEMP, name + ".wav"), normalize(values, peak))


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
    if want("pip-attention"):
        chirp("pip-attention", [(0, 1, 740, 1180)], 0.16, 0.55, 0.45, 0.02, 9)
    if want("pip-curious"):
        chirp("pip-curious", [(0, 0.35, 620, 980), (0.35, 0.7, 980, 820), (0.7, 1, 820, 1120)], 0.38, 0.5, 0.4, 0.015, 7)
    if want("pip-surprise"):
        chirp("pip-surprise", [(0, 0.45, 520, 1640), (0.45, 0.75, 1640, 1080), (0.75, 1, 1080, 1480)], 0.30, 0.58, 0.35, 0.02, 10)
    if want("pip-worried"):
        chirp("pip-worried", [(0, 0.4, 880, 720), (0.4, 0.75, 660, 560), (0.75, 1, 560, 500)], 0.46, 0.48, 0.3, 0.03, 5)
    if want("pip-discovery"):
        chirp("pip-discovery", [(0, 0.25, 660, 660), (0.25, 0.5, 880, 880), (0.5, 0.75, 1100, 1100), (0.75, 1, 1320, 1320)], 0.62, 0.52, 0.3, 0.01, 8)
    if want("pip-celebrate"):
        chirp("pip-celebrate", [(0, 0.2, 784, 784), (0.2, 0.4, 988, 988), (0.4, 0.6, 1175, 1175), (0.6, 0.85, 1568, 1568), (0.85, 1, 1175, 1175)], 0.8, 0.55, 0.4, 0.02, 11)
    if want("pip-hologram"):
        chirp("pip-hologram", [(0, 1, 1320, 1760)], 0.34, 0.38, 0.6, 0.04, 15)
    if want("scanner-progress"):
        chirp("scanner-progress", [(0, 1, 1200, 1320)], 0.055, 0.3, 0.15, 0, 1)

    if want("memory-recovered"):
        chord("memory-recovered", [261.63, 329.63, 392.00, 523.25, 659.25], 2.4, 0.62, 0.25)
    if want("history-restored"):
        chord("history-restored", [261.63, 329.63, 392.00, 523.25, 659.25, 783.99], 2.8, 0.62, 0.18)
    if want("mars-wind"):
        wind_loop("mars-wind")
    if want("deep-space-drone"):
        drone_loop("deep-space-drone")
    if want("ship-solar-rumble"):
        solar_rumble("ship-solar-rumble")
    if want("site-reveal-mars"):
        site_reveal("site-reveal-mars", True)
    if want("site-reveal-moon"):
        site_reveal("site-reveal-moon", False)

    for name in ("pip-attention", "pip-curious", "pip-surprise", "pip-worried",
                 "pip-discovery", "pip-celebrate", "pip-hologram"):
        if want(name):
            encode_one_shot(name, os.path.join("sfx", "pip"))
    if want("scanner-progress"):
        encode_one_shot("scanner-progress", os.path.join("sfx", "scanner"))
    if want("memory-recovered"):
        encode_one_shot("memory-recovered", os.path.join("sfx", "memory"))
    if want("history-restored"):
        encode_one_shot("history-restored", os.path.join("sfx", "transmission"))
    if want("mars-wind"):
        encode_loop("mars-wind", "ambience")
    if want("deep-space-drone"):
        encode_loop("deep-space-drone", "ambience")
    if want("ship-solar-rumble"):
        encode_one_shot("ship-solar-rumble", os.path.join("sfx", "ship"))
    for name in ("site-reveal-mars", "site-reveal-moon"):
        if want(name):
            encode_one_shot(name, os.path.join("sfx", "ui"))

print("Generated original Cosmic Mail audio in", OUT)
