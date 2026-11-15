import { Component, type ReactNode } from 'react'

/**
 * Keeps a decorative overlay (the landing-site title, for example) from
 * taking the whole game down if it ever fails: it simply disappears and
 * `onError` lets the game carry on as if the overlay had finished.
 */
export class OverlayBoundary extends Component<
  { children: ReactNode; onError?: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Overlay failed and was skipped:', error)
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
