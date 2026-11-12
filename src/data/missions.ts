/**
 * Educational content for the three Cosmic Mail MVP missions.
 *
 * Content only: no React, no rendering and no persistence. Every
 * component keeps the historical record, its NASA sources and PIP's
 * narrative line in separate fields. Facts were checked against the
 * linked NASA pages; the mission-level `contentStatus` states whether
 * the final educational selection is approved or still under review.
 *
 * Cosmic Mail never repairs, reactivates or rescues these machines.
 * The player scans them, records what they did and preserves their
 * stories.
 */

import { pipLine } from './pipVoiceCatalog'

export const DESTINATION_IDS = ['moon', 'mars', 'deep-space'] as const
export type DestinationId = (typeof DESTINATION_IDS)[number]

export const MISSION_IDS = ['surveyor-3', 'spirit', 'pioneer-10'] as const
export type MissionId = (typeof MISSION_IDS)[number]

export type WorldMode = 'surface' | 'hologram'

/**
 * `source-checked` means the statement is backed by the linked NASA
 * page. `pending-review` means a final educational/editorial decision
 * is still open, even if the individual facts are sourced.
 */
export type ContentStatus = 'source-checked' | 'pending-review'

export interface MissionSource {
  label: string
  url: string
}

/** Relative position (0–100) on the scanner's schematic map. */
export interface HotspotPosition {
  x: number
  y: number
}

export interface MissionComponent {
  /** Globally unique across all missions (mission-prefixed). */
  id: string
  name: string
  /** Compact label for hotspot buttons and HUDs. */
  shortName: string
  /** Historical claim, kept separate from PIP's narrative voice. */
  historicalRecord: string
  /** PIP's child-friendly explanation. Fiction, not a historical claim. */
  pipLine: string
  /** Optional progressive hint PIP can offer for this component. */
  pipHint?: string
  /** Direct help line once the player asks PIP for more detail. */
  pipDirectHint?: string
  /** Short spatial hint for the 3D hotspot. */
  scanHint: string
  /** Optional position on the scanner map; falls back to a list. */
  hotspot?: HotspotPosition
  sources: readonly MissionSource[]
  validation: ContentStatus
}

/** PIP's reusable mission narrative. Content only, no rendering. */
export interface MissionNarrative {
  /** Once per Mars visit, when the player lands and the scanner wakes up. */
  entered: string
  /** First time the machine enters detection range (identity still hidden). */
  detected: string
  /** First time the player reaches the inspection ring (identity still hidden). */
  approached: string
  /** First valid identification event: PIP reconnects the historical record. */
  identified: string
  /** Desktop instruction when the player has not equipped the scanner. */
  scannerPromptDesktop: string
  /** Touch instruction when the player has not equipped the scanner. */
  scannerPromptTouch: string
  /** First time the physical scanner is equipped. */
  scannerEquipped: string
  /** First time the reticle rests on a valid component. */
  targetDetected: string
  /** A valid hold-to-scan begins. */
  scanStarted: string
  /** A hold-to-scan was released or lost before completing. */
  scanInterrupted: string
  /** Two short lines after the third component is recorded. */
  completed: readonly [string, string]
  /** Full-object recognition is available; the player must choose it. */
  fullScanReady: string
  /** The player holds the full-object recognition scan. */
  fullScanStarted: string
  /** Two beats after a valid full recognition scan. */
  fullScanComplete: readonly [string, string]
  /** The smart letter already exists and can be reviewed or transmitted. */
  letterPrepared: string
  /** The letter is ready and the player must return to Mailwing. */
  returnToShip: string
  /** Level 1 help: general objective, never the solution. */
  hintOrientation: string
  /** Level 2 help: region/function, still without naming a part. */
  hintContext: string
  /** Friendly fallback when no component-specific hint exists. */
  genericHint: string
  /** Rare, quiet observations that keep exploration curious. */
  ambient: readonly string[]
  /** The player returns with fragments still missing. */
  revisitInProgress: string
  /** The record is ready but not yet transmitted to Earth. */
  revisitLetterReady: string
  /** The mission is restored and transmitted. */
  revisitTransmitted: string
}

/**
 * The four dimensions required by the Cosmic Archive for every restored
 * history. Text is content only; it never claims the machine is alive.
 */
export interface SmartLetterContent {
  identity: string
  trajectory: string
  discoveries: string
  missionEnd: string
}

/**
 * First-person historical reconstruction. It is explicitly a recreation,
 * never a recording or a live message from the machine. Final audiovisual
 * production remains an open canon decision; this script is the honest,
 * testable placeholder.
 */
export interface MemoryReconstruction {
  title: string
  /** Narrated first-person beats. */
  lines: readonly string[]
  /** Production status, surfaced in the UI label. */
  status: 'script-draft'
}

export interface MissionDefinition {
  id: MissionId
  destination: DestinationId
  /** The historical machine itself. */
  machineName: string
  /** Display title used by the future hub and HUD. */
  missionName: string
  yearLabel: string
  /** Historical summary, separate from PIP's briefing. */
  summary: string
  /** PIP's narrative briefing. */
  pipBriefing: string
  worldMode: WorldMode
  components: readonly [MissionComponent, MissionComponent, MissionComponent]
  /** Content destined for the Earth Cosmic Archive. */
  smartLetter: SmartLetterContent
  /** First-person recreation unlocked by the smart letter. */
  reconstruction: MemoryReconstruction
  stampId: string
  stampLabel: string
  /** PIP's closing narrative once the history is transmitted. */
  completionStory: string
  /** Optional PIP narrative cues for the mission experience. */
  narrative?: MissionNarrative
  sources: readonly MissionSource[]
  contentStatus: ContentStatus
  /** Explicit note when a content decision is still pending. */
  reviewNote: string | null
}

export const SURVEYOR_3_SOURCES: readonly MissionSource[] = [
  {
    label: 'NASA Science — Surveyor 3',
    url: 'https://science.nasa.gov/mission/surveyor-3/',
  },
  {
    label: 'NASA — Apollo 12',
    url: 'https://www.nasa.gov/mission/apollo-12/',
  },
]

export const SPIRIT_SOURCES: readonly MissionSource[] = [
  {
    label: 'NASA Science — Mars Exploration Rover Spirit',
    url: 'https://science.nasa.gov/mission/mer-spirit/',
  },
]

export const PIONEER_10_SOURCES: readonly MissionSource[] = [
  {
    label: 'NASA Science — Pioneer 10',
    url: 'https://science.nasa.gov/mission/pioneer-10/',
  },
  {
    label: 'NASA Science — Pioneer Plaque',
    url: 'https://science.nasa.gov/resource/pioneer-plaque/',
  },
]

export const MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'surveyor-3',
    destination: 'moon',
    machineName: 'Surveyor 3',
    missionName: 'Surveyor 3 · Moon',
    yearLabel: '1967',
    summary:
      "Surveyor 3 was the second spacecraft in NASA's Surveyor series to make a soft landing on the Moon. It landed in April 1967, sent thousands of pictures to Earth and tested the lunar surface.",
    pipBriefing:
      'Surveyor 3 landed softly on the Moon and showed us what the ground was really like. Later, Apollo 12 astronauts visited it. Let us find the parts that tell its story.',
    worldMode: 'surface',
    components: [
      {
        id: 'surveyor-3-tv-camera',
        name: 'Television camera',
        shortName: 'TV camera',
        historicalRecord:
          "Surveyor 3's television camera sent 6,326 pictures of the lunar surface to Earth. It used 25 mm and 100 mm lenses and a movable mirror. Apollo 12 astronauts later brought the camera back for study.",
        pipLine:
          "This camera was Surveyor 3's eye. It sent home thousands of pictures so people could see the Moon up close.",
        scanHint: 'A round camera assembly near the top of the lander.',
        sources: SURVEYOR_3_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'surveyor-3-surface-sampler',
        name: 'Surface sampler',
        shortName: 'Soil scoop',
        historicalRecord:
          'Surveyor 3 carried a surface sampler that could reach about 1.5 meters from the lander and dig about 18 centimeters deep. It dug trenches and tested how the lunar soil held weight.',
        pipLine:
          'This scoop touched the Moon for us. It dug little trenches and showed how the dusty ground holds weight.',
        scanHint: 'A small arm folded against the side of the lander.',
        sources: SURVEYOR_3_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'surveyor-3-descent-radar',
        name: 'Descent radar',
        shortName: 'Descent radar',
        historicalRecord:
          "Surveyor 3 used descent radar to measure its height and speed during landing. Reflective rocks confused the radar, and the main engine did not cut off at the expected moment, so the lander bounced twice before settling.",
        pipLine:
          'This radar helped Surveyor 3 feel its way down. The landing was a little bumpy, but it still reached the surface safely.',
        scanHint: 'A sensor cluster aimed down toward the ground.',
        sources: SURVEYOR_3_SOURCES,
        validation: 'source-checked',
      },
    ],
    smartLetter: {
      identity:
        'Surveyor 3 was a NASA robotic lander. Its job was to test the lunar surface and take close-up pictures before astronauts made the first crewed landings.',
      trajectory:
        'It launched on 17 April 1967 and landed in Oceanus Procellarum on 20 April 1967. It carried a television camera, a surface sampler and descent radar.',
      discoveries:
        'Its camera sent 6,326 pictures to Earth. The surface sampler dug trenches and tested how lunar soil holds weight, helping engineers understand what a lander would meet on the Moon.',
      missionEnd:
        'Surveyor 3 stopped communicating in May 1967. In November 1969, Apollo 12 astronauts landed nearby and brought some of its parts back to Earth for study.',
    },
    reconstruction: {
      title: 'Surveyor 3 · First-person reconstruction',
      status: 'script-draft',
      lines: [
        'I am falling toward a grey plain that no one has ever touched.',
        'My radar measures the ground. The engine fires, the surface rises to meet me, and I settle.',
        'I open my camera and send the Moon back to Earth, one picture at a time.',
        'My scoop presses into the dust. It is not soft like sand at home; it can carry weight.',
        'Years later, astronauts walk toward me, far from their own landing site.',
      ],
    },
    stampId: 'stamp-surveyor-3',
    stampLabel: 'Surveyor 3 · Moon',
    completionStory:
      "Surveyor 3's history is restored. Its pictures and soil tests helped scientists understand the Moon before Apollo astronauts arrived.",
    sources: SURVEYOR_3_SOURCES,
    contentStatus: 'source-checked',
    reviewNote: null,
  },
  {
    id: 'spirit',
    destination: 'mars',
    machineName: 'Spirit',
    missionName: 'Spirit · Mars',
    yearLabel: '2004–2010',
    summary:
      "Spirit was one of NASA's twin Mars Exploration Rovers. It landed in Gusev Crater in January 2004 and studied rocks and soil for clues about past water activity on Mars.",
    pipBriefing:
      'Spirit rolled across Mars much longer than anyone expected. Its cameras and tools let us read the story written in the rocks. Let us look closer.',
    worldMode: 'surface',
    components: [
      {
        id: 'spirit-pancam',
        name: 'Panoramic camera (Pancam)',
        shortName: 'Pancam',
        historicalRecord:
          "The panoramic camera (Pancam) was mounted on Spirit's mast. It took high-resolution color images and 360-degree stereoscopic views of the Martian terrain.",
        pipLine: pipLine('mars-pancam'),
        pipHint: pipLine('mars-hint-pancam'),
        pipDirectHint: pipLine('mars-direct-pancam'),
        scanHint: 'The pair of cameras at the top of the mast.',
        hotspot: { x: 62, y: 24 },
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'spirit-rock-abrasion-tool',
        name: 'Rock Abrasion Tool (RAT)',
        shortName: 'RAT',
        historicalRecord:
          "The Rock Abrasion Tool (RAT) ground away the dusty outer layer of rocks so Spirit's instruments could study the fresh rock inside. Spirit used it on Mars for the first time on a rock called Adirondack.",
        pipLine: pipLine('mars-rat'),
        pipHint: pipLine('mars-hint-rat'),
        pipDirectHint: pipLine('mars-direct-rat'),
        scanHint: 'A small tool on the robotic arm.',
        hotspot: { x: 34, y: 64 },
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'spirit-mini-tes',
        name: 'Miniature Thermal Emission Spectrometer (Mini-TES)',
        shortName: 'Mini-TES',
        historicalRecord:
          "Mini-TES measured infrared light from rocks and soil to help identify their minerals. It was part of Spirit's panoramic mast assembly.",
        pipLine: pipLine('mars-mini-tes'),
        pipHint: pipLine('mars-hint-mini-tes'),
        pipDirectHint: pipLine('mars-direct-mini-tes'),
        scanHint: 'An instrument beside the cameras on the mast.',
        hotspot: { x: 72, y: 46 },
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
    ],
    smartLetter: {
      identity:
        'Spirit was one of NASA\'s twin Mars Exploration Rovers. Its purpose was to study Martian rocks and soil for clues about the planet\'s past environment and water.',
      trajectory:
        'Spirit landed in Gusev Crater on 4 January 2004, on a mission planned to last about 90 days. It drove across plains and hills for years, far longer than expected.',
      discoveries:
        'Spirit found mineral and rock evidence that ancient Mars had water-driven environments. Its cameras, rock abrasion tool and Mini-TES let scientists read the history written in the rocks.',
      missionEnd:
        'In 2009 Spirit became embedded in soft soil. Its last communication with Earth was in March 2010. It remains on Mars, and its discoveries are part of the record of Mars exploration.',
    },
    reconstruction: {
      title: 'Spirit · First-person reconstruction',
      status: 'script-draft',
      lines: [
        'I land in a crater on a cold, dusty world. I do not know how long I will last.',
        'My wheels carry me across the plain. My cameras look at rocks no one has seen before.',
        'I grind a small patch of stone and my instruments read what is inside.',
        'The rocks tell me about water that flowed here long ago, when Mars was different.',
        'One day my wheels cannot move. I keep listening to the sky for as long as I can.',
      ],
    },
    stampId: 'stamp-spirit',
    stampLabel: 'Spirit · Mars',
    completionStory: pipLine('mars-completion-story'),
    narrative: {
      entered: pipLine('mars-arrival'),
      detected: pipLine('mars-detected'),
      approached: pipLine('mars-approached'),
      identified: pipLine('mars-identified'),
      scannerPromptDesktop: pipLine('mars-scanner-prompt-desktop'),
      scannerPromptTouch: pipLine('mars-scanner-prompt-touch'),
      scannerEquipped: pipLine('mars-scanner-equipped'),
      targetDetected: pipLine('mars-target-detected'),
      scanStarted: pipLine('mars-scan-started'),
      scanInterrupted: pipLine('mars-scan-interrupted'),
      completed: [
        pipLine('mars-completed-1'),
        pipLine('mars-completed-2'),
      ],
      fullScanReady: pipLine('mars-full-scan-ready'),
      fullScanStarted: pipLine('mars-full-scan-started'),
      fullScanComplete: [
        pipLine('mars-full-scan-1'),
        pipLine('mars-full-scan-2'),
      ],
      letterPrepared: pipLine('mars-letter-prepared'),
      returnToShip: pipLine('mars-return-to-ship'),
      hintOrientation: pipLine('mars-hint-orientation'),
      hintContext: pipLine('mars-hint-context'),
      genericHint: pipLine('mars-generic-hint'),
      ambient: [pipLine('mars-ambient-1'), pipLine('mars-ambient-2')],
      revisitInProgress: pipLine('mars-revisit-in-progress'),
      revisitLetterReady: pipLine('mars-revisit-letter-ready'),
      revisitTransmitted: pipLine('mars-revisit-transmitted'),
    },
    sources: SPIRIT_SOURCES,
    contentStatus: 'source-checked',
    reviewNote: null,
  },
  {
    id: 'pioneer-10',
    destination: 'deep-space',
    machineName: 'Pioneer 10',
    missionName: 'Pioneer 10 · Deep Space',
    yearLabel: '1972–2003',
    summary:
      "Pioneer 10 launched in March 1972. It was the first spacecraft to fly through the main asteroid belt and past Jupiter, and it later headed out of the solar system. Its last signal reached Earth in January 2003.",
    pipBriefing:
      'Pioneer 10 went farther than any spacecraft before it. It carried our questions, our science and even a message to the stars. Let us inspect its hologram.',
    worldMode: 'hologram',
    components: [
      {
        id: 'pioneer-10-plaque',
        name: 'Pioneer plaque',
        shortName: 'Plaque',
        historicalRecord:
          "Pioneers 10 and 11 carried small metal plaques identifying their time and place of origin. Pioneer 10's plaque shows a man and a woman, the spacecraft, and a diagram locating the Sun relative to pulsars.",
        pipLine:
          'This plaque is a letter to anyone who might find Pioneer 10. It shows who we are and where we come from.',
        scanHint: 'A golden panel on the side of the spacecraft.',
        sources: PIONEER_10_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'pioneer-10-rtg',
        name: 'Radioisotope thermoelectric generators (RTGs)',
        shortName: 'RTGs',
        historicalRecord:
          'Pioneer 10 used two SNAP-19 radioisotope thermoelectric generators to make electricity from heat. It was the first spacecraft to use all-nuclear electrical power.',
        pipLine:
          'These generators turned heat into power. Far from the Sun, Pioneer 10 carried its own little warmth.',
        scanHint: 'A pair of generator units on a boom.',
        sources: PIONEER_10_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'pioneer-10-ipp',
        name: 'Imaging Photopolarimeter (IPP)',
        shortName: 'IPP',
        historicalRecord:
          "Pioneer 10's imaging photopolarimeter measured light from Jupiter and helped capture images of the planet and some of its moons during the 1973 flyby.",
        pipLine:
          'This instrument measured light from Jupiter. It helped us see the giant planet in a new way.',
        scanHint: 'A light-sensing instrument near the front of the spacecraft.',
        sources: PIONEER_10_SOURCES,
        validation: 'source-checked',
      },
    ],
    smartLetter: {
      identity:
        'Pioneer 10 was a NASA spacecraft built to explore the outer solar system and carry a message from Earth.',
      trajectory:
        'It launched on 2 March 1972, became the first spacecraft to pass through the main asteroid belt, and flew past Jupiter in December 1973.',
      discoveries:
        'Its instruments studied Jupiter, its radiation environment and interplanetary space. The Pioneer plaque carried a diagram of Earth\'s place in the galaxy for anyone who might find it.',
      missionEnd:
        'Pioneer 10 crossed the orbit of Neptune in 1983 and continued outward. Its last signal reached Earth in January 2003.',
    },
    reconstruction: {
      title: 'Pioneer 10 · First-person reconstruction',
      status: 'script-draft',
      lines: [
        'I leave Earth carrying a small golden plaque and a great many questions.',
        'I cross a belt of drifting rocks and keep going, farther than any spacecraft before me.',
        'Jupiter grows until it fills my view. My instruments measure its storms and its magnetism.',
        'I pass the giant planet and continue into the dark, still sending my signal home.',
        'One day the signal stops. The plaque keeps traveling.',
      ],
    },
    stampId: 'stamp-pioneer-10',
    stampLabel: 'Pioneer 10 · Deep Space',
    completionStory:
      "Pioneer 10's record is complete. Its plaque carries a message to the stars, and its instruments carried our curiosity past Jupiter.",
    sources: PIONEER_10_SOURCES,
    contentStatus: 'pending-review',
    reviewNote:
      'Facts and sources are checked. The final three-component selection (plaque, RTGs and imaging photopolarimeter) still needs educational approval; the plaque must remain part of the mission.',
  },
]

export function isDestinationId(value: unknown): value is DestinationId {
  return (
    typeof value === 'string' &&
    (DESTINATION_IDS as readonly string[]).includes(value)
  )
}

export function isMissionId(value: unknown): value is MissionId {
  return (
    typeof value === 'string' &&
    (MISSION_IDS as readonly string[]).includes(value)
  )
}

export function findMission(id: string): MissionDefinition | null {
  return MISSIONS.find((mission) => mission.id === id) ?? null
}

export function getMission(id: MissionId): MissionDefinition {
  const mission = findMission(id)
  if (!mission) throw new Error(`Unknown mission: ${id}`)
  return mission
}

export function getMissionForDestination(
  destination: DestinationId,
): MissionDefinition {
  const mission = MISSIONS.find((entry) => entry.destination === destination)
  if (!mission) throw new Error(`No mission for destination: ${destination}`)
  return mission
}

export function findComponent(
  missionId: MissionId,
  componentId: string,
): MissionComponent | null {
  const mission = findMission(missionId)
  if (!mission) return null
  return mission.components.find((component) => component.id === componentId) ?? null
}
