# Cosmic Mail — Audio Credits, Provenance and Processing

**Sound design pass:** 2026-11-10  
**Canon:** Proposal A — *The memories that must find their way home*  
**Scope:** menu, intro/Archive fault, cabin, launch, Mars, Moon/Deep Space beds (prepared), memory, smart letter, transmission and finale.

This document is the audit trail for every shipped audio asset. The runtime
manifest is `src/game/audio/audioManifest.ts`; the public-facing copy is
`public/audio/ATTRIBUTION.md`.

---

## 1. Licence summary

| Source | Licence | Attribution | Redistribution / game use | Notes |
| --- | --- | --- | --- | --- |
| **Pixabay** (music) | [Pixabay Content License](https://pixabay.com/service/license-summary/) | Not required | Allowed in commercial/non-commercial projects, including games. The audio may not be redistributed as a standalone download. | Some tracks are registered with Content ID. See the per-track flags below. |
| **Kenney** (SFX) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Not required (credit appreciated) | Public-domain dedication; commercial use and modification allowed. | Original `License.txt` files are kept in `audio-source/kenney/`. |
| **Cosmic Mail project** (synthesised PIP chirps, wind/drone beds, memory chords) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | Not required | Original assets generated for this project. | Generator: `scripts/generate-cosmic-audio.py`. |

No commercial game soundtrack, film score, YouTube rip or unverifiable file is
used. No attribution notice from a source pack was removed.

---

## 2. Music selection

The music was selected from Pixabay by mood, movement, duration and stated
instrumentation. Each track was downloaded from the public track page, then
edited into a loop for the scene. The unedited originals are preserved in
`audio-source/music/`. Metadata captured on 2026-11-10 is in
`audio-source/pixabay/metadata.json`.

| Cue / scene | Track | Author | Source page | Content ID | Processed file | Original kept as |
| --- | --- | --- | --- | --- | --- | --- |
| Menu / intro identity | Space Retro Synthwave | OctoSound | https://pixabay.com/music/synthwave-space-retro-synthwave-563948/ | **Registered** | `public/audio/music/menu-adventure.mp3` | `audio-source/music/pixabay-space-retro-synthwave.mp3` |
| Cabin / hub / smart-letter bed | Chillin (ambient electronic) | FoggySunrise | https://pixabay.com/music/ambient-chillin-ambient-electronic-374701/ | No | `public/audio/music/cabin.mp3` | `audio-source/music/pixabay-chillin.mp3` |
| Archive fault / tension | Space Anomaly | Tim_Kulig_Free_Music | https://pixabay.com/music/ambient-space-anomaly-449102/ | **Registered** | `public/audio/music/archive-fault.mp3` | `audio-source/music/pixabay-space-anomaly.mp3` |
| Hope / clue recovered / finale | Into The Future Land (Hopeful Slow Atmospheric Meditation) | Ashot_Danielyan | https://pixabay.com/music/ambient-into-the-future-land-hopeful-slow-atmospheric-meditation-118550/ | **Registered** | `public/audio/music/hope.mp3` | `audio-source/music/pixabay-into-the-future-land.mp3` |
| Launch preparation / cinematic | Space Galaxy Universe Music | NastelBom | https://pixabay.com/music/upbeat-space-galaxy-universe-music-357376/ | **Registered** | `public/audio/music/launch-galaxy.mp3` | `audio-source/music/pixabay-space-galaxy-universe.mp3` |
| Mars exploration | Outer Space | Lesiakower | https://pixabay.com/music/synthwave-outer-space-530227/ | No | `public/audio/music/mars.mp3` | `audio-source/music/pixabay-outer-space.mp3` |
| Moon / Surveyor 3 bed (prepared) | Space Ambient | leberch | https://pixabay.com/music/ambient-space-ambient-509783/ | **Registered** | `public/audio/music/moon.mp3` | `audio-source/music/pixabay-space-ambient-509783.mp3` |
| Deep Space / Pioneer 10 bed (prepared) | Lost In Two Different Worlds — Ambient Retrowave | NaturesEye | https://pixabay.com/music/synthwave-lost-in-two-different-worlds-ambient-retrowave-172609/ | No | `public/audio/music/deep-space.mp3` | `audio-source/music/pixabay-lost-in-two-different-worlds.mp3` |
| Memory recovery / reconstruction | Space Discovery | The_Mountain | https://pixabay.com/music/pulses-space-discovery-179468/ | **Registered** | `public/audio/music/memory.mp3` | `audio-source/music/pixabay-space-discovery.mp3` |
| Transmission / resolution | Solar Bloom | Turning_Pages | https://pixabay.com/music/upbeat-solar-bloom-386734/ | No | `public/audio/music/transmission.mp3` | `audio-source/music/pixabay-solar-bloom.mp3` |

**Content ID note:** “Registered” means the Pixabay track page’s structured
metadata declared a Content ID registration on 2026-11-10. The Pixabay licence
still permits game use, but a publisher posting a trailer or gameplay video
should check claims. Tracks marked “No” did not expose that flag. This is a
practical risk note, not a change to the licence.

---

## 3. Ambient beds

| Bed | Source | Processing | File |
| --- | --- | --- | --- |
| Mars wind | Original synthesis | Filtered stereo noise with slow gusts, 10.5 s seamless loop | `public/audio/ambience/mars-wind.mp3` |
| Deep-space drone | Original synthesis | Phase-locked low partials + slow LFO, 10.5 s seamless loop | `public/audio/ambience/deep-space-drone.mp3` |

The cabin/onboarding phases intentionally have **no computer-noise bed** now:
the old `computerNoise_003` loop read as a keyboard/console chatter and fought
the soundtrack. The cabin is carried by music and interface effects only.

The Moon deliberately has **no wind bed** because the Moon has no atmosphere.
Its scene uses only the music and suit/scanner sounds.

---

## 4. Sound effects

### 4.1 Kenney packs (CC0)

Source packs and licence copies:

- Interface Sounds — https://kenney.nl/assets/interface-sounds — `audio-source/kenney/License-interface-sounds.txt`
- Sci-Fi Sounds — https://kenney.nl/assets/sci-fi-sounds — `audio-source/kenney/License-sci-fi-sounds.txt`
- Impact Sounds — https://kenney.nl/assets/impact-sounds — `audio-source/kenney/License-impact-sounds.txt`

Selected originals are in `audio-source/kenney/source/`. The source filename is
also recorded in every manifest entry.

| Category | Event family | Selected Kenney originals | Shipped files |
| --- | --- | --- | --- |
| UI | hover, click, confirm, error, open/close, page, signature, stamp, navigation, route | `click_001`, `select_002`, `confirmation_001..004`, `error_004`, `open_002/003`, `close_002/003`, `scroll_003`, `scratch_004`, `impactPlate_medium_000`, `maximize_002`, `select_004`, `confirmation_003`, `glass_006` | `public/audio/sfx/ui/` |
| Archive | activate, query, glitch, connection lost, query failed, signal recovered, fragment | `computerNoise_001`, `select_005`, `glitch_002/004`, `error_003/005`, `confirmation_004`, `pluck_001`, `glass_002` | `public/audio/sfx/archive/` |
| Ship | ignition, liftoff, transition, red button, engine prep, propulsion | `spaceEngine_001`, `thrusterFire_001`, `forceField_001`, `impactMetal_002`, `spaceEngineLow_002`, `spaceEngineLarge_001` | `public/audio/sfx/ship/` |
| Player | scanner equip/unequip, thruster start/loop, landing, footsteps | `switch_003/005`, `thrusterFire_003/004`, `impactGeneric_light_001`, `impactMetal_medium_001`, `footstep_concrete_000..003`, `footstep_snow_000..002` | `public/audio/sfx/player/` |
| Scanner | activate, target, start, loop, interrupt, fragment, already, full scan, core unlock | `forceField_001/002/004`, `laserSmall_001`, `laserRetro_001`, `engineCircular_002/004`, `error_006/002`, `confirmation_002`, `laserLarge_001` | `public/audio/sfx/scanner/` |
| Memory / letter | materialize, open, create, ready, close, reconstruction | `maximize_005/007`, `open_003`, `glass_005`, `confirmation_004`, `close_003`, `tick_002`, `minimize_007` | `public/audio/sfx/memory/` |
| Transmission | send, signal, received, stamp | `engineCircular_000`, `laserRetro_004`, `confirmation_004`, `impactBell_heavy_002` | `public/audio/sfx/transmission/` |

### 4.2 Original synthesis

These files are not from a third-party library. They are generated by
`scripts/generate-cosmic-audio.py` and dedicated to CC0:

| Asset | Purpose |
| --- | --- |
| `pip-attention`, `pip-curious`, `pip-surprise`, `pip-worried`, `pip-discovery`, `pip-celebrate`, `pip-hologram` | Small robot chirps that complement PIP’s existing Kokoro voice without adding a beep to every word. |
| `scanner-progress` | Soft half-way tick during a held scan. |
| `memory-recovered`, `history-restored` | Warm chord stings for the recovered memory and the restored history. |
| `mars-wind`, `deep-space-drone` | Seamless ambience beds. |
| `ship-solar-rumble` | Soft hull rumble with a little electric crackle when the intro's solar storm reaches Mailwing (no explosion transient). |
| `site-reveal-mars` | Landing-site title card on Mars: warm wind swell under an open chord, three soft bells as the place name appears. |
| `site-reveal-moon` | Landing-site title card on the Moon: the same chord and bells, cooler, with a soft sub swell and no wind (no air). |

PIP’s spoken lines remain the existing Kokoro recordings in
`public/audio/pip/`. The Mars exploration lines (`mars-*`) were generated with
the same approved Kokoro voice set (`af_heart` default, plus `af_sky`,
`bf_lily` and `am_michael`) and the same natural treatment; only the per-line
speed changes to match the emotional context.

---

## 5. Processing pipeline

### 5.1 Music loop preparation

For each scene, a 58–105 second section was selected from the unedited track.
The last *N* seconds are crossfaded into the first *N* seconds, then the body is
appended, giving a seamless loop of `length − N` seconds. The result is
resampled to 44.1 kHz stereo, normalised with EBU R128 (`loudnorm`) to the
scene’s target, and encoded as MP3 192 kbps.

Targets:

- menu −19 LUFS, cabin −22, archive fault −23, hope −19, launch −17,
  Mars −21, Moon −22, deep space −22, memory −18, transmission −18.
- True peak ceiling: −2 dBTP.

Command shape (the full mapping is in `scripts/process-cosmic-audio.sh`):

```bash
ffmpeg -ss START -t LENGTH -i original.mp3 -filter_complex \
  "[0:a]asplit=3[a][b][c];\
   [a]atrim=0:XF,asetpts=PTS-STARTPTS[head];\
   [b]atrim=XF:BODY_END,asetpts=PTS-STARTPTS[body];\
   [c]atrim=BODY_END:LENGTH,asetpts=PTS-STARTPTS[tail];\
   [tail][head]acrossfade=d=XF:c1=tri:c2=tri[x];\
   [x][body]concat=n=2:v=0:a=1,aresample=44100:async=1:first_pts=0,\
   asetpts=N/SR/TB[cat];[cat]loudnorm=I=TARGET:TP=-2:LRA=11[out]" \
  -map "[out]" -ar 44100 -ac 2 -c:a libmp3lame -b:a 192k public/audio/music/NAME.mp3
```

### 5.2 Sound effects

One-shots are trimmed of leading/trailing near-silence, optionally EQ’d (for
example, rocky footsteps use a 70 Hz–5.2 kHz band and a small 1.3 kHz lift),
peak-normalised to the target in the processing table, and encoded as MP3
128 kbps mono (UI/player/scanner) or stereo (ship/memory/transmission).

Continuous effects (`ship-engine-prep`, `ship-propulsion`, `scanner-loop`,
`full-scan-loop`, `transmission-start`, `thruster-loop`) use the same
crossfade-loop method with a 0.5–0.6 s overlap.

### 5.3 Verification performed

- `ffprobe` confirmed duration, sample rate, channel count and bitrate.
- `ebur128` / `astats` confirmed the integrated loudness and peak ceiling.
- Files were decoded end-to-end successfully by `ffmpeg`; no corrupt or silent
  file was shipped.
- The manifest test asserts every declared file exists and is non-empty.
- **Not performed:** human listening in a browser or headphones. This is the
  main remaining QA step; see §8.

---

## 6. Audio Manager architecture

```
src/game/audio/
  audioManifest.ts   typed assets, paths, base volumes, licences, sources
  audioSettings.ts   persisted preferences + legacy migration
  audioMath.ts       bus gains, ducking, equal-power crossfade, dedupe
  musicCues.ts       scene → cue mapping (pure and tested)
  audioEvents.ts     domain event → assets / loops / music
  audioProgress.ts   idempotent mission-progress diffing
  audioManager.ts    one AudioContext, buses, buffers, crossfades, loops
  AudioDirector.tsx  the only React bridge; scene and event orchestration
```

Graph:

```
music source → music gain ─┐
ambience source → amb. gain ─┴→ voice-duck gain → master → compressor → destination
sfx one-shots / loops → sfx gain ────────────────────────────────↗
voice bus (reserved) -----------------------------------------→↗
```

- One `AudioContext`, created only after a real user gesture.
- Music and ambience crossfade; one-shots are deduped; loops are keyed.
- PIP voice is still an `HTMLAudioElement`; its effective volume is
  `master × voice` and its playback ducks music/ambience through
  `beginVoice`/`endVoice`. The Kokoro generator is untouched.
- `document.hidden` ramps the master to zero; `dispose()` closes the context.
- Missing or undecodable files are recorded in `getLoadErrors()` and never
  break the scene.

---

## 7. Per-channel defaults

| Channel | Default | Notes |
| --- | --- | --- |
| Master | 0.85 | Applied before the limiter. |
| Music | 0.55 | Bed sits under dialogue. |
| Ambience | 0.5 | Mars and deep-space beds; no cabin computer-noise bed. |
| SFX | 0.8 | Scanner and UI transients. |
| Voice | 1.0 | Multiplied by master for the HTML voice element. |
| Mute | off | Independent of the channel values. |

Music/ambience are reduced to 62 %/55 % while Settings is open, and to 34 %
while PIP speaks. SFX and voice are not ducked.

---

## 8. Human audition checklist

The files were selected and processed automatically. A human should still:

1. Play the full intro and confirm the menu→fault→hope crossfades are not
   abrupt and that the glitch does not mask PIP.
2. Complete a Spirit scan and verify the scanner hum stops on release, target
   loss and completion.
3. Complete the full scan, prepare the letter, watch the reconstruction and
   transmit from Mailwing; confirm the transmission sequence is not clipped and
   the stamp arrives after the send effect.
4. Walk, run and jet-pack on Mars; confirm footstep cadence and that the
   thruster loop stops on landing or pause.
5. Open Settings and move each slider while music, ambience and PIP are
   playing; confirm immediate response and no clipping.
6. Check the six Content ID-registered tracks if a trailer or gameplay video
   will be published.
7. Listen on headphones for loop seams in `menu`, `cabin`, `mars`, `moon`,
   `deep-space` and `memory`.

---

## 9. Replacing a resource

1. Put the new source file in `audio-source/` and record its licence, author,
   URL and consultation date.
2. Process it with the commands in §5, or drop a ready file into the matching
   `public/audio/...` path.
3. Update the corresponding entry in `src/game/audio/audioManifest.ts`
   (`src`, `volume`, `license`, `source`, `contentIdRisk`).
4. If the file name changes, update the scene map in `musicCues.ts` or the
   event map in `audioEvents.ts`.
5. Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.
6. Update this file and `public/audio/ATTRIBUTION.md`.

No component needs to change: components emit domain events and the director
chooses the cue.

---

## 10. Known limitations / pending decisions

- No human listening pass was possible in this environment. Mix balances are
  conservative and should be validated on speakers and headphones.
- Loop points were created with crossfades; they should be auditioned for
  musical continuity, especially the long ambient beds.
- Moon and Deep Space music/ambience are prepared in the manifest but are not
  connected to a playable world because those missions are not playable yet.
- The historical reconstruction still uses the existing scripted sequence; its
  audio is limited to a start/line/end cue plus the existing PIP voice.
- The six Content ID-registered Pixabay tracks are licence-compatible but carry
  video-claim risk; replace them if the project needs a zero-risk trailer.
- Low Orbit is retired from the active soundtrack (kept in `audio-source/` for
  provenance); Space Retro Synthwave now carries the menu/intro identity.
- The old `public/audio/music/cabin-ambience*.mp3` files were retired and
  removed from the project on 2026-11-15; nothing referenced them.
