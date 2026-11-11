import { Html, RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FONT_GROTESK, FONT_MONO } from '../fonts'
import { useSwarm } from '../store'
import { AGENT_BY_ID, C, STATE_COLOR, stationPosition } from '../theme'
import type { AgentId, AgentStatus } from '../types'
import { AgentUnit } from './AgentUnit'

const W = 2.7
const D = 2.25
const FACING = Math.PI / 4 // every module faces the camera diagonal, like a rack of instruments

export function Station({ id }: { id: AgentId }) {
  const meta = AGENT_BY_ID[id]
  const agent = useSwarm((s) => s.snap?.agents.find((a) => a.id === id))
  const selected = useSwarm((s) => s.selected === id)
  const select = useSwarm((s) => s.select)
  const hover = useSwarm((s) => s.hover)
  const [hovered, setHovered] = useState(false)
  const group = useRef<THREE.Group>(null)
  const pos = useMemo(() => stationPosition(id), [id])

  useFrame((_, dt) => {
    if (!group.current) return
    const target = selected ? 0.18 : hovered ? 0.09 : 0
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, target, 10, dt)
  })

  return (
    <group position={pos} rotation={[0, FACING, 0]}>
      <group
        ref={group}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); hover(id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); hover(null); document.body.style.cursor = 'auto' }}
        onClick={(e) => { e.stopPropagation(); select(selected ? null : id) }}
      >
        {/* plinth */}
        <RoundedBox args={[W, 0.26, D]} radius={0.07} smoothness={3} position={[0, 0.13, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={C.white} roughness={0.55} />
        </RoundedBox>
        {/* accent edge strip */}
        <mesh position={[0, 0.13, D / 2 + 0.005]}>
          <boxGeometry args={[W - 0.16, 0.06, 0.02]} />
          <meshStandardMaterial color={meta.color} roughness={0.4} />
        </mesh>
        {/* selection / hover frame */}
        {(selected || hovered) && (
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.78, selected ? 1.9 : 1.84, 64]} />
            <meshBasicMaterial color={selected ? C.yellow : C.ink} transparent opacity={selected ? 1 : 0.35} />
          </mesh>
        )}
        <Console agent={agent} color={meta.color} />
        <LevelLeds level={agent?.level ?? 1} color={meta.color === C.ink ? C.yellow : meta.color} />
        <QueueStack count={agent?.queue ?? 0} />
        <AgentUnit id={id} agent={agent} position={[0, 0.26, 0.42]} />
        {/* top-surface labels */}
        <Text font={FONT_GROTESK} fontSize={0.34} color={C.ink} anchorX="left" anchorY="middle"
          position={[-W / 2 + 0.16, 0.265, D / 2 - 0.24]} rotation={[-Math.PI / 2, 0, 0]}>
          {meta.code}
        </Text>
        <Html position={[0, 1.85, -0.35]} center zIndexRange={[2, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`st-label ${selected ? 'sel' : ''} ${agent?.state ?? 'idle'}`}>
            <span className="st-dot" style={{ background: meta.color }} />
            <b>{meta.name.toUpperCase()}</b>
            <span className="st-state" style={{ background: STATE_COLOR[agent?.state ?? 'idle'] }} />
          </div>
        </Html>
        <StateTag agent={agent} />
      </group>
    </group>
  )
}

function StateTag({ agent }: { agent?: AgentStatus }) {
  const st = agent?.state ?? 'idle'
  const label = st === 'idle' ? 'IDLE' : st.toUpperCase()
  return (
    <group position={[W / 2 - 0.16, 0.266, D / 2 - 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[-0.42, 0, -0.001]}>
        <planeGeometry args={[0.86, 0.24]} />
        <meshBasicMaterial color={STATE_COLOR[st]} toneMapped={false} />
      </mesh>
      <Text font={FONT_MONO} fontSize={0.13} color={st === 'idle' || st === 'marketing' ? C.ink : C.white}
        anchorX="center" anchorY="middle" position={[-0.42, 0, 0]}>
        {label}
      </Text>
    </group>
  )
}

function Console({ agent, color }: { agent?: AgentStatus; color: string }) {
  const knobs = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)
  const screenMat = useRef<THREE.MeshStandardMaterial>(null)
  const working = agent && agent.state !== 'idle' && agent.state !== 'paused'
  const stateColor = useMemo(() => new THREE.Color(STATE_COLOR[agent?.state ?? 'idle']), [agent?.state])

  useFrame((s, dt) => {
    if (knobs.current) knobs.current.children.forEach((k, i) => {
      k.rotation.y += dt * (working ? 1.4 + i * 0.9 : 0.05) * (i % 2 ? -1 : 1)
    })
    if (bar.current) {
      const p = Math.max(0.001, agent?.progress ?? 0)
      bar.current.scale.x = THREE.MathUtils.damp(bar.current.scale.x, p, 8, dt)
      bar.current.position.x = -0.6 + (bar.current.scale.x * 1.2) / 2
    }
    if (screenMat.current) {
      screenMat.current.emissive.lerp(stateColor, 0.1)
      screenMat.current.emissiveIntensity = working ? 0.5 + Math.sin(s.clock.elapsedTime * 6) * 0.08 : 0.15
    }
  })
  return (
    <group position={[0, 0.26, -0.55]}>
      <RoundedBox args={[1.9, 0.55, 0.7]} radius={0.06} smoothness={3} position={[0, 0.275, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#DEDAD2" roughness={0.6} />
      </RoundedBox>
      {/* slanted screen */}
      <group position={[0, 0.42, 0.36]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <planeGeometry args={[1.5, 0.36]} />
          <meshStandardMaterial ref={screenMat} color="#1A1A1A" emissive={C.grey} emissiveIntensity={0.2} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.11, 0.003]}>
          <planeGeometry args={[1.24, 0.05]} />
          <meshBasicMaterial color="#333" />
        </mesh>
        <mesh ref={bar} position={[-0.6, -0.11, 0.006]} scale={[0.001, 1, 1]}>
          <planeGeometry args={[1.2, 0.04]} />
          <meshBasicMaterial color={C.white} toneMapped={false} />
        </mesh>
        <Text font={FONT_MONO} fontSize={0.075} color={C.white} anchorX="left" anchorY="middle" position={[-0.7, 0.07, 0.004]}
          maxWidth={1.4} overflowWrap="break-word">
          {(agent?.current_task ?? 'standby').slice(0, 30).toUpperCase()}
        </Text>
      </group>
      {/* knobs */}
      <group ref={knobs} position={[0, 0.56, -0.12]}>
        {[-0.6, -0.3, 0.0].map((x, i) => (
          <group key={i} position={[x, 0.04, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.1, 0.11, 0.08, 24]} />
              <meshStandardMaterial color={i === 0 ? color : C.white} roughness={0.35} />
            </mesh>
            <mesh position={[0, 0.045, 0.05]}>
              <boxGeometry args={[0.02, 0.01, 0.07]} />
              <meshBasicMaterial color={i === 0 && color !== C.ink ? C.ink : C.ink} />
            </mesh>
          </group>
        ))}
      </group>
      {/* little speaker grille */}
      <group position={[0.55, 0.555, -0.12]}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[((i % 3) - 1) * 0.08, 0, (Math.floor(i / 3) - 1) * 0.08]}>
            <cylinderGeometry args={[0.018, 0.018, 0.01, 8]} />
            <meshBasicMaterial color="#9A968E" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

function LevelLeds({ level, color }: { level: number; color: string }) {
  return (
    <group position={[-W / 2 + 0.2, 0.27, -0.1]}>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, 0.03, -i * 0.16]}>
          <boxGeometry args={[0.1, 0.06, 0.1]} />
          <meshStandardMaterial color={i < level ? color : '#CFCBC3'} emissive={i < level ? color : '#000'}
            emissiveIntensity={i < level ? 0.35 : 0} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function QueueStack({ count }: { count: number }) {
  const n = Math.min(6, count)
  return (
    <group position={[W / 2 - 0.3, 0.27, 0.1]}>
      {Array.from({ length: n }).map((_, i) => (
        <mesh key={i} position={[0, 0.025 + i * 0.055, 0]} castShadow>
          <boxGeometry args={[0.32, 0.045, 0.24]} />
          <meshStandardMaterial color={i % 2 ? C.ink : '#F2EFE8'} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}
