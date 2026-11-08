import { MARS_OBJECTS, type WorldPosition } from '../data/marsObjects'

export type Quality = 'high' | 'low'

export interface QualityPreset {
  label: string
  dpr: [number, number]
  shadows: boolean
  postprocessing: boolean
  rockCount: number
  dustCount: number
  starCount: number
  fogNear: number
  fogFar: number
  shadowMapSize: number
}

export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  high: {
    label: 'High',
    dpr: [1, 2],
    shadows: true,
    postprocessing: true,
    rockCount: 160,
    dustCount: 420,
    starCount: 1800,
    fogNear: 28,
    fogFar: 175,
    shadowMapSize: 2048,
  },
  low: {
    label: 'Low',
    dpr: [1, 1.25],
    shadows: false,
    postprocessing: false,
    rockCount: 64,
    dustCount: 150,
    starCount: 650,
    fogNear: 26,
    fogFar: 150,
    shadowMapSize: 1024,
  },
}

export const WORLD = {
  terrainSize: 240,
  terrainSegments: 160,
  playRadius: 50,
  spawn: { x: 0, z: 20 },
} as const

export const PLAYER = {
  moveSpeed: 5.4,
  moveAccel: 11,
  turnSpeed: 13,
  radius: 0.45,
} as const

export const CAMERA = {
  distance: 10.6,
  minDistance: 6.2,
  maxDistance: 16,
  pitch: 0.36,
  minPitch: 0.06,
  maxPitch: 1.12,
  orbitSensitivity: 0.0048,
  pinchSensitivity: 0.02,
  zoomSensitivity: 0.01,
  damping: 6.5,
  lookDamping: 10,
  lookHeight: 1.35,
  minTerrainClearance: 1.8,
  collisionSamples: 6,
  objectClearance: 3.6,
} as const

export const PALETTE = {
  skyZenith: '#140b24',
  skyUpper: '#33203f',
  skyMid: '#6f3c52',
  skyHorizon: '#e0a184',
  skyBelow: '#96606c',
  skyFloor: '#3a2233',
  fog: '#c98a7a',
  sun: '#ffd9a8',
  ambient: '#9a86d6',
  hemiSky: '#ffc9a8',
  hemiGround: '#3a2233',
  terrainDark: '#7c4550',
  terrainMid: '#a85f55',
  terrainLight: '#c9876c',
  terrainHigh: '#dda184',
  path: '#d9a07c',
  rockDark: '#835064',
  rockLight: '#c8877a',
  mesaNear: '#6f4459',
  mesaFar: '#54354d',
  dust: '#ffd9b8',
  beaconAvailable: '#ffb066',
  beaconSoon: '#9a8fa6',
  starWarm: '#fff4dc',
  starCool: '#c7d4ff',
  moon: '#f3ddc8',
  moonGlow: '#ffd9b8',
  skyGlowWarm: '#ff9d6e',
  skyGlowCool: '#7a5bb5',
} as const

export const SUN_DIRECTION = { x: -0.55, y: 0.22, z: -0.8 } as const

export const MOON_DIRECTION = { x: 0.44, y: 0.36, z: -0.82 } as const

/** A closed loop that visits the spawn point and every Mars site once. */
export const PATH_WAYPOINTS: readonly WorldPosition[] = [
  WORLD.spawn,
  ...MARS_OBJECTS.map((object) => object.position),
  WORLD.spawn,
]
