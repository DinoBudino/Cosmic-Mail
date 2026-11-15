# Cosmic Mail

**The Memories That Must Find Their Way Home**

Cosmic Mail is a cozy 3D exploration game about restoring the stories of NASA's historic explorers. Travel to the Moon and Mars, scan real spacecraft, such as Surveyor 3, Apollo 11, Viking, Spirit and Opportunity, and deliver their lost memories back home.

Made by **Neuroagames**.

## Controls

| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| `Shift` | Run |
| `E` | Interact |
| `Q` | Scanner |

## Run locally

Requires **Node.js 22.12+**.

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (usually http://localhost:5173).

Other scripts:

```bash
npm run build      # production build in dist/
npm run preview    # preview the production build
npm test           # run tests
```

## Built with

React, Three.js (React Three Fiber), TypeScript, Vite and Zustand.

## Credits and sources

### Mission history and images

Mission facts, photos and footage come from NASA. NASA material is generally not subject to copyright in the United States. Credits shown in the game follow NASA's own (NASA, NASA/JPL, NASA/JPL-Caltech, NASA/GSFC/Arizona State University, NASA/JPL-Caltech/UArizona). Use of NASA material does not imply NASA endorsement.

The story videos for each explorer were edited by the team for the game's narrative from NASA imagery and footage. The credits shown on screen belong to the original NASA material, and the album photos are stills from those videos.

- **Surveyor 3**: [NASA Science: Surveyor 3](https://science.nasa.gov/mission/surveyor-3/) · [NASA: Apollo 12](https://www.nasa.gov/mission/apollo-12/) · [NSSDCA 1967-035A](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-035A)
- **Apollo 11 / Eagle**: [NASA: Apollo 11](https://www.nasa.gov/mission/apollo-11/) · [NSSDCA 1969-059C](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C) · [The Eagle Prepares to Land](https://www.nasa.gov/image-article/eagle-prepares-land/) · [Apollo 11 mission log](https://www.nasa.gov/wp-content/uploads/static/history/ap11ann/apollo11_log/log.htm) · [Chariots for Apollo (SP-4205)](https://www.nasa.gov/wp-content/uploads/2023/03/sp-4205.pdf) · [Descent Propulsion System report](https://ntrs.nasa.gov/citations/19730011150) · [Apollo 11 Plaque](https://science.nasa.gov/resource/apollo-11-plaque/) · [LM Landing Gear report](https://ntrs.nasa.gov/api/citations/19730010151/downloads/19730010151.pdf)
- **Viking 1**: [NASA Science: Viking 1](https://science.nasa.gov/mission/viking-1/) · [NSSDCA 1975-075C](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C) · [PIA00381: First photograph on Mars](https://photojournal.jpl.nasa.gov/catalog/PIA00381)
- **Spirit**: [NASA Science: Spirit](https://science.nasa.gov/mission/mer-spirit/) · [Evidence of wetter past (2007)](https://www.jpl.nasa.gov/news/mars-rover-spirit-unearths-surprise-evidence-of-wetter-past/) · [NASA concludes contact attempts (2011)](https://www.jpl.nasa.gov/news/nasa-concludes-attempts-to-contact-mars-rover-spirit/)
- **Opportunity**: [NASA Science: Opportunity](https://science.nasa.gov/mission/mer-opportunity/) · [Meridiani Planum was wet (2004)](https://www.jpl.nasa.gov/news/opportunity-rover-finds-strong-evidence-meridiani-planum-was-wet/) · [Mineral vein deposited by water (2011)](https://www.jpl.nasa.gov/news/nasa-mars-rover-finds-mineral-vein-deposited-by-water/) · [Opportunity's selfie (2014)](https://www.jpl.nasa.gov/news/nasa-rover-opportunitys-selfie-shows-clean-machine/)

### Music ([Pixabay Content License](https://pixabay.com/service/license-summary/))

| Track | Author |
| --- | --- |
| [Space Retro Synthwave](https://pixabay.com/music/synthwave-space-retro-synthwave-563948/) | OctoSound |
| [Chillin](https://pixabay.com/music/ambient-chillin-ambient-electronic-374701/) | FoggySunrise |
| [Space Anomaly](https://pixabay.com/music/ambient-space-anomaly-449102/) | Tim_Kulig_Free_Music |
| [Into The Future Land](https://pixabay.com/music/ambient-into-the-future-land-hopeful-slow-atmospheric-meditation-118550/) | Ashot_Danielyan |
| [Space Galaxy Universe Music](https://pixabay.com/music/upbeat-space-galaxy-universe-music-357376/) | NastelBom |
| [Outer Space](https://pixabay.com/music/synthwave-outer-space-530227/) | Lesiakower |
| [Space Ambient](https://pixabay.com/music/ambient-space-ambient-509783/) | leberch |
| [Lost In Two Different Worlds](https://pixabay.com/music/synthwave-lost-in-two-different-worlds-ambient-retrowave-172609/) | NaturesEye |
| [Space Discovery](https://pixabay.com/music/pulses-space-discovery-179468/) | The_Mountain |
| [Solar Bloom](https://pixabay.com/music/upbeat-solar-bloom-386734/) | Turning_Pages |

### Sound effects and voice

- Sound effects: [Kenney](https://kenney.nl) ([Interface Sounds](https://kenney.nl/assets/interface-sounds), [Sci-Fi Sounds](https://kenney.nl/assets/sci-fi-sounds), [Impact Sounds](https://kenney.nl/assets/impact-sounds)), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- PIP robot chirps, ambience beds and memory chords: original synthesis by the team (`scripts/generate-cosmic-audio.py`), CC0.
- PIP's voice: generated with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) text-to-speech (Kokoro-82M, Apache 2.0).

### 3D models and textures

- Astronaut, PIP, Mailwing, scanner, cabin, Surveyor 3, Apollo 11 Eagle, Viking 1 and the Mars rover were modelled by the team in [Blender](https://www.blender.org).
- Mars ground and rock textures: original procedural artwork (`scripts/build-mars-surface.py`).
- Earth, Moon and Mars planet models: free models from [TurboSquid](https://www.turbosquid.com) ("earth", "High Quality 4k Moon Model" and "Mars Photorealistic 2K"), used under the [TurboSquid 3D Model License](https://blog.turbosquid.com/turbosquid-3d-model-license/). The Moon's surface colour comes from the [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) (LRO / LROC data).

### Libraries

[React](https://react.dev), [Three.js](https://threejs.org), [React Three Fiber](https://r3f.docs.pmnd.rs), [drei](https://github.com/pmndrs/drei), [postprocessing](https://github.com/pmndrs/postprocessing), [Zustand](https://github.com/pmndrs/zustand) and [Vite](https://vite.dev), all under the MIT license.