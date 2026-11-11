import { create } from 'zustand'
import type { AgentId, ControlAction, Snapshot, SwarmEvent } from './types'

export type Link = 'connecting' | 'backend' | 'local' | 'live'

/** A transient 3D effect (handoff arc, sale coin, broadcast) spawned from an event. */
export interface Fx {
  id: string
  kind: 'handoff' | 'sale' | 'insight' | 'compliance' | 'publish'
  from: AgentId
  to: AgentId | 'core'
  born: number
}

interface SwarmStore {
  snap: Snapshot | null
  link: Link
  dataError: string | null
  feed: SwarmEvent[]
  fx: Fx[]
  memoryPulse: number
  selected: AgentId | null
  hovered: AgentId | null
  saleFlash: number
  autoOrbit: boolean
  pointer: { x: number; y: number }
  toggleOrbit: () => void
  setPointer: (x: number, y: number) => void
  controlHandler: ((action: ControlAction, agent?: AgentId) => void) | null
  setSnapshot: (s: Snapshot) => void
  pushEvent: (e: SwarmEvent) => void
  setLink: (l: Link) => void
  setDataError: (err: string | null) => void
  select: (a: AgentId | null) => void
  hover: (a: AgentId | null) => void
  pruneFx: (now: number) => void
  setControlHandler: (fn: SwarmStore['controlHandler']) => void
  control: (action: ControlAction, agent?: AgentId) => void
}

const FX_TTL = 1800
const seen = new Set<string>()

export const useSwarm = create<SwarmStore>((set, get) => ({
  snap: null,
  link: 'connecting',
  dataError: null,
  feed: [],
  fx: [],
  memoryPulse: 0,
  selected: null,
  hovered: null,
  saleFlash: 0,
  autoOrbit: false,
  pointer: { x: 0, y: 0 },
  toggleOrbit: () => set((s) => ({ autoOrbit: !s.autoOrbit })),
  setPointer: (x, y) => set({ pointer: { x, y } }),
  controlHandler: null,
  setSnapshot: (snap) => {
    // first snapshot seeds the feed (no fx burst)
    if (!get().snap) {
      snap.events.forEach((e) => seen.add(e.id))
      set({ snap, feed: [...snap.events].reverse().slice(0, 60) })
    } else {
      // pick up events we may have missed (local sim emits through snapshot only)
      snap.events.forEach((e) => {
        if (!seen.has(e.id)) get().pushEvent(e)
      })
      set({ snap })
    }
  },
  pushEvent: (e) => {
    if (seen.has(e.id)) return
    seen.add(e.id)
    if (seen.size > 4000) seen.clear()
    const now = performance.now()
    const st = get()
    const fx = [...st.fx]
    let memoryPulse = st.memoryPulse
    let saleFlash = st.saleFlash
    if (e.kind === 'handoff' && e.target && e.target !== e.source) {
      fx.push({ id: e.id, kind: 'handoff', from: e.source, to: e.target, born: now })
      memoryPulse = now
    } else if (e.kind === 'sale') {
      if (fx.filter((f) => f.kind === 'sale').length < 6) fx.push({ id: e.id, kind: 'sale', from: 'vitrine', to: 'core', born: now })
      saleFlash = now
    } else if (e.kind === 'insight') {
      fx.push({ id: e.id, kind: 'insight', from: e.source, to: e.target ?? 'aether', born: now })
      memoryPulse = now
    } else if (e.kind === 'compliance' || e.kind === 'publish') {
      fx.push({ id: e.id, kind: e.kind, from: e.source, to: 'core', born: now })
    }
    set({ feed: [e, ...st.feed].slice(0, 60), fx: fx.slice(-40), memoryPulse, saleFlash })
  },
  setLink: (link) => set({ link }),
  setDataError: (dataError) => set({ dataError }),
  select: (selected) => set({ selected }),
  hover: (hovered) => set({ hovered }),
  pruneFx: (now) => {
    const fx = get().fx
    if (fx.some((f) => now - f.born > FX_TTL)) set({ fx: fx.filter((f) => now - f.born <= FX_TTL) })
  },
  setControlHandler: (controlHandler) => set({ controlHandler }),
  control: (action, agent) => get().controlHandler?.(action, agent),
}))

export const FX_DURATION = FX_TTL
