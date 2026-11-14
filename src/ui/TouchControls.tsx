import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { SPIRIT_SITE } from '../data/spiritSite'
import { isFlightUnlocked } from '../game/flight'
import { setTouchBoot, setTouchMove, setTouchRun } from '../game/input'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'

export function TouchControls() {
  const settingsOpen = useGameStore((state) => state.settingsOpen)
  const activeSiteId = useGameStore((state) => state.activeSiteId)
  const scannerOpen = useGameStore((state) => state.scannerOpen)
  const scannerCard = useGameStore(
    (state) => state.scannerCardComponentId,
  )
  const scannerRecordsOpen = useGameStore(
    (state) => state.scannerRecordsOpen,
  )
  const archiveOpen = useGameStore((state) => state.archiveView !== 'none')
  const scannerEquipped = useGameStore((state) => state.scannerEquipped)
  const scannerLocked = useGameStore((state) => state.scannerLocked)
  const equipScanner = useGameStore((state) => state.equipScanner)
  const progress = useJourneyStore(
    (state) => state.save?.missions[SPIRIT_SITE.missionId] ?? null,
  )
  const flightLocked = progress != null && !isFlightUnlocked(progress)
  // Equipping the scanner never hides or freezes the touch joystick; only
  // modal panels that need reading block movement.
  const paused =
    settingsOpen ||
    activeSiteId !== null ||
    scannerOpen ||
    scannerCard !== null ||
    scannerRecordsOpen ||
    archiveOpen
  const padRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const activePointer = useRef<number | null>(null)

  const reset = () => {
    activePointer.current = null
    setTouchMove(0, 0)
    setTouchRun(false)
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)'
    }
  }

  useEffect(() => {
    if (paused) reset()
  }, [paused])

  useEffect(() => {
    return () => {
      setTouchMove(0, 0)
      setTouchBoot(false)
      setTouchRun(false)
    }
  }, [])

  const update = (clientX: number, clientY: number) => {
    const pad = padRef.current
    if (!pad) return

    const rect = pad.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const limit = Math.max(1, rect.width / 2 - 20)
    let dx = clientX - centerX
    let dy = clientY - centerY
    const distance = Math.hypot(dx, dy)

    if (distance > limit) {
      dx = (dx / distance) * limit
      dy = (dy / distance) * limit
    }

    setTouchMove(dx / limit, -dy / limit)
    // Full tilt runs.
    setTouchRun(Math.min(distance, limit) / limit > 0.92)
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (paused || activePointer.current !== null) return
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointer.current = event.pointerId
    update(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (paused) return
    if (activePointer.current !== event.pointerId) return
    update(event.clientX, event.clientY)
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return
    reset()
  }

  return (
    <div className="touch-controls">
      <div
        ref={padRef}
        className="touch-pad"
        role="group"
        aria-label="Touch movement pad"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div ref={knobRef} className="touch-knob" />
      </div>
      <p className="touch-hint">Drag to move · push far to run</p>
      {!scannerEquipped && !scannerLocked && (
        <button
          type="button"
          className="touch-scanner"
          aria-label="Equip the Cosmic Scanner"
          onClick={() => equipScanner(SPIRIT_SITE.missionId)}
        >
          Scanner
        </button>
      )}
      {!flightLocked && (
      <button
        type="button"
        className="touch-boost"
        aria-label={
          flightLocked
            ? 'Jet boots locked during the ground survey'
            : 'Hold to use jet boots'
        }
        disabled={flightLocked}
        onPointerDown={(event) => {
          if (paused || flightLocked) return
          event.currentTarget.setPointerCapture(event.pointerId)
          setTouchBoot(true)
        }}
        onPointerUp={() => setTouchBoot(false)}
        onPointerCancel={() => setTouchBoot(false)}
        onLostPointerCapture={() => setTouchBoot(false)}
        onContextMenu={(event) => event.preventDefault()}
      >
        Boost
      </button>
      )}
    </div>
  )
}
