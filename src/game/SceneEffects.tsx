import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** Loaded only when High quality needs post-processing. */
export default function SceneEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.22}
        luminanceThreshold={0.95}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.7}
      />
      <Vignette offset={0.25} darkness={0.32} />
    </EffectComposer>
  )
}
