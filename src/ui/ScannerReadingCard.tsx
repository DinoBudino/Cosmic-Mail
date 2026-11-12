import { useEffect, useRef, type MouseEvent } from 'react'
import { getEnvironmentalSite } from '../data/environmentalSites'
import { findMission } from '../data/missions'
import { SPIRIT_SITE } from '../data/spiritSite'
import { useGameStore } from '../store/gameStore'
import { useJourneyStore } from '../store/journeyStore'
import { scannedComponentCount } from './missionStage'
import { PipAvatar } from './PipSpeech'

function FieldNotes({
  ids,
  detailed,
}: {
  ids: readonly string[]
  detailed: ReadonlySet<string>
}) {
  const sites = ids
    .map((id) => getEnvironmentalSite(id))
    .filter((site): site is NonNullable<typeof site> => site !== null)
  if (sites.length === 0) return null

  return (
    <section
      className="scanner-reading__records scanner-reading__field-notes"
      aria-label="Optional environmental field observations"
    >
      <h3>Field observations · {sites.length}</h3>
      <ul>
        {sites.map((site) => (
          <li key={site.id} className="scanner-reading__field-note">
            <details>
              <summary>
                <strong>{site.name}</strong>
                <small>
                  {site.categoryLabel} ·{' '}
                  {detailed.has(site.id)
                    ? 'detailed comparison'
                    : 'quick reading'}
                </small>
              </summary>
              <p>{site.scienceNote}</p>
              <nav className="site-sources" aria-label="NASA reference sources">
                {site.sources.map((source) => (
                  <a
                    key={source}
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source} ↗
                  </a>
                ))}
              </nav>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Optional mission records browser. It is never opened automatically:
 * the player can review recovered components from the scanner HUD or the
 * radar. It pauses exploration while open and returns focus on close.
 */
export function ScannerReadingCard() {
  const recordsOpen = useGameStore((state) => state.scannerRecordsOpen)
  const componentId = useGameStore(
    (state) => state.scannerCardComponentId,
  )
  const missionId = useGameStore((state) => state.scannerMissionId)
  const closeCard = useGameStore((state) => state.closeScannerCard)
  const openRecords = useGameStore((state) => state.openScannerRecords)
  const save = useJourneyStore((state) => state.save)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<Element | null>(null)

  const mission = missionId ? findMission(missionId) : null
  const component =
    mission?.components.find((entry) => entry.id === componentId) ?? null
  const progress = mission && save ? save.missions[mission.id] : null
  const scannedCount = scannedComponentCount(progress)
  const scanned = new Set(progress?.scannedComponentIds ?? [])
  const discovered = Boolean(progress?.discovered)
  const environmental = save?.environmentalDiscoveries ?? []
  const environmentalDetailed = new Set(
    save?.environmentalDetailedDiscoveries ?? [],
  )

  useEffect(() => {
    if (!recordsOpen || !mission) return
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) {
      previousFocus.current = document.activeElement
      dialog.showModal()
    }
    const frame = window.requestAnimationFrame(() => {
      if (componentId) {
        closeRef.current?.focus()
        return
      }
      const firstRecord = dialog.querySelector<HTMLButtonElement>(
        '.scanner-reading__record:not(:disabled)',
      )
      ;(firstRecord ?? closeRef.current)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [recordsOpen, mission, componentId])

  useEffect(() => {
    if (recordsOpen) return
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
    const trigger = document.querySelector<HTMLElement>(
      '[data-records-trigger]',
    )
    if (trigger?.isConnected && trigger.getClientRects().length > 0) {
      trigger.focus()
      return
    }
    if (
      previousFocus.current instanceof HTMLElement &&
      previousFocus.current.isConnected
    ) {
      previousFocus.current.focus()
    }
  }, [recordsOpen])

  if (!recordsOpen || !mission) return null

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeCard()
  }

  return (
    <dialog
      ref={dialogRef}
      className="scanner-reading"
      aria-labelledby="scanner-reading-title"
      aria-describedby="scanner-reading-description"
      onCancel={(event) => {
        event.preventDefault()
        closeCard()
      }}
      onClick={handleBackdrop}
    >
      <div className="scanner-reading__body">
        <header className="scanner-reading__header">
          <div>
            <p className="settings-eyebrow">
              Mission records ·{' '}
              {discovered ? mission.machineName : 'unidentified signal'}
            </p>
            <h2 id="scanner-reading-title">
              {!discovered
                ? 'Unidentified explorer'
                : component
                  ? component.name
                  : 'Recovered records'}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="settings-close"
            aria-label="Close mission records"
            onClick={closeCard}
          >
            ×
          </button>
        </header>

        <p id="scanner-reading-description" className="scanner-reading__count">
          {scannedCount}/3 components recorded · optional review
        </p>

        {!discovered ? (
          <div className="scanner-reading__locked" role="status">
            <p>The explorer has not been identified yet.</p>
            <p>
              Follow the Cosmic Radar signal and inspect what you find. PIP
              will help you recognize the explorer&apos;s parts.
            </p>
            <FieldNotes ids={environmental} detailed={environmentalDetailed} />
          </div>
        ) : component ? (
          <>
            <button
              type="button"
              className="scanner-reading__back"
              onClick={() => openRecords(mission.id)}
            >
              ← All records
            </button>

            <p className="scanner-reading__fact">
              {component.historicalRecord}
            </p>

            <div className="scanner-reading__pip">
              <PipAvatar />
              <div>
                <p className="pip-name">PIP</p>
                <p className="scanner-reading__pip-line">
                  {component.pipLine}
                </p>
              </div>
            </div>

            <p
              className={`scanner-reading__status${
                scanned.has(component.id) ? ' is-recorded' : ''
              }`}
              role="status"
            >
              {scanned.has(component.id)
                ? 'Record recovered. This component is stored in the mission records.'
                : 'Not recorded yet. Use the Cosmic Scanner on this part to add it.'}
            </p>

            <nav className="site-sources" aria-label="NASA mission sources">
              {component.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.label} ↗
                </a>
              ))}
            </nav>
          </>
        ) : (
          <>
            <p className="scanner-reading__fact">{mission.summary}</p>

            <section
              className="scanner-reading__records"
              aria-label="Components"
            >
              {mission.components.map((entry, index) => {
                const recorded = scanned.has(entry.id)
                return (
                  <button
                    key={entry.id}
                    type="button"
                    data-record-first={index === 0 ? '' : undefined}
                    className={`scanner-reading__record${
                      recorded ? ' is-recorded' : ''
                    }`}
                    disabled={!recorded}
                    onClick={() => openRecords(mission.id, entry.id)}
                  >
                    <span
                      className="scanner-reading__record-mark"
                      aria-hidden="true"
                    >
                      {recorded ? '✓' : '·'}
                    </span>
                    <span className="scanner-reading__record-copy">
                      <strong>{entry.shortName}</strong>
                      <small>
                        {recorded
                          ? 'Open the NASA record'
                          : 'Not recorded yet'}
                      </small>
                    </span>
                  </button>
                )
              })}
            </section>

            {scannedCount === 0 && (
              <p className="scanner-reading__status" role="status">
                Scan the explorer&apos;s parts to unlock their records.
              </p>
            )}

            <FieldNotes ids={environmental} detailed={environmentalDetailed} />

            <nav className="site-sources" aria-label="NASA mission sources">
              {mission.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.label} ↗
                </a>
              ))}
            </nav>

            {import.meta.env.DEV && mission.id === SPIRIT_SITE.missionId && (
              <p className="scanner-reading__note">
                {SPIRIT_SITE.placeholderNote}
              </p>
            )}
          </>
        )}

        <button
          type="button"
          className="settings-resume"
          onClick={closeCard}
        >
          Return to exploring
        </button>
      </div>
    </dialog>
  )
}
