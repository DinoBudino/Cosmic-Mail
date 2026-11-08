import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** Loaded only when High quality needs post-processing. */
export default function SceneEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.28}
        luminanceThreshold={0.88}
        luminanceSmoothing={0.25}
        mipmapBlur
        radius={0.55}
      />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  )
}
