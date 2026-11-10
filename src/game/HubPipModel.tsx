import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'

/**
 * Production PIP GLB used in the onboarding cabin/hub.
 *
 * The exported model faces +Z, Y-up, with its root at the body centre.
 * The cabin's existing pose logic handles placement, facing the camera,
 * bob and body sway. This component handles the character-level animation:
 * facial expression, talking mouth, blink, antenna and scarf tails.
 */
export type HubPipExpression =
  | 'welcome'
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'surprised'
  | 'sad'
  | 'confused'
  | 'worried'
  | 'thoughtful'

interface HubPipModelProps {
  expression: HubPipExpression
  talking?: boolean
  reducedMotion?: boolean
  /** Resting antenna sway from the cabin's narrative pose. */
  antennaAmplitude?: number
  /** Scales the 1.0-unit body down to the cabin PIP size. */
  scale?: number
}

const PIP_URL = 'models/pip-retro-space-post.glb'

const EYE_ROW: Record<HubPipExpression, number> = {
  // Welcome keeps the big round "curious" eyes so he clearly looks at the
  // player. Crescent "happy" eyes are reserved for reactions.
  welcome: 2,
  neutral: 0,
  happy: 1,
  curious: 2,
  surprised: 3,
  sad: 4,
  confused: 5,
  worried: 6,
  thoughtful: 7,
}

const MOUTH_ROW: Record<HubPipExpression, number> = {
  // Welcome smiles with the neutral row; the eyes above stay open.
  welcome: 0,
  neutral: 0,
  happy: 1,
  curious: 2,
  surprised: 3,
  sad: 4,
  confused: 5,
  worried: 6,
  thoughtful: 7,
}

/** Mouth column used while the character is not speaking. */
const RESTING_MOUTH: Record<HubPipExpression, number> = {
  welcome: 2,
  neutral: 0,
  happy: 1,
  curious: 1,
  surprised: 2,
  sad: 0,
  confused: 0,
  worried: 0,
  thoughtful: 0,
}

const EYE_COLS = 2
const EYE_ROWS = 8
const MOUTH_COLS = 4
const MOUTH_ROWS = 8

type FacialPart = 'Eye_L' | 'Eye_R' | 'Mouth'

const FACIAL_PARTS: FacialPart[] = ['Eye_L', 'Eye_R', 'Mouth']

interface ClonedPip {
  root: THREE.Group
  facial: Partial<Record<FacialPart, THREE.MeshStandardMaterial>>
  glow: {
    thruster?: THREE.MeshStandardMaterial
    antenna?: THREE.MeshStandardMaterial
  }
  glowBase: {
    thruster: number
    antenna: number
  }
}

function cloneStandardMaterial(
  root: THREE.Group,
  objectName: string,
): THREE.MeshStandardMaterial | undefined {
  const node = root.getObjectByName(objectName)
  if (!(node instanceof THREE.Mesh)) return undefined
  const source = Array.isArray(node.material) ? node.material[0] : node.material
  if (!(source instanceof THREE.MeshStandardMaterial)) return undefined
  const material = source.clone()
  node.material = material
  return material
}

function clonePip(scene: THREE.Group): ClonedPip {
  const root = scene.clone(true)
  const facial: Partial<Record<FacialPart, THREE.MeshStandardMaterial>> = {}

  for (const part of FACIAL_PARTS) {
    const node = root.getObjectByName(part)
    if (!(node instanceof THREE.Mesh)) continue
    const source = Array.isArray(node.material) ? node.material[0] : node.material
    if (!(source instanceof THREE.MeshStandardMaterial)) continue

    const material = source.clone()
    if (material.map) {
      // Expression state lives in the texture transform, so each instance
      // needs its own texture object even though the image is shared.
      material.map = material.map.clone()
      material.map.wrapS = THREE.ClampToEdgeWrapping
      material.map.wrapT = THREE.ClampToEdgeWrapping
      material.map.needsUpdate = true
    }
    node.material = material
    facial[part] = material
  }

  const thruster = cloneStandardMaterial(root, 'Thruster_Emitter')
  const antenna = cloneStandardMaterial(root, 'Antenna_Orb')

  return {
    root,
    facial,
    glow: { thruster, antenna },
    glowBase: {
      thruster: thruster?.emissiveIntensity ?? 0.85,
      antenna: antenna?.emissiveIntensity ?? 0.8,
    },
  }
}

/** Keeps a missing/corrupt PIP GLB from taking down the onboarding scene. */
class PipAssetBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.warn('PIP GLB could not be loaded; continuing without the companion.', error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function HubPipModel({
  expression,
  talking = false,
  reducedMotion = false,
  antennaAmplitude = 0.06,
  scale = 0.64,
}: HubPipModelProps) {
  const { scene } = useGLTF(PIP_URL)
  const cloned = useMemo(() => clonePip(scene as THREE.Group), [scene])

  const nodes = useMemo(
    () => ({
      eyeLeft: cloned.root.getObjectByName('Eye_L'),
      eyeRight: cloned.root.getObjectByName('Eye_R'),
      antenna: cloned.root.getObjectByName('ANTENNA_PIVOT'),
      scarfTail: cloned.root.getObjectByName('Scarf_Tail_Pivot'),
    }),
    [cloned],
  )

  const expressionRef = useRef(expression)
  const talkingRef = useRef(talking)
  const lastMouthLevel = useRef(-1)
  const antennaAmpRef = useRef(antennaAmplitude)

  const applyCell = (
    part: FacialPart,
    column: number,
    row: number,
    columns: number,
    rows: number,
  ) => {
    const map = cloned.facial[part]?.map
    if (!map) return
    map.repeat.set(1 / columns, 1 / rows)
    // glTF UV origin is top-left: V increases downwards.
    // Only the texture matrix changes; uploading the image again is unnecessary.
    map.offset.set(column / columns, row / rows)
  }

  const applyEyes = (nextExpression: HubPipExpression) => {
    const row = EYE_ROW[nextExpression]
    applyCell('Eye_L', 0, row, EYE_COLS, EYE_ROWS)
    applyCell('Eye_R', 1, row, EYE_COLS, EYE_ROWS)
  }

  const applyMouth = (nextExpression: HubPipExpression, column: number) => {
    const row = MOUTH_ROW[nextExpression]
    applyCell('Mouth', column, row, MOUTH_COLS, MOUTH_ROWS)
    lastMouthLevel.current = column
  }

  useEffect(() => {
    expressionRef.current = expression
    applyEyes(expression)
    if (!talkingRef.current) {
      applyMouth(expression, RESTING_MOUTH[expression])
    } else {
      // Force the next speaking frame to redraw the mouth in the new row.
      lastMouthLevel.current = -1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, cloned])

  useEffect(() => {
    talkingRef.current = talking
    if (!talking) {
      lastMouthLevel.current = -1
      applyMouth(expressionRef.current, RESTING_MOUTH[expressionRef.current])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talking, cloned])

  useEffect(() => {
    return () => {
      for (const material of Object.values(cloned.facial)) {
        if (!material) continue
        material.map?.dispose()
        material.dispose()
      }
      cloned.glow.thruster?.dispose()
      cloned.glow.antenna?.dispose()
    }
  }, [cloned])

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime
    const { eyeLeft, eyeRight, antenna, scarfTail } = nodes

    if (reducedMotion) {
      if (eyeLeft) eyeLeft.scale.y = 1
      if (eyeRight) eyeRight.scale.y = 1
      if (antenna) antenna.rotation.set(0, 0, 0)
      if (scarfTail) scarfTail.rotation.set(0, 0, 0)
      if (cloned.glow.thruster) {
        cloned.glow.thruster.emissiveIntensity = cloned.glowBase.thruster
      }
      if (cloned.glow.antenna) {
        cloned.glow.antenna.emissiveIntensity = cloned.glowBase.antenna
      }
      return
    }

    // Double micro-blink every few seconds: alive, but never cartoonish.
    const blinkCycle = time % 4.6
    const blinking =
      (blinkCycle > 4.38 && blinkCycle < 4.50) ||
      (blinkCycle > 4.56 && blinkCycle < 4.66)
    const blink = blinking ? 0.12 : 1
    if (eyeLeft) eyeLeft.scale.y = blink
    if (eyeRight) eyeRight.scale.y = blink

    // The exported antenna is vertical on local Y; X/Z sway around its base.
    antennaAmpRef.current = THREE.MathUtils.damp(
      antennaAmpRef.current,
      talkingRef.current ? 0.18 : antennaAmplitude,
      5,
      delta,
    )
    if (antenna) {
      antenna.rotation.x = Math.sin(time * 4) * antennaAmpRef.current
      antenna.rotation.z = Math.sin(time * 3.3 + 0.5) * antennaAmpRef.current * 0.35
    }
    if (scarfTail) {
      const tailAmplitude = talkingRef.current ? 0.075 : 0.05
      scarfTail.rotation.x = Math.sin(time * 1.5 + 0.4) * tailAmplitude
      scarfTail.rotation.z = Math.sin(time * 1.1) * tailAmplitude * 0.62
    }

    // Warm, slow glow pulses: propulsion and antenna feel alive without
    // relying on post-processing.
    if (cloned.glow.thruster) {
      cloned.glow.thruster.emissiveIntensity =
        cloned.glowBase.thruster + Math.sin(time * 1.3) * 0.12
    }
    if (cloned.glow.antenna) {
      cloned.glow.antenna.emissiveIntensity =
        cloned.glowBase.antenna + Math.sin(time * 2.1 + 1.1) * 0.08
    }

    if (talkingRef.current) {
      const syllable = Math.abs(
        Math.sin(time * 13) * 0.7 + Math.sin(time * 7.3) * 0.3,
      )
      const level = Math.min(
        MOUTH_COLS - 1,
        Math.round(syllable * (MOUTH_COLS - 1)),
      )
      if (level !== lastMouthLevel.current) {
        applyMouth(expressionRef.current, level)
      }
    }
  })

  return <primitive object={cloned.root} scale={scale} />
}

/**
 * Safe mount point: local Suspense while the GLB loads, and an error
 * boundary so a missing asset degrades to "no PIP" instead of a blank
 * onboarding scene.
 */
export function HubPip(props: HubPipModelProps) {
  return (
    <PipAssetBoundary>
      <Suspense fallback={null}>
        <HubPipModel {...props} />
      </Suspense>
    </PipAssetBoundary>
  )
}

useGLTF.preload(PIP_URL)
