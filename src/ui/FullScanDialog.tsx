import { useEffect, useRef, useState } from 'react'
import {
  MEMORY_FRAGMENT_KINDS,
  MEMORY_FRAGMENTS,
  REBUILD_STEP_LINE,
  getFragmentText,
  getRebuildProgress,
  getReconstructionStep,
  getSweepProgress,
  getTrayFragments,
  isRebuildUnlocked,
  isReconstructionComplete,
  placeFragment,
  revealFragment,
  selectFragment,
  type MemoryFragmentKind,
} from '../data/fullScanReconstruction'
import { findMission } from '../data/missions'
import {
  getFullScanCompleteCues,
  getFullScanStartedCue,
} from '../data/missionNarrative'
import { audioManager } from '../game/audio/audioManager'
import { emitAudio } from '../game/audio/audioEvents'
import { speakPip, stopPipVoice } from '../game/pipVoice'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { useNarrativeStore } from '../store/narrativeStore'
import { getMissionStage, scannedComponentCount } from './missionStage'
import { PipAvatar } from './PipSpeech'
import { useHoldAction } from './useHoldAction'

/** Hold time to reveal one memory trace with the scanner. */
const TRACE_REVEAL_SECONDS = 0.8

/**
 * One memory trace on the explorer. Pointer or keyboard hold reveals it;
 * with reduced motion a single activation reveals it (no animation, but the
 * player still has to find and reveal every trace: nothing is skipped).
 */
function MemoryTrace({
  kind,
  index,
  revealed,
  reducedMotion,
  disabled,
  onReveal,
}: {
  kind: MemoryFragmentKind
  index: number
  revealed: boolean
  reducedMotion: boolean
  disabled: boolean
  onReveal: (kind: MemoryFragmentKind) => void
}) {
  const { progress, handlers } = useHoldAction({
    seconds: TRACE_REVEAL_SECONDS,
    reducedMotion,
    disabled: revealed || disabled,
    onComplete: () => onReveal(kind),
  })

  return (
    <button
      type="button"
      className={`recon-trace${revealed ? ' is-revealed' : ''}`}
      style={{ ['--trace-progress' as string]: progress }}
      disabled={disabled && !revealed}
      aria-disabled={revealed || undefined}
      aria-label={
        revealed
          ? `Memory trace ${index + 1} of 4: ${MEMORY_FRAGMENTS[kind].label}, revealed`
          : reducedMotion
            ? `Memory trace ${index + 1} of 4: activate to reveal`
            : `Memory trace ${index + 1} of 4: hold to reveal`
      }
      {...handlers}
    >
      <span className="recon-trace__mark" aria-hidden="true">
        {revealed ? '✓' : '?'}
      </span>
      <span className="recon-trace__label">
        {revealed ? MEMORY_FRAGMENTS[kind].label : `Trace ${index + 1}`}
      </span>
    </button>
  )
}

/**
 * Interactive full-object recognition scan. The player must have recognized
 * all three component fragments first. They then sweep the explorer to
 * reveal four memory traces and place them in order on the memory core's
 * timeline. It never repairs or reactivates the machine, and the memory is
 * recovered in one persisted event only when the timeline is complete.
 */
export function FullScanOverlay() {
  const view = useGameStore((state) => state.archiveView)
  const missionId = useGameStore((state) => state.archiveMissionId)
  const closeArchive = useGameStore((state) => state.closeArchive)

  if (view !== 'full-scan' || !missionId) return null
  const mission = findMission(missionId)
  if (!mission) return null
  return <FullScanDialog mission={mission} onClose={closeArchive} />
}

export function FullScanDialog({
  mission,
  onClose,
}: {
  mission: NonNullable<ReturnType<typeof findMission>>
  onClose: () => void
}) {
  const save = useJourneyStore((state) => state.save)
  const completeFullScan = useJourneyStore((state) => state.completeFullScan)
  const prepareSmartLetter = useJourneyStore(
    (state) => state.prepareSmartLetter,
  )
  const openArchive = useGameStore((state) => state.openArchive)
  const voiceEnabled = useGameStore((state) => state.voiceEnabled)
  const voiceName = useGameStore((state) => state.voiceName)
  const reducedMotion = useGameStore((state) => state.reducedMotion)

  const progress = save?.missions[mission.id] ?? null
  const stage = getMissionStage(progress)
  const alreadyRecovered = progress?.memoryRecoveredAt != null
  const scannedCount = scannedComponentCount(progress)

  // Shared with the in-world sweep: one reconstruction state, not two.
  const reconstruction = useGameStore((state) => state.fullScanRecon)
  const setReconstruction = useGameStore((state) => state.setFullScanRecon)
  const startFullScanSweep = useGameStore((state) => state.startFullScanSweep)
  const [justRecovered, setJustRecovered] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const startedLineSpoken = useRef(false)
  const startedRef = useRef(false)
  const recoveredRef = useRef(false)
  const rebuildSpokenRef = useRef(false)

  const recovered = alreadyRecovered || justRecovered

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    previousFocus.current = document.activeElement
    if (!dialog.open) dialog.showModal()
    const frame = window.requestAnimationFrame(() =>
      (
        primaryRef.current ??
        dialog.querySelector<HTMLElement>('.recon-trace:not(:disabled)')
      )?.focus(),
    )
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
      const previous = previousFocus.current
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (recovered) {
      // The dialog owns this beat. Mark the world cue spoken so closing the
      // dialog never replays the same sentence twice.
      const cues = getFullScanCompleteCues(mission)
      for (const cue of cues) {
        useNarrativeStore.getState().markSpoken(cue.id)
      }
      const line = cues[1] ?? cues[0]
      if (line) {
        speakPip(
          line.text,
          voiceName,
          voiceEnabled,
          line.expression,
        )
      }
    }
    return () => stopPipVoice()
  }, [recovered, mission, voiceName, voiceEnabled])

  useEffect(() => {
    recoveredRef.current = recovered
  }, [recovered])

  // Step 2 unlocks once every trace is revealed: PIP says one line, once, and
  // keyboard focus moves to the first fragment waiting in the tray.
  const rebuildUnlocked = isRebuildUnlocked(reconstruction)
  useEffect(() => {
    if (!rebuildUnlocked || recovered || rebuildSpokenRef.current) return
    rebuildSpokenRef.current = true
    speakPip(REBUILD_STEP_LINE, voiceName, voiceEnabled, 'focused')
    window.requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>('.recon-card:not(:disabled)')
        ?.focus(),
    )
  }, [rebuildUnlocked, recovered, voiceName, voiceEnabled])

  // Picking a fragment moves focus to the first open slot (keyboard flow).
  const selectedKind = reconstruction.selected
  useEffect(() => {
    if (!selectedKind) return
    window.requestAnimationFrame(() =>
      dialogRef.current
        ?.querySelector<HTMLElement>('.recon-slot.is-open:not(:disabled)')
        ?.focus(),
    )
  }, [selectedKind])

  useEffect(
    () => () => {
      // Closing mid-reconstruction cancels the scan loop; nothing was saved.
      if (startedRef.current && !recoveredRef.current) {
        emitAudio('fullScanCancelled')
      } else {
        audioManager.stopLoop('fullScan')
      }
    },
    [],
  )

  const beginIfNeeded = () => {
    if (startedRef.current) return
    startedRef.current = true
    emitAudio('fullScanStarted')
    if (!startedLineSpoken.current) {
      startedLineSpoken.current = true
      const cue = getFullScanStartedCue(mission)
      if (cue) {
        useNarrativeStore.getState().markSpoken(cue.id)
        speakPip(cue.text, voiceName, voiceEnabled, cue.expression)
      }
    }
  }

  const recoverMemory = () => {
    const result = completeFullScan(mission.id)
    if (!result) {
      setMessage('No active journey save. The scan was not recorded.')
      return
    }
    if (result.status === 'memory-recovered') {
      setJustRecovered(true)
      emitAudio('fullScanCompleted')
      // The dialog narrates the recovery; the world queue stays clean so the
      // same line is not repeated when the overlay closes.
      useNarrativeStore.getState().react('archive', undefined, 2600)
      return
    }
    setMessage(
      result.status === 'locked'
        ? 'Recognize all three fragments before scanning the complete explorer.'
        : result.status === 'already-recovered'
          ? 'The memory was already recovered.'
          : 'This mission is not available.',
    )
  }

  const canInteract = stage === 'ready_for_full_scan' && !recovered

  // The sweep may have happened in the world: the loop starts with the rebuild.
  useEffect(() => {
    if (rebuildUnlocked && canInteract) beginIfNeeded()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rebuildUnlocked, canInteract])

  const handleReveal = (kind: MemoryFragmentKind) => {
    if (!canInteract) return
    beginIfNeeded()
    setMessage(null)
    setReconstruction((current) => revealFragment(current, kind).state)
  }

  const handleSelectFragment = (kind: MemoryFragmentKind) => {
    if (!canInteract) return
    setReconstruction((current) => selectFragment(current, kind).state)
  }

  const handlePlace = (slotIndex: number) => {
    if (!canInteract) return
    const result = placeFragment(reconstruction, slotIndex)
    if (result.action === 'ignored') return
    setReconstruction(result.state)
    if (isReconstructionComplete(result.state)) recoverMemory()
  }

  // Pointer drag-and-drop is a convenience on top of select-then-place; the
  // tap/keyboard path above stays the accessible equivalent.
  const handleDragStart = (kind: MemoryFragmentKind) => {
    if (!canInteract) return
    setReconstruction((current) =>
      current.selected === kind ? current : selectFragment(current, kind).state,
    )
  }

  const handlePrepare = () => {
    const result = prepareSmartLetter(mission.id)
    if (result?.status === 'created' || result?.status === 'already-created') {
      openArchive('smart-letter', mission.id)
      return
    }
    setMessage('The memory must be recovered before preparing the letter.')
  }

  return (
    <dialog
      ref={dialogRef}
      className="smart-letter-dialog"
      aria-labelledby="full-scan-title"
      aria-describedby="full-scan-description"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <article className="smart-letter">
        <header className="smart-letter__header">
          <div className="smart-letter__heading">
            <p className="smart-letter__eyebrow">
              Cosmic Archive · Full recognition scan
            </p>
            <h2 id="full-scan-title">
              {progress?.discovered
                ? mission.machineName
                : 'Unidentified explorer'}
            </h2>
            <p className="smart-letter__meta">
              {mission.missionName} · {mission.yearLabel}
            </p>
          </div>
          <button
            type="button"
            className="settings-close smart-letter__close-x"
            aria-label="Close full recognition scan"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <p id="full-scan-description" className="smart-letter__summary">
          Recognize the complete explorer, not a single part. The machine stays
          still; this scan reads its whole structure for the Archive.
        </p>

        <div
          className="smart-letter__records"
          aria-label={`${scannedCount} of 3 fragments recognized`}
        >
          <h3>Recognition prerequisite</h3>
          <div
            className="cosmic-scanner__progress"
            aria-label={`${scannedCount} of 3 fragments recognized`}
          >
            {mission.components.map((component) => (
              <span
                key={component.id}
                className={`cosmic-scanner__pip${
                  progress?.scannedComponentIds.includes(component.id)
                    ? ' is-filled'
                    : ''
                }`}
              />
            ))}
            <span className="cosmic-scanner__count">{scannedCount}/3</span>
          </div>
        </div>

        {recovered ? (
          <div className="full-scan__result" role="status">
            <svg
              className="full-scan__core"
              viewBox="0 0 64 64"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="32" cy="32" r="28" fill="#2A1D3B" />
              <circle cx="32" cy="32" r="20" fill="none" stroke="#FFD9A8" strokeWidth="3" />
              <circle cx="32" cy="32" r="9" fill="#F2B5E2" />
              <path d="M32 4v10M32 50v10M4 32h10M50 32h10" stroke="#FFD9A8" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <h3>OBJETO COMPLETO — MEMORIA RECUPERADA</h3>
            <p>
              The fictional memory core has been recovered. The explorer remains
              immobile; no data is requested from the real machine.
            </p>
            <p>
              The memory can now become a smart letter for the Earth Cosmic
              Archive.
            </p>
            <div className="archive-actions">
              <button
                ref={primaryRef}
                type="button"
                className="archive-action archive-action--primary"
                onClick={handlePrepare}
              >
                Prepare smart letter
              </button>
              <button
                type="button"
                className="archive-action"
                onClick={() => openArchive('smart-letter', mission.id)}
              >
                Open smart letter
              </button>
            </div>
          </div>
        ) : stage === 'ready_for_full_scan' ? (
          <>
            <ol className="recon__steps" aria-label="Scan steps">
              {(['sweep', 'rebuild'] as const).map((id, index) => {
                const current = getReconstructionStep(reconstruction)
                const done =
                  current === 'done' ||
                  (id === 'sweep' && current === 'rebuild')
                const active = current === id
                return (
                  <li
                    key={id}
                    className={`recon__step${active ? ' is-active' : ''}${
                      done ? ' is-done' : ''
                    }`}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="recon__step-num" aria-hidden="true">
                      {done ? '✓' : index + 1}
                    </span>
                    {id === 'sweep' ? 'Sweep' : 'Rebuild'}
                  </li>
                )
              })}
            </ol>

            <section
              className={`recon${
                getReconstructionStep(reconstruction) === 'sweep'
                  ? ' is-current'
                  : ''
              }`}
              aria-labelledby="recon-sweep-title"
            >
              <h3 id="recon-sweep-title">1 · Sweep the explorer</h3>
              <p className="recon__help">
                {reducedMotion
                  ? 'Activate each memory trace to reveal a fragment.'
                  : 'Hold each memory trace until it reveals a fragment.'}
              </p>
              <div
                className="recon__meter"
                role="progressbar"
                aria-label="Sweep progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(getSweepProgress(reconstruction) * 100)}
              >
                <span
                  style={{
                    width: `${getSweepProgress(reconstruction) * 100}%`,
                  }}
                />
              </div>
              <p className="recon__status">
                {reconstruction.revealed.length}/4 traces ·{' '}
                {Math.round(getSweepProgress(reconstruction) * 100)}%
              </p>
              {canInteract && getReconstructionStep(reconstruction) === 'sweep' && (
                <button
                  type="button"
                  className="archive-action archive-action--primary recon__field"
                  onClick={() => startFullScanSweep(mission.id)}
                >
                  Sweep in the field
                </button>
              )}
              <p className="recon__help">
                Or reveal the traces from this panel.
              </p>
              <div className="recon__traces">
                {MEMORY_FRAGMENT_KINDS.map((kind, index) => (
                  <MemoryTrace
                    key={kind}
                    kind={kind}
                    index={index}
                    revealed={reconstruction.revealed.includes(kind)}
                    reducedMotion={reducedMotion}
                    disabled={!canInteract}
                    onReveal={handleReveal}
                  />
                ))}
              </div>
            </section>

            <section
              className={`recon${
                rebuildUnlocked ? ' is-current' : ' is-locked'
              }`}
              aria-labelledby="recon-core-title"
              aria-disabled={!rebuildUnlocked || undefined}
            >
              <h3 id="recon-core-title">2 · Rebuild the memory core</h3>
              <p className="recon__help">
                {rebuildUnlocked
                  ? 'Drag a fragment to its place, or pick it and choose a slot: earliest to latest.'
                  : 'Locked until all four traces are revealed.'}
              </p>
              <div
                className="recon__meter"
                role="progressbar"
                aria-label="Memory core progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(
                  getRebuildProgress(reconstruction) * 100,
                )}
              >
                <span
                  style={{
                    width: `${getRebuildProgress(reconstruction) * 100}%`,
                  }}
                />
              </div>
              <ul className="recon__tray" aria-label="Revealed fragments">
                {getTrayFragments(reconstruction).map((kind) => (
                  <li key={kind}>
                    <button
                      type="button"
                      className={`recon-card${
                        reconstruction.selected === kind ? ' is-selected' : ''
                      }`}
                      aria-pressed={reconstruction.selected === kind}
                      disabled={!canInteract || !rebuildUnlocked}
                      draggable={canInteract && rebuildUnlocked}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', kind)
                        event.dataTransfer.effectAllowed = 'move'
                        handleDragStart(kind)
                      }}
                      onClick={() => handleSelectFragment(kind)}
                    >
                      <strong>{MEMORY_FRAGMENTS[kind].label}</strong>
                      <span>{getFragmentText(mission, kind)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="recon__axis" aria-hidden="true">
                Earlier → Later
              </p>
              <ol className="recon__timeline" aria-label="Memory core timeline">
                {reconstruction.slots.map((slot, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      className={`recon-slot${slot ? ' is-filled' : ''}${
                        reconstruction.selected && !slot ? ' is-open' : ''
                      }`}
                      aria-label={`Timeline slot ${index + 1} of 4: ${
                        slot ? MEMORY_FRAGMENTS[slot].label : 'empty'
                      }`}
                      disabled={
                        !canInteract || !rebuildUnlocked || slot !== null
                      }
                      onDragOver={(event) => {
                        if (reconstruction.selected && !slot) {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        handlePlace(index)
                      }}
                      onClick={() => handlePlace(index)}
                    >
                      <span className="recon-slot__step">{index + 1}</span>
                      <span>
                        {slot
                          ? MEMORY_FRAGMENTS[slot].label
                          : reconstruction.selected
                            ? 'Place here'
                            : 'Empty'}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="recon__live" role="status" aria-live="polite">
                {reconstruction.hint ?? ''}
              </p>
            </section>

            <div className="archive-actions">
              <button type="button" className="archive-action" onClick={onClose}>
                Cancel
              </button>
            </div>
            <p className="smart-letter__status">
              Nothing is lost if a fragment lands in the wrong place: it simply
              returns.
            </p>
          </>
        ) : (
          <div className="smart-letter__locked" role="status">
            <p>The complete recognition scan is still locked.</p>
            <p>
              Recognize all three fragments first, then return to the scanner
              and choose the full recognition scan.
            </p>
            <p className="smart-letter__locked-count">
              {scannedCount}/3 fragments recognized
            </p>
          </div>
        )}

        <div className="smart-letter__pip">
          <PipAvatar />
          <div>
            <p className="pip-name">PIP</p>
            <p className="smart-letter__pip-line">
              {recovered
                ? mission.narrative?.fullScanComplete[1] ??
                  'The memory is safe. Let us prepare its smart letter.'
                : reconstruction.hint
                  ? reconstruction.hint
                  : reconstruction.revealed.length > 0
                    ? mission.narrative?.fullScanStarted ??
                      'Linking the three fragments into one record.'
                    : 'A full scan reads the whole explorer. It does not wake it up.'}
            </p>
          </div>
        </div>

        {message && (
          <p className="smart-letter__message" role="status">
            {message}
          </p>
        )}

        <footer className="smart-letter__footer">
          <span className="smart-letter__barcode" aria-hidden="true" />
          <button
            type="button"
            className="smart-letter__return"
            onClick={onClose}
          >
            Return to exploring
          </button>
        </footer>
      </article>
    </dialog>
  )
}
