import { useEffect, useRef } from 'react'
/**
 * Act III closing screen. It only exists when every history in this
 * adventure has actually been transmitted to the Earth Cosmic Archive.
 * The machines do not revive, answer or get repaired: the archive files
 * are what return.
 */
export function ArchiveFinale({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="smart-letter-dialog"
      aria-labelledby="archive-finale-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <article className="smart-letter finale">
        <header className="smart-letter__header">
          <div className="smart-letter__heading">
            <p className="smart-letter__eyebrow">
              Cosmic Archive · Expedition complete
            </p>
            <h2 id="archive-finale-title">The archive is restored</h2>
            <p className="smart-letter__meta">
              Every history in this adventure has reached the Earth Cosmic
              Archive.
            </p>
          </div>
        </header>

        <blockquote className="finale__quote">
          «Ellos exploraron el universo por nosotros. Ahora sus historias han
          encontrado el camino de regreso a la Tierra».
        </blockquote>

        <p className="finale__theme">
          A mission can end, but the knowledge it left deserves to keep
          traveling from generation to generation.
        </p>

        <p className="smart-letter__pip-line">
          PIP&apos;s own records are clearer now. Thank you, carrier: we did not
          wake the machines, but we brought their memories home.
        </p>

        <footer className="smart-letter__footer">
          <span className="smart-letter__barcode" aria-hidden="true" />
          <button
            ref={closeRef}
            type="button"
            className="smart-letter__return"
            onClick={onClose}
          >
            Back to Mailwing
          </button>
        </footer>
      </article>
    </dialog>
  )
}
