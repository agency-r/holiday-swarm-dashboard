import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AGENT_BY_ID, C, STATE_COLOR } from '../theme'
import type { AgentId, AgentStatus } from '../types'

/** Stylized geometric "character" per agent. Body shape = identity, motion = state. */
export function AgentUnit({ id, agent, position }: { id: AgentId; agent?: AgentStatus; position: [number, number, number] }) {
  const meta = AGENT_BY_ID[id]
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const ringA = useRef<THREE.Mesh>(null)
  const fx = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const state = agent?.state ?? 'idle'
  const boost = agent?.boost ?? false
  const seed = useMemo(() => Math.random() * 10, [])
  const baseColor = useMemo(() => new THREE.Color(meta.color), [meta.color])
  const pausedColor = useMemo(() => new THREE.Color('#B9B5AD'), [])

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime + seed
    const sp = boost ? 1.8 : 1
    if (!body.current || !head.current) return
    let y = 0.62, ry = body.current.rotation.y, rx = 0
    switch (state) {
      case 'idle': y += Math.sin(t * 1.4) * 0.03; ry += dt * 0.15; break
      case 'researching': y += Math.sin(t * 2) * 0.04; head.current.rotation.y = Math.sin(t * 1.6 * sp) * 0.9; break
      case 'building': y += Math.abs(Math.sin(t * 7 * sp)) * 0.12; rx = Math.sin(t * 7 * sp) * 0.06; break
      case 'marketing': y += 0.08 + Math.sin(t * 3 * sp) * 0.05; ry += dt * 1.2 * sp; break
      case 'optimizing': y += Math.sin(t * 2.5) * 0.04; ry += dt * 2.4 * sp; break
      case 'paused': y = 0.5; break
      default: break
    }
    body.current.position.y = THREE.MathUtils.damp(body.current.position.y, y, 12, dt)
    body.current.rotation.y = ry
    body.current.rotation.x = rx
    if (state !== 'researching') head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, 0, 6, dt)
    if (mat.current) {
      mat.current.color.lerp(state === 'paused' ? pausedColor : baseColor, 0.12)
      mat.current.emissive.copy(mat.current.color)
      mat.current.emissiveIntensity = state === 'paused' ? 0 : meta.color === C.ink ? 0.05 : 0.12 + (boost ? Math.sin(t * 8) * 0.08 + 0.1 : 0)
    }
    if (ringA.current) {
      ringA.current.rotation.z += dt * (state === 'optimizing' ? 3 * sp : 0.4)
      const target = state === 'optimizing' || state === 'researching' ? 1 : 0.001
      const sc = THREE.MathUtils.damp(ringA.current.scale.x, target, 6, dt)
      ringA.current.scale.setScalar(sc)
    }
    if (fx.current) {
      fx.current.children.forEach((c, i) => {
        const m = c as THREE.Mesh
        const k = ((t * 0.7 * sp + i / 3) % 1)
        if (state === 'marketing') {
          m.visible = true
          m.position.y = 0.4 + k * 1.3
          m.scale.setScalar(0.35 + k * 0.9)
          ;(m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7
        } else if (state === 'researching') {
          m.visible = true
          m.position.y = 0.02
          m.scale.setScalar(0.4 + k * 1.6)
          ;(m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.55
        } else m.visible = false
      })
    }
  })

  const fxColor = state === 'marketing' ? C.yellow : C.blue

  return (
    <group position={position}>
      {/* puck */}
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.42, 0.46, 0.08, 40]} />
        <meshStandardMaterial color="#D8D4CB" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.36, 40]} />
        <meshBasicMaterial color={STATE_COLOR[state]} toneMapped={false} />
      </mesh>
      {/* state FX rings */}
      <group ref={fx}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.46, 0.5, 48]} />
            <meshBasicMaterial color={fxColor} transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={body} position={[0, 0.62, 0]}>
        <group ref={head}>
          <Body shape={meta.shape} matRef={mat} color={meta.color} />
          {/* face: visor + eyes, always on +z (front) */}
          <group position={[0, 0.04, 0.3]}>
            <mesh>
              <boxGeometry args={[0.34, 0.12, 0.04]} />
              <meshStandardMaterial color={meta.color === C.ink ? '#2B2B2B' : C.ink} roughness={0.25} />
            </mesh>
            <Eyes state={state} />
          </group>
        </group>
        <mesh ref={ringA} rotation={[Math.PI / 2.4, 0, 0]} scale={0.001}>
          <torusGeometry args={[0.5, 0.025, 8, 48]} />
          <meshStandardMaterial color={state === 'researching' ? C.blue : C.green} emissive={state === 'researching' ? C.blue : C.green}
            emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
        {state === 'building' && <BuildBits color={meta.color === C.ink ? C.orange : meta.color} />}
      </group>
    </group>
  )
}

function Eyes({ state }: { state: string }) {
  const l = useRef<THREE.Mesh>(null)
  const r = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1
    const sy = state === 'paused' ? 0.2 : blink
    l.current?.scale.set(1, sy, 1)
    r.current?.scale.set(1, sy, 1)
  })
  const col = state === 'paused' ? '#777' : state === 'idle' ? C.white : C.yellow
  return (
    <>
      <mesh ref={l} position={[-0.075, 0, 0.022]}>
        <boxGeometry args={[0.05, 0.05, 0.01]} />
        <meshBasicMaterial color={col} toneMapped={false} />
      </mesh>
      <mesh ref={r} position={[0.075, 0, 0.022]}>
        <boxGeometry args={[0.05, 0.05, 0.01]} />
        <meshBasicMaterial color={col} toneMapped={false} />
      </mesh>
    </>
  )
}

function Body({ shape, matRef, color }: { shape: string; matRef: React.RefObject<THREE.MeshStandardMaterial>; color: string }) {
  const geo = useMemo(() => {
    switch (shape) {
      case 'octa': return new THREE.OctahedronGeometry(0.42, 0)
      case 'sphere': return new THREE.SphereGeometry(0.34, 32, 24)
      case 'cube': return new THREE.BoxGeometry(0.56, 0.56, 0.56)
      case 'cylinder': return new THREE.CylinderGeometry(0.3, 0.3, 0.6, 32)
      case 'cone': return new THREE.ConeGeometry(0.36, 0.7, 4)
      case 'torus': return new THREE.TorusGeometry(0.26, 0.12, 16, 32)
      case 'capsule': return new THREE.CapsuleGeometry(0.24, 0.32, 8, 24)
      case 'dodeca': return new THREE.DodecahedronGeometry(0.36, 0)
      default: return new THREE.BoxGeometry(0.5, 0.5, 0.5)
    }
  }, [shape])
  return (
    <mesh geometry={geo} castShadow rotation={shape === 'cone' ? [0, Math.PI / 4, 0] : [0, 0, 0]}>
      <meshStandardMaterial ref={matRef} color={color} roughness={color === C.ink ? 0.3 : 0.45} metalness={0.05} flatShading={shape === 'octa' || shape === 'dodeca' || shape === 'cone'} />
    </mesh>
  )
}

function BuildBits({ color }: { color: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame((s) => {
    const t = s.clock.elapsedTime
    g.current?.children.forEach((c, i) => {
      const a = t * 2.4 + (i / 4) * Math.PI * 2
      c.position.set(Math.cos(a) * 0.62, 0.15 + Math.sin(t * 5 + i) * 0.12, Math.sin(a) * 0.62)
      c.rotation.set(t * 2 + i, t * 3, 0)
    })
  })
  return (
    <group ref={g}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={i % 2 ? color : C.white} />
        </mesh>
      ))}
    </group>
  )
}
