import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FONT_GROTESK, FONT_MONO } from '../fonts'
import { useSwarm } from '../store'
import { AGENTS, C, stationPosition } from '../theme'

const TOWER_H = 3.2
const R_PLATFORM = 2.7

/** Central mission core: day dial + revenue tower + shared-memory orb. */
export function Core() {
  return (
    <group>
      <Platform />
      <RevenueTower />
      <MemoryOrb />
      <Cables />
    </group>
  )
}

function Platform() {
  const day = useSwarm((s) => s.snap?.day_index ?? 0)
  const days = useSwarm((s) => s.snap?.days_total ?? 20)
  const ticks = days + 1
  return (
    <group>
      <mesh position={[0, 0.15, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[R_PLATFORM, R_PLATFORM + 0.08, 0.3, 96]} />
        <meshStandardMaterial color={C.white} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.302, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[R_PLATFORM - 0.62, R_PLATFORM - 0.6, 96]} />
        <meshBasicMaterial color={C.grey} />
      </mesh>
      {/* day dial: Nov 10 → Nov 30 */}
      {Array.from({ length: ticks }).map((_, i) => {
        const a = -Math.PI * 0.75 + (i / (ticks - 1)) * Math.PI * 1.5 + Math.PI / 4
        const r = R_PLATFORM - 0.3
        const special = i === 17 || i === 20
        const lit = i <= day
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.33 + (lit ? 0.03 : 0), Math.sin(a) * r]} rotation={[0, -a, 0]} castShadow>
            <boxGeometry args={[special ? 0.34 : 0.26, lit ? 0.1 : 0.05, special ? 0.12 : 0.08]} />
            <meshStandardMaterial color={lit ? (special ? C.orange : C.yellow) : special ? '#F3C6A8' : '#D4D0C7'}
              emissive={lit ? (special ? C.orange : C.yellow) : '#000'} emissiveIntensity={lit ? 0.25 : 0} />
          </mesh>
        )
      })}
      <Text font={FONT_MONO} fontSize={0.16} color={C.greyDark} position={[1.55, 0.31, 1.55]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        anchorX="center">NOV 10 ─── BLACK FRI ── CYBER MON</Text>
    </group>
  )
}

function RevenueTower() {
  const rev = useSwarm((s) => s.snap?.metrics.revenue ?? 0)
  const goal = useSwarm((s) => s.snap?.goal ?? 5000)
  const saleFlash = useSwarm((s) => s.saleFlash)
  const fill = useRef<THREE.Mesh>(null)
  const fillMat = useRef<THREE.MeshStandardMaterial>(null)
  const cap = useRef<THREE.Mesh>(null)
  const p = Math.min(1.25, rev / goal)

  useFrame((_, dt) => {
    if (!fill.current) return
    const h = THREE.MathUtils.damp(fill.current.scale.y, Math.max(0.01, p), 3, dt)
    fill.current.scale.y = h
    fill.current.position.y = 0.3 + (TOWER_H * Math.min(h, 1)) / 2
    if (h > 1) fill.current.scale.y = 1
    if (cap.current) cap.current.position.y = 0.3 + TOWER_H * Math.min(h, 1) + 0.02
    if (fillMat.current) {
      const flash = Math.max(0, 1 - (performance.now() - saleFlash) / 500)
      fillMat.current.emissiveIntensity = 0.25 + flash * 0.6
    }
  })
  const pct = Math.round((rev / goal) * 100)
  return (
    <group>
      {/* glass */}
      <mesh position={[0, 0.3 + TOWER_H / 2, 0]}>
        <cylinderGeometry args={[0.95, 0.95, TOWER_H, 64, 1, true]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.22} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* 10% rings */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[0, 0.3 + (TOWER_H * (i + 1)) / 10, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.96, i === 9 ? 0.03 : 0.008, 6, 64]} />
          <meshBasicMaterial color={i === 9 ? C.ink : '#8E8A82'} />
        </mesh>
      ))}
      <mesh ref={fill} position={[0, 0.3, 0]} scale={[1, 0.01, 1]}>
        <cylinderGeometry args={[0.86, 0.86, TOWER_H, 64]} />
        <meshStandardMaterial ref={fillMat} color={C.yellow} emissive={C.yellow} emissiveIntensity={0.25} roughness={0.35} />
      </mesh>
      <mesh ref={cap} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.86, 64]} />
        <meshStandardMaterial color="#FFD84A" emissive={C.yellow} emissiveIntensity={0.4} />
      </mesh>
      {/* tower crown */}
      <RoundedBox args={[2.1, 0.16, 2.1]} radius={0.05} position={[0, 0.3 + TOWER_H + 0.08, 0]} castShadow>
        <meshStandardMaterial color={C.ink} roughness={0.4} />
      </RoundedBox>
      <group position={[0, 0.3 + TOWER_H + 0.17, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <Text font={FONT_GROTESK} fontSize={0.62} color={pct >= 100 ? C.yellow : C.white} anchorX="center" anchorY="middle" position={[0, 0.1, 0.001]}>
          {pct}%
        </Text>
        <Text font={FONT_MONO} fontSize={0.15} color={C.yellow} anchorX="center" anchorY="middle" position={[0, -0.45, 0.001]}>
          OF GOAL
        </Text>
      </group>
    </group>
  )
}

function MemoryOrb() {
  const orb = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Mesh>(null)
  const sats = useRef<THREE.Group>(null)
  const pulse = useSwarm((s) => s.memoryPulse)
  const products = useSwarm((s) => s.snap?.products.length ?? 0)
  const Y = 0.3 + TOWER_H + 1.25
  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    if (orb.current) { orb.current.rotation.y += dt * 0.35; orb.current.position.y = Y + Math.sin(t * 1.2) * 0.07 }
    const k = Math.max(0, 1 - (performance.now() - pulse) / 700)
    if (inner.current) inner.current.scale.setScalar(1 + k * 0.25)
    if (sats.current) sats.current.rotation.y -= dt * 0.6
  })
  return (
    <group ref={orb} position={[0, Y, 0]}>
      <mesh>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshBasicMaterial color={C.ink} wireframe />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.36, 0]} />
        <meshStandardMaterial color={C.blue} emissive={C.blue} emissiveIntensity={0.7} flatShading toneMapped={false} />
      </mesh>
      <group ref={sats}>
        {Array.from({ length: Math.min(28, products) }).map((_, i) => {
          const a = (i / Math.max(1, Math.min(28, products))) * Math.PI * 2
          const r = 0.95 + (i % 2) * 0.12
          return (
            <mesh key={i} position={[Math.cos(a) * r, ((i % 3) - 1) * 0.08, Math.sin(a) * r]} castShadow>
              <boxGeometry args={[0.09, 0.12, 0.02]} />
              <meshStandardMaterial color={i % 3 === 0 ? C.orange : i % 3 === 1 ? C.white : C.yellow} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/** Floor cables from every module to the core = shared memory bus. Dots travel when an agent is busy. */
function Cables() {
  const agents = useSwarm((s) => s.snap?.agents)
  const dots = useRef<THREE.Group>(null)
  const geo = useMemo(() => AGENTS.map((a) => {
    const [x, , z] = stationPosition(a.id)
    const v = new THREE.Vector3(x, 0, z)
    const len = v.length() - R_PLATFORM - 1.1
    const dir = v.clone().normalize()
    const mid = dir.clone().multiplyScalar(R_PLATFORM + len / 2)
    return { id: a.id, color: a.color, len, mid, angle: Math.atan2(dir.x, dir.z), dir }
  }), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    dots.current?.children.forEach((d, i) => {
      const g = geo[i]
      const busy = agents?.find((a) => a.id === g.id)?.state
      const active = busy && busy !== 'idle' && busy !== 'paused'
      d.visible = !!active
      const k = 1 - ((t * 0.6 + i * 0.13) % 1)
      d.position.copy(g.dir).multiplyScalar(R_PLATFORM + k * g.len).setY(0.04)
    })
  })
  return (
    <group>
      {geo.map((g) => (
        <mesh key={g.id} position={[g.mid.x, 0.012, g.mid.z]} rotation={[0, g.angle, 0]} receiveShadow>
          <boxGeometry args={[0.06, 0.02, g.len]} />
          <meshStandardMaterial color={g.color === C.ink ? '#3A3A3A' : g.color} roughness={0.6} />
        </mesh>
      ))}
      <group ref={dots}>
        {geo.map((g) => (
          <mesh key={g.id}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color={C.white} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
