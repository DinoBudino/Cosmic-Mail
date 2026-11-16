# PIP — Retro Space Post Companion

Production asset for **Cosmic Mail**, built procedurally with Blender 5.2.

| File | Purpose |
|---|---|
| `PIP_RetroSpacePost.blend` | Editable master: character, materials, pivots, preview cameras and lights |
| `PIP_RetroSpacePost.glb` | Runtime glTF 2.0 binary, textures embedded |
| `PIP_build.py` | Reproducible generator (geometry, atlases, export, validation, previews) |
| `PIP_verify_glb.py` | Independent GLB re-import / render validation |
| `PIP_validation.json` | Measured technical validation report |
| `PIP_R3F_example.tsx` | React Three Fiber component with independent expressions |
| `textures/` | Source atlases (also embedded in the GLB) |
| `previews/` | Front, 3/4, side, back, expression sheet and GLB re-import render |

Rebuild:

```bash
blender --background --factory-startup --python blender/PIP/PIP_build.py
blender --background --factory-startup --python blender/PIP/PIP_verify_glb.py
```

---

## 1. Coordinate convention and scale

- **Blender:** Z up, character forward `-Y`, character right `+X`.
- **glTF / three.js after export:** Y up, character forward **`+Z`**, character right `+X`.
- **Root:** `PIP_ROOT` at `(0, 0, 0)` with scale `(1, 1, 1)`.
- **Origin:** centre of the spherical body. The hover emitter is the lowest point (~`-0.60`), the antenna orb is the highest (~`+0.78`).
- **Body diameter:** `1.0` Blender unit / world unit.

Do not add an undocumented 90° correction in the consuming application.

---

## 2. Runtime hierarchy

```text
PIP_ROOT
└── PIP_BOB_PIVOT
    └── PIP_BODY_PIVOT
        ├── BODY
        │   ├── Body_Shell
        │   ├── Body_Stripe_Orange
        │   └── Body_Stripe_Accent
        ├── FACE
        │   ├── Face_Screen
        │   ├── Face_Gold_Rim
        │   └── Face_Expressions
        │       ├── Eye_L
        │       ├── Eye_R
        │       └── Mouth
        ├── SIDE_MODULES
        │   ├── Module_L  (Housing / Ring / Cap)
        │   └── Module_R  (Housing / Ring / Cap)
        ├── ANTENNA_PIVOT
        │   ├── Antenna_Base
        │   ├── Antenna_Neck
        │   ├── Antenna_Stem
        │   └── Antenna_Orb
        ├── POSTAL_DETAILS
        │   ├── Forehead_Envelope_Badge
        │   ├── Badge_Fold_0..2
        │   ├── Scarf_Envelope_Clasp
        │   ├── Clasp_Fold_0..1
        │   ├── Postal_Stamp
        │   └── Postal_Cancellation_Lines
        ├── SCARF
        │   ├── Scarf_Band
        │   ├── Scarf_Top_Hem
        │   ├── Scarf_Knot
        │   ├── Scarf_Knot_Wrap
        │   ├── Scarf_Tail_Pivot
        │   │   ├── Scarf_Tail_A
        │   │   ├── Scarf_Tail_B
        │   │   └── Scarf_Accent_Stripes
        └── HOVER_THRUSTER
            ├── Thruster_Housing
            ├── Thruster_Ring
            └── Thruster_Emitter
```

The hierarchy is real object parenting, not Blender collection grouping. Blender collections are only for authoring and are not exported to the runtime.

**Pivots**

| Node | Controls |
|---|---|
| `PIP_ROOT` | World placement, path translation, yaw toward movement |
| `PIP_BOB_PIVOT` | Vertical hover bob (`position.y` in three.js) |
| `PIP_BODY_PIVOT` | Pitch, roll and yaw / reaction gestures |
| `ANTENNA_PIVOT` | Antenna sway; pivot at the antenna base |
| `Scarf_Tail_Pivot` | Both scarf tails; pivot at the knot |

`Eye_L`, `Eye_R` and `Mouth` are independent mesh nodes with stable names.

No armature is used. The character is a rigid hierarchy, so ordinary scene cloning is sufficient (no `SkeletonUtils.clone`).

---

## 3. Facial system

The face is a compact **texture-atlas** system: independent emissive materials on three curved meshes in front of the glossy screen. This keeps the GLB lightweight and avoids fragile facial skinning / morph geometry.

### Atlases

- `PIP_Face_Eyes.png` — `512 × 2048`, `2 columns × 8 rows` (column 0 = left eye, column 1 = right eye).
- `PIP_Face_Mouth.png` — `1024 × 2048`, `4 columns × 8 rows` (columns = mouth openness, rows = expression).
- `PIP_Postal_Stamp.png` — `512 × 512`, alpha-blended stamp decal.
- All three are embedded in the GLB. No external runtime texture files are needed.
- The atlases can be halved if GPU memory is tight; keep the same grid and update the cell dimensions in the consuming code.

### Expression rows

| Row | Expression |
|---:|---|
| 0 | `neutral` |
| 1 | `happy` |
| 2 | `curious` |
| 3 | `surprised` |
| 4 | `sad` |
| 5 | `confused` |
| 6 | `worried` |
| 7 | `thoughtful` |

The onboarding also uses a composite **`welcome`** state, implemented at runtime:
big round eyes (`curious` eye row 2) + the open smile from the neutral mouth row
(column 2). It is not a separate atlas row; `HubPipModel` combines the two so PIP
can look directly at the player while smiling.

### Mouth openness columns

| Column | Openness |
|---:|---|
| 0 | closed |
| 1 | slightly open |
| 2 | medium open |
| 3 | wide open |

Mouth openness combines with **any** expression row, so speaking never replaces the eye emotion.

### Selecting a cell at runtime

The exported materials start on the neutral cell (`row 0`, `col 0`). Override the map transform:

```ts
// glTF UV origin is top-left, so do not flip V.
const cols = 2 // eyes; use 4 for the mouth
const rows = 8
texture.repeat.set(1 / cols, 1 / rows)
texture.offset.set(column / cols, row / rows)
// Do not set texture.needsUpdate here: the texture matrix updates itself.
```

`Eye_L` uses `column 0`, `Eye_R` uses `column 1`.
`Mouth` uses `column = Math.round(openness * 3)`, `row = expressionRow`.

Keep `wrapS` / `wrapT` on `ClampToEdgeWrapping` to avoid bleeding between cells.

### Speaking

Animate the mouth column while leaving the eye row untouched:

```ts
pip.setExpression('happy')
pip.setSpeaking(true)
// internal example: level = Math.round((0.5 + 0.5 * sin(t * 13.5)) * 3)
pip.setSpeaking(false)
pip.setMouthOpen(0.35)
```

### Per-instance state

Expression state lives in each facial material's texture transform. For independent instances:

1. `scene.clone(true)` for the rigid hierarchy.
2. Clone the `PIP_Eye_L`, `PIP_Eye_R` and `PIP_Mouth` materials.
3. Clone their `map` textures (keeping the same image source) before changing offsets.
4. Leave all other materials shared; they are immutable.

`PIP_R3F_example.tsx` implements this and exposes:

```ts
pip.setExpression('curious')
pip.setMouthOpen(0.7)
pip.setSpeaking(true)
pip.setHoverEnabled(false)
pip.getNode('ANTENNA_PIVOT')
```

---

## 4. Materials

All materials are standard glTF metallic-roughness Principled BSDF materials.

| Material | HEX | Metallic | Roughness | Notes |
|---|---|---:|---:|---|
| `PIP_Shell_Ivory` | `#F1C9AA` | 0.05 | 0.32 | Smooth polymer shell |
| `PIP_Stripe_Orange` | `#E66B39` | 0.05 | 0.38 | Painted surface stripes |
| `PIP_Stripe_Accent` | `#F6B98E` | 0.04 | 0.38 | Thin accent bands |
| `PIP_Scarf_Burgundy` | `#812E4D` | 0.00 | 0.75 | Main scarf cloth |
| `PIP_Scarf_Shadow` | `#63213D` | 0.00 | 0.80 | Rolled hem / knot wrap |
| `PIP_Gold_Metal` | `#EBA94D` | 0.70 | 0.27 | Bezel, rings, badge |
| `PIP_Gold_Highlight` | `#FFD17B` | 0.55 | 0.25 | Envelope fold lines |
| `PIP_Lavender_Module` | `#A978A8` | 0.12 | 0.32 | Side module housing |
| `PIP_Lavender_Shadow` | `#785279` | 0.08 | 0.42 | Domed cap |
| `PIP_Face_Screen` | `#120B1E` | 0.00 | 0.34 | Soft-gloss black display |
| `PIP_Eye_L` / `PIP_Eye_R` | `#FF9DD5` | 0.00 | 0.30 | Atlas, emissive 1.55, alpha blend |
| `PIP_Mouth` | `#FF9DD5` | 0.00 | 0.30 | Atlas, emissive 1.55, alpha blend |
| `PIP_Antenna_Orb` | `#FF7CC8` | 0.00 | 0.22 | Emissive 0.80 |
| `PIP_Hover_Emitter` | `#FFA62E` | 0.00 | 0.30 | Emissive 0.85 |
| `PIP_Antenna_Stem` | `#5C2338` | 0.45 | 0.35 | Slim mast |
| `PIP_Postal_Ink` | `#934665` | 0.00 | 0.80 | Cancellation lines |
| `PIP_Postal_Stamp_Material` | texture | 0.00 | 0.82 | Alpha-blended stamp decal |

The face materials intentionally have their own materials/textures to keep the three facial parts independently addressable. This is why the material count (18) is slightly above the general 8–14 target.

---

## 5. Geometry and performance

Measured from the exported GLB:

- **16,928 triangles** (reported from index accessors, not polygons).
- **37 meshes**, **51 nodes**, **18 materials**, **3 embedded PNG images**, **4 texture samplers**.
- **~0.93 MB** GLB.
- No cameras, lights, floor or preview objects in the GLB.
- Stripes are single-surface, shell-conforming painted meshes (no floating blocks, no z-fighting).
- Bevels are applied intentionally; the `.blend` remains editable geometry.

---

## 6. Animation model

No baked clips are exported. Motion is procedural on the exported pivots:

```ts
hoverAmplitude = 0.025       // PIP_BOB_PIVOT.position.y
hoverFrequency = 1.2
bodyRollAmplitude = 0.035    // PIP_BODY_PIVOT.rotation.z
antennaSwayAmplitude = 0.06  // ANTENNA_PIVOT
scarfSwayAmplitude = 0.08    // Scarf_Tail_Pivot
```

- **Hover:** vertical bob on `PIP_BOB_PIVOT`, low-amplitude roll/yaw on `PIP_BODY_PIVOT`.
- **Movement:** translate/rotate `PIP_ROOT`; add forward pitch and turning lean on `PIP_BODY_PIVOT`.
- **Reactions:** happy bounce, curious tilt, surprised recoil and speaking anticipation by rotating the body pivot. PIP has no neck.
- **Antenna / scarf:** rotate the dedicated pivots; do not deform vertices and do not use cloth physics.

Because no clips are baked, application-level movement and procedural motion cannot conflict with an exported root animation.

---

## 7. Three.js / React Three Fiber loading

Copy the GLB where your app serves models (for example `public/models/PIP_RetroSpacePost.glb`) and load it with `useGLTF`. See `PIP_R3F_example.tsx` for a complete implementation that:

- clones the rigid scene once,
- creates independent facial materials and textures per instance,
- exposes `setExpression`, `setMouthOpen`, `setSpeaking`, `setHoverEnabled`, `getNode`,
- animates bob / body / antenna / scarf in `useFrame`,
- cleans up the cloned facial materials and maps on unmount.

```tsx
<Pip position={[-2, 1, 0]} expression="happy" hovering />
<Pip position={[ 2, 1, 0]} expression="curious" hovering />
```

Both instances animate and express independently; geometry buffers are shared.

---

## 8. Cosmic Mail hub integration

The onboarding cabin now uses the production GLB:

- `public/models/pip-retro-space-post.glb` — runtime copy of the exported asset.
- `src/game/HubPipModel.tsx` — loads/clones the GLB, keeps expressions and mouth state per instance, animates blink/antenna/scarf tails, and wraps loading/failure in a local Suspense + error boundary.
- `src/game/MenuScene.tsx` — `CabinPip` keeps the existing narrative staging (anchors, facing, bob, sway, hop) and mounts `HubPip` at `scale={0.64}` inside the old cabin group.
- The previous procedural shell/eyes/antenna block was removed from that mount point and is preserved in git history. A comment marks the replacement.
- The Mars-scene `Companion` is intentionally untouched; only the onboarding/hub PIP was replaced.
- **Welcome staging:** PIP snaps to the centre anchor (`x = 0`) with zero roll/pitch/yaw, faces straight ahead (identity rotation, since the welcome camera is on the cabin centreline), and uses the `welcome` face. The greeting hop fires only after the cabin cut, so the player actually sees it.
- **Idle life:** soft vertical float, double micro-blinks, talking mouth, antenna sway, scarf-tail sway, and subtle antenna/hover glow pulses. Reduced motion disables all of them.

The `0.64` scale maps the 1.0-unit production body onto the cabin's previous 0.64-unit body, so the existing pose anchors and camera framing remain valid.

When the Blender asset changes, rebuild it and refresh the runtime copy:

```bash
blender --background --factory-startup --python blender/PIP/PIP_build.py
cp blender/PIP/PIP_RetroSpacePost.glb public/models/pip-retro-space-post.glb
```

---

## 9. Validation performed / limitations

Actually performed by `PIP_build.py` and `PIP_verify_glb.py`:

- `.blend` saved and `.glb` exported from a clean factory-startup scene.
- GLB header, version, declared length, JSON chunk and BIN chunk checked.
- GLB JSON parsed; mesh/node/material/image/texture/animation counts measured.
- Required runtime node names checked.
- Orientation checked in the exported node transforms: root scale unit, `Eye_L` forward on `+Z`, `Antenna_Orb` up on `+Y`.
- Facial materials checked for atlas texture, emissive factor, emissive strength and `alphaMode: BLEND`.
- Embedded images checked (buffer views, no external URI).
- Preview renders: front, three-quarter, side, back, all eight expressions.
- Independent GLB re-import in fresh Blender and re-render.

Not performed here:

- A browser/WebGL `GLTFLoader` runtime test (no browser in this environment).
- An automated pixel-diff against the reference sheet. The final visual pass compared the rendered front, three-quarter, side, back and expression sheet against the supplied reference by eye; a human review is still recommended.
- Baked animations (intentionally procedural).

If a visual change is requested, edit `PIP_build.py` and rebuild so the `.blend`, `.glb`, previews and validation report stay in sync.
