import { useProgress } from '@react-three/drei'
import { useEffect, useLayoutEffect, useState } from 'react'
import { getActiveWorld } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'

/** How long nothing may be loading before the world counts as ready. */
const SETTLE_MS = 450
const CHECK_MS = 150
/** Never hold the veil longer than this, even if a model is slow. */
const MAX_MS = 8000
/** Same as the CSS fade-out. */
const FADE_MS = 700

/**
 * The orbit dive ends on a full-screen glow (orange air on Mars, dark on
 * the Moon). The world then takes a moment to load its ground, rocks and
 * models; without this veil the child would see a bare sky with no
 * ground, or the "Preparing…" card, before the landscape pops in. The
 * veil starts in the dive's final colour and fades away once the scene
 * has stopped loading, so the landing reads as one continuous move.
 * Lifting it starts the landing-site title (SiteTitle).
 */
export function ArrivalVeil() {
  const [stage, setStage] = useState<'hold' | 'fade' | 'gone'>('hold')

  // Each landing starts with the world loading; the next one starts over.
  useLayoutEffect(() => {
    useGameStore.getState().setArrivalStage('loading')
    return () => useGameStore.getState().setArrivalStage('loading')
  }, [])
  // As the veil lifts, the landing-site title takes the screen.
  useEffect(() => {
    if (stage === 'fade') useGameStore.getState().setArrivalStage('title')
  }, [stage])

  useEffect(() => {
    if (stage !== 'hold') return
    const started = performance.now()
    let quietSince: number | null = null
    const timer = window.setInterval(() => {
      const now = performance.now()
      const canvas = document.querySelector('.world-layer canvas')
      const loading = useProgress.getState().active
      if (!canvas || loading) quietSince = null
      else quietSince ??= now
      const settled = quietSince !== null && now - quietSince >= SETTLE_MS
      if (settled || now - started >= MAX_MS) setStage('fade')
    }, CHECK_MS)
    return () => window.clearInterval(timer)
  }, [stage])

  useEffect(() => {
    if (stage !== 'fade') return
    const timer = window.setTimeout(() => setStage('gone'), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [stage])

  if (stage === 'gone') return null
  return (
    <div
      className="arrival-veil"
      data-world={getActiveWorld()}
      data-stage={stage}
      aria-hidden="true"
    />
  )
}
