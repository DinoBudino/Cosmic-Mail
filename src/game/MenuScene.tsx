import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { mulberry32 } from './random'
import { destinationPlanetKind, ZONES, type PlanetKind } from '../data/zones'
import { getExplorer, getModule, getTrait } from '../data/personalization'
import { useGameStore } from '../store/gameStore'
import { isNavigationUnlocked, useOnboardingStore } from '../store/onboardingStore'
import {
  cruiseDistance,
  descentProgress,
  inCabinStage,
  launchClock,
  marsApproach,
  shipPoseAt,
  speedShake,
  stageAt,
} from './launchTimeline'

/**
 * Cinematic camera — the boarding happens in stages:
 * - menu: the wide title shot (planet + ship + title space)
 * - approach: dolly in toward the ship's window and dwell there
 * - cabin: inside the cockpit, looking out through the window at Mars
 *   (passport and route stay inside too, interacting from the seat)
 */
const MENU_POSITION = new THREE.Vector3(0, 0.4, 16)
const APPROACH_POSITION = new THREE.Vector3(4.0, -0.2, 6.4)
// The cabin is a fixed cube room (8 wide, 4.6 high, front wall at
// z=-4.5). During the tutorial ritual the pilot's view is totally
// straight-on (PIP and board dead ahead); once the tutorial is done,
// the view glides to the slightly diagonal hub framing.
const FRONTAL_POSITION = new THREE.Vector3(0, 0.35, 1.55)
const FRONTAL_LOOK = new THREE.Vector3(0, -0.5, -2.4)
const CABIN_POSITION = new THREE.Vector3(1.7, 0.3, 1.2)
const ROUTE_POSITION = new THREE.Vector3(-0.5, -0.1, -0.35)
const MENU_LOOK = new THREE.Vector3(0, 0, 0)
// Launching: the same wide menu framing, then a slow push-in toward
// the destination as the ship accelerates.
const LAUNCH_START_POSITION = new THREE.Vector3(0, 0.4, 16)
const LAUNCH_END_POSITION = new THREE.Vector3(-1.2, -0.2, 11.5)
const LAUNCH_LOOK = new THREE.Vector3(-3.2, -1.6, -2.5)
const APPROACH_LOOK = new THREE.Vector3(5.4, -0.6, -0.5)
const CABIN_LOOK = new THREE.Vector3(-0.5, -0.6, -2.3)
const ROUTE_LOOK = new THREE.Vector3(-0.5, -0.92, -1.4)

// Cabin <-> navigation-panel transition. `routeBlend` goes 0 (initial
// cabin view) -> 1 (leaned into the navigation screen) over
// ROUTE_BLEND_SECONDS, and back the same way. Both camera poses are
// fixed points inside the cube, so the move is a plain interpolation.
const ROUTE_BLEND_SECONDS = 1.5
const routeBlend = { value: 0 }

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function CameraRig() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const tutorialDone = useOnboardingStore((state) => state.tutorialDone)
  const setBoardingStage = useOnboardingStore((state) => state.setBoardingStage)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const wasCabinRef = useRef(false)

  // Approach flight first (dwell on the ship), then a clean cut into
  // the cabin: no settling move afterwards. The only camera travel
  // inside the cabin is the route blend to/from the navigation panel.
  // Launching is not a cabin phase: the wide menu shot returns.
  useEffect(() => {
    if (phase === 'launching') return
    const cabinPhase = phase !== 'menu'
    if (!cabinPhase) return
    if (reducedMotion || boardingStage === 'cabin') {
      if (boardingStage !== 'cabin') setBoardingStage('cabin')
      return
    }
    const timer = window.setTimeout(() => setBoardingStage('cabin'), 2600)
    return () => window.clearTimeout(timer)
  }, [phase, boardingStage, reducedMotion, setBoardingStage])

  useFrame((state, delta) => {
    const camera = state.camera
    // Launching starts INSIDE the cabin: the pilot is seated, PIP
    // talks, and the countdown plays from the seat. The camera
    // settles down into the seat during ignition (a small rumble
    // during the countdown), then cuts to the wide menu shot at
    // liftoff, where the ship is already flying.
    if (phase === 'launching') {
      const { stage, progress, overall } = stageAt(launchClock.value, reducedMotion)
      if (stage === 'ignition' || stage === 'countdown') {
        const time = state.clock.elapsedTime
        const settle = stage === 'ignition' ? progress : 1
        const basePosition = tutorialDone ? CABIN_POSITION : FRONTAL_POSITION
        const baseLook = tutorialDone ? CABIN_LOOK : FRONTAL_LOOK
        // Sit down: start a little high/back, settle into the seat.
        camera.position.set(
          basePosition.x,
          basePosition.y + (1 - settle) * 0.55,
          basePosition.z + (1 - settle) * 0.6,
        )
        if (!reducedMotion && stage === 'countdown') {
          camera.position.x += Math.sin(time * 43) * 0.015
          camera.position.y += Math.sin(time * 37) * 0.012
        }
        lookTarget.copy(baseLook)
        camera.lookAt(lookTarget)
        return
      }
      const push = smoothstep(Math.min(1, overall * 1.15))
      camera.position.lerpVectors(LAUNCH_START_POSITION, LAUNCH_END_POSITION, push)
      // Speed shake: the scene trembles while we cruise at escape
      // velocity, and calms down as we arrive at the planet.
      const shake = speedShake(launchClock.value, reducedMotion)
      if (shake > 0) {
        const time = state.clock.elapsedTime
        camera.position.x += Math.sin(time * 41) * shake * 0.07
        camera.position.y += Math.sin(time * 33) * shake * 0.05
      }
      lookTarget.lerp(LAUNCH_LOOK, 1 - Math.exp(-1.6 * delta))
      camera.lookAt(lookTarget)
      return
    }
    // Passport and route stay inside the cabin with the pilot.
    const cabinPhase = phase !== 'menu'
    const cabin = cabinPhase && boardingStage === 'cabin'
    const approach = cabinPhase && !cabin
    const enteringCabin = cabin && !wasCabinRef.current
    const justLeftCabin = wasCabinRef.current && !cabin
    wasCabinRef.current = cabin

    // The route blend drives the visible approach: tapping the panel
    // dollies the camera in over ROUTE_BLEND_SECONDS, and closing it
    // pulls back the same way. Outside the cabin there is no blend.
    if (!cabin) {
      routeBlend.value = 0
    } else {
      const step = reducedMotion ? 1 : delta / ROUTE_BLEND_SECONDS
      routeBlend.value = THREE.MathUtils.clamp(
        routeBlend.value + (routeOpen ? step : -step),
        0,
        1,
      )
    }
    const e = smoothstep(routeBlend.value)

    // Tutorial framing: totally straight-on until the tutorial is
    // done, then the view glides to the diagonal hub framing.
    const basePosition = tutorialDone ? CABIN_POSITION : FRONTAL_POSITION
    const baseLook = tutorialDone ? CABIN_LOOK : FRONTAL_LOOK

    if (cabin && routeBlend.value > 0) {
      // In the route view (or travelling to/back from it): the camera
      // position and its gaze interpolate between the two fixed poses
      // inside the cube, so the approach is seen, not cut.
      camera.position.lerpVectors(basePosition, ROUTE_POSITION, e)
      lookTarget.lerpVectors(baseLook, ROUTE_LOOK, e)
    } else if (cabin) {
      if (enteringCabin || reducedMotion) {
        // Entering the cabin: hard cut to the current framing.
        camera.position.copy(basePosition)
        lookTarget.copy(baseLook)
      } else {
        // Frontal <-> diagonal glide when the tutorial finishes.
        camera.position.x = THREE.MathUtils.damp(camera.position.x, basePosition.x, 2, delta)
        camera.position.y = THREE.MathUtils.damp(camera.position.y, basePosition.y, 2, delta)
        camera.position.z = THREE.MathUtils.damp(camera.position.z, basePosition.z, 2, delta)
        lookTarget.lerp(baseLook, 1 - Math.exp(-2.5 * delta))
      }
    } else {
      // Menu / approach shots, as before.
      const targetPosition = approach ? APPROACH_POSITION : MENU_POSITION
      const targetLook = approach ? APPROACH_LOOK : MENU_LOOK
      if (reducedMotion || justLeftCabin) {
        // Returning to the title snaps back out — damping through the
        // cabin wall would look broken under the fade.
        camera.position.copy(targetPosition)
      } else {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPosition.x, 1.5, delta)
        camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPosition.y, 1.5, delta)
        camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPosition.z, 1.5, delta)
      }
      lookTarget.lerp(
        targetLook,
        reducedMotion || justLeftCabin ? 1 : 1 - Math.exp(-2.2 * delta),
      )
    }
    camera.lookAt(lookTarget)
  })
  return null
}

const SHIP_URL = 'models/mail-ship.glb'
useGLTF.preload(SHIP_URL)

const STAR_COUNT = 260
const PLANET_RADIUS = 5.4

/* ------------------------------------------------------------------ */
/* Stars                                                               */
/* ------------------------------------------------------------------ */

function MenuStars() {
  const pointsRef = useRef<THREE.Points>(null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const geometry = useMemo(() => {
    const random = mulberry32(0x51ab5)
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors = new Float32Array(STAR_COUNT * 3)
    const palette = ['#FFF0E8', '#E0D4FF', '#FFD9E8', '#FFFFFF']
    const color = new THREE.Color()
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const theta = random() * Math.PI * 2
      const phi = Math.acos(2 * random() - 1)
      const radius = 34 + random() * 26
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[index * 3 + 1] = radius * Math.cos(phi) * 0.7
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 18
      color.set(palette[Math.floor(random() * palette.length)] ?? '#FFFFFF')
      const brightness = 0.45 + random() * 0.55
      colors[index * 3] = color.r * brightness
      colors[index * 3 + 1] = color.g * brightness
      colors[index * 3 + 2] = color.b * brightness
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  useFrame((_, delta) => {
    if (!reducedMotion && pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.004
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.14}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

/* ------------------------------------------------------------------ */
/* Shooting stars                                                      */
/* ------------------------------------------------------------------ */

function makeTrailTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 16
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 256, 0)
  gradient.addColorStop(0, 'rgba(255,255,255,0)')
  gradient.addColorStop(0.75, 'rgba(255,240,220,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 256, 16)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function ShootingStar() {
  const meshRef = useRef<THREE.Mesh>(null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const texture = useMemo(() => makeTrailTexture(), [])
  const stateRef = useRef({
    phase: 'wait' as 'wait' | 'fly',
    waitLeft: 2.5,
    flyTime: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
  })

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    const material = mesh.material as THREE.MeshBasicMaterial
    if (reducedMotion) {
      material.opacity = 0
      return
    }
    const state = stateRef.current
    if (state.phase === 'wait') {
      material.opacity = 0
      state.waitLeft -= delta
      if (state.waitLeft > 0) return
      // Launch a new streak across the upper sky.
      const startX = -14 + Math.random() * 18
      const startY = 5 + Math.random() * 4
      state.from.set(startX, startY, -12)
      state.to.set(startX + 9 + Math.random() * 5, startY - 4 - Math.random() * 2, -12)
      state.flyTime = 0
      state.phase = 'fly'
      return
    }
    state.flyTime += delta / 1.15
    const t = Math.min(state.flyTime, 1)
    mesh.position.lerpVectors(state.from, state.to, t)
    // Fade in fast, fade out over the second half of the streak.
    material.opacity = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8
    if (t >= 1) {
      state.phase = 'wait'
      state.waitLeft = 3.5 + Math.random() * 5
    }
  })

  return (
    <mesh ref={meshRef} rotation={[0, 0, -0.42]}>
      <planeGeometry args={[3.2, 0.07]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Mars with a painted surface texture, slowly rotating                */
/* ------------------------------------------------------------------ */

function makeMarsCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const random = mulberry32(0x1a12)

  // Base dusty gradient, lighter at the poles.
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#D49A77')
  gradient.addColorStop(0.25, '#C07A5E')
  gradient.addColorStop(0.55, '#B77B65')
  gradient.addColorStop(0.85, '#A66A55')
  gradient.addColorStop(1, '#C98A6B')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 512)

  // Every surface element is drawn at x, x-1024 and x+1024 so the
  // texture wraps seamlessly around the sphere (no UV seam cut).
  const wrapped = (_x: number, draw: (offset: number) => void) => {
    for (const offset of [0, -1024, 1024]) draw(offset)
  }

  // Dark maria patches (big soft blotches).
  for (let i = 0; i < 42; i += 1) {
    const x = random() * 1024
    const y = 60 + random() * 392
    const r = 28 + random() * 85
    const squash = 0.45 + random() * 0.4
    const rotation = random() * Math.PI
    wrapped(x, (offset) => {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, 'rgba(122,72,58,0.5)')
      g.addColorStop(1, 'rgba(122,72,58,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x + offset, y, r, r * squash, rotation, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Light dusty patches.
  for (let i = 0; i < 55; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const r = 18 + random() * 60
    wrapped(x, (offset) => {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, 'rgba(232,180,150,0.4)')
      g.addColorStop(1, 'rgba(232,180,150,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x + offset, y, r, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Small crater dots for extra relief.
  for (let i = 0; i < 90; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const r = 3 + random() * 9
    wrapped(x, (offset) => {
      ctx.fillStyle = 'rgba(90,52,42,0.4)'
      ctx.beginPath()
      ctx.arc(x + offset, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(253,244,236,0.28)'
      ctx.beginPath()
      ctx.arc(x + offset - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Fine speckle for grain.
  for (let i = 0; i < 5200; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const size = 1 + random() * 1.4
    const dark = random() > 0.5
    wrapped(x, (offset) => {
      ctx.fillStyle = dark ? 'rgba(90,52,42,0.22)' : 'rgba(240,200,170,0.18)'
      ctx.fillRect(x + offset, y, size, size)
    })
  }

  // Pale polar cap.
  const cap = ctx.createLinearGradient(0, 0, 0, 52)
  cap.addColorStop(0, 'rgba(253,244,236,0.75)')
  cap.addColorStop(1, 'rgba(253,244,236,0)')
  ctx.fillStyle = cap
  ctx.fillRect(0, 0, 1024, 52)

  return canvas
}


/* Stylized planets for the menu and the cabin window: same flat,
   indie, low-poly-friendly look as Mars — never NASA-realistic. */

function makeEarthCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const random = mulberry32(0xea27)
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#7FB8E8')
  gradient.addColorStop(0.5, '#4A90D9')
  gradient.addColorStop(1, '#7FB8E8')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 512)
  // Stylized continents: chunky soft blobs, no coastlines, spread
  // over the whole surface on a jittered grid so no hemisphere is
  // left empty. Each blob is also drawn at ±1024 so the texture
  // wraps seamlessly.
  const END_COLOR: Record<string, string> = {
    'rgba(110,180,110,0.9)': 'rgba(110,180,110,0)',
    'rgba(110,180,110,0.8)': 'rgba(110,180,110,0)',
    'rgba(220,185,120,0.85)': 'rgba(220,185,120,0)',
    'rgba(230,238,240,0.9)': 'rgba(230,238,240,0)',
    'rgba(30,80,150,0.35)': 'rgba(30,80,150,0)',
    'rgba(140,200,240,0.3)': 'rgba(140,200,240,0)',
  }
  const blob = (x: number, y: number, r: number, color: string) => {
    const rotation = random() * Math.PI
    const end = END_COLOR[color] ?? 'rgba(0,0,0,0)'
    for (const offset of [0, -1024, 1024]) {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, end)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x + offset, y, r, r * 0.55, rotation, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Land registry: every continent blob registers its footprint so
  // later detail (grain) only lands where there is actual land.
  const land: Array<{ x: number; y: number; r: number }> = []
  // Continents in their real approximate places (equirectangular:
  // x from longitude, y from latitude), painted as stylized blob
  // clusters — recognizable Earth, still indie and soft.
  const lonToX = (lon: number) => ((lon + 180) / 360) * 1024
  const latToY = (lat: number) => ((90 - lat) / 180) * 512
  const GREEN = 'rgba(110,180,110,0.9)'
  const DESERT = 'rgba(220,185,120,0.85)'
  const landmass = (lon: number, lat: number, r: number, color: string) => {
    const x = lonToX(lon)
    const y = latToY(lat)
    land.push({ x, y, r })
    // Solid landmass: main blob + overlapping satellites so the
    // continent reads as one body, not scattered dots.
    blob(x, y, r, color)
    blob(x + r * 0.55, y + r * 0.2, r * 0.65, color)
    blob(x - r * 0.5, y - r * 0.25, r * 0.55, color)
    blob(x + r * 0.15, y - r * 0.5, r * 0.45, color)
  }
  // North America.
  landmass(-100, 48, 78, GREEN)
  landmass(-118, 42, 57, GREEN)
  landmass(-84, 38, 51, GREEN)
  landmass(-75, 55, 45, GREEN)
  landmass(-95, 62, 51, GREEN)
  landmass(-102, 28, 39, DESERT)
  landmass(-88, 16, 27, GREEN)
  // South America.
  landmass(-62, -8, 60, GREEN)
  landmass(-58, -22, 51, GREEN)
  landmass(-70, -35, 36, GREEN)
  landmass(-75, -45, 27, GREEN)
  // Greenland (pale).
  landmass(-42, 74, 33, 'rgba(230,238,240,0.9)')
  // Europe.
  landmass(12, 50, 45, GREEN)
  landmass(24, 46, 39, GREEN)
  landmass(2, 55, 30, GREEN)
  landmass(18, 62, 33, GREEN)
  // Africa.
  landmass(8, 12, 54, GREEN)
  landmass(22, 2, 57, GREEN)
  landmass(26, -16, 48, DESERT)
  landmass(48, 8, 30, DESERT)
  // Asia.
  landmass(60, 52, 66, GREEN)
  landmass(95, 52, 72, GREEN)
  landmass(110, 38, 60, GREEN)
  landmass(122, 24, 39, GREEN)
  landmass(78, 22, 42, DESERT)
  landmass(55, 26, 36, DESERT)
  landmass(140, 58, 30, GREEN)
  // Southeast Asia islands.
  landmass(115, -2, 30, GREEN)
  landmass(122, -4, 24, GREEN)
  // Australia.
  landmass(134, -24, 51, DESERT)
  landmass(146, -36, 30, GREEN)
  // Pacific / Atlantic islands (tiny accents).
  landmass(-155, 20, 15, GREEN)
  landmass(-18, 64, 15, GREEN)
  landmass(20, -8, 12, GREEN)
  const onLand = (x: number, y: number) =>
    land.some((spot) => {
      const dx = Math.min(Math.abs(x - spot.x), 1024 - Math.abs(x - spot.x))
      const dy = y - spot.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      return dist < spot.r * 0.85
    })
  // Ocean shallows: only very subtle light patches so the blue is
  // not flat. Dark patches read as smudges — they are gone.
  for (let i = 0; i < 40; i += 1) {
    const x = random() * 1024
    const y = 40 + random() * 432
    const r = 30 + random() * 70
    blob(x, y, r, 'rgba(140,200,240,0.12)')
  }
  // Fine grain — ONLY on land (inside a continent footprint), with
  // earthy tones. Kept subtle: heavy speckle reads as dirt/motes,
  // especially through the bump map.
  for (let i = 0; i < 1600; i += 1) {
    let x = random() * 1024
    let y = random() * 512
    for (let attempt = 0; attempt < 4 && !onLand(x, y); attempt += 1) {
      x = random() * 1024
      y = random() * 512
    }
    if (!onLand(x, y)) continue
    const size = 1 + random() * 1.2
    const light = random() > 0.5
    for (const offset of [0, -1024, 1024]) {
      ctx.fillStyle = light ? 'rgba(240,220,170,0.16)' : 'rgba(45,75,45,0.16)'
      ctx.fillRect(x + offset, y, size, size)
    }
  }
  // Clouds as irregular blotchy patches (never streaks): each patch
  // is a cluster of overlapping soft circles, scattered over the
  // whole globe and drawn wrapped so the texture stays seamless.
  for (let i = 0; i < 26; i += 1) {
    const cx = random() * 1024
    const cy = 40 + random() * 432
    const puffs = 4 + Math.floor(random() * 4)
    for (let j = 0; j < puffs; j += 1) {
      const x = cx + (random() - 0.5) * 90
      const y = cy + (random() - 0.5) * 36
      const r = 16 + random() * 34
      const alpha = 0.3 + random() * 0.25
      for (const offset of [0, -1024, 1024]) {
        const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
        g.addColorStop(0, `rgba(253,244,236,${alpha})`)
        g.addColorStop(1, 'rgba(253,244,236,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x + offset, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // Polar caps: soft gradients that melt into the ocean, not
  // solid white bands (they read as glare otherwise).
  for (const [from, to] of [[0, 30], [482, 512]] as const) {
    const cap = ctx.createLinearGradient(0, from, 0, to)
    cap.addColorStop(0, 'rgba(253,244,236,0.85)')
    cap.addColorStop(1, 'rgba(253,244,236,0)')
    ctx.fillStyle = cap
    ctx.fillRect(0, from, 1024, to - from)
  }
  return canvas
}

function makeMoonSurfaceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const random = mulberry32(0xb00b)
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#E8E4DE')
  gradient.addColorStop(0.5, '#CFC9C2')
  gradient.addColorStop(1, '#B8B2AA')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 512)
  // Craters: soft dark discs with a light rim arc (drawn wrapped).
  for (let i = 0; i < 60; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const r = 10 + random() * 42
    for (const offset of [0, -1024, 1024]) {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, 'rgba(105,100,95,0.55)')
      g.addColorStop(0.8, 'rgba(105,100,95,0.25)')
      g.addColorStop(1, 'rgba(105,100,95,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x + offset, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Pale maria patches.
  for (let i = 0; i < 18; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const r = 30 + random() * 80
    const rotation = random() * Math.PI
    for (const offset of [0, -1024, 1024]) {
      const g = ctx.createRadialGradient(x + offset, y, 0, x + offset, y, r)
      g.addColorStop(0, 'rgba(150,145,140,0.35)')
      g.addColorStop(1, 'rgba(150,145,140,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(x + offset, y, r, r * 0.6, rotation, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // Grain.
  for (let i = 0; i < 2600; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const size = 1 + random() * 1.4
    for (const offset of [0, -1024, 1024]) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(80,75,70,0.2)' : 'rgba(253,244,236,0.18)'
      ctx.fillRect(x + offset, y, size, size)
    }
  }
  return canvas
}

function makeDeepSpaceSurfaceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const random = mulberry32(0xdec0)
  const gradient = ctx.createLinearGradient(0, 0, 0, 512)
  gradient.addColorStop(0, '#8E7BC0')
  gradient.addColorStop(0.4, '#6A5A9E')
  gradient.addColorStop(0.7, '#4A7AA8')
  gradient.addColorStop(1, '#3A6A9E')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1024, 512)
  // Bands like a gas giant, stylized and soft.
  for (let i = 0; i < 9; i += 1) {
    const y = 40 + i * 56 + random() * 20
    ctx.fillStyle = i % 2 === 0 ? 'rgba(253,244,236,0.16)' : 'rgba(27,16,41,0.16)'
    ctx.fillRect(0, y, 1024, 18 + random() * 22)
  }
  // Storm spot (wrapped so it never clips at the seam).
  for (const offset of [0, -1024, 1024]) {
    const g = ctx.createRadialGradient(680 + offset, 300, 0, 680 + offset, 300, 70)
    g.addColorStop(0, 'rgba(242,178,140,0.75)')
    g.addColorStop(1, 'rgba(242,178,140,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(680 + offset, 300, 70, 44, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  // Grain.
  for (let i = 0; i < 2200; i += 1) {
    const x = random() * 1024
    const y = random() * 512
    const size = 1 + random() * 1.4
    for (const offset of [0, -1024, 1024]) {
      ctx.fillStyle = random() > 0.5 ? 'rgba(253,244,236,0.14)' : 'rgba(20,16,45,0.2)'
      ctx.fillRect(x + offset, y, size, size)
    }
  }
  // Ring baked into the texture band.
  ctx.fillStyle = 'rgba(253,244,236,0.5)'
  ctx.fillRect(0, 248, 1024, 10)
  ctx.fillStyle = 'rgba(253,244,236,0.3)'
  ctx.fillRect(0, 264, 1024, 6)
  return canvas
}

function makePlanetTexture(kind: PlanetKind): THREE.CanvasTexture {
  const canvas =
    kind === 'earth'
      ? makeEarthCanvas()
      : kind === 'moon'
        ? makeMoonSurfaceCanvas()
        : kind === 'deep-space'
          ? makeDeepSpaceSurfaceCanvas()
          : makeMarsCanvas()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  return texture
}

const HALO_COLOR: Record<PlanetKind, string> = {
  earth: '#7FB8E8',
  mars: '#E5A49A',
  moon: '#D9D9D9',
  'deep-space': '#B8A6D9',
}

const MENU_PLANET = new THREE.Vector3(-8.2, -4.6, -5)
const CABIN_PLANET = new THREE.Vector3(0.9, -1.4, -13)

/**
 * The big backdrop planet. The main menu and the outside approach
 * flight always show Earth (home, where the adventure starts). Only
 * INSIDE the cabin does the window show the last mission's
 * destination from the persisted passport (Earth before any
 * mission). The launch reuses it as the destination planet.
 */
function BackdropPlanet() {
  const groupRef = useRef<THREE.Group>(null)
  const outerRef = useRef<THREE.Group>(null)
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const destination = useOnboardingStore((state) => state.passport?.destination ?? null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  // Earth (home) in the menu AND during the outside approach flight
  // to the ship. Only INSIDE the cabin does the window reflect the
  // last mission's destination. The launch keeps showing the chosen
  // destination (it is already the latest recorded mission).
  const kind: PlanetKind =
    phase === 'menu' || (phase !== 'launching' && boardingStage === 'approach')
      ? 'earth'
      : destinationPlanetKind(destination)
  const texture = useMemo(() => makePlanetTexture(kind), [kind])
  const targetPlanet = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => () => texture.dispose(), [texture])

  useFrame((_, delta) => {
    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.y += delta * 0.02
    }
    // One planet for both shots: it glides behind the window wall
    // during the approach flight, so it is already in place when
    // the cabin view cuts in.
    const outer = outerRef.current
    if (!outer) return
    if (phase === 'launching') {
      // Inside the cabin (ignition + countdown) the planet is
      // simply seen through the window, as during the cabin steps.
      if (inCabinStage(launchClock.value, reducedMotion)) {
        outer.visible = true
        outer.scale.setScalar(1)
        outer.position.copy(CABIN_PLANET)
        return
      }
      // In space the backdrop planet becomes the DESTINATION: it appears
      // far, small and ahead-left only near the end, then grows as
      // the ship approaches it linearly. (A future zone only swaps
      // this texture/position — the approach follows this timeline.)
      const approach = marsApproach(launchClock.value, reducedMotion)
      outer.visible = approach > 0.002
      if (!outer.visible) return
      // Fluid entrance: eased approach (slow at first) AND a fade-in,
      // so the planet grows into frame instead of popping in big.
      const eased = approach * approach * (3 - 2 * approach)
      const fade = Math.min(1, approach / 0.3)
      targetPlanet.set(-14 + eased * 4.5, -0.8 - eased * 3, -10 + eased * 3.5)
      outer.scale.setScalar(0.18 + eased * 1.05)
      outer.position.copy(targetPlanet)
      outer.traverse((child) => {
        const material = (child as THREE.Mesh).material as THREE.Material | undefined
        if (!material) return
        material.transparent = true
        material.opacity = (child.scale.x > 1 ? 0.1 : 1) * fade
      })
      return
    }
    outer.visible = true
    outer.scale.setScalar(1)
    // Undo the launch fade-in (materials were made transparent).
    outer.traverse((child) => {
      const material = (child as THREE.Mesh).material as THREE.Material | undefined
      if (!material) return
      if (child.scale.x > 1) {
        material.opacity = 0.1
      } else {
        material.transparent = false
        material.opacity = 1
      }
    })
    targetPlanet.copy(phase === 'menu' ? MENU_PLANET : CABIN_PLANET)
    if (reducedMotion) {
      outer.position.copy(targetPlanet)
    } else {
      outer.position.x = THREE.MathUtils.damp(outer.position.x, targetPlanet.x, 1.1, delta)
      outer.position.y = THREE.MathUtils.damp(outer.position.y, targetPlanet.y, 1.1, delta)
      outer.position.z = THREE.MathUtils.damp(outer.position.z, targetPlanet.z, 1.1, delta)
    }
  })

  return (
    <group ref={outerRef} position={MENU_PLANET}>
      {/* Soft atmospheric halo, back-side only. */}
      <mesh scale={1.03}>
        <sphereGeometry args={[PLANET_RADIUS, 48, 32]} />
        <meshBasicMaterial
          color={HALO_COLOR[kind]}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[PLANET_RADIUS, 64, 48]} />
          {/* Relief: the same painted texture as a bump map, so
              continents, craters and grain catch the light. */}
          <meshStandardMaterial map={texture} bumpMap={texture} bumpScale={0.12} roughness={0.95} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

/* The Mailwing ship: profile view, drifting, thruster flickering      */
/* ------------------------------------------------------------------ */

const PLUME_COUNT = 110
const PLUME_LENGTH = 1.15

/**
 * Thruster exhaust as particles: sparks are born at the engine nozzle,
 * stream backwards (-Y in ship space) widening and cooling from white-hot
 * yellow to deep orange. With additive blending, faded particles approach
 * black and disappear — no cone, no elastic scaling.
 */
function ThrusterPlume() {
  const pointsRef = useRef<THREE.Points>(null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const phase = useOnboardingStore((state) => state.phase)

  const { geometry, seeds } = useMemo(() => {
    const positions = new Float32Array(PLUME_COUNT * 3)
    const colors = new Float32Array(PLUME_COUNT * 3)
    const random = mulberry32(0x7e57)
    const particleSeeds = Array.from({ length: PLUME_COUNT }, () => ({
      age: random(),
      angle: random() * Math.PI * 2,
      radius: Math.sqrt(random()) * 0.1,
      speed: 0.85 + random() * 0.3,
    }))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return { geometry: geo, seeds: particleSeeds }
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const hot = useMemo(() => new THREE.Color('#FFF3D0'), [])
  const warm = useMemo(() => new THREE.Color('#FFBA70'), [])
  const cool = useMemo(() => new THREE.Color('#C65A2E'), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute
    // During the launch the plume stretches with the ship's speed.
    let thrust = 1
    if (phase === 'launching') {
      const stage = stageAt(launchClock.value, reducedMotion).stage
      thrust =
        stage === 'accelerate'
          ? 1.6
          : stage === 'arrive'
            ? 0.9
            : stage === 'space'
              ? 0.8
              : stage === 'ignition'
                ? 0.35
                : 1.1
    }
    for (let index = 0; index < PLUME_COUNT; index += 1) {
      const seed = seeds[index]
      if (!seed) continue
      if (!reducedMotion) {
        seed.age += (delta / 0.75) * seed.speed * thrust
        if (seed.age > 1) seed.age -= 1
      }
      const age = seed.age
      const spread = seed.radius * (0.4 + age * 1.6)
      positions.setXYZ(
        index,
        Math.cos(seed.angle) * spread,
        -1.18 - age * PLUME_LENGTH * thrust,
        Math.sin(seed.angle) * spread,
      )
      // Colour cools as the particle ages; the oldest fade to black.
      if (age < 0.35) tmpColor.copy(hot).lerp(warm, age / 0.35)
      else tmpColor.copy(warm).lerp(cool, (age - 0.35) / 0.65)
      const fade = Math.max(0, 1 - Math.max(0, age - 0.55) / 0.45)
      colors.setXYZ(index, tmpColor.r * fade, tmpColor.g * fade, tmpColor.b * fade)
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.11}
        vertexColors
        transparent
        opacity={0.95}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/**
 * Name tag that floats ABOVE the ship during the cruise (a
 * billboarded sprite, always facing the camera) — the explorer's
 * name as a simple identifier, not painted on the hull. That way
 * the ship never needs to turn mid-flight just to show it.
 */
function makeNameTagTexture(name: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 512, 160)
  const label = name || 'Carrier'
  ctx.font = '800 58px system-ui, sans-serif'
  const fit = (text: string, maxWidth: number): string => {
    let value = text
    while (value.length > 2 && ctx.measureText(value).width > maxWidth) value = value.slice(0, -1)
    return value.length < text.length ? `${value}…` : value
  }
  const text = fit(`✉ ${label}`, 440)
  const w = Math.min(480, ctx.measureText(text).width + 56)
  const x = (512 - w) / 2
  // Pill background.
  ctx.fillStyle = 'rgba(27,16,41,0.82)'
  ctx.strokeStyle = 'rgba(255,217,168,0.7)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.roundRect(x, 38, w, 84, 42)
  ctx.fill()
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FDF4EC'
  ctx.fillText(text, 256, 96)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function MailShip() {
  const groupRef = useRef<THREE.Group>(null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const explorerName = useOnboardingStore((state) => state.passport?.explorerName ?? '')
  const { scene } = useGLTF(SHIP_URL)
  // Inside the cabin the exterior ship is hidden: we are within it.
  // (During the approach stage it is the whole point, so it stays.
  // During launching we are back in the wide menu shot, so it stays
  // too — it is already flying there.)
  const cabin = phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin'
  const nameTagTexture = useMemo(() => (phase === 'launching' ? makeNameTagTexture(explorerName) : null), [phase, explorerName])
  useEffect(() => () => nameTagTexture?.dispose(), [nameTagTexture])
  const nameTagRef = useRef<THREE.Sprite>(null)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const time = state.clock.elapsedTime
    // The pod flies toward Mars (lower-left). Empirically, with the window
    // turned to camera (rotation.y ~ PI), a roll of about -90° puts the
    // nose down-left toward the planet and the engine up-right behind it.
    const baseRoll = -1.57

    if (phase === 'launching') {
      const { stage } = stageAt(launchClock.value, reducedMotion)
      // While the countdown runs we are INSIDE the cabin: the
      // exterior ship is not shown at all.
      group.visible = !inCabinStage(launchClock.value, reducedMotion)
      const distance = cruiseDistance(launchClock.value, reducedMotion)
      const descent = descentProgress(launchClock.value, reducedMotion)
      // LINEAR cruise: we are already in space, so the ship travels
      // in a straight line (mostly -X, slightly down/away) at a
      // steady rate — no curving dive, no quadratic dash. In arrive
      // it keeps closing in toward the planet (left) while it
      // descends only gently, so it stays high in the frame — it is
      // heading TO the planet, not falling past it.
      const closingIn = Math.min(descent, 0.5) / 0.5
      group.position.set(
        5.4 - distance - closingIn * 1.4,
        -0.6 - distance * 0.06 - descent * 1.1,
        -0.5 - distance * 0.05,
      )
      // Orientation: flying pose (nose toward the destination) the
      // whole cruise — the name floats above as a tag, so the hull
      // never turns mid-flight. At arrive it first INCLINES toward
      // the planet (roll a bit past the flying pose, nose canted
      // down-left at it), then ENDRECHOS fully upright (roll -> 0,
      // nose up, window to camera) to descend and land standing —
      // never nose-first into the ground. The incline is GENTLE
      // (-2.0) and SLOW (lambda 1.2), and the yaw only swings to
      // the window pose once the ship is already upright: swinging
      // roll and yaw together is what flipped it almost upside-down.
      const pose = shipPoseAt(launchClock.value, reducedMotion)
      const arriving = pose === 'land'
      const straightening = arriving && descent >= 0.5
      const targetRoll = arriving ? (straightening ? 0 : -2.0) : baseRoll
      group.rotation.z = THREE.MathUtils.damp(
        group.rotation.z,
        targetRoll + (!arriving && !reducedMotion ? Math.sin(time * 0.4) * 0.03 : 0),
        arriving ? 1.2 : 2.5,
        delta,
      )
      group.rotation.y = THREE.MathUtils.damp(
        group.rotation.y,
        straightening ? Math.PI : Math.PI - 0.5,
        2,
        delta,
      )
      if (!reducedMotion && !arriving) {
        group.position.y += Math.sin(time * 0.55) * 0.12
      }
      // Liftoff rumble (the countdown rumble happens in the cabin).
      if (!reducedMotion && stage === 'liftoff') {
        group.position.x += Math.sin(time * 47) * 0.03
        group.position.y += Math.sin(time * 39) * 0.02
      }
      // Name tag above the ship during the cruise, fading out as
      // the descent begins.
      const tag = nameTagRef.current
      if (tag) {
        const material = tag.material as THREE.SpriteMaterial
        const fadeIn = Math.min(1, Math.max(0, (distance - 0.2) / 0.8))
        const fadeOut = arriving ? Math.max(0, 1 - descent * 1.6) : 1
        material.opacity = fadeIn * fadeOut
        tag.visible = material.opacity > 0.01
      }
      return
    }

    if (reducedMotion) {
      group.position.y = -0.6
      group.rotation.z = baseRoll
      return
    }
    // Menu idle: a gentle three-quarter drift (yaw a touch more
    // frontal than the cruise pose) with a very subtle bob, so the
    // ship feels alive without distracting from the options.
    group.position.y = -0.6 + Math.sin(time * 0.55) * 0.14
    group.rotation.z = baseRoll + Math.sin(time * 0.4) * 0.02
    group.rotation.y = Math.PI - 0.35 + Math.sin(time * 0.3) * 0.04
  })

  if (cabin) return null

  return (
    <group ref={groupRef} position={[5.4, -0.6, -0.5]} rotation={[0.08, Math.PI - 0.5, -1.57]} scale={1.9}>
      {/* Inner offset centres the ~2.5 m tall pod on the group origin. */}
      <group position={[0, -1.05, 0]}>
        <primitive object={scene} />
      </group>
      <ThrusterPlume />
      {/* Name tag floating above the ship. In the flying pose the
          group's local -X points world-up, so the sprite sits
          overhead; sprites always face the camera, so it reads. */}
      {nameTagTexture && (
        <sprite ref={nameTagRef} position={[-1.15, 0, 0]} scale={[1.9, 0.6, 1]}>
          <spriteMaterial map={nameTagTexture} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </sprite>
      )}
    </group>
  )
}

type CabinExpression = 'curious' | 'happy' | 'thinking' | 'surprised'

function expressionForPhase(phase: string): CabinExpression {
  switch (phase) {
    case 'reveal':
      return 'surprised'
    case 'module':
    case 'passport':
      return 'happy'
    case 'name':
      return 'thinking'
    default:
      return 'curious'
  }
}

/**
 * PIP in miniature, in the same expressive language as the in-game
 * Companion: cream shell, dark screen face, pink eyes, antenna. Eyes
 * blink, the mouth follows the expression, and the body floats with a
 * happy wiggle when the moment calls for it.
 */
function CabinPip() {
  const groupRef = useRef<THREE.Group>(null)
  const eyeLeftRef = useRef<THREE.Mesh>(null)
  const eyeRightRef = useRef<THREE.Mesh>(null)
  const mouthRef = useRef<THREE.Mesh>(null)
  const antennaRef = useRef<THREE.Group>(null)
  const phase = useOnboardingStore((state) => state.phase)
  const pipTalking = useOnboardingStore((state) => state.pipTalking)
  const tutorialDone = useOnboardingStore((state) => state.tutorialDone)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const expression = expressionForPhase(phase)
  // Framing spot: dead ahead and bigger during the tutorial ritual,
  // gliding to the diagonal hub spot once the tutorial is done.
  const pipTarget = tutorialDone
    ? { x: 0.9, y: 0.14, z: -2.2, scale: 0.85 }
    : { x: 0.05, y: 0.18, z: -2.35, scale: 1.15 }
  // Smoothed amplitudes: talking <-> resting blends over ~0.5s instead
  // of switching frequencies, which used to make PIP jump (reposition)
  // the instant he finished a line or the player clicked the bubble.
  const bobAmpRef = useRef(0.07)
  const swayAmpRef = useRef(0.03)
  const antennaAmpRef = useRef(0.05)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const time = state.clock.elapsedTime
    group.lookAt(state.camera.position)
    // Pip rotation in the cabin
    group.rotateZ(0.02)
    const talking = pipTalking && !reducedMotion
    const damp = THREE.MathUtils.damp
    // Glide between the tutorial spot and the hub spot, around the
    // floating bob.
    group.position.x = damp(group.position.x, pipTarget.x, 2, delta)
    group.position.z = damp(group.position.z, pipTarget.z, 2, delta)
    group.scale.setScalar(damp(group.scale.x, pipTarget.scale, 2, delta))
    if (!reducedMotion) {
      bobAmpRef.current = damp(bobAmpRef.current, talking ? 0.11 : 0.07, 5, delta)
      swayAmpRef.current = damp(swayAmpRef.current, talking ? 0.06 : 0.03, 5, delta)
      antennaAmpRef.current = damp(antennaAmpRef.current, talking ? 0.18 : 0.05, 5, delta)
      // Fixed frequencies: only the amplitudes blend, never the phase.
      group.position.y = pipTarget.y + Math.sin(time * 1.9) * bobAmpRef.current
      // Additive sway ON TOP of the knob roll from rotateZ above — an
      // absolute assignment here used to erase the roll every frame.
      group.rotation.z += Math.sin(time * 2.4) * swayAmpRef.current
    }
    // Blink: eyes squash briefly every few seconds.
    const blink = !reducedMotion && time % 3.4 > 3.25
    const eyeScaleY = blink ? 0.12 : expression === 'happy' ? 0.75 : 1
    eyeLeftRef.current?.scale.set(1, eyeScaleY, 1)
    eyeRightRef.current?.scale.set(1, eyeScaleY, 1)
    // Mouth: while talking it opens and closes like syllables; at rest it
    // settles into the expression (line, smile, open only when surprised).
    // The transform itself is damped so line swaps never pop.
    const mouth = mouthRef.current
    if (mouth) {
      let targetX = 1.6
      let targetY = 0.32
      if (talking) {
        const syllable = Math.abs(Math.sin(time * 13) * 0.7 + Math.sin(time * 7.3) * 0.3)
        targetX = 1.15 - syllable * 0.25
        targetY = 0.3 + syllable * 1.1
      } else if (expression === 'surprised') {
        targetX = 0.6
        targetY = 1.6
      } else if (expression === 'happy') {
        targetX = 1.7
        targetY = 0.6
      } else if (expression === 'thinking') {
        targetX = 0.5
        targetY = 0.45
      }
      const mouthLambda = talking ? 18 : 10
      mouth.scale.x = damp(mouth.scale.x, targetX, mouthLambda, delta)
      mouth.scale.y = damp(mouth.scale.y, targetY, mouthLambda, delta)
    }
    // Antenna wiggles while talking, like the in-game PIP (fixed
    // frequency + blended amplitude, so no phase jump on toggle).
    if (antennaRef.current) {
      antennaRef.current.rotation.z = Math.sin(time * 4) * antennaAmpRef.current
    }
  })

  return (
    <group ref={groupRef} position={[0.05, 0.18, -2.35]} scale={1.15}>
      {/* Shell */}
      <mesh>
        <sphereGeometry args={[0.32, 28, 20]} />
        <meshStandardMaterial color="#F2EAE5" roughness={0.55} />
      </mesh>
      {/* Screen face: protrudes past the shell so the dark screen reads */}
      <mesh position={[0, 0.02, 0.20]} scale={[1, 0.82, 0.7]}>
        <sphereGeometry args={[0.24, 24, 18]} />
        <meshStandardMaterial color="#17172E" roughness={0.35} />
      </mesh>
      {/* Eyes */}
      <mesh ref={eyeLeftRef} position={[-0.085, 0.06, 0.36]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshBasicMaterial color="#F2B5E2" toneMapped={false} />
      </mesh>
      <mesh ref={eyeRightRef} position={[0.085, 0.06, 0.36]}>
        <sphereGeometry args={[0.035, 10, 8]} />
        <meshBasicMaterial color="#F2B5E2" toneMapped={false} />
      </mesh>
      {/* Mouth */}
      <mesh ref={mouthRef} position={[0, -0.06, 0.36]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial color="#F2B5E2" toneMapped={false} />
      </mesh>
      {/* Antenna */}
      <group ref={antennaRef} position={[0.14, 0.30, 0]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
          <meshStandardMaterial color="#75658C" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.17, 0]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshBasicMaterial color="#F2B5E2" toneMapped={false} />
        </mesh>
      </group>
      {/* Side stabilizers + warm thruster dot */}
      <mesh position={[-0.34, -0.05, 0]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#75658C" roughness={0.5} />
      </mesh>
      <mesh position={[0.34, -0.05, 0]}>
        <sphereGeometry args={[0.07, 12, 10]} />
        <meshStandardMaterial color="#75658C" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.33, 0]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial color="#FFBA70" toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Console local coordinate system                                     */
/*                                                                     */
/* The console board is a 2.5 x 0.7 box centred on the (tilted)       */
/* console group origin, so in board-local space its top face is the   */
/* plane y = 0.225 spanning x in [-1.25, 1.25], z in [-0.35, 0.35].   */
/* Every component on the board is positioned relative to that plane   */
/* and to one of three zones along x:                                  */
/*   left    navigation  centred at x = -0.6875 (frame -1.158..-0.218) */
/*   centre  controls    centred on the board's total centre, x = 0:   */
/*           the take-off button is the main action, so its axis is    */
/*           the symmetry axis of the whole console.                   */
/*   right   passport    centred at x = 0.725 (tray 0.485..0.965)      */
/* Stacking on the top face (no coplanar faces, no floating parts):   */
/*   board top 0.225 -> nav frame top 0.245 -> screen plane 0.252 ->  */
/*   radar sweep 0.258..0.270; button bezels / trays sit on 0.225.     */
/* ------------------------------------------------------------------ */
const CONSOLE_TOP_Y = 0.225
const CONSOLE_CENTER_X = 0
const NAV_ZONE_CENTER_X = -0.6875
// Passport card + support centre: shifted 0.15 left from the right
// zone's centre so the tray (0.485..0.965) sits 0.29 from the
// indicator cluster (x <= 0.195) and 0.285 from the board's right
// edge — balanced on both sides. Both the card and its support
// read this constant, so they move as one assembly.
const CARD_ZONE_CENTER_X = 0.725
const NAV_SCREEN_Y = 0.252

/** Radar sweep bar gliding across the console screen. It only shows
 *  once the route transition has fully settled back to the idle
 *  radar, so it never pops in over the fading destination cards. */
function RadarSweep({ position }: { position: [number, number, number] }) {
  const barRef = useRef<THREE.Mesh>(null)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  useFrame((state) => {
    const bar = barRef.current
    if (!bar) return
    bar.visible = routeBlend.value < 0.02
    if (reducedMotion || !bar.visible) return
    // Stroke stays inside the 0.86-wide screen: 0.36 + 0.025 (half the
    // bar) leaves a 0.045 margin to each long edge at the extremes.
    bar.position.x = position[0] + Math.sin(state.clock.elapsedTime * 0.9) * 0.36
  })

  return (
    <mesh ref={barRef} position={position}>
      {/* 0.34 long (the screen is 0.40 deep): a 0.03 margin to each
          short edge, so the bar never overhangs the frame. */}
      <boxGeometry args={[0.05, 0.012, 0.34]} />
      <meshBasicMaterial color="#8FE3D8" toneMapped={false} transparent opacity={0.9} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Diegetic hub objects: the passport card and the navigation panel    */
/* live IN the 3D cabin (canvas textures + raycast clicks). DOM keeps  */
/* a hidden mirror for keyboard / screen-reader users (see Hub).       */
/* ------------------------------------------------------------------ */

function makePassportTexture(passport: {
  explorerName: string
  trait: string
  explorerId: string
  moduleId: string
  missionNumber: number
}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 660
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 512, 660)
  gradient.addColorStop(0, '#33204a')
  gradient.addColorStop(1, '#1b1029')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 660)
  const fit = (text: string, maxWidth: number): string => {
    let value = text
    while (value.length > 4 && ctx.measureText(value).width > maxWidth) {
      value = value.slice(0, -1)
    }
    return value.length < text.length ? `${value}…` : value
  }
  ctx.strokeStyle = 'rgba(255,217,168,0.65)'
  ctx.lineWidth = 4
  ctx.strokeRect(14, 14, 484, 632)
  ctx.fillStyle = '#FFD9A8'
  ctx.font = '700 32px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('✉ Cosmic Mail', 40, 66)
  ctx.font = '600 20px ui-monospace, monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`MISSION ${passport.missionNumber}`, 472, 62)
  ctx.textAlign = 'left'
  ctx.strokeStyle = 'rgba(253,244,236,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(40, 92)
  ctx.lineTo(472, 92)
  ctx.stroke()
  // Single-column fields: no collisions on the small card.
  ctx.fillStyle = 'rgba(253,244,236,0.55)'
  ctx.font = '600 18px ui-monospace, monospace'
  const fields: [string, string][] = [
    ['EXPLORER', passport.explorerName],
    ['SPIRIT', passport.trait],
    ['MOST LIKE', passport.explorerId],
    ['FIRST MODULE', passport.moduleId],
  ]
  fields.forEach(([label, value], index) => {
    const y = 140 + index * 78
    ctx.fillText(label, 40, y)
    ctx.fillStyle = '#FDF4EC'
    ctx.font = '700 27px system-ui, sans-serif'
    ctx.fillText(fit(value, 430), 40, y + 34)
    ctx.fillStyle = 'rgba(253,244,236,0.55)'
    ctx.font = '600 18px ui-monospace, monospace'
  })
  ctx.fillText('MISSION STAMPS', 40, 496)
  ctx.strokeStyle = 'rgba(253,244,236,0.4)'
  ctx.setLineDash([8, 6])
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      ctx.strokeRect(40 + col * 74, 514 + row * 62, 62, 52)
    }
  }
  ctx.setLineDash([])
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * Navigation screen layout (canvas 860x400, matching the 0.86x0.40
 * screen on the console top). Three destination cards on the left,
 * PIP's talking column on the right. Fractions are shared by the
 * draw code and the click hit-test.
 */
const NAV_W = 860
const NAV_H = 400
const NAV_CARD_X0 = 16
const NAV_CARD_W = 268
const NAV_CARD_GAP = 12
const NAV_CARDS_Y = 64
const NAV_CARDS_H = 196
const NAV_CARDS_TOP_FRAC = NAV_CARDS_Y / NAV_H
const NAV_CARDS_BOTTOM_FRAC = (NAV_CARDS_Y + NAV_CARDS_H) / NAV_H

type NavZone = {
  id: string
  name: string
  glyph: string
  enabled: boolean
  objects: readonly string[]
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/* Representative card images, painted once and cached. Mars reuses
   the same painted surface as the 3D planet. */
let marsImageCanvas: HTMLCanvasElement | null = null
let moonImageCanvas: HTMLCanvasElement | null = null
let deepSpaceImageCanvas: HTMLCanvasElement | null = null

function makeMoonCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#10142e')
  gradient.addColorStop(1, '#050309')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 512, 256)
  const random = mulberry32(0xb00b)
  ctx.fillStyle = '#FDF4EC'
  for (let i = 0; i < 90; i += 1) {
    ctx.globalAlpha = 0.3 + random() * 0.7
    ctx.fillRect(random() * 512, random() * 256, 1.6, 1.6)
  }
  ctx.globalAlpha = 1
  // Cratered moon disc.
  ctx.fillStyle = '#D9D9D9'
  ctx.beginPath()
  ctx.arc(256, 128, 78, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(120,120,130,0.55)'
  for (let i = 0; i < 16; i += 1) {
    const a = random() * Math.PI * 2
    const d = random() * 58
    ctx.beginPath()
    ctx.arc(256 + Math.cos(a) * d, 128 + Math.sin(a) * d, 5 + random() * 13, 0, Math.PI * 2)
    ctx.fill()
  }
  return canvas
}

function makeDeepSpaceCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#070512'
  ctx.fillRect(0, 0, 512, 256)
  const random = mulberry32(0xdec0)
  // Nebula blobs.
  for (const [x, y, r, color] of [
    [140, 110, 110, 'rgba(120,90,200,0.35)'],
    [330, 150, 130, 'rgba(60,120,200,0.30)'],
    [420, 80, 80, 'rgba(230,120,180,0.22)'],
  ] as const) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 256)
  }
  ctx.fillStyle = '#FDF4EC'
  for (let i = 0; i < 160; i += 1) {
    ctx.globalAlpha = 0.35 + random() * 0.65
    ctx.fillRect(random() * 512, random() * 256, 1.7, 1.7)
  }
  ctx.globalAlpha = 1
  // Ringed planet.
  ctx.fillStyle = '#B8A6D9'
  ctx.beginPath()
  ctx.arc(360, 130, 42, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(253,244,236,0.75)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.ellipse(360, 130, 78, 20, -0.35, 0, Math.PI * 2)
  ctx.stroke()
  return canvas
}

let marsCardCanvas: HTMLCanvasElement | null = null

/** Mars as a little planet in black space, like the menu backdrop:
 *  painted surface clipped to a disc, halo and stars around it. */
function makeMarsCardCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#050309'
  ctx.fillRect(0, 0, 512, 256)
  const random = mulberry32(0x51ab5)
  ctx.fillStyle = '#FDF4EC'
  for (let i = 0; i < 110; i += 1) {
    ctx.globalAlpha = 0.3 + random() * 0.7
    ctx.fillRect(random() * 512, random() * 256, 1.6, 1.6)
  }
  ctx.globalAlpha = 1
  const cx = 256
  const cy = 128
  const r = 78
  // Atmospheric halo.
  const halo = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.5)
  halo.addColorStop(0, 'rgba(229,164,154,0.4)')
  halo.addColorStop(1, 'rgba(229,164,154,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, 512, 256)
  // Planet disc from the painted Mars surface.
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  const surface = marsImageCanvas ??= makeMarsCanvas()
  ctx.drawImage(surface, 256, 40, 512, 432, cx - r, cy - r, r * 2, r * 2)
  // Soft terminator shading, like a lit sphere.
  const shade = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  shade.addColorStop(0, 'rgba(255,240,220,0.18)')
  shade.addColorStop(0.55, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(10,4,6,0.45)')
  ctx.fillStyle = shade
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.restore()
  return canvas
}

function zoneImage(zoneId: string): HTMLCanvasElement {
  if (zoneId === 'mars') return (marsCardCanvas ??= makeMarsCardCanvas())
  if (zoneId === 'moon') return (moonImageCanvas ??= makeMoonCanvas())
  return (deepSpaceImageCanvas ??= makeDeepSpaceCanvas())
}

function drawLock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.strokeStyle = '#FFD9A8'
  ctx.lineWidth = s * 0.16
  ctx.beginPath()
  ctx.arc(cx, cy - s * 0.18, s * 0.34, Math.PI, 0)
  ctx.stroke()
  ctx.fillStyle = '#FFD9A8'
  roundRectPath(ctx, cx - s * 0.5, cy - s * 0.2, s, s * 0.75, s * 0.14)
  ctx.fill()
  ctx.fillStyle = '#1B1029'
  ctx.beginPath()
  ctx.arc(cx, cy + s * 0.12, s * 0.12, 0, Math.PI * 2)
  ctx.fill()
}

/** The navigation screen at rest: idle radar rings, no destinations.
 *  While locked (PIP has not said "tap the radar screen" yet) there
 *  is no TAP FOR ROUTE prompt — the panel is inert decoration. */
function drawRadarIdle(ctx: CanvasRenderingContext2D, unlocked: boolean): void {
  const gradient = ctx.createLinearGradient(0, 0, NAV_W, NAV_H)
  gradient.addColorStop(0, '#14524A')
  gradient.addColorStop(1, '#0B2E29')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, NAV_W, NAV_H)
  ctx.strokeStyle = 'rgba(143,227,216,0.7)'
  ctx.lineWidth = 3
  ctx.strokeRect(8, 8, NAV_W - 16, NAV_H - 16)
  ctx.fillStyle = '#8FE3D8'
  ctx.font = '700 34px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('NAVIGATION', 24, 52)
  // Radar rings around the screen centre.
  ctx.strokeStyle = 'rgba(143,227,216,0.45)'
  ctx.lineWidth = 2
  for (const radius of [50, 100, 150]) {
    ctx.beginPath()
    ctx.arc(NAV_W / 2, NAV_H / 2 + 20, radius, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#FDF4EC'
  ctx.font = '800 34px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(143,227,216,0.8)'
  ctx.shadowBlur = 12
  if (unlocked) ctx.fillText('TAP FOR ROUTE', NAV_W / 2, NAV_H - 40)
  ctx.shadowBlur = 0
  ctx.textAlign = 'left'
}

/** Route summary after tapping a destination: big image, the objects
 *  on the route, and the SELECCIONAR button that confirms it. */
function drawSummary(ctx: CanvasRenderingContext2D, zone: NavZone): void {
  // Big representative image.
  const imgX = 16
  const imgY = NAV_CARDS_Y
  const imgW = 460
  const imgH = NAV_CARDS_H
  const image = zoneImage(zone.id)
  ctx.save()
  roundRectPath(ctx, imgX, imgY, imgW, imgH, 14)
  ctx.clip()
  const srcAspect = imgW / imgH
  const srcW = Math.min(image.width, image.height * srcAspect)
  const srcH = Math.min(image.height, image.width / srcAspect)
  ctx.drawImage(
    image,
    (image.width - srcW) / 2,
    (image.height - srcH) / 2,
    srcW,
    srcH,
    imgX,
    imgY,
    imgW,
    imgH,
  )
  ctx.restore()
  ctx.strokeStyle = '#8FE3D8'
  ctx.lineWidth = 3
  roundRectPath(ctx, imgX, imgY, imgW, imgH, 14)
  ctx.stroke()
  // Destination name + object summary.
  ctx.fillStyle = '#FDF4EC'
  ctx.font = '800 40px system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(zone.name, 500, 104)
  ctx.fillStyle = '#8FE3D8'
  ctx.font = '700 20px ui-monospace, monospace'
  ctx.fillText('OBJECTS ON THIS ROUTE', 500, 140)
  ctx.fillStyle = '#FDF4EC'
  ctx.font = '600 24px system-ui, sans-serif'
  zone.objects.forEach((object, index) => {
    const y = 176 + index * 32
    ctx.fillStyle = '#8FE3D8'
    ctx.beginPath()
    ctx.arc(508, y - 8, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FDF4EC'
    ctx.fillText(object, 524, y)
  })
  // SELECT (confirm) and BACK (to the cards): same height.
  ctx.fillStyle = '#FFD9A8'
  roundRectPath(ctx, 220, 312, 420, 56, 14)
  ctx.fill()
  ctx.fillStyle = '#1B1029'
  ctx.font = '800 30px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('SELECT', 430, 350)
  ctx.strokeStyle = 'rgba(143,227,216,0.7)'
  ctx.lineWidth = 2
  roundRectPath(ctx, 16, 312, 180, 56, 14)
  ctx.stroke()
  ctx.fillStyle = '#8FE3D8'
  ctx.font = '700 24px ui-monospace, monospace'
  ctx.fillText('← BACK', 106, 350)
  ctx.textAlign = 'left'
}

function drawDestinations(
  ctx: CanvasRenderingContext2D,
  zones: readonly NavZone[],
  selectedId: string | null,
): void {
  const gradient = ctx.createLinearGradient(0, 0, NAV_W, NAV_H)
  gradient.addColorStop(0, 'rgba(67,120,140,0.92)')
  gradient.addColorStop(1, 'rgba(27,16,41,0.95)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, NAV_W, NAV_H)
  ctx.strokeStyle = 'rgba(143,227,216,0.7)'
  ctx.lineWidth = 3
  ctx.strokeRect(8, 8, NAV_W - 16, NAV_H - 16)
  ctx.fillStyle = '#A8F0E4'
  ctx.font = '700 34px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('NAVIGATION', 24, 52)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#FDF4EC'
  // Ambiguity avoided: nothing is locked until SELECT confirms it.
  ctx.fillText(selectedId ? 'ROUTE SUMMARY' : 'PICK A DESTINATION', NAV_W - 24, 52)
  ctx.textAlign = 'left'

  const selected = zones.find((zone) => zone.id === selectedId)

  if (selected) {
    drawSummary(ctx, selected)
  }

  if (!selected) zones.forEach((zone, index) => {
    const x = NAV_CARD_X0 + index * (NAV_CARD_W + NAV_CARD_GAP)
    const y = NAV_CARDS_Y
    const isSelected = zone.id === selectedId
    // Card body.
    ctx.fillStyle = isSelected ? 'rgba(143,227,216,0.18)' : 'rgba(216,244,240,0.06)'
    roundRectPath(ctx, x, y, NAV_CARD_W, NAV_CARDS_H, 14)
    ctx.fill()
    ctx.strokeStyle = isSelected ? '#8FE3D8' : 'rgba(253,244,236,0.3)'
    ctx.lineWidth = isSelected ? 4 : 2
    roundRectPath(ctx, x, y, NAV_CARD_W, NAV_CARDS_H, 14)
    ctx.stroke()
    // Representative image.
    const imgX = x + 10
    const imgY = y + 10
    const imgW = NAV_CARD_W - 20
    const imgH = 118
    const image = zoneImage(zone.id)
    ctx.save()
    roundRectPath(ctx, imgX, imgY, imgW, imgH, 10)
    ctx.clip()
    // Crop the source to the image aspect (Mars canvas is 1024x512).
    const srcAspect = imgW / imgH
    const srcW = Math.min(image.width, image.height * srcAspect)
    const srcH = Math.min(image.height, image.width / srcAspect)
    ctx.drawImage(
      image,
      (image.width - srcW) / 2,
      (image.height - srcH) / 2,
      srcW,
      srcH,
      imgX,
      imgY,
      imgW,
      imgH,
    )
    if (!zone.enabled) {
      // Locked destinations: image dimmed under a padlock.
      ctx.fillStyle = 'rgba(5,3,9,0.58)'
      ctx.fillRect(imgX, imgY, imgW, imgH)
    }
    ctx.restore()
    if (!zone.enabled) {
      drawLock(ctx, imgX + imgW / 2, imgY + imgH / 2, 44)
    }
    // Name + status under the image (no glyph icons on the names).
    ctx.fillStyle = '#FDF4EC'
    ctx.font = '700 28px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(zone.name, x + 12, imgY + imgH + 36)
    ctx.font = '600 21px ui-monospace, monospace'
    ctx.fillStyle = zone.enabled ? 'rgba(253,244,236,0.9)' : 'rgba(253,244,236,0.68)'
    ctx.fillText(
      zone.enabled ? `${zone.objects.length} objects` : 'COMING SOON',
      x + 12,
      imgY + imgH + 64,
    )
  })

  // No take-off text here: this screen only selects. Confirming with
  // SELECT sends the pilot back to the cabin, where the big button's
  // lid lifts.
}

/**
 * The whole navigation screen: idle radar first, and as the pilot
 * leans in (`alpha` follows the route blend) the cards fade in over
 * it — TAP FOR ROUTE stays until the content takes over.
 */
function drawNavScreen(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  zones: readonly NavZone[],
  selectedId: string | null,
  unlocked: boolean,
): void {
  drawRadarIdle(ctx, unlocked)
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  drawDestinations(ctx, zones, selectedId)
  ctx.restore()
}

/** Passport card pinned on the cabin wall; click opens the detail view. */
function PassportCard3D() {
  const passport = useOnboardingStore((state) => state.passport)
  const detailOpen = useOnboardingStore((state) => state.passportDetailOpen)
  const setPassportDetailOpen = useOnboardingStore((state) => state.setPassportDetailOpen)
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null)

  // Only the card face ABOVE the slot is clickable: without this,
  // clicks through/under the board still hit the part of the plane
  // hidden inside the console and opened the detail from below.
  const isOnCardFace = (point: THREE.Vector3): boolean => {
    const group = groupRef.current
    if (!group) return false
    // Force fresh matrices: on the very first hover the group's
    // matrixWorld may be stale, which made the first pass miss and
    // only the second hover work.
    group.updateWorldMatrix(false, true)
    const local = group.worldToLocal(point.clone())
    return Math.abs(local.x) < 0.33 && local.y > -0.15
  }

  const texture = useMemo(() => {
    if (!passport) return null
    return makePassportTexture({
      explorerName: passport.explorerName,
      trait: getTrait(passport.trait).name,
      explorerId: getExplorer(passport.explorerId).name,
      moduleId: getModule(passport.moduleId).name,
      missionNumber: passport.missionNumber,
    })
  }, [passport])

  useEffect(() => () => texture?.dispose(), [texture])

  // The card keeps a fixed orientation like the controls around it:
  // leaning back slightly on the board, facing the same way as the
  // take-off button (toward the pilot/camera). No billboarding —
  // that hid the slot groove and looked detached from the console.
  // No yaw/roll: the card is aligned with the board and with its
  // support (right zone, centre x = 0.725). Its pivot stays at the
  // card centre, so the isOnCardFace hit-test is unchanged. The foot
  // (half-height 0.385 x 0.55 = 0.212 along the lean) lands exactly
  // on the support tray top (y = 0.25) at z = -0.10:
  //   foot y = 0.449 - 0.212 * cos(0.35) = 0.250
  //   foot z = -0.173 + 0.212 * sin(0.35) = -0.100

  // While the detail is open, the 3D card leaves the console (it is
  // "in hand" now, not duplicated on the desk).
  if (!passport || !texture || detailOpen) return null
  return (
    // Standing on its support tray in the right zone, leaning
    // back like a card propped on the dashboard.
    <group
      ref={groupRef}
      position={[CARD_ZONE_CENTER_X, 0.449, -0.173]}
      rotation={[-0.35, 0, 0]}
      scale={0.55 * (hovered ? 1.06 : 1)}
    >
      <mesh position={[0, 0, -0.012]}>
        <planeGeometry args={[0.66, 0.83]} />
        <meshStandardMaterial color="#9A7433" roughness={0.45} metalness={0.5} />
      </mesh>

      <mesh
        onPointerDown={(event) => {
          event.stopPropagation()
          if (!isOnCardFace(event.point)) return
          setPassportDetailOpen(true)
        }}
        onPointerOver={(event) => {
          if (!isOnCardFace(event.point)) return
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerMove={(event) => {
          // Backup for a missed pointerover (e.g. after the hover
          // scale shifted the geometry under the cursor) — and the
          // release when the pointer slides below the slot: the
          // visible face ends there, even if the ray still hits the
          // hidden part of the plane inside the board.
          if (isOnCardFace(event.point)) {
            if (!hovered) {
              setHovered(true)
              document.body.style.cursor = 'pointer'
            }
          } else if (hovered) {
            setHovered(false)
            document.body.style.cursor = 'auto'
          }
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <planeGeometry args={[0.6, 0.77]} />
        <meshBasicMaterial
          map={texture}
          toneMapped={false}
          color={hovered ? '#FFE9C9' : '#FFFFFF'}
        />
      </mesh>
    </group>
  )
}

/**
 * Navigation screen set into the console top, where the radar used to
 * be a plain green inset. At rest it shows the idle radar with
 * TAP FOR ROUTE; as the pilot leans in, the destination cards (and
 * PIP's talking column) fade in over it, and the same face takes the
 * card / take-off clicks. Rendered as a child of the console group,
 * lying flat on its top.
 */
function NavScreenOnBoard() {
  const phase = useOnboardingStore((state) => state.phase)
  const unlocked = useOnboardingStore((state) => isNavigationUnlocked(state))
  const selectedZoneId = useOnboardingStore((state) => state.selectedZoneId)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const setRouteOpen = useOnboardingStore((state) => state.setRouteOpen)
  const selectZone = useOnboardingStore((state) => state.selectZone)
  const clearSelection = useOnboardingStore((state) => state.clearSelection)
  const confirmRoute = useOnboardingStore((state) => state.confirmRoute)
  const [hovered, setHovered] = useState(false)

  // One canvas + texture for the screen's whole life; the contents
  // are redrawn only while the blend or the selection changes.
  const screen = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = NAV_W
    canvas.height = NAV_H
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return { canvas, ctx: canvas.getContext('2d')!, texture }
  }, [])
  useEffect(() => () => screen.texture.dispose(), [screen])

  const lastDrawnRef = useRef({ blend: -1, selected: undefined as string | null | undefined, unlocked: false })
  useFrame(() => {
    // The fade runs a little ahead of the camera travel, so the
    // content is fully in (or fully gone) before the approach ends,
    // instead of dissolving while already far away.
    const blend = smoothstep(Math.min(1, routeBlend.value * 1.6))
    const last = lastDrawnRef.current
    if (blend === last.blend && selectedZoneId === last.selected && unlocked === last.unlocked) return
    drawNavScreen(screen.ctx, blend, ZONES, selectedZoneId, unlocked)
    screen.texture.needsUpdate = true
    last.blend = blend
    last.selected = selectedZoneId
    last.unlocked = unlocked
  })

  return (
    <mesh
      position={[NAV_ZONE_CENTER_X, NAV_SCREEN_Y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        // The board controls only respond in the hub: during the
        // discovery ritual the radar is inert decoration. And in the
        // hub tutorial they stay inert until PIP says "tap the radar
        // screen" — only then does tapping lean the camera to the
        // side close-up (routeOpen) and show the destinations.
        if (phase !== 'hub' || !unlocked) return
        if (!routeOpen) {
          setRouteOpen(true)
          return
        }
        const uv = event.uv
        if (!uv) return
        const yFromTop = 1 - uv.y
        if (selectedZoneId) {
          // Summary view: SELECT confirms and sends the pilot back
          // to the cabin (where the take-off lid lifts); BACK goes
          // back to the cards.
          if (uv.x >= 220 / NAV_W && uv.x <= 640 / NAV_W && yFromTop >= 0.78 && yFromTop <= 0.92) {
            confirmRoute()
            setRouteOpen(false)
            return
          }
          if (uv.x >= 16 / NAV_W && uv.x <= 196 / NAV_W && yFromTop >= 0.78 && yFromTop <= 0.92) {
            clearSelection()
          }
          return
        }
        if (yFromTop < NAV_CARDS_TOP_FRAC || yFromTop > NAV_CARDS_BOTTOM_FRAC) return
        const index = Math.floor(
          (uv.x - NAV_CARD_X0 / NAV_W) / ((NAV_CARD_W + NAV_CARD_GAP) / NAV_W),
        )
        const zone = ZONES[index]
        if (zone && zone.enabled) selectZone(zone.id)
      }}
      onPointerOver={() => {
        setHovered(true)
        if (phase === 'hub' && unlocked) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <planeGeometry args={[0.86, 0.4]} />
      <meshBasicMaterial
        map={screen.texture}
        toneMapped={false}
        color={hovered ? '#D8FFF8' : '#FFFFFF'}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Cabin surface textures (procedural canvas)                          */
/* ------------------------------------------------------------------ */

/** Painted hull panels: base gradient, seams and rivets. */
function makePanelCanvas(
  base: string,
  dark: string,
  seam: string,
  size = 512,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, size, size)
  gradient.addColorStop(0, base)
  gradient.addColorStop(1, dark)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const random = mulberry32(0x9a37)
  // Speckle for grain.
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)'
    ctx.fillRect(random() * size, random() * size, 1.6, 1.6)
  }
  // Seams.
  ctx.strokeStyle = seam
  ctx.lineWidth = 3
  for (const frac of [1 / 3, 2 / 3]) {
    ctx.beginPath()
    ctx.moveTo(size * frac, 0)
    ctx.lineTo(size * frac, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, size * frac)
    ctx.lineTo(size, size * frac)
    ctx.stroke()
  }
  // Rivets at the seam intersections and corners.
  ctx.fillStyle = 'rgba(253,244,236,0.45)'
  for (const fx of [0.06, 1 / 3, 2 / 3, 0.94]) {
    for (const fy of [0.06, 1 / 3, 2 / 3, 0.94]) {
      ctx.beginPath()
      ctx.arc(size * fx, size * fy, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvas
}

function makePanelTexture(base: string, dark: string, seam: string): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(makePanelCanvas(base, dark, seam))
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 4
  return texture
}

/** Console top: darker dashboard with a bordered equipment area. */
function makeConsoleTopTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, '#4A3670')
  gradient.addColorStop(1, '#2C1F45')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, W, H)
  const random = mulberry32(0xc0a5)
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.12)'
    ctx.fillRect(random() * W, random() * H, 1.6, 1.6)
  }
  // Only a perimeter border: any divider line or plate painted here
  // would run underneath the screen, buttons or card support and
  // read as a moulding crossing a functional component.
  ctx.strokeStyle = 'rgba(143,227,216,0.35)'
  ctx.lineWidth = 3
  ctx.strokeRect(10, 10, W - 20, H - 20)
  // Fine engraved traces along the front and back margins (canvas
  // y = 14 / H-14, i.e. board z = +/-0.31 in either V orientation):
  // orbital-route arcs with node dots at the ends. They stay in the
  // 0.11-deep margin strips, where no screen, button or support
  // reaches (the nav frame ends at z = +/-0.24), and components
  // sitting on the board cover them anyway where they overlap.
  ctx.strokeStyle = 'rgba(143,227,216,0.28)'
  ctx.lineWidth = 2
  for (const y of [14, H - 14]) {
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.quadraticCurveTo(W / 2, y + (y < H / 2 ? 6 : -6), W - 24, y)
    ctx.stroke()
    for (const x of [24, W - 24]) {
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.fillStyle = 'rgba(253,244,236,0.5)'
  for (const [x, y] of [
    [18, 18],
    [W - 18, 18],
    [18, H - 18],
    [W - 18, H - 18],
  ] as const) {
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Subtle Cosmic Mail identity decal for the front wall: an
 *  envelope with a route arc, drawn in cream on transparent. */
function makeMailDecalTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.strokeStyle = 'rgba(253,244,236,0.85)'
  ctx.fillStyle = 'rgba(253,244,236,0.85)'
  ctx.lineWidth = 6
  // Envelope body.
  roundRectPath(ctx, 76, 56, 200, 130, 10)
  ctx.stroke()
  // Flap.
  ctx.beginPath()
  ctx.moveTo(76, 66)
  ctx.lineTo(176, 140)
  ctx.lineTo(276, 66)
  ctx.stroke()
  // Route arc out of the envelope toward the top right.
  ctx.setLineDash([12, 10])
  ctx.beginPath()
  ctx.moveTo(286, 120)
  ctx.quadraticCurveTo(380, 40, 470, 70)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(470, 70, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '700 34px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('COSMIC MAIL', 76, 228)
  ctx.font = '600 20px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(253,244,236,0.55)'
  ctx.fillText('MARS POSTAL SERVICE', 76, 252 - 8)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Small dark plate label for the outgoing-mail slot: an envelope
 *  glyph and OUTGOING MAIL in cream monospace. Purely decorative
 *  for now; the slot geometry it labels is a plain recess, so a
 *  future mail-delivery interaction can reuse it as-is. */
function makeSlotLabelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#241736'
  ctx.fillRect(0, 0, 512, 96)
  ctx.strokeStyle = 'rgba(253,244,236,0.85)'
  ctx.fillStyle = 'rgba(253,244,236,0.85)'
  ctx.lineWidth = 5
  // Envelope glyph.
  roundRectPath(ctx, 28, 22, 72, 52, 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(28, 28)
  ctx.lineTo(64, 54)
  ctx.lineTo(100, 28)
  ctx.stroke()
  ctx.font = '700 34px ui-monospace, monospace'
  ctx.textAlign = 'left'
  ctx.fillText('OUTGOING MAIL', 124, 62)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Insignia plaque for the console's front edge: COSMIC MAIL —
 *  DELIVERY UNIT 01 in cream on a dark plate. */
function makeInsigniaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#241736'
  ctx.fillRect(0, 0, 512, 128)
  ctx.strokeStyle = 'rgba(255,217,168,0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(8, 8, 512 - 16, 128 - 16)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FDF4EC'
  ctx.font = '800 42px system-ui, sans-serif'
  ctx.fillText('COSMIC MAIL', 256, 56)
  ctx.fillStyle = 'rgba(253,244,236,0.65)'
  ctx.font = '600 24px ui-monospace, monospace'
  ctx.fillText('DELIVERY UNIT 01', 256, 96)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/** Grayscale radial top for the console buttons (tinted per button). */
function makeButtonTopTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(52, 48, 6, 64, 64, 62)
  gradient.addColorStop(0, '#FFFFFF')
  gradient.addColorStop(0.55, '#CFCFCF')
  gradient.addColorStop(1, '#6E6E6E')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(64, 64, 56, 0, Math.PI * 2)
  ctx.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * The big take-off button on the console top, just right of the
 * navigation screen and centred on the board. A transparent hinged
 * lid covers it until a destination is locked on the navigation
 * screen; then the lid flips open, the button glows, and pressing
 * it is what actually takes off.
 */
function TakeOffButton() {
  // The lid only lifts once SELECT confirms the route, not while
  // the destination is merely previewed on the navigation screen.
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const takeOff = useOnboardingStore((state) => state.takeOff)
  const lidRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    const lid = lidRef.current
    if (!lid) return
    lid.rotation.x = THREE.MathUtils.damp(
      lid.rotation.x,
      routeConfirmed ? -1.9 : 0,
      6,
      delta,
    )
  })

  return (
    // Centred on the board's total width (x = 0), back row: bezel
    // (r = 0.16) spans x -0.16..0.16, z -0.235..0.085. The lid
    // hinge is at the back (z = -0.205); closed it covers
    // z -0.20..0.05, and fully open (rotation.x = -1.9) its disc
    // stays within x -0.125..0.125, z -0.287..-0.207, y 0.29..0.53
    // — clear of the nav frame (x <= -0.218, top 0.245), of the
    // indicator cluster (z >= 0.07) and of the passport tray
    // (x >= 0.485) in every intermediate state. The hinge posts,
    // pin and moving knuckle below keep the disc attached to a
    // visible axle instead of floating over the button.
    <group position={[CONSOLE_CENTER_X, 0, -0.075]}>
      {/* Bezel ring the big button sits in. */}
      <mesh position={[0, 0.232, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.02, 24]} />
        <meshStandardMaterial color="#1B1029" roughness={0.6} />
      </mesh>
      <mesh
        position={[0, 0.25, 0]}
        onPointerDown={(event) => {
          event.stopPropagation()
          if (routeConfirmed) takeOff()
        }}
        onPointerOver={() => {
          if (routeConfirmed) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[0.1, 0.115, 0.05, 24]} />
        <meshStandardMaterial
          color="#D64541"
          emissive="#D64541"
          emissiveIntensity={routeConfirmed ? 0.45 : 0}
          roughness={0.35}
        />
      </mesh>
      {/* Hinge hardware that carries the lid: two gold posts
          standing on the board/bezel back edge hold the lid's axle
          pin at the lid pivot (y = 0.285, the disc's back edge).
          Post tops stop at y = 0.27, just below the closed lid's
          underside (0.2725), so the disc never touches them, and
          the pin (r = 0.015, bottom y = 0.27) rests on the posts. */}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.2475, -0.13]}>
          <boxGeometry args={[0.04, 0.045, 0.04]} />
          <meshStandardMaterial color="#9A7433" roughness={0.45} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.285, -0.13]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.24, 12]} />
        <meshStandardMaterial color="#9A7433" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Transparent hinged lid: closed over the button until a
          route is locked, then it flips up toward the window. */}
      <group ref={lidRef} position={[0, 0.285, -0.13]}>
        {/* Moving hinge knuckle: a gold barrel around the axle at
            the lid's back edge, so the disc is visibly attached to
            the pin it rotates on. Its axis is the lid's rotation
            axis, so it stays at the pivot in both states. */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.08, 12]} />
          <meshStandardMaterial color="#9A7433" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh
          position={[0, 0, 0.13]}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <cylinderGeometry args={[0.125, 0.125, 0.025, 24]} />
          <meshStandardMaterial
            color="#BFEFFF"
            transparent
            opacity={0.35}
            roughness={0.1}
            metalness={0}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  )
}

/** Ceiling light strip with a slow, calm pulse. */
function CeilingStrip() {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.opacity = 0.75 + Math.sin(state.clock.elapsedTime * 0.6) * 0.15
  })
  return (
    <mesh position={[0, 2.27, -1]}>
      <boxGeometry args={[3, 0.04, 0.18]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#FFF3D0"
        transparent
        toneMapped={false}
      />
    </mesh>
  )
}

/** Console status light: a soft teal pulse on the board. The
 *  sphere sits in a dark round socket, and a short arm links the
 *  socket to the front face of the navigation frame, so the
 *  indicator reads as part of the radar assembly instead of a
 *  loose ball on the desk. `position` is the sphere centre; the
 *  socket and arm are derived from it (socket top and arm top at
 *  y = 0.245, flush with the nav frame top, on the board top). */
function StatusLight({ position }: { position: [number, number, number] }) {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame((state) => {
    const material = materialRef.current
    if (!material) return
    material.emissiveIntensity = 0.8 + Math.sin(state.clock.elapsedTime * 2.2) * 0.5
  })
  return (
    <group>
      {/* Arm from the nav frame's front edge (z = 0.24) into the
          socket: spans z 0.215..0.275, x width 0.05. */}
      <mesh position={[position[0], 0.235, position[2] - 0.045]}>
        <boxGeometry args={[0.05, 0.02, 0.06]} />
        <meshStandardMaterial color="#1B1029" roughness={0.6} />
      </mesh>
      {/* Socket the sphere is seated in. */}
      <mesh position={[position[0], 0.235, position[2]]}>
        <cylinderGeometry args={[0.04, 0.045, 0.02, 16]} />
        <meshStandardMaterial color="#1B1029" roughness={0.6} />
      </mesh>
      <mesh position={position}>
        <sphereGeometry args={[0.035, 12, 10]} />
        <meshStandardMaterial
          ref={materialRef}
          color="#8FE3D8"
          emissive="#8FE3D8"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** Recessed status panel in the corridor between the launch
 *  controls and the passport support (board x 0.26..0.42,
 *  z -0.24..0.24). Three small lights with printed labels, driven
 *  only by states the game already has: POWER is on whenever the
 *  ship is out of the menu, ROUTE follows the confirmed route
 *  (the same state that lifts the take-off lid), MAIL follows the
 *  passport being onboard. No pointer handlers: indicators only. */
function StatusPanel() {
  const phase = useOnboardingStore((state) => state.phase)
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const passport = useOnboardingStore((state) => state.passport)
  const powerRef = useRef<THREE.MeshStandardMaterial>(null)

  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 768
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#241736'
    ctx.fillRect(0, 0, 256, 768)
    ctx.strokeStyle = 'rgba(143,227,216,0.35)'
    ctx.lineWidth = 3
    ctx.strokeRect(6, 6, 256 - 12, 768 - 12)
    // Labels sit right of the light discs (discs at canvas x ~64,
    // labels centred at x ~168). Canvas top maps to the board's
    // back edge, so POWER is at the back, MAIL at the front.
    ctx.fillStyle = 'rgba(253,244,236,0.85)'
    ctx.font = '700 40px ui-monospace, monospace'
    ctx.textAlign = 'center'
    for (const [index, label] of ['POWER', 'ROUTE', 'MAIL'].entries()) {
      ctx.fillText(label, 168, 128 + index * 256)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [])
  useEffect(() => () => texture.dispose(), [texture])

  useFrame((state) => {
    const material = powerRef.current
    if (!material) return
    material.emissiveIntensity = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.4
  })

  const lights: Array<{
    z: number
    color: string
    active: boolean
    pulse?: boolean
  }> = [
    { z: -0.15, color: '#8FE3D8', active: phase !== 'menu', pulse: true },
    { z: 0, color: '#FFD9A8', active: routeConfirmed },
    { z: 0.15, color: '#F2B5E2', active: passport !== null },
  ]

  return (
    <group position={[0.34, 0, 0]}>
      <mesh
        position={[0, 0.229, 0]}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <boxGeometry args={[0.16, 0.008, 0.48]} />
        <meshStandardMaterial color="#1B1029" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.236, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, 0.47]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {lights.map((light, index) => (
        <mesh
          key={index}
          position={[-0.045, 0.239, light.z]}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.012, 14]} />
          <meshStandardMaterial
            ref={light.pulse ? powerRef : undefined}
            color={light.active ? light.color : '#3A3350'}
            emissive={light.color}
            emissiveIntensity={light.active ? 1.2 : 0.12}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Real cockpit interior, visible only during the cabin steps: a dark
 * wall with a round window hole (Mars and the stars show through it),
 * a gold rim, a low dashboard console, and PIP floating by.
 */
function CabinInterior() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const groupRef = useRef<THREE.Group>(null)
  // The launch countdown happens INSIDE the cabin (seated, PIP
  // talking); from liftoff on, the wide menu shot returns.
  const cabin =
    (phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin') ||
    (phase === 'launching' && inCabinStage(launchClock.value, reducedMotion))

  // Visibility is driven per-frame: the launch stage changes without
  // a React re-render, so the render-time flag alone is not enough.
  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    group.visible =
      (phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin') ||
      (phase === 'launching' && inCabinStage(launchClock.value, reducedMotion))
  })

  // Front wall of the cube: 8 wide, 4.6 high, with the wide window
  // hole (radius 1.7) the pilot looks through.
  const wallShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-4, -2.3)
    shape.lineTo(4, -2.3)
    shape.lineTo(4, 2.3)
    shape.lineTo(-4, 2.3)
    shape.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, 0.3, 1.7, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    return new THREE.ShapeGeometry(shape, 48)
  }, [])

  // Cabin surfaces: textured hull panels for the wall, floor and side
  // walls; a dashboard top for the console; radial tops for buttons.
  const surfaces = useMemo(() => {
    const wallTexture = makePanelTexture('#2E1F45', '#1B1029', 'rgba(143,227,216,0.22)')
    // ShapeGeometry UVs are the shape units (-4..4, -2.3..2.3): map
    // one tile across the whole wall.
    wallTexture.repeat.set(1 / 8, 1 / 4.6)
    wallTexture.offset.set(0.5, 0.5)
    const floorTexture = makePanelTexture('#241A33', '#150E21', 'rgba(253,244,236,0.14)')
    floorTexture.repeat.set(2.5, 2.2)
    const sideTexture = makePanelTexture('#2A1D40', '#191022', 'rgba(253,244,236,0.16)')
    sideTexture.repeat.set(2, 1)
    const consoleTopTexture = makeConsoleTopTexture()
    const buttonTopTexture = makeButtonTopTexture()
    const mailDecalTexture = makeMailDecalTexture()
    const slotLabelTexture = makeSlotLabelTexture()
    const insigniaTexture = makeInsigniaTexture()
    const sideMat = new THREE.MeshStandardMaterial({ map: sideTexture, roughness: 0.6 })
    const consoleMats = [
      sideMat,
      sideMat,
      new THREE.MeshStandardMaterial({ map: consoleTopTexture, roughness: 0.6 }),
      sideMat,
      sideMat,
      sideMat,
    ]
    const buttonMats = (color: string, sideColor: string) => {
      const side = new THREE.MeshBasicMaterial({ color: sideColor, toneMapped: false })
      const top = new THREE.MeshBasicMaterial({
        map: buttonTopTexture,
        color,
        toneMapped: false,
      })
      return [side, top, side]
    }
    return {
      wallTexture,
      floorTexture,
      sideTexture,
      mailDecalTexture,
      slotLabelTexture,
      insigniaTexture,
      consoleMats,
      buttonSand: buttonMats('#FFD9A8', '#8A6A3F'),
      buttonTeal: buttonMats('#8FE3D8', '#2F6B62'),
      textures: [wallTexture, floorTexture, sideTexture, consoleTopTexture, buttonTopTexture, mailDecalTexture, slotLabelTexture, insigniaTexture],
    }
  }, [])

  useEffect(
    () => () => surfaces.textures.forEach((texture) => texture.dispose()),
    [surfaces],
  )

  if (!cabin && phase !== 'launching') return null

  return (
    <group ref={groupRef} visible={cabin}>
      {/* The ship: a fixed cube room (8 x 4.6, front wall at z=-4.5).
          Floor, ceiling and side walls meet at clean edges. */}
      <mesh position={[0, -2.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 9]} />
        <meshStandardMaterial
          map={surfaces.floorTexture}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 2.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 9]} />
        <meshStandardMaterial
          map={surfaces.sideTexture}
          roughness={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[-4, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[9, 4.6]} />
        <meshStandardMaterial
          map={surfaces.sideTexture}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[4, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[9, 4.6]} />
        <meshStandardMaterial
          map={surfaces.sideTexture}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Architecture: mid-height trim strips, corner posts, a
          floor aisle and the pulsing ceiling light. */}
      {[-3.97, 3.97].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.06, 0.06, 9]} />
          <meshBasicMaterial color="#8FE3D8" transparent opacity={0.35} toneMapped={false} />
        </mesh>
      ))}
      {[[-3.95, -4.45], [3.95, -4.45], [-3.95, 4.45], [3.95, 4.45]].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0, z]}>
          <boxGeometry args={[0.1, 4.6, 0.1]} />
          <meshStandardMaterial color="#5A4A2E" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, -2.29, -0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 6]} />
        <meshBasicMaterial color="#8FE3D8" transparent opacity={0.12} toneMapped={false} />
      </mesh>
      <CeilingStrip />

      {/* Front wall with the wide window hole. */}
      <mesh geometry={wallShape} position={[0, 0, -4.5]}>
        <meshStandardMaterial
          map={surfaces.wallTexture}
          roughness={0.9}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Window frame: outer gold ring, thin inner rim, bolts,
          a soft glow ring and a faint glass disc for depth. */}
      <mesh position={[0, 0.3, -4.44]}>
        <torusGeometry args={[1.85, 0.05, 12, 64]} />
        <meshStandardMaterial color="#9A7433" roughness={0.45} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.3, -4.42]}>
        <torusGeometry args={[1.7, 0.045, 12, 64]} />
        <meshStandardMaterial color="#E8B04B" roughness={0.4} metalness={0.3} />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 1.85, 0.3 + Math.sin(angle) * 1.85, -4.44]}
          >
            <sphereGeometry args={[0.05, 10, 8]} />
            <meshStandardMaterial color="#3A2C12" roughness={0.4} metalness={0.6} />
          </mesh>
        )
      })}
      {/* Sill band: a short tunnel from the outer ring into the
          wall, giving the frame real physical depth. */}
      <mesh position={[0, 0.3, -4.55]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.85, 1.85, 0.18, 64, 1, true]} />
        <meshStandardMaterial
          color="#5A4A2E"
          roughness={0.55}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.3, -4.47]}>
        <circleGeometry args={[1.68, 48]} />
        <meshBasicMaterial
          color="#D8FFF8"
          transparent
          opacity={0.05}
          depthWrite={false}
        />
      </mesh>

      {/* Cosmic Mail identity decal on the front wall. */}
      <mesh position={[-2.7, 1.05, -4.48]}>
        <planeGeometry args={[1.3, 0.65]} />
        <meshBasicMaterial map={surfaces.mailDecalTexture} transparent toneMapped={false} />
      </mesh>

      {/* Soft indirect fill so walls and structure read without
          losing the dark, mysterious mood. */}
      <hemisphereLight args={['#5A4A77', '#17102A', 0.55]} />
      <directionalLight position={[0, 1.5, -3]} intensity={0.5} color="#E5A49A" />

      {/* Console pedestal down to the floor, in hull panels.
          Clicks on it (and on the board/buttons) are swallowed so
          they never leak through to the passport card behind. */}
      <mesh
        position={[0.1, -1.72, -1.45]}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <boxGeometry args={[1.9, 1.25, 0.6]} />
        <meshStandardMaterial map={surfaces.sideTexture} roughness={0.7} />
      </mesh>

      {/* Cabin lighting: warm spill over the console, teal accent
          toward the navigation screen. */}
      <pointLight position={[0.1, 0.6, -0.6]} intensity={6} distance={6} color="#FFD9A8" />
      <pointLight position={[-0.5, 0.2, -1.2]} intensity={3} distance={4} color="#8FE3D8" />

      {/* Control panel fixed in the room, dashboard tilt toward
          the pilot (the same in tutorial and hub views). */}
      <group position={[0.1, -1.15, -1.4]} rotation={[0.35, 0, 0]}>
        {/* Wider base plate the board sits on: its top (y = -0.225)
            is flush with the board bottom, so nothing floats. */}
        <mesh position={[0, -0.265, 0]}>
          <boxGeometry args={[2.7, 0.08, 0.9]} />
          <meshStandardMaterial color="#2C1F45" roughness={0.6} />
        </mesh>
        <mesh
          material={surfaces.consoleMats}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <boxGeometry args={[2.5, 0.45, 0.7]} />
        </mesh>
        {/* Front edge light strip and recessed vents. */}
        <mesh position={[0, 0.18, 0.36]}>
          <boxGeometry args={[2.3, 0.03, 0.03]} />
          <meshBasicMaterial color="#8FE3D8" transparent opacity={0.5} toneMapped={false} />
        </mesh>
        {[-0.95, 0.95].map((x) => (
          <mesh key={x} position={[x, 0, 0.36]}>
            <boxGeometry args={[0.3, 0.12, 0.02]} />
            <meshStandardMaterial color="#1B1029" roughness={0.8} />
          </mesh>
        ))}
        {/* Insignia plaque on the front edge, between the vents:
            a dark plate (z 0.347..0.357) with the COSMIC MAIL —
            DELIVERY UNIT 01 plate on its face. */}
        <mesh position={[0, -0.02, 0.352]}>
          <boxGeometry args={[0.64, 0.18, 0.01]} />
          <meshStandardMaterial color="#241736" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.02, 0.359]}>
          <planeGeometry args={[0.62, 0.16]} />
          <meshBasicMaterial map={surfaces.insigniaTexture} toneMapped={false} />
        </mesh>
        {/* Status light on the strip of board in front of the screen
            (screen front edge z = 0.24, board front edge z = 0.35),
            centred in the navigation zone — never on the screen. */}
        <StatusLight position={[NAV_ZONE_CENTER_X, CONSOLE_TOP_Y + 0.015, 0.29]} />
        {/* Navigation screen inset into the top face: THE navigation
            panel. At rest it is the idle radar; tapping it (or
            continuing a mission) leans the pilot in and the
            destinations appear on this screen itself — no hologram.
            Frame 0.94 x 0.48 centred in the left zone: a uniform
            0.04 rim around the 0.86 x 0.40 screen plane, 0.11 from
            the board edges front/back, flush with the board top
            (0.225..0.245) so it reads as an inset, not a slab. */}
        <mesh position={[NAV_ZONE_CENTER_X, 0.235, 0]}>
          <boxGeometry args={[0.94, 0.02, 0.48]} />
          <meshBasicMaterial color="#0B2E29" toneMapped={false} />
        </mesh>
        <NavScreenOnBoard />
        <RadarSweep position={[NAV_ZONE_CENTER_X, 0.264, 0]} />
        <TakeOffButton />
        {/* Recessed POWER / ROUTE / MAIL panel in the empty
            corridor between the launch controls and the passport
            support (see StatusPanel). */}
        <StatusPanel />
        {/* Three auxiliary indicators grouped symmetrically below
            (in front of) the take-off button, in a shallow triangle
            around the board centre x = 0: side buttons at
            (+/-0.13, 0.135), apex button at (0, 0.215). Centre-to-
            centre distances are 0.153 (side-to-apex) and 0.247
            (side-to-main bezel), leaving ~0.022 edge-to-edge gaps;
            the cluster spans x -0.195..0.195, 0.023 clear of the
            nav frame (x <= -0.218) and 0.29 clear of the passport
            tray (x >= 0.485). Raised toward the main button: its
            front-most edge is now z = 0.28, 0.07 from the board's
            front edge (was 0.025). The middle (apex) indicator
            keeps the teal material, as before. */}
        {[
          [-0.13, 0.135],
          [0, 0.215],
          [0.13, 0.135],
        ].map(([offsetX, z], index) => (
          <group key={index} position={[CONSOLE_CENTER_X + offsetX, 0, z]}>
            <mesh position={[0, 0.232, 0]}>
              <cylinderGeometry args={[0.065, 0.065, 0.02, 14]} />
              <meshStandardMaterial color="#1B1029" roughness={0.6} />
            </mesh>
            <mesh
              position={[0, 0.242, 0]}
              material={index === 1 ? surfaces.buttonTeal : surfaces.buttonSand}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <cylinderGeometry args={[0.05, 0.058, 0.045, 14]} />
            </mesh>
          </group>
        ))}
        <PassportCard3D />
        {/* Passport support, one piece with the console (right zone,
            centre x = 0.725): a tray the card foot rests on, two side
            cheeks the card leans between, and a back brace tilted at
            the card's own lean so the card lies against it.
            Tray 0.48 x 0.30, top at y = 0.25, centred on the card
            foot (z = -0.10): the foot (y = 0.25) touches it without
            piercing the board, with a visible margin all around.
            Cheeks: inner faces 0.198 from centre, 0.016 clear of the
            card backing (half-width 0.182), sitting on the tray.
            Brace: same width as the tray, tilted -0.35 like the
            card, centre 0.025 behind the card centre along its
            normal, so a 0.013 gap keeps it from touching the card
            while its lower end lands on the tray (y = 0.252). */}
        <group position={[CARD_ZONE_CENTER_X, 0, 0]}>
          <mesh
            position={[0, 0.2375, -0.1]}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <boxGeometry args={[0.48, 0.025, 0.3]} />
            <meshStandardMaterial color="#1B1029" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.254, 0.042]}>
            <boxGeometry args={[0.48, 0.008, 0.012]} />
            <meshStandardMaterial color="#9A7433" roughness={0.45} metalness={0.5} />
          </mesh>
          {[-0.215, 0.215].map((x) => (
            <mesh
              key={x}
              position={[x, 0.28, -0.12]}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <boxGeometry args={[0.035, 0.06, 0.18]} />
              <meshStandardMaterial color="#2C1F45" roughness={0.6} />
            </mesh>
          ))}
          <mesh
            position={[0, 0.44, -0.196]}
            rotation={[-0.35, 0, 0]}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <boxGeometry args={[0.48, 0.4, 0.025]} />
            <meshStandardMaterial color="#2C1F45" roughness={0.6} />
          </mesh>
        </group>
        {/* Outgoing-mail slot in front of the passport tray, on
            the same centre line as the card: a dark recess
            (0.30 x 0.035, top y = 0.237) with thin gold lips, and
            an OUTGOING MAIL label plate just in front of it
            (z 0.185..0.245). Decorative only — no handlers, so it
            cannot steal clicks from the card behind it. */}
        <group position={[CARD_ZONE_CENTER_X, 0, 0]}>
          <mesh
            position={[0, 0.231, 0.135]}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <boxGeometry args={[0.3, 0.012, 0.035]} />
            <meshBasicMaterial color="#0B0812" />
          </mesh>
          {[0.1135, 0.1565].map((z) => (
            <mesh key={z} position={[0, 0.229, z]}>
              <boxGeometry args={[0.3, 0.008, 0.008]} />
              <meshStandardMaterial color="#9A7433" roughness={0.45} metalness={0.5} />
            </mesh>
          ))}
          <mesh
            position={[0, 0.229, 0.215]}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <boxGeometry args={[0.3, 0.008, 0.06]} />
            <meshStandardMaterial color="#1B1029" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.236, 0.215]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.29, 0.05]} />
            <meshBasicMaterial map={surfaces.slotLabelTexture} toneMapped={false} />
          </mesh>
        </group>
      </group>

      <CabinPip />
    </group>
  )
}

/**
 * Main-menu backdrop: black space, stars, shooting stars, Earth (home)
 * rotating in the lower-left corner and the Mailwing ship drifting
 * lower-right. During the cabin steps the camera moves inside the
 * canopy glass, where the window shows the last mission's planet.
 * Mounted only before the game world.
 */
export default function MenuScene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 16], fov: 42, near: 0.1, far: 160 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.1
      }}
    >
      <color attach="background" args={['#050309']} />
      <CameraRig />
      <ambientLight intensity={0.4} />
      <directionalLight position={[-6, 8, 10]} intensity={1.6} color="#FFD9A8" />
      <directionalLight position={[6, -2, 8]} intensity={0.5} color="#B8A6D9" />
      <pointLight position={[5.4, 0, 2]} intensity={8} distance={11} color="#FFD9A8" />
      <MenuStars />
      <ShootingStar />
      <BackdropPlanet />
      <MailShip />
      <CabinInterior />
    </Canvas>
  )
}
