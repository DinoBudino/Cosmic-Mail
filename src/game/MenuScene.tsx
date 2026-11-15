import { Canvas, useFrame } from '@react-three/fiber'
import { PerformanceMonitor, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { mulberry32 } from './random'
import { makeMarsCanvas } from './marsTexture'
import { EarthSurface, RockySurface } from './PlanetGlobe'
import {
  DESTINATIONS,
  destinationPlanetKind,
  type Destination,
  type PlanetKind,
} from '../data/destinations'
import {
  introCameraForLine,
  introEmotionForLine,
  introHologramForLine,
  introMomentForLine,
  type IntroCameraShot,
  type IntroEmotion,
  type IntroMoment,
} from '../data/onboardingNarrative'
import { getPassportView, STORY_STATUS_LABEL, type PassportView } from '../data/passport'
import { introHologramSvg } from '../ui/onboarding/introHologramTexture'
import { emitAudio } from './audio/audioEvents'
import { WindowHologram } from './WindowHologram'
import { CabinCM01, CabinEffects, CabinMonitor } from './CabinCM01'
import { cabinPoint } from './cabinLayout'
import { HubPip, type HubPipExpression } from './HubPipModel'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useOnboardingStore } from '../store/onboardingStore'
import { hubElementEnabled, useHubFocus } from '../store/hubFocus'
import type { HubTarget } from '../data/onboardingNarrative'
import {
  cruiseDistance,
  descentProgress,
  inCabinStage,
  LAUNCH_PLANET_RADIUS,
  launchClock,
  launchPlanetPlacement,
  launchShipPosition,
  shipPoseAt,
  speedShake,
  stageAt,
  warpFactor,
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
// The cabin is the CM-01 Explorer model (see CabinCM01.tsx); camera
// poses are authored in its Blender coordinates (Z up, +Y toward the
// window) through cabinPoint(). During the tutorial ritual the pilot's
// view is straight-on (PIP and the window dead ahead); once the
// tutorial is done, the view glides to the hub framing beside the seat.
const FRONTAL_POSITION = cabinPoint(0, -0.95, 0.38)
const FRONTAL_LOOK = cabinPoint(0, 3.4, 0.3)
const CABIN_POSITION = cabinPoint(0.35, -0.95, 0.42)
// Leaning in over the navigation screen (ANCHOR_NAV, Blender -0.78, 1.91, -0.19).
const ROUTE_POSITION = cabinPoint(-0.78, 1.18, 0.78)

/**
 * Intro framing per narrative beat. Each shot keeps PIP and the Archive
 * window in a readable relationship: welcome centres on PIP, the Archive
 * beats favour the window, the fault turns to PIP's reaction, and the
 * invitation comes back to the player. Moves are damped in CameraRig.
 */
const INTRO_CAMERA: Record<
  IntroCameraShot,
  { position: THREE.Vector3; look: THREE.Vector3 }
> = {
  welcome: {
    position: FRONTAL_POSITION,
    look: FRONTAL_LOOK,
  },
  archive: {
    position: cabinPoint(0.1, -0.25, 0.42),
    look: cabinPoint(0, 3.4, 0.62),
  },
  pip: {
    position: cabinPoint(0.4, -0.35, 0.42),
    look: cabinPoint(0.75, 3.0, 0.55),
  },
  invitation: {
    position: cabinPoint(0.05, -0.3, 0.45),
    look: cabinPoint(-0.35, 3.2, 0.55),
  },
}
const MENU_LOOK = new THREE.Vector3(0, 0, 0)
// Launching: the same wide menu framing, then a slow push-in toward
// the destination as the ship accelerates.
const LAUNCH_START_POSITION = new THREE.Vector3(0, 0.4, 16)
const LAUNCH_END_POSITION = new THREE.Vector3(-1.2, -0.2, 11.5)
const LAUNCH_LOOK = new THREE.Vector3(-3.2, -1.6, -2.5)
const APPROACH_LOOK = new THREE.Vector3(5.4, -0.6, -0.5)
const CABIN_LOOK = cabinPoint(0.1, 3.4, -0.05)
const ROUTE_LOOK = cabinPoint(-0.78, 1.98, -0.2)

// Cabin <-> navigation-panel transition. `routeBlend` goes 0 (initial
// cabin view) -> 1 (leaned into the navigation screen) over
// ROUTE_BLEND_SECONDS, and back the same way. Both camera poses are
// fixed points inside the cube, so the move is a plain interpolation.
const ROUTE_BLEND_SECONDS = 1.5
const MENU_FOV = 42
const CABIN_FOV = 56
const routeBlend = { value: 0 }

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

function CameraRig() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const setBoardingStage = useOnboardingStore((state) => state.setBoardingStage)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const lookTarget = useMemo(() => new THREE.Vector3(), [])
  const wasCabinRef = useRef(false)
  const hubView =
    phase === 'hub' || phase === 'launching' || phase === 'playing'

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
    const camera = state.camera as THREE.PerspectiveCamera
    // The CM-01 cockpit is framed with a wider lens than the title shot.
    const inCabinView =
      (phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin') ||
      (phase === 'launching' && inCabinStage(launchClock.value, reducedMotion))
    // Warp kick: the lens widens with speed during the exterior flight,
    // so the dash to the planet feels fast.
    const warpFov =
      phase === 'launching' && !inCabinView && !reducedMotion
        ? warpFactor(launchClock.value, reducedMotion) * 16
        : 0
    const targetFov = (inCabinView ? CABIN_FOV : MENU_FOV) + warpFov
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = targetFov
      camera.updateProjectionMatrix()
    }
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
        const basePosition = hubView ? CABIN_POSITION : FRONTAL_POSITION
        const baseLook = hubView ? CABIN_LOOK : FRONTAL_LOOK
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

    // Hub framing: frontal during the intro/registration, diagonal once
    // the carrier reaches the control center. Intro beats use a soft
    // cinematic shot per scene; reduced motion keeps one stable frame.
    const introShot =
      phase === 'intro' && !hubView ? introCameraForLine(dialogueIndex, reducedMotion) : null
    const introFraming = introShot ? INTRO_CAMERA[introShot] : null
    const basePosition = hubView
      ? CABIN_POSITION
      : reducedMotion || !introFraming
        ? FRONTAL_POSITION
        : introFraming.position
    const baseLook = hubView
      ? CABIN_LOOK
      : reducedMotion || !introFraming
        ? FRONTAL_LOOK
        : introFraming.look

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

/**
 * CM-01 Mailwing, exported from blender/Spaceship/Spaceship.blend by
 * blender/Spaceship/scripts/export_web.py: nose on +Y, engine bell on
 * -Y, centred, in metres (12.1 m long, solar arrays 7.5 m across).
 */
const SHIP_URL = 'models/spaceship-cm01.glb'
useGLTF.preload(SHIP_URL)
/** Model metres -> ship-group units (about 2.4 units nose to bell). */
const SHIP_MODEL_SCALE = 0.2
/** Bell exit in ship-group units (-6.07 m * SHIP_MODEL_SCALE). */
const SHIP_NOZZLE_Y = -1.2
/** Bell exit radius in ship-group units (1.37 m * scale), for the plume. */
const SHIP_NOZZLE_RADIUS = 0.27
/** Spin about the long axis so the solar cells face the camera. */
const SHIP_ROLL = 2.35

const STAR_COUNT = 260
const PLANET_RADIUS = LAUNCH_PLANET_RADIUS

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



/* Painted planets for the menu and the cabin window. Earth itself now
   comes from blender/Earth (EarthGlobe.tsx); this painted Earth is only
   the instant placeholder while those textures load. */

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

function PaintedPlanet({ texture }: { texture: THREE.Texture }) {
  return (
    <mesh>
      <sphereGeometry args={[PLANET_RADIUS, 64, 48]} />
      {/* Relief: the same painted texture as a bump map, so
          continents, craters and grain catch the light. */}
      <meshStandardMaterial map={texture} bumpMap={texture} bumpScale={0.12} roughness={0.95} metalness={0} />
    </mesh>
  )
}

const HALO_COLOR: Record<PlanetKind, string> = {
  earth: '#7FB8E8',
  mars: '#E5A49A',
  moon: '#D9D9D9',
  'deep-space': '#B8A6D9',
}

const MENU_PLANET = new THREE.Vector3(-8.2, -4.6, -5)
// Lower-right of the CM-01 window, as in the cabin reference sheet.
const CABIN_PLANET = new THREE.Vector3(3.1, -3.3, -13.5)

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
  const destination = useJourneyStore(
    (state) => state.save?.currentDestination ?? null,
  )
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
      const placement = launchPlanetPlacement(launchClock.value, reducedMotion)
      outer.visible = placement.visible
      if (!outer.visible) return
      // Fluid entrance: eased approach (slow at first) AND a fade-in,
      // so the planet grows into frame instead of popping in big.
      const fade = placement.fade
      outer.scale.setScalar(placement.scale)
      outer.position.set(placement.x, placement.y, placement.z)
      outer.traverse((child) => {
        const material = (child as THREE.Mesh).material as THREE.Material | undefined
        if (!material) return
        material.transparent = true
        material.opacity = ((child.userData.baseOpacity as number | undefined) ?? 1) * fade
      })
      return
    }
    outer.visible = true
    outer.scale.setScalar(1)
    // Undo the launch fade-in (materials were made transparent).
    outer.traverse((child) => {
      const material = (child as THREE.Mesh).material as THREE.Material | undefined
      if (!material) return
      // Halo and clouds keep their own see-through look.
      const base = child.userData.baseOpacity as number | undefined
      material.transparent = base != null
      material.opacity = base ?? 1
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
      <mesh scale={1.03} userData={{ baseOpacity: 0.1 }}>
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
        {kind === 'deep-space' ? (
          <PaintedPlanet texture={texture} />
        ) : (
          // The Blender planets; the light painted one shows while they load.
          <Suspense fallback={<PaintedPlanet texture={texture} />}>
            {kind === 'earth' ? (
              <EarthSurface radius={PLANET_RADIUS} spin={!reducedMotion} />
            ) : (
              <RockySurface kind={kind} radius={PLANET_RADIUS} />
            )}
          </Suspense>
        )}
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
      radius: Math.sqrt(random()) * SHIP_NOZZLE_RADIUS * 0.7,
      speed: 0.85 + random() * 0.3,
    }))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return { geometry: geo, seeds: particleSeeds }
  }, [])

  useEffect(() => () => geometry.dispose(), [geometry])

  const hot = useMemo(() => new THREE.Color('#FFF3D0').multiplyScalar(1.5), [])
  const warm = useMemo(() => new THREE.Color('#FFBA70').multiplyScalar(1.25), [])
  const cool = useMemo(() => new THREE.Color('#C65A2E'), [])
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute
    // During the launch the plume stretches with the ship's speed.
    let thrust = 1
    if (phase === 'launching') {
      const stage = stageAt(launchClock.value, reducedMotion).stage
      // Longer, faster flame the harder the ship pushes.
      thrust =
        stage === 'ignition'
          ? 0.35
          : 1 + warpFactor(launchClock.value, reducedMotion) * 1.8
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
        SHIP_NOZZLE_Y + 0.04 - age * PLUME_LENGTH * thrust,
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
    // Fatter, hotter sparks at warp speed (bloom picks them up).
    const points = pointsRef.current
    if (points) {
      const material = points.material as THREE.PointsMaterial
      material.size = 0.11 + Math.max(0, thrust - 1) * 0.05
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        toneMapped={false}
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
 * billboarded sprite, always facing the camera) — the carrier's
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
  const carrierName = useJourneyStore(
    (state) => state.save?.playerName ?? '',
  )
  const { scene } = useGLTF(SHIP_URL)
  // Inside the cabin the exterior ship is hidden: we are within it.
  // (During the approach stage it is the whole point, so it stays.
  // During launching we are back in the wide menu shot, so it stays
  // too — it is already flying there.)
  const cabin = phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin'
  const nameTagTexture = useMemo(() => (phase === 'launching' ? makeNameTagTexture(carrierName) : null), [phase, carrierName])
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
      const cruise = launchShipPosition(launchClock.value, reducedMotion)
      // LINEAR cruise, then a gentle closing-in above the planet's
      // limb that leaves room for the solar arrays (launchShipPosition).
      group.position.set(cruise.x, cruise.y, cruise.z)
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
      {/* The GLB is already centred, nose up; only metres -> units. */}
      <group scale={SHIP_MODEL_SCALE} rotation={[0, SHIP_ROLL, 0]}>
        <primitive object={scene} />
      </group>
      <ThrusterPlume />
      {/* Name tag floating above the ship. In the flying pose the
          group's local -X points world-up, so the sprite sits
          overhead; sprites always face the camera, so it reads. */}
      {nameTagTexture && (
        <sprite ref={nameTagRef} position={[-1.3, 0, 0]} scale={[1.9, 0.6, 1]}>
          <spriteMaterial map={nameTagTexture} transparent opacity={0} toneMapped={false} depthWrite={false} />
        </sprite>
      )}
    </group>
  )
}

/** Narrative pose for Cabin PIP: reusable acting targets (position,
 *  tilt, gaze yaw and motion energy), damped every frame so moves
 *  ease in/out instead of teleporting. The intro poses free the
 *  centre of the frame for the hologram of the moment. */
interface PipPose {
  x: number
  y: number
  z: number
  scale: number
  roll: number
  pitch: number
  yaw: number
  bob: number
  sway: number
  antenna: number
  lambda: number
}

/** PIP placement in CM-01 Blender coordinates (see cabinPoint). */
function cabinXYZ(x: number, y: number, z: number): { x: number; y: number; z: number } {
  const p = cabinPoint(x, y, z)
  return { x: p.x, y: p.y, z: p.z }
}

const TUTORIAL_POSE: PipPose = { ...cabinXYZ(0, 2.55, 0.72), scale: 1.25, roll: 0.02, pitch: 0, yaw: 0, bob: 0.07, sway: 0.03, antenna: 0.05, lambda: 2 }
const HUB_POSE: PipPose = { ...cabinXYZ(-0.15, 2.75, 1.12), scale: 1.15, roll: 0.02, pitch: 0, yaw: 0, bob: 0.07, sway: 0.03, antenna: 0.05, lambda: 2 }

/**
 * Staging anchors for the cinematic intro. The window's centre is a
 * protected safe zone for the hologram of the moment; PIP only
 * occupies the centre anchor in Welcome, when he is the sole focus.
 * Side anchors sit near the window's inner rim, smaller and slightly
 * lower than the tutorial spot, so they read as presenters beside
 * the projection — never as obstacles in front of it.
 */
const PIP_ANCHORS = {
  centerFocus: { ...cabinXYZ(0, 2.5, 0.78), scale: 1.35 },
  // Side anchors float over the console wings, just inside the window
  // ring and lower than the hologram band, so PIP never covers it.
  leftPresenter: { ...cabinXYZ(-1.42, 2.4, 0.5), scale: 1.0 },
  rightPresenter: { ...cabinXYZ(1.42, 2.4, 0.5), scale: 1.0 },
} as const

type PipAnchorName = keyof typeof PIP_ANCHORS

const INTRO_ANCHORS: Record<IntroMoment, PipAnchorName> = {
  arrival: 'centerFocus',
  archive: 'rightPresenter',
  fault: 'rightPresenter',
  hope: 'leftPresenter',
  invitation: 'leftPresenter',
}

const INTRO_POSES: Record<IntroMoment, PipPose> = {
  // Arrival: dead-centre, upright and directly facing the player.
  arrival: { ...PIP_ANCHORS.centerFocus, roll: 0, pitch: 0, yaw: 0, bob: 0.09, sway: 0, antenna: 0.07, lambda: 2 },
  // Archive: beside the window, presenting the records.
  archive: { ...cabinXYZ(1.42, 2.45, 0.52), scale: 1.02, roll: 0.05, pitch: 0.03, yaw: -0.28, bob: 0.07, sway: 0.035, antenna: 0.06, lambda: 1.8 },
  // Fault: moves slightly toward the player so the reaction reads.
  fault: { ...cabinXYZ(1.38, 2.3, 0.52), scale: 1.08, roll: 0.02, pitch: 0.02, yaw: -0.08, bob: 0.05, sway: 0.022, antenna: 0.05, lambda: 1.7 },
  // Hope: energy returns, leaning toward the recovered clue.
  hope: { ...cabinXYZ(-1.4, 2.3, 0.52), scale: 1.05, roll: -0.04, pitch: 0.05, yaw: 0.12, bob: 0.09, sway: 0.04, antenna: 0.09, lambda: 1.8 },
  // Invitation: a small approach toward the player, warm and direct.
  invitation: { ...cabinXYZ(-1.3, 2.15, 0.55), scale: 1.1, roll: -0.02, pitch: 0.03, yaw: 0, bob: 0.08, sway: 0.03, antenna: 0.1, lambda: 1.8 },
}

function poseForIntro(moment: IntroMoment, lineIndex: number): PipPose {
  const base: PipPose = { ...PIP_ANCHORS[INTRO_ANCHORS[moment]], ...INTRO_POSES[moment] }
  if (moment === 'archive') {
    return { ...base, yaw: lineIndex <= 2 ? -0.3 : -0.12 }
  }
  if (moment === 'fault') {
    return { ...base, yaw: lineIndex >= 9 ? 0 : -0.12 }
  }
  if (moment === 'hope') return { ...base, yaw: 0.12 }
  if (moment === 'invitation') {
    return { ...base, pitch: lineIndex >= 12 ? 0.03 : 0.06, yaw: 0 }
  }
  return base
}

function expressionForPhase(
  phase: string,
  dialogueIndex = 0,
): IntroEmotion {
  switch (phase) {
    case 'intro':
      return introEmotionForLine(dialogueIndex)
    case 'registration':
      return 'thoughtful'
    case 'hub':
    case 'launching':
      return 'happy'
    default:
      return 'curious'
  }
}

/**
 * PIP in the onboarding cabin, rendered from the production GLB
 * (PIP_RetroSpacePost). The cabin owns narrative staging: anchors,
 * facing the player, bob, body sway and the celebration hop. The loaded
 * model owns its face, blink, talking mouth, antenna and scarf tails.
 */
function CabinPip() {
  const groupRef = useRef<THREE.Group>(null)
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const pipTalking = useOnboardingStore((state) => state.pipTalking)
  const hubView = phase === 'hub' || phase === 'launching'
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const expression = expressionForPhase(phase, dialogueIndex)
  const hubExpression: HubPipExpression = expression
  const isIntro = phase === 'intro'
  const moment: IntroMoment | null = isIntro ? introMomentForLine(dialogueIndex) : null
  // Intro poses per moment; registration stays frontal; the hub glides
  // to the diagonal control-center spot. No questions/reveal/hero poses.
  const targetPose: PipPose = isIntro && moment
    ? poseForIntro(moment, dialogueIndex)
    : hubView
      ? HUB_POSE
      : TUTORIAL_POSE
  // Smoothed amplitudes: talking <-> resting blends over ~0.5s instead
  // of switching frequencies, which used to make PIP jump (reposition)
  // the instant he finished a line or the player clicked the bubble.
  const bobAmpRef = useRef(0.07)
  const swayAmpRef = useRef(0.03)
  // Current acting pose (position/tilt/gaze), damped toward the target.
  const poseRef = useRef<PipPose>({ ...TUTORIAL_POSE })
  // Small celebration hop when the invitation hands over to reflection.
  const prevMomentRef = useRef<IntroMoment | null>(null)
  const hopStartRef = useRef(-1)
  // Welcome must start dead-centre and upright, so the first welcome
  // frame snaps to the acting target instead of damping in from the
  // previous pose. The one-shot hop is a friendly greeting, not a tilt.
  const welcomeSnappedRef = useRef(false)
  const welcomeGreetedRef = useRef(false)
  const welcomeGreetRef = useRef(-1)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return
    const time = state.clock.elapsedTime
    const damp = THREE.MathUtils.damp
    const talking = pipTalking && !reducedMotion
    // Emotional body language: concern lowers the float and slows the sway;
    // hope and welcome restore the usual energy. No teleporting: the same
    // damped pose pipeline carries every change.
    const energy =
      expression === 'worried' || expression === 'sad' || expression === 'thoughtful'
        ? 0.55
        : expression === 'surprised'
          ? 0.82
          : expression === 'curious'
            ? 0.9
            : 1
    const emotionalSink =
      expression === 'sad' || expression === 'worried'
        ? -0.07
        : expression === 'thoughtful'
          ? -0.035
          : 0
    const pose = poseRef.current
    const moveLambda = reducedMotion ? 10 : targetPose.lambda
    pose.x = damp(pose.x, targetPose.x, moveLambda, delta)
    pose.y = damp(pose.y, targetPose.y, moveLambda, delta)
    pose.z = damp(pose.z, targetPose.z, moveLambda, delta)
    pose.scale = damp(pose.scale, targetPose.scale, moveLambda, delta)
    pose.roll = damp(pose.roll, targetPose.roll, 4, delta)
    pose.pitch = damp(pose.pitch, targetPose.pitch, 4, delta)
    pose.yaw = damp(pose.yaw, targetPose.yaw, 4, delta)

    const isWelcome = phase === 'intro' && moment === 'arrival'
    if (isWelcome && !welcomeSnappedRef.current) {
      Object.assign(pose, targetPose)
      bobAmpRef.current = targetPose.bob
      swayAmpRef.current = targetPose.sway
      welcomeSnappedRef.current = true
      // Orient from the final welcome position so the very first frame
      // already looks straight at the player.
      group.position.set(pose.x, pose.y, pose.z)
      group.scale.setScalar(pose.scale)
    } else if (!isWelcome) {
      welcomeSnappedRef.current = false
      welcomeGreetedRef.current = false
      welcomeGreetRef.current = -1
    }
    // Greet only once the cabin cut has happened: the hop was previously
    // spent during the approach and never seen by the player.
    if (isWelcome && boardingStage === 'cabin' && !welcomeGreetedRef.current && !reducedMotion) {
      welcomeGreetedRef.current = true
      welcomeGreetRef.current = time
    }

    const previousMoment = prevMomentRef.current
    if (
      moment &&
      ((moment === 'hope' && previousMoment !== 'hope') ||
        (moment === 'invitation' && previousMoment === 'hope'))
    ) {
      hopStartRef.current = time
    }
    prevMomentRef.current = moment

    if (isWelcome) {
      // The welcome camera is dead ahead on the cabin centreline. Keep the
      // model at identity so the first visible frame is exactly front-on,
      // independent of useFrame ordering during the cabin cut.
      group.rotation.set(0, 0, 0)
    } else {
      group.lookAt(state.camera.position)
      // Gaze + body tilt on top of facing the player.
      group.rotateX(pose.pitch)
      group.rotateY(pose.yaw)
      group.rotateZ(pose.roll)
    }

    let hop = 0
    if (!reducedMotion && welcomeGreetRef.current >= 0) {
      // Small hello bounce, purely vertical: the greeting never tilts him.
      const greetT = time - welcomeGreetRef.current
      if (greetT < 0.75) {
        hop += Math.sin((greetT / 0.75) * Math.PI) * 0.03 * (1 - greetT / 0.75)
      } else {
        welcomeGreetRef.current = -1
      }
    }
    if (!reducedMotion && hopStartRef.current >= 0) {
      const hopT = time - hopStartRef.current
      if (hopT < 0.9) hop += Math.sin((hopT / 0.9) * Math.PI) * 0.11 * (1 - hopT / 0.9)
      else hopStartRef.current = -1
    }

    // Glide between poses, around the floating bob. Welcome keeps a soft
    // float but no lateral sway, so he stays upright and dead-centre.
    group.position.x = pose.x
    group.position.z = pose.z
    group.scale.setScalar(pose.scale)
    if (!reducedMotion) {
      const bobTarget =
        (isWelcome ? targetPose.bob : talking ? 0.11 : targetPose.bob) * energy
      const swayTarget =
        (isWelcome ? 0 : talking ? 0.06 : targetPose.sway) * energy
      bobAmpRef.current = damp(bobAmpRef.current, bobTarget, 5, delta)
      swayAmpRef.current = damp(swayAmpRef.current, swayTarget, 5, delta)
      // Fixed frequencies: only the amplitudes blend, never the phase.
      group.position.y =
        pose.y + emotionalSink + Math.sin(time * 1.9) * bobAmpRef.current + hop
      // Additive sway ON TOP of the pose roll — an absolute
      // assignment here used to erase the roll every frame.
      group.rotation.z += Math.sin(time * 2.4) * swayAmpRef.current
    } else {
      group.position.y = pose.y + emotionalSink
    }
    // Facial expression, blink, talking mouth, antenna and scarf movement
    // now live inside HubPipModel; the cabin keeps only placement and pose.
  })

  return (
    <group ref={groupRef} position={[0.05, 0.18, -2.35]} scale={1.15}>
      {/*
        Legacy procedural CabinPip visual is disabled here.
        The production PIP GLB now represents the companion in the hub;
        the previous primitive shell/eyes/antenna block was removed from
        this mount point and remains available in git history.
      */}
      <HubPip
        expression={hubExpression}
        talking={pipTalking && !reducedMotion}
        reducedMotion={reducedMotion}
        antennaAmplitude={targetPose.antenna}
        scale={0.64}
      />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Navigation screen local frame                                        */
/*                                                                     */
/* NavScreenOnBoard / RadarSweep keep their original board-local       */
/* layout (screen plane at y = NAV_SCREEN_Y, centred on                */
/* NAV_ZONE_CENTER_X, 0.86 x 0.40). CabinInterior re-centres and       */
/* scales that layout onto the ANCHOR_NAV recess of the CM-01 console. */
/* ------------------------------------------------------------------ */
const NAV_ZONE_CENTER_X = -0.6875
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

/**
 * Navigation screen layout (canvas 860x400, matching the 0.86x0.40
 * screen on the console top). List view: one tall card per destination.
 * Detail view: planet, facts and the route buttons. Rectangles are
 * shared by the draw code, the click hit-test and PIP's tour highlight.
 */
const NAV_W = 860
const NAV_H = 400
const NAV_PAD = 16
const NAV_TOP = 64
const NAV_CARD_GAP = 14
// Cards share the screen width evenly (two destinations: Moon and Mars).
const NAV_CARD_W =
  (NAV_W - 2 * NAV_PAD - (DESTINATIONS.length - 1) * NAV_CARD_GAP) / DESTINATIONS.length
const NAV_CARD_H = NAV_H - NAV_TOP - NAV_PAD

interface NavRect {
  x: number
  y: number
  w: number
  h: number
}

const NAV_RECT = {
  cards: { x: NAV_PAD, y: NAV_TOP, w: NAV_W - 2 * NAV_PAD, h: NAV_CARD_H },
  image: { x: NAV_PAD, y: NAV_TOP, w: 300, h: 250 },
  facts: { x: 332, y: NAV_TOP, w: NAV_W - 332 - NAV_PAD, h: 250 },
  back: { x: NAV_PAD, y: 330, w: 200, h: 54 },
  confirm: { x: 232, y: 330, w: NAV_W - 232 - NAV_PAD, h: 54 },
} satisfies Record<string, NavRect>

function inNavRect(rect: NavRect, px: number, py: number): boolean {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
}

type NavDestination = Destination

function fitCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let value = text
  while (value.length > 4 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1)
  }
  return `${value}…`
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
  // Cratered moon disc: maria, small craters with lit rims and a soft
  // terminator, so it reads as a sphere like the Mars card.
  const cx = 256
  const cy = 128
  const r = 78
  const halo = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.4)
  halo.addColorStop(0, 'rgba(220,225,240,0.25)')
  halo.addColorStop(1, 'rgba(220,225,240,0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, 512, 256)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = '#CFCFD4'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.fillStyle = 'rgba(120,122,135,0.45)'
  for (const [mx, my, mr] of [
    [-24, -20, 26],
    [10, -30, 18],
    [22, 8, 22],
    [-30, 22, 16],
  ] as const) {
    ctx.beginPath()
    ctx.ellipse(cx + mx, cy + my, mr, mr * 0.8, 0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 26; i += 1) {
    const a = random() * Math.PI * 2
    const d = Math.sqrt(random()) * (r - 6)
    const cr = 2 + random() * 6
    const px = cx + Math.cos(a) * d
    const py = cy + Math.sin(a) * d
    ctx.fillStyle = 'rgba(95,96,108,0.55)'
    ctx.beginPath()
    ctx.arc(px, py, cr, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,245,250,0.55)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(px, py, cr, Math.PI * 0.9, Math.PI * 1.7)
    ctx.stroke()
  }
  const shade = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
  shade.addColorStop(0, 'rgba(255,255,255,0.16)')
  shade.addColorStop(0.55, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(8,8,16,0.5)')
  ctx.fillStyle = shade
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.restore()
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
  return (moonImageCanvas ??= makeMoonCanvas())
}

/** The navigation screen at rest: idle radar rings. */
function drawRadarIdle(ctx: CanvasRenderingContext2D): void {
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
  ctx.fillText('TAP FOR ROUTE', NAV_W / 2, NAV_H - 40)
  ctx.shadowBlur = 0
  ctx.textAlign = 'left'
}

const NAV_FONT = 'system-ui, "Segoe UI", sans-serif'
const NAV_MONO = 'ui-monospace, "DejaVu Sans Mono", monospace'
const NAV_TEAL = '#8FE3D8'
const NAV_CREAM = '#FDF4EC'
const NAV_PEACH = '#FFD9A8'
const NAV_LAVENDER = '#B8A6D9'

/** Wraps text into at most `maxLines` lines that fit `maxWidth`. */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = fitCanvasText(ctx, `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`, maxWidth)
  return kept
}

/** The planet picture fitted (never cropped) into a rounded frame. */
function drawPlanetPanel(
  ctx: CanvasRenderingContext2D,
  destination: NavDestination,
  rect: NavRect,
  dim: boolean,
): void {
  const image = zoneImage(destination.id)
  ctx.save()
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 12)
  ctx.clip()
  ctx.fillStyle = '#050309'
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  // The painted images are 512x256 with the planet centred: scale by
  // height so the whole disc shows, and let the starfield fill the sides.
  const scale = Math.max(rect.h / image.height, rect.w / image.width)
  const drawW = image.width * scale
  const drawH = image.height * scale
  ctx.drawImage(image, rect.x + (rect.w - drawW) / 2, rect.y + (rect.h - drawH) / 2, drawW, drawH)
  if (dim) {
    ctx.fillStyle = 'rgba(5,3,9,0.55)'
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
  }
  ctx.restore()
}

function drawSignalPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  available: boolean,
  text: string,
): void {
  ctx.font = `800 15px ${NAV_MONO}`
  const w = ctx.measureText(text).width + 40
  ctx.fillStyle = available ? 'rgba(255,217,168,0.16)' : 'rgba(184,166,217,0.12)'
  roundRectPath(ctx, x, y, w, 30, 15)
  ctx.fill()
  ctx.strokeStyle = available ? 'rgba(255,217,168,0.8)' : 'rgba(184,166,217,0.5)'
  ctx.lineWidth = 1.5
  roundRectPath(ctx, x, y, w, 30, 15)
  ctx.stroke()
  ctx.fillStyle = available ? NAV_PEACH : NAV_LAVENDER
  ctx.beginPath()
  ctx.arc(x + 16, y + 15, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.textAlign = 'left'
  ctx.fillText(text, x + 28, y + 20)
}

interface NavRow {
  label: string
  value: string
}

/**
 * In-game information rows for a place (no scientific figures, so the
 * screen can never show a wrong number): terrain, signal and explorer.
 */
function navRows(destination: NavDestination, view: PassportView): NavRow[] {
  const story = storyFor(view, destination)
  return [
    { label: 'Terrain', value: destination.terrain },
    {
      label: 'Signal',
      value: !destination.available
        ? 'Too weak for now'
        : story?.stampEarned
          ? 'Story restored'
          : 'Detected',
    },
    { label: 'Explorer', value: story?.machineName ?? 'Not identified yet' },
  ]
}

/** Info rows: label on the left, value on the right. */
function drawInfoRows(
  ctx: CanvasRenderingContext2D,
  rows: readonly NavRow[],
  x: number,
  y: number,
  w: number,
  rowH: number,
): void {
  rows.forEach((fact, index) => {
    const ry = y + index * rowH
    ctx.fillStyle = index % 2 === 0 ? 'rgba(143,227,216,0.09)' : 'rgba(143,227,216,0.04)'
    roundRectPath(ctx, x, ry, w, rowH - 4, 8)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = NAV_TEAL
    ctx.font = `700 14px ${NAV_MONO}`
    ctx.fillText(fact.label.toUpperCase(), x + 12, ry + rowH / 2 + 3)
    ctx.textAlign = 'right'
    ctx.fillStyle = NAV_CREAM
    ctx.font = `800 19px ${NAV_FONT}`
    ctx.fillText(fitCanvasText(ctx, fact.value, w - 130), x + w - 12, ry + rowH / 2 + 5)
  })
  ctx.textAlign = 'left'
}

function storyFor(view: PassportView, destination: NavDestination) {
  return view.stories.find((entry) => entry.destination.id === destination.id) ?? null
}

/** Status of the place's signal for the list cards. */
function signalLabel(destination: NavDestination, view: PassportView): string {
  if (!destination.available) return 'SIGNAL TOO WEAK · SOON'
  const story = storyFor(view, destination)
  if (story?.stampEarned) return 'STORY RESTORED'
  return 'SIGNAL DETECTED'
}

function drawSummary(
  ctx: CanvasRenderingContext2D,
  destination: NavDestination,
  view: PassportView,
): void {
  const story = storyFor(view, destination)
  drawPlanetPanel(ctx, destination, NAV_RECT.image, false)
  ctx.strokeStyle = 'rgba(143,227,216,0.7)'
  ctx.lineWidth = 2
  roundRectPath(ctx, NAV_RECT.image.x, NAV_RECT.image.y, NAV_RECT.image.w, NAV_RECT.image.h, 12)
  ctx.stroke()

  const { x, w } = NAV_RECT.facts
  ctx.textAlign = 'left'
  ctx.fillStyle = NAV_CREAM
  ctx.font = `800 38px ${NAV_FONT}`
  ctx.fillText(destination.name, x, NAV_TOP + 34)
  ctx.fillStyle = 'rgba(253,244,236,0.75)'
  ctx.font = `600 18px ${NAV_FONT}`
  ctx.fillText(destination.kind, x, NAV_TOP + 58)

  drawInfoRows(ctx, navRows(destination, view), x, NAV_TOP + 70, w, 32)

  // The mission clue (game text, never a scientific claim).
  ctx.fillStyle = NAV_PEACH
  ctx.font = `800 14px ${NAV_MONO}`
  ctx.fillText('★ MISSION CLUE', x, NAV_TOP + 184)
  ctx.fillStyle = NAV_CREAM
  ctx.font = `600 18px ${NAV_FONT}`
  wrapCanvasText(ctx, destination.clue, w, 1).forEach((line) => {
    ctx.fillText(line, x, NAV_TOP + 207)
  })
  ctx.fillStyle = NAV_TEAL
  ctx.font = `700 14px ${NAV_MONO}`
  const progress = story?.machineName
    ? `${STORY_STATUS_LABEL[story.status]} · ${story.scanned}/${story.total} parts`
    : 'Find the explorer and bring its story home'
  ctx.fillText(fitCanvasText(ctx, progress.toUpperCase(), w), x, NAV_TOP + 240)

  const back = NAV_RECT.back
  ctx.strokeStyle = 'rgba(143,227,216,0.75)'
  ctx.lineWidth = 2
  roundRectPath(ctx, back.x, back.y, back.w, back.h, 14)
  ctx.stroke()
  ctx.fillStyle = NAV_TEAL
  ctx.font = `800 22px ${NAV_FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('← Back', back.x + back.w / 2, back.y + 35)

  const confirm = NAV_RECT.confirm
  ctx.fillStyle = destination.available ? '#FFC94A' : 'rgba(253,244,236,0.25)'
  roundRectPath(ctx, confirm.x, confirm.y, confirm.w, confirm.h, 14)
  ctx.fill()
  ctx.fillStyle = destination.available ? '#1B1029' : '#6B6070'
  ctx.font = `800 26px ${NAV_FONT}`
  ctx.fillText(
    destination.available ? 'Confirm route' : 'Signal too weak for now',
    confirm.x + confirm.w / 2,
    confirm.y + 36,
  )
  ctx.textAlign = 'left'
}

function drawDestinationCard(
  ctx: CanvasRenderingContext2D,
  destination: NavDestination,
  view: PassportView,
  x: number,
): void {
  const y = NAV_TOP
  const w = NAV_CARD_W
  const h = NAV_CARD_H
  const on = destination.available
  ctx.fillStyle = on ? 'rgba(216,244,240,0.07)' : 'rgba(10,6,20,0.5)'
  roundRectPath(ctx, x, y, w, h, 14)
  ctx.fill()
  ctx.strokeStyle = on ? 'rgba(255,217,168,0.55)' : 'rgba(184,166,217,0.3)'
  ctx.lineWidth = 2
  roundRectPath(ctx, x, y, w, h, 14)
  ctx.stroke()

  drawPlanetPanel(ctx, destination, { x: x + 10, y: y + 10, w: w - 20, h: 100 }, !on)

  ctx.globalAlpha *= on ? 1 : 0.7
  ctx.textAlign = 'left'
  ctx.fillStyle = NAV_CREAM
  ctx.font = `800 28px ${NAV_FONT}`
  ctx.fillText(destination.name, x + 14, y + 140)
  ctx.fillStyle = 'rgba(253,244,236,0.72)'
  ctx.font = `600 16px ${NAV_FONT}`
  ctx.fillText(fitCanvasText(ctx, destination.kind, w - 28), x + 14, y + 162)

  drawInfoRows(ctx, navRows(destination, view), x + 10, y + 174, w - 20, 32)
  ctx.globalAlpha /= on ? 1 : 0.7

  drawSignalPill(ctx, x + 10, y + h - 42, on, signalLabel(destination, view))
}

function drawDestinations(
  ctx: CanvasRenderingContext2D,
  destinations: readonly NavDestination[],
  selectedId: string | null,
  view: PassportView,
): void {
  // Opaque: the idle radar must not show through the panel.
  const gradient = ctx.createLinearGradient(0, 0, NAV_W, NAV_H)
  gradient.addColorStop(0, '#1C3F55')
  gradient.addColorStop(1, '#1B1029')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, NAV_W, NAV_H)
  ctx.strokeStyle = 'rgba(143,227,216,0.55)'
  ctx.lineWidth = 3
  roundRectPath(ctx, 6, 6, NAV_W - 12, NAV_H - 12, 12)
  ctx.stroke()

  const selected = destinations.find((entry) => entry.id === selectedId)
  ctx.textAlign = 'left'
  ctx.fillStyle = NAV_TEAL
  ctx.font = `800 24px ${NAV_FONT}`
  ctx.fillText('NAVIGATION', NAV_PAD + 4, 44)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(253,244,236,0.85)'
  ctx.font = `700 18px ${NAV_FONT}`
  ctx.fillText(
    selected
      ? 'Route details'
      : view.transmittedCount > 0
        ? `${view.transmittedCount}/${view.totalStories} stories restored`
        : 'Where shall we fly?',
    NAV_W - NAV_PAD - 4,
    44,
  )
  ctx.textAlign = 'left'

  if (selected) {
    drawSummary(ctx, selected, view)
    return
  }
  destinations.forEach((destination, index) => {
    drawDestinationCard(ctx, destination, view, NAV_PAD + index * (NAV_CARD_W + NAV_CARD_GAP))
  })
}

/** Whole navigation screen: idle radar first, cards fade in as the pilot
 *  leans in. */
function drawNavScreen(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  destinations: readonly NavDestination[],
  selectedId: string | null,
  view: PassportView,
): void {
  drawRadarIdle(ctx)
  if (alpha <= 0.01) return
  ctx.save()
  ctx.globalAlpha = alpha
  drawDestinations(ctx, destinations, selectedId, view)
  ctx.restore()
}

/**
 * PIP's tour highlight drawn on the navigation screen itself: a glowing
 * frame around the cards, the facts or the Confirm button. Lives in the
 * screen plane's local frame (1 canvas px = 1 mm, origin at the centre).
 */
function NavTourHighlight({ target: area }: { target: NavRect | null }) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const groupRef = useRef<THREE.Group>(null)
  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const wave = reducedMotion ? 0.5 : (Math.sin(state.clock.elapsedTime * 4.2) + 1) / 2
    group.children.forEach((child) => {
      const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = 0.45 + wave * 0.55
    })
  })
  if (!area) return null
  const t = 5
  const pad = 7
  const target = { x: area.x - pad, y: area.y - pad, w: area.w + pad * 2, h: area.h + pad * 2 }
  const cx = (target.x + target.w / 2) / 1000 - NAV_W / 2000
  const cy = NAV_H / 2000 - (target.y + target.h / 2) / 1000
  const w = target.w / 1000
  const h = target.h / 1000
  const bars: [number, number, number, number][] = [
    [0, h / 2, w + t / 1000, t / 1000],
    [0, -h / 2, w + t / 1000, t / 1000],
    [-w / 2, 0, t / 1000, h],
    [w / 2, 0, t / 1000, h],
  ]
  return (
    <group ref={groupRef} position={[cx, cy, 0.002]}>
      {bars.map(([x, y, bw, bh], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <planeGeometry args={[bw, bh]} />
          <meshBasicMaterial
            color={BEACON_COLOR}
            toneMapped={false}
            transparent
            depthWrite={false}
          />
        </mesh>
      ))}
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
  const selectedDestinationId = useOnboardingStore(
    (state) => state.selectedDestination,
  )
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const setRouteOpen = useOnboardingStore((state) => state.setRouteOpen)
  const selectDestination = useOnboardingStore(
    (state) => state.selectDestination,
  )
  const clearSelection = useOnboardingStore((state) => state.clearSelection)
  const confirmRoute = useOnboardingStore((state) => state.confirmRoute)
  const save = useJourneyStore((state) => state.save)
  const view = getPassportView(save)
  const [hovered, setHovered] = useState(false)
  const focus = useHubFocus()
  const navEnabled = hubElementEnabled(focus, 'nav')
  const navAllowed = (element: string) => hubElementEnabled(focus, element)

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

  const lastDrawnRef = useRef({
    blend: -1,
    selected: undefined as string | null | undefined,
    viewKey: -1,
  })
  const viewKey = save?.updatedAt ?? 0
  useFrame(() => {
    const blend = smoothstep(Math.min(1, routeBlend.value * 1.6))
    const last = lastDrawnRef.current
    if (
      blend === last.blend &&
      selectedDestinationId === last.selected &&
      viewKey === last.viewKey
    ) {
      return
    }
    drawNavScreen(
      screen.ctx,
      blend,
      DESTINATIONS,
      selectedDestinationId,
      view,
    )
    screen.texture.needsUpdate = true
    last.blend = blend
    last.selected = selectedDestinationId
    last.viewKey = viewKey
  })

  return (
    <mesh
      position={[NAV_ZONE_CENTER_X, NAV_SCREEN_Y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        // The board controls only respond in the hub, and during the
        // guided tour only once PIP points at the screen.
        if (phase !== 'hub') return
        if (!routeOpen) {
          if (!navEnabled) return
          setRouteOpen(true)
          return
        }
        const uv = event.uv
        if (!uv) return
        const px = uv.x * NAV_W
        const py = (1 - uv.y) * NAV_H
        if (selectedDestinationId) {
          if (inNavRect(NAV_RECT.confirm, px, py)) {
            const destination = DESTINATIONS.find(
              (entry) => entry.id === selectedDestinationId,
            )
            if (destination?.available && navAllowed('nav-confirm')) confirmRoute()
            return
          }
          if (inNavRect(NAV_RECT.back, px, py) && navAllowed('nav-back')) {
            clearSelection()
          }
          return
        }
        if (!inNavRect(NAV_RECT.cards, px, py) || !navAllowed('nav-cards')) return
        const index = Math.floor((px - NAV_PAD) / (NAV_CARD_W + NAV_CARD_GAP))
        const destination = DESTINATIONS[index]
        if (destination?.available) selectDestination(destination.id)
      }}
      onPointerOver={() => {
        setHovered(true)
        emitAudio('uiHover', { dedupeKey: 'navigation-3d', dedupeMs: 180 })
        if (phase === 'hub') document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <planeGeometry args={[0.86, 0.4]} />
      <NavTourHighlight
        target={
          !routeOpen || !focus.tourActive
            ? null
            : focus.target === 'nav-cards' && !selectedDestinationId
              ? NAV_RECT.cards
              : focus.target === 'nav-confirm' && selectedDestinationId
                ? NAV_RECT.confirm
                : null
        }
      />
      <meshBasicMaterial
        map={screen.texture}
        toneMapped={false}
        color={hovered ? '#D8FFF8' : '#FFFFFF'}
      />
    </mesh>
  )
}

/**
 * Main button (Inicio de misión) on its yellow/black hazard ring, in
 * the BUTTON anchor frame of the CM-01 console (+Y = board normal,
 * -Z = toward the window). A glass safety dome covers it until a
 * destination is confirmed on the navigation screen; then the dome
 * swings back on its hinge, the button glows, and pressing it takes off.
 */
function TakeOffButton() {
  const routeConfirmed = useOnboardingStore((state) => state.routeConfirmed)
  const takeOff = useOnboardingStore((state) => state.takeOff)
  const lidRef = useRef<THREE.Group>(null)
  const buttonMaterialRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state, delta) => {
    const lid = lidRef.current
    if (lid) {
      lid.rotation.x = THREE.MathUtils.damp(lid.rotation.x, routeConfirmed ? -1.75 : 0, 6, delta)
    }
    const material = buttonMaterialRef.current
    if (material) {
      material.emissiveIntensity = routeConfirmed
        ? 0.55 + Math.sin(state.clock.elapsedTime * 4) * 0.25
        : 0.08
    }
  })

  return (
    <group>
      {/* White collar the red cap sits in (socket top is y = 0.04). */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.175, 0.185, 0.03, 40]} />
        <meshStandardMaterial color="#D9DDE2" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh
        position={[0, 0.095, 0]}
        onPointerDown={(event) => {
          event.stopPropagation()
          if (routeConfirmed) takeOff()
        }}
        onPointerOver={() => {
          if (routeConfirmed) {
            emitAudio('uiHover', { dedupeKey: 'red-button-3d', dedupeMs: 180 })
            document.body.style.cursor = 'pointer'
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <cylinderGeometry args={[0.14, 0.15, 0.07, 40]} />
        <meshStandardMaterial
          ref={buttonMaterialRef}
          color="#E0313A"
          emissive="#FF2A2A"
          emissiveIntensity={0.08}
          roughness={0.55}
        />
      </mesh>
      {/* Dome base ring + hinge block at the back (toward the window). */}
      <mesh position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.205, 0.014, 10, 48]} />
        <meshStandardMaterial color="#4B515B" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.055, -0.215]}>
        <boxGeometry args={[0.12, 0.04, 0.04]} />
        <meshStandardMaterial color="#8A9099" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Glass safety dome, hinged on the back edge. */}
      <group ref={lidRef} position={[0, 0.055, -0.205]}>
        <group position={[0, 0, 0.205]}>
          <mesh onPointerDown={(event) => event.stopPropagation()} renderOrder={5}>
            <sphereGeometry args={[0.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {/* Satin glass: a mirror-smooth clearcoat caught every cabin
                light as a tiny highlight, and bloom turned them into
                "stars". A softer, front-side-only surface gives one
                broad sheen instead. */}
            <meshStandardMaterial
              color="#DDEFFF"
              transparent
              opacity={0.32}
              roughness={0.35}
              metalness={0}
              envMapIntensity={0.4}
              depthWrite={false}
              side={THREE.FrontSide}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.2, 0.01, 8, 48]} />
            <meshStandardMaterial color="#B9BFC6" roughness={0.35} metalness={0.4} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

const BEACON_COLOR = new THREE.Color('#FFC94A').multiplyScalar(1.6)

/**
 * Guided-tour highlight drawn on a cabin anchor (+Y = surface normal):
 * a glowing frame that breathes around the element plus an arrow that
 * bobs above it, so a child sees exactly what PIP is talking about.
 */
function TourBeacon({
  width,
  depth,
  round = false,
  arrowHeight = 0.42,
}: {
  width: number
  depth: number
  round?: boolean
  arrowHeight?: number
}) {
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const frameRef = useRef<THREE.Group>(null)
  const arrowRef = useRef<THREE.Group>(null)
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: BEACON_COLOR,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  useEffect(() => () => frameMaterial.dispose(), [frameMaterial])
  const t = 0.022

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const wave = reducedMotion ? 0.5 : (Math.sin(time * 4.2) + 1) / 2
    if (frameRef.current) frameRef.current.scale.setScalar(1 + wave * 0.06)
    const firstFrame = frameRef.current?.children[0] as THREE.Mesh | undefined
    const material = firstFrame?.material as THREE.MeshBasicMaterial | undefined
    if (material) material.opacity = 0.55 + wave * 0.45
    if (arrowRef.current) {
      arrowRef.current.position.y =
        arrowHeight + (reducedMotion ? 0 : Math.abs(Math.sin(time * 3)) * 0.12)
    }
  })

  return (
    <group>
      <group ref={frameRef} position={[0, 0.03, 0]}>
        {round ? (
          <mesh rotation={[-Math.PI / 2, 0, 0]} material={frameMaterial}>
            <ringGeometry args={[width / 2, width / 2 + t * 1.6, 48]} />
          </mesh>
        ) : (
          <>
            {(
              [
                [0, depth / 2, width + t, t],
                [0, -depth / 2, width + t, t],
                [width / 2, 0, t, depth + t],
                [-width / 2, 0, t, depth + t],
              ] as const
            ).map(([x, z, w, d], index) => (
              <mesh key={index} position={[x, 0, z]} material={frameMaterial}>
                <boxGeometry args={[w, t, d]} />
              </mesh>
            ))}
          </>
        )}
      </group>
      <group ref={arrowRef} position={[0, arrowHeight, 0]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.07, 0.16, 20]} />
          <meshBasicMaterial color={BEACON_COLOR} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.14, 12]} />
          <meshBasicMaterial color={BEACON_COLOR} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Shows a TourBeacon only while PIP points at this cabin element. */
function TourHighlight({
  element,
  children,
}: {
  element: HubTarget
  children: ReactNode
}) {
  const focus = useHubFocus()
  const routeOpen = useOnboardingStore((state) => state.routeOpen)
  const albumOpen = useOnboardingStore((state) => state.passportDetailOpen)
  if (focus.target !== element || routeOpen || albumOpen) return null
  return <>{children}</>
}

/**
 * Click target for the Álbum de misiones resting on the console (the
 * book itself is modelled in the cabin GLB). ALBUM anchor frame:
 * +Y = out of the cover, -Z = toward the window.
 */
function MissionAlbumHit({ onHover }: { onHover: (hovered: boolean) => void }) {
  const phase = useOnboardingStore((state) => state.phase)
  const save = useJourneyStore((state) => state.save)
  const setPassportDetailOpen = useOnboardingStore((state) => state.setPassportDetailOpen)
  const albumAllowed = hubElementEnabled(useHubFocus(), 'album')
  const enabled =
    Boolean(save) && (phase === 'hub' || phase === 'playing') && albumAllowed
  return (
    <mesh
      position={[0, 0.06, 0]}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (enabled) setPassportDetailOpen(true)
      }}
      onPointerOver={() => {
        if (!enabled) return
        onHover(true)
        emitAudio('uiHover', { dedupeKey: 'album-3d', dedupeMs: 180 })
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        onHover(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <boxGeometry args={[0.72, 0.16, 0.86]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/** Window projections for the cinematic intro: welcome, unfinished
 *  archive signals and the forming smart letter invitation. */
function MemoryWindowHolograms() {
  const phase = useOnboardingStore((state) => state.phase)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)

  const introSvg =
    phase === 'intro'
      ? introHologramSvg(introHologramForLine(dialogueIndex))
      : null

  return introSvg ? <WindowHologram svg={introSvg} /> : null
}

/** Scale of the navigation screen inside the CM-01 nav recess (1.22 x 0.68). */
const NAV_SCREEN_SCALE = 1.35

/**
 * Cabina de mando CM-01 Explorer, visible only during the cabin steps:
 * the modelled room (round panoramic window, side monitors, U console,
 * pilot seat, lanterns) with the interactive navigation screen, the
 * main button under its safety dome and the mission album mounted on
 * its anchors. Mars and the stars show through the open window.
 */
function CabinInterior() {
  const phase = useOnboardingStore((state) => state.phase)
  const dialogueIndex = useOnboardingStore((state) => state.dialogueIndex)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const albumOpen = useOnboardingStore((state) => state.passportDetailOpen)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const groupRef = useRef<THREE.Group>(null)
  const windowDarkRef = useRef<THREE.MeshBasicMaterial>(null)
  const windowRimRef = useRef<THREE.MeshBasicMaterial>(null)
  const [albumHovered, setAlbumHovered] = useState(false)
  // The launch countdown happens INSIDE the cabin (seated, PIP
  // talking); from liftoff on, the wide menu shot returns.
  const cabin =
    (phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin') ||
    (phase === 'launching' && inCabinStage(launchClock.value, reducedMotion))

  // Visibility is driven per-frame: the launch stage changes without
  // a React re-render, so the render-time flag alone is not enough.
  useFrame((_, delta) => {
    const group = groupRef.current
    if (!group) return
    group.visible =
      (phase !== 'menu' && phase !== 'launching' && boardingStage === 'cabin') ||
      (phase === 'launching' && inCabinStage(launchClock.value, reducedMotion))

    // Cosmic Memory Window: during the cinematic intro (except the
    // Welcome moment) the glass darkens to ~85% so the hologram
    // stage reads inside the window. Leaving the intro fades it out.
    const inMemoryWindow =
      phase === 'intro' && introMomentForLine(dialogueIndex) !== 'arrival'
    const darkTarget = inMemoryWindow ? 0.85 : 0
    const lambda = reducedMotion ? 8 : 1.8
    if (windowDarkRef.current) {
      windowDarkRef.current.opacity = THREE.MathUtils.damp(
        windowDarkRef.current.opacity,
        darkTarget,
        lambda,
        delta,
      )
    }
    if (windowRimRef.current) {
      windowRimRef.current.opacity = THREE.MathUtils.damp(
        windowRimRef.current.opacity,
        darkTarget * 0.4,
        lambda,
        delta,
      )
    }
  })

  if (!cabin && phase !== 'launching') return null

  // The album leaves the console while its pages are open ("in hand").
  const albumHidden = albumOpen && (phase === 'hub' || phase === 'playing')

  return (
    <group ref={groupRef} visible={cabin}>
      <Suspense fallback={null}>
        <CabinCM01
          launching={phase === 'launching'}
          reducedMotion={reducedMotion}
          albumHovered={albumHovered}
          albumHidden={albumHidden}
          slots={{
            NAV: (
              <group scale={NAV_SCREEN_SCALE}>
                <group position={[-NAV_ZONE_CENTER_X, -NAV_SCREEN_Y, 0]}>
                  <NavScreenOnBoard />
                  <RadarSweep position={[NAV_ZONE_CENTER_X, NAV_SCREEN_Y + 0.009, 0]} />
                </group>
                <TourHighlight element="nav">
                  <TourBeacon width={0.96} depth={0.54} arrowHeight={0.36} />
                </TourHighlight>
              </group>
            ),
            BUTTON: (
              <>
                <TakeOffButton />
                <TourHighlight element="button">
                  <TourBeacon width={0.46} depth={0.46} round arrowHeight={0.5} />
                </TourHighlight>
              </>
            ),
            ALBUM: albumHidden ? null : (
              <>
                <MissionAlbumHit onHover={setAlbumHovered} />
                <TourHighlight element="album">
                  <TourBeacon width={0.8} depth={0.94} arrowHeight={0.45} />
                </TourHighlight>
              </>
            ),
            SCREEN_L: <CabinMonitor kind="ship" />,
            SCREEN_R: <CabinMonitor kind="mission" />,
          }}
        />
      </Suspense>

      {/* Faint glass in the window opening, plus the Memory Window
          dimming disc used by the intro holograms. */}
      <mesh position={[0, 0.3, -4.62]}>
        <circleGeometry args={[1.7, 64]} />
        <meshBasicMaterial color="#D8FFF8" transparent opacity={0.04} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.3, -4.6]} renderOrder={2}>
        <circleGeometry args={[1.7, 64]} />
        <meshBasicMaterial
          ref={windowDarkRef}
          color="#070512"
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.3, -4.45]} renderOrder={3}>
        <torusGeometry args={[1.62, 0.012, 8, 64]} />
        <meshBasicMaterial
          ref={windowRimRef}
          color="#8FE3D8"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Intro archive hologram: behind PIP, inside the round window. */}
      <MemoryWindowHolograms />

      {/* Bright, friendly cabin light: soft sky fill from the ceiling
          panels, warm spill from the window ring and a key over the
          console from the pilot's side. */}
      {/* Violet "aura" of the reference sheet: lavender sky fill, deep
          violet bounce from below and violet rims in the side bays. */}
      <hemisphereLight args={['#DCD0F7', '#3A2A63', 1.15]} />
      <directionalLight position={[0.5, 2.0, 1.5]} intensity={0.7} color="#F4EEFF" />
      <pointLight position={[-3.0, 1.4, -1.0]} intensity={4} distance={5.5} color="#8C6BE0" />
      <pointLight position={[3.0, 1.4, -1.0]} intensity={4} distance={5.5} color="#8C6BE0" />
      <pointLight position={[0, 0.6, 2.6]} intensity={3} distance={5} color="#7B5CC9" />
      <pointLight position={[0, 1.55, -1.6]} intensity={4} distance={7} color="#FFE9D2" />
      <pointLight position={[0, 0.4, -3.9]} intensity={3.5} distance={4.5} color="#FF9A4A" />
      <pointLight position={[-0.9, -0.3, -2.4]} intensity={1.2} distance={2.2} color="#5FE0CF" />

      <CabinPip />
    </group>
  )
}

/**
 * Title-shot lighting. Inside the cabin the warm key and the ship's
 * spot are dimmed so the CM-01's own violet-tinted lights lead.
 */
/** True while the camera is inside the CM-01 cabin (boarding, hub or the
 *  seated part of the launch). Read every frame: launch stages change
 *  without a React re-render. */
function cameraInCabin(
  phase: string,
  boardingStage: string,
  reducedMotion: boolean,
): boolean {
  if (phase === 'launching') return inCabinStage(launchClock.value, reducedMotion)
  return phase !== 'menu' && boardingStage === 'cabin'
}

function MenuLights() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const keyRef = useRef<THREE.DirectionalLight>(null)
  const fillRef = useRef<THREE.DirectionalLight>(null)
  const warmRef = useRef<THREE.PointLight>(null)
  const violet = useMemo(() => new THREE.Color('#C9B8F0'), [])
  const white = useMemo(() => new THREE.Color('#FFFFFF'), [])

  // The cabin keeps its violet mood (and the menu its warm key light)
  // in every phase, including the seated countdown of the launch.
  useFrame(() => {
    const inCabin = cameraInCabin(phase, boardingStage, reducedMotion)
    if (ambientRef.current) {
      ambientRef.current.intensity = inCabin ? 0.25 : 0.4
      ambientRef.current.color.copy(inCabin ? violet : white)
    }
    if (keyRef.current) keyRef.current.intensity = inCabin ? 0.35 : 1.6
    if (fillRef.current) fillRef.current.intensity = inCabin ? 0.6 : 0.5
    if (warmRef.current) warmRef.current.intensity = inCabin ? 0 : 8
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.4} />
      <directionalLight ref={keyRef} position={[-6, 8, 10]} intensity={1.6} color="#FFD9A8" />
      <directionalLight ref={fillRef} position={[6, -2, 8]} intensity={0.5} color="#B8A6D9" />
      <pointLight ref={warmRef} position={[5.4, 0, 2]} intensity={8} distance={11} color="#FFD9A8" />
    </>
  )
}

/**
 * Bloom + violet vignette inside the cabin, kept on for the whole launch:
 * the countdown glows like the hub, and in space the exhaust and the
 * warp streaks bloom.
 */
function CabinGlow() {
  const phase = useOnboardingStore((state) => state.phase)
  const boardingStage = useOnboardingStore((state) => state.boardingStage)
  const glow =
    phase === 'launching' || (phase !== 'menu' && boardingStage === 'cabin')
  return glow ? <CabinEffects /> : null
}

/* ------------------------------------------------------------------ */
/* Warp streaks: the stars stretch into speed lines during the flight   */
/* ------------------------------------------------------------------ */

const WARP_COUNT = 180
// Streaks rush past the ship opposite to its travel (it flies toward -X,
// slightly down), so they move +X with a touch of upward drift.
const WARP_DIR = new THREE.Vector3(1, 0.07, 0.04).normalize()

function WarpStreaks() {
  const phase = useOnboardingStore((state) => state.phase)
  const reducedMotion = useGameStore((state) => state.reducedMotion)
  const linesRef = useRef<THREE.LineSegments>(null)

  const { geometry, seeds } = useMemo(() => {
    const random = mulberry32(0x3a7f)
    const list = Array.from({ length: WARP_COUNT }, () => ({
      x: -30 + random() * 52,
      y: -10 + random() * 18,
      z: -22 + random() * 26,
      speed: 0.7 + random() * 0.6,
      tint: random(),
    }))
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WARP_COUNT * 6), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WARP_COUNT * 6), 3))
    return { geometry: geo, seeds: list }
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  const cream = useMemo(() => new THREE.Color('#FFF3DC').multiplyScalar(1.6), [])
  const teal = useMemo(() => new THREE.Color('#8FE3D8').multiplyScalar(1.6), [])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const lines = linesRef.current
    if (!lines) return
    const warp =
      phase === 'launching' && !reducedMotion && !inCabinStage(launchClock.value, reducedMotion)
        ? warpFactor(launchClock.value, reducedMotion)
        : 0
    lines.visible = warp > 0.02
    if (!lines.visible) return
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute
    const travel = Math.min(delta, 0.05) * (6 + warp * 70)
    const length = 0.15 + warp * warp * 5
    seeds.forEach((seed, index) => {
      seed.x += WARP_DIR.x * travel * seed.speed
      seed.y += WARP_DIR.y * travel * seed.speed
      seed.z += WARP_DIR.z * travel * seed.speed
      if (seed.x > 22) {
        seed.x -= 52
        seed.y -= 52 * WARP_DIR.y
      }
      const tailLength = length * seed.speed
      positions.setXYZ(index * 2, seed.x, seed.y, seed.z)
      positions.setXYZ(
        index * 2 + 1,
        seed.x - WARP_DIR.x * tailLength,
        seed.y - WARP_DIR.y * tailLength,
        seed.z - WARP_DIR.z * tailLength,
      )
      tmp.copy(seed.tint > 0.75 ? teal : cream).multiplyScalar(0.35 + warp * 0.65)
      colors.setXYZ(index * 2, tmp.r, tmp.g, tmp.b)
      colors.setXYZ(index * 2 + 1, 0, 0, 0)
    })
    positions.needsUpdate = true
    colors.needsUpdate = true
  })

  if (phase !== 'launching') return null
  return (
    <lineSegments ref={linesRef} geometry={geometry} frustumCulled={false} visible={false}>
      <lineBasicMaterial
        vertexColors
        transparent
        toneMapped={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

/**
 * Main-menu backdrop: black space, stars, shooting stars, Earth (home)
 * rotating in the lower-left corner and the Mailwing ship drifting
 * lower-right. During the cabin steps the camera moves inside the
 * canopy glass, where the window shows the last mission's planet.
 * Mounted only before the game world.
 */
/** Sharpest pixel density we render at (the screen's, capped). */
const MAX_DPR = 1.75

/**
 * Adaptive resolution: the cabin fills the screen with lit, textured
 * surfaces, which an integrated GPU cannot always draw at full pixel
 * density. PerformanceMonitor moves `factor` down when the frame rate
 * drops and back up when it recovers; the density follows it between
 * 1 and the screen's own (capped), in 0.25 steps so it rarely changes.
 */
function useAdaptiveDpr(): [number, (factor: number) => void] {
  const screenDpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DPR)
  const [dpr, setDpr] = useState(screenDpr)
  const onFactor = (factor: number) => {
    const next = Math.round((1 + (screenDpr - 1) * factor) * 4) / 4
    setDpr(Math.max(1, Math.min(screenDpr, next)))
  }
  return [dpr, onFactor]
}

export default function MenuScene() {
  const [dpr, onDprFactor] = useAdaptiveDpr()
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.4, 16], fov: 42, near: 0.1, far: 160 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={(state) => {
        state.gl.toneMapping = THREE.ACESFilmicToneMapping
        state.gl.toneMappingExposure = 1.1
        // DEV only: renderer stats for performance checks.
        if (import.meta.env.DEV) {
          ;(window as unknown as { __cosmicR3f?: unknown }).__cosmicR3f = state
        }
      }}
    >
      <PerformanceMonitor
        factor={1}
        step={0.25}
        ms={200}
        iterations={8}
        flipflops={4}
        onChange={({ factor }) => onDprFactor(factor)}
        onFallback={() => onDprFactor(0)}
      />
      <color attach="background" args={['#050309']} />
      <CameraRig />
      <MenuLights />
      <MenuStars />
      <ShootingStar />
      <BackdropPlanet />
      <WarpStreaks />
      <MailShip />
      <CabinInterior />
      <CabinGlow />
    </Canvas>
  )
}
