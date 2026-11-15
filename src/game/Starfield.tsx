import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildStarGeometry } from './starfield'

interface StarfieldProps {
  count: number
  reducedMotion: boolean
  /** Multiplies every star's glow and size (1 = as built). */
  brightness?: number
  /** Stars only twinkle through air; the Moon's sky keeps them steady. */
  twinkle?: boolean
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aAlpha;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uTwinkle;
  uniform float uPixelRatio;
  uniform float uBrightness;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    float twinkle = mix(
      1.0,
      0.68 + 0.32 * sin(uTime * 1.7 + aPhase),
      uTwinkle
    );
    vAlpha = min(aAlpha * twinkle * uBrightness, 1.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uPixelRatio * mix(1.0, uBrightness, 0.5);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - 0.5);
    if (distanceToCenter > 0.5) discard;

    float glow = pow(1.0 - smoothstep(0.0, 0.5, distanceToCenter), 2.4);
    gl_FragColor = vec4(vColor, glow * vAlpha);

    #include <colorspace_fragment>
  }
`

export function Starfield({ count, reducedMotion, brightness = 1, twinkle = true }: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const geometry = useMemo(() => buildStarGeometry(count), [count])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTwinkle: { value: 1 },
          uPixelRatio: { value: 1 },
          uBrightness: { value: 1 },
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => {
    return () => geometry.dispose()
  }, [geometry])

  useEffect(() => {
    return () => material.dispose()
  }, [material])

  useFrame((state) => {
    const current = pointsRef.current?.material as THREE.ShaderMaterial | undefined
    if (!current) return
    current.uniforms.uTime.value = state.clock.elapsedTime
    current.uniforms.uPixelRatio.value = state.gl.getPixelRatio()
    current.uniforms.uTwinkle.value = reducedMotion || !twinkle ? 0 : 1
    current.uniforms.uBrightness.value = brightness
  })

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      renderOrder={-18}
      frustumCulled={false}
    />
  )
}
