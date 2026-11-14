import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

const TICK_MS = 50

/**
 * Press-and-hold interaction shared by the scanner ceremonies (memory
 * traces, letter seal). Pointer, touch and Space/Enter all work. With
 * reduced motion a single activation completes it immediately: the
 * action is still performed by the player, only the animation is removed.
 */
export function useHoldAction({
  seconds,
  reducedMotion,
  disabled,
  onComplete,
}: {
  seconds: number
  reducedMotion: boolean
  disabled: boolean
  onComplete: () => void
}) {
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<number | null>(null)
  const progressRef = useRef(0)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const stop = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    progressRef.current = 0
    setProgress(0)
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    },
    [],
  )

  const start = () => {
    if (disabled || timerRef.current !== null) return
    if (reducedMotion) {
      onCompleteRef.current()
      return
    }
    timerRef.current = window.setInterval(() => {
      progressRef.current = Math.min(
        1,
        progressRef.current + TICK_MS / (seconds * 1000),
      )
      setProgress(progressRef.current)
      if (progressRef.current >= 1) {
        stop()
        onCompleteRef.current()
      }
    }, TICK_MS)
  }

  return {
    progress,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        start()
      },
      onPointerUp: stop,
      onPointerCancel: stop,
      onLostPointerCapture: stop,
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        if (!event.repeat) start()
      },
      onKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        stop()
      },
      onBlur: stop,
    },
  }
}
