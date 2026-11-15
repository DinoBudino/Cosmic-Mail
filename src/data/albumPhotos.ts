import type { MissionId } from './missions'

/**
 * Photo lab of the Cosmic Album. Each picture is a still from the
 * explorer's own story video (public/video), cropped without subtitles,
 * and keeps the credit the video shows for it. Texts only repeat facts
 * those videos and the mission sources already state.
 *
 * Photo 1 opens when the explorer is found; each scanned part opens one
 * more, so the lab fills up while the child plays.
 */
export interface AlbumPhoto {
  src: string
  title: string
  credit: string
  description: string
}

export const ALBUM_PHOTOS: Partial<Record<MissionId, readonly AlbumPhoto[]>> = {
  opportunity: [
    {
      src: 'album/opportunity-1.webp',
      title: "Opportunity's selfie",
      credit: '2014 · NASA/JPL-Caltech',
      description:
        'Opportunity photographed its own solar panels. That year the wind blew much of the dust off them.',
    },
    {
      src: 'album/opportunity-2.webp',
      title: 'Its very first view',
      credit: '2004 · NASA/JPL-Caltech',
      description:
        'The first look at Mars after landing: the deflated airbags that cushioned it, inside a tiny crater.',
    },
    {
      src: 'album/opportunity-3.webp',
      title: 'A rock in Eagle Crater',
      credit: '2004 · NASA/JPL-Caltech',
      description:
        'Tiny round grains, nicknamed blueberries, made of hematite: a mineral that usually forms in water.',
    },
    {
      src: 'album/opportunity-4.webp',
      title: "The 'Homestake' vein",
      credit: '2011 · NASA/JPL-Caltech',
      description:
        'A bright line of gypsum about as wide as a thumb. Water flowing through cracks left it behind.',
    },
  ],
  spirit: [
    {
      src: 'album/spirit-1.webp',
      title: "Spirit's own shadow",
      credit: '2004 · NASA/JPL-Caltech',
      description: 'Spirit photographed its own shadow on the rocky ground of Gusev Crater.',
    },
    {
      src: 'album/spirit-2.webp',
      title: 'Gusev Crater',
      credit: 'NASA/JPL-Caltech',
      description:
        'Spirit landed here in January 2004. Scientists thought this crater may once have held a lake.',
    },
    {
      src: 'album/spirit-3.webp',
      title: 'Bright white soil',
      credit: '2007 · NASA/JPL-Caltech',
      description:
        "Spirit's stuck wheel scraped open this soil. It is rich in silica, a clue that hot water was here long ago.",
    },
    {
      src: 'album/spirit-4.webp',
      title: 'Stuck at Troy',
      credit: '2009 · NASA/JPL-Caltech',
      description: "Spirit's view at Troy, the place where its wheels got stuck in soft sand.",
    },
  ],
  'surveyor-3': [
    {
      src: 'album/surveyor-3-1.webp',
      title: 'Surveyor 3 in its crater',
      credit: '1969 · NASA',
      description:
        'Apollo 12 astronauts took this photo. Surveyor 3 is about 3 meters tall and stands on three legs.',
    },
    {
      src: 'album/surveyor-3-2.webp',
      title: 'The landing site from orbit',
      credit: 'NASA/GSFC/Arizona State University',
      description:
        'The circle marks where Surveyor 3 landed in April 1967, in the Ocean of Storms.',
    },
    {
      src: 'album/surveyor-3-3.webp',
      title: 'Neighbors on the Moon',
      credit: 'NASA/GSFC/Arizona State University',
      description:
        "Seen from orbit: Surveyor 3, Apollo 12's descent stage and the astronauts' footpaths in between.",
    },
    {
      src: 'album/surveyor-3-4.webp',
      title: 'A visit from Apollo 12',
      credit: 'November 1969 · NASA',
      description:
        'Astronaut Pete Conrad at Surveyor 3, with the lunar module behind. Alan Bean took the photo, and the crew carried its camera back to Earth.',
    },
  ],
  'apollo-11': [
    {
      src: 'album/apollo-11-1.webp',
      title: 'Eagle on the Moon',
      credit: 'July 1969 · NASA',
      description:
        'Eagle at Tranquility Base during the first moonwalk, with Buzz Aldrin standing beside it.',
    },
    {
      src: 'album/apollo-11-2.webp',
      title: 'Down the ladder',
      credit: 'July 1969 · NASA',
      description:
        "Buzz Aldrin climbs down Eagle's ladder. It runs down the front leg, the same leg that carries the plaque.",
    },
    {
      src: 'album/apollo-11-3.webp',
      title: 'A message of peace',
      credit: 'July 1969 · NASA',
      description:
        "The plaque on Eagle's ladder leg ends with: 'We came in peace for all mankind.'",
    },
    {
      src: 'album/apollo-11-4.webp',
      title: 'Tranquility Base from orbit',
      credit: '2009 · NASA/GSFC/Arizona State University',
      description:
        "Forty years later, a spacecraft in orbit photographed the landing site, where Eagle's bottom half still stands.",
    },
  ],
  'viking-1': [
    {
      src: 'album/viking-1-1.webp',
      title: 'The first photo from Mars',
      credit: 'July 1976 · NASA/JPL',
      description:
        'Minutes after landing, Viking 1 took the first photograph ever made on the surface of Mars, showing one of its own footpads.',
    },
    {
      src: 'album/viking-1-2.webp',
      title: 'Its first color picture',
      credit: '1976 · NASA/JPL',
      description:
        "Viking 1's first color view of Chryse Planitia, a rocky plain covered in reddish dust.",
    },
    {
      src: 'album/viking-1-3.webp',
      title: 'Sunset at Chryse Planitia',
      credit: 'NASA/JPL',
      description:
        'About 15 minutes before sunset, the low Sun lights up the rocks around Viking 1 and its landing leg.',
    },
    {
      src: 'album/viking-1-4.webp',
      title: 'Spotted from orbit',
      credit: '2006 · NASA/JPL-Caltech/UArizona',
      description:
        'Thirty years after landing, a camera in orbit found Viking 1 still resting on the plain.',
    },
  ],
}

export function getAlbumPhotos(missionId: MissionId): readonly AlbumPhoto[] {
  return ALBUM_PHOTOS[missionId] ?? []
}

/**
 * How many of an explorer's photos are open: none until it is found,
 * then one plus one per scanned part (all of them once delivered).
 */
export function unlockedPhotoCount(
  total: number,
  story: { machineName: string | null; scanned: number; stampEarned: boolean },
): number {
  if (!story.machineName) return 0
  if (story.stampEarned) return total
  return Math.min(total, 1 + story.scanned)
}
