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

export const MISSION_IDS = [
  'surveyor-3',
  'spirit',
  'pioneer-10',
  'opportunity',
] as const
export type MissionId = (typeof MISSION_IDS)[number]

/**
 * Missions that are part of the game: the Moon and Mars. Mars tells
 * Opportunity's story (Meridiani Planum). Spirit (the Mars pilot before
 * Nov 2026) and Deep Space (Pioneer 10) are out of scope; their ids stay in
 * MISSION_IDS only so older saves keep loading unchanged. Totals, stamps
 * and the finale count only these.
 */
export const ACTIVE_MISSION_IDS: readonly MissionId[] = [
  'surveyor-3',
  'opportunity',
  'spirit',
]

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
  /**
   * How the real instrument observed, in a few child-friendly words
   * (e.g. "It looks"). Shown on the scan result card; the scan itself is
   * the same single hold for every part.
   */
  howItWorks?: { verb: 'Looks' | 'Touches' | 'Senses heat'; detail: string }
  /**
   * The parts hunt: PIP's spoken clue when this part is the one to find,
   * and a short version for the objective bar. Only used after discovery.
   */
  huntClue?: {
    line: string
    short: string
    /** Name on the hunt tracker once found. */
    label: string
    icon: 'eye' | 'tool' | 'heat'
  }
  /** Optional position on the scanner map; falls back to a list. */
  hotspot?: HotspotPosition
  sources: readonly MissionSource[]
  validation: ContentStatus
}

/**
 * A real part of the explorer that is not one of the mission's educational
 * components. Scanning it gives a short PIP note and never adds progress.
 * Every distractor must be backed by linked NASA sources
 * (`validation: 'source-checked'`) or it must not exist.
 */
export interface MissionDistractor {
  /** Globally unique across all missions (mission-prefixed). */
  id: string
  name: string
  shortName: string
  /** Historical claim backed by `sources`. */
  historicalRecord: string
  /** PIP's brief note. Only shown after the explorer is identified. */
  pipNote: string
  sources: readonly MissionSource[]
  validation: ContentStatus
}

/** PIP's reusable mission narrative. Content only, no rendering. */
export interface MissionNarrative {
  /** Once per Mars visit, when the player lands and the scanner wakes up. */
  entered: string
  /** First time the machine enters detection range (identity still hidden). */
  detected: string
  /**
   * First time the player reaches the inspection ring (identity still
   * hidden). It also says the one thing to do next: press E (desktop).
   */
  approached: string
  /** Same beat on touch screens ("tap Inspect"). */
  approachedTouch: string
  /** First valid identification event: PIP reconnects the historical record. */
  identified: string
  /** Right after identification: take out the scanner (desktop). */
  scannerPromptDesktop: string
  /** Right after identification: take out the scanner (touch). */
  scannerPromptTouch: string
  /** Celebration right after the third (last) part: the memory returns. */
  completed: string
  /** The archive tablet opens with the recovered memory: seal the letter. */
  memoryRecovered: string
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
  /**
   * Kid-sized chips for the archive tablet timeline (a few words each).
   * The long texts above open when the child taps a chip.
   */
  timeline?: {
    launch: string
    landing: string
    discovery: string
    end: string
  }
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
  status: 'script-draft' | 'video'
  /**
   * Narrated story video (public/video), with its own subtitles and NASA
   * credits. When present it replaces the scripted lines in the viewer.
   */
  video?: string
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
  /** Scannable parts that look relevant but add no progress. */
  distractors?: readonly MissionDistractor[]
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
  {
    label: 'NASA JPL — Mars Rover Spirit Unearths Surprise Evidence of Wetter Past (2007)',
    url: 'https://www.jpl.nasa.gov/news/mars-rover-spirit-unearths-surprise-evidence-of-wetter-past/',
  },
  {
    label: 'NASA JPL — NASA Concludes Attempts to Contact Mars Rover Spirit (2011)',
    url: 'https://www.jpl.nasa.gov/news/nasa-concludes-attempts-to-contact-mars-rover-spirit/',
  },
]

/** Official NASA / NASA-JPL sources for Opportunity (checked 2026-11-14). */
export const OPPORTUNITY_SOURCES: readonly MissionSource[] = [
  {
    label: 'NASA Science — Opportunity',
    url: 'https://science.nasa.gov/mission/mer-opportunity/',
  },
  {
    label: 'NASA/JPL — Opportunity Rover Finds Strong Evidence Meridiani Planum Was Wet (2004)',
    url: 'https://www.jpl.nasa.gov/news/opportunity-rover-finds-strong-evidence-meridiani-planum-was-wet/',
  },
  {
    label: 'NASA/JPL — NASA Mars Rover Finds Mineral Vein Deposited by Water (2011)',
    url: 'https://www.jpl.nasa.gov/news/nasa-mars-rover-finds-mineral-vein-deposited-by-water/',
  },
  {
    label: 'NASA/JPL — NASA Rover Opportunity\'s Selfie Shows Clean Machine (2014)',
    url: 'https://www.jpl.nasa.gov/news/nasa-rover-opportunitys-selfie-shows-clean-machine/',
  },
  {
    label: 'NASA/JPL — Last Images Opportunity Took (PIA22930)',
    url: 'https://www.jpl.nasa.gov/images/pia22930-last-images-opportunity-took/',
  },
  {
    label: 'NASA/JPL — NASA\'s Opportunity Rover Mission on Mars Comes to End (2019)',
    url: 'https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/',
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
    id: 'opportunity',
    destination: 'mars',
    machineName: 'Opportunity',
    missionName: 'Opportunity · Mars',
    yearLabel: '2004–2019',
    summary:
      "Opportunity was the second of NASA's twin Mars Exploration Rovers. It landed in Meridiani Planum in January 2004 and searched the rocks for clues about the history of water on Mars.",
    pipBriefing:
      'Opportunity was planned for about 90 Martian days, and it explored for almost 15 years. Its cameras and tools read the story of water written in the rocks. Let us look closer.',
    worldMode: 'surface',
    components: [
      {
        id: 'opportunity-pancam',
        name: 'Panoramic camera (Pancam)',
        shortName: 'Pancam',
        historicalRecord:
          "The panoramic camera (Pancam) sat on Opportunity's mast and took color images and 360-degree panoramas. Its last images, taken on 10 June 2018, show a faint Sun in a very dark, dusty sky.",
        pipLine: pipLine('mars-pancam'),
        pipHint: pipLine('mars-hint-pancam'),
        pipDirectHint: pipLine('mars-direct-pancam'),
        howItWorks: { verb: 'Looks', detail: 'A camera that took color pictures and big panoramas.' },
        huntClue: { line: pipLine('mars-clue-pancam'), short: "Find the rover's eyes · top of the mast", label: 'Eyes', icon: 'eye' },
        scanHint: 'The pair of cameras at the top of the mast.',
        hotspot: { x: 62, y: 24 },
        sources: OPPORTUNITY_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'opportunity-rock-abrasion-tool',
        name: 'Rock Abrasion Tool (RAT)',
        shortName: 'RAT',
        historicalRecord:
          "The Rock Abrasion Tool (RAT) ground away the dusty outer layer of rocks so Opportunity's instruments could study the fresh rock inside. Over its mission, Opportunity ground into 52 rocks.",
        pipLine: pipLine('mars-rat'),
        pipHint: pipLine('mars-hint-rat'),
        pipDirectHint: pipLine('mars-direct-rat'),
        howItWorks: { verb: 'Touches', detail: 'A grinder that brushed the dusty skin off rocks.' },
        huntClue: { line: pipLine('mars-clue-rat'), short: "Find the rock tool · front arm, down low", label: 'Rock tool', icon: 'tool' },
        scanHint: 'A small tool on the robotic arm.',
        hotspot: { x: 34, y: 64 },
        sources: OPPORTUNITY_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'opportunity-mini-tes',
        name: 'Miniature Thermal Emission Spectrometer (Mini-TES)',
        shortName: 'Mini-TES',
        historicalRecord:
          "Mini-TES measured infrared light from rocks and soil to help identify their minerals. In 2004 it helped detect sulfate minerals at Meridiani Planum, part of the evidence that the area was once soaked in water.",
        pipLine: pipLine('mars-mini-tes'),
        pipHint: pipLine('mars-hint-mini-tes'),
        pipDirectHint: pipLine('mars-direct-mini-tes'),
        howItWorks: { verb: 'Senses heat', detail: 'It read invisible infrared light to tell minerals apart.' },
        huntClue: { line: pipLine('mars-clue-mini-tes'), short: "Find the heat reader · the tall mast", label: 'Heat reader', icon: 'heat' },
        scanHint: 'It looked out through the tall mast, below the cameras.',
        hotspot: { x: 72, y: 46 },
        sources: OPPORTUNITY_SOURCES,
        validation: 'source-checked',
      },
    ],
    distractors: [
      {
        id: 'opportunity-solar-panels',
        name: 'Solar panels',
        shortName: 'Solar panels',
        historicalRecord:
          'Opportunity was powered by solar panels. In early 2014 the wind blew much of the dust off them, and its daily energy rose from under 375 to over 620 watt-hours.',
        pipNote:
          "Solar panels! The wind even cleaned them once. Nice find, but they won't unlock a memory fragment.",
        sources: OPPORTUNITY_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'opportunity-wheels',
        name: 'Wheels',
        shortName: 'Wheels',
        historicalRecord:
          'Opportunity rolled on six wheels and drove 45.16 kilometres on Mars, farther than a marathon.',
        pipNote:
          "Six wheels carried Opportunity farther than a marathon. They're important, but this is not a memory fragment.",
        sources: OPPORTUNITY_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'opportunity-antenna',
        name: 'Antenna',
        shortName: 'Antenna',
        historicalRecord:
          'Opportunity used its antennas to send images and data home to Earth.',
        pipNote:
          'Antennas helped Opportunity send its pictures home. Good to know, but not a fragment.',
        sources: OPPORTUNITY_SOURCES,
        validation: 'source-checked',
      },
    ],
    smartLetter: {
      identity:
        "Opportunity was the second of NASA's twin Mars Exploration Rovers. Its job was to look in the rocks for clues about the history of water on Mars.",
      trajectory:
        'Opportunity launched on 7 July 2003 and landed in Eagle crater, Meridiani Planum, on 25 January 2004 (UTC). It was planned for 90 Martian days, but it explored for almost 15 years and drove 45.16 kilometres.',
      discoveries:
        "Opportunity found tiny hematite spheres nicknamed 'blueberries', layered rocks laid down by water and a gypsum vein left by water moving through cracks. It also found the first meteorite identified on another planet.",
      missionEnd:
        'In June 2018 a dust storm covering all of Mars blocked the sunlight Opportunity needed. Its last communication was on 10 June 2018. After eight months of attempts, NASA declared the mission complete on 13 February 2019. Opportunity rests in Perseverance Valley.',
      timeline: {
        launch: '7 July 2003',
        landing: 'Meridiani Planum · Jan 2004',
        discovery: "Water 'blueberries'",
        end: 'Dust storm · 2018',
      },
    },
    reconstruction: {
      title: 'Opportunity · First-person reconstruction',
      status: 'video',
      video: 'video/opportunity-720p.webm',
      lines: [
        'I bounce across the plain inside my airbags and roll to a stop in a tiny crater.',
        'The rocks around me are full of small round grains. They tell me water was once here.',
        'I drive on and on, much farther than anyone planned, farther than a marathon.',
        'At a giant crater I find a bright vein left by water moving through cracks in the ground.',
        'One day the dust hides the Sun. My team keeps calling, and my discoveries stay with them.',
      ],
    },
    stampId: 'stamp-opportunity',
    stampLabel: 'Opportunity · Mars',
    completionStory: pipLine('mars-completion-story'),
    narrative: {
      entered: pipLine('mars-arrival'),
      detected: pipLine('mars-detected'),
      approached: pipLine('mars-approached'),
      approachedTouch: pipLine('mars-approached-touch'),
      identified: pipLine('mars-identified'),
      scannerPromptDesktop: pipLine('mars-scanner-prompt-desktop'),
      scannerPromptTouch: pipLine('mars-scanner-prompt-touch'),
      completed: pipLine('mars-completed-1'),
      memoryRecovered: pipLine('mars-memory-recovered'),
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
    sources: OPPORTUNITY_SOURCES,
    contentStatus: 'source-checked',
    reviewNote: null,
  },
  // Spirit: Opportunity's twin, the second Mars explorer (Gusev Crater).
  // Older saves with Spirit progress keep loading unchanged.
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
        pipLine: pipLine('spirit-pancam'),
        pipHint: pipLine('mars-hint-pancam'),
        pipDirectHint: pipLine('mars-direct-pancam'),
        howItWorks: { verb: 'Looks', detail: 'A camera that took color pictures and big panoramas.' },
        huntClue: { line: pipLine('mars-clue-pancam'), short: "Find the rover's eyes · top of the mast", label: 'Eyes', icon: 'eye' },
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
        howItWorks: { verb: 'Touches', detail: 'A grinder that brushed the dusty skin off rocks.' },
        huntClue: { line: pipLine('mars-clue-rat'), short: "Find the rock tool · front arm, down low", label: 'Rock tool', icon: 'tool' },
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
        howItWorks: { verb: 'Senses heat', detail: 'It read invisible infrared light to tell minerals apart.' },
        huntClue: { line: pipLine('mars-clue-mini-tes'), short: "Find the heat reader · the tall mast", label: 'Heat reader', icon: 'heat' },
        scanHint: 'It looked out through the tall mast, below the cameras.',
        hotspot: { x: 72, y: 46 },
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
    ],
    distractors: [
      {
        id: 'spirit-solar-panels',
        name: 'Solar panels',
        shortName: 'Solar panels',
        historicalRecord:
          'Spirit was powered by solar panels. After landing, the rover deployed its petal solar panels.',
        pipNote:
          "Solar panels! They gave Spirit its power. Nice find, but they won't unlock a memory fragment.",
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'spirit-wheels',
        name: 'Wheels',
        shortName: 'Wheels',
        historicalRecord:
          'Spirit rolled on six wheels. Its right rear wheel eventually stopped working.',
        pipNote:
          "Six wheels carried Spirit across Mars. They're important, but this is not a memory fragment.",
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
      {
        id: 'spirit-antenna',
        name: 'Antenna',
        shortName: 'Antenna',
        historicalRecord:
          'Spirit transmitted data to Earth via orbiters such as Mars Global Surveyor and 2001 Mars Odyssey.',
        pipNote:
          'Antennas helped Spirit send its data home through orbiters. Good to know, but not a fragment.',
        sources: SPIRIT_SOURCES,
        validation: 'source-checked',
      },
    ],
    smartLetter: {
      identity:
        'Spirit was one of NASA\'s twin Mars Exploration Rovers. Its purpose was to study Martian rocks and soil for clues about the planet\'s past environment and water.',
      trajectory:
        'Spirit launched on 10 June 2003 and landed inside Gusev Crater on 4 January 2004 (UTC). It was planned for about 90 Martian days, but it explored for more than six years and drove 7.73 kilometres.',
      discoveries:
        'Spirit dug up a patch of nearly pure silica with a stuck wheel. It was likely made by hot springs or steam vents, strong evidence that ancient Mars was much wetter.',
      missionEnd:
        'On 1 May 2009 Spirit got stuck in soft soil beside a low plateau called Home Plate. Its last communication was on 22 March 2010, and NASA declared the mission complete on 25 May 2011.',
      timeline: {
        launch: '10 June 2003',
        landing: 'Gusev Crater · Jan 2004',
        discovery: 'Silica from hot springs',
        end: 'Silent since 2010',
      },
    },
    reconstruction: {
      title: 'Spirit · First-person reconstruction',
      status: 'video',
      video: 'video/spirit-720p.webm',
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
    completionStory: pipLine('spirit-completion-story'),
    narrative: {
      entered: pipLine('mars-arrival'),
      detected: pipLine('mars-detected'),
      approached: pipLine('mars-approached'),
      approachedTouch: pipLine('mars-approached-touch'),
      identified: pipLine('spirit-identified'),
      scannerPromptDesktop: pipLine('mars-scanner-prompt-desktop'),
      scannerPromptTouch: pipLine('mars-scanner-prompt-touch'),
      completed: pipLine('mars-completed-1'),
      memoryRecovered: pipLine('mars-memory-recovered'),
      letterPrepared: pipLine('spirit-letter-prepared'),
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
