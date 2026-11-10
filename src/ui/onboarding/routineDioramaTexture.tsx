import { renderToStaticMarkup } from 'react-dom/server'
import {
  FirstWonderDiorama,
  NewFriendDiorama,
  SmallMysteryDiorama,
  YourDreamDiorama,
  type RoutineVisualState,
} from './RoutineCheckVisuals'

/**
 * 3D projection helpers for the Routine Check dioramas.
 *
 * The approved dioramas are rasterized from the SAME React SVG and
 * mapped onto a circular mesh inside the Cosmic Memory Window, so PIP
 * (a 3D object) always passes in front of the hologram and the circle
 * geometry clips anything that would escape the window frame.
 */

const DIORAMA_COMPONENTS: Record<string, React.ComponentType<RoutineVisualState>> = {
  wonder: FirstWonderDiorama,
  mystery: SmallMysteryDiorama,
  friend: NewFriendDiorama,
  dream: YourDreamDiorama,
}

/** Screen-reader description of each projected scene (the visual
 *  itself is rendered inside the 3D window, out of the DOM). */
export const ROUTINE_LABELS: Record<string, string> = {
  wonder: 'A mysterious night sky with a glowing star, a backpack and a dark path.',
  mystery: 'A small mysterious door on rocky Mars ground, with footprints and numbered steps.',
  friend: 'A small lost robot on a round patch of ground, with a signal and a map.',
  dream: 'A small ship carrying a glowing letter along an orbit among stars.',
}

/**
 * Self-contained focus-reaction CSS. It must live INSIDE the SVG:
 * when the SVG is rasterized as an image, the app stylesheet does not
 * apply, so the effect rules are embedded here.
 */
const DIORAMA_EMBEDDED_STYLE = `
.diorama-path,.diorama-route,.diorama-star,.diorama-backpack,.diorama-meaning,
.diorama-clues,.diorama-steps,.diorama-perimeter,.diorama-door,.diorama-map,
.diorama-signal,.diorama-robot,.diorama-secret,.diorama-ship,.diorama-letter{
  transition: opacity 300ms ease, filter 300ms ease, transform 450ms ease;
}
.diorama-path{opacity:.55}.diorama-path.is-lit{opacity:1;filter:drop-shadow(0 0 8px #8FE3D8)}
.diorama-route{opacity:.3}.diorama-route.is-lit{opacity:1;filter:drop-shadow(0 0 6px #F4B4DF)}
.diorama-star{opacity:.85}.diorama-star.is-lit{filter:drop-shadow(0 0 14px #FFD9A8)}
.diorama-backpack{opacity:.8}.diorama-backpack.is-lit{opacity:1;filter:drop-shadow(0 0 10px #FFD9A8)}
.diorama-meaning{opacity:.35}.diorama-meaning.is-lit{opacity:1;filter:drop-shadow(0 0 8px #B8A6D9)}
.diorama-clues{opacity:.35}.diorama-clues.is-lit{opacity:1;filter:drop-shadow(0 0 8px #FFD9A8)}
.diorama-steps{opacity:.3}.diorama-steps.is-lit{opacity:1}
.diorama-perimeter{opacity:.25}.diorama-perimeter.is-lit{opacity:1;filter:drop-shadow(0 0 8px #8FE3D8)}
.diorama-door{transform-origin:182px 117px}
.diorama-door-panel{transition:transform 450ms ease;transform-origin:186px 117px}
.diorama-door.is-open .diorama-door-panel{transform:perspective(300px) rotateY(-38deg)}
.diorama-door.is-dim{opacity:.55}
.diorama-map{opacity:.3}.diorama-map.is-lit{opacity:1}
.diorama-signal{opacity:.3}.diorama-signal.is-lit{opacity:1;filter:drop-shadow(0 0 8px #FFD9A8)}
.diorama-robot{transform-origin:160px 130px}
.diorama-robot.is-turned{transform:rotateY(14deg)}
.diorama-secret{opacity:.35}.diorama-secret.is-lit{opacity:1;filter:drop-shadow(0 0 10px #F4B4DF)}
.diorama-ship{transition:transform 500ms ease}
.diorama-ship.is-advanced{transform:translate(14px,-8px)}
.diorama-letter{opacity:.8}.diorama-letter.is-lit{opacity:1;filter:drop-shadow(0 0 12px #FFD9A8)}
`

/** Full standalone SVG markup for the given question + focus. */
export function routineDioramaSvg(questionId: string, focusId: string | null): string | null {
  const Diorama = DIORAMA_COMPONENTS[questionId]
  if (!Diorama) return null
  const markup = renderToStaticMarkup(
    <Diorama questionId={questionId} focusedOptionId={focusId} confirmedOptionId={null} />,
  )
  // A standalone SVG loaded as an <img> needs the XML namespace and
  // intrinsic dimensions, otherwise the browser refuses to decode it
  // (the texture would stay blank). Then inject the embedded style.
  return markup.replace(
    /^<svg /,
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" preserveAspectRatio="xMidYMid meet" ',
  ).replace(/>/, `><style>${DIORAMA_EMBEDDED_STYLE}</style>`)
}
