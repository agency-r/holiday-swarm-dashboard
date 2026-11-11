import { Grid, OrbitControls, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useSwarm } from '../store'
import { AGENTS, C, stationPosition } from '../theme'
import { Core } from './Core'
import { Effects } from './Effects'
import { Station } from './Station'

export function Office() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [19.5, 17, 19.5], fov: 32, near: 0.1, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onPointerMissed={() => useSwarm.getState().select(null)}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 34, 70]} />
      <hemisphereLight args={['#ffffff', '#d9d3c7', 0.9]} />
      <directionalLight
        position={[8, 16, 6]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-10, 6, -4]} intensity={0.35} color="#dfe7ff" />
      <Floor />
      <Core />
      {AGENTS.map((a) => <Station key={a.id} id={a.id} />)}
      <Effects />
      <Rig />
    </Canvas>
  )
}

function Floor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={C.floor} roughness={1} />
      </mesh>
      <Grid position={[0, 0.002, 0]} args={[60, 60]} cellSize={0.5} cellThickness={0.6} cellColor="#D3CEC4"
        sectionSize={2.5} sectionThickness={1} sectionColor="#C4BFB4" fadeDistance={42} fadeStrength={1.5} infiniteGrid />
      {/* office "chassis" plate under everything, like an instrument body */}
      <RoundedBox args={[19.5, 0.08, 19.5]} radius={0.04} position={[0, 0.0, 0]} receiveShadow>
        <meshStandardMaterial color="#E9E6DF" roughness={0.9} />
      </RoundedBox>
      {/* corner screws */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} position={[x * 9.35, 0.05, z * 9.35]}>
          <cylinderGeometry args={[0.14, 0.14, 0.04, 20]} />
          <meshStandardMaterial color="#BDB8AE" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/** Smoothly retargets the orbit camera to the selected station. */
function Rig() {
  const controls = useRef<OrbitControlsImpl>(null)
  const selected = useSwarm((s) => s.selected)
  const autoOrbit = useSwarm((s) => s.autoOrbit)
  const { camera } = useThree()
  const size = useThree((s) => s.size)
  const tgt = useRef(new THREE.Vector3(0, 1.2, 0))
  // frame the ring inside the area left free by the HUD panels; pull back on narrow screens
  useEffect(() => {
    const aspect = size.width / size.height
    const k = Math.max(1, 1.75 / aspect)
    camera.position.set(19.5 * k, 17 * k, 19.5 * k)
  }, [size.width, size.height, camera])
  useFrame((_, dt) => {
    if (selected) {
      const [x, , z] = stationPosition(selected)
      // look toward the module, offset screen-right so the detail panel doesn't cover the ring
      tgt.current.set(x * 0.45 + 2.6, 0.6, z * 0.45 - 1.0)
    } else tgt.current.set(1.6, 0.2, 1.6) // shifted toward camera so the ring sits above the dock
    const c = controls.current
    if (c) {
      c.target.x = THREE.MathUtils.damp(c.target.x, tgt.current.x, 3, dt)
      c.target.y = THREE.MathUtils.damp(c.target.y, tgt.current.y, 3, dt)
      c.target.z = THREE.MathUtils.damp(c.target.z, tgt.current.z, 3, dt)
      c.update()
    }
    void camera
  })
  return (
    <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={9} maxDistance={55}
      maxPolarAngle={Math.PI / 2.25} minPolarAngle={0.25} autoRotate={autoOrbit && !selected} autoRotateSpeed={0.25} />
  )
}
