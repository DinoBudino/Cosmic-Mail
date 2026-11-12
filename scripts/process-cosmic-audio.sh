#!/usr/bin/env bash
# Reproduce Cosmic Mail's processed audio from the preserved originals.
# Requires ffmpeg. Run from the repository root:
#   bash scripts/process-cosmic-audio.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KENNEY="$ROOT/audio-source/kenney/source"
MUSIC_SRC="$ROOT/audio-source/music"
MUSIC_OUT="$ROOT/public/audio/music"
SFX_OUT="$ROOT/public/audio/sfx"

mkdir -p "$MUSIC_OUT"
mkdir -p "$ROOT/public/audio/ambience"
mkdir -p "$SFX_OUT"/{pip,ui,archive,ship,player,scanner,memory,transmission}

loop_music() {
  local src="$1" out="$2" start="$3" length="$4" xf="$5" lufs="$6"
  local body_end=$((length - xf))
  ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$length" -i "$src" \
    -filter_complex "[0:a]asplit=3[a][b][c];\
[a]atrim=0:${xf},asetpts=PTS-STARTPTS[head];\
[b]atrim=${xf}:${body_end},asetpts=PTS-STARTPTS[body];\
[c]atrim=${body_end}:${length},asetpts=PTS-STARTPTS[tail];\
[tail][head]acrossfade=d=${xf}:c1=tri:c2=tri[x];\
[x][body]concat=n=2:v=0:a=1,aresample=44100:async=1:first_pts=0,\
asetpts=N/SR/TB[cat];[cat]loudnorm=I=${lufs}:TP=-2:LRA=11[out]" \
    -map "[out]" -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k "$out"
}

sfx() {
  local src="$1" out="$2" peak="$3" channels="$4" filter="${5:-anull}"
  local start="${6:-0}" length="${7:-}"
  local tmp
  tmp="$(mktemp --suffix=.wav)"
  local trim="silenceremove=start_periods=1:start_silence=0.008:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_silence=0.008:start_threshold=-55dB,areverse"
  local args=(-hide_banner -loglevel error -y -ss "$start" -i "$src")
  if [[ -n "$length" ]]; then args+=(-t "$length"); fi
  ffmpeg "${args[@]}" -af "${filter},${trim}" -ar 44100 -ac "$channels" "$tmp"
  local measured
  measured=$(ffmpeg -hide_banner -nostats -i "$tmp" -af astats=metadata=1:reset=0 -f null - 2>&1 \
    | awk '/Peak level dB:/{v=$NF} END{print v}')
  local gain
  gain=$(awk -v p="$peak" -v m="$measured" 'BEGIN{printf "%.2f", p-m}')
  ffmpeg -hide_banner -loglevel error -y -i "$tmp" -af "volume=${gain}dB" \
    -ar 44100 -ac "$channels" -c:a libmp3lame -b:a 128k "$out"
  rm -f "$tmp"
}

# ---------------------------------------------------------------- music loops
loop_music "$MUSIC_SRC/pixabay-space-retro-synthwave.mp3"        "$MUSIC_OUT/menu-adventure.mp3" 10 95 4 -19
loop_music "$MUSIC_SRC/pixabay-chillin.mp3"                      "$MUSIC_OUT/cabin.mp3"          8  77 3 -22
loop_music "$MUSIC_SRC/pixabay-space-anomaly.mp3"                "$MUSIC_OUT/archive-fault.mp3" 20  62 4 -23
loop_music "$MUSIC_SRC/pixabay-into-the-future-land.mp3"         "$MUSIC_OUT/hope.mp3"          20  90 4 -19
loop_music "$MUSIC_SRC/pixabay-space-galaxy-universe.mp3"        "$MUSIC_OUT/launch-galaxy.mp3" 10 105 4 -17
loop_music "$MUSIC_SRC/pixabay-outer-space.mp3"                  "$MUSIC_OUT/mars.mp3"          10 100 4 -21
loop_music "$MUSIC_SRC/pixabay-space-ambient-509783.mp3"         "$MUSIC_OUT/moon.mp3"          40 100 5 -22
loop_music "$MUSIC_SRC/pixabay-lost-in-two-different-worlds.mp3" "$MUSIC_OUT/deep-space.mp3"    60 110 5 -22
loop_music "$MUSIC_SRC/pixabay-space-discovery.mp3"              "$MUSIC_OUT/memory.mp3"         5  70 4 -18
loop_music "$MUSIC_SRC/pixabay-solar-bloom.mp3"                  "$MUSIC_OUT/transmission.mp3"  15 100 4 -18

# ------------------------------------------------------------------- UI / SFX
sfx "$KENNEY/click_002.ogg"     "$SFX_OUT/ui/ui-hover-low.mp3"  -12 1 "highpass=f=130,lowpass=f=2200"
sfx "$KENNEY/select_002.ogg"    "$SFX_OUT/ui/ui-click-low.mp3"   -7 1 "asetrate=44100*0.55,aresample=44100,atempo=1.818,lowpass=f=2600,highpass=f=130"
sfx "$KENNEY/confirmation_001.ogg" "$SFX_OUT/ui/ui-confirm.mp3"  -5 1
sfx "$KENNEY/confirmation_002.ogg" "$SFX_OUT/ui/ui-confirm-soft.mp3" -6 1 "lowpass=f=9000"
sfx "$KENNEY/error_004.ogg"     "$SFX_OUT/ui/ui-error.mp3"       -6 1
sfx "$KENNEY/back_001.ogg"      "$SFX_OUT/ui/ui-back.mp3"        -8 1
sfx "$KENNEY/toggle_001.ogg"    "$SFX_OUT/ui/ui-toggle.mp3"      -7 1
sfx "$KENNEY/switch_003.ogg"    "$SFX_OUT/ui/ui-open-warm.mp3"   -7 1 "highpass=f=120,lowpass=f=2800,afade=t=out:st=0.17:d=0.05" 0 0.22
sfx "$KENNEY/switch_005.ogg"    "$SFX_OUT/ui/ui-close-warm.mp3"  -8 1 "highpass=f=120,lowpass=f=2600,afade=t=out:st=0.17:d=0.05" 0 0.22
sfx "$KENNEY/scroll_003.ogg"    "$SFX_OUT/ui/ui-page-turn.mp3"   -8 1 "highpass=f=180,lowpass=f=7000" 0 0.55
sfx "$KENNEY/scratch_004.ogg"   "$SFX_OUT/ui/ui-signature.mp3"   -9 1 "highpass=f=200,lowpass=f=6500"
sfx "$KENNEY/impactPlate_medium_000.ogg" "$SFX_OUT/ui/ui-stamp.mp3" -4 1 "lowpass=f=6500"
sfx "$KENNEY/maximize_002.ogg"  "$SFX_OUT/ui/ui-nav-open.mp3"    -6 1
sfx "$KENNEY/select_004.ogg"    "$SFX_OUT/ui/ui-select.mp3"      -7 1 "highpass=f=250"
sfx "$KENNEY/confirmation_003.ogg" "$SFX_OUT/ui/ui-route-confirm.mp3" -5 1
sfx "$KENNEY/glass_006.ogg"     "$SFX_OUT/ui/ui-hologram.mp3"    -8 1 "highpass=f=500"

# Archive
sfx "$KENNEY/computerNoise_001.ogg" "$SFX_OUT/archive/archive-activate.mp3" -7 1 "highpass=f=120,lowpass=f=6000" 0 1.6
sfx "$KENNEY/select_005.ogg"    "$SFX_OUT/archive/archive-query.mp3" -7 1 "highpass=f=250"
sfx "$KENNEY/glitch_004.ogg"    "$SFX_OUT/archive/archive-glitch.mp3" -6 1
sfx "$KENNEY/glitch_002.ogg"    "$SFX_OUT/archive/archive-glitch-soft.mp3" -8 1
sfx "$KENNEY/error_005.ogg"     "$SFX_OUT/archive/archive-query-failed.mp3" -6 1 "lowpass=f=8000"
sfx "$KENNEY/confirmation_004.ogg" "$SFX_OUT/archive/archive-signal-recovered.mp3" -5 1
sfx "$KENNEY/pluck_001.ogg"     "$SFX_OUT/archive/archive-fragment.mp3" -7 1
sfx "$KENNEY/glass_002.ogg"     "$SFX_OUT/archive/archive-fragment-identified.mp3" -7 1
sfx "$KENNEY/error_003.ogg"     "$SFX_OUT/archive/archive-connection-lost.mp3" -5 1 "lowpass=f=8500"

# Ship
sfx "$KENNEY/spaceEngine_001.ogg" "$SFX_OUT/ship/ship-ignition.mp3" -5 2 "lowpass=f=12000" 0 2.2
sfx "$KENNEY/thrusterFire_001.ogg" "$SFX_OUT/ship/ship-liftoff.mp3" -4 2 "lowpass=f=14000" 0 2.8
sfx "$KENNEY/forceField_001.ogg" "$SFX_OUT/ship/ship-space-transition.mp3" -5 2
sfx "$KENNEY/impactMetal_002.ogg" "$SFX_OUT/ship/ship-red-button.mp3" -4 2 "lowpass=f=9000"

# Player
sfx "$KENNEY/switch_003.ogg"    "$SFX_OUT/player/scanner-equip.mp3" -6 1 "highpass=f=250"
sfx "$KENNEY/switch_005.ogg"    "$SFX_OUT/player/scanner-unequip.mp3" -7 1 "highpass=f=250"
sfx "$KENNEY/thrusterFire_003.ogg" "$SFX_OUT/player/thruster-start.mp3" -6 2 "lowpass=f=12000" 0 0.9
sfx "$KENNEY/impactGeneric_light_001.ogg" "$SFX_OUT/player/landing.mp3" -6 2 "lowpass=f=7000"
sfx "$KENNEY/impactMetal_medium_001.ogg" "$SFX_OUT/player/landing-metal.mp3" -7 2 "lowpass=f=8000"
for i in 0 1 2 3; do
  sfx "$KENNEY/footstep_concrete_00$i.ogg" "$SFX_OUT/player/footstep-rock-$((i+1)).mp3" -9 1 \
    "highpass=f=70,lowpass=f=5200,equalizer=f=1300:t=q:w=1:g=2"
done
for i in 0 1 2; do
  sfx "$KENNEY/footstep_snow_00$i.ogg" "$SFX_OUT/player/footstep-lunar-$((i+1)).mp3" -10 1 \
    "highpass=f=80,lowpass=f=2600"
done

# Scanner
sfx "$KENNEY/forceField_002.ogg" "$SFX_OUT/scanner/scanner-activate.mp3" -5 1 "highpass=f=100" 0 0.7
sfx "$KENNEY/laserSmall_001.ogg" "$SFX_OUT/scanner/scanner-target.mp3" -8 1
sfx "$KENNEY/laserRetro_001.ogg" "$SFX_OUT/scanner/scanner-start.mp3" -7 1
sfx "$KENNEY/error_006.ogg"     "$SFX_OUT/scanner/scanner-interrupt.mp3" -7 1 "lowpass=f=7000"
sfx "$KENNEY/confirmation_002.ogg" "$SFX_OUT/scanner/scanner-fragment.mp3" -5 1
sfx "$KENNEY/error_002.ogg"     "$SFX_OUT/scanner/scanner-already.mp3" -8 1
sfx "$KENNEY/forceField_004.ogg" "$SFX_OUT/scanner/full-scan-init.mp3" -5 2 anull 0 0.85
sfx "$KENNEY/forceField_001.ogg" "$SFX_OUT/scanner/full-scan-complete.mp3" -4 2
sfx "$KENNEY/laserLarge_001.ogg" "$SFX_OUT/scanner/core-unlock.mp3" -5 2

# Memory / letter
sfx "$KENNEY/maximize_005.ogg"  "$SFX_OUT/memory/letter-materialize.mp3" -6 2
sfx "$KENNEY/open_003.ogg"      "$SFX_OUT/memory/letter-open.mp3" -6 2
sfx "$KENNEY/glass_005.ogg"     "$SFX_OUT/memory/letter-create.mp3" -7 2
sfx "$KENNEY/confirmation_004.ogg" "$SFX_OUT/memory/letter-ready.mp3" -5 2
sfx "$KENNEY/close_003.ogg"     "$SFX_OUT/memory/letter-close.mp3" -6 2
sfx "$KENNEY/maximize_007.ogg"  "$SFX_OUT/memory/reconstruction-start.mp3" -7 2
sfx "$KENNEY/tick_002.ogg"      "$SFX_OUT/memory/reconstruction-line.mp3" -12 2
sfx "$KENNEY/minimize_007.ogg"  "$SFX_OUT/memory/reconstruction-end.mp3" -7 2

# Transmission
sfx "$KENNEY/laserRetro_004.ogg" "$SFX_OUT/transmission/transmission-signal.mp3" -6 2
sfx "$KENNEY/confirmation_004.ogg" "$SFX_OUT/transmission/transmission-received.mp3" -4 2
sfx "$KENNEY/impactBell_heavy_002.ogg" "$SFX_OUT/transmission/stamp-earned.mp3" -4 2 "lowpass=f=10000"

# Continuous effects use the same loop helper as music, with short crossfades.
loop_effect() {
  local src="$1" out="$2" lufs="$3" length="$4" xf="$5" filter="$6"
  local body_end
  body_end=$(awk -v a="$length" -v b="$xf" 'BEGIN{print a-b}')
  ffmpeg -hide_banner -loglevel error -y -t 5 -i "$src" -filter_complex \
    "[0:a]asplit=3[a][b][c];[a]atrim=0:${xf},asetpts=PTS-STARTPTS[head];\
[b]atrim=${xf}:${body_end},asetpts=PTS-STARTPTS[body];\
[c]atrim=${body_end}:${length},asetpts=PTS-STARTPTS[tail];\
[tail][head]acrossfade=d=${xf}:c1=tri:c2=tri[x];\
[x][body]concat=n=2:v=0:a=1,${filter},aresample=44100:async=1:first_pts=0,\
asetpts=N/SR/TB,loudnorm=I=${lufs}:TP=-2:LRA=7[out]" \
    -map "[out]" -ar 44100 -ac 2 -c:a libmp3lame -b:a 160k "$out"
}

loop_effect "$KENNEY/spaceEngineLow_002.ogg" "$SFX_OUT/ship/ship-engine-prep.mp3" -22 4.4 0.6 "lowpass=f=9000"
loop_effect "$KENNEY/spaceEngineLarge_001.ogg" "$SFX_OUT/ship/ship-propulsion.mp3" -20 4.4 0.6 "lowpass=f=12000"
loop_effect "$KENNEY/engineCircular_002.ogg" "$SFX_OUT/scanner/scanner-loop.mp3" -22 4.4 0.6 "highpass=f=180,lowpass=f=8000"
loop_effect "$KENNEY/engineCircular_004.ogg" "$SFX_OUT/scanner/full-scan-loop.mp3" -21 4.4 0.6 "highpass=f=120,lowpass=f=9000"
loop_effect "$KENNEY/engineCircular_000.ogg" "$SFX_OUT/transmission/transmission-start.mp3" -21 4.4 0.6 "highpass=f=100,lowpass=f=9000"
loop_effect "$KENNEY/thrusterFire_004.ogg" "$SFX_OUT/player/thruster-loop.mp3" -20 4.0 0.5 "lowpass=f=12000"

echo "Processed music and Kenney SFX."
