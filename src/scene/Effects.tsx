import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FX_DURATION, useSwarm, type Fx } from '../store'
import { AGENT_BY_ID, C, stationPosition } from '../theme'

const CORE_TOP = new THREE.Vector3(0, 3.8, 0)

function anchor(id: Fx['from'] | Fx['to']): THREE.Vector3 {
  if (id === 'core') return CORE_TOP.clone()
  const [x, , z] = stationPosition(id)
  return new THREE.Vector3(x, 1.3, z)
}

export function Effects() {
  const fx = useSwarm((s) => s.fx)
  const prune = useSwarm((s) => s.pruneFx)
  useFrame(() => prune(performance.now()))
  return (
    <group>
      {fx.map((f) =>
        f.kind === 'handoff' || f.kind === 'insight' ? <Arc key={f.id} fx={f} /> :
          f.kind === 'sale' ? <Coin key={f.id} fx={f} /> : <Burst key={f.id} fx={f} />,
      )}
    </group>
  )
}

function Arc({ fx }: { fx: Fx }) {
  const { curve, points } = useMemo(() => {
    const a = anchor(fx.from), b = anchor(fx.to)
    const mid = a.clone().add(b).multiplyScalar(0.5)
    mid.y += 2.2 + a.distanceTo(b) * 0.18
    const c = new THREE.QuadraticBezierCurve3(a, mid, b)
    return { curve: c, points: c.getPoints(40) }
  }, [fx.from, fx.to])
  const color = fx.kind === 'insight' ? C.green : AGENT_BY_ID[fx.from as keyof typeof AGENT_BY_ID]?.color === C.ink ? C.blue : AGENT_BY_ID[fx.from as keyof typeof AGENT_BY_ID]?.color ?? C.blue
  const dot = useRef<THREE.Mesh>(null)
  const line = useRef<any>(null)
  useFrame(() => {
    const k = Math.min(1, (performance.now() - fx.born) / FX_DURATION)
    const travel = Math.min(1, k / 0.7)
    const e = 1 - Math.pow(1 - travel, 3)
    dot.current?.position.copy(curve.getPoint(e))
    if (dot.current) dot.current.scale.setScalar(k > 0.7 ? 1 + (k - 0.7) * 4 : 1)
    const op = k < 0.75 ? 0.9 : (1 - k) * 3.6
    if (line.current?.material) line.current.material.opacity = op
    if (dot.current) (dot.current.material as THREE.MeshBasicMaterial).opacity = k < 0.8 ? 1 : (1 - k) * 5
  })
  return (
    <group>
      <Line ref={line} points={points} color={color} lineWidth={2.2} transparent opacity={0.9} dashed dashSize={0.25} gapSize={0.12} />
      <mesh ref={dot}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshBasicMaterial color={color} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

function Coin({ fx }: { fx: Fx }) {
  const ref = useRef<THREE.Mesh>(null)
  const { curve } = useMemo(() => {
    const [x, , z] = stationPosition('closer')
    const a = new THREE.Vector3(x, 1.2, z)
    const b = CORE_TOP.clone().setY(3.55)
    const mid = a.clone().add(b).multiplyScalar(0.5).setY(5)
    return { curve: new THREE.QuadraticBezierCurve3(a, mid, b) }
  }, [])
  useFrame(() => {
    const k = Math.min(1, (performance.now() - fx.born) / (FX_DURATION * 0.7))
    if (!ref.current) return
    ref.current.position.copy(curve.getPoint(k))
    ref.current.rotation.x = k * 12
    ref.current.visible = k < 1
    ref.current.scale.setScalar(k > 0.85 ? (1 - k) * 6.6 : 1)
  })
  return (
    <mesh ref={ref} castShadow>
      <cylinderGeometry args={[0.18, 0.18, 0.05, 24]} />
      <meshStandardMaterial color={C.yellow} emissive={C.yellow} emissiveIntensity={0.4} metalness={0.3} roughness={0.3} />
    </mesh>
  )
}

function Burst({ fx }: { fx: Fx }) {
  const ref = useRef<THREE.Mesh>(null)
  const pos = useMemo(() => {
    const [x, , z] = stationPosition(fx.from as never)
    return new THREE.Vector3(x, 0.3, z)
  }, [fx.from])
  const color = fx.kind === 'compliance' ? C.orange : C.yellow
  useFrame(() => {
    const k = Math.min(1, (performance.now() - fx.born) / FX_DURATION)
    if (!ref.current) return
    ref.current.scale.setScalar(1 + k * 1.6)
    ;(ref.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85
  })
  return (
    <mesh ref={ref} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.5, 1.62, 64]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
