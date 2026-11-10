/**
 * PIP — React Three Fiber integration example.
 *
 * Copy PIP_RetroSpacePost.glb to the app's public models folder, e.g.
 *   public/models/PIP_RetroSpacePost.glb
 *
 * The component:
 *  - clones the rigid GLB hierarchy per instance (no SkeletonUtils needed),
 *  - clones the three facial materials + their atlas textures so expressions
 *    and mouth openness stay independent per instance,
 *  - exposes imperative expression/speech/hover controls,
 *  - animates the exported pivots procedurally.
 *
 * The GLB is Y-up and faces +Z. No extra rotation is applied here.
 */

import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react'
import * as THREE from 'three'

export type PipExpression =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'surprised'
  | 'sad'
  | 'confused'
  | 'worried'
  | 'thoughtful'

const EXPRESSION_ROW: Record<PipExpression, number> = {
  neutral: 0,
  happy: 1,
  curious: 2,
  surprised: 3,
  sad: 4,
  confused: 5,
  worried: 6,
  thoughtful: 7,
}

const EYE_COLS = 2
const EYE_ROWS = 8
const MOUTH_COLS = 4
const MOUTH_ROWS = 8

type FacialPart = 'Eye_L' | 'Eye_R' | 'Mouth'

const FACIAL_PARTS: FacialPart[] = ['Eye_L', 'Eye_R', 'Mouth']

export interface PipHandle {
  setExpression: (expression: PipExpression) => void
  setMouthOpen: (openness: number) => void
  setSpeaking: (speaking: boolean) => void
  setHoverEnabled: (enabled: boolean) => void
  getNode: (name: string) => THREE.Object3D | null
}

export interface PipProps extends Omit<ThreeElements['group'], 'ref'> {
  expression?: PipExpression
  speaking?: boolean
  mouthOpen?: number
  hovering?: boolean
  hoverAmplitude?: number
  hoverFrequency?: number
  bodyRollAmplitude?: number
  antennaSwayAmplitude?: number
  scarfSwayAmplitude?: number
}

const PIP_URL = '/models/PIP_RetroSpacePost.glb'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function getFacialMaterial(mesh: THREE.Object3D): THREE.MeshStandardMaterial | null {
  if (!(mesh instanceof THREE.Mesh)) return null
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  if (!(source instanceof THREE.MeshStandardMaterial)) return null

  const material = source.clone()
  if (material.map) {
    // Clone the texture object so this instance owns its offset/repeat.
    // The image source is still shared by the browser/GPU cache where possible.
    material.map = material.map.clone()
    material.map.wrapS = THREE.ClampToEdgeWrapping
    material.map.wrapT = THREE.ClampToEdgeWrapping
    material.map.needsUpdate = true
  }
  mesh.material = material
  return material
}

export const Pip = forwardRef<PipHandle, PipProps>(function Pip(
  {
    expression = 'neutral',
    speaking = false,
    mouthOpen = 0,
    hovering = true,
    hoverAmplitude = 0.025,
    hoverFrequency = 1.2,
    bodyRollAmplitude = 0.035,
    antennaSwayAmplitude = 0.06,
    scarfSwayAmplitude = 0.08,
    ...groupProps
  },
  ref,
) {
  const { scene } = useGLTF(PIP_URL)

  const cloned = useMemo(() => scene.clone(true) as THREE.Group, [scene])

  const facial = useMemo(() => {
    const materials: Partial<Record<FacialPart, THREE.MeshStandardMaterial>> = {}
    for (const part of FACIAL_PARTS) {
      const node = cloned.getObjectByName(part)
      if (!node) continue
      const material = getFacialMaterial(node)
      if (material) materials[part] = material
    }
    return materials
  }, [cloned])

  const pivots = useMemo(
    () => ({
      bob: cloned.getObjectByName('PIP_BOB_PIVOT'),
      body: cloned.getObjectByName('PIP_BODY_PIVOT'),
      antenna: cloned.getObjectByName('ANTENNA_PIVOT'),
      tail: cloned.getObjectByName('Scarf_Tail_Pivot'),
    }),
    [cloned],
  )

  const expressionRef = useRef<PipExpression>(expression)
  const mouthOpenRef = useRef(clamp01(mouthOpen))
  const speakingRef = useRef(speaking)
  const hoveringRef = useRef(hovering)
  const lastMouthLevel = useRef(-1)

  const setCell = (
    part: FacialPart,
    column: number,
    row: number,
    columns: number,
    rows: number,
  ) => {
    const map = facial[part]?.map
    if (!map) return
    map.repeat.set(1 / columns, 1 / rows)
    // glTF UV origin is top-left: V increases downwards.
    // Only the texture matrix changes; the image does not need re-uploading.
    map.offset.set(column / columns, row / rows)
  }

  const applyMouth = (nextExpression: PipExpression, openness: number) => {
    const row = EXPRESSION_ROW[nextExpression]
    const column = Math.min(MOUTH_COLS - 1, Math.round(clamp01(openness) * 3))
    setCell('Mouth', column, row, MOUTH_COLS, MOUTH_ROWS)
    lastMouthLevel.current = column
  }

  const applyEyes = (nextExpression: PipExpression) => {
    const row = EXPRESSION_ROW[nextExpression]
    setCell('Eye_L', 0, row, EYE_COLS, EYE_ROWS)
    setCell('Eye_R', 1, row, EYE_COLS, EYE_ROWS)
  }

  const applyExpression = (nextExpression: PipExpression) => {
    expressionRef.current = nextExpression
    applyEyes(nextExpression)
    if (!speakingRef.current) {
      applyMouth(nextExpression, mouthOpenRef.current)
    }
  }

  useEffect(() => {
    expressionRef.current = expression
    applyEyes(expression)
    if (!speakingRef.current) {
      applyMouth(expression, mouthOpenRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expression, facial])

  useEffect(() => {
    mouthOpenRef.current = clamp01(mouthOpen)
    if (!speakingRef.current) {
      applyMouth(expressionRef.current, mouthOpenRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mouthOpen, facial])

  useEffect(() => {
    speakingRef.current = speaking
    if (!speaking) {
      lastMouthLevel.current = -1
      applyMouth(expressionRef.current, mouthOpenRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speaking, facial])

  useEffect(() => {
    hoveringRef.current = hovering
    if (!hovering) {
      if (pivots.bob) pivots.bob.position.y = 0
      if (pivots.body) pivots.body.rotation.set(0, 0, 0)
      if (pivots.antenna) pivots.antenna.rotation.set(0, 0, 0)
      if (pivots.tail) pivots.tail.rotation.set(0, 0, 0)
    }
  }, [hovering, pivots])

  useEffect(() => {
    return () => {
      for (const part of FACIAL_PARTS) {
        const material = facial[part]
        material?.map?.dispose()
        material?.dispose()
      }
    }
  }, [facial])

  useImperativeHandle(
    ref,
    () => ({
      setExpression: applyExpression,
      setMouthOpen: (openness: number) => {
        mouthOpenRef.current = clamp01(openness)
        if (!speakingRef.current) {
          applyMouth(expressionRef.current, mouthOpenRef.current)
        }
      },
      setSpeaking: (nextSpeaking: boolean) => {
        speakingRef.current = nextSpeaking
        if (!nextSpeaking) {
          lastMouthLevel.current = -1
          applyMouth(expressionRef.current, mouthOpenRef.current)
        }
      },
      setHoverEnabled: (enabled: boolean) => {
        hoveringRef.current = enabled
        if (!enabled) {
          if (pivots.bob) pivots.bob.position.y = 0
          if (pivots.body) pivots.body.rotation.set(0, 0, 0)
          if (pivots.antenna) pivots.antenna.rotation.set(0, 0, 0)
          if (pivots.tail) pivots.tail.rotation.set(0, 0, 0)
        }
      },
      getNode: (name: string) => cloned.getObjectByName(name) ?? null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloned, facial, pivots],
  )

  useFrame((state) => {
    const time = state.clock.elapsedTime

    if (hoveringRef.current) {
      if (pivots.bob) {
        pivots.bob.position.y =
          Math.sin(time * hoverFrequency) * hoverAmplitude
      }
      if (pivots.body) {
        pivots.body.rotation.z = Math.sin(time * 0.8) * bodyRollAmplitude
        pivots.body.rotation.y = Math.sin(time * 0.37) * 0.05
        pivots.body.rotation.x = Math.sin(time * 0.55) * 0.025
      }
      if (pivots.antenna) {
        pivots.antenna.rotation.z =
          Math.sin(time * 1.7 + 0.8) * antennaSwayAmplitude
        pivots.antenna.rotation.x =
          Math.sin(time * 1.1) * antennaSwayAmplitude * 0.6
      }
      if (pivots.tail) {
        pivots.tail.rotation.x =
          Math.sin(time * 1.5 + 0.4) * scarfSwayAmplitude
        pivots.tail.rotation.y =
          Math.sin(time * 1.0) * scarfSwayAmplitude * 0.6
      }
    }

    if (speakingRef.current) {
      const level = Math.round(
        (0.5 + 0.5 * Math.sin(time * 13.5)) * (MOUTH_COLS - 1),
      )
      if (level !== lastMouthLevel.current) {
        lastMouthLevel.current = level
        setCell('Mouth', level, EXPRESSION_ROW[expressionRef.current], MOUTH_COLS, MOUTH_ROWS)
      }
    }
  })

  return (
    <group {...groupProps}>
      <primitive object={cloned} />
    </group>
  )
})

useGLTF.preload(PIP_URL)

/*
Example:

<Pip position={[-2, 1, 0]} expression="happy" hovering />
<Pip position={[ 2, 1, 0]} expression="curious" hovering />

const pip = useRef<PipHandle>(null)
pip.current?.setExpression('thoughtful')
pip.current?.setSpeaking(true)
pip.current?.setMouthOpen(0.6)
*/
