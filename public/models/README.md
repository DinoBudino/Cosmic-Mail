# Cosmic Mail — 3D model notes

| File | Origin | Use |
| --- | --- | --- |
| `astronaut-v2.glb` | Exported from `blender/AstronautV2/CosmicMail_Astronaut_Final.blend` with `blender/AstronautV2/scripts/18_export_web.py` (Blender 5.2.3). One skinned mesh (~52k triangles, rigid parts weighted to their bones), scaled to ~1.5 m, `ThrusterSocket_L/R` under the soles, 13 clips retargeted from the previous astronaut. | Player character, scanner hand mount (`HAND_R`) and clips. |
| `spaceship-cm01.glb` | Exported from `blender/Spaceship/Spaceship.blend` with `blender/Spaceship/scripts/export_web.py` (Blender 5.2.3). Nose on +Y, centred, metres; internals and blockout removed, decimated to ~70k triangles, one primitive per material. | Mailwing exterior in the main menu, the launch to Mars and landed beside the Mars landing zone (`src/game/LandedShip.tsx`). |
| `pip-v2.glb` | Exported from `blender/PIPV2/PIP_CosmicMail_Final.blend` with `blender/PIPV2/scripts/12_export_web.py` (Blender 5.2.3). All 10 visor expressions are separate mesh groups under `CTRL_FACE`. | Official PIP in onboarding, cabin, launch and Mars exploration. |
| `pip-retro-space-post.glb` | Previous PIP (`blender/PIP/`). | No longer loaded; kept for reference. |
| `cosmic-scanner.glb` | Exported from `blender/Scanner/Cosmic_Mail_Scanner_Master.blend` with `blender/Scanner/scripts/export_web.py` (Blender 5.2.3). Body merged per material (`SCN_*`), decimated to ~19k triangles; the activation button stays under `CTRL_ActivationButton_Pivot`. READY / SCANNING / SCAN_COMPLETE light levels from the .blend are animated in code. | Hand-held scanner in the astronaut's hand and first person (`src/game/CosmicScannerDevice.tsx`). |
| `mars-outcrop.glb` | Created in-house in Blender 5.2.3 LTS via the Blender MCP add-on on 2026-11-11. Low-poly stratified outcrop, two shared materials, 48 triangles. | Optional environmental outcrop scan targets. |
| `mer-rover.glb` | Mars Exploration Rover (Spirit / Opportunity share the design). Exported from `blender/Spirit/Spirit_CosmicMail_SolarCorrected.blend` by `blender/Spirit/scripts/export_web.py`: ~51k triangles, named parts for the scanner (Rover_Pancam, Rover_Mast, Rover_RAT, Rover_Arm, Rover_Solar, Rover_Wheels, Rover_Antenna, Rover_Body). The stowed instrument arm with the RAT is added by the script. | The Mars explorer (`src/game/MerRover.tsx`). |

## Notes

- `pip-v2.glb` is the PIP character asset loaded by `HubPipModel.tsx` (cabin and Mars companion). The component shows one visor expression group at a time and animates blink, talking mouth, antenna and glow.
- PIP V2's editable master, validation report and renders live in `blender/PIPV2/`.
- The astronaut and Mailwing masters live in `blender/Astronaut/` and `blender/`.
- `mars-outcrop.glb` is a small background/scannable prop, not a historical instrument or a master model.
- No video reconstruction assets are included here. Historical recreations are external production content.

## cabin-cm01.glb

Cabina de mando CM-01 Explorer (onboarding cabin + hub). Built procedurally by
`blender/CabinCM01/scripts/build_cabin.py`:

```bash
blender -b --factory-startup --python blender/CabinCM01/scripts/build_cabin.py -- --render
```

The script rebuilds `blender/CabinCM01/CabinCM01.blend`, re-exports this GLB and
writes control renders to `blender/CabinCM01/renders/`. Interactive parts
(navigation screen, main button dome, album hit area, side monitors) are mounted
in `src/game/CabinCM01.tsx` on the exported `ANCHOR_*` empties; scene placement
lives in `src/game/cabinLayout.ts`.
