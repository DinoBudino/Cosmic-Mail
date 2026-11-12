import { Component, type ReactNode } from 'react'
import { clearInput } from '../game/input'
import { useGameStore } from '../store/gameStore'

export function SceneStatus({ error = false }: { error?: boolean }) {
  return (
    <section className="scene-status" role={error ? 'alert' : 'status'} aria-live="polite">
      <h2>{error ? 'The Mars scene could not continue' : 'Preparing your Mars adventure…'}</h2>
      <p>{error ? 'Check your connection and that WebGL is enabled in your browser. Reload to try again; your graphics settings are saved.' : 'Loading the landscape, stars and landmarks.'}</p>
      {error && <button type="button" className="site-action" onClick={() => window.location.reload()}>Reload the scene</button>}
    </section>
  )
}

export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch() {
    clearInput()
    useGameStore.getState().cancelTravel()
  }

  render() {
    return this.state.failed ? <SceneStatus error /> : this.props.children
  }
}
