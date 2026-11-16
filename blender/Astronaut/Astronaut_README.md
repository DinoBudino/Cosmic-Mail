# Astronauta Mensajero — Retro Space Post

Production character package for **Cosmic Mail**, built and refined in Blender 5.2.

| File | Purpose |
|---|---|
| `Astronaut_RetroSpacePost.blend` | Editable final master: character, continuous torso, boot thrusters, rig, materials and 13 actions |
| `Astronaut_RetroSpacePost.glb` | Final runtime glTF 2.0 binary |
| `Astronaut_verify_glb.py` | Independent GLB re-import, sockets/nozzles, rig/clip/material validation and previews |
| `Astronaut_validation.json` | Technical validation report for the shipped GLB |
| `Astronaut_candidate_validation.json` | Validation of the refined candidate `.blend` before thrusters (body refinement history) |
| `Astronaut_torso_report.json` | Report of the continuous-torso rebuild |
| `previews/` | Final front, 3/4, side, back, sole, bottom, flight, pose and GLB re-import renders |
| `provisional/` | First full astronaut version, kept only as a fallback |

The runtime copy is **`public/models/astronaut.glb`** (identical to the GLB in this folder).

---

## 1. Coordinate convention and scale

- **Blender:** Z up, character forward **`-Y`**, character left `+X`.
- **glTF / three.js:** Y up, character forward **`+Z`**.
- The game wrapper in `src/game/AstronautModel.tsx` applies one documented **180° Y rotation**, so the character faces the controller's expected `-Z`.
- **Root origin:** ground level `(0, 0, 0)`.
- **Height:** **1.502 m** including the antenna.
- **Scale:** 1 Blender unit = 1 metre.

---

## 2. Final asset measurements

| Metric | Value |
|---|---:|
| Height | 1.502 m |
| Triangles | 35,320 |
| Authored meshes | 13 (7 suit/gear + 6 boot-thruster components) |
| Materials | 15 |
| Bones | 27 (original 25 + 2 functional thruster socket joints) |
| Animation clips | 13 |
| GLB size | 2,001,216 bytes |
| Runtime FPS | 30 |

The silhouette uses slimmer limbs, cleaned wrist/knee rings and a **single continuous torso** built as a 64 × 30 smooth loft with normalized `Hips` / `Spine` / `UpperBody` weights. The original 25 bones keep their names and hierarchy. Two socket bones, `ThrusterSocket_L` and `ThrusterSocket_R`, were added under `Foot_L` and `Foot_R`.

The helmet, visor, antenna, scarf, postal backpack, harness, insignias, gloves and boot silhouette retain the approved Retro Space Post design. The visor is fully opaque and no face/head geometry exists.

---

## 3. Integrated boot thrusters

Each boot has a real recess cut into the sole. Inside it:

- `AST_ThrusterHousing_L/R` — dark recessed housing/cavity.
- `AST_ThrusterRing_L/R` — soft gold outer ring.
- `AST_ThrusterCore_L/R` — small recessed warm-amber emissive core.

The nozzle geometry is rigidly skinned 100% to `Foot_L` / `Foot_R`. The outer ring sits at about 1.5 mm above the normal sole contact plane, so it is visible from below without protruding through the ground. The sole remains the walking contact surface.

The GLB contains **no permanent flames or particles**. Runtime exhaust belongs in the consuming app and attaches to the two sockets.

### Socket implementation

Bone-parented Empty sockets were tested and preserved the hierarchy but **not the required orientation through Blender's Y-up glTF conversion**. The supported fallback from the specification was used:

- `ThrusterSocket_L` — child of `Foot_L`.
- `ThrusterSocket_R` — child of `Foot_R`.
- Exact node names preserved through GLB export and re-import.
- Rest orientation: local **`-Z`** points down in Blender and down in the exported glTF (`-Y` in Three.js world).
- Both sockets follow the animated feet during `Walk`, `Run`, `Takeoff`, `Flying` and `Landing`.

The runtime effect should use each socket's world transform and its verified local `-Z` exhaust axis.

---

## 4. Animations

| Clip | Duration |
|---|---:|
| `Idle` | 2.0 s |
| `Walk` | 0.8 s |
| `Run` | 0.6 s |
| `Turn_Left` | 0.5 s |
| `Turn_Right` | 0.5 s |
| `Jump` | 0.9 s |
| `Interact` | 1.2 s |
| `Wave` | 1.5 s |
| `PickUp` | 1.3 s |
| `Celebrate` | 1.7 s |
| `Takeoff` | 0.8 s |
| `Flying` | 1.2 s |
| `Landing` | 0.8 s |

`Idle`, `Walk`, `Run` and `Flying` loop seamlessly (measured seam delta `0.0`). The flight clips are in-place: the existing controller owns world translation. `Takeoff` and `Landing` were vertically ground-clamped internally so their boot poses never sink through the floor.

---

## 5. Validation

Run the independent GLB check:

```bash
blender --background --python blender/Astronaut/Astronaut_verify_glb.py
```

It re-imports `Astronaut_RetroSpacePost.glb` into a fresh scene and verifies:

- glTF 2.0 header, 27 joints, 13 named clips and skinning.
- Height 1.502 m and feet at ground level.
- Loop seams for `Idle`, `Walk`, `Run` and `Flying`.
- Ground contact for all clips, including nozzle clearance.
- `ThrusterSocket_L/R` exact names, foot parenting, local `-Z` down and follow-through through feet animations.
- Six nozzle meshes and their recessed positions.
- Materials, black opaque visor and absence of face/head geometry.
- No permanent flame/fire/smoke nodes.
- Re-import previews in `previews/`.

Latest measured results are in `Astronaut_validation.json`.

---

## 6. Version history

- **Provisional v1:** first complete full-body astronaut with the original padded torso and no boot thrusters. Kept in `provisional/Astronaut_RetroSpacePost_provisional_v1.blend` and `.glb` only as a fallback.
- **Final:** slimmed limbs, continuous torso, integrated boot thrusters, socket bones and flight clips. This is the active runtime asset.
- Intermediate candidates and legacy astronaut designs were removed.

The base builder for the provisional version is archived at `provisional/tools/Astronaut_build_base.py`. It writes `*_rebuilt` files inside `provisional/`, never the game asset.

---

## 7. Integration

```ts
const { scene, animations } = useGLTF('/models/astronaut.glb')
const { actions } = useAnimations(animations, characterGroup)

const leftThruster = scene.getObjectByName('ThrusterSocket_L')
const rightThruster = scene.getObjectByName('ThrusterSocket_R')
```

- Game path: `public/models/astronaut.glb`.
- Current cache key: `models/astronaut.glb?v=astronaut-mensajero-3`.
- Root placement: `(0, 0, 0)`; feet on the ground.
- Runtime forward vector after the model wrapper: `-Z`.
- Thruster sockets: local `-Z` is the exhaust direction; they follow `Foot_L/R`.
- No permanent fire geometry is stored in the GLB.
- The existing movement/flight physics in `Player.tsx` is unchanged. `AstronautModel.tsx` only selects clips and attaches runtime exhaust to the sockets.
- Ground clips: `Idle`, `Walk`, `Run`.
- Flight clips: `Takeoff` → `Flying` → `Landing`; `Jump` remains available for ballistic jumps.
- Existing gameplay events drive `Interact` / `PickUp` / `Celebrate` / `Turn_Left` / `Turn_Right`; a long idle triggers `Wave`.
