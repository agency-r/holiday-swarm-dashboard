import type { AgentId, AgentState } from './types'

export const C = {
  bg: '#ECE9E2',
  floor: '#E3DFD6',
  panel: '#F7F5F0',
  white: '#FBFAF7',
  grey: '#C9C5BC',
  greyDark: '#8E8A82',
  ink: '#151515',
  yellow: '#FFC800',
  blue: '#2F6BFF',
  orange: '#FF6A13',
  green: '#27C46B',
} as const

export interface AgentMeta {
  id: AgentId
  name: string
  code: string
  role: string
  color: string
  shape: 'cube' | 'sphere' | 'cone' | 'cylinder' | 'octa' | 'torus' | 'capsule' | 'dodeca'
}

export const AGENTS: AgentMeta[] = [
  { id: 'aether', name: 'Aether', code: '01', role: 'Orchestrator / CEO', color: C.ink, shape: 'octa' },
  { id: 'scout', name: 'Scout', code: '02', role: 'Opportunity Research', color: C.blue, shape: 'sphere' },
  { id: 'forge', name: 'Forge', code: '03', role: 'Product Builder', color: C.orange, shape: 'cube' },
  { id: 'vitrine', name: 'Vitrine', code: '04', role: 'Storefront & Ops', color: C.yellow, shape: 'cylinder' },
  { id: 'echo', name: 'Echo', code: '05', role: 'Content & SEO', color: C.blue, shape: 'cone' },
  { id: 'amplifier', name: 'Amplifier', code: '06', role: 'Traffic & Growth', color: C.orange, shape: 'torus' },
  { id: 'closer', name: 'Closer', code: '07', role: 'Sales & Support', color: C.yellow, shape: 'capsule' },
  { id: 'pulse', name: 'Pulse', code: '08', role: 'Analytics', color: C.ink, shape: 'dodeca' },
]
export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<AgentId, AgentMeta>

/** Stations sit on a ring around the central revenue core. Aether faces the camera. */
export const RING_RADIUS = 6.4
export function stationPosition(id: AgentId): [number, number, number] {
  const i = AGENTS.findIndex((a) => a.id === id)
  const angle = Math.PI / 4 + (i / AGENTS.length) * Math.PI * 2
  return [Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS]
}

export const STATE_COLOR: Record<AgentState, string> = {
  idle: C.grey,
  researching: C.blue,
  building: C.orange,
  marketing: C.yellow,
  optimizing: C.green,
  blocked: '#E5484D',
  paused: C.greyDark,
}

export const STATE_LABEL: Record<AgentState, string> = {
  idle: 'IDLE',
  researching: 'RSRCH',
  building: 'BUILD',
  marketing: 'MRKT',
  optimizing: 'OPTIM',
  blocked: 'BLOCK',
  paused: 'PAUSE',
}

export const fmt$ = (n: number, d = 0) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const fmtN = (n: number) => n.toLocaleString('en-US')
